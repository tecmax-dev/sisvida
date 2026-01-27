import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ResponseBody =
  | { error: string }
  | { contentType: string; base64: string };

function arrayBufferToBase64(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" } satisfies ResponseBody), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { url } = await req.json();

    if (!url || typeof url !== "string" || url.length > 2048) {
      return new Response(JSON.stringify({ error: "URL inválida" } satisfies ResponseBody), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return new Response(JSON.stringify({ error: "URL inválida" } satisfies ResponseBody), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (parsed.protocol !== "https:") {
      return new Response(JSON.stringify({ error: "Somente URLs https são permitidas" } satisfies ResponseBody), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SSRF guard: allow backend host and common trusted image hosts
    const backendUrl = Deno.env.get("SUPABASE_URL");
    if (!backendUrl) throw new Error("Missing SUPABASE_URL");
    const backendHost = new URL(backendUrl).host;

    // Allowed hosts for images: Supabase storage + common CDNs/storage services
    const allowedHosts = [
      backendHost,
      // Common image hosting services
      "storage.googleapis.com",
      "firebasestorage.googleapis.com",
      "s3.amazonaws.com",
      "s3.us-east-1.amazonaws.com",
      "s3.us-west-2.amazonaws.com",
      "s3.sa-east-1.amazonaws.com",
      "blob.core.windows.net",
      "res.cloudinary.com",
      "images.unsplash.com",
      "i.imgur.com",
      "lh3.googleusercontent.com",
      // Custom domains that may host logos
      "app.eclini.com.br",
      "eclini.com.br",
    ];

    // Also allow any *.supabase.co host
    const isSupabaseHost = parsed.host.endsWith(".supabase.co");
    const isAllowedHost = allowedHosts.includes(parsed.host) || isSupabaseHost;

    if (!isAllowedHost) {
      console.warn(`[fetch-image-base64] Blocked host: ${parsed.host}`);
      return new Response(JSON.stringify({ error: "Host não permitido" } satisfies ResponseBody), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const res = await fetch(url, {
      headers: {
        // Some CDNs behave better with an explicit UA
        "User-Agent": "LovableCloud/1.0",
        Accept: "image/*,*/*;q=0.8",
      },
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ error: `Falha ao buscar imagem (HTTP ${res.status})` } satisfies ResponseBody), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const contentType = res.headers.get("content-type") || "application/octet-stream";
    if (!contentType.startsWith("image/")) {
      return new Response(JSON.stringify({ error: "URL não aponta para uma imagem" } satisfies ResponseBody), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const buf = await res.arrayBuffer();
    const base64 = arrayBufferToBase64(buf);

    return new Response(JSON.stringify({ contentType, base64 } satisfies ResponseBody), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[fetch-image-base64] error:", err);
    return new Response(JSON.stringify({ error: "Erro ao buscar imagem" } satisfies ResponseBody), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
