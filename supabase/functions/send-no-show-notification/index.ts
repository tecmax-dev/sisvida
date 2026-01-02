import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NoShowNotificationRequest {
  clinic_id: string;
  patient_id: string;
  patient_name: string;
  patient_phone: string;
  clinic_name: string;
  appointment_date: string;
  block_until: string;
}

interface EvolutionConfig {
  api_url: string;
  api_key: string;
  instance_name: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: NoShowNotificationRequest = await req.json();
    console.log('No-show notification request:', payload);

    const { clinic_id, patient_id, patient_name, patient_phone, clinic_name, appointment_date, block_until } = payload;

    if (!patient_phone || patient_phone.trim() === '') {
      console.log('Patient has no phone number, skipping notification');
      return new Response(
        JSON.stringify({ success: false, error: 'No phone number' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch Evolution API config
    const { data: evolutionConfig, error: configError } = await supabase
      .from('evolution_configs')
      .select('api_url, api_key, instance_name, is_connected')
      .eq('clinic_id', clinic_id)
      .single();

    if (configError || !evolutionConfig) {
      console.error('Evolution config not found:', configError);
      return new Response(
        JSON.stringify({ success: false, error: 'WhatsApp not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!evolutionConfig.is_connected) {
      console.error('WhatsApp not connected');
      return new Response(
        JSON.stringify({ success: false, error: 'WhatsApp not connected' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format phone number
    let formattedPhone = patient_phone.replace(/\D/g, '');
    if (formattedPhone.length === 11 && !formattedPhone.startsWith('55')) {
      formattedPhone = '55' + formattedPhone;
    } else if (formattedPhone.length === 10 && !formattedPhone.startsWith('55')) {
      formattedPhone = '55' + formattedPhone;
    }

    // Create friendly message
    const firstName = patient_name.split(' ')[0];
    const message = `Olá ${firstName}! 👋

Notamos sua ausência na consulta agendada para ${appointment_date} na ${clinic_name}.

Sabemos que imprevistos acontecem! 💙 Por isso, gostaríamos de entender o que houve.

⚠️ *Importante*: Para manter a organização da agenda e garantir que todos sejam atendidos, novos agendamentos estarão temporariamente suspensos até ${block_until}.

Se houve algum imprevisto ou precisar reagendar, entre em contato conosco! Estamos aqui para ajudar. 🤝

Atenciosamente,
Equipe ${clinic_name}`;

    // Send WhatsApp message via Evolution API
    const sendUrl = `${evolutionConfig.api_url}/message/sendText/${evolutionConfig.instance_name}`;
    
    console.log('Sending no-show notification to:', formattedPhone);
    
    const response = await fetch(sendUrl, {
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

    const result = await response.json();
    console.log('Evolution API response:', result);

    if (!response.ok) {
      throw new Error(result.message || 'Failed to send message');
    }

    // Log the message
    const monthYear = new Date().toISOString().slice(0, 7);
    await supabase.from('message_logs').insert({
      clinic_id,
      phone: formattedPhone,
      message_type: 'no_show_notification',
      status: 'sent',
      month_year: monthYear,
    });

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error sending no-show notification:', errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
