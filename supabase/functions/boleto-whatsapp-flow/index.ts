import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SINDICATO_CLINIC_ID = "89e7585e-7bce-4e58-91fa-c37080d1170d";

   const BUILD_VERSION = 'FLOW_V2_BUILD_20260509_FIX';
 
 serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
     console.log(`[ENTRYPOINT][boleto-whatsapp-flow]`, BUILD_VERSION);
    const body = await req.json();
    const { clinic_id, phone, message, action, explicit_phone_id } = body;

    console.log('[USER_ID_RAW]', phone);
    console.log('[STATE_BEFORE_CLICK]', 'Fetching state from DB...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Obter ou criar sessão
    let { data: session } = await supabase
      .from('whatsapp_boleto_sessions')
      .select('*')
      .eq('clinic_id', clinic_id)
      .eq('phone', phone)
      // Removed expiration check for debugging/stability
      // .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    const isNewSession = !session;
    const isStartAction = action === 'start';
    
    if (isNewSession || isStartAction) {
      console.log('[SESSION_INIT_OR_RESET]', session ? 'Resetting' : 'Creating');
      const newState = 'SELECT_BOLETO_TYPE';
      
      const { data: updatedSession, error: upsertError } = await supabase
        .from('whatsapp_boleto_sessions')
        .upsert({
          clinic_id,
          phone,
          state: newState,
          expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString()
        }, { onConflict: 'clinic_id,phone' })
        .select()
        .single();

      if (upsertError) {
        console.error('[SESSION_UPSERT_FAILED]', upsertError);
        throw new Error("Session persistence failed");
      }
      session = updatedSession;
    }

    if (!session) {
      console.error('[SESSION_LOAD_FAILED]');
      throw new Error("Could not create session");
    }
    console.log('[SESSION_LOAD_SUCCESS]', session.id);

    console.log('[STATE_BEFORE_CLICK]', session.state);
    console.log('[BUTTON_CLICKED]', message);

    let responseText = "";
    let buttons: any[] = [];
    
    const rawText = (message || "").trim();
    const text = rawText.toLowerCase();
    
    console.log('[NORMALIZED_ACTION]', text);

    // 2. Máquina de Estados Simplificada e Robusta
    // Máquina de Estados com mapeamento explícito de botões
     // --- MANDATORY BOLETO STATE MACHINE ---
     const transitions: Record<string, Record<string, string>> = {
       'EMPRESA_MENU': {
         'segunda_via_btn': 'SELECT_BOLETO_TYPE'
       },
       'SELECT_BOLETO_TYPE': {
         'boleto_a_vencer': 'WAITING_CNPJ',
         'boleto_vencido': 'WAITING_CNPJ'
       },
      'CONFIRM_EMPLOYER': {
        'boleto_sim': 'SELECT_CONTRIBUTION_TYPE',
        'boleto_nao': 'WAITING_CNPJ'
      },
      'SELECT_CONTRIBUTION_TYPE': {
        'boleto_type_1': 'WAITING_PERIODO',
        'boleto_type_2': 'WAITING_PERIODO'
      }
     };

    // --- ROUTER ---
    console.log('[ROUTER_INPUT]', { state: session.state, input: text });
    
    let nextState = transitions[session.state]?.[text] || null;

    // Start logic override
    if (isStartAction) nextState = 'SELECT_BOLETO_TYPE';

    // Text input states persistence (allow state to persist while waiting for text)
    const textInputStates = ['WAITING_CNPJ', 'WAITING_PERIODO', 'WAITING_VENCIMENTO', 'WAITING_CONTRIBUICAO'];
    if (!nextState && textInputStates.includes(session.state)) {
      nextState = session.state;
    }

    console.log('[NEXT_STATE]', nextState);

    // 3. TRANSITION ERROR (NO STATE FOUND)
    if (!nextState) {
      const errorMsg = `[DEBUG] TRANSITION_NOT_FOUND\nEstado: ${session.state}\nBotão: ${text}`;
      return new Response(
        JSON.stringify({ success: true, response: errorMsg, buttons: [], newState: session.state }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. VIEWS / RENDERERS

     const forensicPrefix = `[FORENSIC_BOLETO] ${session.state} -> ${nextState} | Input: "${text}"\n\n`;

     // STATE VIEWS (LOGIC)
     if (nextState === 'SELECT_BOLETO_TYPE') {
       responseText = `Vou te ajudar com o seu boleto. O boleto é *a vencer* (novo) ou *vencido* (2ª via)?`;
       buttons = [
         { id: 'boleto_a_vencer', title: 'A Vencer (Novo)' },
         { id: 'boleto_vencido', title: 'Vencido (2ª Via)' }
       ];
     } else if (nextState === 'WAITING_CNPJ' && session.state !== 'WAITING_CNPJ') {
       responseText = "📋 Por favor, informe o *CNPJ* da empresa (apenas números):";
     } else if (nextState === 'SELECT_CONTRIBUTION_TYPE') {
       responseText = "📝 Qual o *tipo de contribuição*?";
       buttons = [
         { id: 'boleto_type_1', title: 'Mensalidade' },
         { id: 'boleto_type_2', title: 'Taxa' }
       ];
     } else if (session.state === 'WAITING_CNPJ') {
      const cleanCnpj = text.replace(/\D/g, '');
      if (cleanCnpj.length === 14) {
        const { data: employer } = await supabase
          .from('employers')
          .select('id, name')
          .eq('clinic_id', clinic_id)
          .eq('cnpj', cleanCnpj)
          .maybeSingle();

        if (employer) {
          responseText = `✅ *Empresa identificada!*\n\n🏢 *${employer.name}*\n\nÉ essa a empresa correta?`;
          buttons = [
            { id: 'boleto_sim', title: '✅ Sim' },
            { id: 'boleto_nao', title: '❌ Não' }
          ];
          nextState = 'CONFIRM_EMPLOYER';
          await supabase.from('whatsapp_boleto_sessions').update({ 
            employer_id: employer.id, 
            employer_name: employer.name,
            employer_cnpj: cleanCnpj 
          }).eq('id', session.id);
        } else {
          responseText = "❌ Empresa não encontrada com este CNPJ. Por favor, verifique o número e digite novamente:";
        }
      } else {
        responseText = "❌ CNPJ inválido. Digite os 14 números do CNPJ da empresa:";
      }
    } else if (session.state === 'CONFIRM_EMPLOYER') {
      // Caso onde clicou no botão mas não foi mapeado acima
      responseText = "Ok, vamos tentar outro CNPJ. Por favor, digite o CNPJ correto:";
      nextState = 'WAITING_CNPJ';
      } else if (nextState === 'WAITING_PERIODO' && session.state === 'SELECT_CONTRIBUTION_TYPE') {
        responseText = "📅 Informe o *período* do boleto (ex: 05/2026):";
      } else if (session.state === 'WAITING_PERIODO') {
        const periodRegex = /^(0[1-9]|1[0-2])\/\d{4}$/;
        if (periodRegex.test(text)) {
          responseText = "📅 Informe a *data de vencimento* desejada (ex: 10/06/2026):";
          nextState = 'WAITING_VENCIMENTO';
          await supabase.from('whatsapp_boleto_sessions').update({ competence_month: parseInt(text.split('/')[0]), competence_year: parseInt(text.split('/')[1]) }).eq('id', session.id);
        } else {
          responseText = "❌ Formato inválido. Informe o período como MM/AAAA (ex: 05/2026):";
        }
      } else if (session.state === 'WAITING_VENCIMENTO') {
        const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
        if (dateRegex.test(text)) {
          responseText = "✅ Tudo pronto! Gerando seu boleto...\n\nAguarde um instante.";
          nextState = 'SUCCESS';
          // In a real scenario, here we would call Lytex/Boleto generation
        } else {
          responseText = "❌ Data inválida. Informe no formato DD/MM/AAAA (ex: 10/06/2026):";
        }
     } else {
       // SE NÃO EXISTIR TRANSIÇÃO: APENAS DEBUG
       if (nextState === session.state && !responseText) {
         responseText = `[DEBUG] TRANSITION_NOT_FOUND\nEstado: ${session.state}\nBotão: ${text}`;
       }
     }

    // 3. Atualizar estado no banco
    const { error: updateError } = await supabase.from('whatsapp_boleto_sessions')
      .update({ state: nextState, updated_at: new Date().toISOString() })
      .eq('id', session.id);
    
    if (updateError) {
      console.error('[SESSION_UPDATE_FAILED]', updateError);
    } else {
      console.log('[SESSION_SAVE_SUCCESS]', { id: session.id, nextState });
    }

    // 4. Retornar resposta com prefixo forensic
    const finalResponse = forensicPrefix + responseText;
    console.log('[DEBUG_NOVA_STATE_MACHINE][RESPONSE]', finalResponse);

    // 4. Retornar resposta para o webhook enviar
    return new Response(
      JSON.stringify({ 
        success: true, 
        response: finalResponse, 
        buttons: buttons,
        newState: nextState 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[DEBUG_BOLETO_FLOW][ERROR]', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
