import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

  const HANDLER_VERSION = "3.0.0-PRODUCTION";
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

    // MANDATORY LOGS
    console.log('[FULL_WEBHOOK_BODY]', JSON.stringify(body, null, 2));
    console.log('[RAW_META_PAYLOAD]', JSON.stringify(body, null, 2));

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
    const recipient_phone_id = value?.metadata?.phone_number_id;
    
    let msgText = "";
    let buttonId = "";
    let buttonTitle = "";

    if (msgType === 'text') {
      msgText = message.text?.body || "";
    } else if (msgType === 'interactive') {
      buttonId = message.interactive?.button_reply?.id;
      buttonTitle = message.interactive?.button_reply?.title || "";
      msgText = buttonTitle;
    }

    console.log('[BUTTON_REPLY_ID]', buttonId);
    console.log('[BUTTON_REPLY_TITLE]', buttonTitle);

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

    const logAudit = async (direction: 'incoming' | 'outgoing', content: string, type: string, bId?: string, state?: string, meta: any = {}) => {
      try {
        await supabase.from('whatsapp_audit_logs').insert({
          phone: normalizedPhone,
          direction,
          content,
          message_type: type,
          button_id: bId,
          session_state: state,
          metadata: meta
        });
      } catch (e) {
        console.error('[AUDIT_ERROR]', e);
      }
    };

    const sendMetaMessage = async (messagePayload: any, functionName = 'meta-webhook') => {
      console.log('[MESSAGE_SENDER]', {
        functionName,
        currentState,
        messageType: messagePayload.type,
        payload: messagePayload
      });

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

      let content = "";
      if (messagePayload.type === 'text') content = messagePayload.text?.body;
      else if (messagePayload.type === 'interactive') content = messagePayload.interactive?.body?.text;

      await logAudit(
        'outgoing',
        content,
        messagePayload.type,
        "",
        nextState || currentState,
        { status: res.status, response: responseText }
      );

      return res;
    };

    // --- MANDATORY STATE MACHINE ARCHITECTURE ---

    // 1. TRANSITIONS (DECLARATIVE) - PRODUCTION VERSION
    const transitions: Record<string, Record<string, string>> = {
      'MAIN_MENU': {
        'empresa_btn': 'EMPRESA_MENU',
        'associado_btn': 'ASSOCIADO_MENU',
        'contabilidade_btn': 'CONTABILIDADE_MENU'
      },
      'ASSOCIADO_MENU': {
        'ass_carteirinha': 'CARTEIRINHA_FLOW',
        'ass_convenios': 'CONVENIOS_FLOW',
        'ass_atendimento': 'ATENDIMENTO_FLOW'
      },
      'EMPRESA_MENU': {
        'segunda_via_btn': 'SELECT_BOLETO_TYPE',
        'convencoes_btn': 'CONVENCOES_FLOW',
        'certidao_btn': 'CERTIDAO_FLOW'
      },
      'CONTABILIDADE_MENU': {
        'cont_segunda_via': 'SELECT_BOLETO_TYPE',
        'cont_convencoes': 'CONVENCOES_FLOW',
        'cont_homologacao': 'HOMOLOGACAO_FLOW'
      },
      'SELECT_BOLETO_TYPE': {
        'boleto_a_vencer': 'WAITING_CNPJ',
        'boleto_vencido': 'WAITING_CNPJ'
      },
      'WAITING_CNPJ': {},
      'CONFIRM_EMPLOYER': {
        'boleto_sim': 'SELECT_CONTRIBUTION_TYPE',
        'boleto_nao': 'WAITING_CNPJ'
      },
      'SELECT_CONTRIBUTION_TYPE': {
        'boleto_type_1': 'WAITING_PERIODO',
        'boleto_type_2': 'WAITING_PERIODO'
      },
      'CONFIRM_DATA': {
        'data_sim': 'SUCCESS',
        'data_nao': 'SELECT_BOLETO_TYPE'
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

    await logAudit('incoming', msgText, msgType, buttonId, currentState, { raw: value });

    console.log('[CURRENT_STATE]', currentState);

    let nextState = transitions[currentState]?.[inputId];

    // Start logic: "oi" or "menu" or no session always goes to MAIN_MENU
    const startingKeywords = ['oi', 'olá', 'ola', 'menu', 'inicio', 'início'];
    if (startingKeywords.includes(inputId)) {
      nextState = 'MAIN_MENU';
    } else if (!sessionFound) {
      nextState = transitions['MAIN_MENU']?.[inputId] || 'MAIN_MENU';
    }

    console.log('[NEXT_STATE]', nextState);
    console.log('[ROUTE_MATCH]', !!nextState);

    // 3. FALLBACK PROTECTION (STRICT)
    if (!nextState) {
      const textInputStates = [
        'WAITING_CNPJ', 'WAITING_PERIODO', 'WAITING_VENCIMENTO', 'WAITING_VALOR', 'CONFIRM_DATA'
      ];
      
      if (textInputStates.includes(currentState)) {
        nextState = currentState;
      } else {
        console.log('[DEBUG] TRANSITION_NOT_FOUND', { currentState, inputId });
        console.log('[TRANSITION_MAP]', transitions[currentState]);
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
              { type: 'reply', reply: { id: 'empresa_btn', title: 'Sou Empresa' } },
              { type: 'reply', reply: { id: 'associado_btn', title: 'Sou Associado' } },
              { type: 'reply', reply: { id: 'contabilidade_btn', title: 'Contabilidade' } }
            ]
          }
        }
      });
    };

    const sendAssociadoMenu = async () => {
      await sendMetaMessage({
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: '👤 *Menu Associado*\n\nComo podemos ajudar você hoje?' },
          action: {
            buttons: [
              { type: 'reply', reply: { id: 'ass_carteirinha', title: 'Carteirinha' } },
              { type: 'reply', reply: { id: 'ass_convenios', title: 'Convênios' } },
              { type: 'reply', reply: { id: 'ass_atendimento', title: 'Atendimento' } }
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
          body: { text: '🏢 *Menu Empresa*\n\nComo podemos ajudar sua empresa hoje?' },
          action: {
            buttons: [
              { type: 'reply', reply: { id: 'segunda_via_btn', title: '2ª Via Boleto' } },
              { type: 'reply', reply: { id: 'convencoes_btn', title: 'Convenções' } },
              { type: 'reply', reply: { id: 'certidao_btn', title: 'Certidão' } }
            ]
          }
        }
      });
    };

    const sendContabilidadeMenu = async () => {
      await sendMetaMessage({
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: '📊 *Menu Contabilidade*\n\nComo podemos ajudar você hoje?' },
          action: {
            buttons: [
              { type: 'reply', reply: { id: 'cont_segunda_via', title: '2ª Via Boleto' } },
              { type: 'reply', reply: { id: 'cont_convencoes', title: 'Convenções' } },
              { type: 'reply', reply: { id: 'cont_homologacao', title: 'Homologação' } }
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

    const sendNavigationButtons = async (bodyText: string) => {
      await sendMetaMessage({
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: bodyText },
          action: {
            buttons: [
              { type: 'reply', reply: { id: 'go_back', title: 'Voltar' } },
              { type: 'reply', reply: { id: 'menu', title: 'Menu Principal' } }
            ]
          }
        }
      });
    };

    // 5. EXECUTION & PERSISTENCE
    let finalState = nextState;
    
    // Handle navigation buttons globally
    if (inputId === 'go_back') {
      // Determine previous menu based on current state
      if (['ASSOCIADO_MENU', 'EMPRESA_MENU', 'CONTABILIDADE_MENU'].includes(currentState)) {
        nextState = 'MAIN_MENU';
      } else if (['CARTEIRINHA_FLOW', 'CONVENIOS_FLOW', 'ATENDIMENTO_FLOW'].includes(currentState)) {
        nextState = 'ASSOCIADO_MENU';
      } else if (['SELECT_BOLETO_TYPE', 'CONVENCOES_FLOW', 'HOMOLOGACAO_FLOW', 'OUTROS_FLOW'].includes(currentState)) {
        // Could be from EMPRESA or CONTABILIDADE
        // We look at the session metadata or just go to MAIN_MENU if unsure
        nextState = 'MAIN_MENU'; // Fallback to safe menu
      } else {
        nextState = 'MAIN_MENU';
      }
    }

    // Mandatory log before rendering
    console.log('[MENU_RENDER]', nextState);

    const isBoletoState = (state: string) => ['SELECT_BOLETO_TYPE', 'WAITING_CNPJ', 'CONFIRM_EMPLOYER', 'SELECT_CONTRIBUTION_TYPE', 'WAITING_PERIODO', 'WAITING_VENCIMENTO', 'WAITING_VALOR', 'CONFIRM_DATA', 'SUCCESS'].includes(state);

    if (nextState === 'MAIN_MENU') {
      await sendMainMenu();
    } else if (nextState === 'ASSOCIADO_MENU') {
      await sendAssociadoMenu();
    } else if (nextState === 'EMPRESA_MENU') {
      await sendEmpresaMenu();
    } else if (nextState === 'CONTABILIDADE_MENU') {
      await sendContabilidadeMenu();
    } else if (nextState === 'CARTEIRINHA_FLOW') {
      await sendNavigationButtons('atualizar sua carteirinha digital pelo aplicativo é simples e rápido. Basta acessar a aba “Atualizar Carteirinha” e seguir as instruções na tela.\n\nPara concluir o processo, é necessário enviar o seu contracheque mais recente diretamente pelo aplicativo Secmi.');
      finalState = nextState;
    } else if (isBoletoState(nextState)) {
      const isTransitionToBoleto = (currentState === 'EMPRESA_MENU' && inputId === 'segunda_via_btn') || 
                                   (currentState === 'CONTABILIDADE_MENU' && inputId === 'cont_segunda_via');
      const action = isTransitionToBoleto ? 'start' : 'continue';
      finalState = await delegateToBoletoFlow(action);
    } else {
      // Fallback response for missing flow implementations
      await sendMetaMessage({ type: 'text', text: { body: "Esta funcionalidade está sendo configurada. Por favor, escolha outra opção ou digite 'Menu'." } });
      finalState = 'MAIN_MENU';
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

    console.log('[SESSION_SAVE_RESULT]', {
      phone: normalizedPhone,
      savedState: finalState,
      error: saveError ? saveError.message : null,
      success: !saveError
    });

    return new Response("ok", { status: 200 });

  } catch (e) {
    console.error("[ERROR]", e);
    return new Response(JSON.stringify({ ok: false, error: e.message }), { 
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
