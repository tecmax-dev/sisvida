import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SINDICATO_CLINIC_ID = "89e7585e-7bce-4e58-91fa-c37080d1170d";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { clinic_id, phone, message, action, explicit_phone_id } = body;

    console.log('[DEBUG_BOLETO_FLOW][REQUEST_RECEIVED]', { phone, message, action });

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

    let responseText = "";
    let buttons: any[] = [];
    let nextState = session.state;

    const text = (message || "").trim().toLowerCase();

    // 2. Máquina de Estados Simplificada e Robusta
    if (session.state === 'SELECT_BOLETO_TYPE') {
      if (text === 'boleto_a_vencer' || text === '1' || text.includes('vencer') || text === 'sou empresa') {
        responseText = "📋 Por favor, informe o *CNPJ* da empresa (apenas números):";
        nextState = 'WAITING_CNPJ';
      } else if (text === 'boleto_vencido' || text === '2' || text.includes('vencido')) {
        responseText = "📋 Por favor, informe o *CNPJ* da empresa (apenas números):";
        nextState = 'WAITING_CNPJ';
      } else {
        responseText = "Vou te ajudar com o seu boleto. O boleto é *a vencer* (novo) ou *vencido* (2ª via)?";
        buttons = [
          { id: 'boleto_a_vencer', title: 'A Vencer (Novo)' },
          { id: 'boleto_vencido', title: 'Vencido (2ª Via)' }
        ];
      }
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
      if (text === 'boleto_sim' || text === 'sim' || text === '1') {
        responseText = "📝 Qual o *tipo de contribuição*?\n\n1. Mensalidade Sindical\n2. Taxa Negocial";
        buttons = [
          { id: 'boleto_type_1', title: 'Mensalidade' },
          { id: 'boleto_type_2', title: 'Taxa' }
        ];
        nextState = 'SELECT_CONTRIBUTION_TYPE';
      } else {
        responseText = "Ok, vamos tentar outro CNPJ. Por favor, digite o CNPJ correto:";
        nextState = 'WAITING_CNPJ';
      }
    } else {
      // Fallback para reinício se o estado estiver perdido
      responseText = "Como podemos ajudar você hoje?";
      buttons = [
        { id: 'whazing_sub_boleto', title: 'Sou Empresa (Boleto)' },
        { id: 'whazing_associado', title: 'Sou Associado' }
      ];
      nextState = 'SELECT_BOLETO_TYPE';
    }

    // 3. Atualizar estado no banco
    await supabase.from('whatsapp_boleto_sessions')
      .update({ state: nextState })
      .eq('id', session.id);

    console.log('[DEBUG_BOLETO_FLOW][RESPONSE_PREPARED]', { responseText, nextState, buttons });

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
