import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationRequest {
  clinic_id: string;
  patient_id: string;
  file_name?: string;
  // Optional: used when sending in batch mode
  batch?: boolean;
}

interface EvolutionConfig {
  api_url: string;
  api_key: string;
  instance_name: string;
  is_connected: boolean;
}

async function sendWhatsAppText(
  config: EvolutionConfig,
  phone: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  try {
    let formattedPhone = phone.replace(/\D/g, '');
    if (!formattedPhone.startsWith('55')) {
      formattedPhone = '55' + formattedPhone;
    }

    console.log(`[send-payslip-upload-notification] Sending WhatsApp to ${formattedPhone}`);

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

    const responseText = await response.text();
    console.log(`[send-payslip-upload-notification] Evolution API response: ${response.status} - ${responseText}`);

    if (!response.ok) {
      return { success: false, error: `API error ${response.status}: ${responseText}` };
    }

    return { success: true };
  } catch (error) {
    console.error('[send-payslip-upload-notification] Error sending WhatsApp:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { clinic_id, patient_id, file_name, batch }: NotificationRequest = await req.json();

    console.log('[send-payslip-upload-notification] Processing notification', {
      clinic_id,
      patient_id,
      file_name,
      batch,
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

    // Get patient info
    const { data: patient } = await supabase
      .from('patients')
      .select('name, phone')
      .eq('id', patient_id)
      .single();

    if (!patient || !patient.phone) {
      console.log('[send-payslip-upload-notification] Patient not found or no phone');
      return new Response(
        JSON.stringify({ success: false, error: 'Sócio sem telefone cadastrado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Evolution config for clinic
    const { data: evolutionConfig } = await supabase
      .from('evolution_configs')
      .select('api_url, api_key, instance_name, is_connected')
      .eq('clinic_id', clinic_id)
      .eq('is_connected', true)
      .single();

    if (!evolutionConfig) {
      console.log('[send-payslip-upload-notification] No Evolution instance configured for clinic');
      return new Response(
        JSON.stringify({ success: false, error: 'WhatsApp não configurado para esta clínica' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get patient's active card
    const { data: activeCard } = await supabase
      .from('patient_cards')
      .select('expires_at, card_number')
      .eq('patient_id', patient_id)
      .eq('is_active', true)
      .order('expires_at', { ascending: false })
      .limit(1)
      .single();

    // Build message
    const firstName = patient.name.split(' ')[0];
    const cardLine = activeCard?.expires_at
      ? `\n🪪 Sua carteirinha digital está válida até *${new Date(activeCard.expires_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}*.`
      : '';

    const message = `📄 Olá, ${firstName}!

Seu *contracheque* foi atualizado pelo ${clinic.name}.
${cardLine}
✅ O documento já está disponível na sua área do associado.

Em caso de dúvidas, entre em contato conosco.

*Equipe ${clinic.name}*`;

    const result = await sendWhatsAppText(evolutionConfig as EvolutionConfig, patient.phone, message);

    if (!result.success) {
      console.error('[send-payslip-upload-notification] Failed to send WhatsApp:', result.error);
    } else {
      console.log('[send-payslip-upload-notification] WhatsApp notification sent successfully to', patient.name);
    }

    return new Response(
      JSON.stringify({
        success: result.success,
        patient_name: patient.name,
        whatsapp_sent: result.success,
        error: result.error,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[send-payslip-upload-notification] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
