import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  console.log('[WEBHOOK_HIT]');
  
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Verification for Meta Webhook setup
  const hubMode = new URL(req.url).searchParams.get("hub.mode");
  if (hubMode === 'subscribe') {
    const hubChallenge = new URL(req.url).searchParams.get("hub.challenge");
    return new Response(hubChallenge, { status: 200 });
  }

  try {
    const body = await req.json();
    console.log('[FULL_WEBHOOK_BODY]', JSON.stringify(body, null, 2));

    // Extract essential info
    const entry = body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    
    // Skip status updates
    if (value?.statuses) {
      console.log('[SKIP] Status update');
      return new Response("ok", { status: 200 });
    }

    const message = value?.messages?.[0];
    if (!message) {
      console.log('[SKIP] No message');
      return new Response("ok", { status: 200 });
    }

    const from = message.from;
    const messageText = message.text?.body || "Interactive/Other";
    const recipient_phone_id = value?.metadata?.phone_number_id;
    const META_PHONE_NUMBER_ID = Deno.env.get("META_PHONE_NUMBER_ID");
    const META_ACCESS_TOKEN = Deno.env.get("META_WHATSAPP_TOKEN");

    console.log('[PHONE_NUMBER_ID]', META_PHONE_NUMBER_ID);
    console.log('[META_TOKEN_EXISTS]', !!META_ACCESS_TOKEN);
    console.log('[MESSAGE_FROM]', from);
    console.log('[MESSAGE_TEXT]', messageText);

    // SEND MINIMAL RESPONSE
    const url = `https://graph.facebook.com/v22.0/${recipient_phone_id}/messages`;
    const payload = {
      messaging_product: "whatsapp",
      to: from,
      type: "text",
      text: { body: "[TESTE_OK]\nMensagem recebida com sucesso" }
    };

    console.log('[META_REQUEST_URL]', url);
    console.log('[META_PAYLOAD]', JSON.stringify(payload, null, 2));

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${META_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    console.log('[META_STATUS]', response.status);
    console.log('[META_RESPONSE]', responseText);

    return new Response("ok", { status: 200 });

  } catch (e) {
    console.error("[ERROR]", e.message);
    return new Response("error", { status: 200 });
  }
});
