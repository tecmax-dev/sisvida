import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const META_GRAPH_VERSION = Deno.env.get("META_GRAPH_VERSION") || "v21.0";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const WABA_ID = Deno.env.get("META_WABA_ID");
    const TOKEN = Deno.env.get("META_WHATSAPP_TOKEN");

    if (!WABA_ID || !TOKEN) {
      return new Response(
        JSON.stringify({ error: "META_WABA_ID e META_WHATSAPP_TOKEN são obrigatórios" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Template para notificar o associado quando o profissional cancela a consulta
    // Variáveis:
    //   {{1}} nome do associado
    //   {{2}} nome do profissional
    //   {{3}} especialidade
    //   {{4}} data (dd/mm/aaaa)
    //   {{5}} hora (hh:mm)
    //   {{6}} motivo informado pelo profissional / clínica
    const payload = {
      name: "cancelamento_consulta_profissional",
      category: "UTILITY",
      language: "pt_BR",
      components: [
        {
          type: "BODY",
          text:
            "Olá, {{1}}. Informamos que sua consulta com *{{2}}* ({{3}}), marcada para *{{4}} às {{5}}*, foi *cancelada pelo profissional*.\n\n" +
            "Motivo: {{6}}\n\n" +
            "Pedimos desculpas pelo transtorno. Para reagendar, acesse o aplicativo do Sindicato ou entre em contato com a secretaria.",
          example: {
            body_text: [[
              "Maria",
              "Dr. João Silva",
              "Clínico Geral",
              "10/06/2026",
              "14:30",
              "Imprevisto na agenda do profissional",
            ]],
          },
        },
        { type: "FOOTER", text: "Sindicato dos Comerciários" },
      ],
    };

    const url =
      "https://graph.facebook.com/" + META_GRAPH_VERSION + "/" + WABA_ID + "/message_templates";

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + TOKEN,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const json = await res.json();

    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: "Falha ao criar template na Meta", meta: json }),
        { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: true, meta: json, template: payload.name }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});