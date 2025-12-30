import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, clinic_name, plan_name, value, pix_code } = await req.json();

    const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL');
    const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');
    const EVOLUTION_INSTANCE = Deno.env.get('EVOLUTION_INSTANCE');

    console.log('[test-billing-whatsapp] Config:', {
      url: EVOLUTION_API_URL,
      instance: EVOLUTION_INSTANCE,
      hasKey: !!EVOLUTION_API_KEY
    });

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Evolution API não configurada nos secrets do projeto',
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

    // Test PIX code
    const testPixCode = pix_code || '00020126580014br.gov.bcb.pix0136a1b2c3d4-e5f6-7890-abcd-ef1234567890520400005303986540550.005802BR5925ECLINI SISTEMAS LTDA6009SAO PAULO62070503***6304ABCD';

    // Build message
    const message = `🏥 *Eclini - TESTE de Cobrança*

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
        text: message,
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
        message: `Mensagem de teste enviada para ${formattedPhone}`,
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
