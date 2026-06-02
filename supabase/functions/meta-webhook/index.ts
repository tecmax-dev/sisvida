import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ID da clínica do Sindicato (mesmo usado no fluxo de boleto)
const SINDICATO_CLINIC_ID = "89e7585e-7bce-4e58-91fa-c37080d1170d";

// =====================================================================
// Captura de ECOS de saída (campanhas/atendimentos disparados pelo
// painel Chatgoo direto pela Meta). O webhook ignora esses eventos no
// fluxo principal (para evitar loop e reprocessamento do bot), mas
// precisamos gravá-los no histórico do ticket para que o sistema
// reflita o que o operador enviou pelo painel. Fire-and-forget.
// =====================================================================
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function normalizeBrPhone(raw: any): string | null {
  if (raw === null || raw === undefined) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return null;
  return digits.startsWith("55") ? digits : `55${digits}`;
}

function captureOutgoingEcho(params: {
  source: "chatgoo_envelope" | "meta_echo";
  phone: string | null;
  contactName?: string | null;
  text?: string | null;
  mediaUrl?: string | null;
  mediaMime?: string | null;
  messageType?: string;
  messageId?: string | null;
  timestamp?: string | null;
  rawPayload?: any;
}) {
  const phone = normalizeBrPhone(params.phone);
  if (!phone) {
    console.log("[CAPTURE_ECHO_SKIP] missing phone");
    return;
  }
  const messageType = (params.messageType || "text") as string;
  const allowed = ["text","image","audio","video","document","location","contact","sticker"];
  const safeType = allowed.includes(messageType) ? messageType : "text";
  const content = params.text ?? (params.mediaUrl ? `[${safeType}]` : "");

  (async () => {
    try {
      const sb = createClient(SB_URL, SB_SERVICE);

      // 1) Find/create contact
      let contactId: string | null = null;
      const { data: existing } = await sb
        .from("whatsapp_contacts")
        .select("id, name")
        .eq("clinic_id", SINDICATO_CLINIC_ID)
        .eq("phone", phone)
        .maybeSingle();

      if (existing?.id) {
        contactId = existing.id;
        if (params.contactName && !existing.name) {
          await sb.from("whatsapp_contacts")
            .update({ name: params.contactName })
            .eq("id", contactId);
        }
      } else {
        const { data: inserted, error: insErr } = await sb
          .from("whatsapp_contacts")
          .insert({
            clinic_id: SINDICATO_CLINIC_ID,
            phone,
            name: params.contactName || null,
          })
          .select("id")
          .single();
        if (insErr) {
          console.error("[CAPTURE_ECHO_CONTACT_ERR]", insErr);
          return;
        }
        contactId = inserted.id;
      }
      if (!contactId) return;

      // 2) Find latest non-closed ticket; create if none
      let ticketId: string | null = null;
      const { data: openTicket } = await sb
        .from("whatsapp_tickets")
        .select("id")
        .eq("clinic_id", SINDICATO_CLINIC_ID)
        .eq("contact_id", contactId)
        .neq("status", "closed")
        .order("last_message_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (openTicket?.id) {
        ticketId = openTicket.id;
      } else {
        const { data: newTicket, error: tErr } = await sb
          .from("whatsapp_tickets")
          .insert({
            clinic_id: SINDICATO_CLINIC_ID,
            contact_id: contactId,
            status: "open",
            is_bot_active: false, // não acionar bot
            subject: "Disparo via Chatgoo",
          })
          .select("id")
          .single();
        if (tErr) {
          console.error("[CAPTURE_ECHO_TICKET_ERR]", tErr);
          return;
        }
        ticketId = newTicket.id;
      }
      if (!ticketId) return;

      // 3) Dedup by meta_message_id
      if (params.messageId) {
        const { data: dup } = await sb
          .from("whatsapp_ticket_messages")
          .select("id")
          .eq("ticket_id", ticketId)
          .contains("metadata", { meta_message_id: params.messageId })
          .maybeSingle();
        if (dup?.id) {
          console.log("[CAPTURE_ECHO_DUP_SKIP]", params.messageId);
          return;
        }
      }

      // 4) Insert message as operator
      const tsMs = params.timestamp
        ? Number(params.timestamp) * (String(params.timestamp).length <= 10 ? 1000 : 1)
        : Date.now();
      const createdAt = new Date(tsMs).toISOString();
      const { error: msgErr } = await sb
        .from("whatsapp_ticket_messages")
        .insert({
          ticket_id: ticketId,
          sender_type: "operator",
          sender_name: "Chatgoo",
          message_type: safeType,
          content,
          media_url: params.mediaUrl || null,
          media_mime_type: params.mediaMime || null,
          created_at: createdAt,
          metadata: {
            source: params.source,
            meta_message_id: params.messageId || null,
          },
        });
      if (msgErr) {
        console.error("[CAPTURE_ECHO_MSG_ERR]", msgErr);
        return;
      }

      // 5) Update ticket last_message
      await sb.from("whatsapp_tickets")
        .update({
          last_message_at: createdAt,
          last_message: content.slice(0, 500),
          updated_at: new Date().toISOString(),
        })
        .eq("id", ticketId);

      console.log("[CAPTURE_ECHO_OK]", { phone, ticketId, source: params.source });
    } catch (err) {
      console.error("[CAPTURE_ECHO_UNHANDLED]", err);
    }
  })();
}

// Fluxo de agendamento liberado para todos os usuários do WhatsApp /sindicato.
const isBookingWhitelisted = (_phone: string) => true;

// =====================================================================
// Mirror do webhook WABA → Chatgoo (apisistema.chatgoo.app)
// O Chatgoo recebe uma cópia idêntica do payload Meta para sincronizar
// templates, status e mensagens. Fire-and-forget: nunca bloqueia a
// resposta ao Meta (precisa retornar 200 em <5s).
// =====================================================================
const CHATGOO_WEBHOOK_URL = Deno.env.get("CHATGOO_WEBHOOK_URL")
  || "https://apisistema.chatgoo.app/waba-webhook/2";
const CHATGOO_WEBHOOK_TOKEN = Deno.env.get("CHATGOO_WEBHOOK_TOKEN")
  || "AORpxXNEBtdxyZeq31xSInEo4UU7jn";

