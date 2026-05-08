import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SINDICATO_CLINIC_ID = "89e7585e-7bce-4e58-91fa-c37080d1170d";

  const BUILD_VERSION = 'FLOW_V2_BUILD_20260508_v4';
 
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
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    const startingKeywords = ['start', 'whazing_sub_boleto', 'sou empresa', 'empresa', 'oi', 'menu', 'olá', 'ola'];
    const isStartAction = action === 'start' || startingKeywords.includes(message?.toLowerCase());
    console.log('[SESSION_LOOKUP]', {
      phone,
      sessionFound: !!session,
      currentState: session?.state,
      sessionId: session?.id,
      isStartAction
    });

    if (!session || isStartAction) {
      console.log('[NO_STATE_RESET]', 'Initializing or resetting to SELECT_BOLETO_TYPE');
      const { data: newSession } = await supabase
        .from('whatsapp_boleto_sessions')
        .insert({
          clinic_id,
          phone,
          state: 'SELECT_BOLETO_TYPE',
          expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        })
        .select()
        .single();
      
      if (newSession) {
        console.log('[SESSION_SAVE_SUCCESS]', newSession.id);
        session = newSession;
      } else {
        console.error('[SESSION_SAVE_FAILED]');
      }
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
    let nextState = session.state;

    const rawText = (message || "").trim();
    const text = rawText.toLowerCase();
    
    console.log('[NORMALIZED_ACTION]', text);

    // 2. Máquina de Estados Simplificada e Robusta
    // Máquina de Estados com mapeamento explícito de botões
    const transitionMap: Record<string, Record<string, string>> = {
      'SELECT_BOLETO_TYPE': {
        'boleto_a_vencer': 'WAITING_CNPJ',
        'boleto_vencido': 'WAITING_CNPJ',
        '1': 'WAITING_CNPJ',
        '2': 'WAITING_CNPJ',
        'vencer': 'WAITING_CNPJ',
        'vencido': 'WAITING_CNPJ',
        'sou empresa': 'WAITING_CNPJ',
        'whazing_sub_boleto': 'SELECT_BOLETO_TYPE'
      },
      'WAITING_CNPJ': {
        // Transições de CNPJ são lógicas, não baseadas em botões fixos
      },
      'CONFIRM_EMPLOYER': {
        'boleto_sim': 'SELECT_CONTRIBUTION_TYPE',
        'sim': 'SELECT_CONTRIBUTION_TYPE',
        '1': 'SELECT_CONTRIBUTION_TYPE',
        'boleto_nao': 'WAITING_CNPJ',
        'nao': 'WAITING_CNPJ',
        '2': 'WAITING_CNPJ'
      }
    };

    const stateTransitions = transitionMap[session.state as string] || {};
    let transition = null;
    
    // BRUTAL MATCHING
    transition = Object.keys(stateTransitions).find(k => text === k.toLowerCase());
    if (!transition) {
      transition = Object.keys(stateTransitions).find(k => text.includes(k.toLowerCase()));
    }

    const transitionFound = !!transition;
    const forensicPrefix = `[FORENSIC_V4] ${session.state} -> ${transition ? stateTransitions[transition] : 'NONE'} | Input: "${text}"\n\n`;

    if (transitionFound) {
      nextState = stateTransitions[transition!];
      
      if (nextState === 'WAITING_CNPJ') {
        responseText = "📋 Por favor, informe o *CNPJ* da empresa (apenas números):";
      } else if (nextState === 'SELECT_CONTRIBUTION_TYPE') {
        responseText = "📝 Qual o *tipo de contribuição*?\n\n1. Mensalidade Sindical\n2. Taxa Negocial";
        buttons = [
          { id: 'boleto_type_1', title: 'Mensalidade' },
          { id: 'boleto_type_2', title: 'Taxa' }
        ];
      }
    } else {
      console.log('[TRANSITION_NOT_FOUND]', { state: session.state, input: text });
    }

    if (nextState === 'SELECT_BOLETO_TYPE' || (!transitionFound && session.state === 'SELECT_BOLETO_TYPE')) {
      responseText = `[${BUILD_VERSION}]\nVou te ajudar com o seu boleto. O boleto é *a vencer* (novo) ou *vencido* (2ª via)?`;
      buttons = [
        { id: 'boleto_a_vencer', title: 'A Vencer (Novo)' },
        { id: 'boleto_vencido', title: 'Vencido (2ª Via)' }
      ];
      nextState = 'SELECT_BOLETO_TYPE';
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
    } else if (session.state === 'SELECT_CONTRIBUTION_TYPE') {
      // Próximo passo após selecionar tipo de contribuição
      if (text.includes('type_1') || text === '1' || text.includes('mensalidade')) {
        responseText = "🔍 Buscando boletos de *Mensalidade*...\n\nAguarde um instante.";
        // Aqui entraria a lógica de busca real
      } else if (text.includes('type_2') || text === '2' || text.includes('taxa')) {
        responseText = "🔍 Buscando boletos de *Taxa Negocial*...\n\nAguarde um instante.";
      } else {
        responseText = "Por favor, selecione o tipo de contribuição:";
        buttons = [
          { id: 'boleto_type_1', title: 'Mensalidade' },
          { id: 'boleto_type_2', title: 'Taxa' }
        ];
      }
    } else if (!transitionFound) {
      responseText = `[DEBUG] TRANSITION_NOT_FOUND\nEstado: ${session.state}\nEntrada: ${text}`;
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
