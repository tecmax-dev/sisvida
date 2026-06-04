import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function metaToSmsText(components: any[]): string {
  const body = Array.isArray(components)
    ? components.find((c) => (c?.type || "").toUpperCase() === "BODY")
    : null;
  let text: string = body?.text ?? "";
  // Meta {{1}} -> {1}
  text = text.replace(/\{\{\s*(\d+)\s*\}\}/g, "{$1}");
  // Remover formatação Markdown simples do WhatsApp
  text = text.replace(/\*(.+?)\*/g, "$1").replace(/_(.+?)_/g, "$1").replace(/~(.+?)~/g, "$1");
  // Colapsar quebras múltiplas
  text = text.replace(/\n{3,}/g, "\n\n").trim();
  return text;
}

function countVars(text: string): number {
  const matches = text.match(/\{(\d+)\}/g) ?? [];
  if (matches.length === 0) return 0;
  return Math.max(...matches.map((m) => parseInt(m.replace(/\D/g, ""), 10) || 0));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: templates, error: tplErr } = await admin
      .from("whatsapp_meta_templates")
      .select("name, status, components, language")
      .eq("status", "APPROVED");

    if (tplErr) throw tplErr;

    let synced = 0;
    let skipped = 0;
    for (const tpl of templates ?? []) {
      const body = metaToSmsText((tpl.components as any[]) || []);
      if (!body || body.length === 0) { skipped++; continue; }
      const variablesCount = countVars(body);
      const variables = Array.from({ length: variablesCount }, (_, i) => ({ index: i + 1 }));

      const { error: upsertErr } = await admin
        .from("sms_templates")
        .upsert(
          {
            name: tpl.name,
            meta_template_name: tpl.name,
            body: body.slice(0, 459), // 3 SMS concatenados ~ 459 chars GSM-7
            variables,
            status: "active",
          },
          { onConflict: "meta_template_name" },
        );

      if (upsertErr) {
        console.error("upsert error", tpl.name, upsertErr);
        skipped++;
      } else {
        synced++;
      }
    }

    return new Response(JSON.stringify({ ok: true, synced, skipped, total: templates?.length ?? 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("sync error", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});