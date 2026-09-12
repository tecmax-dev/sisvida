// ADAPTER CANÔNICO CHATGOO (multiatendimento estilo Whaticket)
// Único ponto de saída autorizado para o gateway ChatGoo.
// Regras:
//  - Só responde DENTRO da janela de 24h (mensagem iniciada pelo contato).
//  - Envio proativo/template continua exclusivamente pela Meta Cloud API.
//  - Kill switch: CHATGOO_SEND_ENABLED !== "true" => DRY RUN (nada é enviado).

export interface ChatgooSendResult {
  sent: boolean;
  dry_run: boolean;
  status: number | null;
  body: string | null;
  error: string | null;
  message_id?: string | null;
}

function baseUrl(): string {
  return (Deno.env.get("CHATGOO_BASE_URL") ?? "").replace(/\/+$/, "");
}

export function chatgooConfigured(): boolean {
  return !!baseUrl() && !!Deno.env.get("CHATGOO_API_TOKEN");
}

export function chatgooSendEnabled(): boolean {
  return Deno.env.get("CHATGOO_SEND_ENABLED") === "true";
}

/** Envia texto simples para um número já normalizado (E.164 sem "+", ex.: 5573999999999). */
export async function chatgooSendText(
  phoneE164: string,
  message: string,
  opts: { ticketId?: string | number | null; queueId?: string | number | null } = {},
): Promise<ChatgooSendResult> {
  const url = baseUrl();
  const token = Deno.env.get("CHATGOO_API_TOKEN") ?? "";

  if (!url || !token) {
    return { sent: false, dry_run: true, status: null, body: null, error: "CHATGOO_NOT_CONFIGURED" };
  }
  if (!chatgooSendEnabled()) {
    return { sent: false, dry_run: true, status: null, body: null, error: null };
  }

  const payload: Record<string, unknown> = {
    number: phoneE164,
    body: message,
  };
  if (opts.ticketId != null) payload.ticketId = opts.ticketId;
  if (opts.queueId != null) payload.queueId = opts.queueId;

  try {
    const res = await fetch(`${url}/api/messages/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const text = await res.text();

    if (!res.ok) {
      const newToken = res.headers.get("x-new-token") ?? res.headers.get("x-api-token") ?? null;
      console.error(`[chatgoo] envio falhou [${res.status}]: ${text}${newToken ? " | header novo token presente" : ""}`);
      return { sent: false, dry_run: false, status: res.status, body: text, error: "GATEWAY_ERROR" };
    }
    return { sent: true, dry_run: false, status: res.status, body: text, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[chatgoo] erro de rede: ${msg}`);
    return { sent: false, dry_run: false, status: null, body: null, error: msg };
  }
}

// A conexão 3223-Oficial é Meta Cloud API oficial. Respostas dentro da janela
// de 24h (mensagens de sessão) saem direto pela Graph API — o endpoint interno
// do ChatGoo (/api/messages/send) é para conexões Baileys e não se aplica.
const META_PHONE_NUMBER_ID = "1213495528515111";

// COMPLIANCE META: mensagem livre (session message) só pode ser enviada dentro
// da janela de 24h aberta pela última mensagem do contato. Fora da janela, a
// Meta exige template aprovado — enviar texto livre causa bloqueio/banimento.
// Esta trava é FAIL-CLOSED: se não for possível comprovar a janela, NÃO envia.
const SESSION_WINDOW_MS = 24 * 60 * 60 * 1000;
const META_MAX_ATTEMPTS = 3;

