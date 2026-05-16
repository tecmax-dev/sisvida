import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Mapa de ações -> edge function alvo
const ACTION_MAP: Record<string, string> = {
  consultar_associado: "check-sindical-associado-by-cpf",
  buscar_paciente: "search-patient-by-cpf",
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
        acoes_disponiveis: [...Object.keys(ACTION_MAP), "gerar_boleto"],
      }, 400);
    }

    // Ação especial: gerar_boleto por CNPJ (empresa)
    if (action === "gerar_boleto" || action === "gerar_segunda_via_boleto") {
      return await handleGerarBoletoPorCnpj(payload);
    }

    const target = ACTION_MAP[action];
    if (!target) {
      return json({
        success: false,
        error: `Ação '${action}' não reconhecida.`,
        acoes_disponiveis: [...Object.keys(ACTION_MAP), "gerar_boleto"],
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

async function handleGerarBoletoPorCnpj(payload: any) {
  const rawCnpj = String(payload?.cnpj ?? "").replace(/\D/g, "");
  if (rawCnpj.length !== 14) {
    return json({
      success: false,
      error: "CNPJ inválido. Informe os 14 dígitos.",
    }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // Buscar empresa
  const { data: employer, error: empErr } = await supabase
    .from("employers")
    .select("id, name, cnpj, email, phone")
    .eq("cnpj", rawCnpj)
    .maybeSingle();

  if (empErr) {
    console.error("[gerar_boleto] erro empresa:", empErr);
    return json({ success: false, error: "Erro ao buscar empresa." }, 500);
  }
  if (!employer) {
    return json({
      success: false,
      action: "gerar_boleto",
      error: "Empresa não encontrada para o CNPJ informado.",
    }, 404);
  }

  // Buscar contribuições em aberto (pendentes ou vencidas) com boleto Lytex já emitido
  const { data: contribs, error: contribErr } = await supabase
    .from("employer_contributions")
    .select("id, competence_month, competence_year, value, due_date, status, lytex_invoice_url, lytex_boleto_digitable_line, lytex_pix_code")
    .eq("employer_id", employer.id)
    .in("status", ["pending", "overdue"])
    .order("due_date", { ascending: true });

  if (contribErr) {
    console.error("[gerar_boleto] erro contribuições:", contribErr);
    return json({ success: false, error: "Erro ao buscar contribuições." }, 500);
  }

  const boletos = (contribs ?? [])
    .filter((c: any) => c.lytex_invoice_url)
    .map((c: any) => ({
      contribution_id: c.id,
      competencia: `${String(c.competence_month).padStart(2, "0")}/${c.competence_year}`,
      valor_reais: (c.value ?? 0) / 100,
      vencimento: c.due_date,
      status: c.status,
      boleto_url: c.lytex_invoice_url,
      linha_digitavel: c.lytex_boleto_digitable_line ?? null,
      pix_copia_cola: c.lytex_pix_code ?? null,
    }));

  return json({
    success: true,
    action: "gerar_boleto",
    empresa: {
      id: employer.id,
      nome: employer.name,
      cnpj: employer.cnpj,
      email: employer.email,
      telefone: employer.phone,
    },
    quantidade: boletos.length,
    boletos,
    mensagem: boletos.length === 0
      ? "Nenhum boleto em aberto encontrado para esta empresa."
      : `${boletos.length} boleto(s) em aberto.`,
  });
}