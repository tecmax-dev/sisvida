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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    console.log('Webhook received:', JSON.stringify(body, null, 2));

    // Mercado Pago sends different notification types
    // We're interested in payment notifications
    if (body.type !== 'payment' && body.action !== 'payment.updated' && body.action !== 'payment.created') {
      console.log('Ignoring non-payment notification:', body.type, body.action);
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const mpPaymentId = body.data?.id;
    if (!mpPaymentId) {
      console.log('No payment ID in webhook');
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get full payment details from Mercado Pago
    const MERCADO_PAGO_ACCESS_TOKEN = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN');
    if (!MERCADO_PAGO_ACCESS_TOKEN) {
      throw new Error('MERCADO_PAGO_ACCESS_TOKEN não configurado');
    }

    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${mpPaymentId}`, {
      headers: {
        'Authorization': `Bearer ${MERCADO_PAGO_ACCESS_TOKEN}`,
      },
    });

    if (!mpResponse.ok) {
      const errorText = await mpResponse.text();
      console.error('Error fetching payment from MP:', errorText);
      throw new Error('Erro ao buscar pagamento no Mercado Pago');
    }

    const mpPayment = await mpResponse.json();
    console.log('MP payment details:', mpPayment.id, 'status:', mpPayment.status);

    // Map MP status to our status
    const statusMap: Record<string, string> = {
      'pending': 'pending',
      'approved': 'approved',
      'authorized': 'pending',
      'in_process': 'pending',
      'in_mediation': 'pending',
      'rejected': 'rejected',
      'cancelled': 'cancelled',
      'refunded': 'refunded',
      'charged_back': 'refunded',
    };

    const ourStatus = statusMap[mpPayment.status] || 'pending';

    // Find our payment record
    const { data: paymentRecord, error: findError } = await supabase
      .from('mercado_pago_payments')
      .select('*')
      .eq('mp_payment_id', String(mpPaymentId))
      .single();

    if (findError || !paymentRecord) {
      console.log('Payment not found in our database:', mpPaymentId);
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update payment record
    const updateData: any = {
      mp_status: mpPayment.status,
      mp_status_detail: mpPayment.status_detail,
      status: ourStatus,
      webhook_received_at: new Date().toISOString(),
    };

    if (ourStatus === 'approved' && mpPayment.date_approved) {
      updateData.paid_at = mpPayment.date_approved;
    }

    const { error: updateError } = await supabase
      .from('mercado_pago_payments')
      .update(updateData)
      .eq('id', paymentRecord.id);

    if (updateError) {
      console.error('Error updating payment:', updateError);
      throw updateError;
    }

    console.log('Payment updated:', paymentRecord.id, 'new status:', ourStatus);

    // If payment was approved, update the related entity
    if (ourStatus === 'approved') {
      if (paymentRecord.source === 'transaction' && paymentRecord.financial_transaction_id) {
        await supabase
          .from('financial_transactions')
          .update({ status: 'paid', paid_at: new Date().toISOString() })
          .eq('id', paymentRecord.financial_transaction_id);
        console.log('Updated financial transaction to paid');
      }

      if (paymentRecord.source === 'package' && paymentRecord.patient_package_id) {
        // Update package payment status if needed
        await supabase
          .from('package_payments')
          .update({ status: 'paid', paid_at: new Date().toISOString() })
          .eq('patient_package_id', paymentRecord.patient_package_id)
          .eq('status', 'pending');
        console.log('Updated package payment to paid');
      }

      if (paymentRecord.source === 'quote' && paymentRecord.quote_id) {
        await supabase
          .from('quotes')
          .update({ status: 'paid' })
          .eq('id', paymentRecord.quote_id);
        console.log('Updated quote to paid');
      }

      if (paymentRecord.source === 'booking' && paymentRecord.appointment_id) {
        await supabase
          .from('appointments')
          .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
          .eq('id', paymentRecord.appointment_id);
        console.log('Updated appointment to confirmed');
      }
    }

    return new Response(JSON.stringify({ received: true, status: ourStatus }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