function mirrorToChatgoo(rawBody: any, originalHeaders: Headers) {
  if (!CHATGOO_WEBHOOK_URL) return;

  // Espelhar TODOS os payloads para o Chatgoo. Como o parser do Chatgoo
  // não entende `type: "button"` (resposta a botão de template) nem
  // `type: "interactive"`, sintetizamos uma mensagem de texto equivalente
  // para que o bubble apareça com o texto da escolha do usuário.
  let bodyToSend = rawBody;
  try {
    bodyToSend = transformInteractiveToText(rawBody);
  } catch (_) {
    bodyToSend = rawBody;
  }

  // Fire-and-forget: não aguardamos a resposta para não atrasar o Meta.
  (async () => {
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${CHATGOO_WEBHOOK_TOKEN}`,
        "X-Hub-Signature-256": originalHeaders.get("x-hub-signature-256") || "",
        "X-Webhook-Token": CHATGOO_WEBHOOK_TOKEN,
      };
      const res = await fetch(CHATGOO_WEBHOOK_URL, {
        method: "POST",
        headers,
        body: JSON.stringify(bodyToSend),
      });
      console.log(`[CHATGOO_MIRROR] ${res.status}`);
    } catch (err) {
      console.error("[CHATGOO_MIRROR_ERROR]", err);
    }
  })();
}

// Converte respostas de botão / interactive em mensagens type=text para o Chatgoo
function transformInteractiveToText(rawBody: any): any {
  if (!rawBody?.entry) return rawBody;
  const clone = JSON.parse(JSON.stringify(rawBody));
  for (const entry of clone.entry || []) {
    for (const change of entry.changes || []) {
      const messages = change?.value?.messages;
      if (!Array.isArray(messages)) continue;
      for (const msg of messages) {
        if (msg.type === "button" && msg.button) {
          const txt = msg.button.text || msg.button.payload || "[botão]";
          msg.type = "text";
          msg.text = { body: `🔘 ${txt}` };
        } else if (msg.type === "interactive" && msg.interactive) {
          const br = msg.interactive.button_reply;
          const lr = msg.interactive.list_reply;
          const txt = br?.title || br?.id || lr?.title || lr?.id || "[interactive]";
          msg.type = "text";
          msg.text = { body: `🔘 ${txt}` };
        }
      }
    }
  }
  return clone;
}

// =====================================================================
// Espelha mensagens ENVIADAS pelo bot (menus de botões, listas, textos)
// para o Chatgoo, sintetizando um payload no formato WABA com o número
// do bot como `from` para que o Chatgoo exiba o histórico completo do
// fluxo (menu enviado + clique do usuário).
// =====================================================================
async function mirrorOutgoingToChatgoo(params: {
  to: string;
  phoneId: string;
  displayPhone: string;
  payload: any;
  metaResponse?: any;
}) {
  if (!CHATGOO_WEBHOOK_URL) return;
  const { to, phoneId, displayPhone, payload, metaResponse } = params;

  const messageId = metaResponse?.messages?.[0]?.id
    || `synthetic.outgoing.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
  const ts = Math.floor(Date.now() / 1000).toString();

  // Monta um message object compatível com a estrutura WABA
  const outgoingMessage: any = {
    // O Chatgoo usa `messages[].from` para decidir em qual contato/ticket
    // colocar a mensagem. Se enviarmos `from` como número oficial, o espelho
    // cai no contato do próprio sindicato e o operador não vê no atendimento
    // do associado. Por isso, no espelho para Chatgoo usamos o número do
    // associado como `from` e marcamos `_outgoing_echo` para não reprocessar.
    from: to,
    to: displayPhone,
    id: messageId,
    timestamp: ts,
    _outgoing_echo: true, // marca para Chatgoo identificar e NÃO auto-responder
  };

  if (payload?.type === "interactive") {
    outgoingMessage.type = "interactive";
    outgoingMessage.interactive = payload.interactive;
  } else if (payload?.type === "text") {
    outgoingMessage.type = "text";
    outgoingMessage.text = payload.text;
  } else if (payload?.type === "template") {
    outgoingMessage.type = "template";
    outgoingMessage.template = payload.template;
  } else if (payload?.type === "document") {
    outgoingMessage.type = "document";
    outgoingMessage.document = payload.document;
  } else if (payload?.type === "image") {
    outgoingMessage.type = "image";
    outgoingMessage.image = payload.image;
  } else {
    outgoingMessage.type = payload?.type || "unknown";
    outgoingMessage.raw = payload;
  }

  const synthetic = {
    object: "whatsapp_business_account",
    entry: [{
      id: Deno.env.get("META_WABA_ID") || "0",
      changes: [{
        value: {
          messaging_product: "whatsapp",
          metadata: {
            display_phone_number: displayPhone,
            phone_number_id: phoneId,
          },
          _outgoing_echo: true,
          contacts: [{ wa_id: to, profile: { name: "Associado" } }],
          messages: [outgoingMessage],
        },
        field: "messages",
      }],
    }],
  };

  const mirrorTasks: Promise<void>[] = [];

  mirrorTasks.push((async () => {
    try {
      const res = await fetch(CHATGOO_WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${CHATGOO_WEBHOOK_TOKEN}`,
          "X-Webhook-Token": CHATGOO_WEBHOOK_TOKEN,
          "X-Outgoing-Echo": "true",
        },
        body: JSON.stringify(synthetic),
      });
      const responseText = await res.text();
      console.log(`[CHATGOO_MIRROR_OUT] ${res.status} ${responseText.slice(0, 300)}`);
    } catch (err) {
      console.error("[CHATGOO_MIRROR_OUT_ERROR]", err);
    }
  })());

  // ========= ESPELHO DE TEXTO COMPLEMENTAR PARA INTERATIVOS =========
  // O Chatgoo não renderiza o corpo de mensagens "interactive" (botões/listas),
  // então o operador não vê o link do boleto, instruções etc. Aqui enviamos
  // um segundo evento, agora como text/plain, contendo:
  //   - cabeçalho (se houver)
  //   - corpo (body.text) — onde fica o link do boleto
  //   - rodapé (se houver)
  //   - rótulos das opções (botões ou itens da lista)
  if (payload?.type === "interactive") {
    try {
      const itx = payload.interactive || {};
      const headerText = itx?.header?.text || "";
      const bodyText = itx?.body?.text || "";
      const footerText = itx?.footer?.text || "";

      const optionLines: string[] = [];
      if (itx?.type === "button" && Array.isArray(itx?.action?.buttons)) {
        for (const b of itx.action.buttons) {
          const t = b?.reply?.title;
          if (t) optionLines.push(`▫️ ${t}`);
        }
      } else if (itx?.type === "list" && Array.isArray(itx?.action?.sections)) {
        for (const sec of itx.action.sections) {
          for (const row of (sec?.rows || [])) {
            if (row?.title) optionLines.push(`▫️ ${row.title}`);
          }
        }
      }

      const compositeText = [
        headerText,
        bodyText,
        optionLines.length ? `\n*Opções:*\n${optionLines.join("\n")}` : "",
        footerText,
      ].filter(Boolean).join("\n").trim();

      if (compositeText) {
        const textMessageId = `synthetic.outgoing.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.txt`;
        const textSynthetic = {
          object: "whatsapp_business_account",
          entry: [{
            id: Deno.env.get("META_WABA_ID") || "0",
            changes: [{
              value: {
                messaging_product: "whatsapp",
                metadata: {
                  display_phone_number: displayPhone,
                  phone_number_id: phoneId,
                },
                _outgoing_echo: true,
                contacts: [{ wa_id: to, profile: { name: "Associado" } }],
                messages: [{
                  from: to,
                  to: displayPhone,
                  id: textMessageId,
                  timestamp: ts,
                  _outgoing_echo: true,
                  type: "text",
                  text: { body: compositeText },
                }],
              },
              field: "messages",
            }],
          }],
        };
        mirrorTasks.push((async () => {
          try {
            const res = await fetch(CHATGOO_WEBHOOK_URL, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${CHATGOO_WEBHOOK_TOKEN}`,
                "X-Webhook-Token": CHATGOO_WEBHOOK_TOKEN,
                "X-Outgoing-Echo": "true",
              },
              body: JSON.stringify(textSynthetic),
            });
            const responseText = await res.text();
            console.log(`[CHATGOO_MIRROR_OUT_TXT] ${res.status} ${responseText.slice(0, 300)}`);
          } catch (err) {
            console.error("[CHATGOO_MIRROR_OUT_TXT_ERROR]", err);
          }
        })());
      }
    } catch (err) {
      console.error("[CHATGOO_MIRROR_TEXT_BUILD_ERROR]", err);
    }
  }

  await Promise.allSettled(mirrorTasks);
}

const SUPPORT_START_MINUTES = 9 * 60;
const SUPPORT_END_MINUTES = 16 * 60;

