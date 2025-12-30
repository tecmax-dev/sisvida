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
    const MERCADO_PAGO_ACCESS_TOKEN = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN');
    if (!MERCADO_PAGO_ACCESS_TOKEN) {
      console.error('MERCADO_PAGO_ACCESS_TOKEN não configurado');
      throw new Error('MERCADO_PAGO_ACCESS_TOKEN não configurado');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get Evolution API config from global_config
    const { data: globalConfig, error: configError } = await supabase
      .from('global_config')
      .select('evolution_api_url, evolution_api_key, evolution_instance')
      .maybeSingle();

    if (configError) {
      console.error('[send-subscription-billing] Error loading global_config:', configError);
    }

    const EVOLUTION_API_URL = globalConfig?.evolution_api_url;
    const EVOLUTION_API_KEY = globalConfig?.evolution_api_key;
    const EVOLUTION_INSTANCE = globalConfig?.evolution_instance;

    console.log('[send-subscription-billing] Evolution config from global_config:', {
      hasUrl: !!EVOLUTION_API_URL,
      hasKey: !!EVOLUTION_API_KEY,
      hasInstance: !!EVOLUTION_INSTANCE
    });

    // Parse request body for manual trigger
    let daysBeforeExpiry = 5;
    let testMode = false;
    let testPhone: string | null = null;
    let testClinicName = 'Clínica Teste';
    let testPlanName = 'Pro';
    let testPlanPrice = 169.00;
    let paymentMethod = 'pix';

    try {
      const body = await req.json();
      if (body.days_before_expiry) {
        daysBeforeExpiry = parseInt(body.days_before_expiry);
      }
      if (body.test_mode) {
        testMode = true;
        testPhone = body.phone;
        testClinicName = body.clinic_name || testClinicName;
        testPlanName = body.plan_name || testPlanName;
        testPlanPrice = body.plan_price || testPlanPrice;
        paymentMethod = body.payment_method || 'pix';
      }
    } catch {
      // No body or invalid JSON, use defaults
    }

    // TEST MODE: Generate payment and send to specific phone
    if (testMode && testPhone) {
      console.log(`[send-subscription-billing] TEST MODE - Sending ${paymentMethod.toUpperCase()} to ${testPhone}`);

      // Format phone
      const cleanPhone = testPhone.replace(/\D/g, '');
      let formattedPhone = cleanPhone;
      if (!formattedPhone.startsWith('55')) {
        formattedPhone = '55' + formattedPhone;
      }

      // Create test payment in Mercado Pago
      const externalReference = `test_billing_${paymentMethod}_${Date.now()}`;
      
      // Calculate boleto due date (3 days from now)
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 3);

      const paymentData: any = {
        transaction_amount: testPlanPrice,
        description: `TESTE - Assinatura Eclini - Plano ${testPlanName}`,
        external_reference: externalReference,
        payer: {
          email: 'teste@eclini.app',
          first_name: 'Teste',
          last_name: 'Eclini',
          identification: {
            type: 'CPF',
            number: '12345678909',
          },
        },
      };

      if (paymentMethod === 'boleto') {
        paymentData.payment_method_id = 'bolbradesco';
        paymentData.date_of_expiration = dueDate.toISOString();
        // Boleto requires full address
        paymentData.payer.address = {
          zip_code: '45653-010',
          street_name: 'Rua Teste',
          street_number: '123',
          neighborhood: 'Centro',
          city: 'Ilhéus',
          federal_unit: 'BA'
        };
      } else {
        paymentData.payment_method_id = 'pix';
      }

      console.log(`[send-subscription-billing] Creating TEST ${paymentMethod.toUpperCase()}:`, JSON.stringify(paymentData, null, 2));

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
        console.error(`[send-subscription-billing] MP API error:`, JSON.stringify(errorData, null, 2));
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Erro ao criar ${paymentMethod.toUpperCase()} no Mercado Pago`,
            details: errorData 
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const mpResult = await mpResponse.json();
      console.log(`[send-subscription-billing] TEST ${paymentMethod.toUpperCase()} created: ${mpResult.id}`);

      // Format expiry date (5 days from now for test)
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 5);
      const formattedExpiryDate = expiryDate.toLocaleDateString('pt-BR');

      let message: string;
      let pixQrCode: string | undefined;
      let pixQrCodeBase64: string | undefined;
      let boletoUrl: string | undefined;
      let boletoBarcode: string | undefined;

      if (paymentMethod === 'boleto') {
        boletoUrl = mpResult.transaction_details?.external_resource_url;
        boletoBarcode = mpResult.barcode?.content;
        const boletoDueDate = dueDate.toLocaleDateString('pt-BR');

        message = `🏥 *Eclini - TESTE de Cobrança (BOLETO)*

Olá, ${testClinicName}!

Sua assinatura do *Plano ${testPlanName}* vence em *${formattedExpiryDate}*.

💰 *Valor:* R$ ${testPlanPrice.toFixed(2).replace('.', ',')}

📄 *Pague via BOLETO:*

📅 Vencimento: ${boletoDueDate}

🔢 Código de barras:
\`\`\`
${boletoBarcode || 'Código não disponível'}
\`\`\`

🔗 Ou acesse o link para visualizar/imprimir:
${boletoUrl || 'Link não disponível'}

⚠️ *ESTA É UMA MENSAGEM DE TESTE - NÃO EFETUE PAGAMENTO*

_Equipe Eclini_`;
      } else {
        const pixInfo = mpResult.point_of_interaction?.transaction_data;
        pixQrCode = pixInfo?.qr_code;
        pixQrCodeBase64 = pixInfo?.qr_code_base64;

        message = `🏥 *Eclini - TESTE de Cobrança (PIX)*

Olá, ${testClinicName}!

Sua assinatura do *Plano ${testPlanName}* vence em *${formattedExpiryDate}*.

💰 *Valor:* R$ ${testPlanPrice.toFixed(2).replace('.', ',')}

📱 *Pague via PIX* copiando o código abaixo:

\`\`\`
${pixQrCode}
\`\`\`

⏰ Este código expira em 30 minutos.

⚠️ *ESTA É UMA MENSAGEM DE TESTE - NÃO EFETUE PAGAMENTO*

_Equipe Eclini_`;
      }

      // Send via WhatsApp
      if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Evolution API não configurada em Configuração Global',
            payment_created: true,
            payment_method: paymentMethod,
            pix_code: pixQrCode,
            boleto_url: boletoUrl,
            boleto_barcode: boletoBarcode
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const apiUrl = EVOLUTION_API_URL.replace(/\/+$/, '');

      // For PIX, try to send with QR code image first
      let whatsappSent = false;
      if (paymentMethod === 'pix' && pixQrCodeBase64) {
        try {
          const response = await fetch(`${apiUrl}/message/sendMedia/${EVOLUTION_INSTANCE}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': EVOLUTION_API_KEY,
            },
            body: JSON.stringify({
              number: formattedPhone,
              mediatype: 'image',
              media: `data:image/png;base64,${pixQrCodeBase64}`,
              caption: message,
            }),
          });
          
          if (response.ok) {
            console.log(`[send-subscription-billing] WhatsApp with QR sent to ${formattedPhone}`);
            whatsappSent = true;
          } else {
            const errorData = await response.json();
            console.error(`[send-subscription-billing] WhatsApp media error:`, JSON.stringify(errorData));
          }
        } catch (e) {
          console.error(`[send-subscription-billing] WhatsApp media exception:`, e);
        }
      }

      // Fallback to text only (or for boleto)
      if (!whatsappSent) {
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
        
        if (response.ok) {
          console.log(`[send-subscription-billing] WhatsApp text sent to ${formattedPhone}`);
          whatsappSent = true;
        } else {
          const errorData = await response.json();
          console.error(`[send-subscription-billing] WhatsApp text error:`, JSON.stringify(errorData));
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: 'Erro ao enviar WhatsApp',
              payment_created: true,
              payment_method: paymentMethod,
              pix_code: pixQrCode,
              boleto_url: boletoUrl,
              boleto_barcode: boletoBarcode,
              whatsapp_error: errorData
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Cobrança de teste (${paymentMethod.toUpperCase()}) enviada para ${formattedPhone}`,
          mp_payment_id: mpResult.id,
          payment_method: paymentMethod,
          pix_code: pixQrCode,
          boleto_url: boletoUrl,
          boleto_barcode: boletoBarcode
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PRODUCTION MODE: Process expiring subscriptions
    console.log(`[send-subscription-billing] Looking for subscriptions expiring in ${daysBeforeExpiry} days`);

    const today = new Date();
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + daysBeforeExpiry);
    
    const targetDateStr = targetDate.toISOString().split('T')[0];
    const nextDayStr = new Date(targetDate.getTime() + 86400000).toISOString().split('T')[0];

    console.log(`[send-subscription-billing] Target date range: ${targetDateStr} to ${nextDayStr}`);

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

        if (!clinic.email && !clinic.phone) {
          console.log(`[send-subscription-billing] No contact info for clinic ${clinic.name}`);
          results.push({ clinic_name: clinic.name, success: false, error: 'Sem email ou telefone cadastrado' });
          continue;
        }

        const cleanCnpj = clinic.cnpj?.replace(/\D/g, '') || '';
        if (cleanCnpj.length < 11) {
          console.log(`[send-subscription-billing] Invalid CNPJ for clinic ${clinic.name}`);
          results.push({ clinic_name: clinic.name, success: false, error: 'CNPJ inválido' });
          continue;
        }

        const externalReference = `subscription_${subscription.id}_${Date.now()}`;

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

        const pixInfo = mpResult.point_of_interaction?.transaction_data;
        const pixQrCode = pixInfo?.qr_code;
        const pixQrCodeBase64 = pixInfo?.qr_code_base64;

        const pixExpiration = new Date();
        pixExpiration.setMinutes(pixExpiration.getMinutes() + 30);

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

        const expiryDate = new Date(subscription.current_period_end);
        const formattedExpiryDate = expiryDate.toLocaleDateString('pt-BR');

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

        // Send WhatsApp using global config
        if (clinic.phone && EVOLUTION_API_URL && EVOLUTION_API_KEY && EVOLUTION_INSTANCE) {
          const cleanPhone = clinic.phone.replace(/\D/g, '');
          if (cleanPhone.length >= 10) {
            let formattedPhone = cleanPhone;
            if (!formattedPhone.startsWith('55')) {
              formattedPhone = '55' + formattedPhone;
            }

            const apiUrl = EVOLUTION_API_URL.replace(/\/+$/, '');

            try {
              if (pixQrCodeBase64) {
                const response = await fetch(`${apiUrl}/message/sendMedia/${EVOLUTION_INSTANCE}`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'apikey': EVOLUTION_API_KEY,
                  },
                  body: JSON.stringify({
                    number: formattedPhone,
                    mediatype: 'image',
                    media: `data:image/png;base64,${pixQrCodeBase64}`,
                    caption: message,
                  }),
                });
                
                if (response.ok) {
                  console.log(`[send-subscription-billing] WhatsApp sent to ${clinic.name} (${formattedPhone})`);
                } else {
                  const errorData = await response.json();
                  console.error(`[send-subscription-billing] WhatsApp API error for ${clinic.name}:`, JSON.stringify(errorData));
                }
              } else {
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
                
                if (response.ok) {
                  console.log(`[send-subscription-billing] WhatsApp (text) sent to ${clinic.name} (${formattedPhone})`);
                } else {
                  const errorData = await response.json();
                  console.error(`[send-subscription-billing] WhatsApp API error for ${clinic.name}:`, JSON.stringify(errorData));
                }
              }
            } catch (whatsappError) {
              console.error(`[send-subscription-billing] WhatsApp error for ${clinic.name}:`, whatsappError);
            }
          }
        } else if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE) {
          console.log(`[send-subscription-billing] Evolution API not configured in global_config - skipping WhatsApp`);
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
