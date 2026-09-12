import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Token fixo e determinístico: NÃO depende de variável de ambiente.
// Uma variável META_WEBHOOK_VERIFY_TOKEN divergente já configurada no
// projeto fazia o handshake da Meta falhar com 403 sempre que tentávamos
// registrar o callback oficial para este número — a Meta caía de volta
// para o webhook de terceiro (ChatGoo) como único caminho de entrada, e
// uma instabilidade no servidor deles derrubava o atendimento inteiro.
const VERIFY_TOKEN = "sindexa-status-2026";
const WABA_ID = "2063797207822998";

async function ensureMetaWebhookSubscription(admin: ReturnType<typeof createClient>) {
  try {
    const { data: secret } = await admin.rpc("get_meta_vault_secret", {
      _secret_name: "META_WHATSAPP_TOKEN_V2",
    });
    const token = secret ? String(secret) : Deno.env.get("META_WHATSAPP_TOKEN_V2");
    if (!token) return;

    const response = await fetch(`https://graph.facebook.com/v21.0/${WABA_ID}/subscribed_apps`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result?.success !== true) {
      console.error("META_WEBHOOK_SUBSCRIPTION_FAILED", response.status, result?.error?.code ?? "UNKNOWN");
      return;
    }
    console.log("META_WEBHOOK_SUBSCRIPTION_OK");
  } catch (error) {
    console.error("META_WEBHOOK_SUBSCRIPTION_ERROR", error instanceof Error ? error.message : String(error));
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const url = new URL(req.url);
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      return new Response(challenge ?? "", { status: 200, headers: cors });
    }
    return new Response("forbidden", { status: 403, headers: cors });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceRoleKey);
  const rawBody = await req.text();

  // Reinscrição idempotente: corrige automaticamente quando a Meta perde ou
  // remove a assinatura do aplicativo responsável pelo número oficial.
  await ensureMetaWebhookSubscription(admin);

  try {
    const body = JSON.parse(rawBody || "{}");
    const rows: any[] = [];
    for (const entry of body?.entry ?? []) {
      for (const change of entry?.changes ?? []) {
        for (const st of change?.value?.statuses ?? []) {
          const err = st?.errors?.[0];
          rows.push({
            wamid: st.id,
            recipient_id: st.recipient_id,
            status: st.status,
            error_code: err?.code ? String(err.code) : null,
            error_title: err?.title ?? null,
            error_details: err?.error_data?.details ?? err?.message ?? null,
            timestamp_meta: st.timestamp ? new Date(Number(st.timestamp) * 1000).toISOString() : null,
            raw: st,
          });
        }
      }
    }
    if (rows.length) await admin.from("whatsapp_message_status").insert(rows);

    // Este é o webhook cadastrado no número oficial da Meta. Além dos status,
    // ele também recebe as mensagens dos usuários. Encaminha essas mensagens
    // ao fluxo único de automação; antes elas eram confirmadas e descartadas.
    const hasInboundMessage = (body?.entry ?? []).some((entry: any) =>
      (entry?.changes ?? []).some((change: any) =>
        Array.isArray(change?.value?.messages) && change.value.messages.length > 0
      )
    );

    if (hasInboundMessage) {
      const inboundRows = (body?.entry ?? []).flatMap((entry: any) =>
        (entry?.changes ?? []).flatMap((change: any) =>
          (change?.value?.messages ?? []).map((message: any) => ({
            direction: "inbound",
            event: "meta_inbound_received",
            phone: String(message?.from ?? "").replace(/\D/g, "") || null,
            decision: "ACCEPTED",
            reason: message?.type ? `META_${String(message.type).toUpperCase()}` : "META_MESSAGE",
            payload: {
              message_id: message?.id ?? null,
              type: message?.type ?? null,
              selected_id: message?.interactive?.list_reply?.id ??
                message?.interactive?.button_reply?.id ?? null,
              selected_title: message?.interactive?.list_reply?.title ??
                message?.interactive?.button_reply?.title ?? null,
            },
          }))
        )
      );
      if (inboundRows.length) await admin.from("chatgoo_events").insert(inboundRows);

      const automationResponse = await fetch(`${supabaseUrl}/functions/v1/chatgoo-webhook`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
          "x-internal-meta-relay": "1",
        },
        body: rawBody,
      });

      const automationBody = await automationResponse.text();
      if (!automationResponse.ok) {
        await admin.from("chatgoo_events").insert({
          direction: "inbound",
          event: "meta_relay",
          decision: "SEND_FAILED",
          reason: `AUTOMATION_HTTP_${automationResponse.status}`,
          payload: { response: automationBody.slice(0, 1000) },
        });
      }
    }
  } catch (error) {
    await admin.from("chatgoo_events").insert({
      direction: "inbound",
      event: "meta_relay",
      decision: "BLOCKED",
      reason: "INVALID_META_PAYLOAD",
      payload: {
        error: error instanceof Error ? error.message : String(error),
        raw: rawBody.slice(0, 1000),
      },
    });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
