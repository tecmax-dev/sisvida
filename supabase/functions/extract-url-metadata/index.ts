import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ExtractedMetadata {
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
  url: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { url } = await req.json();

    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ error: "URL inválida" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate URL format
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return new Response(JSON.stringify({ error: "URL inválida" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[extract-url-metadata] Fetching: ${url}`);

    // Fetch the page with a browser-like user agent
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
      },
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ error: `Erro ao acessar URL: ${response.status}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const html = await response.text();

    // Extract metadata using regex (Deno edge functions don't have DOMParser)
    const metadata: ExtractedMetadata = {
      title: null,
      description: null,
      image: null,
      siteName: null,
      url: url,
    };

    // Helper to extract meta content
    const extractMeta = (property: string): string | null => {
      // Try og:property first
      const ogMatch = html.match(new RegExp(`<meta[^>]*property=["']og:${property}["'][^>]*content=["']([^"']+)["']`, 'i'));
      if (ogMatch) return ogMatch[1];

      // Try content first pattern
      const ogMatch2 = html.match(new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:${property}["']`, 'i'));
      if (ogMatch2) return ogMatch2[1];

      // Try name attribute
      const nameMatch = html.match(new RegExp(`<meta[^>]*name=["']${property}["'][^>]*content=["']([^"']+)["']`, 'i'));
      if (nameMatch) return nameMatch[1];

      // Try content first pattern for name
      const nameMatch2 = html.match(new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*name=["']${property}["']`, 'i'));
      if (nameMatch2) return nameMatch2[1];

      return null;
    };

    // Extract title - prefer h1 in main content for SPAs, then og:title, then title tag
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    metadata.title = h1Match?.[1]?.trim() 
      || extractMeta('title') 
      || html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() 
      || null;

    // Extract description (og:description > description meta > first paragraph)
    metadata.description = extractMeta('description') || null;

    // Helper to make image URL absolute
    const makeAbsolute = (imgUrl: string): string => {
      if (!imgUrl) return imgUrl;
      if (imgUrl.startsWith('http')) return imgUrl;
      if (imgUrl.startsWith('//')) return parsedUrl.protocol + imgUrl;
      if (imgUrl.startsWith('/')) return parsedUrl.origin + imgUrl;
      return parsedUrl.origin + '/' + imgUrl;
    };

    // Extract image - try multiple strategies
    let image = extractMeta('image');
    
    // If og:image looks like a logo/icon, try to find a content image instead
    const isLikelyLogo = image && (
      image.toLowerCase().includes('logo') ||
      image.toLowerCase().includes('icon') ||
      image.toLowerCase().includes('favicon')
    );

    if (!image || isLikelyLogo) {
      // Try to find a large content image from the page body
      // Look for images with common article image patterns
      const imgMatches = html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi);
      
      for (const match of imgMatches) {
        const imgSrc = match[1];
        // Skip small images, icons, logos, avatars
        const skipPatterns = /logo|icon|avatar|favicon|sprite|thumb-\d{2}|_\d{2}x\d{2}\.|pixel|tracking|badge/i;
        if (skipPatterns.test(imgSrc)) continue;
        
        // Prefer images from storage/CDN or with news/article in path
        const goodPatterns = /supabase|storage|news|article|content|upload|media|image/i;
        if (goodPatterns.test(imgSrc)) {
          image = imgSrc;
          break;
        }
        
        // Keep first non-skip image as fallback
        if (!image || isLikelyLogo) {
          image = imgSrc;
        }
      }
    }
    
    // Make image URL absolute
    if (image) {
      image = makeAbsolute(image);
    }
    metadata.image = image;

    // Extract site name
    metadata.siteName = extractMeta('site_name') || parsedUrl.hostname;

    // Decode HTML entities
    const decodeHtmlEntities = (str: string | null): string | null => {
      if (!str) return null;
      return str
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#x27;/g, "'")
        .replace(/&#x2F;/g, '/')
        .replace(/&nbsp;/g, ' ')
        .trim();
    };

    metadata.title = decodeHtmlEntities(metadata.title);
    metadata.description = decodeHtmlEntities(metadata.description);

    console.log(`[extract-url-metadata] Extracted:`, metadata);

    return new Response(JSON.stringify(metadata), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[extract-url-metadata] error:", err);
    return new Response(JSON.stringify({ error: "Erro ao extrair metadados" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
