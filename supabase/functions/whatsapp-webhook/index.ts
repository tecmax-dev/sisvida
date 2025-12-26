import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Regex para interpretar respostas positivas
const POSITIVE_REGEX = /^(sim|s|confirmo|ok|👍|confirmado|confirmar|vou|yes|y|simmm|siim|sím)$/i;

// Regex para interpretar respostas negativas
const NEGATIVE_REGEX = /^(não|nao|n|cancelo|cancelar|❌|desisto|nao vou|não vou|no|cancel|cancelado)$/i;

interface EvolutionWebhookPayload {
  event?: string;
  instance?: string;
  data?: {
    key?: {
      remoteJid?: string;
      fromMe?: boolean;
    };
    message?: {
      conversation?: string;
      extendedTextMessage?: {
        text?: string;
      };
    };
    messageType?: string;
  };
}

function normalizePhone(phone: string): string {
  // Important: payload comes often as "55XXXXXXXXXXX@s.whatsapp.net"
  let cleaned = phone.replace(/@s\.whatsapp\.net$/, '').replace(/\D/g, '');
  if (!cleaned.startsWith('55')) cleaned = '55' + cleaned;
  return cleaned;
}

function getBrazilPhoneVariants(phone55: string): string[] {
  const cleaned = phone55.replace(/\D/g, '');
  if (!cleaned.startsWith('55')) return [cleaned];

  // Brazil format: 55 + DDD(2) + number(8 or 9)
  const ddd = cleaned.slice(2, 4);
  const rest = cleaned.slice(4);

  const variants = new Set<string>();
  variants.add(cleaned);

  // If missing the leading '9' (8-digit local), try adding it
  if (rest.length === 8) {
    variants.add(`55${ddd}9${rest}`);
  }

  // If has 9 digits and starts with 9, try removing it (some providers strip it)
  if (rest.length === 9 && rest.startsWith('9')) {
    variants.add(`55${ddd}${rest.slice(1)}`);
  }

  return Array.from(variants);
}

function extractMessageText(data: EvolutionWebhookPayload['data']): string | null {
  if (!data) return null;
  
  // Try different message formats
  const text = data.message?.conversation || 
               data.message?.extendedTextMessage?.text ||
               null;
  
  return text?.trim() || null;
}

