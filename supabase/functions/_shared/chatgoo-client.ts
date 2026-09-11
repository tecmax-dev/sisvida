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
    const doSend = () =>
      fetch(`${url}/api/messages/send`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

    let res = await doSend();
    let text = await res.text();

    // ChatGoo rotaciona o token da conexão: ao responder
    // "Invalid token. We'll try to assign a new one on next request",
    // uma nova tentativa imediata usa o token recém-atribuído no servidor.
    if (res.status === 401 && /invalid token/i.test(text)) {
      console.warn("[chatgoo] 401 invalid token — retentando uma vez (rotação de token)");
      res = await doSend();
      text = await res.text();
    }

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
