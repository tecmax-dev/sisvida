import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

    const HANDLER_VERSION = "1.0.5-FINAL-DIAGNOSTIC";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    return new Response(JSON.stringify({ 
      status: "online", 
      version: HANDLER_VERSION,
      timestamp: new Date().toISOString()
    }), { 
      status: 200, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }

  try {
    const body = await req.json();
    console.log('[STEP_1_MESSAGE_RECEIVED]', new Date().toISOString());
    console.log('[RAW_PAYLOAD]', JSON.stringify(body, null, 2));

    console.log('[WEBHOOK_RECEIVED]');
    const PHONE_NUMBER_ID = Deno.env.get("META_PHONE_NUMBER_ID");
    const TOKEN = Deno.env.get("META_WHATSAPP_TOKEN");
    const url = `https://graph.facebook.com/v22.0/${PHONE_NUMBER_ID}/messages`;

    console.log('[PHONE_NUMBER_ID]', PHONE_NUMBER_ID);
    console.log('[META_URL]', url);
    console.log('[TOKEN_PREFIX]', TOKEN?.slice(0, 10));

    if (!PHONE_NUMBER_ID || !TOKEN) {
      console.log('[META_SEND_FAIL] Missing credentials');
      return new Response("missing_creds", { status: 200 });
    }

    const user = (body.chatId || body.raw_message?.from || "").toString().replace(/\D/g, "");
    if (!user) {
      console.log('[META_SEND_FAIL] No user found');
      return new Response("no_user", { status: 200 });
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: user,
        type: 'text',
        text: {
          body: '[TESTE_META] ENVIO_OK'
        }
      })
    });

    console.log('[META_STATUS]', response.status);
    const responseBody = await response.text();
    console.log('[META_RESPONSE]', responseBody);

    if (response.ok) {
      console.log('[META_SEND_SUCCESS]');
    } else {
      console.log('[META_SEND_FAIL]');
    }

    return new Response(responseBody, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (e) {
    console.error("[ERROR]", e);
    return new Response(JSON.stringify({ ok: false, error: e.message }), { 
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
