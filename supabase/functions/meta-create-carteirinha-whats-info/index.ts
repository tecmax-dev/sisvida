import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const META_GRAPH_VERSION = "v21.0";
const WABA_IDS = ["2080967275794470", "998516322649692", "1030747186799321"];

const template = {
  name: "ia_prontuario_informativo",
  language: "pt_BR",
  category: "UTILITY",
  components: [
    {
      type: "BODY",
      text: "Informação de Serviço: Olá, {{1}}. Comunicamos que a atualização da carteira de associado pode ser realizada diretamente pelo WhatsApp, de forma automática e com validação em tempo real.\n\nPara atualizar, envie a foto do contracheque mais recente neste canal informando seu CPF. A validade da carteira é renovada imediatamente após a verificação automática do documento.\n\nA opção pelo aplicativo oficial permanece disponível, com validação realizada pela secretaria do Sindicato.",
      example: { body_text: [["João da Silva"]] },
    },
    { type: "FOOTER", text: "Sindicato dos Comerciários" },
    {
      type: "BUTTONS",
      buttons: [
        { type: "URL", text: "Acessar Aplicativo", url: "https://prosindweb.com.br/app" },
      ],
    },
  ],
};

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
    const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${wabaId}/message_templates`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify(template),
      });
      const json = await res.json();
      results.push({ wabaId, ok: res.ok, status: res.status, response: json });
    } catch (e) {
      results.push({ wabaId, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return new Response(JSON.stringify({ results }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});