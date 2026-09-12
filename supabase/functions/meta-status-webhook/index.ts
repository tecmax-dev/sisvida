import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VERIFY_TOKEN = Deno.env.get("META_WEBHOOK_VERIFY_TOKEN") || "sindexa-status-2026";

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