async function postMetaMessage(
  token: string,
  payload: Record<string, unknown>,
): Promise<ChatgooSendResult> {
  let lastStatus: number | null = null;
  let lastBody: string | null = null;
  let lastError = "META_ERROR";

  for (let attempt = 1; attempt <= META_MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(`https://graph.facebook.com/v20.0/${META_PHONE_NUMBER_ID}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      lastStatus = res.status;
      lastBody = text;

      if (res.ok) {
        let confirmed = false;
        try {
          const parsed = JSON.parse(text);
          confirmed = typeof parsed?.messages?.[0]?.id === "string";
        } catch {
          confirmed = false;
        }
        if (confirmed) {
          const parsed = JSON.parse(text);
          return {
            sent: true,
            dry_run: false,
            status: res.status,
            body: text,
            error: null,
            message_id: parsed.messages[0].id,
          };
        }
        lastError = "META_SEND_UNCONFIRMED";
        console.error(`[chatgoo/meta] tentativa ${attempt}/${META_MAX_ATTEMPTS} sem confirmação de message id`);
      }

      // Erros de validação/autorização não melhoram com repetição. Repetimos
      // apenas indisponibilidade, limite temporário e falhas internas da Meta.
      if (res.status !== 429 && res.status < 500) break;
      console.error(`[chatgoo/meta] tentativa ${attempt}/${META_MAX_ATTEMPTS} falhou [${res.status}]`);
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      console.error(`[chatgoo/meta] tentativa ${attempt}/${META_MAX_ATTEMPTS} falhou: ${lastError}`);
    }

    if (attempt < META_MAX_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }

  return { sent: false, dry_run: false, status: lastStatus, body: lastBody, error: lastError };
}

interface SupabaseLike {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
  // deno-lint-ignore no-explicit-any
  from: (table: string) => any;
}

async function isWithinSessionWindow(
  supabaseAdmin: SupabaseLike,
  phoneE164: string,
): Promise<boolean> {
  try {
    const since = new Date(Date.now() - SESSION_WINDOW_MS).toISOString();
    const { data, error } = await supabaseAdmin
      .from("chatgoo_events")
      .select("id")
      .eq("direction", "inbound")
      .eq("event", "message")
      .eq("phone", phoneE164)
      .gte("created_at", since)
      .limit(1);
    if (error) {
      console.error(`[chatgoo/meta] falha ao verificar janela 24h: ${JSON.stringify(error)}`);
      return false; // fail-closed
    }
    return Array.isArray(data) && data.length > 0;
  } catch (e) {
    console.error(`[chatgoo/meta] exceção ao verificar janela 24h: ${e instanceof Error ? e.message : String(e)}`);
    return false; // fail-closed
  }
}

/**
 * `opts.inboundNow` = true quando o envio é resposta imediata a uma mensagem
 * recebida agora do contato. Nesse caso a janela de 24h está aberta por
 * definição (a própria mensagem do contato a abriu), mesmo que o evento ainda
 * não esteja gravado — caso típico de um número entrando em contato pela
 * primeira vez.
 */
export async function chatgooSendTextViaMeta(
  supabaseAdmin: SupabaseLike,
  phoneE164: string,
  message: string,
  opts?: { inboundNow?: boolean },
): Promise<ChatgooSendResult> {
  if (!chatgooSendEnabled()) {
    return { sent: false, dry_run: true, status: null, body: null, error: null };
  }

  // Trava de compliance: fora da janela de 24h, bloqueia e registra auditoria.
  const windowOpen = opts?.inboundNow === true ||
    await isWithinSessionWindow(supabaseAdmin, phoneE164);
  if (!windowOpen) {
    try {
      await supabaseAdmin.from("chatgoo_events").insert({
        direction: "outbound",
        event: "meta_send",
        phone: phoneE164,
        decision: "BLOCKED",
        reason: "OUTSIDE_24H_WINDOW",
        payload: { preview: message.slice(0, 200) },
      });
    } catch { /* auditoria best-effort */ }
    console.error(`[chatgoo/meta] BLOQUEADO fora da janela de 24h: ${phoneE164}`);
    return { sent: false, dry_run: false, status: null, body: null, error: "OUTSIDE_24H_WINDOW" };
  }

  try {
    const { data: secret } = await supabaseAdmin.rpc("get_meta_vault_secret", {
      _secret_name: "META_WHATSAPP_TOKEN_V2",
    });
    const token = secret ? String(secret) : Deno.env.get("META_WHATSAPP_TOKEN_V2");
    if (!token) {
      return { sent: false, dry_run: false, status: null, body: null, error: "META_TOKEN_MISSING" };
    }
    return await postMetaMessage(token, {
      messaging_product: "whatsapp",
      to: phoneE164,
      type: "text",
      text: { preview_url: true, body: message },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[chatgoo/meta] erro de rede: ${msg}`);
    return { sent: false, dry_run: false, status: null, body: null, error: msg };
  }
}

