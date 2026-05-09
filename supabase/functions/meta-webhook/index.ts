import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

 const HANDLER_VERSION = "2.1.4-DEBUG-SENDER";
const SINDICATO_CLINIC_ID = "89e7585e-7bce-4e58-91fa-c37080d1170d";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  console.log('[WEBHOOK_HIT]');
  
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const VERIFY_TOKEN = "viva_as_associacoes_2024";

  if (req.method === "GET") {
    const url = new URL(req.url);
    const hubMode = url.searchParams.get("hub.mode");
    const hubChallenge = url.searchParams.get("hub.challenge");
    const hubVerifyToken = url.searchParams.get("hub.verify_token");

    if (hubMode === 'subscribe' && hubVerifyToken === VERIFY_TOKEN) {
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

    // FILTRO DE STATUS: Importante para não responder a confirmações de entrega
    const statuses = body.entry?.[0]?.changes?.[0]?.value?.statuses;
    if (statuses && statuses.length > 0) {
      console.log('[SKIP] Status update:', statuses[0].status);
      return new Response("ok", { status: 200 });
    }

    const value = body.entry?.[0]?.changes?.[0]?.value;
    const message = value?.messages?.[0];

    if (!message) {
      console.log('[SKIP] No message object in payload');
      return new Response("No message", { status: 200 });
    }

    const from = message.from;
    const msgType = message.type;
    // O ID do número que recebeu a mensagem (importante para enviar de volta pelo mesmo canal)
     const recipient_phone_id = value?.metadata?.phone_number_id;
     const display_phone_number = value?.metadata?.display_phone_number;
     
     console.log('[DEBUG_PAYLOAD]', {
       metadata: value?.metadata,
       contacts: value?.contacts,
       messages: value?.messages
     });
    
    let msgText = "";
    let buttonId = "";

    if (msgType === 'text') {
      msgText = message.text?.body || "";
    } else if (msgType === 'interactive') {
      buttonId = message.interactive?.button_reply?.id;
      msgText = message.interactive?.button_reply?.title || "";
    }

     console.log('[INCOMING]', { from, msgType, msgText, buttonId, recipient_phone_id, display_phone_number });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const TOKEN = Deno.env.get("META_WHATSAPP_TOKEN");
    
    if (!recipient_phone_id || !TOKEN) {
      console.error('[ERROR] Missing META credentials');
      return new Response("missing_creds", { status: 200 });
    }

    const phoneReceived = from;
    const normalizedPhone = from.replace(/\D/g, '');

    const { data: session } = await supabase
      .from('whatsapp_sessions')
      .select('*')
      .eq('phone', normalizedPhone)
      .maybeSingle();

    const sendMetaMessage = async (messagePayload: any) => {
      // Usamos o recipient_phone_id dinâmico que veio no webhook
      const url = `https://graph.facebook.com/v22.0/${recipient_phone_id}/messages`;
      const finalPayload = {
        messaging_product: 'whatsapp',
        to: from,
        ...messagePayload
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${TOKEN}`, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify(finalPayload)
      });

      const responseText = await res.text();
      console.log('[META_RESPONSE]', res.status, responseText);
      return res;
    };

    // --- MANDATORY STATE MACHINE ARCHITECTURE ---

    // 1. TRANSITIONS (DECLARATIVE)
    const transitions: Record<string, Record<string, string>> = {
      'MAIN_MENU': {
        'sind_empresa': 'EMPRESA_MENU',
        'sind_associado': 'ASSOCIADO_FLOW',
        'sind_contabilidade': 'CONTABILIDADE_FLOW'
      },
      'EMPRESA_MENU': {
        'segunda_via_btn': 'SELECT_BOLETO_TYPE'
      },
      'SELECT_BOLETO_TYPE': {
        'boleto_a_vencer': 'WAITING_CNPJ',
        'boleto_vencido': 'WAITING_CNPJ'
      },
      'WAITING_CNPJ': {
        // Transitions are logic-based in the view for CNPJ
      },
      'CONFIRM_EMPLOYER': {
        'boleto_sim': 'SELECT_CONTRIBUTION_TYPE',
        'boleto_nao': 'WAITING_CNPJ'
      }
    };

    const sessionFound = !!session;
    console.log('[SESSION_LOOKUP]', {
      phoneReceived,
      normalizedPhone,
      sessionFound,
      state: session?.state
    });

    // 2. ROUTER (SINGLE)
    const currentState = session?.state || 'MAIN_MENU';
    const inputId = buttonId || msgText.toLowerCase().trim();

    console.log('[TRANSITION_INPUT]', {
      currentState,
      inputId
    });

    let nextState = transitions[currentState]?.[inputId];

    // Start logic: "oi" or "menu" or no session always goes to MAIN_MENU
    const startingKeywords = ['oi', 'olá', 'ola', 'menu', 'inicio', 'início'];
    if (startingKeywords.includes(inputId) || !session) {
      nextState = 'MAIN_MENU';
    }

    console.log('[NEXT_STATE]', nextState);

    // 3. FALLBACK PROTECTION (NO AUTOMATIC FALLBACK)
    if (!nextState) {
      // Allow text input for specific states
      const textInputStates = ['WAITING_CNPJ', 'SELECT_CONTRIBUTION_TYPE'];
      if (textInputStates.includes(currentState)) {
        nextState = currentState;
      } else {
        console.log('[DEBUG] TRANSITION_NOT_FOUND', { currentState, inputId });
        await sendMetaMessage({ 
          type: 'text', 
          text: { body: `[DEBUG] TRANSITION_NOT_FOUND\nEstado: ${currentState}\nBotão: ${inputId}` } 
        });
        return new Response("ok", { status: 200 });
      }
    }

    // 4. VIEWS / RENDERERS
    const sendMainMenu = async () => {
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
    };

    const sendEmpresaMenu = async () => {
      await sendMetaMessage({
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: 'Você selecionou *Sou Empresa*. Como podemos ajudar?' },
          action: {
            buttons: [
              { type: 'reply', reply: { id: 'segunda_via_btn', title: '2ª Via Boleto' } }
            ]
          }
        }
      });
    };

    const delegateToBoletoFlow = async (action: 'start' | 'continue') => {
      const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/boleto-whatsapp-flow`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          clinic_id: SINDICATO_CLINIC_ID,
          phone: from,
          message: inputId,
          action: action
        })
      });
      const data = await res.json();
      if (data.response) {
        let payload: any = { type: 'text', text: { body: data.response } };
        if (data.buttons && data.buttons.length > 0) {
          payload = {
            type: 'interactive',
            interactive: {
              type: 'button',
              body: { text: data.response },
              action: {
                buttons: data.buttons.map((b: any) => ({
                  type: 'reply', reply: { id: b.id, title: b.title }
                }))
              }
            }
          };
        }
        await sendMetaMessage(payload);
        return data.newState;
      }
      return nextState;
    };

    const delegateToAI = async () => {
      const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/whatsapp-ai-assistant`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          clinic_id: SINDICATO_CLINIC_ID,
          phone: from,
          message: inputId,
          deliver_response_via_caller: true
        })
      });
      const data = await res.json();
      if (data.response) {
        await sendMetaMessage({ type: 'text', text: { body: data.response } });
      }
    };

    // 5. EXECUTION & PERSISTENCE
    let finalState = nextState;
    
    // Mandatory log before rendering
    console.log('[MENU_RENDER]', nextState);

    if (nextState === 'MAIN_MENU') {
      await sendMainMenu();
    } else if (nextState === 'EMPRESA_MENU') {
      await sendEmpresaMenu();
    } else if (['SELECT_BOLETO_TYPE', 'WAITING_CNPJ', 'CONFIRM_EMPLOYER', 'SELECT_CONTRIBUTION_TYPE'].includes(nextState)) {
      // If we just entered SELECT_BOLETO_TYPE from EMPRESA_MENU, it's a 'start' action
      const isTransitionToBoleto = currentState === 'EMPRESA_MENU' && inputId === 'segunda_via_btn';
      const action = isTransitionToBoleto ? 'start' : 'continue';
      
      finalState = await delegateToBoletoFlow(action);
    } else {
      await delegateToAI();
      finalState = nextState || 'ASSOCIADO_FLOW';
    }

    // FINAL SAVE
    console.log('[SESSION_SAVE_ATTEMPT]', {
      phone: normalizedPhone,
      oldState: currentState,
      nextState: finalState
    });

    const { error: saveError } = await supabase
      .from('whatsapp_sessions')
      .upsert(
        {
          phone: normalizedPhone,
          state: finalState,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'phone' }
      );

    if (saveError) {
      console.error('[SESSION_SAVE_ERROR]', saveError);
    } else {
      console.log('[SESSION_SAVE_SUCCESS]', {
        phone: normalizedPhone,
        savedState: finalState
      });
    }

    return new Response("ok", { status: 200 });

    return new Response("ok", { status: 200 });

  } catch (e) {
    console.error("[ERROR]", e);
    return new Response(JSON.stringify({ ok: false, error: e.message }), { 
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
