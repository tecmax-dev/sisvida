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

    const scoreHtml = (htmlToScore: string): number => {
      let score = 0;
      if (/<h1[^>]*>/i.test(htmlToScore)) score += 10;
      if (/<article[^>]*>/i.test(htmlToScore)) score += 10;
      if (/\bprose\b|ql-editor/i.test(htmlToScore)) score += 10;
      if (/news-images|\/storage\/v1\/object\/public\/news-images/i.test(htmlToScore)) score += 15;
      if (/<meta[^>]*property=["']og:title["']/i.test(htmlToScore)) score += 3;
      const pCount = (htmlToScore.match(/<p\b/gi) || []).length;
      score += Math.min(20, pCount);
      return score;
    };

    const variants: Array<{ label: string; init: RequestInit }> = [
      {
        label: "plain",
        init: {},
      },
      {
        label: "browser",
        init: {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
          },
        },
      },
      {
        label: "bot",
        init: {
          headers: {
            "User-Agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
          },
        },
      },
    ];

    let best:
      | { response: Response; html: string; score: number; label: string }
      | null = null;

    for (const v of variants) {
      try {
        const res = await fetch(url, v.init);
        const body = await res.text();
        const score = scoreHtml(body);
        console.log(
          `[extract-url-metadata] Fetch ${v.label}: status=${res.status} score=${score} final=${res.url}`
        );

        if (res.ok && (!best || score > best.score)) {
          best = { response: res, html: body, score, label: v.label };
        }
      } catch (e) {
        console.warn(`[extract-url-metadata] Fetch ${v.label} failed:`, e);
      }
    }

    if (!best) {
      return new Response(JSON.stringify({ error: `Erro ao acessar URL` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = best.response;
    let html = best.html;

    // If the request was redirected, update base URL to keep relative URLs correct
    if (response.url) {
      try {
        parsedUrl = new URL(response.url);
      } catch {
        // ignore
      }
    }

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

    // Extract title - prefer the most "article-like" H1 (longest), then og:title, then title tag
    const stripTags = (input: string): string =>
      input
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const h1Candidates = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)]
      .map((m) => stripTags(m[1] || ''))
      .map((t) => t.trim())
      .filter(Boolean)
      .sort((a, b) => b.length - a.length);

    metadata.title = h1Candidates[0]
      || extractMeta('title')
      || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim()
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
      // (support lazy-loading attributes and srcset)
      const imgMatches = html.matchAll(/<img[^>]*(?:src|data-src|data-lazy-src)=["']([^"']+)["'][^>]*>/gi);
      
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

      // If we still don't have an image, try srcset
      if (!image) {
        const srcsetMatch = html.match(/<img[^>]*srcset=["']([^"']+)["'][^>]*>/i);
        const srcset = srcsetMatch?.[1];
        if (srcset) {
          const first = srcset.split(',')[0]?.trim();
          const firstUrl = first?.split(' ')[0];
          if (firstUrl && !/logo|icon|favicon/i.test(firstUrl)) {
            image = firstUrl;
          }
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
