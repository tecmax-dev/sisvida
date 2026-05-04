import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const META_GRAPH_VERSION = "v21.0";

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

    const payload = {
      name: "agendamento_consulta",
      category: "UTILITY",
      language: "pt_BR",
      components: [
        {
          type: "BODY",
          text: "Olá {{1}}! Para agendar consultas, utilize exclusivamente o nosso Aplicativo SECMI. É rápido, fácil e você escolhe o melhor horário por lá. Caso ainda não tenha o app, baixe agora na sua loja de aplicativos!",
          example: {
            body_text: [["Associado"]]
          }
        }
      ]
    };

    const res = await fetch(
      \`https://graph.facebook.com/\${META_GRAPH_VERSION}/\${WABA_ID}/message_templates\`,
      {
        method: "POST",
        headers: {
          Authorization: \`Bearer \${TOKEN}\`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    const json = await res.json();

    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: "Falha ao criar template na Meta", meta: json }),
        { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: true, meta: json }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