// ---- MENSAGEM INTERATIVA (BOTÕES/LISTA) ----
// Lista interativa é "session message": permitida pela Meta DENTRO da janela de
// 24h, igual ao texto livre. Mesma trava fail-closed de janela aplicada acima.
// Limites Meta: título de linha <= 24 chars, botão <= 20 chars, <= 10 linhas.
export interface ChatgooListRow {
  id: string;
  title: string;
  description?: string;
}

export interface ChatgooListPayload {
  body: string;
  buttonLabel: string; // ex.: "Ver opções"
  sections: { title?: string; rows: ChatgooListRow[] }[];
  header?: string;
  footer?: string;
}

export async function chatgooSendListViaMeta(
  supabaseAdmin: SupabaseLike,
  phoneE164: string,
  list: ChatgooListPayload,
  opts?: { inboundNow?: boolean },
): Promise<ChatgooSendResult> {
  if (!chatgooSendEnabled()) {
    return { sent: false, dry_run: true, status: null, body: null, error: null };
  }

  const windowOpen = opts?.inboundNow === true ||
    await isWithinSessionWindow(supabaseAdmin, phoneE164);
  if (!windowOpen) {
    try {
      await supabaseAdmin.from("chatgoo_events").insert({
        direction: "outbound",
        event: "meta_send_list",
        phone: phoneE164,
        decision: "BLOCKED",
        reason: "OUTSIDE_24H_WINDOW",
        payload: { preview: list.body.slice(0, 200) },
      });
    } catch { /* auditoria best-effort */ }
    console.error(`[chatgoo/meta] LISTA bloqueada fora da janela de 24h: ${phoneE164}`);
    return { sent: false, dry_run: false, status: null, body: null, error: "OUTSIDE_24H_WINDOW" };
  }

  try {
    const { data: secret } = await supabaseAdmin.rpc("get_meta_vault_secret", {
      _secret_name: "META_WHATSAPP_TOKEN_V2",
    });
    const token = secret ? String(secret) : Deno.env.get("META_WHATSAPP_TOKEN_V2");
    if (!token) {
      return { sent: false, dry_run: false, status: null, body: null, error: "META_TOKEN_MISSING" };
    }

    const interactive: Record<string, unknown> = {
      type: "list",
      body: { text: list.body.slice(0, 1024) },
      action: {
        button: list.buttonLabel.slice(0, 20),
        sections: list.sections.map((s) => ({
          ...(s.title ? { title: s.title.slice(0, 24) } : {}),
          rows: s.rows.slice(0, 10).map((r) => ({
            id: r.id.slice(0, 200),
            title: r.title.slice(0, 24),
            ...(r.description ? { description: r.description.slice(0, 72) } : {}),
          })),
        })),
      },
    };
    if (list.header) interactive.header = { type: "text", text: list.header.slice(0, 60) };
    if (list.footer) interactive.footer = { text: list.footer.slice(0, 60) };

    return await postMetaMessage(token, {
      messaging_product: "whatsapp",
      to: phoneE164,
      type: "interactive",
      interactive,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[chatgoo/meta] erro de rede (lista): ${msg}`);
    return { sent: false, dry_run: false, status: null, body: null, error: msg };
  }
}

export interface ChatgooButtonsPayload {
  body: string;
  buttons: { id: string; title: string }[]; // máx. 3 botões, título até 20 chars
  footer?: string;
}

/**
 * Envia mensagem interativa com botões de resposta rápida (reply buttons) via
 * Meta Cloud API. Usado no fluxo de consentimento (opt-in) — dentro da janela
 * de 24h, pois é sempre resposta a uma mensagem recebida do contato.
 */
export async function chatgooSendButtonsViaMeta(
  supabaseAdmin: SupabaseLike,
  phoneE164: string,
  payload: ChatgooButtonsPayload,
  opts?: { inboundNow?: boolean },
): Promise<ChatgooSendResult> {
  if (!chatgooSendEnabled()) {
    return { sent: false, dry_run: true, status: null, body: null, error: null };
  }

  const windowOpen = opts?.inboundNow === true ||
    await isWithinSessionWindow(supabaseAdmin, phoneE164);
  if (!windowOpen) {
    try {
      await supabaseAdmin.from("chatgoo_events").insert({
        direction: "outbound",
        event: "meta_send_buttons",
        phone: phoneE164,
        decision: "BLOCKED",
        reason: "OUTSIDE_24H_WINDOW",
        payload: { preview: payload.body.slice(0, 200) },
      });
    } catch { /* auditoria best-effort */ }
    return { sent: false, dry_run: false, status: null, body: null, error: "OUTSIDE_24H_WINDOW" };
  }

  try {
    const { data: secret } = await supabaseAdmin.rpc("get_meta_vault_secret", {
      _secret_name: "META_WHATSAPP_TOKEN_V2",
    });
    const token = secret ? String(secret) : Deno.env.get("META_WHATSAPP_TOKEN_V2");
    if (!token) {
      return { sent: false, dry_run: false, status: null, body: null, error: "META_TOKEN_MISSING" };
    }

    const interactive: Record<string, unknown> = {
      type: "button",
      body: { text: payload.body.slice(0, 1024) },
      action: {
        buttons: payload.buttons.slice(0, 3).map((b) => ({
          type: "reply",
          reply: { id: b.id.slice(0, 256), title: b.title.slice(0, 20) },
        })),
      },
    };
    if (payload.footer) interactive.footer = { text: payload.footer.slice(0, 60) };

    return await postMetaMessage(token, {
      messaging_product: "whatsapp",
      to: phoneE164,
      type: "interactive",
      interactive,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[chatgoo/meta] erro de rede (botões): ${msg}`);
    return { sent: false, dry_run: false, status: null, body: null, error: msg };
  }
}

/** Transfere o atendimento para uma fila humana no ChatGoo. */
export async function chatgooTransferToQueue(
  ticketId: string | number,
  queueId: string | number,
): Promise<ChatgooSendResult> {
  const url = baseUrl();
  const token = Deno.env.get("CHATGOO_API_TOKEN") ?? "";
  if (!url || !token) {
    return { sent: false, dry_run: true, status: null, body: null, error: "CHATGOO_NOT_CONFIGURED" };
  }
  if (!chatgooSendEnabled()) {
    return { sent: false, dry_run: true, status: null, body: null, error: null };
  }
  try {
    const res = await fetch(`${url}/api/tickets/${ticketId}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "pending", queueId }),
    });
    const text = await res.text();
    return {
      sent: res.ok,
      dry_run: false,
      status: res.status,
      body: text,
      error: res.ok ? null : "GATEWAY_ERROR",
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { sent: false, dry_run: false, status: null, body: null, error: msg };
  }
}

/** Validação HMAC SHA-256 do webhook de entrada. */
export async function verifyChatgooSignature(rawBody: string, signature: string | null): Promise<boolean> {
  const secret = Deno.env.get("CHATGOO_WEBHOOK_SECRET") ?? "";
  if (!secret) return false;
  if (!signature) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expected = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const provided = signature.replace(/^sha256=/i, "").trim().toLowerCase();
  if (provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  return diff === 0;
}
