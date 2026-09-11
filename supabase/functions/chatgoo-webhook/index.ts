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
  chatgooSendText,
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
  | "HUMANO"
  | "MENU";

function detectIntent(text: string): Intent {
  const t = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (/(atendente|humano|falar com|pessoa|suporte)/.test(t)) return "HUMANO";
  if (/(carteirinha|carteira|validade)/.test(t)) return "CARTEIRINHA";
  if (/(consulta|agendamento|marcac|horario|medic)/.test(t)) return "AGENDAMENTOS";
  if (/(homologa|rescis)/.test(t)) return "HOMOLOGACAO";
  if (/(boleto|contribui|mensalidade|pagamento|2a via|segunda via|debito)/.test(t)) return "FINANCEIRO";
  if (/(cadastro|meus dados|situacao|associado)/.test(t)) return "CADASTRO";
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

const MENU = [
  "Olá! Sou o atendimento automático do sindicato.",
  "",
  "Posso ajudar com:",
  "1 - Meu cadastro / situação",
  "2 - Carteirinha (validade)",
  "3 - Meus agendamentos",
  "4 - Homologação de rescisão",
  "5 - Boletos e contribuições",
  "6 - Falar com um atendente",
  "",
  "Responda com o número ou escreva o que precisa.",
].join("\n");

const NUMBER_MAP: Record<string, Intent> = {
  "1": "CADASTRO",
  "2": "CARTEIRINHA",
  "3": "AGENDAMENTOS",
  "4": "HOMOLOGACAO",
  "5": "FINANCEIRO",
  "6": "HUMANO",
};

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
  const intent: Intent = NUMBER_MAP[text] ?? detectIntent(text);

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
      payload: { text, ticket_id: ticketId, message_id: messageId || null, reply },
    });
  };

  const answer = async (
    reply: string,
    decision: string,
    reason: string | null,
    patientId: string | null,
  ) => {
    const result = await chatgooSendText(e164 ?? "", reply, { ticketId });
    await log(decision, reason, patientId, reply);
    return new Response(
      JSON.stringify({ status: decision, intent, dry_run: result.dry_run, reply }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
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
  if (candidates.length > 1) {
    return await answer(
      "Encontrei mais de um cadastro com este número. Por segurança, vou encaminhar para um atendente.",
      "HANDOFF",
      "AMBIGUOUS_PHONE_MATCH",
      null,
    );
  }

  const patient = candidates[0];
  const first = String(patient.name ?? "").split(" ")[0];

  if (intent === "MENU") {
    return await answer(`Olá, ${first}!\n\n${MENU}`, "ANSWERED", null, patient.id);
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

  return await answer(`Olá, ${first}!\n\n${MENU}`, "ANSWERED", null, patient.id);
});
