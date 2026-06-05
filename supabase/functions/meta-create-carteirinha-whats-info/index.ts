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

// DESATIVADO: o template instruía o usuário a enviar contracheque pelo WhatsApp,
// violando a política da Meta sobre coleta de PII/documentos sensíveis. Mantido
// apenas como casco; criação de template bloqueada para evitar nova infração.
serve((_req) =>
  new Response(
    JSON.stringify({
      disabled: true,
      reason:
        "Template desativado por violação de política Meta (coleta de PII via WhatsApp).",
      template_name: template.name,
    }),
    { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  )
);