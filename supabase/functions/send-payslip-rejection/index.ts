import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RejectionRequest {
  clinic_id: string;
  patient_id: string;
  patient_name: string;
  patient_phone: string;
  card_id?: string;
  rejection_reason: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { 
      clinic_id, 
      patient_id, 
      patient_name, 
      patient_phone, 
      card_id,
      rejection_reason 
    }: RejectionRequest = await req.json();

    console.log('[send-payslip-rejection] Processing rejection notification', {
      clinic_id,
      patient_id,
      patient_name,
      rejection_reason
    });

    // Get clinic info
    const { data: clinic } = await supabase
      .from('clinics')
      .select('name, whatsapp_provider')
      .eq('id', clinic_id)
      .single();

    if (!clinic) {
      throw new Error('Clínica não encontrada');
    }

    // Get current month name in Portuguese
    const months = [
      'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
      'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
    ];
    const now = new Date();
    const currentMonth = months[now.getMonth()];
    const currentYear = now.getFullYear();
    const previousMonth = months[now.getMonth() === 0 ? 11 : now.getMonth() - 1];

    // Format message
    const firstName = patient_name.split(' ')[0];
    const message = `⚠️ Olá, ${firstName}!

Infelizmente não foi possível aprovar seu contracheque.

📋 *Motivo:* ${rejection_reason}

Para renovar sua carteirinha, envie um novo contracheque:
✅ Do mês atual (${currentMonth}/${currentYear}) ou do mês anterior (${previousMonth})
✅ Com seu nome e data visíveis
✅ Foto legível e completa

Basta responder esta mensagem com a foto do documento atualizado.

Obrigado pela compreensão!
Equipe ${clinic.name}`;

    // Send WhatsApp message
    const { error: sendError } = await supabase.functions.invoke('send-whatsapp', {
      body: {
        clinicId: clinic_id,
        phone: patient_phone,
        message: message
      }
    });

    if (sendError) {
      console.error('[send-payslip-rejection] Error sending WhatsApp:', sendError);
      // Don't fail completely if message fails to send
    } else {
      console.log('[send-payslip-rejection] WhatsApp notification sent successfully');
    }

    // Create a new pending request for the patient to resubmit
    const { error: insertError } = await supabase
      .from('payslip_requests')
      .insert({
        clinic_id,
        patient_id,
        card_id,
        status: 'pending',
        notes: `Aguardando reenvio após rejeição: ${rejection_reason}`,
        requested_at: new Date().toISOString()
      });

    if (insertError) {
      console.error('[send-payslip-rejection] Error creating new pending request:', insertError);
    } else {
      console.log('[send-payslip-rejection] New pending request created for resubmission');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Notificação de rejeição enviada e nova solicitação criada' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[send-payslip-rejection] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
