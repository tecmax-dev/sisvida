import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Logo padrão do sistema ProSindWeb para cabeçalho de mensagens WhatsApp
const DEFAULT_SYSTEM_LOGO = 'https://prosindweb.com.br/prosindweb-whatsapp-header.jpg';

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
  reminder_interval: number;
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

// Send text message via Whazing API as fallback when Evolution is down
async function sendWhatsAppViaWhazing(
  phone: string,
  message: string
): Promise<boolean> {
  const whazingUrl = Deno.env.get('WHAZING_API_URL');
  const whazingToken = Deno.env.get('WHAZING_API_TOKEN');

  if (!whazingUrl || !whazingToken) {
    console.log('[whazing-fallback] Whazing not configured, cannot send text');
    return false;
  }

  try {
    let cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone.startsWith('55')) {
      cleanPhone = '55' + cleanPhone;
    }

    const apiOficialUrl = getWhazingSendUrl(whazingUrl);
    console.log(`[whazing-fallback] Sending text message to ${cleanPhone}`);

    const response = await fetch(apiOficialUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${whazingToken}`,
      },
      body: JSON.stringify(buildWhazingTextPayload(whazingUrl, cleanPhone, message)),
    });

    const responseText = await response.text();
    if (!response.ok) {
      console.error('[whazing-fallback] Error:', response.status, responseText);
      return false;
    }
    console.log('[whazing-fallback] Text sent successfully:', responseText.substring(0, 200));
    return true;
  } catch (error) {
    console.error('[whazing-fallback] Exception:', error);
    return false;
  }
}

// Send interactive buttons via Whazing API (WhatsApp Business)
async function sendConfirmationButtons(
  phone: string,
  appointmentId: string
): Promise<boolean> {
  const whazingUrl = Deno.env.get('WHAZING_API_URL');
  const whazingToken = Deno.env.get('WHAZING_API_TOKEN');

  if (!whazingUrl || !whazingToken) {
    console.log('[reminder-buttons] Whazing not configured, skipping buttons');
    return false;
  }

  try {
    let cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone.startsWith('55')) {
      cleanPhone = '55' + cleanPhone;
    }

    const buttons = [
      { id: `confirm_apt_${appointmentId}`, title: "Confirmar" },
      { id: `cancel_apt_${appointmentId}`, title: "Cancelar" },
    ];

    // Vary the prompt text to avoid identical messages (anti-ban)
    const buttonPrompts = [
      "Confirme ou cancele sua consulta:",
      "Por favor, confirme ou cancele:",
      "Toque abaixo para confirmar ou cancelar:",
      "Você poderá confirmar ou cancelar abaixo:",
      "Selecione uma opção abaixo:",
      "Confirme sua presença ou cancele:",
      "Escolha uma das opções:",
      "Use os botões abaixo para responder:",
      "Para responder, toque em uma opção:",
      "Confirme já sua consulta:",
    ];
    const buttonPromptText = buttonPrompts[Math.floor(Math.random() * buttonPrompts.length)];

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${whazingToken}`,
    };

    const apiOficialUrl = getWhazingApiPlusUrl(whazingUrl);
    console.log(`[reminder-buttons] Sending confirm/cancel buttons to ${cleanPhone} via API PLUS/native buttons`);

    let response = await fetch(apiOficialUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(buildWhazingButtonPayload(whazingUrl, cleanPhone, buttonPromptText, buttons)),
    });

    let responseText = await response.text();
    if (!response.ok && isChatgooExternalUrl(whazingUrl)) {
      console.warn(`[reminder-buttons] API PLUS failed (${response.status}); retrying external button endpoint: ${responseText.substring(0, 300)}`);
      response = await fetch(getWhazingSendUrl(whazingUrl), {
        method: 'POST',
        headers,
        body: JSON.stringify(buildWhazingExternalButtonPayload(cleanPhone, buttonPromptText, buttons)),
      });
      responseText = await response.text();
    }

    if (!response.ok) {
      console.error('[reminder-buttons] Error:', responseText);
      return false;
    }
    console.log('[reminder-buttons] Buttons sent successfully:', responseText.substring(0, 200));
    return true;
  } catch (error) {
    console.error('[reminder-buttons] Exception:', error);
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

// Profissionais com local de atendimento específico (Sede do Sindicato dos Rodoviários)
const PROFESSIONALS_RODOVIARIOS_LOCATION = ['marcelo aguiar', 'jorge avelar', 'pedro roberto'];
const RODOVIARIOS_CLINIC_NAME = 'Sindicato dos Rodoviários';

function getRodoviariosTemplateLocation(): string {
  return 'Av. Antonio Carlos Magalhães, 1062, Bairro Malhado — Sede do Sindicato dos Rodoviários, ao lado da Igreja Testemunhas de Jeová';
}

function isRodoviariosProfessional(professionalName: string): boolean {
  const lowerName = professionalName.toLowerCase();
  return PROFESSIONALS_RODOVIARIOS_LOCATION.some(name => lowerName.includes(name));
}

function getProfessionalLocation(professionalName: string): string | null {
  if (isRodoviariosProfessional(professionalName)) {
    return `*Local:* ${getRodoviariosTemplateLocation()}`;
  }
  return null;
}

// Arrays de variação para gerar mensagens únicas e evitar bloqueio do WhatsApp
const GREETINGS = [
  'Olá', 'Oi', 'Bom dia', 'Boa tarde', 'Hey', 'Prezado(a)',
  'Saudações', 'Tudo bem', 'Tudo certo', 'E aí',
];

const REMINDER_INTROS = [
  'Lembramos que você tem uma consulta agendada:',
  'Passando para lembrar da sua consulta:',
  'Não se esqueça, você tem uma consulta marcada:',
  'Sua consulta está chegando! Confira os detalhes:',
  'Relembrando sobre o seu agendamento:',
  'Confirmamos seu agendamento para:',
  'Aqui vai o lembrete da sua consulta:',
  'Estamos te esperando! Detalhes do agendamento:',
  'Segue o lembrete do seu horário agendado:',
  'Um lembrete importante sobre sua consulta:',
];

const ARRIVAL_INSTRUCTIONS = [
  '*Compareça com 15 minutos de antecedência.*',
  '*Chegue 15 minutos antes do horário marcado.*',
  '*Pedimos que chegue com 15 min de antecedência.*',
  '*Por favor, apresente-se 15 minutos antes.*',
  '*Recomendamos chegar 15 min antes do horário.*',
];

const NO_SHOW_WARNINGS = [
  [
    `*Atenção, Associado(a):*`,
    `Ao confirmar sua presença, você se compromete a comparecer. Caso não possa comparecer, por gentileza *cancele com antecedência* para que outro associado da fila de espera possa ser atendido.`,
    ``,
    `Lembramos que a *falta sem cancelamento prévio* poderá resultar em *bloqueio temporário* para novos agendamentos com este profissional.`,
  ],
  [
    `*Importante:*`,
    `Se não puder comparecer, por favor *avise com antecedência*. Sua vaga será oferecida a outro associado na fila de espera.`,
    ``,
    `A *ausência sem aviso prévio* pode acarretar *restrição temporária* de novos agendamentos.`,
  ],
  [
    `*Lembrete:*`,
    `Caso surja algum imprevisto, *cancele antes do horário* para liberar a vaga a outros associados que aguardam na fila.`,
    ``,
    `*Faltas sem justificativa* poderão gerar *suspensão temporária* de agendamentos com este profissional.`,
  ],
  [
    `*Atenção:*`,
    `Pedimos que, em caso de impossibilidade, *comunique o cancelamento com antecedência*. Outros associados na lista de espera poderão ser beneficiados.`,
    ``,
    `A *não comunicação de ausência* pode resultar em *bloqueio temporário* para futuros agendamentos.`,
  ],
];

const CLOSINGS = [
  ['Atenciosamente,', 'Equipe {clinic}'],
  ['Com carinho,', 'Equipe {clinic}'],
  ['Um abraço,', 'Equipe {clinic}'],
  ['Conte conosco!', '{clinic}'],
  ['Estamos te esperando!', 'Equipe {clinic}'],
  ['Até lá!', 'Equipe {clinic}'],
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function formatAppointmentReminder(
  patientName: string,
  clinicName: string,
  date: string,
  time: string,
  professionalName: string,
): string {
  const firstName = patientName.split(' ')[0];
  // RC1 — Política informativa: WhatsApp é canal informativo.
  // Toda ação (alterar/cancelar) ocorre exclusivamente no aplicativo oficial.
  const lines = [
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
  ];
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

    // Get clinics with reminders enabled (including union entity logo for priority)
     const { data: clinics, error: clinicsError } = await supabase
       .from('clinics')
       .select(`
         id, name, slug, reminder_enabled, reminder_hours, reminder_interval, logo_url, whatsapp_header_image_url,
         whatsapp_provider,
         union_entities!union_entities_clinic_id_fkey(logo_url)
       `)
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

    const baseUrl = Deno.env.get('APP_BASE_URL') || 'https://prosindweb.com.br';
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

      const whatsappProvider = clinic.whatsapp_provider || 'evolution';
      const isMetaProvider = whatsappProvider === 'zapresponder' || whatsappProvider === 'meta_official';

      let evolutionConfig = null;
      let directReplyEnabled = false;

      if (isMetaProvider) {
        // For Sindicato/Meta Official, we don't strictly need to check zapster_configs here
        // as the sending function handles the direct routing.
        directReplyEnabled = true; 
      } else {
        const { data: evoConfig } = await supabase
          .from('evolution_configs')
          .select('api_url, api_key, instance_name, is_connected, direct_reply_enabled')
          .eq('clinic_id', clinic.id)
          .maybeSingle();

        if (!evoConfig || !evoConfig.is_connected) {
          console.log(`Clinic ${clinic.name} has no connected Evolution WhatsApp, skipping`);
          skippedCount++;
          continue;
        }
        evolutionConfig = evoConfig;
        directReplyEnabled = evoConfig.direct_reply_enabled || false;
      }
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
            name,
            specialty
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

        // Create message - usar displayName (nome do dependente ou titular)
        const profName = professional?.name || 'Profissional';
        const effectiveClinicName = isRodoviariosProfessional(profName) ? RODOVIARIOS_CLINIC_NAME : clinic.name;
        const effectiveTemplateLocation = isRodoviariosProfessional(profName) ? getRodoviariosTemplateLocation() : clinic.name;
        const message = formatAppointmentReminder(
          displayName,
          effectiveClinicName,
          dateFormatted,
          time,
          profName
        );

        // Determine template variables if using Meta
        const specialty = professional?.specialty || 'Consulta Médica';
        const templateComponents = [
          displayName,        // {{1}} Nome
          profName,           // {{2}} Profissional
          specialty,          // {{3}} Especialidade
          dateFormatted,      // {{4}} Data
          time,               // {{5}} Hora
          effectiveTemplateLocation // {{6}} Local/endereço exibido no template oficial
        ];

       let success = false;
       const isMetaProvider = (clinic.whatsapp_provider === 'zapresponder' || clinic.whatsapp_provider === 'meta_official');

       if (isMetaProvider) {
         console.log(`[${clinic.name}] Sending reminder via Meta (send-whatsapp) to ${phoneToUse}`);
         try {
           const metaResp = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-whatsapp`, {
             method: 'POST',
             headers: {
               'Content-Type': 'application/json',
               'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
             },
             body: JSON.stringify({
               phone: phoneToUse,
               message: message,
               clinicId: clinic.id,
               type: 'reminder',
               appointmentId: appointment.id,
               templateName: 'lembrete_consulta_v2',
               templateComponents: templateComponents
             }),
           });
           const metaData = await metaResp.json();
           success = metaResp.ok && metaData.success;
         } catch (err) {
           console.error(`[${clinic.name}] Error sending via Meta:`, err);
           success = false;
         }
       } else {
         // Appointment reminders are text-only to reduce WhatsApp ban risk.
         success = await sendWhatsAppViaEvolution(
           evolutionConfig as EvolutionConfig,
           phoneToUse,
           message
         );
       }

        // Fallback: if Evolution fails, send text via Whazing
        if (!success) {
          console.log(`[${clinic.name}] Evolution failed for ${displayName}, trying Whazing text fallback...`);
          success = await sendWhatsAppViaWhazing(phoneToUse, message);
        }

        if (success) {
          // Mark as sent
          await supabase
            .from('appointments')
            .update({ reminder_sent: true })
            .eq('id', appointment.id);

          sentCount++;
          console.log(`Reminder sent to ${displayName} (phone: ${phoneToUse}) for appointment on ${appointment.appointment_date} at ${time}`);
        } else {
          errorCount++;
          console.error(`Failed to send reminder to ${displayName} via both Evolution and Whazing`);
        }

        // Always try to send interactive buttons via Whazing (even if main message used fallback)
        // Small delay before sending buttons to ensure message arrives first
        if (success) {
          await new Promise(resolve => setTimeout(resolve, 1500));
          const buttonsSent = await sendConfirmationButtons(phoneToUse, appointment.id);
          if (buttonsSent) {
            console.log(`Confirmation buttons sent to ${displayName}`);
          } else {
            console.log(`Could not send buttons to ${displayName} (Whazing not configured or error)`);
          }
        }

        // If direct reply is enabled, register pending confirmation
        if (success && directReplyEnabled) {
          const formattedPhone = phoneToUse.replace(/\D/g, '');
          const phoneWithCountry = formattedPhone.startsWith('55') ? formattedPhone : '55' + formattedPhone;
          
          const appointmentDateTime = new Date(`${appointment.appointment_date}T${appointment.start_time}`);
          const expiresAt = new Date(appointmentDateTime.getTime() - 60 * 60 * 1000);

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
            console.log(`Pending confirmation registered for ${displayName} (phone: ${phoneWithCountry})`);
          }
        }

        // Log the message
        if (success) {
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

        }

        // Use the clinic-specific interval (default 60s if not set)
        const intervalSeconds = clinic.reminder_interval || 60;
        console.log(`[Clinic ${clinic.name}] Waiting ${intervalSeconds}s before next reminder...`);
        await new Promise(resolve => setTimeout(resolve, intervalSeconds * 1000));
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
