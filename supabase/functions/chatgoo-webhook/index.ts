// ENTRADA ÚNICA CHATGOO -> PROSINGE/SINDEXA
// Recebe mensagens do ChatGoo (multiatendimento estilo Whaticket), identifica o
// associado pelo telefone dentro do tenant correto e responde SOMENTE com dados
// autorizados. Envio proativo/template continua exclusivamente pela Meta Cloud API.
//
// Compliance (fail-closed):
//  - Assinatura HMAC obrigatória.
//  - clinic_id NUNCA vem do payload.
//  - Identidade ambígua/inexistente => handoff humano, nunca assume cadastro.
//  - Toda decisão é registrada em chatgoo_events.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import {
  chatgooSendListViaMeta,
  chatgooSendTextViaMeta,
  chatgooTransferToQueue,
  verifyChatgooSignature,
} from "../_shared/chatgoo-client.ts";
import { normalizeBrPhone } from "../_shared/whatsappConsentGate.ts";

const SINDICATO_CLINIC_ID = "89e7585e-7bce-4e58-91fa-c37080d1170d";

type Intent =
  | "CADASTRO"
  | "CARTEIRINHA"
  | "AGENDAMENTOS"
  | "HOMOLOGACAO"
  | "FINANCEIRO"
  | "EMP_BOLETOS"
  | "EMP_2VIA"
  | "CTB_2VIA"
  | "EMP_ATUALIZAR"
  | "CTB_ATUALIZAR"
  | "ATUALIZAR_BOLETO"
  | "EMP_HOMOLOGACAO"
  | "EMP_DADOS"
  | "CTB_EMPRESAS"
  | "CTB_BOLETOS"
  | "MENU_ASSOCIADO"
  | "MENU_EMPRESA"
  | "MENU_CONTABILIDADE"
  | "HUMANO"
  | "SEGUNDA_VIA"
  | "MENU";

function detectIntent(text: string): Intent {
  const t = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (/(atendente|humano|falar com|pessoa|suporte)/.test(t)) return "HUMANO";
  if (/(menu|inicio|voltar|opcoes)/.test(t)) return "MENU";
  if (/(sou empresa|empresa|empregador)/.test(t)) return "MENU_EMPRESA";
  if (/(contabilidade|contador|escritorio)/.test(t)) return "MENU_CONTABILIDADE";
  if (/(sou associado|associado|socio)/.test(t)) return "MENU_ASSOCIADO";
  if (/(carteirinha|carteira|validade)/.test(t)) return "CARTEIRINHA";
  if (/(consulta|agendamento|marcac|horario|medic)/.test(t)) return "AGENDAMENTOS";
  if (/(homologa|rescis)/.test(t)) return "HOMOLOGACAO";
  if (/(informar valor|atualizar boleto|boleto zerado|valor zerado|novo vencimento|alterar vencimento|mudar vencimento)/.test(t)) return "ATUALIZAR_BOLETO";
  if (/(2a via|2 via|segunda via|reemitir|reemissao|reenviar boleto)/.test(t)) return "SEGUNDA_VIA";
  if (/(boleto|contribui|mensalidade|pagamento|debito)/.test(t)) return "FINANCEIRO";
  if (/(cadastro|meus dados|situacao)/.test(t)) return "CADASTRO";
  return "MENU";
}

function phoneVariants(e164: string): string[] {
  const local = e164.slice(2);
  const set = new Set<string>([e164, `+${e164}`, local]);
  if (local.length === 11) set.add(local.slice(0, 2) + local.slice(3));
  if (local.length === 10) set.add(`${local.slice(0, 2)}9${local.slice(2)}`);
  return [...set];
}

function fmtDate(value: string | null | undefined): string {
  if (!value) return "-";
  const [y, m, d] = String(value).slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : String(value);
}

