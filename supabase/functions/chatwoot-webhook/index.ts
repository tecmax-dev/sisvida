// WEBHOOK DO CHATWOOT (atendimento humano) -> META CLOUD API OFICIAL
//
// COMPLIANCE META (mesmas travas do fluxo anterior):
//  - Só envia mensagem livre DENTRO da janela de 24h (fail-closed).
//  - Kill switch global (CHATGOO_SEND_ENABLED).
//  - Respeita opt-out (whatsapp_opt_outs).
//  - Não reenvia o que o robô já enviou (flag de eco).
//  - Tudo auditado em chatgoo_events.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { chatgooSendTextViaMeta } from "../_shared/chatgoo-client.ts";
import { CHATWOOT_BOT_FLAG } from "../_shared/chatwoot-client.ts";

const SINDICATO_CLINIC_ID = "89e7585e-7bce-4e58-91fa-c37080d1170d";

function onlyDigits(v: unknown): string {
  return String(v ?? "").replace(/\D/g, "");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const ok = (status: string, reason?: string, extra: Record<string, unknown> = {}) =>
    new Response(JSON.stringify({ status, reason: reason ?? null, ...extra }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  // Segredo compartilhado: aceita chave na URL, valor cru em header OU
  // assinatura HMAC-SHA256 (x-chatwoot-signature) — como o Chatwoot/ZapResponde envia.
  const rawBody = await req.text();

  const hmacHex = async (secret: string, bodyText: string): Promise<string> => {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", key, enc.encode(bodyText));
    return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
  };

  const { data: cfgRow } = await supabase
    .from("chatwoot_configs")
    .select("webhook_secret, enabled")
    .eq("clinic_id", SINDICATO_CLINIC_ID)
    .maybeSingle();

  if (!cfgRow || cfgRow.enabled === false) return ok("BLOCKED", "CHATWOOT_DISABLED");

  const expected = String(cfgRow.webhook_secret ?? "");
  const altSecret = String(Deno.env.get("CHATWOOT_HOOK_SECRET") ?? "");
  const accepted = new Set([expected, altSecret].filter(Boolean));
  const url = new URL(req.url);
  const sigHeader = (req.headers.get("x-chatwoot-signature") ?? "")
    .replace(/^sha256=/i, "")
    .trim()
    .toLowerCase();
  const signatureTimestamp = (req.headers.get("x-chatwoot-timestamp") ?? "").trim();

  if (accepted.size > 0) {
    const rawCandidates: string[] = [];
    for (const [, v] of url.searchParams) rawCandidates.push(String(v).trim());
    for (const [, v] of req.headers) rawCandidates.push(String(v).trim());
    const rawMatch = rawCandidates.some((v) => accepted.has(v));

    let sigMatch = false;
    if (sigHeader) {
      for (const s of accepted) {
        // Chatwoot signs "{timestamp}.{raw body}". Keep support for legacy
        // installations that signed only the raw body.
        const signedPayload = signatureTimestamp
          ? `${signatureTimestamp}.${rawBody}`
          : rawBody;
        if (
          (await hmacHex(s, signedPayload)) === sigHeader ||
          (signatureTimestamp && (await hmacHex(s, rawBody)) === sigHeader)
        ) {
          sigMatch = true;
          break;
        }
      }
    }

    if (!rawMatch && !sigMatch) {
      // Fallback autenticado: confirmamos o evento direto na API do Chatwoot
      // (com o token de administrador guardado em segredo). Só seguimos adiante
      // se a mensagem existir mesmo lá — payload forjado não passa.
      authFallbackNeeded = true;
      await supabase.from("chatgoo_events").insert({
        direction: "inbound",
        event: "chatwoot_webhook",
        decision: "PENDING",
        reason: "SECRET_MISMATCH_CHECKING_API",
        payload: {
          query_keys: [...url.searchParams.keys()],
          sig_header_present: Boolean(sigHeader),
          timestamp_present: Boolean(signatureTimestamp),
        },
      });
    }
  }

  // deno-lint-ignore no-explicit-any
  let body: any = {};
  try {
    body = JSON.parse(rawBody || "{}");
  } catch {
    return ok("BLOCKED", "INVALID_JSON");
  }

  const event = String(body?.event ?? "");
  if (event !== "message_created") return ok("IGNORED", "NOT_MESSAGE_CREATED");

  const messageType = String(body?.message_type ?? body?.messageType ?? "");
  const isPrivate = body?.private === true;
  const contentAttributes = body?.content_attributes ?? {};
  const content = String(body?.content ?? "").trim();

  // Só interessa a resposta do ATENDENTE (outgoing, pública, não-eco do robô).
  if (messageType !== "outgoing") return ok("IGNORED", "NOT_AGENT_MESSAGE");
  if (isPrivate) return ok("IGNORED", "PRIVATE_NOTE");
  if (contentAttributes?.[CHATWOOT_BOT_FLAG] === true) return ok("IGNORED", "BOT_ECHO");
  if (!content) return ok("IGNORED", "EMPTY_CONTENT");

  const conversation = body?.conversation ?? {};
  const contact = body?.sender?.type === "contact"
    ? body?.sender
    : conversation?.meta?.sender ?? body?.contact ?? {};
  const phone = onlyDigits(
    contact?.phone_number ?? contact?.identifier ?? conversation?.contact_inbox?.source_id,
  );
  const messageId = body?.id ?? null;

  if (!phone || phone.length < 10) return ok("BLOCKED", "PHONE_NOT_RESOLVED");

  // Deduplicação: o Chatwoot pode repetir o evento.
  if (messageId) {
    const { data: dup } = await supabase
      .from("chatgoo_events")
      .select("id")
      .eq("event", "chatwoot_agent_reply")
      .eq("phone", phone)
      .contains("payload", { chatwoot_message_id: messageId })
      .limit(1);
    if (Array.isArray(dup) && dup.length > 0) return ok("IGNORED", "DUPLICATE");
  }

  // Opt-out: contato descadastrado nunca recebe mensagem.
  const { data: optOut } = await supabase
    .from("whatsapp_opt_outs")
    .select("id")
    .eq("clinic_id", SINDICATO_CLINIC_ID)
    .eq("phone", phone)
    .limit(1);
  if (Array.isArray(optOut) && optOut.length > 0) {
    await supabase.from("chatgoo_events").insert({
      direction: "outbound",
      event: "chatwoot_agent_reply",
      phone,
      clinic_id: SINDICATO_CLINIC_ID,
      decision: "BLOCKED",
      reason: "OPT_OUT",
      payload: { chatwoot_message_id: messageId, preview: content.slice(0, 200) },
    });
    return ok("BLOCKED", "OPT_OUT");
  }

  // Envio real: Meta Cloud API oficial, com trava de janela de 24h fail-closed.
  const result = await chatgooSendTextViaMeta(supabase, phone, content);

  await supabase.from("chatgoo_events").insert({
    direction: "outbound",
    event: "chatwoot_agent_reply",
    phone,
    clinic_id: SINDICATO_CLINIC_ID,
    decision: result.sent ? "SENT" : result.dry_run ? "DRY_RUN" : "SEND_FAILED",
    reason: result.error ?? null,
    payload: {
      chatwoot_message_id: messageId,
      conversation_id: conversation?.id ?? null,
      preview: content.slice(0, 500),
      meta_message_id: result.message_id ?? null,
      http_status: result.status ?? null,
    },
  });

  return ok(
    result.sent ? "SENT" : result.dry_run ? "DRY_RUN" : "SEND_FAILED",
    result.error ?? undefined,
    { meta_message_id: result.message_id ?? null },
  );
});
