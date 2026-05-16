import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const META_GRAPH_VERSION = "v21.0";
const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=br.org.secmi.comerciariosilheus.app&hl=pt_BR";

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

    const url0 = new URL(req.url);
    const which = url0.searchParams.get("template") || "migracao_app_playstore";

    const payloads: Record<string, any> = {
      migracao_app_playstore: {
        name: "migracao_app_playstore_v2",
      category: "UTILITY",
      language: "pt_BR",
      components: [
        {
          type: "BODY",
          text:
            "Sindicato dos Comerciários — aviso de atualização do aplicativo.\n\n{{1}}, identificamos que você utiliza a versão web (PWA) do app do sindicato.\n\nPara manter o acesso aos serviços do associado (carteirinha, contracheque, autorizações e agendamentos), atualize para a versão oficial publicada na Play Store.\n\nO login e os dados do associado permanecem os mesmos.",
          example: { body_text: [["João da Silva"]] },
        },
        { type: "FOOTER", text: "Atendimento ao associado" },
        {
          type: "BUTTONS",
          buttons: [
            {
              type: "URL",
              text: "Atualizar aplicativo",
              url: PLAY_STORE_URL,
            },
          ],
        },
      ],
      },
      atendimento_inicio: {
        name: "atendimento_inicio_v2",
        category: "UTILITY",
        language: "pt_BR",
        components: [
          {
            type: "BODY",
            text: "Sindicato dos Comerciários — atendimento ao associado.\n\n{{1}}, {{2}}. Segue retorno da sua solicitação:\n\n{{3}}\n\nAtenciosamente, equipe de atendimento.",
            example: { body_text: [["Bom dia", "João da Silva", "Sua carteirinha já está disponível para retirada na sede do sindicato."]] },
          },
          { type: "FOOTER", text: "Sindicato dos Comerciários" },
        ],
      },
      informativo_agenda_medica: {
        name: "informativo_agenda_medica_v2",
        category: "UTILITY",
        language: "pt_BR",
        components: [
          {
            type: "BODY",
            text:
              "Sindicato dos Comerciários — informativo da agenda de atendimento médico (utilidade pública, sem fins lucrativos).\n\n{{1}}, informamos a disponibilidade de atendimento médico no sindicato:\n\nEspecialidade: {{2}}\nProfissional: {{3}}\nData: {{4}}\nHorário: {{5}}\n\nAgendamento pelo aplicativo do sindicato ou na recepção.",
            example: {
              body_text: [[
                "João da Silva",
                "Clínico Geral",
                "Dr. Carlos Almeida",
                "20/05/2026",
                "14:00",
              ]],
            },
          },
          { type: "FOOTER", text: "Atendimento ao associado" },
        ],
      },
    };

    const payload = payloads[which];
    if (!payload) {
      return new Response(
        JSON.stringify({ error: "template desconhecido", available: Object.keys(payloads) }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

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
        JSON.stringify({ error: "Falha ao criar template na Meta", meta: json, sent: payload }),
        { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: true, meta: json, sent: payload }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});