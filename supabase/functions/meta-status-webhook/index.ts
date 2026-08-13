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

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const body = await req.json().catch(() => ({}));

  try {
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
  } catch (_e) { /* never break the webhook */ }

  return new Response(JSON.stringify({ received: true }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
