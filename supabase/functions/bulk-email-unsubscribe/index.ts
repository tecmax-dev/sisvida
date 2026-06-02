import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function htmlPage(title: string, body: string): Response {
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>${title}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font-family:Arial,sans-serif;background:#f8fafc;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:20px}
.card{background:#fff;padding:40px;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,.08);max-width:480px;text-align:center}
h1{color:#16a394;margin:0 0 16px;font-size:22px}p{color:#475569;line-height:1.5;margin:0 0 12px}</style>
</head><body><div class="card">${body}</div></body></html>`;
  return new Response(html, { status: 200, headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    const cid = url.searchParams.get("cid");
    if (!token) return htmlPage("Erro", "<h1>Link inválido</h1><p>Token ausente.</p>");

    let decoded = "";
    try {
      // base64 may be missing padding
      const padded = token + "==".slice((token.length + 3) % 4 - 3);
      decoded = atob(padded);
    } catch {
      return htmlPage("Erro", "<h1>Link inválido</h1><p>Não foi possível decodificar o token.</p>");
    }

    const [clinicId, email] = decoded.split(":");
    if (!clinicId || !email) {
      return htmlPage("Erro", "<h1>Link inválido</h1><p>Token malformado.</p>");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    await supabase.from("email_unsubscribes").upsert({
      clinic_id: clinicId,
      email: email.toLowerCase(),
      source_campaign_id: cid || null,
      reason: "Link de descadastro",
    }, { onConflict: "clinic_id,email" });

    return htmlPage("Descadastrado", `<h1>Você foi descadastrado</h1>
      <p>O e-mail <strong>${email}</strong> não receberá mais mensagens deste sindicato.</p>
      <p style="font-size:13px;color:#94a3b8;margin-top:24px">Caso tenha sido um engano, entre em contato com o sindicato.</p>`);
  } catch (err: any) {
    console.error("[bulk-email-unsubscribe] erro:", err?.message);
    return htmlPage("Erro", `<h1>Erro</h1><p>${err?.message || "Erro desconhecido"}</p>`);
  }
});