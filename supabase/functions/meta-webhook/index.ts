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
     console.log('[WEBHOOK_RECEIVED]', new Date().toISOString());
     console.log('[RAW_PAYLOAD]', JSON.stringify(body, null, 2));
 
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
 
     // 1. EXTRAIR DADOS DA MENSAGEM
     let phone = "";
     let messageText = "";
     let buttonId = "";
     let buttonTitle = "";
 
      // 1. EXTRAÇÃO PURA DA META (OPÇÃO A)
      if (body.object !== 'whatsapp_business_account') {
        console.log('[RAW_PAYLOAD_REJECTED] Not Meta format');
        return new Response("not_meta_format", { status: 200 });
      }

      console.log('[RAW_META_PAYLOAD]', JSON.stringify(body, null, 2));

      const entry = body.entry?.[0];
      const change = entry?.changes?.[0];
      const value = change?.value;
      const message = value?.messages?.[0];
      
      if (!message) {
        console.log('[DEBUG] No message in Meta payload');
        return new Response("no_message", { status: 200 });
      }

      phone = message.from;
      if (message.type === 'text') {
        messageText = message.text?.body;
      } else if (message.type === 'interactive') {
        const interactive = message.interactive;
        if (interactive.type === 'button_reply') {
          const buttonReply = interactive.button_reply;
          buttonId = buttonReply?.id;
          buttonTitle = buttonReply?.title;
          console.log('[BUTTON_REPLY_ID]', buttonId);
          console.log('[BUTTON_REPLY_TITLE]', buttonTitle);
        }
      }

      if (!phone) {
        console.log('[META_SEND_FAIL] No user phone found');
        return new Response("no_phone", { status: 200 });
      }

      console.log('[USER_PHONE]', phone);
 
     if (!phone) {
       console.log('[META_SEND_FAIL] No user phone found');
       return new Response("no_phone", { status: 200 });
     }
 
     console.log('[USER_PHONE]', phone);
     if (buttonId) {
       console.log('[RAW_BUTTON_PAYLOAD]', JSON.stringify(body, null, 2));
       console.log('[BUTTON_ID]', buttonId);
       console.log('[BUTTON_TITLE]', buttonTitle);
     }
 
     // 2. BUSCAR OU CRIAR SESSÃO
     console.log('[SESSION_LOOKUP]');
     const { data: session, error: sessionError } = await supabase
       .from('whatsapp_sessions')
       .select('*')
       .eq('phone', phone)
       .single();
 
     let currentState = 'MAIN_MENU';
     if (session) {
       console.log('[SESSION_FOUND]');
       currentState = session.state;
     } else {
       console.log('[SESSION_NOT_FOUND] Initializing MAIN_MENU');
       await supabase.from('whatsapp_sessions').insert({ phone, state: 'MAIN_MENU' });
     }
     console.log('[CURRENT_STATE]', currentState);
 
     // 3. LOGICA DE ROTEAMENTO (SINGLE ROUTER)
     let nextState = currentState;
     let responseMessage: any = null;
 
      // 3. LOGICA DE ROTEAMENTO (SINGLE ROUTER)
      let nextState = currentState;
      let responseMessage: any = null;
      let routeMatch = "";

      // FASE 1.5: VALIDAÇÃO DO BUTTON_REPLY.ID REAL
      if (buttonId === 'empresa_btn') {
        routeMatch = 'EMPRESA_ROUTE';
        responseMessage = {
          type: 'text',
          text: { body: '[BTN_OK] empresa_btn' }
        };
        nextState = 'EMPRESA_FLOW'; // Simulando transição
      } else if (buttonId === 'associado_btn') {
        routeMatch = 'ASSOCIADO_ROUTE';
        responseMessage = {
          type: 'text',
          text: { body: '[BTN_OK] associado_btn' }
        };
        nextState = 'ASSOCIADO_FLOW'; // Simulando transição
     } else if (messageText && messageText.toLowerCase().includes('oi')) {
        routeMatch = 'WELCOME_ROUTE';
        // Enviar menu com 2 botões reais da Meta
       responseMessage = {
         type: 'interactive',
         interactive: {
           type: 'button',
            body: { text: 'Escolha seu perfil:' },
           action: {
             buttons: [
               {
                 type: 'reply',
                  reply: { id: 'empresa_btn', title: 'Empresa' }
                },
                {
                  type: 'reply',
                  reply: { id: 'associado_btn', title: 'Associado' }
                }
             ]
           }
         }
       };
       nextState = 'MAIN_MENU';
     } else {
        routeMatch = 'NONE';
       responseMessage = {
         type: 'text',
         text: { body: '[DEBUG] TRANSITION_NOT_FOUND' }
       };
     }

      console.log('[ROUTE_MATCH]', routeMatch);
      console.log('[CURRENT_STATE]', currentState);
      console.log('[NEXT_STATE]', nextState);
 
     // 4. ATUALIZAR SESSÃO
     if (nextState !== currentState) {
       console.log('[NEXT_STATE]', nextState);
       const { error: updateError } = await supabase
         .from('whatsapp_sessions')
         .update({ state: nextState })
         .eq('phone', phone);
       
       if (!updateError) console.log('[SESSION_SAVE_SUCCESS]');
     }
 
     // 5. ENVIAR (SINGLE SENDER)
     if (responseMessage) {
       const url = `https://graph.facebook.com/v22.0/${PHONE_NUMBER_ID}/messages`;
       const res = await fetch(url, {
         method: 'POST',
         headers: {
           'Authorization': `Bearer ${TOKEN}`,
           'Content-Type': 'application/json'
         },
         body: JSON.stringify({
           messaging_product: 'whatsapp',
           to: phone,
           ...responseMessage
         })
       });
 
       const resData = await res.text();
       console.log('[META_STATUS]', res.status);
       console.log('[META_RESPONSE]', resData);
 
       if (res.ok) {
         console.log('[META_SEND_SUCCESS]');
       } else {
         console.log('[META_SEND_FAIL]');
       }
 
       return new Response(resData, {
         status: 200,
         headers: { ...corsHeaders, "Content-Type": "application/json" }
       });
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
