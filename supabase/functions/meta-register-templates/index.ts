import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const META_GRAPH_VERSION = "v21.0";

type Component =
  | { type: "BODY"; text?: string; add_security_recommendation?: boolean; example?: { body_text: string[][] } }
  | { type: "FOOTER"; text?: string; code_expiration_minutes?: number }
  | { type: "BUTTONS"; buttons: Array<{ type: "OTP"; otp_type: "COPY_CODE"; text: string }> };

interface TemplatePayload {
  name: string;
  language: string;
  category: "UTILITY" | "AUTHENTICATION" | "MARKETING";
  components: Component[];
}

const LANG = "pt_BR";

const templates: TemplatePayload[] = [
  {
    name: "boleto_mensalidade",
    language: LANG,
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text:
          "Olá, {{1}}. Sua mensalidade do Sindicato dos Comerciários referente a {{2}} está disponível.\n\nValor: R$ {{3}}\nVencimento: {{4}}\n\nAcesse o boleto e o código PIX em: {{5}} (link individual).",
        example: { body_text: [["João da Silva", "03/2026", "45,00", "10/03/2026", "https://app.sindicato.com.br/b/abc123"]] },
      },
      { type: "FOOTER", text: "Sindicato dos Comerciários" },
    ],
  },
  {
    name: "lembrete_consulta",
    language: LANG,
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text:
          "Olá, {{1}}. Lembrete da sua consulta no Sindicato dos Comerciários.\n\nProfissional: {{2}}\nEspecialidade: {{3}}\nData: {{4}} às {{5}}\nLocal: {{6}}\n\nEm caso de imprevisto, reagende em: https://app.sindicato.com.br",
        example: { body_text: [["Maria Santos", "Dr. Carlos Mendes", "Cardiologia", "15/03/2026", "14:30", "Sede Central - Rua Principal, 100"]] },
      },
      { type: "FOOTER", text: "Sindicato dos Comerciários" },
    ],
  },
  {
    name: "confirmacao_agendamento",
    language: LANG,
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text:
          "Olá, {{1}}. Sua consulta foi agendada com sucesso.\n\nProfissional: {{2}}\nEspecialidade: {{3}}\nData: {{4}} às {{5}}\nLocal: {{6}}\n\nPara reagendar ou cancelar, acesse: https://app.sindicato.com.br",
        example: { body_text: [["Maria Santos", "Dr. Carlos Mendes", "Cardiologia", "15/03/2026", "14:30", "Sede Central - Rua Principal, 100"]] },
      },
      { type: "FOOTER", text: "Sindicato dos Comerciários" },
    ],
  },
  {
    name: "carteira_vencendo",
    language: LANG,
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text:
          "Olá, {{1}}. Sua carteira de sócio do Sindicato dos Comerciários vence em {{2}}.\n\nPara manter o acesso aos benefícios, regularize antes do vencimento em: https://app.sindicato.com.br",
        example: { body_text: [["João da Silva", "30/03/2026"]] },
      },
      { type: "FOOTER", text: "Sindicato dos Comerciários" },
    ],
  },
  {
    name: "carteira_vencida",
    language: LANG,
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text:
          "Olá, {{1}}. Sua carteira de sócio do Sindicato dos Comerciários venceu em {{2}}.\n\nPara reativar seus benefícios, regularize sua situação em: https://app.sindicato.com.br",
        example: { body_text: [["João da Silva", "28/02/2026"]] },
      },
      { type: "FOOTER", text: "Sindicato dos Comerciários" },
    ],
  },
  {
    name: "boleto_vencido",
    language: LANG,
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text:
          "Olá, {{1}}. Identificamos que sua mensalidade referente a {{2}} está em aberto.\n\nValor original: R$ {{3}}\nVencimento original: {{4}}\n\nPara regularizar com a 2ª via atualizada, acesse: {{5}} (link individual).",
        example: { body_text: [["João da Silva", "02/2026", "45,00", "10/02/2026", "https://app.sindicato.com.br/b/abc123"]] },
      },
      { type: "FOOTER", text: "Sindicato dos Comerciários" },
    ],
  },
  {
    name: "autorizacao_pronta",
    language: LANG,
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text:
          "Olá, {{1}}. Sua autorização para {{2}} está pronta.\n\nProfissional: {{3}}\nValidade: {{4}}\n\nAcesse o documento em: https://app.sindicato.com.br",
        example: { body_text: [["Maria Santos", "Consulta de Cardiologia", "Dr. Carlos Mendes", "30/04/2026"]] },
      },
      { type: "FOOTER", text: "Sindicato dos Comerciários" },
    ],
  },
  {
    name: "codigo_acesso",
    language: LANG,
    category: "AUTHENTICATION",
    components: [
      { type: "BODY", add_security_recommendation: true },
      { type: "FOOTER", code_expiration_minutes: 10 },
      { type: "BUTTONS", buttons: [{ type: "OTP", otp_type: "COPY_CODE", text: "Copiar código" }] },
    ],
  },
  {
    name: "recuperacao_senha",
    language: LANG,
    category: "AUTHENTICATION",
    components: [
      { type: "BODY", add_security_recommendation: true },
      { type: "FOOTER", code_expiration_minutes: 10 },
      { type: "BUTTONS", buttons: [{ type: "OTP", otp_type: "COPY_CODE", text: "Copiar código" }] },
    ],
  },
  {
    name: "filiacao_aprovada",
    language: LANG,
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text:
          "Olá, {{1}}. Sua filiação ao Sindicato dos Comerciários foi aprovada.\n\nNúmero de matrícula: {{2}}\nPlano: {{3}}\n\nAcesse o app para visualizar sua carteira digital e benefícios em: https://app.sindicato.com.br",
        example: { body_text: [["João da Silva", "2026-00123", "Plano Família"]] },
      },
      { type: "FOOTER", text: "Sindicato dos Comerciários" },
    ],
  },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const WABA_ID = Deno.env.get("META_WABA_ID");
  const TOKEN = Deno.env.get("META_WHATSAPP_TOKEN");

  if (!WABA_ID || !TOKEN) {
    return new Response(
      JSON.stringify({ error: "META_WABA_ID ou META_WHATSAPP_TOKEN não configurados" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Optional: filter by ?only=name1,name2
  const url = new URL(req.url);
  const only = url.searchParams.get("only");
  const onlySet = only ? new Set(only.split(",").map((s) => s.trim())) : null;

  const targets = onlySet ? templates.filter((t) => onlySet.has(t.name)) : templates;
  const endpoint = `https://graph.facebook.com/${META_GRAPH_VERSION}/${WABA_ID}/message_templates`;

  const results: Array<Record<string, unknown>> = [];

  for (const tpl of targets) {
    try {
      const r = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(tpl),
      });
      const data = await r.json();
      results.push({
        name: tpl.name,
        status: r.status,
        ok: r.ok,
        response: data,
      });
      console.log(`[meta-register] ${tpl.name} -> ${r.status} ${r.ok ? "OK" : "FAIL"}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ name: tpl.name, ok: false, error: msg });
      console.error(`[meta-register] ${tpl.name} EXCEPTION:`, msg);
    }
    // Small delay to avoid rate limit
    await new Promise((r) => setTimeout(r, 500));
  }

  const summary = {
    total: results.length,
    success: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  };

  return new Response(JSON.stringify(summary, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
