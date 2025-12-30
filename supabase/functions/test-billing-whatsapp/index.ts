import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, message, clinic_name, plan_name, value, pix_code } = await req.json();

    // Get global config from database
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: globalConfig, error: configError } = await supabase
      .from('global_config')
      .select('evolution_api_url, evolution_api_key, evolution_instance')
      .maybeSingle();

    if (configError) {
      console.error('[test-billing-whatsapp] Error loading global_config:', configError);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao carregar configuração global' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const EVOLUTION_API_URL = globalConfig?.evolution_api_url;
    const EVOLUTION_API_KEY = globalConfig?.evolution_api_key;
    const EVOLUTION_INSTANCE = globalConfig?.evolution_instance;

    console.log('[test-billing-whatsapp] Config from global_config:', {
      url: EVOLUTION_API_URL,
      instance: EVOLUTION_INSTANCE,
      hasKey: !!EVOLUTION_API_KEY
    });

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Evolution API não configurada em Configuração Global do Super Admin',
          config: {
            hasUrl: !!EVOLUTION_API_URL,
            hasKey: !!EVOLUTION_API_KEY,
            hasInstance: !!EVOLUTION_INSTANCE
          }
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate phone
    if (!phone) {
      return new Response(
        JSON.stringify({ success: false, error: 'Telefone é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cleanPhone = phone.replace(/\D/g, '');
    let formattedPhone = cleanPhone;
    if (!formattedPhone.startsWith('55')) {
      formattedPhone = '55' + formattedPhone;
    }

    console.log(`[test-billing-whatsapp] Sending to: ${formattedPhone}`);

    // If custom message is provided, use it directly
    let finalMessage: string;
    
    if (message) {
      finalMessage = message;
    } else {
      // Test PIX code
      const testPixCode = pix_code || '00020126580014br.gov.bcb.pix0136a1b2c3d4-e5f6-7890-abcd-ef1234567890520400005303986540550.005802BR5925ECLINI SISTEMAS LTDA6009SAO PAULO62070503***6304ABCD';

      // Build billing message
      finalMessage = `🏥 *Eclini - TESTE de Cobrança*

Olá, ${clinic_name || 'Clínica Teste'}!

Sua assinatura do *Plano ${plan_name || 'Pro'}* está próxima do vencimento.

💰 *Valor:* R$ ${(value || 169).toFixed(2).replace('.', ',')}

📱 *Pague via PIX* copiando o código abaixo:

\`\`\`
${testPixCode}
\`\`\`

⏰ Este código expira em 30 minutos.

⚠️ _Esta é uma mensagem de TESTE - não efetue pagamento._

_Equipe Eclini_`;
    }

    // Normalize URL - remove trailing slash
    let apiUrl = EVOLUTION_API_URL.replace(/\/+$/, '');

    console.log(`[test-billing-whatsapp] Calling: ${apiUrl}/message/sendText/${EVOLUTION_INSTANCE}`);

    const response = await fetch(`${apiUrl}/message/sendText/${EVOLUTION_INSTANCE}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_KEY,
      },
      body: JSON.stringify({
        number: formattedPhone,
        text: finalMessage,
      }),
    });

    const responseText = await response.text();
    console.log(`[test-billing-whatsapp] Response status: ${response.status}`);
    console.log(`[test-billing-whatsapp] Response: ${responseText}`);

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    if (!response.ok) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Erro ao enviar mensagem',
          status: response.status,
          details: responseData
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Mensagem enviada para ${formattedPhone}`,
        response: responseData
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[test-billing-whatsapp] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