async function sendWhatsAppResponse(
  config: { api_url: string; api_key: string; instance_name: string },
  phone: string,
  message: string
): Promise<boolean> {
  try {
    let formattedPhone = phone.replace(/\D/g, '');
    if (!formattedPhone.startsWith('55')) {
      formattedPhone = '55' + formattedPhone;
    }

    console.log(`[webhook] Sending response to ${formattedPhone}`);

    const response = await fetch(`${config.api_url}/message/sendText/${config.instance_name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.api_key,
      },
      body: JSON.stringify({
        number: formattedPhone,
        text: message,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[webhook] WhatsApp API error:', errorText);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[webhook] Error sending WhatsApp:', error);
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const payload: EvolutionWebhookPayload = await req.json();
    
    console.log('[webhook] Received event:', payload.event);
    console.log('[webhook] Instance:', payload.instance);
    console.log('[webhook] Payload:', JSON.stringify(payload).substring(0, 500));

    // Only process MESSAGES_UPSERT events (incoming messages)
    if (payload.event !== 'MESSAGES_UPSERT' && payload.event !== 'messages.upsert') {
      console.log('[webhook] Ignoring non-message event:', payload.event);
      return new Response(
        JSON.stringify({ success: true, message: 'Event ignored' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Ignore messages sent by the bot itself
    if (payload.data?.key?.fromMe) {
      console.log('[webhook] Ignoring message from self');
      return new Response(
        JSON.stringify({ success: true, message: 'Self message ignored' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract phone number and message
    const remoteJid = payload.data?.key?.remoteJid || '';
    const phone = normalizePhone(remoteJid.replace('@s.whatsapp.net', ''));
    const messageText = extractMessageText(payload.data);

    console.log(`[webhook] Phone: ${phone}, Message: "${messageText}"`);

    if (!phone || !messageText) {
      console.log('[webhook] Missing phone or message');
      return new Response(
        JSON.stringify({ success: true, message: 'No action needed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find pending confirmation for this phone (handle Brazil 9-digit variations)
    const phoneCandidates = getBrazilPhoneVariants(phone);
    console.log('[webhook] Phone candidates for lookup:', phoneCandidates);

    const { data: pendingConfirmations, error: pendingError } = await supabase
      .from('pending_confirmations')
      .select(`
        id,
        appointment_id,
        clinic_id,
        expires_at
      `)
      .in('phone', phoneCandidates)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .order('sent_at', { ascending: false })
      .limit(1);

    if (pendingError) {
      console.error('[webhook] Error fetching pending confirmations:', pendingError);
    }

    // Determine action based on message
    let action: 'confirmed' | 'cancelled' | 'ignored' = 'ignored';
    
    if (POSITIVE_REGEX.test(messageText.trim())) {
      action = 'confirmed';
    } else if (NEGATIVE_REGEX.test(messageText.trim())) {
      action = 'cancelled';
    }

    console.log(`[webhook] Interpreted action: ${action}`);

    // Get clinic ID for logging (from pending confirmation or try to find from config)
    let clinicId: string | null = null;
    
    if (pendingConfirmations && pendingConfirmations.length > 0) {
      clinicId = pendingConfirmations[0].clinic_id;
    } else {
      // Try to find clinic by instance name
      const { data: configByInstance } = await supabase
        .from('evolution_configs')
        .select('clinic_id')
        .eq('instance_name', payload.instance)
        .maybeSingle();
      
      if (configByInstance) {
        clinicId = configByInstance.clinic_id;
      }
    }

    // Log incoming message
    const { error: logError } = await supabase
      .from('whatsapp_incoming_logs')
      .insert({
        clinic_id: clinicId,
        phone,
        message_text: messageText,
        raw_payload: payload,
        processed: action !== 'ignored',
        processed_action: action,
        processed_appointment_id: pendingConfirmations?.[0]?.appointment_id || null,
      });

    if (logError) {
      console.error('[webhook] Error logging message:', logError);
    }

    // If no pending confirmation or action is ignored, we're done
    if (!pendingConfirmations || pendingConfirmations.length === 0 || action === 'ignored') {
      console.log('[webhook] No pending confirmation or ignored action');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Message logged',
          action,
          hasPending: pendingConfirmations?.length || 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const pending = pendingConfirmations[0];

    // Get appointment details
    const { data: appointment, error: appointmentError } = await supabase
      .from('appointments')
      .select(`
        id,
        appointment_date,
        start_time,
        status,
        patient:patients (name),
        professional:professionals (name)
      `)
      .eq('id', pending.appointment_id)
      .single();

    if (appointmentError || !appointment) {
      console.error('[webhook] Error fetching appointment:', appointmentError);
      return new Response(
        JSON.stringify({ success: false, error: 'Appointment not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update appointment status
    const newStatus = action === 'confirmed' ? 'confirmed' : 'cancelled';
    const updateFields: Record<string, unknown> = {
      status: newStatus,
    };

    if (action === 'confirmed') {
      updateFields.confirmed_at = new Date().toISOString();
    } else {
      updateFields.cancelled_at = new Date().toISOString();
      updateFields.cancellation_reason = 'Cancelado pelo paciente via WhatsApp';
    }

    const { error: updateError } = await supabase
      .from('appointments')
      .update(updateFields)
      .eq('id', appointment.id);

    if (updateError) {
      console.error('[webhook] Error updating appointment:', updateError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to update appointment' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update pending confirmation status
    await supabase
      .from('pending_confirmations')
      .update({ status: action })
      .eq('id', pending.id);

    // Get clinic evolution config to send response
    const { data: evolutionConfig } = await supabase
      .from('evolution_configs')
      .select('api_url, api_key, instance_name, direct_reply_enabled')
      .eq('clinic_id', pending.clinic_id)
      .maybeSingle();

    // Get clinic name
    const { data: clinic } = await supabase
      .from('clinics')
      .select('name')
      .eq('id', pending.clinic_id)
      .single();

    // Send confirmation response via WhatsApp
    if (evolutionConfig && evolutionConfig.api_url && evolutionConfig.api_key) {
      const patient = appointment.patient as { name?: string } | null;
      const professional = appointment.professional as { name?: string } | null;
      const dateFormatted = new Date(appointment.appointment_date + 'T00:00:00').toLocaleDateString('pt-BR');
      const time = appointment.start_time?.substring(0, 5) || '';

      let responseMessage = '';
      
      if (action === 'confirmed') {
        responseMessage = `✅ Consulta confirmada com sucesso!\n\n` +
          `📅 ${dateFormatted} às ${time}\n` +
          `👨‍⚕️ ${professional?.name || 'Profissional'}\n\n` +
          `Aguardamos você!\n${clinic?.name || ''}`;
      } else {
        responseMessage = `❌ Consulta cancelada.\n\n` +
          `A consulta de ${dateFormatted} às ${time} foi cancelada conforme solicitado.\n\n` +
          `Caso deseje reagendar, entre em contato conosco.\n${clinic?.name || ''}`;
      }

      await sendWhatsAppResponse(evolutionConfig, phone, responseMessage);

      // Log response message
      const monthYear = new Date().toISOString().slice(0, 7);
      await supabase
        .from('message_logs')
        .insert({
          clinic_id: pending.clinic_id,
          message_type: action === 'confirmed' ? 'confirmation_response' : 'cancellation_response',
          phone,
          month_year: monthYear
        });
    }

    console.log(`[webhook] Successfully processed ${action} for appointment ${appointment.id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        action,
        appointmentId: appointment.id,
        newStatus 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[webhook] Error processing webhook:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
