import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Logo padrão do sistema Eclini para cabeçalho de mensagens WhatsApp
const DEFAULT_SYSTEM_LOGO = 'https://eclini.lovable.app/eclini-whatsapp-header.jpg';

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
  logo_url: string | null;
  whatsapp_header_image_url: string | null;
}

// Converter horário UTC para horário de Bahia, Brasil (UTC-3)
function getBrazilTime(): Date {
  const now = new Date();
  // Bahia (America/Bahia) = UTC-3
  // Calcular offset correto: UTC time - 3 horas
  const utcTime = now.getTime();
  const brazilOffsetMs = -3 * 60 * 60 * 1000; // -3 horas em milissegundos
  return new Date(utcTime + brazilOffsetMs);
}

// Formatar data para exibição no fuso horário do Brasil
function formatDateBrazil(date: Date): string {
  return date.toLocaleString('pt-BR', { timeZone: 'America/Bahia' });
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

function formatDateTime(dateStr: string, time: string): string {
  // Timezone-safe: parse YYYY-MM-DD at noon local time to avoid shifts
  const dateOnly = (dateStr || "").slice(0, 10);
  const match = dateOnly.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return dateStr;
  
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0);
  const formatted = date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });
  return formatted;
}

function formatAppointmentReminder(
  patientName: string,
  clinicName: string,
  date: string,
  time: string,
  professionalName: string,
  confirmationLink?: string,
  directReplyEnabled?: boolean
): string {
  // Aviso amigável sobre bloqueio por falta e incentivo para cancelar
  const noShowWarning = [
    `⚠️ *Atenção, Associado(a):*`,
    `Ao confirmar sua presença, você se compromete a comparecer. Caso não possa comparecer, por gentileza *cancele com antecedência* para que outro associado da fila de espera possa ser atendido.`,
    ``,
    `❗ Lembramos que a *falta sem cancelamento prévio* poderá resultar em *bloqueio temporário* para novos agendamentos com este profissional.`,
  ];

  // If direct reply is enabled, use the new format without links
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

  // Original format with link
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

    // Usar horário do Brasil (Bahia, UTC-3) para todos os cálculos
    const now = getBrazilTime();
    const nowUTC = new Date();
    console.log(`[UTC: ${nowUTC.toISOString()}] [Brasil/Bahia: ${formatDateBrazil(now)}] Starting automatic reminder check`);

    // Get clinics with reminders enabled
    const { data: clinics, error: clinicsError } = await supabase
      .from('clinics')
      .select('id, name, slug, reminder_enabled, reminder_hours, logo_url, whatsapp_header_image_url')
      .eq('reminder_enabled', true);

    if (clinicsError) {
      console.error('Error fetching clinics:', clinicsError);
      throw clinicsError;
    }

    console.log(`Found ${clinics?.length || 0} clinics with reminders enabled`);

    let sentCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    let limitReachedCount = 0;

    const baseUrl = Deno.env.get('APP_BASE_URL') || 'https://eclini.lovable.app';
    const monthYear = new Date().toISOString().slice(0, 7);

    for (const clinic of (clinics || []) as ClinicWithReminder[]) {
      const reminderHours = clinic.reminder_hours || 24;
      
      // Check message limit for this clinic BEFORE processing
      const { data: usageData, error: usageError } = await supabase.rpc('get_clinic_message_usage', {
        _clinic_id: clinic.id,
        _month_year: monthYear
      });

      if (usageError) {
        console.error(`[Clinic ${clinic.name}] Error checking message usage:`, usageError);
        continue;
      }

      const usage = usageData && usageData.length > 0 ? usageData[0] : null;
      
      if (usage && usage.max_allowed > 0 && usage.remaining <= 0) {
        console.log(`[Clinic ${clinic.name}] Message limit reached (${usage.used}/${usage.max_allowed}), skipping reminders`);
        limitReachedCount++;
        continue;
      }

      console.log(`[Clinic ${clinic.name}] Message usage: ${usage?.used || 0}/${usage?.max_allowed || 'unlimited'} (remaining: ${usage?.remaining || 'unlimited'})`);
      
      // Calculate the reminder window for this clinic
      // Include all appointments from now until reminder_hours ahead that haven't been reminded yet
      const todayStr = now.toISOString().split('T')[0];
      const currentTime = now.toTimeString().substring(0, 5);
      
      // Also check tomorrow for appointments that fall within the reminder window
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];
      
      // Calculate the max time ahead we should look (reminder_hours from now)
      const maxAheadTime = new Date(now.getTime() + reminderHours * 60 * 60 * 1000);
      const maxAheadDate = maxAheadTime.toISOString().split('T')[0];
      const maxAheadTimeStr = maxAheadTime.toTimeString().substring(0, 5);
      
      console.log(`Clinic ${clinic.name}: checking appointments from ${todayStr} ${currentTime} until ${maxAheadDate} ${maxAheadTimeStr} (within ${reminderHours}h) [Horário Brasil/Bahia]`);

      // Fetch clinic's Evolution API config
      const { data: evolutionConfig } = await supabase
        .from('evolution_configs')
        .select('api_url, api_key, instance_name, is_connected, direct_reply_enabled')
        .eq('clinic_id', clinic.id)
        .maybeSingle();

      if (!evolutionConfig || !evolutionConfig.is_connected) {
        console.log(`Clinic ${clinic.name} has no connected WhatsApp, skipping`);
        skippedCount++;
        continue;
      }

      const directReplyEnabled = evolutionConfig.direct_reply_enabled || false;
      console.log(`[Clinic ${clinic.name}] Direct reply enabled: ${directReplyEnabled}`);

      // Get ALL appointments within the reminder window that haven't been reminded yet
      // This includes appointments from now until reminder_hours ahead
      const { data: appointments, error: appointmentsError } = await supabase
        .from('appointments')
        .select(`
          id,
          appointment_date,
          start_time,
          reminder_sent,
          confirmation_token,
          dependent_id,
          patient:patients (
            name,
            phone
          ),
          professional:professionals (
            name
          ),
          dependent:patient_dependents (
            name
          )
        `)
        .eq('clinic_id', clinic.id)
        .gte('appointment_date', todayStr)
        .lte('appointment_date', maxAheadDate)
        .in('status', ['scheduled', 'confirmed'])
        .eq('reminder_sent', false);
      
      // Filter appointments that are actually within the time window
      const filteredAppointments = (appointments || []).filter((apt: any) => {
        const aptDateTime = new Date(`${apt.appointment_date}T${apt.start_time}`);
        // Convert to Brazil time for comparison
        const aptBrazilTime = new Date(aptDateTime.getTime() + 3 * 60 * 60 * 1000); // Add 3 hours to compensate for UTC
        
        // Must be in the future (at least 30 min from now to avoid sending too close to appointment)
        const minTimeAhead = new Date(now.getTime() + 30 * 60 * 1000);
        
        // Must be within reminder_hours from now
        return aptBrazilTime >= minTimeAhead && aptBrazilTime <= maxAheadTime;
      });

      if (appointmentsError) {
        console.error(`Error fetching appointments for clinic ${clinic.id}:`, appointmentsError);
        continue;
      }

      console.log(`Found ${filteredAppointments.length} appointments for clinic ${clinic.name} (${appointments?.length || 0} total, ${(appointments?.length || 0) - filteredAppointments.length} filtered out)`);

      // Track remaining messages for this clinic
      let remainingMessages = usage ? usage.remaining : 999999;

      for (const appointment of filteredAppointments) {
        // Check if we still have messages available
        if (usage && usage.max_allowed > 0 && remainingMessages <= 0) {
          console.log(`[Clinic ${clinic.name}] No more messages available, stopping reminders for this clinic`);
          break;
        }

        const patient = appointment.patient as any;
        const professional = appointment.professional as any;
        const dependent = appointment.dependent as any;
        
        // Para dependentes: nome do dependente; telefone: sempre do titular (paciente)
        const displayName = appointment.dependent_id && dependent?.name ? dependent.name : patient?.name;
        const phoneToUse = patient?.phone;

        if (!phoneToUse) {
          console.log(`No phone for appointment ${appointment.id} (patient: ${patient?.name}, dependent: ${dependent?.name})`);
          continue;
        }

        // Format date for message (pass the date string directly for timezone-safe formatting)
        const dateFormatted = formatDateTime(appointment.appointment_date, appointment.start_time);
        const time = appointment.start_time.substring(0, 5);

        // Build confirmation link (only if not using direct reply)
        const confirmationLink = !directReplyEnabled && appointment.confirmation_token 
          ? `${baseUrl}/consulta/${appointment.confirmation_token}`
          : undefined;

        // Create message - usar displayName (nome do dependente ou titular)
        const message = formatAppointmentReminder(
          displayName,
          clinic.name,
          dateFormatted,
          time,
          professional?.name || 'Profissional',
          confirmationLink,
          directReplyEnabled
        );

        let success = false;
        
        // Usar imagem personalizada da clínica, ou logo da clínica, ou imagem padrão do sistema
        const logoUrl = clinic.whatsapp_header_image_url || clinic.logo_url || DEFAULT_SYSTEM_LOGO;
        success = await sendWhatsAppWithImage(
          evolutionConfig as EvolutionConfig,
          phoneToUse,
          logoUrl,
          message
        );

        if (success) {
          // Mark as sent
          await supabase
            .from('appointments')
            .update({ reminder_sent: true })
            .eq('id', appointment.id);

          // If direct reply is enabled, register pending confirmation
          if (directReplyEnabled) {
            const formattedPhone = phoneToUse.replace(/\D/g, '');
            const phoneWithCountry = formattedPhone.startsWith('55') ? formattedPhone : '55' + formattedPhone;
            
            // Calculate expiry time (1 hour before appointment)
            const appointmentDateTime = new Date(`${appointment.appointment_date}T${appointment.start_time}`);
            const expiresAt = new Date(appointmentDateTime.getTime() - 60 * 60 * 1000); // 1 hour before

            const { error: pendingError } = await supabase
              .from('pending_confirmations')
              .insert({
                clinic_id: clinic.id,
                appointment_id: appointment.id,
                phone: phoneWithCountry,
                expires_at: expiresAt.toISOString(),
                status: 'pending'
              });

            if (pendingError) {
              console.error(`Error creating pending confirmation for appointment ${appointment.id}:`, pendingError);
            } else {
              console.log(`✓ Pending confirmation registered for ${displayName} (phone: ${phoneWithCountry})`);
            }
          }

          // Log the message
          const formattedPhone = phoneToUse.replace(/\D/g, '');
          const { error: logError } = await supabase
            .from('message_logs')
            .insert({
              clinic_id: clinic.id,
              message_type: directReplyEnabled ? 'reminder_direct_reply' : 'reminder',
              phone: formattedPhone.startsWith('55') ? formattedPhone : '55' + formattedPhone,
              month_year: monthYear
            });

          if (logError) {
            console.error(`Error logging message for clinic ${clinic.id}:`, logError);
          }

          remainingMessages++;
          sentCount++;
          console.log(`✓ Reminder sent to ${displayName} (phone: ${phoneToUse}) for appointment on ${appointment.appointment_date} at ${time}`);
        } else {
          errorCount++;
          console.error(`✗ Failed to send reminder to ${displayName}`);
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
      limitReached: limitReachedCount,
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
