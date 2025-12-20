import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

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

interface ClinicWithReminder {
  id: string;
  name: string;
  slug: string;
  reminder_enabled: boolean;
  reminder_hours: number;
}

async function sendWhatsAppViaEvolution(
  config: EvolutionConfig,
  phone: string,
  message: string
): Promise<boolean> {
  try {
    let formattedPhone = phone.replace(/\D/g, '');
    if (!formattedPhone.startsWith('55')) {
      formattedPhone = '55' + formattedPhone;
    }

    console.log(`Sending WhatsApp to ${formattedPhone}`);

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
      console.error('WhatsApp API error:', errorText);
    }

    return response.ok;
  } catch (error) {
    console.error('Error sending WhatsApp:', error);
    return false;
  }
}

function formatDateTime(date: Date, time: string): string {
  const dateStr = date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });
  return dateStr;
}

function formatAppointmentReminder(
  patientName: string,
  clinicName: string,
  date: string,
  time: string,
  professionalName: string,
  confirmationLink?: string
): string {
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
    confirmationLink ? `Para confirmar ou cancelar sua consulta, acesse:` : `Por favor, confirme sua presença respondendo esta mensagem.`,
    confirmationLink ? confirmationLink : null,
    ``,
    `Atenciosamente,`,
    `Equipe ${clinicName}`,
  ].filter(Boolean);

  return lines.join('\n');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    console.log(`[${now.toISOString()}] Starting automatic reminder check`);

    // Get clinics with reminders enabled
    const { data: clinics, error: clinicsError } = await supabase
      .from('clinics')
      .select('id, name, slug, reminder_enabled, reminder_hours')
      .eq('reminder_enabled', true);

    if (clinicsError) {
      console.error('Error fetching clinics:', clinicsError);
      throw clinicsError;
    }

    console.log(`Found ${clinics?.length || 0} clinics with reminders enabled`);

    let sentCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    const baseUrl = Deno.env.get('APP_BASE_URL') || 'https://eclini.lovable.app';

    for (const clinic of (clinics || []) as ClinicWithReminder[]) {
      const reminderHours = clinic.reminder_hours || 24;
      
      // Calculate the target time window for this clinic
      // We want appointments that are exactly reminder_hours away (within a 1-hour window)
      const targetStart = new Date(now.getTime() + reminderHours * 60 * 60 * 1000);
      const targetEnd = new Date(targetStart.getTime() + 60 * 60 * 1000); // +1 hour window
      
      const targetDate = targetStart.toISOString().split('T')[0];
      const targetStartTime = targetStart.toTimeString().substring(0, 5);
      const targetEndTime = targetEnd.toTimeString().substring(0, 5);
      
      console.log(`Clinic ${clinic.name}: checking appointments for ${targetDate} between ${targetStartTime} and ${targetEndTime} (${reminderHours}h before)`);

      // Fetch clinic's Evolution API config
      const { data: evolutionConfig } = await supabase
        .from('evolution_configs')
        .select('api_url, api_key, instance_name, is_connected')
        .eq('clinic_id', clinic.id)
        .maybeSingle();

      if (!evolutionConfig || !evolutionConfig.is_connected) {
        console.log(`Clinic ${clinic.name} has no connected WhatsApp, skipping`);
        skippedCount++;
        continue;
      }

      // Get appointments in the target window that haven't been reminded yet
      const { data: appointments, error: appointmentsError } = await supabase
        .from('appointments')
        .select(`
          id,
          appointment_date,
          start_time,
          reminder_sent,
          confirmation_token,
          patient:patients (
            name,
            phone
          ),
          professional:professionals (
            name
          )
        `)
        .eq('clinic_id', clinic.id)
        .eq('appointment_date', targetDate)
        .gte('start_time', targetStartTime)
        .lt('start_time', targetEndTime)
        .in('status', ['scheduled', 'confirmed'])
        .eq('reminder_sent', false);

      if (appointmentsError) {
        console.error(`Error fetching appointments for clinic ${clinic.id}:`, appointmentsError);
        continue;
      }

      console.log(`Found ${appointments?.length || 0} appointments for clinic ${clinic.name}`);

      for (const appointment of appointments || []) {
        const patient = appointment.patient as any;
        const professional = appointment.professional as any;

        if (!patient?.phone) {
          console.log(`No phone for appointment ${appointment.id}`);
          continue;
        }

        // Format date for message
        const appointmentDate = new Date(appointment.appointment_date + 'T00:00:00');
        const dateFormatted = formatDateTime(appointmentDate, appointment.start_time);
        const time = appointment.start_time.substring(0, 5);

        // Build confirmation link
        const confirmationLink = appointment.confirmation_token 
          ? `${baseUrl}/consulta/${appointment.confirmation_token}`
          : undefined;

        // Create message
        const message = formatAppointmentReminder(
          patient.name,
          clinic.name,
          dateFormatted,
          time,
          professional?.name || 'Profissional',
          confirmationLink
        );

        const success = await sendWhatsAppViaEvolution(
          evolutionConfig as EvolutionConfig,
          patient.phone,
          message
        );

        if (success) {
          // Mark as sent
          await supabase
            .from('appointments')
            .update({ reminder_sent: true })
            .eq('id', appointment.id);
          
          sentCount++;
          console.log(`✓ Reminder sent to ${patient.name} for appointment on ${targetDate} at ${time}`);
        } else {
          errorCount++;
          console.error(`✗ Failed to send reminder to ${patient.name}`);
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
      timestamp: now.toISOString()
    };

    console.log(`Summary:`, summary);

    return new Response(
      JSON.stringify(summary),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error in send-appointment-reminders:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
