 import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
 import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
 
 const HANDLER_VERSION = "2.0.0-FLOW-RECONSTRUCTION";

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
      
      // Log headers for topology identification
      const headersObj: Record<string, string> = {};
      req.headers.forEach((value, key) => {
        headersObj[key] = value;
      });

      console.log('[DEBUG_HEADERS]', JSON.stringify(headersObj, null, 2));
      console.log('[FULL_WEBHOOK_BODY]', JSON.stringify(body, null, 2));

      const isNativeMeta = body.object === 'whatsapp_business_account' && body.entry?.[0]?.changes?.[0]?.value?.messages;
      const isZapResponder = body.raw_message || body.message;

      console.log('[TOPOLOGY_CHECK]', { 
        isNativeMeta, 
        isZapResponder,
        detectedKeys: Object.keys(body)
      });

      // TEMPORARY: Allow both to allow diagnosis
      if (!isNativeMeta && !isZapResponder) {
        console.log('[FATAL_ERROR] Webhook source unknown.');
        return new Response("Unknown source", { status: 403 });
      }
 
     const supabase = createClient(
       Deno.env.get('SUPABASE_URL') ?? '',
       Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
     );
 
     const PHONE_NUMBER_ID = Deno.env.get("META_PHONE_NUMBER_ID");
     const TOKEN = Deno.env.get("META_WHATSAPP_TOKEN");
     
     if (!PHONE_NUMBER_ID || !TOKEN) {
       console.log('[META_SEND_FAIL] Missing credentials');
       return new Response("missing_creds", { status: 200 });
     }
 
    // 1. EXTRAÇÃO DE DADOS (NATURAL META ONLY)
    const message = body.entry[0].changes[0].value.messages[0];
    const phone = message.from;
    let messageText = "";
    let buttonId = "";
    let buttonTitle = "";

    if (message.type === 'text') {
      messageText = message.text?.body;
    }
    
    if (message.type === 'interactive') {
      buttonId = message.interactive?.button_reply?.id;
      buttonTitle = message.interactive?.button_reply?.title;
      console.log('[INTERACTIVE_RECEIVED]', { buttonId, buttonTitle });
    }

    const user = phone; // Alias conforme solicitado no snippet

    // 2. BLOCO DE ENVIO OBRIGATÓRIO (Diagnóstico Puro)
    if (messageText && messageText.toLowerCase().includes('oi')) {
      try {
        const payload = {
          messaging_product: 'whatsapp',
          to: user,
          type: 'interactive',
          interactive: {
            type: 'button',
            body: {
              text: 'Teste Botões Meta'
            },
            action: {
              buttons: [
                {
                  type: 'reply',
                  reply: {
                    id: 'empresa_btn',
                    title: 'Empresa'
                  }
                },
                {
                  type: 'reply',
                  reply: {
                    id: 'associado_btn',
                    title: 'Associado'
                  }
                }
              ]
            }
          }
        }

        console.log('[META_INTERACTIVE_PAYLOAD]', JSON.stringify(payload, null, 2))

        const response = await fetch(
          `https://graph.facebook.com/v22.0/${PHONE_NUMBER_ID}/messages`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${TOKEN}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
          }
        )

        console.log('[META_STATUS]', response.status)

        const text = await response.text()
        console.log('[META_RESPONSE]', text)

        return new Response(text, { status: 200 });

      } catch (error) {
        console.log('[SEND_EXCEPTION]', error)
        return new Response(JSON.stringify({ error: error.message }), { status: 200 });
      }
    }

    // 3. ROUTER DE RESPOSTA (Diagnóstico)
    if (buttonId) {
      let responseText = "";
      
      if (buttonId === 'empresa_btn') {
        responseText = `[BTN_OK] Você escolheu: EMPRESA\nID: ${buttonId}\nTitle: ${buttonTitle}\nStatus: Transition OK`;
      } else if (buttonId === 'associado_btn') {
        responseText = `[BTN_OK] Você escolheu: ASSOCIADO\nID: ${buttonId}\nTitle: ${buttonTitle}\nStatus: Transition OK`;
      } else {
        responseText = `[BTN_UNKNOWN] Botão não reconhecido: ${buttonId}`;
      }

      console.log('[ROUTE_MATCH]', { buttonId, responseText });

      const payload = {
        messaging_product: 'whatsapp',
        to: phone,
        type: 'text',
        text: { body: responseText }
      };

      const res = await fetch(`https://graph.facebook.com/v22.0/${PHONE_NUMBER_ID}/messages`, {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${TOKEN}`, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify(payload)
      });
      
      console.log('[BTN_RESPONSE_STATUS]', res.status);
    }
 
     return new Response("ok", { status: 200 });
 
   } catch (e) {
    console.error("[ERROR]", e);
    return new Response(JSON.stringify({ ok: false, error: e.message }), { 
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
