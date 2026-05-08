import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SINDICATO_CLINIC_ID = "89e7585e-7bce-4e58-91fa-c37080d1170d";

 const BUILD_VERSION = 'FLOW_V2_BUILD_20260508';
 
 serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
     console.log(`[ENTRYPOINT][boleto-whatsapp-flow]`, BUILD_VERSION);
    const body = await req.json();
    const { clinic_id, phone, message, action, explicit_phone_id } = body;

    console.log('[DEBUG_NOVA_STATE_MACHINE][BUTTON]', message);

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

    if (!session || action === 'start') {
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
      session = newSession;
    }

    if (!session) throw new Error("Could not create session");

    console.log('[DEBUG_NOVA_STATE_MACHINE][STATE]', session.state);

    let responseText = "";
    let buttons: any[] = [];
    let nextState = session.state;

    const rawText = (message || "").trim();
    const text = rawText.toLowerCase();
    
    console.log('[DEBUG_FLOW][STATE]', session.state);
    console.log('[DEBUG_FLOW][RAW_CONTENT]', rawText);
    console.log('[DEBUG_FLOW][NORMALIZED]', text);

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
        'sou empresa': 'WAITING_CNPJ'
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
    const transition = Object.keys(stateTransitions).find(k => text === k || text.includes(k));

    if (transition) {
      console.log('[DEBUG_FLOW][TRANSITION_FOUND]', transition);
      nextState = stateTransitions[transition];
      
      if (nextState === 'WAITING_CNPJ') {
        responseText = "📋 Por favor, informe o *CNPJ* da empresa (apenas números):";
      } else if (nextState === 'SELECT_CONTRIBUTION_TYPE') {
        responseText = "📝 Qual o *tipo de contribuição*?\n\n1. Mensalidade Sindical\n2. Taxa Negocial";
        buttons = [
          { id: 'boleto_type_1', title: 'Mensalidade' },
          { id: 'boleto_type_2', title: 'Taxa' }
        ];
      }
    } else if (session.state === 'SELECT_BOLETO_TYPE') {
       responseText = `[${BUILD_VERSION}]\nVou te ajudar com o seu boleto. O boleto é *a vencer* (novo) ou *vencido* (2ª via)?`;
      buttons = [
        { id: 'boleto_a_vencer', title: 'A Vencer (Novo)' },
        { id: 'boleto_vencido', title: 'Vencido (2ª Via)' }
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
    } else {
      // Fallback para reinício se o estado estiver perdido
       responseText = `[${BUILD_VERSION}]\nMenu Sindicato\nComo podemos ajudar você hoje?`;
      buttons = [
        { id: 'whazing_sub_boleto', title: 'Sou Empresa (Boleto)' },
        { id: 'whazing_associado', title: 'Sou Associado' }
      ];
      nextState = 'SELECT_BOLETO_TYPE';
    }

    console.log('[DEBUG_NOVA_STATE_MACHINE][NEXT]', nextState);

    // 3. Atualizar estado no banco
    await supabase.from('whatsapp_boleto_sessions')
      .update({ state: nextState })
      .eq('id', session.id);

    console.log('[DEBUG_NOVA_STATE_MACHINE][RESPONSE]', responseText);

    // 4. Retornar resposta para o webhook enviar
    return new Response(
      JSON.stringify({ 
        success: true, 
        response: responseText, 
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
