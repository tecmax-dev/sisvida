import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEFAULT_SYSTEM_LOGO = 'https://prosindweb.com.br/prosindweb-whatsapp-header.jpg';

interface EvolutionConfig {
  api_url: string;
  api_key: string;
  instance_name: string;
}

const PROFESSIONALS_RODOVIARIOS_LOCATION = ['marcelo aguiar', 'jorge avelar'];

function getProfessionalLocation(professionalName: string): string | null {
  const lowerName = professionalName.toLowerCase();
  for (const name of PROFESSIONALS_RODOVIARIOS_LOCATION) {
    if (lowerName.includes(name)) {
      return `📍 *Local:* Av. Antonio Carlos Magalhães, 1062, Bairro Malhado\n   Sede do Sindicato dos Rodoviários\n   (ao lado da Igreja Testemunhas de Jeová)`;
    }
  }
  return null;
}

function formatAppointmentReminder(
  patientName: string,
  clinicName: string,
  date: string,
  time: string,
  professionalName: string,
): string {
  const noShowWarning = [
    `⚠️ *Atenção, Associado(a):*`,
    `Ao confirmar sua presença, você se compromete a comparecer. Caso não possa comparecer, por gentileza *cancele com antecedência* para que outro associado da fila de espera possa ser atendido.`,
    ``,
    `❗ Lembramos que a *falta sem cancelamento prévio* poderá resultar em *bloqueio temporário* para novos agendamentos com este profissional.`,
  ];

  const arrivalInstruction = `⏳ *Compareça com 15 minutos de antecedência.*`;
  const specificLocation = getProfessionalLocation(professionalName);

  // Always use the buttons format (no numbered list, no link)
  const lines = [
    `Olá ${patientName}! 👋`,
    ``,
    arrivalInstruction,
    ``,
    `Lembramos que você tem uma consulta agendada:`,
    ``,
    `📅 *Data:* ${date}`,
    `🕐 *Horário:* ${time}`,
    `👨‍⚕️ *Profissional:* ${professionalName}`,
    `🏥 *Clínica:* ${clinicName}`,
    specificLocation ? `` : null,
    specificLocation,
    ``,
    ...noShowWarning,
    ``,
    `Atenciosamente,`,
    `Equipe ${clinicName}`,
  ].filter(Boolean);
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

    console.log(`[test] Sending WhatsApp image+text to ${formattedPhone} via Evolution`);

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

    const responseText = await response.text();
    if (!response.ok) {
      console.error('[test] Evolution API error:', response.status, responseText);
      return { success: false, error: responseText };
    }

    console.log('[test] Evolution message sent OK:', responseText.substring(0, 200));
    return { success: true };
  } catch (error) {
    console.error('[test] Error sending via Evolution:', error);
    return { success: false, error: String(error) };
  }
}

async function sendConfirmationButtons(
  phone: string,
  testAppointmentId: string
): Promise<{ success: boolean; error?: string; response?: string }> {
  const whazingUrl = Deno.env.get('WHAZING_API_URL');
  const whazingToken = Deno.env.get('WHAZING_API_TOKEN');

  console.log(`[test-buttons] WHAZING_API_URL configured: ${!!whazingUrl}`);
  console.log(`[test-buttons] WHAZING_API_TOKEN configured: ${!!whazingToken}`);

  if (!whazingUrl || !whazingToken) {
    return { success: false, error: 'Whazing not configured (missing WHAZING_API_URL or WHAZING_API_TOKEN)' };
  }

  try {
    let cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone.startsWith('55')) {
      cleanPhone = '55' + cleanPhone;
    }

    const apiOficialUrl = whazingUrl.replace(/\/$/, '') + '/apioficial';
    console.log(`[test-buttons] Sending buttons to ${cleanPhone} via ${apiOficialUrl}`);

    const payload = {
      number: cleanPhone,
      contents: {
        type: "button",
        body: { text: "Confirme ou cancele sua consulta:" },
        action: {
          buttons: [
            { type: "reply", reply: { id: `confirm_apt_${testAppointmentId}`, title: "✅ Confirmar" } },
            { type: "reply", reply: { id: `cancel_apt_${testAppointmentId}`, title: "❌ Cancelar" } },
          ]
        }
      }
    };

    console.log(`[test-buttons] Payload:`, JSON.stringify(payload));

    const response = await fetch(apiOficialUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${whazingToken}`,
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    console.log(`[test-buttons] Response status: ${response.status}`);
    console.log(`[test-buttons] Response body: ${responseText.substring(0, 500)}`);

    if (!response.ok) {
      return { success: false, error: `Status ${response.status}: ${responseText}`, response: responseText };
    }

    return { success: true, response: responseText };
  } catch (error) {
    console.error('[test-buttons] Exception:', error);
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

    // Create test message with buttons format (no numbered list)
    const testDate = 'sexta-feira, 10 de janeiro';
    const testTime = '14:00';
    const testProfessional = 'Dr. José Silva';
    const testPatient = 'João Teste';
    const testAppointmentId = 'test-' + Date.now();

    const message = formatAppointmentReminder(
      testPatient,
      clinicName,
      testDate,
      testTime,
      testProfessional,
    );

    console.log('[test] === STEP 1: Sending main reminder message via Evolution ===');
    const mainResult = await sendWhatsAppWithImage(
      evolutionConfig as EvolutionConfig,
      phone,
      logoUrl,
      message
    );

    console.log('[test] Main message result:', mainResult);

    // Wait 1.5s then send buttons via Whazing
    console.log('[test] === STEP 2: Waiting 1.5s before sending buttons ===');
    await new Promise(resolve => setTimeout(resolve, 1500));

    console.log('[test] === STEP 3: Sending confirmation buttons via Whazing ===');
    const buttonsResult = await sendConfirmationButtons(phone, testAppointmentId);
    console.log('[test] Buttons result:', buttonsResult);

    return new Response(
      JSON.stringify({
        success: mainResult.success,
        main_message: mainResult,
        buttons: buttonsResult,
        message: mainResult.success ? 'Test reminder sent' : 'Failed to send reminder',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('[test] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