function calculateEaster(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function getNationalHolidayName(year: number, month: number, day: number): string | null {
  const fixed = [
    { name: "Confraternização Universal", m: 1, d: 1 },
    { name: "Tiradentes", m: 4, d: 21 },
    { name: "Dia do Trabalho", m: 5, d: 1 },
    { name: "Independência do Brasil", m: 9, d: 7 },
    { name: "Nossa Senhora Aparecida", m: 10, d: 12 },
    { name: "Finados", m: 11, d: 2 },
    { name: "Proclamação da República", m: 11, d: 15 },
    { name: "Natal", m: 12, d: 25 },
  ];
  for (const holiday of fixed) if (holiday.m === month && holiday.d === day) return holiday.name;

  const easter = calculateEaster(year);
  const check = (offset: number, name: string) => {
    const d = new Date(year, easter.getMonth(), easter.getDate() + offset);
    return month === d.getMonth() + 1 && day === d.getDate() ? name : null;
  };
  return check(-2, "Sexta-feira Santa") || check(-47, "Carnaval") || check(0, "Páscoa") || check(60, "Corpus Christi") || null;
}

function getBrazilianDateTime() {
  const now = new Date();
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const time = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
  const dayName = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long' }).format(now);
  const dayShort = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short' }).format(now);
  const dayOfWeek = ({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 } as Record<string, number>)[dayShort] ?? 0;
  const [hour, minute] = time.split(':').map(Number);
  const totalMinutes = hour * 60 + minute;
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
  const isBusinessHours = isWeekday && totalMinutes >= SUPPORT_START_MINUTES && totalMinutes < SUPPORT_END_MINUTES;
  return { date, time, dayName, isWeekday, isBusinessHours };
}

async function getHumanSupportStatus(supabase: any) {
  const br = getBrazilianDateTime();
  const [year, month, day] = br.date.split('-').map(Number);
  const nationalHoliday = getNationalHolidayName(year, month, day);
  const { data: clinicHolidays } = await supabase
    .from('clinic_holidays')
    .select('name')
    .eq('clinic_id', SINDICATO_CLINIC_ID)
    .or(`holiday_date.eq.${br.date},and(is_recurring.eq.true,recurring_month.eq.${month},recurring_day.eq.${day})`);
  const holidayName = nationalHoliday || clinicHolidays?.[0]?.name || null;
  const available = br.isBusinessHours && !holidayName;
  const reason = holidayName ? `feriado (${holidayName})` : !br.isWeekday ? 'fim de semana' : !br.isBusinessHours ? 'fora do horário de atendimento' : '';
  return { ...br, available, reason };
}

const unavailableSupportMessage = (reason: string) =>
  `Nosso atendimento humano está indisponível no momento${reason ? `: ${reason}` : ''}.\n\n` +
  `O atendimento humano funciona de *segunda a sexta-feira, das 09h às 16h*, exceto feriados.\n\n` +
  `Posso ajudar por aqui como assistente virtual. Se preferir, envie seu assunto que deixaremos registrado para retorno assim que o atendimento estiver disponível. 📋`;

// ---------- HELPERS: Menu Principal sempre disponível ----------
// Garante que toda mensagem ofereça uma forma rápida de voltar ao menu principal,
// inclusive em mensagens de texto, erros e opções inválidas.
const MENU_BUTTON = { type: "reply", reply: { id: "menu_principal", title: "Menu Principal" } } as const;
const MENU_LIST_ROW = { id: "menu_principal", title: "Menu Principal", description: "Voltar ao início" } as const;

function withMenuTextPayload(text: string) {
  return {
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: (text || "").slice(0, 1024) },
      action: { buttons: [MENU_BUTTON] },
    },
  };
}

function withMenuButtonsPayload(text: string, buttons: Array<{ id: string; title: string }>) {
  // Limite WhatsApp: 3 botões reply no total. Reservamos 1 para "Menu Principal".
  const usable = buttons.slice(0, 2);
  const final = [
    ...usable.map((b) => ({ type: "reply", reply: { id: b.id, title: (b.title || "").slice(0, 20) } })),
    MENU_BUTTON,
  ];
  return {
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: (text || "").slice(0, 1024) },
      action: { buttons: final },
    },
  };
}

function withMenuListPayload(
  text: string,
  sectionTitle: string,
  rows: Array<{ id: string; title: string; description?: string }>,
) {
  // Meta WhatsApp limita o TOTAL de rows (somando todas as sections) a 10.
  // Reservamos 1 slot para a row "Menu Principal" da seção Navegação.
  const deduped = rows.filter((r) => r.id !== MENU_LIST_ROW.id);
  const truncated = deduped.slice(0, 9).map((r) => ({
    id: r.id,
    title: (r.title || "").slice(0, 24),
    ...(r.description ? { description: (r.description || "").slice(0, 72) } : {}),
  }));
  return {
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: (text || "").slice(0, 1024) },
      action: {
        button: "Escolher",
        sections: [
          { title: (sectionTitle || "Opções").slice(0, 24), rows: truncated },
          { title: "Navegação", rows: [MENU_LIST_ROW] },
        ],
      },
    },
  };
}

