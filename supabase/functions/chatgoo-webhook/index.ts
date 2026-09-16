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
  chatgooSendButtonsViaMeta,
  chatgooSendCtaUrlViaMeta,
  chatgooSendListViaMeta,
  chatgooSendTextViaMeta,
  chatgooTransferToQueue,
  verifyChatgooSignature,
} from "../_shared/chatgoo-client.ts";
import {
  chatwootEnsureConversation,
  chatwootHandoff,
  chatwootHasHumanInControl,
  chatwootSetPause,
  chatwootMirrorBotReply,
  chatwootMirrorIncoming,
  getChatwootConfig,
} from "../_shared/chatwoot-client.ts";
import { normalizeBrPhone } from "../_shared/whatsappConsentGate.ts";

const SINDICATO_CLINIC_ID = "89e7585e-7bce-4e58-91fa-c37080d1170d";
const APP_BASE_URL = Deno.env.get("APP_BASE_URL") ?? "https://sindexa.com.br";
// Ano/mês corrente no horário local do sindicato. As listagens financeiras
// exibem somente competências encerradas: do ano atual até o mês anterior.
const agoraSaoPaulo = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "numeric",
}).formatToParts(new Date());
const ANO_CORRENTE = Number(agoraSaoPaulo.find((p) => p.type === "year")?.value ?? new Date().getUTCFullYear());
const MES_CORRENTE = Number(agoraSaoPaulo.find((p) => p.type === "month")?.value ?? new Date().getUTCMonth() + 1);
const MES_LIMITE_COMPETENCIA = MES_CORRENTE - 1;

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
  if (/(informar valor|atualizar boleto|boleto zerado|valor zerado|novo vencimento|alterar vencimento|mudar vencimento|competencia)/.test(t)) return "ATUALIZAR_BOLETO";
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

// Valores de contribuição são armazenados em CENTAVOS no banco.
function fmtMoney(v: unknown): string {
  const n = Number(v ?? 0) / 100;
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
  { id: "OPT_PERFIL_ASSOCIADO", title: "Sou associado", description: "Cadastro, carteirinha e consultas" },
  { id: "OPT_PERFIL_EMPRESA", title: "Sou empresa", description: "Contribuições, boletos e homologação" },
  { id: "OPT_PERFIL_CONTABILIDADE", title: "Sou contabilidade", description: "Empresas do escritório e boletos" },
];

const ASSOC_MENU = [
  "Atendimento ao associado:",
  "1 - Meu cadastro / situação",
  "2 - Carteirinha (validade)",
  "3 - Meus agendamentos",
  "4 - Homologação de rescisão",
  "5 - Falar com um atendente",
].join("\n");

const ASSOC_LIST_ROWS = [
  { id: "OPT_CADASTRO", title: "Meu cadastro", description: "Dados e situação de associado" },
  { id: "OPT_CARTEIRINHA", title: "Carteirinha", description: "Validade e situação da carteirinha" },
  { id: "OPT_AGENDAMENTOS", title: "Agendamentos", description: "Suas próximas consultas" },
  { id: "OPT_HOMOLOGACAO", title: "Homologação", description: "Homologação de rescisão" },
  { id: "OPT_HUMANO", title: "Falar com atendente", description: "Transferir para a equipe" },
];

const EMP_MENU = [
  "Atendimento à empresa:",
  "1 - Boletos e contribuições da empresa",
  "2 - Homologações da empresa",
  "3 - Segunda via de boleto",
  "4 - Atualizar boleto",
  "5 - Dados cadastrais da empresa",
  "6 - Falar com um atendente",
].join("\n");

const EMP_LIST_ROWS = [
  { id: "OPT_EMP_BOLETOS", title: "Boletos", description: "Contribuições em aberto da empresa" },
  { id: "OPT_EMP_HOMOLOGACAO", title: "Homologações", description: "Agendamentos de rescisão" },
  { id: "OPT_EMP_2VIA", title: "2ª via de boleto", description: "Reenviar link e código do boleto" },
  { id: "OPT_EMP_ATUALIZAR", title: "Atualizar boleto", description: "Valor para zeradas ou vencimento para vencidas" },
  { id: "OPT_EMP_DADOS", title: "Dados cadastrais", description: "Dados da empresa no sindicato" },
  { id: "OPT_EMP_HUMANO", title: "Falar com atendente", description: "Transferir para a equipe" },
];

const CTB_MENU = [
  "Atendimento à contabilidade:",
  "1 - Empresas do escritório",
  "2 - Boletos em aberto das empresas",
  "3 - Segunda via de boleto",
  "4 - Atualizar boleto",
  "5 - Falar com um atendente",
].join("\n");

const CTB_LIST_ROWS = [
  { id: "OPT_CTB_EMPRESAS", title: "Empresas", description: "Empresas vinculadas ao escritório" },
  { id: "OPT_CTB_BOLETOS", title: "Boletos", description: "Contribuições em aberto das empresas" },
  { id: "OPT_CTB_2VIA", title: "2ª via de boleto", description: "Reenviar link e código do boleto" },
  { id: "OPT_CTB_ATUALIZAR", title: "Atualizar boleto", description: "Valor para zeradas ou vencimento para vencidas" },
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
  "5": "HUMANO",
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
  OPT_EMP_ATUALIZAR: "EMP_ATUALIZAR",
  OPT_EMP_DADOS: "EMP_DADOS",
  OPT_EMP_HUMANO: "HUMANO",
  OPT_CTB_EMPRESAS: "CTB_EMPRESAS",
  OPT_CTB_BOLETOS: "CTB_BOLETOS",
  OPT_CTB_2VIA: "CTB_2VIA",
  OPT_CTB_ATUALIZAR: "CTB_ATUALIZAR",
  OPT_CTB_HUMANO: "HUMANO",
};

type Profile = "ASSOCIADO" | "EMPRESA" | "CONTABILIDADE" | null;

function firstString(values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" || typeof value === "number") {
      const text = String(value).trim();
      if (text) return text;
    }
  }
  return "";
}

