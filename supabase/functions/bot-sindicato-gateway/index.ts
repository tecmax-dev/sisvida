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

    // Ação especial: agendar_consulta (em manutenção até 30/05/2026)
    if (
      action === "agendar_consulta" ||
      action === "agendamento" ||
      action === "marcar_consulta" ||
      action === "agendar"
    ) {
      return json({
        success: true,
        action: "agendar_consulta",
        tipo_retorno: "indisponivel_temporariamente",
        disponivel: false,
        disponivel_em: "2026-05-30",
        mensagem:
          "O agendamento de consultas pelo WhatsApp ainda não está disponível. Informe ao associado que o recurso será liberado a partir de 30/05/2026.",
        texto_para_cliente:
          "📅 *Agendamento de consultas pelo WhatsApp*\n\nEste recurso ainda não está disponível.\n\n*Liberação prevista: 30/05/2026.*\n\nEnquanto isso, realize seu agendamento pelo aplicativo ProsindWeb.",
        instrucao_ia:
          "Não tente coletar dados nem prosseguir com agendamento. Apenas envie a mensagem informando que o recurso estará disponível a partir de 30/05/2026 e oriente o uso do aplicativo.",
      });
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
  const competenciaFiltro = parseCompetencia(payload);
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
  let contribQuery = supabase
    .from("employer_contributions")
    .select("id, competence_month, competence_year, value, due_date, status, lytex_invoice_url, lytex_boleto_digitable_line, lytex_pix_code")
    .eq("employer_id", employer.id)
    .in("status", ["pending", "overdue"])
    .order("due_date", { ascending: true });

  if (competenciaFiltro) {
    contribQuery = contribQuery
      .eq("competence_month", competenciaFiltro.month)
      .eq("competence_year", competenciaFiltro.year);
  }

  const { data: contribs, error: contribErr } = await contribQuery;

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

  if (boletos.length > 1 && !competenciaFiltro) {
    const opcoes = boletos.map((boleto: any) => ({
      contribution_id: boleto.contribution_id,
      competencia: boleto.competencia,
      valor_reais: boleto.valor_reais,
      vencimento: boleto.vencimento,
      status: boleto.status,
    }));

    return json({
      success: true,
      action: "gerar_boleto",
      tipo_retorno: "selecionar_competencia",
      requires_selection: true,
      empresa: {
        id: employer.id,
        nome: employer.name,
        cnpj: employer.cnpj,
        email: employer.email,
        telefone: employer.phone,
      },
      quantidade: boletos.length,
      opcoes,
      mensagem: `Encontrei ${boletos.length} boletos em aberto para ${employer.name}. Pergunte ao usuário qual competência deseja acessar antes de enviar qualquer link.`,
      texto_para_cliente: `Encontrei ${boletos.length} boletos em aberto para ${employer.name}. Informe a competência desejada, por exemplo: ${opcoes[0]?.competencia}.`,
      instrucao_ia: "Não diga que os boletos foram gerados e não envie um único link como se representasse todos. Mostre as competências disponíveis e peça para o usuário escolher uma. Depois chame novamente esta ação enviando cnpj e competencia.",
    });
  }

  const tipoRetorno =
    boletos.length === 0
      ? "sem_boleto"
      : boletos.length === 1
        ? "boleto_unico"
        : "multiplos_boletos_competencia";

  let mensagem: string;
  let textoCliente: string;
  let instrucaoIa: string | undefined;

  if (boletos.length === 0) {
    mensagem = competenciaFiltro
      ? "Nenhum boleto em aberto encontrado para esta empresa nesta competência."
      : "Nenhum boleto em aberto encontrado para esta empresa.";
    textoCliente = competenciaFiltro
      ? "Não encontrei boleto em aberto para essa competência."
      : "Não encontrei boletos em aberto para esta empresa.";
  } else if (boletos.length === 1) {
    mensagem = `Boleto da competência ${boletos[0].competencia} encontrado.`;
    textoCliente = `Boleto da competência ${boletos[0].competencia}: ${boletos[0].boleto_url}`;
  } else {
    const linhas = boletos
      .map((b: any, i: number) => `${i + 1}) Vencimento ${b.vencimento} – R$ ${Number(b.valor_reais).toFixed(2)} → ${b.boleto_url}`)
      .join("\n");
    mensagem = `Encontrei ${boletos.length} boletos em aberto na competência ${boletos[0].competencia}. Envie TODOS os links ao cliente, um para cada boleto.`;
    textoCliente = `Foram encontrados ${boletos.length} boletos em aberto na competência ${boletos[0].competencia}:\n${linhas}`;
    instrucaoIa = "Existem múltiplos boletos para a mesma competência. NÃO envie apenas um link. Liste todos os boletos com vencimento, valor e link individual para cada um.";
  }

  return json({
    success: true,
    action: "gerar_boleto",
    tipo_retorno: tipoRetorno,
    requires_selection: false,
    empresa: {
      id: employer.id,
      nome: employer.name,
      cnpj: employer.cnpj,
      email: employer.email,
      telefone: employer.phone,
    },
    quantidade: boletos.length,
    boletos,
    boleto: boletos[0] ?? null,
    mensagem,
    texto_para_cliente: textoCliente,
    ...(instrucaoIa ? { instrucao_ia: instrucaoIa } : {}),
  });
}

function parseCompetencia(payload: any): { month: number; year: number } | null {
  const raw = String(
    payload?.competencia ??
    payload?.competence ??
    payload?.mes_ano ??
    ""
  ).trim();

  const monthFromPayload = Number(payload?.competence_month ?? payload?.mes ?? payload?.month);
  const yearFromPayload = Number(payload?.competence_year ?? payload?.ano ?? payload?.year);
  if (Number.isInteger(monthFromPayload) && Number.isInteger(yearFromPayload) && monthFromPayload >= 1 && monthFromPayload <= 12 && yearFromPayload >= 2000) {
    return { month: monthFromPayload, year: yearFromPayload };
  }

  const slashMatch = raw.match(/^(\d{1,2})\D+(\d{4})$/);
  if (slashMatch) {
    const month = Number(slashMatch[1]);
    const year = Number(slashMatch[2]);
    if (month >= 1 && month <= 12) return { month, year };
  }

  const isoMatch = raw.match(/^(\d{4})\D+(\d{1,2})$/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    if (month >= 1 && month <= 12) return { month, year };
  }

  return null;
}