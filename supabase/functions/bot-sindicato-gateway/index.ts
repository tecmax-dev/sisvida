import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

// Mapa de ações -> edge function alvo
const ACTION_MAP: Record<string, string> = {
  consultar_associado: "check-sindical-associado-by-cpf",
  buscar_paciente: "search-patient-by-cpf",
  gerar_boleto: "generate-boleto-reissue",
  gerar_segunda_via_boleto: "generate-boleto-reissue",
  consultar_cnpj: "lookup-cnpj",
  enviar_boleto_email: "send-boleto-email",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { action, ...payload } = body ?? {};

    if (!action || typeof action !== "string") {
      return json({
        success: false,
        error: "Campo 'action' é obrigatório.",
        acoes_disponiveis: Object.keys(ACTION_MAP),
      }, 400);
    }

    const target = ACTION_MAP[action];
    if (!target) {
      return json({
        success: false,
        error: `Ação '${action}' não reconhecida.`,
        acoes_disponiveis: Object.keys(ACTION_MAP),
      }, 400);
    }

    const url = `${SUPABASE_URL}/functions/v1/${target}`;
    console.log(`[bot-sindicato-gateway] action=${action} -> ${target}`);

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${ANON_KEY}`,
        "apikey": ANON_KEY,
      },
      body: JSON.stringify(payload),
    });

    const data = await resp.json().catch(() => ({}));
    return json({ success: resp.ok, action, data }, resp.status);
  } catch (err) {
    console.error("[bot-sindicato-gateway] erro:", err);
    return json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}