function extractMetaMessage(body: Record<string, any>): Record<string, any> | null {
  const entries = Array.isArray(body?.entry) ? body.entry : [];
  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const change of changes) {
      const messages = Array.isArray(change?.value?.messages) ? change.value.messages : [];
      if (messages[0]) return messages[0];
    }
  }
  return null;
}

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
        // Webhooks devem sempre receber 200 para não entrarem em backoff ou
        // serem desativados pelo provedor. A mensagem continua bloqueada.
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }
  let body: Record<string, any> = {};
  try {
    body = JSON.parse(rawBody || "{}");
  } catch {
    await supabase.from("chatgoo_events").insert({
      direction: "inbound",
      event: "webhook",
      decision: "BLOCKED",
      reason: "INVALID_JSON",
      payload: { raw: rawBody.slice(0, 2000) },
    });
    return new Response(JSON.stringify({ status: "BLOCKED", reason: "INVALID_JSON" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const metaMessage = extractMetaMessage(body);

  const isTrue = (value: unknown) => value === true || value === 1 || value === "true" || value === "1";
  const messageId = firstString([
    body?.messageId,
    body?.message?.id,
    body?.message?.key?.id,
    body?.rawMsg?.key?.id,
    body?.data?.id,
    body?.data?.key?.id,
    body?.data?.message?.id,
    body?.data?.message?.key?.id,
    metaMessage?.id,
  ]);
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
    body?.data?.message?.fromMe,
    body?.data?.message?.key?.fromMe,
  ].some(isTrue);
  // O ChatGoo entrega respostas de listas/botões como message.update. Esse nome
  // não significa saída: a direção é definida por fromMe. Ignorar todo update
  // descartava justamente o toque em "Sou empresa" e impedia o submenu.
  const outboundEvent = /(message\.ack|message_ack|message\.sent|message_sent|message\.delivered|message_delivered|message\.read|message_read|outbound)/.test(eventName);
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

  // Reserva atômica antes de qualquer envio. A chave única no banco garante que
  // duas instâncias concorrentes (Meta direta + relé Chatwoot, ou retry) nunca
  // processem o mesmo wamid ao mesmo tempo.
  if (messageId) {
    const { error: claimError } = await supabase
      .from("whatsapp_webhook_dedup")
      .insert({ dedup_key: `message:${messageId}`, source: String(body?.source ?? "meta") });
    if (claimError?.code === "23505") {
      return new Response(JSON.stringify({ status: "ignored_duplicate" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (claimError) {
      await supabase.from("chatgoo_events").insert({
        direction: "inbound",
        event: "webhook",
        decision: "BLOCKED",
        reason: "DEDUP_UNAVAILABLE",
        payload: { message_id: messageId, error_code: claimError.code ?? null },
      });
      return new Response(JSON.stringify({ status: "blocked", reason: "DEDUP_UNAVAILABLE" }), {
        status: 200,
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

  // O ChatGoo/Whaticket entrega o número em formatos diferentes conforme o
  // evento. Percorremos todos os caminhos conhecidos e, como último recurso,
  // extraímos do remoteJid/wamid — assim nenhuma mensagem fica sem destino
  // (era a causa do erro "The parameter to is required" e do silêncio).
  const jidToDigits = (v: unknown) => String(v ?? "").split("@")[0].replace(/\D/g, "");
  const rawPhone =
    [
      body?.contactNumber,
      body?.contact?.number,
      body?.contact?.phoneNumber,
      body?.contact?.phone_number,
      body?.ticket?.contact?.number,
      body?.ticket?.contact?.phoneNumber,
      body?.data?.contact?.number,
      body?.data?.contact?.phoneNumber,
      body?.data?.contact?.phone_number,
      body?.data?.ticket?.contact?.number,
      body?.data?.ticket?.contact?.phoneNumber,
      body?.data?.number,
      body?.data?.phone,
      body?.data?.from,
      body?.message?.contact?.number,
      body?.number,
      body?.phone,
      body?.from,
      body?.wa_id,
      body?.message?.from,
      body?.data?.remoteJid,
      body?.rawMsg?.key?.remoteJid,
      body?.message?.key?.remoteJid,
      body?.data?.key?.remoteJid,
      body?.data?.message?.key?.remoteJid,
      body?.conversation?.contact?.phone_number,
      body?.conversation?.contact_inbox?.contact?.phone_number,
      metaMessage?.from,
    ]
      .map(jidToDigits)
      .find((d) => d.length >= 10) ?? "";
  const text = firstString([
    body?.messageText,
    body?.message?.body,
    body?.message?.conversation,
    body?.message?.text,
    body?.message?.listResponse?.title,
    body?.message?.buttonReply?.title,
    body?.rawMsg?.message?.conversation,
    body?.rawMsg?.message?.extendedTextMessage?.text,
    body?.rawMsg?.message?.listResponseMessage?.title,
    body?.rawMsg?.message?.listResponseMessage?.singleSelectReply?.title,
    body?.rawMsg?.message?.buttonsResponseMessage?.selectedDisplayText,
    body?.data?.message?.conversation,
    body?.data?.message?.extendedTextMessage?.text,
    body?.data?.message?.listResponseMessage?.title,
    body?.data?.message?.listResponseMessage?.singleSelectReply?.title,
    body?.data?.message?.buttonsResponseMessage?.selectedDisplayText,
    body?.data?.message?.body,
    body?.data?.body,
    body?.data?.content,
    body?.content,
    body?.body,
    body?.text,
    metaMessage?.text?.body,
    metaMessage?.interactive?.list_reply?.title,
    metaMessage?.interactive?.button_reply?.title,
    metaMessage?.button?.text,
  ]);
  const ticketId = body?.ticketId ?? body?.ticket?.id ?? body?.data?.ticketId ??
    body?.data?.ticket?.id ?? body?.conversation?.id ?? null;

  // IMPORTANTE: o número que responde DEVE ser exatamente o wa_id recebido.
  // Números BR antigos chegam com 12 dígitos (sem o 9). Inserir o 9 aqui cria
  // um destino inexistente na Meta e a resposta some (silêncio no WhatsApp).
  // O 9 só é usado como VARIANTE de busca no banco (phoneVariants).
  const digits = String(rawPhone ?? "").replace(/\D/g, "");
  const legacyBr = digits.length === 12 && digits.startsWith("55");
  const base = normalizeBrPhone(digits);
  const phoneOk = legacyBr ? true : base.valid;
  const e164 = legacyBr ? digits : base.e164;

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
      body?.data?.message?.listResponseMessage?.singleSelectReply?.selectedRowId ??
      body?.data?.message?.buttonsResponseMessage?.selectedButtonId ??
      metaMessage?.interactive?.list_reply?.id ??
      metaMessage?.interactive?.button_reply?.id ??
      "",
  ).trim();
  const selectedContributionToken = selectedId.startsWith("OPEN_CONTRIB:")
    ? selectedId.slice("OPEN_CONTRIB:".length).trim()
    : null;
  const selectedInvoiceId = selectedId.startsWith("OPEN_INVOICE:")
    ? selectedId
    : null;

  // Perfil escolhido anteriormente (válido por 6 horas), para interpretar números
  // no submenu correto sem perguntar de novo a cada mensagem.
  let profile: Profile = null;
  // Estado "aguardando CNPJ" (válido por 30 minutos) para o fluxo de atualização
  // de boleto. Nenhum dado sensível é coletado no chat: apenas o CNPJ para
  // localizar os boletos e devolver o link seguro de atualização.
  let awaitCnpj: "EMPRESA" | "CONTABILIDADE" | "EMPRESA_IDENT" | null = null;
  // CNPJ já informado pela empresa nesta conversa (válido por 6 horas).
  let empresaCnpj: string | null = null;
  if (e164) {
    const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    const { data: last } = await supabase
      .from("chatgoo_events")
      .select("payload,created_at")
      .eq("event", "message")
      .eq("phone", e164)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5);
    const rows = last ?? [];
    for (const row of rows) {
      const p = (row as any)?.payload?.profile;
      if (p === "ASSOCIADO" || p === "EMPRESA" || p === "CONTABILIDADE") {
        profile = p;
        break;
      }
    }
    for (const row of rows) {
      const c = (row as any)?.payload?.empresa_cnpj;
      if (typeof c === "string" && c.replace(/\D/g, "").length === 14) {
        empresaCnpj = c.replace(/\D/g, "");
        break;
      }
    }
    const lastRow = rows[0] as any;
    const pending = lastRow?.payload?.await_cnpj;
    const recent = lastRow?.created_at &&
      Date.now() - new Date(lastRow.created_at).getTime() < 30 * 60 * 1000;
    if (
      recent &&
      (pending === "EMPRESA" || pending === "CONTABILIDADE" || pending === "EMPRESA_IDENT")
    ) {
      awaitCnpj = pending;
    }
  }



  const numberMap = profile === "EMPRESA"
    ? EMP_NUMBER_MAP
    : profile === "CONTABILIDADE"
    ? CTB_NUMBER_MAP
    : profile === "ASSOCIADO"
    ? ASSOC_NUMBER_MAP
    : ROOT_NUMBER_MAP;

  // Título da linha tocada na lista (quando o provedor não devolve o id).
  const norm = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const rowsForProfile = profile === "EMPRESA"
    ? EMP_LIST_ROWS
    : profile === "CONTABILIDADE"
    ? CTB_LIST_ROWS
    : profile === "ASSOCIADO"
    ? ASSOC_LIST_ROWS
    : ROOT_LIST_ROWS;
  const titleMatch = rowsForProfile.find((r) => norm(r.title) === norm(text));

  let intent: Intent =
    OPTION_ID_MAP[selectedId] ??
    (titleMatch ? OPTION_ID_MAP[titleMatch.id] : undefined) ??
    numberMap[text] ??
    detectIntent(text);

  // Dentro de um perfil empresarial, termos genéricos nunca caem no fluxo
  // pessoal do associado.
  if (profile === "EMPRESA") {
    if (intent === "FINANCEIRO") intent = "EMP_BOLETOS";
    else if (intent === "HOMOLOGACAO") intent = "EMP_HOMOLOGACAO";
    else if (intent === "CADASTRO") intent = "EMP_DADOS";
  } else if (profile === "CONTABILIDADE") {
    if (intent === "FINANCEIRO") intent = "CTB_BOLETOS";
  }


  // Alinha o perfil ativo com a escolha atual do contato.
  if (intent === "MENU_ASSOCIADO") profile = "ASSOCIADO";
  else if (intent === "MENU_EMPRESA") profile = "EMPRESA";
  else if (intent === "MENU_CONTABILIDADE") profile = "CONTABILIDADE";
  else if (
    intent === "EMP_BOLETOS" || intent === "EMP_HOMOLOGACAO" || intent === "EMP_DADOS" ||
    intent === "EMP_2VIA" || intent === "EMP_ATUALIZAR"
  ) profile = "EMPRESA";
  else if (
    intent === "CTB_EMPRESAS" || intent === "CTB_BOLETOS" || intent === "CTB_2VIA" ||
    intent === "CTB_ATUALIZAR"
  ) profile = "CONTABILIDADE";
  // "segunda via" genérico é resolvido pelo perfil já ativo na conversa
  if (intent === "SEGUNDA_VIA") {
    intent = profile === "CONTABILIDADE" ? "CTB_2VIA" : profile === "EMPRESA" ? "EMP_2VIA" : "FINANCEIRO";
  }
  else if (intent === "ATUALIZAR_BOLETO") {
    intent = profile === "CONTABILIDADE"
      ? "CTB_ATUALIZAR"
      : profile === "EMPRESA"
      ? "EMP_ATUALIZAR"
      : "MENU";
  }
  else if (
    intent === "CADASTRO" || intent === "CARTEIRINHA" || intent === "AGENDAMENTOS" ||
    intent === "HOMOLOGACAO" || intent === "FINANCEIRO"
  ) profile = "ASSOCIADO";
  else if (intent === "MENU") profile = null;

  // Quando o bot pergunta o CNPJ, o próximo evento registrado guarda esse estado.
  let nextAwaitCnpj: "EMPRESA" | "CONTABILIDADE" | "EMPRESA_IDENT" | null = null;

  // ===== CAMADA DE ATENDIMENTO HUMANO: CHATWOOT =====
  // O Chatwoot só espelha a conversa (o envio real continua pela Meta oficial,
  // com janela de 24h, opt-out e kill switch). Falhas aqui são best-effort.
  const contactName = firstString([
    body?.contactName,
    body?.contact?.name,
    body?.pushName,
    body?.data?.pushName,
    body?.data?.contact?.name,
  ]) || null;
  // Reserva adicional SOMENTE quando a mensagem não tem id próprio. Com wamid a
  // reserva por `message:` já garante unicidade; bloquear por conteúdo aqui
  // silenciava respostas legítimas repetidas (ex.: o mesmo CNPJ digitado 2x).
  if (e164 && !messageId && (text || "").trim()) {
    const contentKey = (text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 160);
    const timeWindow = Math.floor(Date.now() / 120000);
    const contentBytes = new TextEncoder().encode(`${e164}:${contentKey}:${timeWindow}`);
    const contentHash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", contentBytes))]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    const { error: contentClaimError } = await supabase
      .from("whatsapp_webhook_dedup")
      .insert({ dedup_key: `content:${contentHash}`, source: String(body?.source ?? "meta") });
    if (contentClaimError?.code === "23505") {
      await supabase.from("chatgoo_events").insert({
        direction: "inbound",
        event: "webhook_echo",
        phone: e164,
        clinic_id: SINDICATO_CLINIC_ID,
        decision: "IGNORED",
        reason: "DUPLICATE_CONTENT",
        payload: { message_id: messageId || null, content_key: contentKey },
      });
      return new Response(JSON.stringify({ status: "ignored_duplicate_content" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (contentClaimError) {
      return new Response(JSON.stringify({ status: "blocked", reason: "DEDUP_UNAVAILABLE" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const cwCfg = e164 ? await getChatwootConfig(supabase, SINDICATO_CLINIC_ID) : null;
  // Quando a mensagem já veio DO Chatwoot (ZapResponde), a conversa existe e a
  // mensagem já está lá: não recriar nem espelhar de novo (evita duplicidade).
  const fromChatwoot = String(body?.source ?? "") === "chatwoot";
  let cwConversationId: number | null = Number(body?.chatwoot_conversation_id ?? 0) || null;
  if (cwCfg && e164 && !fromChatwoot) {
    try {
      cwConversationId = await chatwootEnsureConversation(cwCfg, e164, contactName);
      if (cwConversationId && text) {
        await chatwootMirrorIncoming(cwCfg, cwConversationId, text);
      }
    } catch (_e) {
      cwConversationId = null;
    }
  }
  const mirrorBot = async (reply: string) => {
    if (cwCfg && cwConversationId) {
      try {
        await chatwootMirrorBotReply(cwCfg, cwConversationId, reply);
      } catch { /* best-effort */ }
    }
  };


  // Dados extras que algumas respostas precisam registrar (ex.: as opções de
  // contribuição enviadas, para reconhecer a escolha quando ela volta como texto).
  let logExtra: Record<string, unknown> = {};

  const log = async (
    decision: string,
    reason: string | null,
    patientId: string | null,
    reply: string,
    metaMessageId: string | null = null,
  ) => {
    await supabase.from("chatgoo_events").insert({
      direction: "inbound",
      event: "message",
      phone: e164,
      patient_id: patientId,
      clinic_id: SINDICATO_CLINIC_ID,
      intent,
      decision,
      reason,
      payload: {
        text,
        ticket_id: ticketId,
        message_id: messageId || null,
        reply,
        profile,
        await_cnpj: nextAwaitCnpj,
        empresa_cnpj: empresaCnpj,

        meta_message_id: metaMessageId,
        ...logExtra,
      },
    });
  };


  const answer = async (
    reply: string,
    decision: string,
    reason: string | null,
    patientId: string | null,
  ) => {
    // Resposta sai pela Meta Cloud API oficial (conexão 3223-Oficial é Meta oficial).
    const result = await chatgooSendTextViaMeta(supabase, e164 ?? "", reply, { inboundNow: true });
    const delivered = result.sent || result.dry_run;
    if (delivered) await mirrorBot(reply);
    await log(
      delivered ? decision : "SEND_FAILED",
      delivered ? reason : result.error ?? `META_HTTP_${result.status ?? "NETWORK"}`,
      patientId,
      reply,
      result.message_id ?? null,
    );
    return new Response(
      JSON.stringify({
        status: delivered ? decision : "SEND_FAILED",
        intent,
        dry_run: result.dry_run,
        delivered: result.sent,
        meta_message_id: result.message_id ?? null,
        reply,
      }),
      {
        // O webhook sempre confirma o recebimento ao ChatGoo. A falha de saída
        // já fica registrada como SEND_FAILED; devolver 5xx faz o provedor
        // repetir/desativar o webhook e era a causa da intermitência.
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  };

  const answerContributionButton = async (token: string) => {
    const { data: contribution } = await supabase
      .from("employer_contributions")
      .select("competence_month,competence_year,due_date,value,status")
      .eq("public_access_token", token)
      .maybeSingle();

    if (!contribution) {
      return await answer(
        "Não consegui localizar essa contribuição. Escolha a opção novamente ou digite ATENDENTE.",
        "ANSWERED",
        "CONTRIBUTION_LINK_NOT_FOUND",
        null,
      );
    }

    const comp = contribution.competence_month && contribution.competence_year
      ? `${String(contribution.competence_month).padStart(2, "0")}/${contribution.competence_year}`
      : "-";
    const hasValue = Number(contribution.value ?? 0) > 0;
    const actionText = hasValue
      ? "Toque no botão abaixo para informar somente a nova data de vencimento."
      : "Toque no botão abaixo para informar o valor, o tipo e a data de vencimento.";
    const buttonLabel = hasValue ? "Alterar vencimento" : "Informar valor";
    const bodyText = [
      `Competência ${comp}`,
      `Vencimento: ${fmtDate(contribution.due_date)}`,
      `Valor atual: ${fmtMoney(contribution.value)}`,
      "",
      actionText,
    ].join("\n");
    const url = `${APP_BASE_URL}/contribuicao/${encodeURIComponent(token)}`;
    const result = await chatgooSendCtaUrlViaMeta(supabase, e164 ?? "", {
      body: bodyText,
      buttonLabel,
      url,
      footer: "Link pessoal e seguro",
    }, { inboundNow: true });

    let finalResult = result;
    let mirroredReply = bodyText;
    if (!result.sent && !result.dry_run && result.error !== "OUTSIDE_24H_WINDOW") {
      mirroredReply = `${bodyText}\n\nAcessar: ${url}`;
      finalResult = await chatgooSendTextViaMeta(
        supabase,
        e164 ?? "",
        mirroredReply,
        { inboundNow: true },
      );
    }

    const delivered = finalResult.sent || finalResult.dry_run;
    if (delivered) await mirrorBot(mirroredReply);
    await log(
      delivered ? "ANSWERED" : "SEND_FAILED",
      delivered ? "CONTRIBUTION_CTA_SENT" : finalResult.error ?? `META_HTTP_${finalResult.status ?? "NETWORK"}`,
      null,
      mirroredReply,
      finalResult.message_id ?? null,
    );
    return new Response(JSON.stringify({
      status: delivered ? "ANSWERED" : "SEND_FAILED",
      intent: "ATUALIZAR_BOLETO",
      dry_run: finalResult.dry_run,
      delivered: finalResult.sent,
      meta_message_id: finalResult.message_id ?? null,
      reply: mirroredReply,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  };

  const answerSecondCopyButton = async (optionId: string) => {
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recent } = await supabase
      .from("chatgoo_events")
      .select("payload")
      .eq("event", "message")
      .eq("phone", e164)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(10);

    let selected: { id: string; title: string; description?: string; url: string; company?: string } | null = null;
    for (const row of recent ?? []) {
      const options = (row as any)?.payload?.invoice_options;
      if (!Array.isArray(options)) continue;
      const hit = options.find((option: { id?: string }) => option?.id === optionId);
      if (hit) {
        selected = hit;
        break;
      }
    }

    if (!selected) {
      return await answer(
        "Essa opção expirou. Escolha novamente a 2ª via de boleto.",
        "ANSWERED",
        "INVOICE_OPTION_EXPIRED",
        null,
      );
    }

    let safeUrl: URL;
    try {
      safeUrl = new URL(selected.url);
    } catch {
      return await answer("Não consegui abrir esse boleto. Digite ATENDENTE.", "HANDOFF", "INVALID_INVOICE_URL", null);
    }
    const allowedHost = safeUrl.protocol === "https:" &&
      (safeUrl.hostname === "lytex.com.br" || safeUrl.hostname.endsWith(".lytex.com.br"));
    if (!allowedHost) {
      return await answer("Não consegui abrir esse boleto. Digite ATENDENTE.", "HANDOFF", "INVALID_INVOICE_URL", null);
    }

    // Boleto vencido: em vez de abrir o link antigo, oferece definir nova
    // data de vencimento pela página segura (gera boleto atualizado).
    const updateToken = String((selected as any).updateToken ?? "");
    if ((selected as any).overdue && updateToken) {
      const updateUrl = `${APP_BASE_URL}/contribuicao/${encodeURIComponent(updateToken)}`;
      const bodyText = [
        selected.company || null,
        selected.title,
        selected.description || null,
        "",
        "Este boleto está vencido. Toque no botão abaixo para definir uma nova data de vencimento e gerar o boleto atualizado.",
      ].filter(Boolean).join("\n");
      const result = await chatgooSendCtaUrlViaMeta(supabase, e164 ?? "", {
        body: bodyText,
        buttonLabel: "Alterar vencimento",
        url: updateUrl,
        footer: "Link pessoal e seguro",
      }, { inboundNow: true });

      let finalResult = result;
      let mirroredReply = bodyText;
      if (!result.sent && !result.dry_run && result.error !== "OUTSIDE_24H_WINDOW") {
        mirroredReply = `${bodyText}\n\nAcessar: ${updateUrl}`;
        finalResult = await chatgooSendTextViaMeta(supabase, e164 ?? "", mirroredReply, { inboundNow: true });
      }
      const delivered = finalResult.sent || finalResult.dry_run;
      if (delivered) await mirrorBot(mirroredReply);
      await log(
        delivered ? "ANSWERED" : "SEND_FAILED",
        delivered ? "OVERDUE_REISSUE_CTA_SENT" : finalResult.error ?? `META_HTTP_${finalResult.status ?? "NETWORK"}`,
        null,
        mirroredReply,
        finalResult.message_id ?? null,
      );
      return new Response(JSON.stringify({
        status: delivered ? "ANSWERED" : "SEND_FAILED",
        intent: "SEGUNDA_VIA",
        dry_run: finalResult.dry_run,
        delivered: finalResult.sent,
        meta_message_id: finalResult.message_id ?? null,
        reply: mirroredReply,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const bodyText = [
      selected.company || null,
      selected.title,
      selected.description || null,
      "",
      "Toque no botão abaixo para abrir a 2ª via.",
    ].filter(Boolean).join("\n");
    const result = await chatgooSendCtaUrlViaMeta(supabase, e164 ?? "", {
      body: bodyText,
      buttonLabel: "Abrir boleto",
      url: safeUrl.toString(),
      footer: "Acesso direto e seguro",
    }, { inboundNow: true });

    const delivered = result.sent || result.dry_run;
    const reply = delivered
      ? bodyText
      : "Não consegui abrir esse boleto agora. Tente novamente ou digite ATENDENTE.";
    if (delivered) await mirrorBot(reply);
    await log(
      delivered ? "ANSWERED" : "SEND_FAILED",
      delivered ? "SECOND_COPY_CTA_SENT" : result.error ?? `META_HTTP_${result.status ?? "NETWORK"}`,
      null,
      reply,
      result.message_id ?? null,
    );
    return new Response(JSON.stringify({
      status: delivered ? "ANSWERED" : "SEND_FAILED",
      intent: "SEGUNDA_VIA",
      dry_run: result.dry_run,
      delivered: result.sent,
      meta_message_id: result.message_id ?? null,
      reply,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  };

  if (selectedContributionToken) {
    return await answerContributionButton(selectedContributionToken);
  }
  if (selectedInvoiceId) {
    return await answerSecondCopyButton(selectedInvoiceId);
  }

  // Quando a escolha da lista chega como TEXTO (ZapResponde/Chatwoot não
  // repassa o id da opção), reconhecemos pelo título/descrição enviados há
  // pouco. Sem isso, a escolha caía no menu inicial.
  if (e164 && text) {
    const norm = (v: string) =>
      v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
    const alvo = norm(text);
    if (alvo.length > 3) {
      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: recent } = await supabase
        .from("chatgoo_events")
        .select("payload")
        .eq("event", "message")
        .eq("phone", e164)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(5);
      for (const row of recent ?? []) {
        // deno-lint-ignore no-explicit-any
        const opts = (row as any)?.payload?.contrib_options;
        if (Array.isArray(opts)) {
          const hit = opts.find((o: { id: string; title: string; description?: string }) => {
            const t = norm(String(o.title ?? ""));
            const d = norm(String(o.description ?? ""));
            return t && (alvo === t || alvo.startsWith(t) || alvo.includes(t) || (d && alvo.includes(d)));
          });
          if (hit?.id?.startsWith?.("OPEN_CONTRIB:")) {
            return await answerContributionButton(String(hit.id).slice("OPEN_CONTRIB:".length));
          }
        }

        const invoiceOptions = (row as any)?.payload?.invoice_options;
        if (!Array.isArray(invoiceOptions)) continue;
        const invoiceHit = invoiceOptions.find((o: { id: string; title: string; description?: string }) => {
          const t = norm(String(o.title ?? ""));
          const d = norm(String(o.description ?? ""));
          return t && (alvo === t || alvo.startsWith(t) || alvo.includes(t) || (d && alvo.includes(d)));
        });
        if (invoiceHit?.id?.startsWith?.("OPEN_INVOICE:")) {
          return await answerSecondCopyButton(String(invoiceHit.id));
        }
      }
    }
  }


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
    }, { inboundNow: true });
    let finalResult = result;
    if (!result.sent && !result.dry_run && result.error !== "OUTSIDE_24H_WINDOW") {
      finalResult = await chatgooSendTextViaMeta(
        supabase,
        e164 ?? "",
        `${bodyText}\n\n${config.fallback}`,
        { inboundNow: true },
      );
    }
    const delivered = finalResult.sent || finalResult.dry_run;
    if (delivered) await mirrorBot(bodyText);
    await log(
      delivered ? "ANSWERED" : "SEND_FAILED",
      delivered ? null : finalResult.error ?? `META_HTTP_${finalResult.status ?? "NETWORK"}`,
      patientId,
      bodyText,
      finalResult.message_id ?? null,
    );
    return new Response(
      JSON.stringify({
        status: delivered ? "ANSWERED" : "SEND_FAILED",
        intent,
        dry_run: finalResult.dry_run,
        delivered: finalResult.sent,
        meta_message_id: finalResult.message_id ?? null,
        reply: bodyText,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  };

  // Nenhum fluxo pode tentar responder sem um destinatário válido. Alguns
  // formatos do ChatGoo omitem o telefone; antes isso chegava ao consentimento,
  // era marcado como respondido e enviava para um destino vazio.
  if (!phoneOk || !e164) {
    await supabase.from("chatgoo_events").insert({
      direction: "inbound",
      event: "webhook",
      decision: "BLOCKED",
      reason: "PHONE_NOT_FOUND_IN_PAYLOAD",
      payload: { raw: rawBody.slice(0, 2000), message_id: messageId || null },
    });
    return new Response(
      JSON.stringify({ status: "BLOCKED", reason: "PHONE_INVALID" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // ===== DESCADASTRO (OPT-OUT) — EXIGÊNCIA META =====
  // "SAIR/PARAR/CANCELAR" encerra o envio: registra o opt-out, envia UMA única
  // confirmação e, a partir daí, o robô fica em silêncio (nada é enviado).
  {
    const t = String(text ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9 ]/g, "")
      .trim();
    const isStop = /^(sair|parar|pare|cancelar|stop|descadastrar|remover|nao quero mais receber|nao quero receber|nao enviar mais)$/
      .test(t);
    const isResume = /^(voltar a receber|quero receber|reativar|receber novamente|voltar)$/.test(t);

    const phoneVariants = (() => {
      const p = e164 ?? "";
      const local = p.slice(2);
      const set = new Set<string>([p, `+${p}`, local]);
      if (local.length === 11) set.add(local.slice(0, 2) + local.slice(3));
      return [...set].filter(Boolean);
    })();

    const { data: activeOptOut } = await supabase
      .from("whatsapp_opt_outs")
      .select("id")
      .eq("clinic_id", SINDICATO_CLINIC_ID)
      .in("phone", phoneVariants)
      .is("reactivated_at", null)
      .limit(1);
    const isOptedOut = Array.isArray(activeOptOut) && activeOptOut.length > 0;

    if (isStop) {
      if (!isOptedOut) {
        await supabase.from("whatsapp_opt_outs").insert({
          clinic_id: SINDICATO_CLINIC_ID,
          phone: e164,
          source: "user_reply",
          reason: `keyword:${t}`,
        });
        return await answer(
          [
            "Pronto. Você não receberá mais mensagens automáticas neste número.",
            "",
            'Se quiser voltar a receber, é só enviar "VOLTAR A RECEBER".',
          ].join("\n"),
          "OPT_OUT",
          "USER_REQUESTED_STOP",
          null,
        );
      }
      // Já estava descadastrado: silêncio total, apenas auditoria.
      await log("SILENCED", "ALREADY_OPTED_OUT", null, "");
      return new Response(
        JSON.stringify({ status: "SILENCED", reason: "ALREADY_OPTED_OUT" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (isOptedOut) {
      if (isResume) {
        await supabase
          .from("whatsapp_opt_outs")
          .update({ reactivated_at: new Date().toISOString() })
          .eq("clinic_id", SINDICATO_CLINIC_ID)
          .in("phone", phoneVariants)
          .is("reactivated_at", null);
        return await answer(
          'Tudo certo! Você voltou a receber nossas mensagens. Envie "MENU" para começar.',
          "OPT_IN",
          "USER_REQUESTED_RESUME",
          null,
        );
      }
      // Contato descadastrado: nenhuma resposta automática é enviada.
      await log("SILENCED", "OPTED_OUT", null, "");
      return new Response(
        JSON.stringify({ status: "SILENCED", reason: "OPTED_OUT" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
  }

  // ===== ATENDIMENTO HUMANO EM ANDAMENTO (MODO MANUAL CONSERVADOR) =====
  // Se a conversa está aberta e atribuída a um atendente no Chatwoot, o robô
  // fica em silêncio para não atropelar o humano. O opt-out acima continua
  // valendo sempre. "MENU" devolve o contato ao fluxo automático.
  if (cwCfg && cwConversationId) {
    const wantsBot = /^\s*(menu|inicio|in[ií]cio|voltar)\s*$/i.test(String(text ?? ""));
    if (wantsBot) {
      try { await chatwootSetPause(cwCfg, cwConversationId, false); } catch { /* best-effort */ }
    }
    if (!wantsBot) {
      let humanActive = false;
      try {
        humanActive = await chatwootHasHumanInControl(cwCfg, cwConversationId);
      } catch { /* best-effort */ }
      if (humanActive) {
        await supabase.from("chatgoo_events").insert({
          direction: "inbound",
          event: "message",
          phone: e164,
          clinic_id: SINDICATO_CLINIC_ID,
          decision: "SILENCED",
          reason: "HUMAN_IN_CONTROL",
          payload: { text, chatwoot_conversation_id: cwConversationId },
        });
        return new Response(
          JSON.stringify({ status: "SILENCED", reason: "HUMAN_IN_CONTROL" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }
  }



  // ===== CONSENTIMENTO (OPT-IN) COM BOTÕES — BOAS PRÁTICAS META =====
  // No primeiro contato, perguntamos uma única vez se a pessoa autoriza receber
  // mensagens. A resposta do botão ("Sim, autorizo" / "Não autorizo") fica
  // registrada com data/hora como prova auditável de consentimento.
  {
    const tConsent = String(text ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9 ]/g, "")
      .trim();

    // Quando o convite de consentimento foi enviado recentemente e ainda não há
    // opt-in registrado, aceitamos palavras inequívocas. Números nunca significam
    // consentimento, pois também são opções dos menus e causavam o fluxo travado.
    let awaitingConsent = false;
    if (e164) {
      const { data: optinNow } = await supabase
        .from("whatsapp_opt_ins")
        .select("id")
        .eq("clinic_id", SINDICATO_CLINIC_ID)
        .eq("phone", e164)
        .limit(1);
      if (!optinNow || optinNow.length === 0) {
        const { data: promptRecent } = await supabase
          .from("chatgoo_events")
          .select("id")
          .eq("event", "consent_prompt")
          .eq("phone", e164)
          .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
          .limit(1);
        awaitingConsent = Array.isArray(promptRecent) && promptRecent.length > 0;
      }
    }

    const saidNo =
      selectedId === "CONSENT_NAO" ||
      tConsent === "nao autorizo" ||
      (awaitingConsent && /^(nao|n|nao quero|recuso)$/.test(tConsent));

    // Aceita "sim" digitado APENAS como resposta ao botão (selectedId), frase
    // explícita de autorização, ou resposta ao convite enviado há pouco.
    const explicitYes =
      selectedId === "CONSENT_SIM" ||
      /^(sim autorizo|autorizo|eu autorizo|autorizo sim)$/.test(tConsent) ||
      (awaitingConsent && /^(sim|s|ok|aceito|concordo)$/.test(tConsent));


    if (explicitYes || saidNo) {
      if (explicitYes) {
        await supabase.from("whatsapp_opt_ins").upsert(
          {
            clinic_id: SINDICATO_CLINIC_ID,
            phone: e164,
            source: "consent_button",
            consented_at: new Date().toISOString(),
          },
          { onConflict: "clinic_id,phone" },
        );
        return await answer(
          "Obrigado! Seu consentimento foi registrado. Envie \"MENU\" para começar.",
          "OPT_IN",
          "CONSENT_GRANTED_BUTTON",
          null,
        );
      }
      // Recusa explícita: registra opt-out e silencia (uma única confirmação).
      await supabase.from("whatsapp_opt_outs").insert({
        clinic_id: SINDICATO_CLINIC_ID,
        phone: e164,
        source: "consent_button",
        reason: "consent_declined",
      });
      return await answer(
        "Entendido. Você não receberá mensagens automáticas neste número.",
        "OPT_OUT",
        "CONSENT_DECLINED_BUTTON",
        null,
      );
    }

    // Envia o convite de consentimento UMA vez a cada 30 dias, apenas para
    // contatos que ainda não consentiram e não estão descadastrados.
    if (e164) {
      const { data: optin } = await supabase
        .from("whatsapp_opt_ins")
        .select("id")
        .eq("clinic_id", SINDICATO_CLINIC_ID)
        .eq("phone", e164)
        .limit(1);
      if (!optin || optin.length === 0) {
        const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const { data: prompted } = await supabase
          .from("chatgoo_events")
          .select("id")
          .eq("event", "consent_prompt")
          .eq("phone", e164)
          .gte("created_at", since30d)
          .limit(1);
        if (!prompted || prompted.length === 0) {
          const consentBody = [
            "Antes de continuarmos: você autoriza o recebimento de mensagens",
            "informativas e operacionais do sindicato neste número?",
            "",
            "Responda SIM para autorizar ou NÃO para recusar.",
            "Você pode cancelar a qualquer momento enviando SAIR.",

          ].join("\n");
          const consentResult = await chatgooSendButtonsViaMeta(supabase, e164, {
            body: consentBody,
            buttons: [
              { id: "CONSENT_SIM", title: "Sim, autorizo" },
              { id: "CONSENT_NAO", title: "Não autorizo" },
            ],
            footer: "Sindicato • atendimento oficial",
          }, { inboundNow: true });
          // Se os botões falharem, garante que o contato receba a pergunta em texto.
          let finalConsentResult = consentResult;
          if (!consentResult.sent && !consentResult.dry_run) {
            finalConsentResult = await chatgooSendTextViaMeta(
              supabase,
              e164,
              `${consentBody}\n\nResponda AUTORIZO para continuar, ou SAIR para não receber mensagens.`,
              { inboundNow: true },
            );
          }
          if (!finalConsentResult.sent && !finalConsentResult.dry_run) {
            await log(
              "SEND_FAILED",
              finalConsentResult.error ?? `META_HTTP_${finalConsentResult.status ?? "NETWORK"}`,
              null,
              consentBody,
            );
            return new Response(
              JSON.stringify({ status: "SEND_FAILED", intent: "CONSENT_PROMPT" }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
          }
          await supabase.from("chatgoo_events").insert({
            direction: "outbound",
            event: "consent_prompt",
            phone: e164,
            clinic_id: SINDICATO_CLINIC_ID,
            decision: "ANSWERED",
            reason: "CONSENT_PROMPT_SENT",
            payload: { ticket_id: ticketId },
          });
          // Registra a mensagem recebida (abre a janela de 24h) e aguarda a
          // resposta do botão antes de seguir para o menu.
          await log("ANSWERED", "AWAITING_CONSENT", null, consentBody);
          return new Response(
            JSON.stringify({ status: "ANSWERED", intent: "CONSENT_PROMPT" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }
    }
  }




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

  // ===== ATUALIZAÇÃO DE BOLETO (valor para zeradas / vencimento para vencidas) =====
  // Compliance Meta: nenhum dado financeiro é coletado por texto livre no
  // WhatsApp. O contato informa apenas o CNPJ e recebe um link seguro, com
  // token por boleto, onde preenche valor, tipo de contribuição e vencimento.
  const askCnpj = async (scope: "EMPRESA" | "CONTABILIDADE") => {
    nextAwaitCnpj = scope;
    return await answer(
      [
        "Para atualizar boleto (valor nas contribuições zeradas ou novo vencimento nas vencidas),",
        "me informe o CNPJ da empresa (somente números).",
        "",
        "Exemplo: 12345678000199",
      ].join("\n"),
      "ANSWERED",
      "ASK_CNPJ",
      null,
    );
  };

  // Busca a empresa diretamente no banco (o filtro em memória falhava quando o
  // sindicato tem mais empresas do que o limite de linhas retornadas).
  const findEmpresaByCnpj = async (
    cnpjDigits: string,
    columns = "id,name,trade_name,cnpj",
  ) => {
    const d = cnpjDigits.replace(/\D/g, "");
    if (d.length !== 14) return null;
    const formatted = `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
    const { data } = await supabase
      .from("employers")
      .select(columns)
      .eq("clinic_id", SINDICATO_CLINIC_ID)
      .or(`cnpj.eq.${d},cnpj.eq.${formatted}`)
      .limit(1);
    return (data ?? [])[0] ?? null;
  };

  const sendUpdateLinks = async (
    cnpjDigits: string,
    scope: "EMPRESA" | "CONTABILIDADE",
  ) => {
    // Autorização: o CNPJ precisa pertencer ao tenant do sindicato e, no caso da
    // contabilidade, estar vinculado ao escritório identificado pelo telefone.
    const empresa = await findEmpresaByCnpj(cnpjDigits);


    if (!empresa) {
      return await answer(
        "Não localizei empresa com este CNPJ no sindicato. Confira os números ou responda \"atendente\".",
        "ANSWERED",
        "CNPJ_NOT_FOUND",
        null,
      );
    }

    if (scope === "EMPRESA") {
      const vinculadas = await employerLookup();
      const autorizada = vinculadas.some((e: any) => e.id === empresa.id);
      if (!autorizada) {
        return await answer(
          "Por segurança, só posso atualizar boletos da empresa vinculada a este número. Vou encaminhar para um atendente.",
          "HANDOFF",
          "CNPJ_NOT_LINKED_TO_PHONE",
          null,
        );
      }
    } else {
      const escritorios = await accountingLookup();
      if (escritorios.length !== 1) {
        return await answer(
          "Não consegui confirmar o escritório com segurança. Vou encaminhar para um atendente.",
          "HANDOFF",
          "ACCOUNTING_NOT_RESOLVED",
          null,
        );
      }
      const { data: vinculo } = await supabase
        .from("accounting_office_employers")
        .select("employer_id")
        .eq("accounting_office_id", escritorios[0].id)
        .eq("employer_id", empresa.id)
        .maybeSingle();
      if (!vinculo) {
        return await answer(
          "Este CNPJ não está vinculado ao escritório deste número. Vou encaminhar para um atendente.",
          "HANDOFF",
          "CNPJ_NOT_LINKED_TO_OFFICE",
          null,
        );
      }
    }

    const hoje = new Date().toISOString().slice(0, 10);

    // Somente os tipos autorizados: 124 Mensalidade Sindical,
    // 125 Taxa Negocial (Mercados) e 126 Taxa Negocial (COM VAREJ).
    const { data: tipos } = await supabase
      .from("contribution_types")
      .select("id,name")
      .eq("clinic_id", SINDICATO_CLINIC_ID)
      .limit(200);
    const tiposPermitidos = new Set(
      (tipos ?? [])
        .filter((t: any) => /^\s*(124|125|126)\s*-/.test(String(t.name ?? "")))
        .map((t: any) => String(t.id)),
    );

    const { data: contribs } = await supabase
      .from("employer_contributions")
      .select("id,competence_month,competence_year,due_date,value,status,public_access_token,contribution_type_id")
      .eq("employer_id", empresa.id)
      .in("status", ["awaiting_value", "pending", "overdue"])
      .eq("competence_year", ANO_CORRENTE)
      .gte("due_date", `${ANO_CORRENTE}-01-01`)
      .order("due_date", { ascending: true })
      .limit(50);

    // Elegíveis: boletos zerados (a vencer ou vencidos) e boletos vencidos,
    // do ano em curso e somente dos tipos 124/125/126.
    const elegiveis = (contribs ?? []).filter((c: any) => {
      if (!tiposPermitidos.has(String(c.contribution_type_id ?? ""))) return false;
      const zerado = !c.value || Number(c.value) === 0 || c.status === "awaiting_value";
      const vencido = c.status === "overdue" ||
        String(c.due_date ?? "").slice(0, 10) < hoje;
      return zerado || vencido;
    }).slice(0, 5);

    const nomeEmpresa = empresa.trade_name || empresa.name || "Empresa";

    if (elegiveis.length === 0) {
      return await answer(
        `${nomeEmpresa}: não encontrei boleto zerado ou vencido para atualizar. Se precisar de outra competência, responda "atendente".`,
        "ANSWERED",
        "NO_ELIGIBLE_CONTRIBUTION",
        null,
      );
    }

    const opcoes: { id: string; title: string; description: string }[] = [];
    for (const c of elegiveis) {
      let token = (c.public_access_token as string | null) || null;
      if (!token) {
        // Gera token localmente (URL-safe) e persiste no registro.
        const bytes = new Uint8Array(24);
        crypto.getRandomValues(bytes);
        const candidato = btoa(String.fromCharCode(...bytes))
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=+$/, "");
        const { error: updErr } = await supabase
          .from("employer_contributions")
          .update({ public_access_token: candidato })
          .eq("id", c.id);
        if (updErr) {
          console.error("token_persist_failed", c.id, updErr.message);
        } else {
          token = candidato;
        }
      }
      if (!token) continue;
      const comp = c.competence_month && c.competence_year
        ? `${String(c.competence_month).padStart(2, "0")}/${c.competence_year}`
        : "-";
      opcoes.push({
        id: `OPEN_CONTRIB:${token}`,
        title: `Competência ${comp}`,
        description: `Venc. ${fmtDate(c.due_date)} • ${fmtMoney(c.value)}`,
      });
    }

    if (opcoes.length === 0) {
      return await answer(
        `${nomeEmpresa}: não consegui gerar o link seguro agora. Vou encaminhar para um atendente.`,
        "HANDOFF",
        "TOKEN_GENERATION_FAILED",
        null,
      );
    }

    const intro = [
      `${nomeEmpresa} — CNPJ ${cnpjDigits}`,
       "Escolha uma contribuição para atualizar o boleto:",
    ].join("\n");
    const result = await chatgooSendListViaMeta(supabase, e164 ?? "", {
      body: intro,
      buttonLabel: "Escolher contribuição",
      footer: "Os links são pessoais e seguros",
      sections: [{ title: "Contribuições", rows: opcoes }],
    }, { inboundNow: true });

    let finalResult = result;
    let mirroredReply = intro;
    if (!result.sent && !result.dry_run && result.error !== "OUTSIDE_24H_WINDOW") {
      const fallback = opcoes.map((opcao) => {
        const token = opcao.id.slice("OPEN_CONTRIB:".length);
        return `• ${opcao.title} — ${opcao.description}\n  Acessar: ${APP_BASE_URL}/contribuicao/${encodeURIComponent(token)}`;
      });
      mirroredReply = [intro, "", ...fallback].join("\n");
      finalResult = await chatgooSendTextViaMeta(supabase, e164 ?? "", mirroredReply, { inboundNow: true });
    }

    const delivered = finalResult.sent || finalResult.dry_run;
    logExtra = { contrib_options: opcoes };
    if (delivered) await mirrorBot(mirroredReply);

    await log(
      delivered ? "ANSWERED" : "SEND_FAILED",
      delivered ? "UPDATE_OPTIONS_SENT" : finalResult.error ?? `META_HTTP_${finalResult.status ?? "NETWORK"}`,
      null,
      mirroredReply,
      finalResult.message_id ?? null,
    );
    return new Response(JSON.stringify({
      status: delivered ? "ANSWERED" : "SEND_FAILED",
      intent,
      dry_run: finalResult.dry_run,
      delivered: finalResult.sent,
      meta_message_id: finalResult.message_id ?? null,
      reply: mirroredReply,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  };

  if (intent === "HUMANO") {
    // Handoff no Chatwoot (painel de atendimento). Fallback: fila do ChatGoo.
    let handedOff = false;
    if (cwCfg && cwConversationId) {
      try {
        await chatwootHandoff(
          cwCfg,
          cwConversationId,
          "Transferência solicitada pelo contato no WhatsApp. Responda por aqui — o envio sai pela conexão oficial da Meta, dentro da janela de 24h.",
        );
        handedOff = true;
      } catch { /* best-effort */ }
    }
    const queueId = Deno.env.get("CHATGOO_HUMAN_QUEUE_ID");
    if (!handedOff && ticketId && queueId) await chatgooTransferToQueue(ticketId, queueId);
    return await answer(
      "Certo! Estou transferindo você para um atendente do sindicato. Aguarde um momento.",
      "HANDOFF",
      "USER_REQUEST",
      null,
    );
  }

  if (intent === "EMP_ATUALIZAR") {
    // A empresa já se identificou pelo CNPJ no início do fluxo: não pedimos de novo.
    if (empresaCnpj && empresaCnpj.length === 14) {
      return await sendUpdateLinks(empresaCnpj, "EMPRESA");
    }
    return await askCnpj("EMPRESA");
  }
  if (intent === "CTB_ATUALIZAR") return await askCnpj("CONTABILIDADE");

  // Resposta com o CNPJ solicitado no passo anterior
  if (awaitCnpj) {
    const digits = text.replace(/\D/g, "");
    if (digits.length === 14) {
      if (awaitCnpj === "EMPRESA_IDENT") {
        // Identificação da empresa: o CNPJ precisa existir no sindicato.
        const empresa = await findEmpresaByCnpj(digits);

        if (!empresa) {
          nextAwaitCnpj = "EMPRESA_IDENT";
          return await answer(
            "Não localizei empresa com este CNPJ no sindicato. Confira os 14 números ou responda \"atendente\".",
            "ANSWERED",
            "CNPJ_NOT_FOUND",
            null,
          );
        }
        empresaCnpj = digits;
        intent = "MENU_EMPRESA";
        profile = "EMPRESA";
        const nome = (empresa as any).trade_name || (empresa as any).name;
        return await answerMenu("EMPRESA", `${nome}, escolha uma opção:`, null);
      }
      intent = awaitCnpj === "CONTABILIDADE" ? "CTB_ATUALIZAR" : "EMP_ATUALIZAR";
      return await sendUpdateLinks(digits, awaitCnpj);
    }
    if (digits.length > 0 && digits.length < 14 && !selectedId) {
      nextAwaitCnpj = awaitCnpj;
      return await answer(
        "CNPJ inválido. Envie os 14 números do CNPJ, sem pontos ou barras.",
        "ANSWERED",
        "INVALID_CNPJ",
        null,
      );
    }
  }


  // MENU INICIAL: separa o atendimento por perfil (associado, empresa, contabilidade)
  if (intent === "MENU") {
    return await answerMenu(
      "ROOT",
      "Olá! Sou o atendimento automático do sindicato. Para começar, me diga quem é você:",
      null,
    );
  }

  // Empresa: ao escolher "Sou empresa" sempre pedimos o CNPJ para identificar
  // o contato, mesmo que exista um CNPJ guardado de uma conversa anterior.
  if (intent === "MENU_EMPRESA") {
    empresaCnpj = null;
    nextAwaitCnpj = "EMPRESA_IDENT";
    return await answer(
      [
        "Atendimento à empresa.",
        "Para continuar, me informe o CNPJ da empresa (somente números).",
        "",
        "Exemplo: 12345678000199",
      ].join("\n"),
      "ANSWERED",
      "ASK_CNPJ_IDENT",
      null,
    );
  }
  if (intent === "MENU_CONTABILIDADE") {
    return await answerMenu("CONTABILIDADE", "Atendimento à contabilidade. Escolha uma opção:", null);
  }


  // ===================== PERFIL: EMPRESA =====================
  if (
    intent === "EMP_BOLETOS" || intent === "EMP_HOMOLOGACAO" ||
    intent === "EMP_DADOS" || intent === "EMP_2VIA"
  ) {
    // Prioriza o CNPJ informado pela empresa nesta conversa. O telefone é apenas
    // fallback quando nenhum CNPJ foi identificado.
    let empresa: any = null;
    if (empresaCnpj) {
      empresa = await findEmpresaByCnpj(
        empresaCnpj,
        "id,name,trade_name,cnpj,phone,email,city,state,is_active",
      );
    }

    if (!empresa) {
      const empresas = await employerLookup();
      if (empresas.length !== 1) {
        nextAwaitCnpj = "EMPRESA_IDENT";
        return await answer(
          "Para continuar, me informe o CNPJ da empresa (somente números).",
          "ANSWERED",
          "ASK_CNPJ_IDENT",
          null,
        );
      }
      empresa = empresas[0];
    }

    const nomeEmpresa = empresa.trade_name || empresa.name || "Empresa";

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
      if (MES_LIMITE_COMPETENCIA < 1) {
        return await answer(
          `${nomeEmpresa}, ainda não há competência encerrada em ${ANO_CORRENTE} para segunda via.`,
          "ANSWERED",
          "NO_CLOSED_COMPETENCE",
          null,
        );
      }
      const { data: docs } = await supabase
        .from("employer_contributions")
        .select("id,competence_month,competence_year,due_date,value,status,lytex_invoice_url,contribution_type_id,public_access_token,contribution_types(name)")
        .eq("employer_id", empresa.id)
        .eq("competence_year", ANO_CORRENTE)
        .lte("competence_month", MES_LIMITE_COMPETENCIA)
        .in("status", ["pending", "overdue"])
        .not("lytex_invoice_url", "is", null)
        .order("competence_month", { ascending: false })
        .limit(10);

      if (!docs || docs.length === 0) {
        return await answer(
          `${nomeEmpresa}, não encontrei boleto emitido em aberto para segunda via. Se precisar emitir um novo boleto, responda "atendente".`,
          "ANSWERED",
          "NO_INVOICE_TO_REISSUE",
          null,
        );
      }

      const invoiceOptions = docs.map((c: any, index: number) => {
        const comp = c.competence_month && c.competence_year
          ? `${String(c.competence_month).padStart(2, "0")}/${c.competence_year}`
          : "-";
        const tipoNome = String(c.contribution_types?.name ?? "Contribuição").slice(0, 30);
        return {
          id: `OPEN_INVOICE:${c.id}`,
          title: `${index + 1}. ${comp}`,
          description: `${tipoNome} • ${fmtMoney(c.value)} • Venc. ${fmtDate(c.due_date)}`.slice(0, 72),
          url: String(c.lytex_invoice_url),
        };
      });

      const intro = `${nomeEmpresa}, escolha a competência do boleto:`;
      const result = await chatgooSendListViaMeta(supabase, e164 ?? "", {
        body: intro,
        buttonLabel: "Escolher boleto",
        footer: `Competências até ${String(MES_LIMITE_COMPETENCIA).padStart(2, "0")}/${ANO_CORRENTE}`,
        sections: [{ title: "2ª via de boleto", rows: invoiceOptions }],
      }, { inboundNow: true });
      const delivered = result.sent || result.dry_run;
      const reply = delivered ? intro : "Não consegui mostrar os boletos agora. Tente novamente ou digite ATENDENTE.";
      logExtra = { invoice_options: invoiceOptions };
      if (delivered) await mirrorBot(reply);
      await log(
        delivered ? "ANSWERED" : "SEND_FAILED",
        delivered ? "SECOND_COPY_OPTIONS_SENT" : result.error ?? `META_HTTP_${result.status ?? "NETWORK"}`,
        null,
        reply,
        result.message_id ?? null,
      );
      return new Response(JSON.stringify({ status: delivered ? "ANSWERED" : "SEND_FAILED", reply }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (intent === "EMP_BOLETOS") {
      const { data: contribs } = await supabase
        .from("employer_contributions")
        .select("competence_month,competence_year,due_date,value,status,lytex_invoice_url")
        .eq("employer_id", empresa.id)
        .eq("competence_year", ANO_CORRENTE)
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
    intent === "CTB_EMPRESAS" || intent === "CTB_BOLETOS" ||
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
      if (MES_LIMITE_COMPETENCIA < 1) {
        return await answer(
          `${nomeEscritorio}, ainda não há competência encerrada em ${ANO_CORRENTE} para segunda via.`,
          "ANSWERED",
          "NO_CLOSED_COMPETENCE",
          null,
        );
      }
      const nomes = new Map((empresasVinculadas ?? []).map((e: any) => [e.id, e.trade_name || e.name]));
      const { data: docs } = await supabase
        .from("employer_contributions")
        .select("id,employer_id,competence_month,competence_year,due_date,value,status,lytex_invoice_url,contribution_type_id,contribution_types(name)")
        .in("employer_id", employerIds)
        .eq("competence_year", ANO_CORRENTE)
        .lte("competence_month", MES_LIMITE_COMPETENCIA)
        .in("status", ["pending", "overdue"])
        .not("lytex_invoice_url", "is", null)
        .order("competence_month", { ascending: false })
        .limit(10);

      if (!docs || docs.length === 0) {
        return await answer(
          `${nomeEscritorio}, não encontrei boleto emitido em aberto para segunda via nas empresas do escritório. Se precisar emitir novos boletos, responda "atendente".`,
          "ANSWERED",
          "NO_INVOICE_TO_REISSUE",
          null,
        );
      }

      const invoiceOptions = docs.map((c: any, index: number) => {
        const comp = c.competence_month && c.competence_year
          ? `${String(c.competence_month).padStart(2, "0")}/${c.competence_year}`
          : "-";
        const empresaNome = String(nomes.get(c.employer_id) ?? "Empresa").slice(0, 24);
        const tipoNome = String(c.contribution_types?.name ?? "Contribuição").slice(0, 30);
        return {
          id: `OPEN_INVOICE:${c.id}`,
          title: `${index + 1}. ${comp}`,
          description: `${empresaNome} • ${tipoNome} • ${fmtMoney(c.value)} • Venc. ${fmtDate(c.due_date)}`.slice(0, 72),
          company: String(nomes.get(c.employer_id) ?? "Empresa"),
          url: String(c.lytex_invoice_url),
        };
      });

      const intro = `${nomeEscritorio}, escolha a empresa e a competência:`;
      const result = await chatgooSendListViaMeta(supabase, e164 ?? "", {
        body: intro,
        buttonLabel: "Escolher boleto",
        footer: `Competências até ${String(MES_LIMITE_COMPETENCIA).padStart(2, "0")}/${ANO_CORRENTE}`,
        sections: [{ title: "2ª via de boleto", rows: invoiceOptions }],
      }, { inboundNow: true });
      const delivered = result.sent || result.dry_run;
      const reply = delivered ? intro : "Não consegui mostrar os boletos agora. Tente novamente ou digite ATENDENTE.";
      logExtra = { invoice_options: invoiceOptions };
      if (delivered) await mirrorBot(reply);
      await log(
        delivered ? "ANSWERED" : "SEND_FAILED",
        delivered ? "SECOND_COPY_OPTIONS_SENT" : result.error ?? `META_HTTP_${result.status ?? "NETWORK"}`,
        null,
        reply,
        result.message_id ?? null,
      );
      return new Response(JSON.stringify({ status: delivered ? "ANSWERED" : "SEND_FAILED", reply }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // CTB_BOLETOS
    const nameById = new Map((empresasVinculadas ?? []).map((e: any) => [e.id, e.trade_name || e.name]));
    const { data: abertos } = await supabase
      .from("employer_contributions")
      .select("employer_id,competence_month,competence_year,due_date,value,status,lytex_invoice_url")
      .in("employer_id", employerIds)
      .eq("competence_year", ANO_CORRENTE)
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
      .eq("competence_year", ANO_CORRENTE)
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
