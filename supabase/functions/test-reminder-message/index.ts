import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEFAULT_SYSTEM_LOGO = 'https://app.eclini.com.br/eclini-whatsapp-header.jpg';

interface EvolutionConfig {
  api_url: string;
  api_key: string;
  instance_name: string;
}

function formatAppointmentReminder(
  patientName: string,
  clinicName: string,
  date: string,
  time: string,
  professionalName: string,
  directReplyEnabled: boolean = false
): string {
  // Aviso amigável sobre bloqueio por falta e incentivo para cancelar
  const noShowWarning = [
    `⚠️ *Atenção, Associado(a):*`,
    `Ao confirmar sua presença, você se compromete a comparecer. Caso não possa comparecer, por gentileza *cancele com antecedência* para que outro associado da fila de espera possa ser atendido.`,
    ``,
    `❗ Lembramos que a *falta sem cancelamento prévio* poderá resultar em *bloqueio temporário* para novos agendamentos com este profissional.`,
  ];

  if (directReplyEnabled) {
    const lines = [
      `Olá ${patientName}! 👋`,
      ``,
      `Lembramos que você tem uma consulta agendada:`,
      ``,
      `📅 *Data:* ${date}`,
      `🕐 *Horário:* ${time}`,
      `👨‍⚕️ *Profissional:* ${professionalName}`,
      `🏥 *Clínica:* ${clinicName}`,
      ``,
      ...noShowWarning,
      ``,
      `✅ *Responda SIM para confirmar*`,
      `❌ *Responda NÃO para cancelar*`,
      ``,
      `Atenciosamente,`,
      `Equipe ${clinicName}`,
    ];
    return lines.join('\n');
  }

  const lines = [
    `Olá ${patientName}! 👋`,
    ``,
    `Lembramos que você tem uma consulta agendada:`,
    ``,
    `📅 *Data:* ${date}`,
    `🕐 *Horário:* ${time}`,
    `👨‍⚕️ *Profissional:* ${professionalName}`,
    `🏥 *Clínica:* ${clinicName}`,
    ``,
    ...noShowWarning,
    ``,
    `Por favor, confirme sua presença respondendo esta mensagem.`,
    ``,
    `Atenciosamente,`,
    `Equipe ${clinicName}`,
  ];

  return lines.join('\n');
}

async function sendWhatsAppWithImage(
  config: EvolutionConfig,
  phone: string,
  imageUrl: string,
  caption: string
): Promise<{ success: boolean; error?: string }> {
  try {
    let formattedPhone = phone.replace(/\D/g, '');
    if (!formattedPhone.startsWith('55')) {
      formattedPhone = '55' + formattedPhone;
    }

    console.log(`Sending WhatsApp with image to ${formattedPhone}`);

    const response = await fetch(`${config.api_url}/message/sendMedia/${config.instance_name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.api_key,
      },
      body: JSON.stringify({
        number: formattedPhone,
        mediatype: 'image',
        media: imageUrl,
        caption: caption,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('WhatsApp API error:', errorText);
      return { success: false, error: errorText };
    }

    return { success: true };
  } catch (error) {
    console.error('Error sending WhatsApp with image:', error);
    return { success: false, error: String(error) };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { phone, clinic_id } = await req.json();

    if (!phone) {
      return new Response(
        JSON.stringify({ success: false, error: 'Phone number required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get clinic info
    let clinicName = 'Clínica Teste';
    let logoUrl = DEFAULT_SYSTEM_LOGO;

    if (clinic_id) {
      const { data: clinic } = await supabase
        .from('clinics')
        .select('name, whatsapp_header_image_url, logo_url')
        .eq('id', clinic_id)
        .single();

      if (clinic) {
        clinicName = clinic.name;
        logoUrl = clinic.whatsapp_header_image_url || clinic.logo_url || DEFAULT_SYSTEM_LOGO;
      }
    }

    // Get Evolution config for the clinic
    const { data: evolutionConfig, error: configError } = await supabase
      .from('evolution_configs')
      .select('api_url, api_key, instance_name, direct_reply_enabled')
      .eq('clinic_id', clinic_id)
      .maybeSingle();

    if (configError || !evolutionConfig) {
      return new Response(
        JSON.stringify({ success: false, error: 'Evolution config not found for clinic' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create test message with the new format
    const testDate = 'sexta-feira, 10 de janeiro';
    const testTime = '14:00';
    const testProfessional = 'Dr. José Silva';
    const testPatient = 'João Teste';

    const message = formatAppointmentReminder(
      testPatient,
      clinicName,
      testDate,
      testTime,
      testProfessional,
      evolutionConfig.direct_reply_enabled || false
    );

    console.log('Sending test reminder to:', phone);
    console.log('Message:', message);

    const result = await sendWhatsAppWithImage(
      evolutionConfig as EvolutionConfig,
      phone,
      logoUrl,
      message
    );

    if (result.success) {
      return new Response(
        JSON.stringify({ success: true, message: 'Test reminder sent successfully' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      return new Response(
        JSON.stringify({ success: false, error: result.error }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error: unknown) {
    console.error('Error in test-reminder-message:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
