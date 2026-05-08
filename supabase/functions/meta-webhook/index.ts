import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

  const HANDLER_VERSION = "1.0.3-SEND-DIAGNOSTIC";

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

    // Extraction (Phone Only)
    const from = (
      body.raw_message?.from || 
      body.chatId || 
      body.wa_id || 
      body.phone || 
      ""
    ).toString().replace(/\D/g, "");

    console.log('[EXTRACTED_PHONE]', from);

    if (!from) {
      console.log('[ERROR] No phone found in payload');
      return new Response(JSON.stringify({ ok: false, reason: "no phone" }), { status: 200 });
    }

    const META_TOKEN = Deno.env.get('META_WHATSAPP_TOKEN');
    const PHONE_ID = Deno.env.get("META_PHONE_NUMBER_ID") || "1110151302179856";
    const to = from.startsWith('55') ? from : `55${from}`;

    console.log('[ATTEMPTING_SEND]', { to, phone_id: PHONE_ID });

    // MANDATORY SEND TEST
    const sendWhatsAppMessage = async (recipient: string, message: string) => {
      const payload = {
        messaging_product: 'whatsapp',
        to: recipient,
        type: 'text',
        text: { body: message }
      };

      console.log('[SEND_REQUEST_PAYLOAD]', JSON.stringify(payload));

      const res = await fetch(`https://graph.facebook.com/v21.0/${PHONE_ID}/messages`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${META_TOKEN}`, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify(payload),
      });

      const status = res.status;
      const resultText = await res.text();
      
      let resultJson;
      try { resultJson = JSON.parse(resultText); } catch { resultJson = resultText; }

      return { status, body: resultJson };
    };

    const sendResult = await sendWhatsAppMessage(to, 'TESTE DIRETO');

    console.log('[STEP_2_SEND_RESULT]');
    console.log(JSON.stringify(sendResult, null, 2));

    return new Response(JSON.stringify({ 
      ok: true, 
      sendResult,
      version: HANDLER_VERSION 
    }), { 
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
