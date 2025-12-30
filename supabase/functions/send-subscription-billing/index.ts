import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SubscriptionBilling {
  subscription_id: string;
  clinic_id: string;
  clinic_name: string;
  clinic_email: string;
  clinic_phone: string;
  clinic_cnpj: string;
  plan_name: string;
  plan_price: number;
  current_period_end: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const MERCADO_PAGO_ACCESS_TOKEN = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN');
    if (!MERCADO_PAGO_ACCESS_TOKEN) {
      console.error('MERCADO_PAGO_ACCESS_TOKEN não configurado');
      throw new Error('MERCADO_PAGO_ACCESS_TOKEN não configurado');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body for manual trigger with specific days
    let daysBeforeExpiry = 5; // Default: 5 days before expiry
    try {
      const body = await req.json();
      if (body.days_before_expiry) {
        daysBeforeExpiry = parseInt(body.days_before_expiry);
      }
    } catch {
      // No body or invalid JSON, use default
    }

    console.log(`[send-subscription-billing] Looking for subscriptions expiring in ${daysBeforeExpiry} days`);

    // Calculate target date range
    const today = new Date();
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + daysBeforeExpiry);
    
    const targetDateStr = targetDate.toISOString().split('T')[0];
    const nextDayStr = new Date(targetDate.getTime() + 86400000).toISOString().split('T')[0];

    console.log(`[send-subscription-billing] Target date range: ${targetDateStr} to ${nextDayStr}`);

    // Find active subscriptions expiring in the target date range
    const { data: expiringSubscriptions, error: fetchError } = await supabase
      .from('subscriptions')
      .select(`
        id,
        clinic_id,
        current_period_end,
        clinics!inner (
          id,
          name,
          email,
          phone,
          cnpj
        ),
        subscription_plans!inner (
          id,
          name,
          monthly_price
        )
      `)
      .eq('status', 'active')
      .gte('current_period_end', targetDateStr)
      .lt('current_period_end', nextDayStr);

    if (fetchError) {
      console.error('[send-subscription-billing] Error fetching subscriptions:', fetchError);
      throw fetchError;
    }

    console.log(`[send-subscription-billing] Found ${expiringSubscriptions?.length || 0} subscriptions expiring around ${targetDateStr}`);

    if (!expiringSubscriptions || expiringSubscriptions.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Nenhuma assinatura a vencer encontrada',
          processed: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: { clinic_name: string; success: boolean; error?: string; payment_id?: string }[] = [];

    for (const subscription of expiringSubscriptions) {
      const clinic = subscription.clinics as any;
      const plan = subscription.subscription_plans as any;

      try {
        console.log(`[send-subscription-billing] Processing clinic: ${clinic.name}`);

        // Check if a billing was already sent for this period
        const { data: existingPayment } = await supabase
          .from('mercado_pago_payments')
          .select('id')
          .eq('clinic_id', clinic.id)
          .eq('source', 'subscription')
          .gte('created_at', new Date(today.getFullYear(), today.getMonth(), 1).toISOString())
          .maybeSingle();

        if (existingPayment) {
          console.log(`[send-subscription-billing] Billing already sent for clinic ${clinic.name} this month`);
          results.push({ clinic_name: clinic.name, success: true, error: 'Cobrança já enviada este mês' });
          continue;
        }

        // Skip if no email or phone
        if (!clinic.email && !clinic.phone) {
          console.log(`[send-subscription-billing] No contact info for clinic ${clinic.name}`);
          results.push({ clinic_name: clinic.name, success: false, error: 'Sem email ou telefone cadastrado' });
          continue;
        }

        // Skip if no CNPJ
        const cleanCnpj = clinic.cnpj?.replace(/\D/g, '') || '';
        if (cleanCnpj.length < 11) {
          console.log(`[send-subscription-billing] Invalid CNPJ for clinic ${clinic.name}`);
          results.push({ clinic_name: clinic.name, success: false, error: 'CNPJ inválido' });
          continue;
        }

        // Generate external reference
        const externalReference = `subscription_${subscription.id}_${Date.now()}`;

        // Create PIX payment in Mercado Pago
        const paymentData = {
          transaction_amount: plan.monthly_price,
          description: `Assinatura Eclini - Plano ${plan.name}`,
          external_reference: externalReference,
          payment_method_id: 'pix',
          payer: {
            email: clinic.email || 'noreply@eclini.app',
            first_name: clinic.name.split(' ')[0],
            last_name: clinic.name.split(' ').slice(1).join(' ') || clinic.name.split(' ')[0],
            identification: {
              type: cleanCnpj.length === 11 ? 'CPF' : 'CNPJ',
              number: cleanCnpj,
            },
          },
        };

        console.log(`[send-subscription-billing] Creating PIX for ${clinic.name}:`, JSON.stringify(paymentData, null, 2));

        const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${MERCADO_PAGO_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
            'X-Idempotency-Key': externalReference,
          },
          body: JSON.stringify(paymentData),
        });

        if (!mpResponse.ok) {
          const errorData = await mpResponse.json();
          console.error(`[send-subscription-billing] MP API error for ${clinic.name}:`, JSON.stringify(errorData, null, 2));
          results.push({ clinic_name: clinic.name, success: false, error: errorData.message || 'Erro MP' });
          continue;
        }

        const mpResult = await mpResponse.json();
        console.log(`[send-subscription-billing] PIX created for ${clinic.name}: ${mpResult.id}`);

        // Get PIX data
        const pixInfo = mpResult.point_of_interaction?.transaction_data;
        const pixQrCode = pixInfo?.qr_code;
        const pixQrCodeBase64 = pixInfo?.qr_code_base64;

        // PIX expires in 30 minutes
        const pixExpiration = new Date();
        pixExpiration.setMinutes(pixExpiration.getMinutes() + 30);

        // Save payment to database
        const paymentRecord = {
          clinic_id: clinic.id,
          external_reference: externalReference,
          payment_type: 'pix',
          status: 'pending',
          amount: plan.monthly_price,
          description: `Assinatura Eclini - Plano ${plan.name}`,
          payer_email: clinic.email || 'noreply@eclini.app',
          payer_name: clinic.name,
          payer_cpf: cleanCnpj,
          mp_payment_id: String(mpResult.id),
          mp_status: mpResult.status,
          mp_status_detail: mpResult.status_detail,
          source: 'subscription',
          pix_qr_code: pixQrCode,
          pix_qr_code_base64: pixQrCodeBase64,
          pix_expiration_date: pixExpiration.toISOString(),
        };

        const { data: savedPayment, error: saveError } = await supabase
          .from('mercado_pago_payments')
          .insert(paymentRecord)
          .select()
          .single();

        if (saveError) {
          console.error(`[send-subscription-billing] Error saving payment for ${clinic.name}:`, saveError);
          results.push({ clinic_name: clinic.name, success: false, error: 'Erro ao salvar pagamento' });
          continue;
        }

        // Format expiry date
        const expiryDate = new Date(subscription.current_period_end);
        const formattedExpiryDate = expiryDate.toLocaleDateString('pt-BR');

        // Build WhatsApp message
        const message = `🏥 *Eclini - Cobrança de Assinatura*

Olá, ${clinic.name}!

Sua assinatura do *Plano ${plan.name}* vence em *${formattedExpiryDate}*.

💰 *Valor:* R$ ${plan.monthly_price.toFixed(2).replace('.', ',')}

📱 *Pague via PIX* copiando o código abaixo:

\`\`\`
${pixQrCode}
\`\`\`

⏰ Este código expira em 30 minutos.

Após o pagamento, sua assinatura será renovada automaticamente.

Dúvidas? Responda esta mensagem.

_Equipe Eclini_`;

        // Send WhatsApp if clinic has phone
        if (clinic.phone) {
          const cleanPhone = clinic.phone.replace(/\D/g, '');
          if (cleanPhone.length >= 10) {
            // Get Evolution API config for system (using first clinic with config as fallback)
            const { data: evolutionConfig } = await supabase
              .from('evolution_configs')
              .select('api_url, api_key, instance_name, is_connected')
              .eq('clinic_id', clinic.id)
              .maybeSingle();

            if (evolutionConfig?.is_connected) {
              let formattedPhone = cleanPhone;
              if (!formattedPhone.startsWith('55')) {
                formattedPhone = '55' + formattedPhone;
              }

              try {
                // Send message with QR code image
                if (pixQrCodeBase64) {
                  await fetch(`${evolutionConfig.api_url}/message/sendMedia/${evolutionConfig.instance_name}`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'apikey': evolutionConfig.api_key,
                    },
                    body: JSON.stringify({
                      number: formattedPhone,
                      mediatype: 'image',
                      media: `data:image/png;base64,${pixQrCodeBase64}`,
                      caption: message,
                    }),
                  });
                  console.log(`[send-subscription-billing] WhatsApp sent to ${clinic.name}`);
                } else {
                  // Fallback: send text only
                  await fetch(`${evolutionConfig.api_url}/message/sendText/${evolutionConfig.instance_name}`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'apikey': evolutionConfig.api_key,
                    },
                    body: JSON.stringify({
                      number: formattedPhone,
                      text: message,
                    }),
                  });
                  console.log(`[send-subscription-billing] WhatsApp (text) sent to ${clinic.name}`);
                }
              } catch (whatsappError) {
                console.error(`[send-subscription-billing] WhatsApp error for ${clinic.name}:`, whatsappError);
              }
            } else {
              console.log(`[send-subscription-billing] No WhatsApp configured for ${clinic.name}`);
            }
          }
        }

        results.push({ 
          clinic_name: clinic.name, 
          success: true, 
          payment_id: savedPayment.id 
        });

      } catch (clinicError) {
        console.error(`[send-subscription-billing] Error processing ${clinic.name}:`, clinicError);
        results.push({ 
          clinic_name: clinic.name, 
          success: false, 
          error: clinicError instanceof Error ? clinicError.message : 'Erro desconhecido' 
        });
      }
    }

    const successCount = results.filter(r => r.success && !r.error?.includes('já enviada')).length;
    const skippedCount = results.filter(r => r.error?.includes('já enviada')).length;
    const failedCount = results.filter(r => !r.success).length;

    console.log(`[send-subscription-billing] Completed: ${successCount} sent, ${skippedCount} skipped, ${failedCount} failed`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Processado: ${successCount} enviados, ${skippedCount} já enviados, ${failedCount} com erro`,
        processed: expiringSubscriptions.length,
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[send-subscription-billing] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
