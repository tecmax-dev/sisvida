import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreatePaymentRequest {
  action: 'create_pix' | 'create_boleto' | 'check_status';
  clinic_id: string;
  amount: number;
  description: string;
  payer_email: string;
  payer_name: string;
  payer_cpf: string;
  source: 'transaction' | 'package' | 'quote' | 'booking';
  source_id?: string;
  boleto_due_days?: number;
  payment_id?: string; // for check_status
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const MERCADO_PAGO_ACCESS_TOKEN = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN');
    if (!MERCADO_PAGO_ACCESS_TOKEN) {
      throw new Error('MERCADO_PAGO_ACCESS_TOKEN não configurado');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: CreatePaymentRequest = await req.json();
    const { action, clinic_id, amount, description, payer_email, payer_name, payer_cpf, source, source_id, boleto_due_days, payment_id } = body;

    console.log('Mercado Pago action:', action, 'for clinic:', clinic_id);

    // Check payment status
    if (action === 'check_status' && payment_id) {
      const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${payment_id}`, {
        headers: {
          'Authorization': `Bearer ${MERCADO_PAGO_ACCESS_TOKEN}`,
        },
      });

      if (!mpResponse.ok) {
        const errorText = await mpResponse.text();
        console.error('MP check status error:', errorText);
        throw new Error('Erro ao verificar status do pagamento');
      }

      const mpData = await mpResponse.json();
      return new Response(JSON.stringify({
        status: mpData.status,
        status_detail: mpData.status_detail,
        date_approved: mpData.date_approved,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate external reference
    const externalReference = `${source}_${source_id || crypto.randomUUID()}`;

    // Validate CPF format (remove non-digits)
    const cleanCpf = payer_cpf.replace(/\D/g, '');
    if (cleanCpf.length !== 11) {
      throw new Error('CPF inválido');
    }

    // Base payment data
    const basePaymentData = {
      transaction_amount: amount,
      description: description,
      external_reference: externalReference,
      payer: {
        email: payer_email,
        first_name: payer_name.split(' ')[0],
        last_name: payer_name.split(' ').slice(1).join(' ') || payer_name.split(' ')[0],
        identification: {
          type: 'CPF',
          number: cleanCpf,
        },
      },
    };

    let paymentData: any;
    let paymentType: 'pix' | 'boleto';

    if (action === 'create_pix') {
      paymentType = 'pix';
      paymentData = {
        ...basePaymentData,
        payment_method_id: 'pix',
      };
    } else if (action === 'create_boleto') {
      paymentType = 'boleto';
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + (boleto_due_days || 3));
      
      paymentData = {
        ...basePaymentData,
        payment_method_id: 'bolbradesco',
        date_of_expiration: dueDate.toISOString(),
      };
    } else {
      throw new Error('Ação inválida');
    }

    console.log('Creating MP payment:', JSON.stringify(paymentData, null, 2));

    // Create payment in Mercado Pago
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
      console.error('MP API error:', JSON.stringify(errorData, null, 2));
      throw new Error(errorData.message || 'Erro ao criar pagamento no Mercado Pago');
    }

    const mpResult = await mpResponse.json();
    console.log('MP payment created:', mpResult.id, 'status:', mpResult.status);

    // Prepare record for database
    const paymentRecord: any = {
      clinic_id,
      external_reference: externalReference,
      payment_type: paymentType,
      status: 'pending',
      amount,
      description,
      payer_email,
      payer_name,
      payer_cpf: cleanCpf,
      mp_payment_id: String(mpResult.id),
      mp_status: mpResult.status,
      mp_status_detail: mpResult.status_detail,
      source,
    };

    // Set source relation
    if (source === 'transaction' && source_id) {
      paymentRecord.financial_transaction_id = source_id;
    } else if (source === 'package' && source_id) {
      paymentRecord.patient_package_id = source_id;
    } else if (source === 'quote' && source_id) {
      paymentRecord.quote_id = source_id;
    } else if (source === 'booking' && source_id) {
      paymentRecord.appointment_id = source_id;
    }

    // Add PIX specific data
    if (paymentType === 'pix') {
      const pixInfo = mpResult.point_of_interaction?.transaction_data;
      paymentRecord.pix_qr_code = pixInfo?.qr_code;
      paymentRecord.pix_qr_code_base64 = pixInfo?.qr_code_base64;
      
      // PIX expires in 30 minutes by default
      const pixExpiration = new Date();
      pixExpiration.setMinutes(pixExpiration.getMinutes() + 30);
      paymentRecord.pix_expiration_date = pixExpiration.toISOString();
    }

    // Add Boleto specific data
    if (paymentType === 'boleto') {
      paymentRecord.boleto_url = mpResult.transaction_details?.external_resource_url;
      paymentRecord.boleto_barcode = mpResult.barcode?.content;
      paymentRecord.boleto_due_date = mpResult.date_of_expiration?.split('T')[0];
    }

    // Save to database
    const { data: savedPayment, error: saveError } = await supabase
      .from('mercado_pago_payments')
      .insert(paymentRecord)
      .select()
      .single();

    if (saveError) {
      console.error('Error saving payment:', saveError);
      throw new Error('Erro ao salvar pagamento no banco de dados');
    }

    console.log('Payment saved to database:', savedPayment.id);

    // Return response based on payment type
    const response: any = {
      id: savedPayment.id,
      mp_payment_id: mpResult.id,
      status: mpResult.status,
      payment_type: paymentType,
    };

    if (paymentType === 'pix') {
      response.pix_qr_code = paymentRecord.pix_qr_code;
      response.pix_qr_code_base64 = paymentRecord.pix_qr_code_base64;
      response.pix_expiration_date = paymentRecord.pix_expiration_date;
    } else {
      response.boleto_url = paymentRecord.boleto_url;
      response.boleto_barcode = paymentRecord.boleto_barcode;
      response.boleto_due_date = paymentRecord.boleto_due_date;
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Mercado Pago error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