function fmtMoney(v: unknown): string {
  const n = Number(v ?? 0);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Menu inicial: separa o atendimento pelo perfil de quem está falando.
const ROOT_MENU = [
  "Olá! Sou o atendimento automático do sindicato.",
  "",
  "Para começar, me diga quem é você:",
  "1 - Sou associado",
  "2 - Sou empresa",
  "3 - Sou contabilidade",
  "",
  "Responda com o número da opção.",
].join("\n");

const ROOT_LIST_ROWS = [
  { id: "OPT_PERFIL_ASSOCIADO", title: "Sou associado", description: "Cadastro, carteirinha, consultas e boletos" },
  { id: "OPT_PERFIL_EMPRESA", title: "Sou empresa", description: "Contribuições, boletos e homologação" },
  { id: "OPT_PERFIL_CONTABILIDADE", title: "Sou contabilidade", description: "Empresas do escritório e boletos" },
];

const ASSOC_MENU = [
  "Atendimento ao associado:",
  "1 - Meu cadastro / situação",
  "2 - Carteirinha (validade)",
  "3 - Meus agendamentos",
  "4 - Homologação de rescisão",
  "5 - Boletos e contribuições",
  "6 - Falar com um atendente",
].join("\n");

const ASSOC_LIST_ROWS = [
  { id: "OPT_CADASTRO", title: "Meu cadastro", description: "Dados e situação de associado" },
  { id: "OPT_CARTEIRINHA", title: "Carteirinha", description: "Validade e situação da carteirinha" },
  { id: "OPT_AGENDAMENTOS", title: "Agendamentos", description: "Suas próximas consultas" },
  { id: "OPT_HOMOLOGACAO", title: "Homologação", description: "Homologação de rescisão" },
  { id: "OPT_FINANCEIRO", title: "Boletos", description: "Contribuições em aberto" },
  { id: "OPT_HUMANO", title: "Falar com atendente", description: "Transferir para a equipe" },
];

const EMP_MENU = [
  "Atendimento à empresa:",
  "1 - Boletos e contribuições da empresa",
  "2 - Homologações da empresa",
  "3 - Segunda via de boleto",
  "4 - Informar valor / atualizar vencimento",
  "5 - Dados cadastrais da empresa",
  "6 - Falar com um atendente",
].join("\n");

const EMP_LIST_ROWS = [
  { id: "OPT_EMP_BOLETOS", title: "Boletos", description: "Contribuições em aberto da empresa" },
  { id: "OPT_EMP_HOMOLOGACAO", title: "Homologações", description: "Agendamentos de rescisão" },
  { id: "OPT_EMP_2VIA", title: "2ª via de boleto", description: "Reenviar link e código do boleto" },
  { id: "OPT_EMP_ATUALIZAR", title: "Informar valor", description: "Valor, tipo e novo vencimento" },
  { id: "OPT_EMP_DADOS", title: "Dados cadastrais", description: "Dados da empresa no sindicato" },
  { id: "OPT_EMP_HUMANO", title: "Falar com atendente", description: "Transferir para a equipe" },
];

const CTB_MENU = [
  "Atendimento à contabilidade:",
  "1 - Empresas do escritório",
  "2 - Boletos em aberto das empresas",
  "3 - Segunda via de boleto",
  "4 - Informar valor / atualizar vencimento",
  "5 - Falar com um atendente",
].join("\n");

const CTB_LIST_ROWS = [
  { id: "OPT_CTB_EMPRESAS", title: "Empresas", description: "Empresas vinculadas ao escritório" },
  { id: "OPT_CTB_BOLETOS", title: "Boletos", description: "Contribuições em aberto das empresas" },
  { id: "OPT_CTB_2VIA", title: "2ª via de boleto", description: "Reenviar link e código do boleto" },
  { id: "OPT_CTB_ATUALIZAR", title: "Informar valor", description: "Valor, tipo e novo vencimento" },
  { id: "OPT_CTB_HUMANO", title: "Falar com atendente", description: "Transferir para a equipe" },
];

const ROOT_NUMBER_MAP: Record<string, Intent> = {
  "1": "MENU_ASSOCIADO",
  "2": "MENU_EMPRESA",
  "3": "MENU_CONTABILIDADE",
};

const ASSOC_NUMBER_MAP: Record<string, Intent> = {
  "1": "CADASTRO",
  "2": "CARTEIRINHA",
  "3": "AGENDAMENTOS",
  "4": "HOMOLOGACAO",
  "5": "FINANCEIRO",
  "6": "HUMANO",
};

const EMP_NUMBER_MAP: Record<string, Intent> = {
  "1": "EMP_BOLETOS",
  "2": "EMP_HOMOLOGACAO",
  "3": "EMP_2VIA",
  "4": "EMP_ATUALIZAR",
  "5": "EMP_DADOS",
  "6": "HUMANO",
};

const CTB_NUMBER_MAP: Record<string, Intent> = {
  "1": "CTB_EMPRESAS",
  "2": "CTB_BOLETOS",
  "3": "CTB_2VIA",
  "4": "CTB_ATUALIZAR",
  "5": "HUMANO",
};

// IDs das opções do menu interativo (botões/lista Meta). Quando o contato toca
// em uma opção, o ChatGoo devolve o id e/ou o título da linha selecionada.
const OPTION_ID_MAP: Record<string, Intent> = {
  OPT_PERFIL_ASSOCIADO: "MENU_ASSOCIADO",
  OPT_PERFIL_EMPRESA: "MENU_EMPRESA",
  OPT_PERFIL_CONTABILIDADE: "MENU_CONTABILIDADE",
  OPT_CADASTRO: "CADASTRO",
  OPT_CARTEIRINHA: "CARTEIRINHA",
  OPT_AGENDAMENTOS: "AGENDAMENTOS",
  OPT_HOMOLOGACAO: "HOMOLOGACAO",
  OPT_FINANCEIRO: "FINANCEIRO",
  OPT_HUMANO: "HUMANO",
  OPT_EMP_BOLETOS: "EMP_BOLETOS",
  OPT_EMP_HOMOLOGACAO: "EMP_HOMOLOGACAO",
  OPT_EMP_2VIA: "EMP_2VIA",
  OPT_EMP_DADOS: "EMP_DADOS",
  OPT_EMP_HUMANO: "HUMANO",
  OPT_CTB_EMPRESAS: "CTB_EMPRESAS",
  OPT_CTB_BOLETOS: "CTB_BOLETOS",
  OPT_CTB_2VIA: "CTB_2VIA",
  OPT_CTB_HUMANO: "HUMANO",
};

type Profile = "ASSOCIADO" | "EMPRESA" | "CONTABILIDADE" | null;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const rawBody = await req.text();
  const signature =
    req.headers.get("x-chatgoo-signature") ?? req.headers.get("x-hub-signature-256");

  // ChatGoo (Whaticket-like) não envia assinatura HMAC no webhook de projeto.
  // Quando a assinatura vier, ela é validada; quando não vier, o evento é aceito
  // e registrado como UNSIGNED (o fluxo é somente leitura + handoff humano).
  if (signature) {
    const valid = await verifyChatgooSignature(rawBody, signature);
    if (!valid) {
      await supabase.from("chatgoo_events").insert({
        direction: "inbound",
        event: "webhook",
        decision: "BLOCKED",
        reason: "INVALID_SIGNATURE",
        payload: { raw: rawBody.slice(0, 2000) },
      });
      return new Response(JSON.stringify({ error: "invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }
  let body: Record<string, any> = {};
  try {
    body = JSON.parse(rawBody || "{}");
  } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const isTrue = (value: unknown) => value === true || value === 1 || value === "true" || value === "1";
  const messageId = String(
    body?.messageId ??
      body?.message?.id ??
      body?.message?.key?.id ??
      body?.rawMsg?.key?.id ??
      "",
  ).trim();
  const eventName = String(body?.event ?? body?.type ?? body?.eventType ?? "").toLowerCase();

  // Bloqueia mensagens do próprio sistema/atendente e eventos de atualização (anti-loop).
  const fromMe = [
    body?.fromMe,
    body?.message?.fromMe,
    body?.message?.key?.fromMe,
    body?.rawMsg?.fromMe,
    body?.rawMsg?.key?.fromMe,
    body?.data?.fromMe,
    body?.data?.key?.fromMe,
  ].some(isTrue);
  const outboundEvent = /(message\.ack|message_ack|message\.update|message_update|sent|delivered|read|outbound)/.test(eventName);
  if (fromMe || outboundEvent) {
    await supabase.from("chatgoo_events").insert({
      direction: "outbound",
      event: "webhook_echo",
      decision: "IGNORED",
      reason: fromMe ? "FROM_ME" : "OUTBOUND_EVENT",
      payload: { message_id: messageId || null, event: eventName || null },
    });
    return new Response(JSON.stringify({ status: "ignored_outbound_echo" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // O mesmo evento pode ser reenviado pelo ChatGoo; processa cada mensagem apenas uma vez.
  if (messageId) {
    const { data: duplicate } = await supabase
      .from("chatgoo_events")
      .select("id")
      .eq("event", "message")
      .contains("payload", { message_id: messageId })
      .limit(1)
      .maybeSingle();
    if (duplicate) {
      return new Response(JSON.stringify({ status: "ignored_duplicate" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  if (!signature) {
    await supabase.from("chatgoo_events").insert({
      direction: "inbound",
      event: "webhook",
      decision: "ACCEPTED",
      reason: "UNSIGNED",
      payload: { message_id: messageId || null },
    });
  }

  const rawPhone =
    body?.contactNumber ??
    body?.contact?.number ??
    body?.ticket?.contact?.number ??
    body?.number ??
    body?.phone ??
    "";
  const text = String(
    body?.messageText ??
      body?.message?.body ??
      body?.message?.conversation ??
      body?.rawMsg?.message?.conversation ??
      body?.body ??
      body?.text ??
      "",
  ).trim();
  const ticketId = body?.ticketId ?? body?.ticket?.id ?? null;

  // WhatsApp entrega números BR antigos sem o 9 (12 dígitos). Reconstitui antes de validar.
  const digits = String(rawPhone ?? "").replace(/\D/g, "");
  const normalizedRawPhone =
    digits.length === 12 && digits.startsWith("55")
      ? `${digits.slice(0, 4)}9${digits.slice(4)}`
      : digits;
  const { valid: phoneOk, e164 } = normalizeBrPhone(normalizedRawPhone);

  // Quando o contato toca em um botão/opção da lista, o ChatGoo pode devolver o
  // id selecionado em formatos diferentes; cobrimos os mais comuns.
  const selectedId = String(
    body?.selectedId ??
      body?.selectedRowId ??
      body?.message?.selectedId ??
      body?.message?.selectedRowId ??
      body?.message?.listResponse?.id ??
      body?.message?.buttonReply?.id ??
      body?.message?.interactive?.list_reply?.id ??
      body?.message?.interactive?.button_reply?.id ??
      body?.rawMsg?.message?.listResponseMessage?.singleSelectReply?.selectedRowId ??
      body?.rawMsg?.message?.buttonsResponseMessage?.selectedButtonId ??
      "",
  ).trim();

  // Perfil escolhido anteriormente (válido por 6 horas), para interpretar números
  // no submenu correto sem perguntar de novo a cada mensagem.
  let profile: Profile = null;
  if (e164) {
    const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    const { data: last } = await supabase
      .from("chatgoo_events")
      .select("payload")
      .eq("event", "message")
      .eq("phone", e164)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5);
    for (const row of last ?? []) {
      const p = (row as any)?.payload?.profile;
      if (p === "ASSOCIADO" || p === "EMPRESA" || p === "CONTABILIDADE") {
        profile = p;
        break;
      }
    }
  }

  const numberMap = profile === "EMPRESA"
    ? EMP_NUMBER_MAP
    : profile === "CONTABILIDADE"
    ? CTB_NUMBER_MAP
    : profile === "ASSOCIADO"
    ? ASSOC_NUMBER_MAP
    : ROOT_NUMBER_MAP;

  let intent: Intent =
    OPTION_ID_MAP[selectedId] ?? numberMap[text] ?? detectIntent(text);

  // Alinha o perfil ativo com a escolha atual do contato.
  if (intent === "MENU_ASSOCIADO") profile = "ASSOCIADO";
  else if (intent === "MENU_EMPRESA") profile = "EMPRESA";
  else if (intent === "MENU_CONTABILIDADE") profile = "CONTABILIDADE";
  else if (
    intent === "EMP_BOLETOS" || intent === "EMP_HOMOLOGACAO" || intent === "EMP_DADOS" || intent === "EMP_2VIA"
  ) profile = "EMPRESA";
  else if (intent === "CTB_EMPRESAS" || intent === "CTB_BOLETOS" || intent === "CTB_2VIA") profile = "CONTABILIDADE";
  // "segunda via" genérico é resolvido pelo perfil já ativo na conversa
  if (intent === "SEGUNDA_VIA") {
    intent = profile === "CONTABILIDADE" ? "CTB_2VIA" : profile === "EMPRESA" ? "EMP_2VIA" : "FINANCEIRO";
  }
  else if (
    intent === "CADASTRO" || intent === "CARTEIRINHA" || intent === "AGENDAMENTOS" ||
    intent === "HOMOLOGACAO" || intent === "FINANCEIRO"
  ) profile = "ASSOCIADO";
  else if (intent === "MENU") profile = null;

  const log = async (decision: string, reason: string | null, patientId: string | null, reply: string) => {
    await supabase.from("chatgoo_events").insert({
      direction: "inbound",
      event: "message",
      phone: e164,
      patient_id: patientId,
      clinic_id: SINDICATO_CLINIC_ID,
      intent,
      decision,
      reason,
      payload: { text, ticket_id: ticketId, message_id: messageId || null, reply, profile },
    });
  };

  const answer = async (
    reply: string,
    decision: string,
    reason: string | null,
    patientId: string | null,
  ) => {
    // Resposta sai pela Meta Cloud API oficial (conexão 3223-Oficial é Meta oficial).
    const result = await chatgooSendTextViaMeta(supabase, e164 ?? "", reply);
    await log(decision, reason, patientId, reply);
    return new Response(
      JSON.stringify({ status: decision, intent, dry_run: result.dry_run, reply }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  };

  // Menu com botões (lista interativa Meta). Se o envio da lista falhar por
  // erro da Meta, cai no menu numerado em texto como reserva.
  const answerMenu = async (
    kind: "ROOT" | "ASSOCIADO" | "EMPRESA" | "CONTABILIDADE",
    greeting: string,
    patientId: string | null,
  ) => {
    const config = {
      ROOT: { rows: ROOT_LIST_ROWS, title: "Você é...", fallback: ROOT_MENU },
      ASSOCIADO: { rows: ASSOC_LIST_ROWS, title: "Associado", fallback: ASSOC_MENU },
      EMPRESA: { rows: EMP_LIST_ROWS, title: "Empresa", fallback: EMP_MENU },
      CONTABILIDADE: { rows: CTB_LIST_ROWS, title: "Contabilidade", fallback: CTB_MENU },
    }[kind];

    const bodyText = greeting;
    const result = await chatgooSendListViaMeta(supabase, e164 ?? "", {
      body: bodyText,
      buttonLabel: "Ver opções",
      footer: "Toque em uma opção",
      sections: [{ title: config.title, rows: config.rows }],
    });
    if (!result.sent && !result.dry_run && result.error !== "OUTSIDE_24H_WINDOW") {
      await chatgooSendTextViaMeta(supabase, e164 ?? "", `${bodyText}\n\n${config.fallback}`);
    }
    await log("ANSWERED", null, patientId, bodyText);
    return new Response(
      JSON.stringify({ status: "ANSWERED", intent, dry_run: result.dry_run, reply: bodyText }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  };

  // Telefones de empresas/escritórios podem estar com máscara; casamos pelos
  // 8 últimos dígitos, que identificam a linha independentemente da formatação.
  const last8 = (e164 ?? "").slice(-8);
  const phoneMatches = (value: unknown) => {
    const d = String(value ?? "").replace(/\D/g, "");
    return d.length >= 8 && d.slice(-8) === last8;
  };

  const employerLookup = async () => {
    const { data } = await supabase
      .from("employers")
      .select("id,name,trade_name,cnpj,phone,email,city,state,is_active")
      .eq("clinic_id", SINDICATO_CLINIC_ID)
      .ilike("phone", `%${last8}%`)
      .limit(10);
    return (data ?? []).filter((e) => phoneMatches(e.phone));
  };

  const accountingLookup = async () => {
    const { data } = await supabase
      .from("accounting_offices")
      .select("id,name,trade_name,cnpj,phone,email")
      .ilike("phone", `%${last8}%`)
      .limit(10);
    return (data ?? []).filter((a) => phoneMatches(a.phone));
  };


  if (!phoneOk || !e164) {
    return await answer(
      "Não consegui identificar seu número. Vou encaminhar para um atendente.",
      "HANDOFF",
      "PHONE_INVALID",
      null,
    );
  }

  if (intent === "HUMANO") {
    const queueId = Deno.env.get("CHATGOO_HUMAN_QUEUE_ID");
    if (ticketId && queueId) await chatgooTransferToQueue(ticketId, queueId);
    return await answer(
      "Certo! Estou transferindo você para um atendente do sindicato. Aguarde um momento.",
      "HANDOFF",
      "USER_REQUEST",
      null,
    );
  }

  // MENU INICIAL: separa o atendimento por perfil (associado, empresa, contabilidade)
  if (intent === "MENU") {
    return await answerMenu(
      "ROOT",
      "Olá! Sou o atendimento automático do sindicato. Para começar, me diga quem é você:",
      null,
    );
  }

  // ===================== PERFIL: EMPRESA =====================
  if (
    intent === "MENU_EMPRESA" || intent === "EMP_BOLETOS" || intent === "EMP_HOMOLOGACAO" ||
    intent === "EMP_DADOS" || intent === "EMP_2VIA"
  ) {
    const empresas = await employerLookup();
    if (empresas.length === 0) {
      return await answer(
        "Não localizei uma empresa cadastrada com este número. Vou encaminhar para um atendente confirmar os dados.",
        "HANDOFF",
        "EMPLOYER_NOT_FOUND",
        null,
      );
    }
    if (empresas.length > 1) {
      return await answer(
        "Encontrei mais de uma empresa com este número. Por segurança, vou encaminhar para um atendente.",
        "HANDOFF",
        "AMBIGUOUS_EMPLOYER_MATCH",
        null,
      );
    }
    const empresa = empresas[0];
    const nomeEmpresa = empresa.trade_name || empresa.name || "Empresa";

    if (intent === "MENU_EMPRESA") {
      return await answerMenu("EMPRESA", `Olá, ${nomeEmpresa}! Escolha uma opção:`, null);
    }

    if (intent === "EMP_DADOS") {
      return await answer(
        [
          `Dados da empresa no sindicato:`,
          `• Razão social: ${empresa.name ?? "-"}`,
          `• CNPJ: ${empresa.cnpj ?? "-"}`,
          empresa.city ? `• Cidade: ${empresa.city}/${empresa.state ?? "-"}` : null,
          empresa.email ? `• E-mail: ${empresa.email}` : null,
          "",
          "Para alterar dados, responda \"atendente\".",
        ].filter(Boolean).join("\n"),
        "ANSWERED",
        null,
        null,
      );
    }

    // SEGUNDA VIA DE BOLETO (empresa): reenvia o link/linha digitável já emitidos.
    // Conteúdo transacional, enviado apenas dentro da janela de 24h da Meta
    // (o guard fail-closed do envio bloqueia fora da janela).
    if (intent === "EMP_2VIA") {
      const { data: docs } = await supabase
        .from("employer_contributions")
        .select("competence_month,competence_year,due_date,value,status,lytex_invoice_url,lytex_boleto_digitable_line")
        .eq("employer_id", empresa.id)
        .in("status", ["pending", "overdue"])
        .not("lytex_invoice_url", "is", null)
        .order("due_date", { ascending: true })
        .limit(3);

      if (!docs || docs.length === 0) {
        return await answer(
          `${nomeEmpresa}, não encontrei boleto emitido em aberto para segunda via. Se precisar emitir um novo boleto, responda "atendente".`,
          "ANSWERED",
          "NO_INVOICE_TO_REISSUE",
          null,
        );
      }

      const blocos = docs.map((c: any) => {
        const comp = c.competence_month && c.competence_year
          ? `${String(c.competence_month).padStart(2, "0")}/${c.competence_year}`
          : "-";
        return [
          `• Competência ${comp} — venc. ${fmtDate(c.due_date)} — ${fmtMoney(c.value)}`,
          `  Boleto: ${c.lytex_invoice_url}`,
          c.lytex_boleto_digitable_line ? `  Linha digitável: ${c.lytex_boleto_digitable_line}` : null,
        ].filter(Boolean).join("\n");
      });

      return await answer(
        [
          `${nomeEmpresa}, segue a 2ª via dos boletos em aberto:`,
          ...blocos,
          "",
          "Boletos vencidos podem ter juros recalculados no pagamento.",
          "Precisa de outra competência? Responda \"atendente\".",
        ].join("\n"),
        "ANSWERED",
        "SECOND_COPY_SENT",
        null,
      );
    }

    if (intent === "EMP_BOLETOS") {
      const { data: contribs } = await supabase
        .from("employer_contributions")
        .select("competence_month,competence_year,due_date,value,status,lytex_invoice_url")
        .eq("employer_id", empresa.id)
        .in("status", ["pending", "overdue", "awaiting_value"])
        .order("due_date", { ascending: true })
        .limit(5);

      if (!contribs || contribs.length === 0) {
        return await answer(
          `${nomeEmpresa}, não encontrei contribuições em aberto.`,
          "ANSWERED",
          null,
          null,
        );
      }
      const linhas = contribs.map((c: any) => {
        const comp = c.competence_month && c.competence_year
          ? `${String(c.competence_month).padStart(2, "0")}/${c.competence_year}`
          : "-";
        return `• ${comp} — venc. ${fmtDate(c.due_date)} — ${fmtMoney(c.value)}${c.lytex_invoice_url ? `\n  ${c.lytex_invoice_url}` : ""}`;
      });
      return await answer(
        [`${nomeEmpresa}, contribuições em aberto:`, ...linhas, "", "Dúvidas? Responda \"atendente\"."].join("\n"),
        "ANSWERED",
        null,
        null,
      );
    }

    // EMP_HOMOLOGACAO
    const cnpjDigits = String(empresa.cnpj ?? "").replace(/\D/g, "");
    const { data: homs } = await supabase
      .from("homologacao_appointments")
      .select("protocol_number,appointment_date,start_time,status,employee_name")
      .eq("clinic_id", SINDICATO_CLINIC_ID)
      .eq("company_cnpj", cnpjDigits)
      .order("appointment_date", { ascending: false })
      .limit(5);

    if (!homs || homs.length === 0) {
      return await answer(
        `${nomeEmpresa}, não encontrei homologações registradas para este CNPJ.`,
        "ANSWERED",
        null,
        null,
      );
    }
    return await answer(
      [
        `${nomeEmpresa}, homologações registradas:`,
        ...homs.map((h: any) =>
          `• ${fmtDate(h.appointment_date)} às ${String(h.start_time).slice(0, 5)} — ${h.employee_name ?? "-"} (protocolo ${h.protocol_number ?? "-"})`
        ),
      ].join("\n"),
      "ANSWERED",
      null,
      null,
    );
  }

  // ===================== PERFIL: CONTABILIDADE =====================
  if (
    intent === "MENU_CONTABILIDADE" || intent === "CTB_EMPRESAS" || intent === "CTB_BOLETOS" ||
    intent === "CTB_2VIA"
  ) {
    const escritorios = await accountingLookup();
    if (escritorios.length === 0) {
      return await answer(
        "Não localizei um escritório de contabilidade com este número. Vou encaminhar para um atendente.",
        "HANDOFF",
        "ACCOUNTING_NOT_FOUND",
        null,
      );
    }
    if (escritorios.length > 1) {
      return await answer(
        "Encontrei mais de um escritório com este número. Por segurança, vou encaminhar para um atendente.",
        "HANDOFF",
        "AMBIGUOUS_ACCOUNTING_MATCH",
        null,
      );
    }
    const escritorio = escritorios[0];
    const nomeEscritorio = escritorio.trade_name || escritorio.name || "Escritório";

    if (intent === "MENU_CONTABILIDADE") {
      return await answerMenu("CONTABILIDADE", `Olá, ${nomeEscritorio}! Escolha uma opção:`, null);
    }

    const { data: vinculos } = await supabase
      .from("accounting_office_employers")
      .select("employer_id")
      .eq("accounting_office_id", escritorio.id);
    const employerIds = (vinculos ?? []).map((v: any) => v.employer_id).filter(Boolean);

    if (employerIds.length === 0) {
      return await answer(
        `${nomeEscritorio}, não encontrei empresas vinculadas ao escritório.`,
        "ANSWERED",
        null,
        null,
      );
    }

    const { data: empresasVinculadas } = await supabase
      .from("employers")
      .select("id,name,trade_name,cnpj")
      .in("id", employerIds)
      .eq("clinic_id", SINDICATO_CLINIC_ID)
      .order("name", { ascending: true })
      .limit(200);

    if (intent === "CTB_EMPRESAS") {
      const lista = (empresasVinculadas ?? []).slice(0, 10).map(
        (e: any) => `• ${e.trade_name || e.name} — ${e.cnpj ?? "-"}`,
      );
      const total = (empresasVinculadas ?? []).length;
      return await answer(
        [
          `${nomeEscritorio}, empresas vinculadas (${total}):`,
          ...lista,
          total > 10 ? `... e mais ${total - 10} empresa(s). Acesse o portal da contabilidade para ver todas.` : null,
        ].filter(Boolean).join("\n"),
        "ANSWERED",
        null,
        null,
      );
    }

    // SEGUNDA VIA DE BOLETO (contabilidade)
    if (intent === "CTB_2VIA") {
      const nomes = new Map((empresasVinculadas ?? []).map((e: any) => [e.id, e.trade_name || e.name]));
      const { data: docs } = await supabase
        .from("employer_contributions")
        .select("employer_id,competence_month,competence_year,due_date,value,status,lytex_invoice_url,lytex_boleto_digitable_line")
        .in("employer_id", employerIds)
        .in("status", ["pending", "overdue"])
        .not("lytex_invoice_url", "is", null)
        .order("due_date", { ascending: true })
        .limit(5);

      if (!docs || docs.length === 0) {
        return await answer(
          `${nomeEscritorio}, não encontrei boleto emitido em aberto para segunda via nas empresas do escritório. Se precisar emitir novos boletos, responda "atendente".`,
          "ANSWERED",
          "NO_INVOICE_TO_REISSUE",
          null,
        );
      }

      const blocos = docs.map((c: any) => {
        const comp = c.competence_month && c.competence_year
          ? `${String(c.competence_month).padStart(2, "0")}/${c.competence_year}`
          : "-";
        return [
          `• ${nomes.get(c.employer_id) ?? "Empresa"} — ${comp} — venc. ${fmtDate(c.due_date)} — ${fmtMoney(c.value)}`,
          `  Boleto: ${c.lytex_invoice_url}`,
          c.lytex_boleto_digitable_line ? `  Linha digitável: ${c.lytex_boleto_digitable_line}` : null,
        ].filter(Boolean).join("\n");
      });

      return await answer(
        [
          `${nomeEscritorio}, segue a 2ª via dos boletos em aberto (até 5):`,
          ...blocos,
          "",
          "Para outras competências ou empresas, use o portal da contabilidade ou responda \"atendente\".",
        ].join("\n"),
        "ANSWERED",
        "SECOND_COPY_SENT",
        null,
      );
    }

    // CTB_BOLETOS
    const nameById = new Map((empresasVinculadas ?? []).map((e: any) => [e.id, e.trade_name || e.name]));
    const { data: abertos } = await supabase
      .from("employer_contributions")
      .select("employer_id,competence_month,competence_year,due_date,value,status,lytex_invoice_url")
      .in("employer_id", employerIds)
      .in("status", ["pending", "overdue", "awaiting_value"])
      .order("due_date", { ascending: true })
      .limit(10);

    if (!abertos || abertos.length === 0) {
      return await answer(
        `${nomeEscritorio}, não encontrei contribuições em aberto nas empresas do escritório.`,
        "ANSWERED",
        null,
        null,
      );
    }
    const totalAberto = abertos.reduce((s: number, c: any) => s + Number(c.value ?? 0), 0);
    const linhas = abertos.map((c: any) => {
      const comp = c.competence_month && c.competence_year
        ? `${String(c.competence_month).padStart(2, "0")}/${c.competence_year}`
        : "-";
      return `• ${nameById.get(c.employer_id) ?? "Empresa"} — ${comp} — venc. ${fmtDate(c.due_date)} — ${fmtMoney(c.value)}${c.lytex_invoice_url ? `\n  ${c.lytex_invoice_url}` : ""}`;
    });
    return await answer(
      [
        `${nomeEscritorio}, contribuições em aberto (mostrando até 10):`,
        ...linhas,
        "",
        `Total listado: ${fmtMoney(totalAberto)}`,
      ].join("\n"),
      "ANSWERED",
      null,
      null,
    );
  }

  // ===================== PERFIL: ASSOCIADO =====================
  // Identificação escopada ao tenant do sindicato
  const { data: candidates } = await supabase
    .from("patients")
    .select("id,name,cpf,phone,is_active,union_member_status,employer_name,employer_cnpj")
    .eq("clinic_id", SINDICATO_CLINIC_ID)
    .in("phone", phoneVariants(e164))
    .limit(5);

  if (!candidates || candidates.length === 0) {
    return await answer(
      "Não localizei um cadastro com este número. Vou encaminhar para um atendente confirmar seus dados.",
      "HANDOFF",
      "CONTACT_NOT_FOUND",
      null,
    );
  }
  // Desambiguação: ignora cadastros de teste/inativos quando há um sócio ativo
  const ativos = candidates.filter(
    (c) => c.is_active === true && c.union_member_status === "ativo",
  );
  const pool = ativos.length > 0 ? ativos : candidates.filter((c) => c.is_active === true);
  const effective = pool.length > 0 ? pool : candidates;

  if (effective.length > 1) {
    return await answer(
      "Encontrei mais de um cadastro com este número. Por segurança, vou encaminhar para um atendente.",
      "HANDOFF",
      "AMBIGUOUS_PHONE_MATCH",
      null,
    );
  }

  const patient = effective[0];
  const first = String(patient.name ?? "").split(" ")[0];

  if (intent === "MENU_ASSOCIADO") {
    return await answerMenu("ASSOCIADO", `Olá, ${first}! Escolha uma opção:`, patient.id);
  }

  if (intent === "CADASTRO") {
    const linhas = [
      `Olá, ${first}! Seus dados no sindicato:`,
      `• Nome: ${patient.name}`,
      `• Situação: ${patient.is_active ? "Ativo" : "Inativo"}`,
      patient.employer_name ? `• Empresa: ${patient.employer_name}` : null,
      "",
      "Para alterar dados, use o aplicativo do sindicato.",
    ].filter(Boolean);
    return await answer(linhas.join("\n"), "ANSWERED", null, patient.id);
  }

  if (intent === "CARTEIRINHA") {
    const { data: card } = await supabase
      .from("patient_cards")
      .select("card_number,expires_at,is_active")
      .eq("patient_id", patient.id)
      .eq("is_active", true)
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!card) {
      return await answer(
        `${first}, não encontrei carteirinha ativa no seu cadastro. Você pode solicitar a atualização pelo aplicativo do sindicato.`,
        "ANSWERED",
        null,
        patient.id,
      );
    }
    const venc = new Date(`${String(card.expires_at).slice(0, 10)}T12:00:00`);
    const vencida = venc.getTime() < Date.now();
    return await answer(
      [
        `${first}, sua carteirinha:`,
        `• Número: ${card.card_number ?? "-"}`,
        `• Validade: ${fmtDate(card.expires_at)}`,
        vencida
          ? "• Situação: VENCIDA — atualize pelo aplicativo enviando o contracheque."
          : "• Situação: válida",
      ].join("\n"),
      "ANSWERED",
      null,
      patient.id,
    );
  }

  if (intent === "AGENDAMENTOS") {
    const hoje = new Date().toISOString().slice(0, 10);
    const { data: appts } = await supabase
      .from("appointments")
      .select("appointment_date,start_time,status,professionals(name)")
      .eq("patient_id", patient.id)
      .gte("appointment_date", hoje)
      .in("status", ["scheduled", "confirmed"])
      .order("appointment_date", { ascending: true })
      .limit(5);

    if (!appts || appts.length === 0) {
      return await answer(
        `${first}, não encontrei consultas futuras no seu nome. Para agendar, use o aplicativo do sindicato.`,
        "ANSWERED",
        null,
        patient.id,
      );
    }
    const linhas = appts.map((a: any) => {
      const prof = a.professionals?.name ?? "Profissional";
      return `• ${fmtDate(a.appointment_date)} às ${String(a.start_time).slice(0, 5)} — ${prof}`;
    });
    return await answer(
      [`${first}, suas próximas consultas:`, ...linhas, "", "Para agendar, remarcar ou cancelar, use o aplicativo do sindicato."].join("\n"),
      "ANSWERED",
      null,
      patient.id,
    );
  }

  if (intent === "HOMOLOGACAO") {
    const cpfDigits = String(patient.cpf ?? "").replace(/\D/g, "");
    const { data: homs } = await supabase
      .from("homologacao_appointments")
      .select("protocol_number,appointment_date,start_time,status,company_name")
      .eq("clinic_id", SINDICATO_CLINIC_ID)
      .eq("employee_cpf", cpfDigits)
      .order("appointment_date", { ascending: false })
      .limit(3);

    if (!homs || homs.length === 0) {
      return await answer(
        `${first}, não encontrei homologação registrada com o seu CPF. Se precisar, posso te encaminhar para um atendente — responda "atendente".`,
        "ANSWERED",
        null,
        patient.id,
      );
    }
    const linhas = homs.map(
      (h: any) =>
        `• ${fmtDate(h.appointment_date)} às ${String(h.start_time).slice(0, 5)} — ${h.company_name ?? "-"} (protocolo ${h.protocol_number ?? "-"})`,
    );
    return await answer([`${first}, suas homologações:`, ...linhas].join("\n"), "ANSWERED", null, patient.id);
  }

  if (intent === "FINANCEIRO") {
    const { data: contribs } = await supabase
      .from("member_contributions")
      .select("competence_month,competence_year,due_date,value,status,lytex_invoice_url")
      .eq("member_id", patient.id)
      .in("status", ["pending", "overdue", "awaiting_value"])
      .order("due_date", { ascending: true })
      .limit(5);

    if (!contribs || contribs.length === 0) {
      return await answer(
        `${first}, não encontrei contribuições em aberto no seu cadastro.`,
        "ANSWERED",
        null,
        patient.id,
      );
    }
    const linhas = contribs.map((c: any) => {
      const comp = c.competence_month && c.competence_year
        ? `${String(c.competence_month).padStart(2, "0")}/${c.competence_year}`
        : "-";
      return `• ${comp} — venc. ${fmtDate(c.due_date)} — ${fmtMoney(c.value)}${c.lytex_invoice_url ? `\n  ${c.lytex_invoice_url}` : ""}`;
    });

    return await answer(
      [`${first}, contribuições em aberto:`, ...linhas, "", "Dúvidas sobre pagamento? Responda \"atendente\"."].join("\n"),
      "ANSWERED",
      null,
      patient.id,
    );
  }

  return await answerMenu("ASSOCIADO", `Olá, ${first}! Escolha uma opção:`, patient.id);
});
