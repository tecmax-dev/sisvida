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

const PROFESSIONALS_RODOVIARIOS_LOCATION = ['marcelo aguiar', 'jorge avelar', 'pedro roberto'];
const RODOVIARIOS_CLINIC_NAME = 'Sindicato dos Rodoviários';

function isRodoviariosProfessional(professionalName: string): boolean {
  const lowerName = professionalName.toLowerCase();
  return PROFESSIONALS_RODOVIARIOS_LOCATION.some(name => lowerName.includes(name));
}

function getProfessionalLocation(professionalName: string): string | null {
  if (isRodoviariosProfessional(professionalName)) {
    return `*Local:* Av. Antonio Carlos Magalhães, 1062, Bairro Malhado\n   Sede do Sindicato dos Rodoviários\n   (ao lado da Igreja Testemunhas de Jeová)`;
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
  // RC1 — Política informativa (WhatsApp = canal informativo).
  const firstName = patientName.split(' ')[0];
  return [
    `Olá, ${firstName}.`,
    ``,
    `Lembramos que sua consulta está agendada para:`,
    ``,
    `Data: ${date}`,
    `Horário: ${time}`,
    `Profissional: ${professionalName}`,
    ``,
    `Caso seja necessário alterar ou cancelar seu agendamento, utilize exclusivamente o aplicativo oficial do Sindicato.`,
    ``,
    clinicName,
  ].join('\n');
}

function getWhazingSendUrl(baseUrl: string): string {
  const cleanBase = baseUrl.replace(/\/$/, '');
  if (cleanBase.includes('/api/external/') || cleanBase.endsWith('/apioficial')) {
    return cleanBase;
  }
  return `${cleanBase}/apioficial`;
}

function isChatgooExternalUrl(baseUrl: string): boolean {
  return baseUrl.includes('/api/external/');
}

function getWhazingApiPlusUrl(baseUrl: string): string {
  const cleanBase = baseUrl.replace(/\/$/, '');
  if (cleanBase.endsWith('/apioficial')) return cleanBase;
  if (cleanBase.includes('/api/external/')) {
    return `${cleanBase}/apioficial`;
  }
  return `${cleanBase}/apioficial`;
}

function buildWhazingTextPayload(baseUrl: string, phone: string, message: string): Record<string, unknown> {
  if (isChatgooExternalUrl(baseUrl)) {
    return { number: phone, body: message };
  }

  return {
    number: phone,
    contents: { type: 'text', body: { text: message } },
  };
}

function buildWhazingButtonPayload(baseUrl: string, phone: string, bodyText: string, buttons: Array<{ id: string; title: string }>): Record<string, unknown> {
  return {
    number: phone,
    contents: {
      type: "button",
      body: { text: bodyText },
      action: {
        buttons: buttons.map(b => ({ type: "reply", reply: { id: b.id, title: b.title } }))
      }
    }
  };
}

function buildWhazingExternalButtonPayload(phone: string, bodyText: string, buttons: Array<{ id: string; title: string }>): Record<string, unknown> {
  return {
    number: phone,
    body: bodyText,
    buttons: buttons.map(b => ({ id: b.id, title: b.title })),
  };
}

async function sendWhatsAppTextOnly(
  config: EvolutionConfig,
  phone: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  try {
    let formattedPhone = phone.replace(/\D/g, '');
    if (!formattedPhone.startsWith('55')) {
      formattedPhone = '55' + formattedPhone;
    }

    console.log(`[test] Sending text via Evolution to ${formattedPhone}`);

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
    if (!response.ok) {
      console.error('[test] Evolution API error:', response.status, responseText);
      return { success: false, error: responseText };
    }

    console.log('[test] Evolution OK:', responseText.substring(0, 200));
    return { success: true };
  } catch (error) {
    console.error('[test] Evolution exception:', error);
    return { success: false, error: String(error) };
  }
}

async function sendWhatsAppViaWhazing(
  phone: string,
  message: string
): Promise<{ success: boolean; error?: string; response?: string }> {
  const whazingUrl = Deno.env.get('WHAZING_API_URL');
  const whazingToken = Deno.env.get('WHAZING_API_TOKEN');

  if (!whazingUrl || !whazingToken) {
    return { success: false, error: 'Whazing not configured' };
  }

  try {
    let cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone.startsWith('55')) cleanPhone = '55' + cleanPhone;

    const apiOficialUrl = getWhazingSendUrl(whazingUrl);
    console.log(`[test-whazing-text] Sending text to ${cleanPhone}`);

    const response = await fetch(apiOficialUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${whazingToken}`,
      },
      body: JSON.stringify(buildWhazingTextPayload(whazingUrl, cleanPhone, message)),
    });

    const responseText = await response.text();
    console.log(`[test-whazing-text] Status: ${response.status}, Body: ${responseText.substring(0, 300)}`);

    if (!response.ok) {
      return { success: false, error: `${response.status}: ${responseText}`, response: responseText };
    }
    return { success: true, response: responseText };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

async function sendConfirmationButtons(
  phone: string,
  testAppointmentId: string
): Promise<{ success: boolean; error?: string; response?: string }> {
  const whazingUrl = Deno.env.get('WHAZING_API_URL');
  const whazingToken = Deno.env.get('WHAZING_API_TOKEN');

  if (!whazingUrl || !whazingToken) {
    return { success: false, error: 'Whazing not configured' };
  }

  try {
    let cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone.startsWith('55')) cleanPhone = '55' + cleanPhone;

    const buttons = [
      { id: `confirm_apt_${testAppointmentId}`, title: "Confirmar" },
      { id: `cancel_apt_${testAppointmentId}`, title: "Cancelar" },
    ];

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${whazingToken}`,
    };

    const apiOficialUrl = getWhazingApiPlusUrl(whazingUrl);
    console.log(`[test-buttons] Sending buttons to ${cleanPhone} via API PLUS/native buttons`);

    let response = await fetch(apiOficialUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(buildWhazingButtonPayload(whazingUrl, cleanPhone, "Confirme ou cancele sua consulta:", buttons)),
    });

    let responseText = await response.text();
    if (!response.ok && isChatgooExternalUrl(whazingUrl)) {
      console.warn(`[test-buttons] API PLUS failed (${response.status}); retrying external endpoint: ${responseText.substring(0, 300)}`);
      response = await fetch(getWhazingSendUrl(whazingUrl), {
        method: 'POST',
        headers,
        body: JSON.stringify(buildWhazingExternalButtonPayload(cleanPhone, "Confirme ou cancele sua consulta:", buttons)),
      });
      responseText = await response.text();
    }

    console.log(`[test-buttons] Status: ${response.status}, Body: ${responseText.substring(0, 300)}`);

    if (!response.ok) {
      return { success: false, error: `${response.status}: ${responseText}`, response: responseText };
    }
    return { success: true, response: responseText };
  } catch (error) {
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

    const { data: evolutionConfig, error: configError } = await supabase
      .from('evolution_configs')
      .select('api_url, api_key, instance_name')
      .eq('clinic_id', clinic_id)
      .maybeSingle();

    if (configError || !evolutionConfig) {
      return new Response(
        JSON.stringify({ success: false, error: 'Evolution config not found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const testDate = 'sexta-feira, 10 de janeiro';
    const testTime = '14:00';
    const testProfessional = 'Dr. José Silva';
    const testPatient = 'João Teste';
    const testAppointmentId = 'test-' + Date.now();

    const message = formatAppointmentReminder(testPatient, clinicName, testDate, testTime, testProfessional);

    // STEP 1: Try Evolution as text-only
    console.log('[test] === STEP 1: Try Evolution text-only ===');
    const evolutionResult = await sendWhatsAppTextOnly(evolutionConfig as EvolutionConfig, phone, message);

    // STEP 2: If Evolution fails, fallback to Whazing text
    let whazingTextResult = null;
    let messageSent = evolutionResult.success;
    if (!evolutionResult.success) {
      console.log('[test] === STEP 2: Evolution failed, trying Whazing text fallback ===');
      whazingTextResult = await sendWhatsAppViaWhazing(phone, message);
      messageSent = whazingTextResult.success;
    }

    // RC1 — Política informativa: não enviar botões Confirmar/Cancelar.
    const buttonsResult = null;
    void testAppointmentId;

    return new Response(
      JSON.stringify({
        success: messageSent,
        evolution: evolutionResult,
        whazing_text_fallback: whazingTextResult,
        buttons: buttonsResult,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('[test] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
