 import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
 import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
 
const HANDLER_VERSION = "2.1.0-SINDICATO-ROUTER";
const SINDICATO_CLINIC_ID = "89e7585e-7bce-4e58-91fa-c37080d1170d";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

 serve(async (req) => {
   console.log('[WEBHOOK_HIT]');
   console.log('[METHOD]', req.method);
   console.log('[HEADERS]', JSON.stringify(Object.fromEntries(req.headers.entries()), null, 2));
 
   if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
 
   // Token hardcoded para garantir validação imediata enquanto secrets propagam
   const VERIFY_TOKEN = "viva_as_associacoes_2024";
 
   // Verification for Meta Webhook setup
   if (req.method === "GET") {
     const url = new URL(req.url);
     const hubMode = url.searchParams.get("hub.mode");
     const hubChallenge = url.searchParams.get("hub.challenge");
     const hubVerifyToken = url.searchParams.get("hub.verify_token");
 
     console.log('[GET_VERIFY_ATTEMPT]', { hubMode, hubVerifyToken, expected: VERIFY_TOKEN });
 
     if (hubMode === 'subscribe' && hubVerifyToken === VERIFY_TOKEN) {
       console.log('[VERIFY_SUCCESS]');
       return new Response(hubChallenge, { status: 200 });
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
       console.log('[FULL_WEBHOOK_BODY]', JSON.stringify(body, null, 2));

      const isNativeMeta = body.object === 'whatsapp_business_account' && 
                          (body.entry?.[0]?.changes?.[0]?.value?.messages || body.entry?.[0]?.changes?.[0]?.value?.statuses);
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
      
      console.log('[PHONE_NUMBER_ID]', PHONE_NUMBER_ID);
 
      if (!PHONE_NUMBER_ID || !TOKEN) {
       console.log('[META_SEND_FAIL] Missing credentials');
       return new Response("missing_creds", { status: 200 });
     }
 
    // 1. EXTRAÇÃO DE DADOS (NATIVE META ONLY)
    const entry = body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const message = value?.messages?.[0];

    if (!message) {
      console.log('[SKIP] No message in payload');
      return new Response("No message", { status: 200 });
    }

    const from = message.from;
    const msgType = message.type;
    let msgText = "";
    let buttonId = "";

    if (msgType === 'text') {
      msgText = message.text?.body || "";
    } else if (msgType === 'interactive') {
      buttonId = message.interactive?.button_reply?.id;
      msgText = message.interactive?.button_reply?.title || "";
    }

    console.log('[TOPOLOGY_CHECK] Native Meta payload received');
    console.log('[INCOMING]', { from, msgType, msgText, buttonId, version: HANDLER_VERSION });

    // 2. GESTÃO DE SESSÃO
    const { data: session } = await supabase
      .from('whatsapp_sessions')
      .select('*')
      .eq('phone', from)
      .maybeSingle();

    const isStart = msgText.toLowerCase().includes('oi') || 
                   msgText.toLowerCase().includes('olá') || 
                   msgText.toLowerCase().includes('menu') ||
                   !session;

     // 3. ROUTER SINDICATO
     const sendMetaMessage = async (messagePayload: any) => {
       const url = `https://graph.facebook.com/v22.0/${PHONE_NUMBER_ID}/messages`;
       const finalPayload = {
         messaging_product: 'whatsapp',
         to: from,
         ...messagePayload
       };
 
       console.log('[META_SEND_ATTEMPT]');
       console.log('[META_PAYLOAD]', JSON.stringify(finalPayload, null, 2));
 
       const res = await fetch(url, {
         method: 'POST',
         headers: { 
           'Authorization': `Bearer ${TOKEN}`, 
           'Content-Type': 'application/json' 
         },
         body: JSON.stringify(finalPayload)
       });
 
       const responseText = await res.text();
       console.log('[META_STATUS]', res.status);
       console.log('[META_RESPONSE]', responseText);
 
       return new Response(responseText, { status: res.status });
     };

    // FLOW: MAIN MENU
    if (isStart && !buttonId) {
      await supabase.from('whatsapp_sessions').upsert({
        phone: from,
        state: 'MAIN_MENU',
        updated_at: new Date().toISOString()
      });

      await sendMetaMessage({
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: 'Olá! 👋 Bem-vindo(a) ao *Sindicato dos Comerciários*.\n\nComo podemos ajudá-lo(a) hoje?' },
          action: {
            buttons: [
              { type: 'reply', reply: { id: 'sind_associado', title: 'Sou Associado' } },
              { type: 'reply', reply: { id: 'sind_empresa', title: 'Sou Empresa' } },
              { type: 'reply', reply: { id: 'sind_contabilidade', title: 'Contabilidade' } }
            ]
          }
        }
      });
      return new Response("ok", { status: 200 });
    }

    // FLOW: EMPRESA (BOLETO)
    if (buttonId === 'sind_empresa' || session?.state?.startsWith('BOLETO_')) {
      // Forward to boleto flow logic
      console.log('[ROUTING] To boleto-whatsapp-flow');
      const boletoRes = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/boleto-whatsapp-flow`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          clinic_id: SINDICATO_CLINIC_ID,
          phone: from,
          message: buttonId || msgText,
          action: buttonId === 'sind_empresa' ? 'start' : 'continue'
        })
      });

      const boletoData = await boletoRes.json();
      if (boletoData.response) {
        const payload: any = { type: 'text', text: { body: boletoData.response } };
        if (boletoData.buttons && boletoData.buttons.length > 0) {
          payload.type = 'interactive';
          payload.interactive = {
            type: 'button',
            body: { text: boletoData.response },
            action: {
              buttons: boletoData.buttons.map((b: any) => ({
                type: 'reply', reply: { id: b.id, title: b.title }
              }))
            }
          };
        }
        await sendMetaMessage(payload);
        
        // Update session state to BOLETO track
        await supabase.from('whatsapp_sessions').upsert({
          phone: from,
          state: 'BOLETO_' + (boletoData.newState || 'CONTINUE'),
          updated_at: new Date().toISOString()
        });
      }
      return new Response("ok", { status: 200 });
    }

    // FLOW: ASSOCIADO (AI ASSISTANT)
    if (buttonId === 'sind_associado' || session?.state === 'ASSOCIADO_FLOW') {
       console.log('[ROUTING] To whatsapp-ai-assistant');
       // Implement or forward to AI assistant
       const aiRes = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/whatsapp-ai-assistant`, {
         method: 'POST',
         headers: {
           'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
           'Content-Type': 'application/json'
         },
         body: JSON.stringify({
           clinic_id: SINDICATO_CLINIC_ID,
           phone: from,
           message: buttonId === 'sind_associado' ? 'menu' : msgText,
           deliver_response_via_caller: true // We handle sending here to keep it native
         })
       });
       
       const aiData = await aiRes.json();
       if (aiData.response) {
         await sendMetaMessage({ type: 'text', text: { body: aiData.response } });
       }

       await supabase.from('whatsapp_sessions').upsert({
         phone: from,
         state: 'ASSOCIADO_FLOW',
         updated_at: new Date().toISOString()
       });
       return new Response("ok", { status: 200 });
    }

    // DEFAULT: Forward to AI Assistant for any other input
    console.log('[ROUTING] Default to AI Assistant');
    const defaultRes = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/whatsapp-ai-assistant`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        clinic_id: SINDICATO_CLINIC_ID,
        phone: from,
        message: msgText,
        deliver_response_via_caller: true
      })
    });
    const defaultData = await defaultRes.json();
    if (defaultData.response) {
      await sendMetaMessage({ type: 'text', text: { body: defaultData.response } });
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
