// ADAPTER CANÔNICO CHATWOOT (camada de ATENDIMENTO HUMANO)
// Substitui o ChatGoo como painel de atendimento. Regras de compliance Meta:
//  - O Chatwoot NUNCA envia para o WhatsApp. Todo envio real sai pela Meta
//    Cloud API oficial, com trava de janela de 24h, opt-out e kill switch.
//  - Aqui só espelhamos as conversas (entrada e saída) para o atendente ver e
//    responder, e marcamos o handoff humano.
//  - Falhas do Chatwoot são best-effort: nunca derrubam o fluxo do WhatsApp.

export interface ChatwootConfig {
  clinicId: string;
  baseUrl: string;
  accountId: string;
  inboxId: string;
  token: string;
  enabled: boolean;
}

interface SupabaseLike {
  // deno-lint-ignore no-explicit-any
  from: (table: string) => any;
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
}

/** Marca usada para identificar mensagens criadas pelo robô (evita reenvio). */
export const CHATWOOT_BOT_FLAG = "prosind_bot_echo";

export async function getChatwootConfig(
  supabaseAdmin: SupabaseLike,
  clinicId: string,
): Promise<ChatwootConfig | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from("chatwoot_configs")
      .select("*")
      .eq("clinic_id", clinicId)
      .maybeSingle();
    if (error || !data) return null;

    const secretName = data.chatwoot_api_token_secret_name ||
      `CHATWOOT_TOKEN_${clinicId.replace(/-/g, "_")}`;
    const token = Deno.env.get(secretName) ?? "";
    const baseUrl = String(data.chatwoot_base_url ?? "").replace(/\/+$/, "");
    if (!token || !baseUrl) return null;

    return {
      clinicId,
      baseUrl,
      accountId: String(data.chatwoot_account_id ?? "1"),
      inboxId: String(data.chatwoot_inbox_id ?? ""),
      token,
      enabled: data.enabled !== false,
    };
  } catch {
    return null;
  }
}

async function cw(
  cfg: ChatwootConfig,
  path: string,
  init: { method?: string; body?: unknown } = {},
  // deno-lint-ignore no-explicit-any
): Promise<any | null> {
  try {
    const res = await fetch(`${cfg.baseUrl}/api/v1/accounts/${cfg.accountId}${path}`, {
      method: init.method ?? "GET",
      headers: { api_access_token: cfg.token, "Content-Type": "application/json" },
      ...(init.body ? { body: JSON.stringify(init.body) } : {}),
    });
    const text = await res.text();
    if (!res.ok) {
      console.error(`[chatwoot] ${init.method ?? "GET"} ${path} => ${res.status}: ${text.slice(0, 300)}`);
      return null;
    }
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  } catch (e) {
    console.error(`[chatwoot] erro de rede em ${path}: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

function asArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  // deno-lint-ignore no-explicit-any
  const p = payload as any;
  if (Array.isArray(p?.payload)) return p.payload;
  if (Array.isArray(p?.data?.payload)) return p.data.payload;
  if (Array.isArray(p?.data)) return p.data;
  return [];
}

async function findOrCreateContact(
  cfg: ChatwootConfig,
  phoneE164: string,
  name?: string | null,
): Promise<number | null> {
  const search = await cw(cfg, `/contacts/search?q=${encodeURIComponent(phoneE164)}`);
  const found = asArray(search).find((c) => {
    // deno-lint-ignore no-explicit-any
    const phone = String((c as any)?.phone_number ?? "").replace(/\D/g, "");
    // deno-lint-ignore no-explicit-any
    return phone === phoneE164 || String((c as any)?.identifier ?? "") === phoneE164;
  });
  // deno-lint-ignore no-explicit-any
  if (found) return Number((found as any).id);

  const created = await cw(cfg, "/contacts", {
    method: "POST",
    body: {
      inbox_id: Number(cfg.inboxId),
      name: name || phoneE164,
      phone_number: `+${phoneE164}`,
      identifier: phoneE164,
    },
  });
  // deno-lint-ignore no-explicit-any
  const id = (created as any)?.payload?.contact?.id ?? (created as any)?.id;
  return id ? Number(id) : null;
}

async function findOrCreateConversation(
  cfg: ChatwootConfig,
  contactId: number,
  phoneE164: string,
): Promise<number | null> {
  const convs = await cw(cfg, `/contacts/${contactId}/conversations`);
  const open = asArray(convs).find((c) => {
    // deno-lint-ignore no-explicit-any
    const conv = c as any;
    return String(conv?.inbox_id ?? conv?.inbox?.id ?? "") === String(cfg.inboxId) &&
      conv?.status !== "resolved";
  });
  // deno-lint-ignore no-explicit-any
  if (open) return Number((open as any).id);

  const created = await cw(cfg, "/conversations", {
    method: "POST",
    body: {
      source_id: phoneE164,
      inbox_id: Number(cfg.inboxId),
      contact_id: contactId,
    },
  });
  // deno-lint-ignore no-explicit-any
  const id = (created as any)?.id ?? (created as any)?.payload?.id;
  return id ? Number(id) : null;
}

/** Garante contato + conversa no Chatwoot e devolve o id da conversa. */
export async function chatwootEnsureConversation(
  cfg: ChatwootConfig,
  phoneE164: string,
  name?: string | null,
): Promise<number | null> {
  if (!cfg.enabled || !cfg.inboxId) return null;
  const contactId = await findOrCreateContact(cfg, phoneE164, name);
  if (!contactId) return null;
  return await findOrCreateConversation(cfg, contactId, phoneE164);
}

/** Espelha no Chatwoot a mensagem recebida do contato. */
export async function chatwootMirrorIncoming(
  cfg: ChatwootConfig,
  conversationId: number,
  content: string,
): Promise<void> {
  await cw(cfg, `/conversations/${conversationId}/messages`, {
    method: "POST",
    body: { content, message_type: "incoming", private: false },
  });
}

/** Espelha no Chatwoot a resposta que o robô já enviou pela Meta. */
export async function chatwootMirrorBotReply(
  cfg: ChatwootConfig,
  conversationId: number,
  content: string,
): Promise<void> {
  await cw(cfg, `/conversations/${conversationId}/messages`, {
    method: "POST",
    body: {
      content,
      message_type: "outgoing",
      private: false,
      content_attributes: { [CHATWOOT_BOT_FLAG]: true },
    },
  });
}

/** Abre a conversa para atendimento humano e deixa uma nota interna. */
export async function chatwootHandoff(
  cfg: ChatwootConfig,
  conversationId: number,
  note: string,
): Promise<void> {
  await cw(cfg, `/conversations/${conversationId}/toggle_status`, {
    method: "POST",
    body: { status: "open" },
  });
  await cw(cfg, `/conversations/${conversationId}/messages`, {
    method: "POST",
    body: { content: note, message_type: "outgoing", private: true },
  });
}

/** True quando há atendente humano cuidando da conversa (robô fica em silêncio). */
export async function chatwootHasHumanInControl(
  cfg: ChatwootConfig,
  conversationId: number,
): Promise<boolean> {
  const conv = await cw(cfg, `/conversations/${conversationId}`);
  // deno-lint-ignore no-explicit-any
  const c = conv as any;
  if (!c) return false;
  const assigned = c?.meta?.assignee?.id ?? c?.assignee_id ?? null;
  return c?.status === "open" && !!assigned;
}