function mainMenuPayload() {
  return {
    type: "interactive",
    interactive: {
      type: "button",
      header: { type: "text", text: "Sindicato dos Comerciários" },
      body: { text: "Olá! Bem-vindo ao nosso canal oficial. Como podemos ajudar hoje? Escolha uma opção abaixo:" },
      footer: { text: "Atendimento Automático" },
      action: {
        buttons: [
          { type: "reply", reply: { id: "whazing_associado", title: "Sou Associado" } },
          { type: "reply", reply: { id: "whazing_empresa", title: "Sou Empresa" } },
          { type: "reply", reply: { id: "whazing_contabilidade", title: "Contabilidade" } },
        ],
      },
    },
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Verification for Meta Webhook setup
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe") {
      return new Response(challenge ?? "", { status: 200 });
    }
    return new Response("OK", { status: 200 });
  }

  try {
    // Validar assinatura HMAC da Meta antes de parsear/processar.
    // Quando META_APP_SECRET está configurado, a assinatura é OBRIGATÓRIA.
    const appSecret = Deno.env.get("META_APP_SECRET");
    const rawBody = await req.text();
    if (appSecret) {
      const sigHeader = req.headers.get("x-hub-signature-256") || req.headers.get("X-Hub-Signature-256");
      if (!sigHeader || !sigHeader.startsWith("sha256=")) {
        console.error("[meta-webhook] missing x-hub-signature-256");
        return new Response("Unauthorized", { status: 401, headers: corsHeaders });
      }
      try {
        const key = await crypto.subtle.importKey(
          "raw",
          new TextEncoder().encode(appSecret),
          { name: "HMAC", hash: "SHA-256" },
          false,
          ["sign"],
        );
        const macBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
        const expected = "sha256=" + Array.from(new Uint8Array(macBuf))
          .map(b => b.toString(16).padStart(2, "0")).join("");
        if (expected.length !== sigHeader.length) {
          console.error("[meta-webhook] signature length mismatch");
          return new Response("Unauthorized", { status: 401, headers: corsHeaders });
        }
        let diff = 0;
        for (let i = 0; i < expected.length; i++) {
          diff |= expected.charCodeAt(i) ^ sigHeader.charCodeAt(i);
        }
        if (diff !== 0) {
          console.error("[meta-webhook] invalid signature");
          return new Response("Unauthorized", { status: 401, headers: corsHeaders });
        }
      } catch (e) {
        console.error("[meta-webhook] signature verification error", e);
        return new Response("Unauthorized", { status: 401, headers: corsHeaders });
      }
    } else {
      console.warn("[meta-webhook] META_APP_SECRET not configured — signature verification SKIPPED");
    }
    let body = JSON.parse(rawBody);
    console.log('[WEBHOOK_ENTRY] Meta Webhook');
    console.log('[RAW_PAYLOAD]', JSON.stringify(body, null, 2));

    // ============ DETECÇÃO DE PAYLOAD ENCAPSULADO DO CHATGOO ============
    // O Chatgoo pode estar configurado para postar de volta no nosso webhook,
    // enviando um envelope próprio ({messageId, messageBody, dataJson, fromMe,
    // sendType, ticket, contact, whatsapp}) em vez do formato Meta padrão
    // ({object: "whatsapp_business_account", entry:[...]}). Quando isso
    // acontece, o parser nativo falha (entry undefined) e o menu nunca é
    // enviado. Aqui detectamos e desembrulhamos.
    const isChatgooEnvelope =
      !body?.object &&
      !body?.entry &&
      (body?.dataJson !== undefined ||
        body?.messageBody !== undefined ||
        body?.Type !== undefined);

    if (isChatgooEnvelope) {
      // 1) Mensagens fromMe=true são ECOS do bot/atendente humano voltando
      //    para nós via Chatgoo. Não devem disparar processamento de fluxo
      //    nem ser re-espelhadas (evita loop infinito de mirror).
      if (body?.fromMe === true) {
        console.log('[CHATGOO_LOOPBACK_IGNORED] fromMe=true');
        // Captura ECO do Chatgoo (campanha/atendimento manual disparado
        // pelo painel) para o histórico do ticket. Não reprocessa fluxo.
        try {
          captureOutgoingEcho({
            source: "chatgoo_envelope",
            phone: body?.contact?.phoneNumber || body?.contact?.number || null,
            contactName: body?.contact?.name || body?.contact?.pushname || null,
            text: body?.messageBody || null,
            mediaUrl: body?.mediaUrl || null,
            mediaMime: null,
            messageType: (body?.mediaType === "chat" || !body?.mediaType) ? "text" : body.mediaType,
            messageId: body?.messageId || null,
            timestamp: body?.timestamp || null,
          });
        } catch (capErr) {
          console.error("[CHATGOO_LOOPBACK_CAPTURE_ERR]", capErr);
        }
        return new Response(JSON.stringify({ ok: true, ignored: 'chatgoo_loopback' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      // 2) Tenta desembrulhar dataJson (string JSON com o payload Meta original).
      try {
        if (typeof body?.dataJson === 'string' && body.dataJson.trim().startsWith('{')) {
          const inner = JSON.parse(body.dataJson);
          if (inner?.object === 'whatsapp_business_account' && inner?.entry) {
            console.log('[CHATGOO_UNWRAPPED] usando dataJson como payload Meta');
            body = inner;
          }
        }
      } catch (unwrapErr) {
        console.error('[CHATGOO_UNWRAP_ERROR]', unwrapErr);
      }

      // 3) Se mesmo após desembrulhar não temos formato Meta, ignora
      //    silenciosamente (evento de sistema do Chatgoo, ex: NewTicket).
      if (!body?.object || !body?.entry) {
        console.log('[CHATGOO_SYSTEM_EVENT_IGNORED]');
        return new Response(JSON.stringify({ ok: true, ignored: 'chatgoo_system_event' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      // 4) Se o payload desembrulhado é um ECO de saída (mirror que nós mesmos
      //    enviamos antes para o Chatgoo), NÃO reprocessar — caso contrário o
      //    bot tenta responder à própria mensagem e a Meta retorna #100
      //    Invalid parameter (from == to == número oficial).
      try {
        const _v = body?.entry?.[0]?.changes?.[0]?.value;
        const _msg = _v?.messages?.[0];
        const isOutgoingEcho =
          _v?._outgoing_echo === true ||
          _msg?._outgoing_echo === true ||
          (typeof _msg?.id === 'string' && _msg.id.startsWith('synthetic.outgoing.')) ||
          (_msg?.from && _v?.metadata?.display_phone_number &&
            String(_msg.from).replace(/\D/g, '') ===
              String(_v.metadata.display_phone_number).replace(/\D/g, ''));
        if (isOutgoingEcho) {
          console.log('[CHATGOO_OUTGOING_ECHO_IGNORED]');
          // Captura eco no formato Meta para o histórico do ticket.
          try {
            const _to = _msg?.to || _v?.contacts?.[0]?.wa_id || null;
            const _text = _msg?.text?.body
              || (_msg?.type === "template" ? `[Template: ${_msg?.template?.name || ""}]` : null)
              || _msg?.interactive?.body?.text
              || null;
            const _media = _msg?.image?.link || _msg?.document?.link
              || _msg?.video?.link || _msg?.audio?.link || null;
            captureOutgoingEcho({
              source: "meta_echo",
              phone: _to,
              contactName: _v?.contacts?.[0]?.profile?.name || null,
              text: _text,
              mediaUrl: _media,
              mediaMime: _msg?.document?.mime_type || _msg?.image?.mime_type || null,
              messageType: _msg?.type || "text",
              messageId: _msg?.id || null,
              timestamp: _msg?.timestamp || null,
            });
          } catch (capErr) {
            console.error("[META_ECHO_CAPTURE_ERR]", capErr);
          }
          return new Response(JSON.stringify({ ok: true, ignored: 'outgoing_echo' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          });
        }
      } catch (_) { /* noop */ }
    }

    // Espelha o payload para o Chatgoo (fire-and-forget). Só espelha payloads
    // genuínos da Meta — nunca os que já vieram do próprio Chatgoo.
    if (!isChatgooEnvelope) {
      mirrorToChatgoo(body, req.headers);
    }

    // Minimalist Parser
    const entry = body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    
    // Registrar status de entrega da Meta (sent/delivered/read/failed) para evitar falso positivo.
    if (value?.statuses) {
      console.log('[STATUS_UPDATE] Meta status update');
      try {
        const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
        const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

        for (const status of value.statuses || []) {
          const recipient = String(status.recipient_id || '').replace(/\D/g, '');
          const { error: insertStatusError } = await supabase.from('whatsapp_audit_logs').insert({
            phone: recipient || 'unknown',
            direction: 'status',
            content: status.status || null,
            message_type: 'meta_status',
            metadata: {
              provider: 'meta_official',
              status_event: true,
              message_id: status.id || null,
              status: status.status || null,
              recipient_id: status.recipient_id || null,
              timestamp: status.timestamp || null,
              errors: status.errors || null,
              raw_payload: body,
            },
          });

          if (insertStatusError) {
            console.error('[STATUS_LOG_INSERT_ERROR]', insertStatusError);
          }
        }
      } catch (statusLogErr) {
        console.error('[STATUS_LOG_ERROR]', statusLogErr);
      }
      return new Response("ok", { status: 200 });
    }

    const messageObj = value?.messages?.[0] || body.message || {};
    const from = (body.wa_id || body.phone || messageObj.from || "").toString().replace(/\D/g, "");
    
    const extractedButtonId = messageObj.interactive?.button_reply?.id || 
                             messageObj.interactive?.list_reply?.id || 
                             messageObj.button?.payload || 
                             messageObj.buttonId || 
                             null;
                             
    const extractedButtonTitle = messageObj.interactive?.button_reply?.title || 
                                messageObj.interactive?.list_reply?.title || 
                                messageObj.button?.text || 
                                messageObj.buttonText || 
                                null;
    const text = (messageObj.text?.body || messageObj.conversation || "").toString().trim();

    console.log('[BUTTON_ID]', extractedButtonId);
    console.log('[BUTTON_TITLE]', extractedButtonTitle);

    if (!from) {
      return new Response(JSON.stringify({ ok: true, reason: "no phone" }), { status: 200 });
    }

    const META_TOKEN = Deno.env.get('META_WHATSAPP_TOKEN');
    const PHONE_ID = value?.metadata?.phone_number_id || Deno.env.get("META_PHONE_NUMBER_ID");
    const to = from.startsWith('55') ? from : `55${from}`;

    const sendResponse = async (payload: any) => {
      const url = `https://graph.facebook.com/v21.0/${PHONE_ID}/messages`;
      console.log('[SENDING_TO]', url);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${META_TOKEN}`, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          ...payload
        }),
      });
      const result = await res.text();
      console.log('[MESSAGE_SENT]', result);
      // Espelha a mensagem ENVIADA (menu de botões, listas, textos) para o Chatgoo,
      // para que o painel mostre o fluxo completo: bot → usuário e usuário → bot.
      try {
        let parsed: any = null;
        try { parsed = JSON.parse(result); } catch { /* ignore */ }
        await mirrorOutgoingToChatgoo({
          to,
          phoneId: String(PHONE_ID || ''),
          displayPhone: String(value?.metadata?.display_phone_number || ''),
          payload,
          metaResponse: parsed,
        });
      } catch (err) {
        console.error('[MIRROR_OUT_WRAP_ERROR]', err);
      }
      return result;
    };

    // Log the incoming message
    try {
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await supabase.from('whatsapp_incoming_logs').insert({
        phone: to,
        message_text: text || `[Button: ${extractedButtonTitle || extractedButtonId}]`,
        raw_payload: body,
        processed: true,
        processed_action: extractedButtonId ? `button_${extractedButtonId}` : 'text_message'
      });
    } catch (logErr) {
      console.error('[LOG_ERROR]', logErr);
    }

    // ============ FLUXOS DE AGENDAMENTO / CANCELAMENTO (BETA - WHITELIST) ============
    // Delega para edge functions dedicadas que implementam todas as regras de negócio.
    try {
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      // ============ FLUXO CARTEIRINHA (renovação via WhatsApp) ============
      // Trata os botões novos (App / WhatsApp / Cancelar) e roteia
      // mensagens (texto/mídia) quando há sessão action_type='carteirinha'.
      try {
        const isCartImage = messageObj.type === "image" && !!messageObj.image?.id;
        const isCartDoc = messageObj.type === "document" && !!messageObj.document?.id;
        const cartMediaId = messageObj.image?.id || messageObj.document?.id || null;
        const cartMediaMime = messageObj.image?.mime_type || messageObj.document?.mime_type || null;
        const cartMediaName = messageObj.document?.filename || null;

        const callCarteirinha = async (payload: Record<string, unknown>) => {
          const r = await fetch(
            `${Deno.env.get("SUPABASE_URL")}/functions/v1/whatsapp-carteirinha-flow`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              },
              body: JSON.stringify({ phone: from, ...payload }),
            },
          );
          return await r.json().catch(() => ({ success: false, response: "Erro." }));
        };

        const respondCart = async (d: any) => {
          const buttons = Array.isArray(d?.buttons) ? d.buttons : [];
          if (buttons.length > 0) {
            await sendResponse(withMenuButtonsPayload(d.response, buttons));
          } else {
            await sendResponse(withMenuTextPayload(d.response));
          }
        };

        // Botão "Atualizar Carteira" → escolha App vs WhatsApp
        if (extractedButtonId === "whazing_sub_carteirinha") {
          await sendResponse({
            type: "interactive",
            interactive: {
              type: "button",
              body: {
                text:
                  "🪪 *Atualizar Carteirinha*\n\n" +
                  "Como você prefere atualizar sua carteirinha hoje?\n\n" +
                  "• *Pelo WhatsApp*: o mais rápido! Digite seu CPF e envie a foto do contracheque\n" +
                  "• *Pelo App*: envie pelo app e aguarde a validação do sindicato",
              },
              action: {
                buttons: [
                  { type: "reply", reply: { id: "carteirinha_app", title: "Pelo App" } },
                  { type: "reply", reply: { id: "carteirinha_whats", title: "Pelo WhatsApp" } },
                  { type: "reply", reply: { id: "menu_principal", title: "Menu Principal" } },
                ],
              },
            },
          });
          return new Response(JSON.stringify({ ok: true, action: "carteirinha_choice" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Escolheu "Pelo App"
        if (extractedButtonId === "carteirinha_app") {
          const playUrl = "https://play.google.com/store/apps/details?id=br.org.secmi.comerciariosilheus.app";
          await sendResponse({
            type: "interactive",
            interactive: {
              type: "cta_url",
              header: { type: "text", text: "Atualizar pelo App" },
              body: {
                text:
                  "📱 No app você atualiza sua carteirinha em 1 minuto:\n\n" +
                  "1. Toque em *Abrir App* abaixo\n" +
                  "2. Faça login com seu CPF\n" +
                  "3. Vá em *Carteirinha* → *Renovar*\n" +
                  "4. Tire foto do contracheque\n\n" +
                  "Pronto! Atualização automática.",
              },
              footer: { text: "Disponível para Android" },
              action: {
                name: "cta_url",
                parameters: { display_text: "Abrir App", url: playUrl },
              },
            },
          });
          await sendResponse(withMenuTextPayload("Posso ajudar com mais alguma coisa?"));
          return new Response(JSON.stringify({ ok: true, action: "carteirinha_app" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Escolheu "Pelo WhatsApp" → inicia fluxo
        if (extractedButtonId === "carteirinha_whats") {
          const d = await callCarteirinha({ action: "start" });
          await respondCart(d);
          return new Response(JSON.stringify({ ok: true, action: "carteirinha_start" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Cancelar fluxo carteirinha
        if (extractedButtonId === "carteirinha_cancelar") {
          const d = await callCarteirinha({ action: "cancel" });
          await sendResponse(withMenuTextPayload(d.response));
          return new Response(JSON.stringify({ ok: true, action: "carteirinha_cancel" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Sessão ativa? roteia texto/mídia
        const { data: activeCartSession } = await supabase
          .from("whatsapp_booking_sessions")
          .select("id, state")
          .eq("clinic_id", SINDICATO_CLINIC_ID)
          .eq("phone", from)
          .eq("action_type", "carteirinha")
          .gte("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (activeCartSession) {
          if (isCartImage || isCartDoc) {
            const d = await callCarteirinha({
              action: "media",
              media_id: cartMediaId,
              media_mime: cartMediaMime,
              media_filename: cartMediaName,
            });
            await respondCart(d);
            return new Response(JSON.stringify({ ok: true, action: "carteirinha_media" }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          if (text && !extractedButtonId) {
            const d = await callCarteirinha({ action: "text", text });
            await respondCart(d);
            return new Response(JSON.stringify({ ok: true, action: "carteirinha_text" }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
      } catch (cartErr) {
        console.error("[CARTEIRINHA_FLOW_ERROR]", cartErr);
      }
      // ============ FIM FLUXO CARTEIRINHA ============

      const isAgendarConsultaTrigger =
        extractedButtonId === "agendar_consulta" ||
        /\b(agendar consulta|marcar consulta|agendamento de consulta|consulta médica|consulta medica)\b/i.test(text);

      const isCancelarConsultaTrigger =
        extractedButtonId === "cancelar_consulta" ||
        /\b(cancelar|desmarcar)\s+(a\s+|minha\s+|uma\s+)?consulta\b/i.test(text);

      const isDirectMenuRequest =
        extractedButtonId === "menu_principal" ||
        /\b(menu principal|menu|in[ií]cio|começar|comecar)\b/i.test(text);

      if (isDirectMenuRequest) {
        await supabase
          .from("whatsapp_booking_sessions")
          .delete()
          .eq("clinic_id", SINDICATO_CLINIC_ID)
          .eq("phone", from)
          .neq("state", "FINISHED");

        await sendResponse(mainMenuPayload());
        return new Response(JSON.stringify({ ok: true, action: "main_menu" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ---------- EXPIRAÇÃO DE SESSÃO ----------
      // Detecta sessões abandonadas (expires_at < now) e avisa o usuário.
      const nowIso = new Date().toISOString();
      const { data: expiredSessions } = await supabase
        .from("whatsapp_booking_sessions")
        .select("id, action_type")
        .eq("clinic_id", SINDICATO_CLINIC_ID)
        .eq("phone", from)
        .neq("state", "FINISHED")
        .lt("expires_at", nowIso);

      if (expiredSessions && expiredSessions.length > 0) {
        const wasCancel = expiredSessions.some((s: any) => s.action_type === "cancel");
        await supabase
          .from("whatsapp_booking_sessions")
          .delete()
          .in("id", expiredSessions.map((s: any) => s.id));

        // Se o usuário está iniciando explicitamente um novo fluxo, segue sem avisar.
        const isRestartingFlow = isAgendarConsultaTrigger || isCancelarConsultaTrigger;
        if (!isRestartingFlow) {
          const motivo = wasCancel ? "cancelamento" : "agendamento";
          await sendResponse({
            type: "interactive",
            interactive: {
              type: "button",
              body: {
                text:
                  `⏱️ Sua sessão de *${motivo}* expirou por inatividade.\n\n` +
                  `Vamos recomeçar do início. Toque em uma opção:`,
              },
              action: {
                buttons: [
                  { type: "reply", reply: { id: "agendar_consulta", title: "Agendar Consulta" } },
                  { type: "reply", reply: { id: "cancelar_consulta", title: "Cancelar Consulta" } },
                  { type: "reply", reply: { id: "menu_principal", title: "Menu Principal" } },
                ],
              },
            },
          });
          return new Response(
            JSON.stringify({ ok: true, action: "session_expired", flow: motivo }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }

      // Sessão ativa do fluxo de cancelamento (action_type='cancel')
      const { data: activeCancelSession } = await supabase
        .from("whatsapp_booking_sessions")
        .select("id, state, action_type")
        .eq("clinic_id", SINDICATO_CLINIC_ID)
        .eq("phone", from)
        .eq("action_type", "cancel")
        .neq("state", "FINISHED")
        .gte("expires_at", nowIso)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Sessão ativa do fluxo de agendamento (sem action_type)
      const { data: activeBookingSession } = await supabase
        .from("whatsapp_booking_sessions")
        .select("id, state, action_type")
        .eq("clinic_id", SINDICATO_CLINIC_ID)
        .eq("phone", from)
        .is("action_type", null)
        .neq("state", "FINISHED")
        .gte("expires_at", nowIso)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const isBookingButton =
        typeof extractedButtonId === "string" && extractedButtonId.startsWith("book_");

      const shouldEnterCancelFlow =
        isBookingWhitelisted(from) &&
        (isCancelarConsultaTrigger || !!activeCancelSession);

      const shouldEnterBookingFlow =
        !shouldEnterCancelFlow &&
        isBookingWhitelisted(from) &&
        (isAgendarConsultaTrigger || !!activeBookingSession || isBookingButton);

      // ---------- CANCELAMENTO ----------
      if (shouldEnterCancelFlow) {
        console.log("[CANCEL_FLOW] Forwarding to cancel-appointment-chat", {
          from, hasSession: !!activeCancelSession, trigger: isCancelarConsultaTrigger, isBookingButton,
        });

        const messageToForward = isCancelarConsultaTrigger && !activeCancelSession
          ? ""
          : isBookingButton
            ? extractedButtonId!.replace(/^book_/, "")
            : (text || "");

        const cancelRes = await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/cancel-appointment-chat`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({
              clinic_id: SINDICATO_CLINIC_ID,
              phone: from,
              message: messageToForward,
            }),
          }
        );
        const cancelData = await cancelRes.json();
        const replyText: string = cancelData?.response || "Não consegui processar o cancelamento.";
        const replyState: string | undefined = cancelData?.state;

        const { data: updatedSession } = await supabase
          .from("whatsapp_booking_sessions")
          .select("*")
          .eq("clinic_id", SINDICATO_CLINIC_ID)
          .eq("phone", from)
          .eq("action_type", "cancel")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const stripNumberedList = (txt: string) =>
          txt.split("\n").filter((l) => !/^\s*\d+\s*-\s+/.test(l)).join("\n").replace(/\n{3,}/g, "\n\n").trim();
        const truncate = (s: string, n: number) =>
          (s || "").length > n ? (s || "").slice(0, n - 1) + "…" : (s || "");

        type Opt = { id: string; title: string; description?: string };
        let options: Opt[] = [];
        let listSectionTitle = "Opções";
        const sess: any = updatedSession || {};

        switch (replyState) {
          case "CANCEL_CONFIRM_IDENTITY":
            options = [
              { id: "book_1", title: "Confirmar" },
              { id: "book_2", title: "Não sou eu" },
            ];
            break;
          case "CANCEL_SELECT_APPT": {
            const list = Array.isArray(sess.appointments_list) ? sess.appointments_list : [];
            const WD = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
            options = list.slice(0, 10).map((a: any, i: number) => {
              const [y, m, d] = String(a.date).split("-");
              const wd = WD[new Date(`${y}-${m}-${d}T12:00:00`).getDay()] || "";
              const who = a.beneficiary ? `Dep: ${a.beneficiary}` : "Titular";
              const title = truncate(`${i + 1}. ${d}/${m} ${wd} ${a.time}`, 24);
              const desc = truncate(
                `${who} • ${a.professional_name || "Profissional"}`,
                72,
              );
              return { id: `book_${i + 1}`, title, description: desc };
            });
            listSectionTitle = "Consultas";
            break;
          }
          case "CANCEL_CONFIRM":
            options = [
              { id: "book_1", title: "Sim, cancelar" },
              { id: "book_2", title: "Não, manter" },
            ];
            break;
          default:
            options = [];
        }

        if (options.length === 0) {
          await sendResponse(withMenuTextPayload(replyText));
        } else if (options.length <= 2) {
          await sendResponse(
            withMenuButtonsPayload(stripNumberedList(replyText), options),
          );
        } else {
          await sendResponse(
            withMenuListPayload(
              replyState === "CANCEL_SELECT_APPT" ? replyText : stripNumberedList(replyText),
              listSectionTitle,
              options,
            ),
          );
        }

        return new Response(
          JSON.stringify({ ok: true, action: "cancel_flow", state: replyState, options: options.length }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (shouldEnterBookingFlow) {
        console.log("[BOOKING_FLOW] Forwarding to booking-web-chat", {
          from,
          hasSession: !!activeBookingSession,
          trigger: isAgendarConsultaTrigger,
          isBookingButton,
        });

        // Se acabou de iniciar, manda mensagem vazia para o web-chat exibir o prompt de CPF.
        // Se for clique em botão do fluxo, extrai o número (book_1 -> "1").
        const messageToForward = isAgendarConsultaTrigger && !activeBookingSession
          ? ""
          : isBookingButton
            ? extractedButtonId!.replace(/^book_/, "")
            : (text || "");

        const bookingRes = await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/booking-web-chat`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({
              clinic_id: SINDICATO_CLINIC_ID,
              phone: from,
              message: messageToForward,
            }),
          }
        );

        const bookingData = await bookingRes.json();
        const replyText =
          bookingData?.response ||
          "Desculpe, não consegui processar o agendamento. Tente novamente.";
        const replyState: string | undefined = bookingData?.state;

        // Carrega sessão atualizada para montar botões/listas a partir das opções disponíveis.
        const { data: updatedSession } = await supabase
          .from("whatsapp_booking_sessions")
          .select("*")
          .eq("clinic_id", SINDICATO_CLINIC_ID)
          .eq("phone", from)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        // Remove a lista numerada do texto (ex: "1 - Foo\n2 - Bar") quando vamos renderizar botões.
        const stripNumberedList = (txt: string) =>
          txt
            .split("\n")
            .filter((l) => !/^\s*\d+\s*-\s+/.test(l))
            .join("\n")
            .replace(/\n{3,}/g, "\n\n")
            .trim();

        const truncate = (s: string, n: number) =>
          (s || "").length > n ? (s || "").slice(0, n - 1) + "…" : (s || "");

        // Decide opções por state.
        type Opt = { id: string; title: string; description?: string };
        let options: Opt[] = [];
        let listSectionTitle = "Opções";

        const sess: any = updatedSession || {};
        switch (replyState) {
          case "CONFIRM_IDENTITY":
            options = [
              { id: "book_1", title: "Confirmar" },
              { id: "book_2", title: "Não sou eu" },
            ];
            break;
          case "SELECT_BOOKING_FOR":
            options = [
              { id: "book_1", title: "Para mim" },
              { id: "book_2", title: "Dependente" },
            ];
            break;
          case "SELECT_DEPENDENT": {
            const deps = Array.isArray(sess.available_dependents) ? sess.available_dependents : [];
            options = deps.slice(0, 10).map((d: any, i: number) => ({
              id: `book_${i + 1}`,
              title: truncate(d.name || `Dependente ${i + 1}`, 24),
            }));
            listSectionTitle = "Dependentes";
            break;
          }
          case "SELECT_PROFESSIONAL": {
            const pros = Array.isArray(sess.available_professionals) ? sess.available_professionals : [];
            options = pros.slice(0, 10).map((p: any, i: number) => {
              const name = p.name || `Profissional ${i + 1}`;
              const specialty = p.specialty || "";
              const titleWithSpecialty = (() => {
                if (!specialty || specialty === "Não informada") return name;
                const sep = " — ";
                const combined = name + sep + specialty;
                if (combined.length <= 24) return combined;
                const avail = 24 - name.length - sep.length;
                if (avail > 3) return name + sep + specialty.slice(0, avail - 1) + "…";
                return name;
              })();
              return {
                id: `book_${i + 1}`,
                title: truncate(titleWithSpecialty, 24),
                description: truncate(specialty || "", 72),
              };
            });
            listSectionTitle = "Profissionais";
            break;
          }
          case "SELECT_DATE": {
            const dates = Array.isArray(sess.available_dates) ? sess.available_dates : [];
            options = dates.slice(0, 10).map((d: any, i: number) => ({
              id: `book_${i + 1}`,
              title: truncate(`${d.formatted}`, 24),
              description: truncate(d.weekday || "", 72),
            }));
            listSectionTitle = "Datas";
            break;
          }
          case "SELECT_TIME": {
            const times = Array.isArray(sess.available_times) ? sess.available_times : [];
            options = times.slice(0, 10).map((t: any, i: number) => ({
              id: `book_${i + 1}`,
              title: truncate(t.formatted || t.time, 24),
            }));
            listSectionTitle = "Horários";
            break;
          }
          case "CONFIRM_APPOINTMENT":
            options = [
              { id: "book_1", title: "Confirmar" },
              { id: "book_2", title: "Cancelar" },
            ];
            break;
          default:
            options = [];
        }

        if (options.length === 0) {
          await sendResponse(withMenuTextPayload(replyText));
        } else if (options.length <= 2) {
          await sendResponse(
            withMenuButtonsPayload(stripNumberedList(replyText), options),
          );
        } else {
          await sendResponse(
            withMenuListPayload(stripNumberedList(replyText), listSectionTitle, options),
          );
        }

        return new Response(
          JSON.stringify({ ok: true, action: "booking_flow", state: replyState, options: options.length }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } catch (bookingErr) {
      console.error("[BOOKING_FLOW_ERROR]", bookingErr);
      // Em caso de erro, deixa cair no fluxo normal abaixo.
    }

    // Helper functions for phone matching
    const normalizeDigits = (v: string) => v.replace(/\D/g, '');
    const getPhoneVariants = (raw: string) => {
      let d = normalizeDigits(raw);
      if (d.startsWith('55') && d.length > 11) d = d.slice(2);
      const v = [d];
      if (d.length === 10) v.push(d.slice(0, 2) + '9' + d.slice(2));
      if (d.length === 11 && d[2] === '9') v.push(d.slice(0, 2) + d.slice(3));
      return v.flatMap(x => [x, '55' + x]);
    };

    // --- APPOINTMENT CONFIRMATION/CANCELLATION ---
    if (extractedButtonId === "Confirmar" || extractedButtonId === "Cancelar") {
      console.log('[APPOINTMENT_ACTION]', extractedButtonId, 'from:', from);
      const isConfirm = extractedButtonId === "Confirmar";
      
      try {
        const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
        const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        
        const variants = getPhoneVariants(from);
        console.log('[PHONE_VARIANTS]', variants);

        // Lookup upcoming appointments
        const today = new Date().toISOString().slice(0, 10);
        const { data: appointments, error: aptError } = await supabase
          .from('appointments')
          .select(`
            id, 
            status, 
            appointment_date,
            patient:patients!inner(name, phone)
          `)
          .in('status', ['scheduled', 'confirmed'])
          .gte('appointment_date', today)
          .order('appointment_date', { ascending: true })
          .order('start_time', { ascending: true })
          .limit(10);

        if (aptError) throw aptError;

        const matchedApt = appointments?.find(a => {
          const pPhone = (a.patient as any)?.phone;
          return pPhone && variants.includes(normalizeDigits(pPhone));
        });

        if (matchedApt) {
          const newStatus = isConfirm ? 'confirmed' : 'cancelled';
          console.log('[MATCHED_APT]', matchedApt.id, '->', newStatus);
          
          const { error: updateError } = await supabase
            .from('appointments')
            .update({ status: newStatus })
            .eq('id', matchedApt.id);
          
          if (updateError) throw updateError;

          const msg = isConfirm 
            ? "Obrigado! Sua consulta foi *confirmada* com sucesso. ✅"
            : "Entendido. Sua consulta foi *cancelada*. Se precisar reagendar, entre em contato. ❌";
          
          await sendResponse(withMenuTextPayload(msg));
          
          return new Response(JSON.stringify({ ok: true, action: `appointment_${newStatus}` }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        } else {
          console.log('[APT_NOT_FOUND] for variants:', variants);
          await sendResponse(
            withMenuButtonsPayload(
              "Não encontramos um agendamento pendente para este número. Se preferir, fale com um atendente.",
              [{ id: "falar_atendente", title: "Falar c/ Atendente" }],
            ),
          );
        }
      } catch (err) {
        console.error('[APT_ACTION_ERROR]', err);
      }
    }

    const isGreeting = /\b(oi|ola|olá|bom dia|boa tarde|boa noite|inicio|início|começar|comecar|menu|oi lov|ola lov|olá lov)\b/i.test(text);
    const isBoleto = /\b(boleto|segunda via|pagamento|gerar boleto|2 via|2ª via)\b/i.test(text);
    const isCCT = /\b(cct|convenção|convencao|coletiva|piso|salário|salario|piso salarial)\b/i.test(text);
    const isAgendarConsulta = /\b(agendar consulta|marcar consulta|agendamento de consulta|consulta médica|consulta medica)\b/i.test(text);
    const isHomologacao = /\b(homologação|homologacao|rescisão|rescisao)\b/i.test(text);
    const isCarteirinha = /\b(carteirinha|carteira|associado|sócio|socio|atualizar carteira)\b/i.test(text);
    const isThanks = /\b(obrigado|obrigada|grato|grata|valeu|thanks|agradeço|agradecido|agradecida)\b/i.test(text);
    const isNo = /\b(nao|não|no|nada mais|encerrar|finalizar)\b/i.test(text);

    // --- 0. THANKS / END OF SERVICE ---
    if (isThanks && !extractedButtonId) {
      await sendResponse({
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: "De nada! 😊 Ficamos felizes em ajudar.\n\nDeseja algo mais?" },
          action: {
            buttons: [
              { type: "reply", reply: { id: "menu_principal", title: "Sim, Ver Menu" } },
              { type: "reply", reply: { id: "encerrar_atendimento", title: "Não, Obrigado" } }
            ]
          }
        }
      });
      return new Response(JSON.stringify({ ok: true, action: "thanks_ask_more" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (extractedButtonId === "encerrar_atendimento" || (isNo && !extractedButtonId)) {
      await sendResponse(
        withMenuTextPayload(
          "Perfeito! Atendimento encerrado. Se precisar de algo no futuro, é só mandar um 'Oi' ou toque em *Menu Principal* abaixo. Tenha um ótimo dia! 👋",
        ),
      );
      return new Response(JSON.stringify({ ok: true, action: "terminate" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // --- ROUTING LOGIC ---

    // 1. MAIN MENU
    if (isGreeting || extractedButtonId === "menu_principal") {
      await sendResponse({
        type: "interactive",
        interactive: {
          type: "button",
          header: { type: "text", text: "Sindicato dos Comerciários" },
          body: { text: "Olá! Bem-vindo ao nosso canal oficial. Como podemos ajudar hoje? Escolha uma opção abaixo:" },
          footer: { text: "Atendimento Automático" },
          action: {
            buttons: [
              { type: "reply", reply: { id: "whazing_associado", title: "Sou Associado" } },
              { type: "reply", reply: { id: "whazing_empresa", title: "Sou Empresa" } },
              { type: "reply", reply: { id: "whazing_contabilidade", title: "Contabilidade" } }
            ]
          }
        }
      });
      return new Response(JSON.stringify({ ok: true, action: "main_menu" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2. SUBMENU ASSOCIADO / CARTEIRINHA
    if (extractedButtonId === "whazing_associado" || extractedButtonId === "voltar_associado" || (isCarteirinha && !isGreeting)) {
      await sendResponse({
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: "Você selecionou *Sou Associado*.\n\nEscolha uma opção:" },
          action: {
            buttons: [
              { type: "reply", reply: { id: "agendar_consulta", title: "Agendar Consulta" } },
              { type: "reply", reply: { id: "whazing_sub_carteirinha", title: "Atualizar Carteira" } },
              { type: "reply", reply: { id: "whazing_associado_mais", title: "Mais Opções" } }
            ]
          }
        }
      });
      return new Response(JSON.stringify({ ok: true, action: "submenu_associado" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2b. SUBMENU ASSOCIADO — MAIS OPÇÕES (overflow das opções que não cabem em 3 botões)
    if (extractedButtonId === "whazing_associado_mais") {
      await sendResponse({
        type: "interactive",
        interactive: {
          type: "list",
          body: { text: "Mais opções para *Associado*:" },
          action: {
            button: "Ver Opções",
            sections: [
              {
                title: "Outras opções",
                rows: [
                  { id: "cancelar_consulta", title: "Cancelar Consulta", description: "Desmarcar consulta agendada" },
                  { id: "whazing_sub_app", title: "Aplicativo", description: "Baixar app na Play Store" },
                  { id: "whazing_sub_cct", title: "CCT / Pisos", description: "Convenções e salários" },
                  { id: "whazing_sub_outros", title: "Outros Assuntos", description: "Falar com atendente" }
                ]
              },
              {
                title: "Navegação",
                rows: [
                  { id: "whazing_associado", title: "Voltar", description: "Voltar ao submenu Associado" },
                  { id: "menu_principal", title: "Menu Principal", description: "Voltar ao início" }
                ]
              }
            ]
          }
        }
      });
      return new Response(JSON.stringify({ ok: true, action: "submenu_associado_mais" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 3. SUBMENU EMPRESA
    if (extractedButtonId === "whazing_empresa" || extractedButtonId === "voltar_empresa") {
      await sendResponse({
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: "Você selecionou *Sou Empresa*.\n\nComo podemos ajudar?" },
          action: {
            buttons: [
              { type: "reply", reply: { id: "whazing_sub_boleto", title: "2ª Via Boleto" } },
              { type: "reply", reply: { id: "whazing_sub_cct", title: "CCT / Pisos" } },
              { type: "reply", reply: { id: "whazing_sub_outros", title: "Outros Assuntos" } }
            ]
          }
        }
      });
      return new Response(JSON.stringify({ ok: true, action: "submenu_empresa" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 4. SUBMENU CONTABILIDADE
    if (extractedButtonId === "whazing_contabilidade") {
      await sendResponse({
        type: "interactive",
        interactive: {
          type: "list",
          body: { text: "Você selecionou *Contabilidade*.\n\nComo podemos ajudar?" },
          action: {
            button: "Ver Opções",
            sections: [
              {
                title: "Serviços Contabilidade",
                rows: [
                  { id: "whazing_sub_homologacao", title: "Homologação", description: "Agendamentos" },
                  { id: "whazing_sub_cct", title: "CCT / Pisos", description: "Convenções e salários" },
                  { id: "whazing_sub_outros", title: "Outros Assuntos", description: "Suporte especializado" }
                ]
              },
              {
                title: "Navegação",
                rows: [
                  { id: "menu_principal", title: "Menu Principal", description: "Voltar ao início" }
                ]
              }
            ]
          }
        }
      });
      return new Response(JSON.stringify({ ok: true, action: "submenu_contabilidade" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 5. CARTEIRINHA / BOLETO / HOMOLOGAÇÃO / CCT (Follow-up or Action)
    const followUpAction = (msg: string) => ({
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: msg + "\n\nPosso ajudar com mais alguma coisa?" },
        action: {
          buttons: [
            { type: "reply", reply: { id: "falar_atendente", title: "Falar c/ Atendente" } },
            { type: "reply", reply: { id: "menu_principal", title: "Menu Principal" } }
          ]
        }
      }
    });

    // (Botão whazing_sub_carteirinha agora é tratado no FLUXO CARTEIRINHA acima,
    // que oferece a escolha entre App e WhatsApp.)

    if (extractedButtonId === "whazing_sub_app") {
      const playUrl = "https://play.google.com/store/apps/details?id=br.org.secmi.comerciariosilheus.app";
      // 1) Mensagem com CTA URL abrindo direto a Play Store
      await sendResponse({
        type: "interactive",
        interactive: {
          type: "cta_url",
          header: { type: "text", text: "Aplicativo do Sindicato" },
          body: {
            text:
              "📱 Tenha o sindicato na palma da mão!\n\n" +
              "Com o app você acessa:\n" +
              "• Carteirinha digital\n" +
              "• 2ª via de boletos\n" +
              "• Autorizações e benefícios\n" +
              "• Avisos e notificações em tempo real\n\n" +
              "Toque no botão abaixo para instalar gratuitamente na Play Store."
          },
          footer: { text: "Disponível para Android" },
          action: {
            name: "cta_url",
            parameters: { display_text: "Baixar na Play Store", url: playUrl }
          }
        }
      });
      // 2) Follow-up com opções de navegação
      await sendResponse(followUpAction("Após instalar, faça login com seu CPF cadastrado no sindicato."));
      return new Response(JSON.stringify({ ok: true, action: "app_playstore" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (extractedButtonId === "whazing_sub_boleto" || (isBoleto && !isGreeting)) {
      // Delegar para o fluxo de boleto especializado
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        
        const boletoFlowRes = await fetch(`${supabaseUrl}/functions/v1/boleto-whatsapp-flow`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`
          },
          body: JSON.stringify({
            clinic_id: "89e7585e-7bce-4e58-91fa-c37080d1170d", // ID do Sindicato
            phone: from,
            action: 'start'
          })
        });
        
        const boletoData = await boletoFlowRes.json();
        if (boletoData.success) {
          await sendResponse({
            type: "interactive",
            interactive: {
              type: "button",
              body: { text: boletoData.response },
              action: {
                buttons: (boletoData.buttons || []).map((b: any) => ({
                  type: "reply",
                  reply: { id: b.id, title: b.title }
                }))
              }
            }
          });
          return new Response(JSON.stringify({ ok: true, action: "boleto_start" }));
        }
      } catch (err) {
        console.error('[BOLETO_FLOW_ERROR]', err);
      }
      
      await sendResponse(followUpAction("Para emitir a 2ª via do boleto, informe o CNPJ da empresa."));
      return new Response(JSON.stringify({ ok: true, action: "boleto_fallback" }));
    }

    if (extractedButtonId === "whazing_sub_cct" || (isCCT && !isGreeting)) {
      // 1) Mensagem com CTA URL para convenções anteriores
      await sendResponse({
        type: "interactive",
        interactive: {
          type: "cta_url",
          body: {
            text:
              "📄 As Convenções Coletivas e Tabelas de Pisos Salariais vigentes estão disponíveis em nosso site ou podem ser solicitadas aqui.\n\n" +
              "Acesse também o histórico de convenções anteriores pelo botão abaixo.",
          },
          action: {
            name: "cta_url",
            parameters: {
               display_text: "Ver Anteriores",
              url: "https://comerciariosilheus.org.br/ccts/",
            },
          },
        },
      });
      // 2) Follow-up com opções de navegação
      await sendResponse(followUpAction("Posso ajudar com mais alguma coisa?"));
      return new Response(JSON.stringify({ ok: true, action: "cct" }));
    }

    if (extractedButtonId === "whazing_sub_homologacao" || (isHomologacao && !isGreeting)) {
      await sendResponse(followUpAction("O agendamento de homologação deve ser feito pelo portal da empresa."));
      return new Response(JSON.stringify({ ok: true, action: "homologacao" }));
    }

    if (extractedButtonId === "whazing_sub_outros" || extractedButtonId === "falar_atendente") {
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const supportStatus = await getHumanSupportStatus(supabase);

      if (!supportStatus.available) {
        console.log(`[HUMAN_SUPPORT_BLOCKED] ${supportStatus.dayName}, ${supportStatus.date} ${supportStatus.time} - ${supportStatus.reason}`);
        await sendResponse(withMenuTextPayload(unavailableSupportMessage(supportStatus.reason)));
        return new Response(JSON.stringify({ ok: true, action: "human_support_unavailable", reason: supportStatus.reason }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      await sendResponse(
        withMenuTextPayload(
          "Entendido. Vou te encaminhar para um de nossos atendentes. Por favor, aguarde um momento. ⏳\n\nSe preferir voltar ao menu, toque em *Menu Principal*.",
        ),
      );
      // Here you would typically trigger a handoff to human (Whazing/ZapResponder)
      return new Response(JSON.stringify({ ok: true, action: "handoff" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 6. PROCESSAR RESPOSTAS DO FLUXO DE BOLETO (CNPJ, etc.)
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    
    const { data: boletoSession } = await supabase
      .from('whatsapp_boleto_sessions')
      .select('*')
      .eq('phone', from)
      .maybeSingle();

    const boletoForwardIds = new Set(['recomecar', 'reuse_cnpj_sim', 'reuse_cnpj_nao']);
    const shouldForwardBoleto = !!boletoSession && (
      boletoSession.state !== 'SUCCESS' ||
      extractedButtonId?.startsWith('boleto_') ||
      (extractedButtonId && boletoForwardIds.has(extractedButtonId))
    );
    if (shouldForwardBoleto) {
      const boletoFlowRes = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/boleto-whatsapp-flow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`
        },
        body: JSON.stringify({
          clinic_id: "89e7585e-7bce-4e58-91fa-c37080d1170d",
          phone: from,
          message: text || extractedButtonId,
          action: extractedButtonId ? 'button' : 'text'
        })
      });

      const boletoData = await boletoFlowRes.json();
      if (boletoData.success) {
        const incomingButtons: Array<{ id: string; title: string }> = boletoData.buttons || [];
        const hasMenuAlready = incomingButtons.some((b) => b.id === "menu_principal");
        if (incomingButtons.length === 0) {
          await sendResponse(withMenuTextPayload(boletoData.response));
        } else if (hasMenuAlready) {
          // Respeita os botões já montados pelo fluxo de boleto (que já inclui Menu Principal).
          await sendResponse({
            type: "interactive",
            interactive: {
              type: "button",
              body: { text: boletoData.response },
              action: {
                buttons: incomingButtons.slice(0, 3).map((b) => ({
                  type: "reply",
                  reply: { id: b.id, title: (b.title || "").slice(0, 20) },
                })),
              },
            },
          });
        } else {
          await sendResponse(withMenuButtonsPayload(boletoData.response, incomingButtons));
        }
        return new Response(JSON.stringify({ ok: true, action: "boleto_step" }));
      }
    }

    // Fallback: opção inválida ou mensagem não compreendida — sempre oferece Menu Principal.
    await sendResponse(
      withMenuTextPayload(
        "Não entendi sua mensagem. 🤔\n\nToque em *Menu Principal* abaixo para ver as opções disponíveis ou envie *Oi* a qualquer momento.",
      ),
    );
    return new Response(JSON.stringify({ ok: true, status: "unhandled" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[ERROR]", e);
    return new Response(JSON.stringify({ ok: false, error: e.message }), { 
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
