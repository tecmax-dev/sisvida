import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EvolutionConfig {
  api_url: string;
  api_key: string;
  instance_name: string;
  is_connected: boolean;
}

// Get Brazil time (UTC-3)
function getBrazilTime(): Date {
  const now = new Date();
  const utcTime = now.getTime();
  const brazilOffsetMs = -3 * 60 * 60 * 1000;
  return new Date(utcTime + brazilOffsetMs);
}

async function sendWhatsAppWithImage(
  config: EvolutionConfig,
  phone: string,
  imageUrl: string,
  caption: string
): Promise<boolean> {
  try {
    let formattedPhone = phone.replace(/\D/g, '');
    if (!formattedPhone.startsWith('55')) {
      formattedPhone = '55' + formattedPhone;
    }
    // Fix Brazilian mobile: add 9 after DDD if missing
    if (formattedPhone.length === 12 && formattedPhone.startsWith('55')) {
      const ddd = formattedPhone.substring(2, 4);
      const number = formattedPhone.substring(4);
      if (!number.startsWith('9')) {
        formattedPhone = `55${ddd}9${number}`;
      }
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
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error sending WhatsApp with image:', error);
    return false;
  }
}

function formatReminderMessage(
  type: 'company' | 'manager' | 'professional',
  data: {
    protocolNumber: string;
    companyName: string;
    employeeName: string;
    startTime: string;
    address: string;
    publicWhatsapp?: string;
    clinicName: string;
  }
): string {
  const { protocolNumber, companyName, employeeName, startTime, address, publicWhatsapp, clinicName } = data;

  if (type === 'company') {
    const lines = [
      `⏰ *Lembrete - Homologação em 5 horas*`,
      ``,
      `📋 *Protocolo:* ${protocolNumber}`,
      `🏢 *Empresa:* ${companyName}`,
      `👤 *Funcionário:* ${employeeName}`,
      `🕐 *Horário:* ${startTime}`,
      `📍 *Local:* ${address}`,
    ];
    
    if (publicWhatsapp) {
      lines.push(``, `Em caso de dúvidas: ${publicWhatsapp}`);
    }
    
    lines.push(``, `_${clinicName}_`);
    return lines.join('\n');
  }

  if (type === 'manager') {
    return [
      `⏰ *Lembrete - Homologação em 5 horas*`,
      ``,
      `📋 *Protocolo:* ${protocolNumber}`,
      `🏢 *Empresa:* ${companyName}`,
      `👤 *Funcionário:* ${employeeName}`,
      `🕐 *Horário:* ${startTime}`,
    ].join('\n');
  }

  // professional
  return [
    `⏰ *Lembrete - Homologação em 5 horas*`,
    ``,
    `📋 *Protocolo:* ${protocolNumber}`,
    `🏢 *Empresa:* ${companyName}`,
    `👤 *Funcionário:* ${employeeName}`,
    `🕐 *Horário:* ${startTime}`,
    `📍 *Local:* ${address}`,
  ].join('\n');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = getBrazilTime();
    console.log(`[Brasil] Starting homologacao reminder check at ${now.toISOString()}`);

    // Calculate target window: appointments 5 hours from now (+/- 30 min window)
    const reminderHours = 5;
    const targetStart = new Date(now.getTime() + reminderHours * 60 * 60 * 1000 - 30 * 60 * 1000);
    const targetEnd = new Date(now.getTime() + reminderHours * 60 * 60 * 1000 + 30 * 60 * 1000);

    const targetDate = targetStart.toISOString().split('T')[0];
    const targetStartTime = targetStart.toTimeString().substring(0, 5);
    const targetEndTime = targetEnd.toTimeString().substring(0, 5);

    console.log(`Looking for appointments on ${targetDate} between ${targetStartTime} and ${targetEndTime}`);

    // Get all active clinics with Evolution API connected
    const { data: clinics } = await supabase
      .from('clinics')
      .select('id, name, logo_url, whatsapp_header_image_url');

    let sentCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    for (const clinic of clinics || []) {
      // Fetch Evolution config
      const { data: evolutionConfig } = await supabase
        .from('evolution_configs')
        .select('api_url, api_key, instance_name, is_connected')
        .eq('clinic_id', clinic.id)
        .maybeSingle();

      if (!evolutionConfig || !evolutionConfig.is_connected) {
        skippedCount++;
        continue;
      }

      // Fetch homologacao settings
      const { data: settings } = await supabase
        .from('homologacao_settings')
        .select('manager_whatsapp, public_whatsapp, display_name, logo_url')
        .eq('clinic_id', clinic.id)
        .maybeSingle();

      const logoUrl = settings?.logo_url || clinic.whatsapp_header_image_url || clinic.logo_url || 'https://eclini.lovable.app/eclini-whatsapp-header.jpg';

      // Get appointments in target window that haven't received reminders
      const { data: appointments, error } = await supabase
        .from('homologacao_appointments')
        .select(`
          *,
          professional:homologacao_professionals(name, phone, address, city, state_code)
        `)
        .eq('clinic_id', clinic.id)
        .eq('appointment_date', targetDate)
        .gte('start_time', targetStartTime)
        .lte('start_time', targetEndTime)
        .in('status', ['scheduled', 'confirmed'])
        .is('reminder_sent_at', null);

      if (error) {
        console.error(`Error fetching appointments for clinic ${clinic.id}:`, error);
        continue;
      }

      console.log(`Found ${appointments?.length || 0} appointments for clinic ${clinic.name}`);

      for (const appointment of appointments || []) {
        const professional = appointment.professional as any;
        const address = [
          professional?.address,
          professional?.city,
          professional?.state_code
        ].filter(Boolean).join(', ') || 'Endereço não informado';

        const messageData = {
          protocolNumber: appointment.protocol_number || 'Não gerado',
          companyName: appointment.company_name || 'Não informado',
          employeeName: appointment.employee_name || 'Não informado',
          startTime: appointment.start_time?.substring(0, 5) || '',
          address,
          publicWhatsapp: settings?.public_whatsapp,
          clinicName: settings?.display_name || clinic.name || 'HomologaNet',
        };

        let anySuccess = false;

        // Send to company
        if (appointment.company_phone) {
          const companyMessage = formatReminderMessage('company', messageData);
          const success = await sendWhatsAppWithImage(
            evolutionConfig as EvolutionConfig,
            appointment.company_phone,
            logoUrl,
            companyMessage
          );
          if (success) anySuccess = true;
          console.log(`Company reminder ${appointment.id}: ${success ? '✓' : '✗'}`);
        }

        // Send to manager
        if (settings?.manager_whatsapp) {
          const managerMessage = formatReminderMessage('manager', messageData);
          const success = await sendWhatsAppWithImage(
            evolutionConfig as EvolutionConfig,
            settings.manager_whatsapp,
            logoUrl,
            managerMessage
          );
          if (success) anySuccess = true;
          console.log(`Manager reminder ${appointment.id}: ${success ? '✓' : '✗'}`);
        }

        // Send to professional
        if (professional?.phone) {
          const professionalMessage = formatReminderMessage('professional', messageData);
          const success = await sendWhatsAppWithImage(
            evolutionConfig as EvolutionConfig,
            professional.phone,
            logoUrl,
            professionalMessage
          );
          if (success) anySuccess = true;
          console.log(`Professional reminder ${appointment.id}: ${success ? '✓' : '✗'}`);
        }

        // Update reminder_sent_at
        if (anySuccess) {
          await supabase
            .from('homologacao_appointments')
            .update({ reminder_sent_at: new Date().toISOString() })
            .eq('id', appointment.id);
          sentCount++;
        } else {
          errorCount++;
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    const summary = {
      success: true,
      sent: sentCount,
      errors: errorCount,
      skipped: skippedCount,
      timestamp: now.toISOString(),
    };

    console.log('Summary:', summary);

    return new Response(
      JSON.stringify(summary),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error in send-homologacao-reminders:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
