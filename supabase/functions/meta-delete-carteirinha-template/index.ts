import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const META_GRAPH_VERSION = "v21.0";
const WABA_IDS = ["2080967275794470", "998516322649692", "1030747186799321"];
const TEMPLATE_NAME = "ia_prontuario_informativo";

/**
 * Remove o template `ia_prontuario_informativo` das WABAs do sindicato.
 * Esse template instruía o usuário a enviar contracheque via WhatsApp,
 * o que viola a política da Meta e contribuiu para o banimento.
 * Rodar UMA VEZ para limpar; reapelar a Meta na sequência.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const TOKEN = Deno.env.get("META_WHATSAPP_TOKEN");
  if (!TOKEN) {
    return new Response(JSON.stringify({ error: "META_WHATSAPP_TOKEN ausente" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: any[] = [];
  for (const wabaId of WABA_IDS) {
    const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${wabaId}/message_templates?name=${TEMPLATE_NAME}`;
    try {
      const res = await fetch(url, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${TOKEN}` },
      });
      const json = await res.json().catch(() => ({}));
      results.push({ wabaId, ok: res.ok, status: res.status, response: json });
    } catch (e) {
      results.push({ wabaId, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return new Response(JSON.stringify({ deleted_template: TEMPLATE_NAME, results }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});