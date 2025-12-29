import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ==========================================
// REGEX PATTERNS
// ==========================================

const POSITIVE_REGEX = /^(sim|s|confirmo|ok|👍|confirmado|confirmar|vou|yes|y|simmm|siim|sím)$/i;
const NEGATIVE_REGEX = /^(não|nao|n|cancelo|cancelar|❌|desisto|nao vou|não vou|no|cancel|cancelado)$/i;
const CPF_REGEX = /^\d{11}$/;
const MENU_REGEX = /^(menu|reiniciar|voltar|inicio|começar|comecar|agendar)$/i;
const CANCEL_REGEX = /^(cancelar consulta|cancelar agendamento|desmarcar|desmarcar consulta)$/i;
const RESCHEDULE_REGEX = /^(reagendar|remarcar|mudar data|trocar horario|trocar horário)$/i;
const MY_APPOINTMENTS_REGEX = /^(minhas consultas|meus agendamentos|consultas|agendamentos)$/i;

// ==========================================
// BOOKING STATES
// ==========================================
type BookingState = 
  | 'INIT'
  | 'WAITING_CPF'
  | 'CONFIRM_IDENTITY'
  | 'MAIN_MENU'
  | 'SELECT_PROFESSIONAL'
  | 'SELECT_DATE'
  | 'SELECT_TIME'
  | 'CONFIRM_APPOINTMENT'
  | 'LIST_APPOINTMENTS'
  | 'CONFIRM_CANCEL'
  | 'RESCHEDULE_SELECT_DATE'
  | 'RESCHEDULE_SELECT_TIME'
  | 'CONFIRM_RESCHEDULE'
  | 'FINISHED'
  | 'EXPIRED';

// ==========================================
// INTERFACES
// ==========================================

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

interface BookingSession {
  id: string;
  clinic_id: string;
  phone: string;
  state: BookingState;
  patient_id: string | null;
  patient_name: string | null;
  selected_professional_id: string | null;
  selected_professional_name: string | null;
  selected_date: string | null;
  selected_time: string | null;
  selected_procedure_id: string | null;
  available_professionals: Array<{ id: string; name: string; specialty: string }> | null;
  available_dates: Array<{ date: string; formatted: string; weekday: string }> | null;
  available_times: Array<{ time: string; formatted: string }> | null;
  // For cancel/reschedule flows
  pending_appointments: Array<{ id: string; date: string; time: string; professional: string }> | null;
  selected_appointment_id: string | null;
  action_type: 'new' | 'cancel' | 'reschedule' | null;
  expires_at: string;
}

interface EvolutionConfig {
  api_url: string;
  api_key: string;
  instance_name: string;
  clinic_id: string;
  direct_reply_enabled?: boolean;
}

interface PatientRecord {
  id: string;
  name: string;
  cpf?: string;
  phone?: string;
}

interface ProfessionalRecord {
  id: string;
  name: string;
  specialty?: string;
  is_active?: boolean;
  schedule?: Record<string, { enabled: boolean; slots: Array<{ start: string; end: string }> }>;
  appointment_duration?: number;
}

interface AppointmentRecord {
  id: string;
  appointment_date: string;
  start_time: string;
  end_time?: string;
  status: string;
  patient?: { name?: string };
  professional?: { name?: string };
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/@s\.whatsapp\.net$/, '').replace(/\D/g, '');
  if (!cleaned.startsWith('55')) cleaned = '55' + cleaned;
  return cleaned;
}

function getBrazilPhoneVariants(phone55: string): string[] {
  const cleaned = phone55.replace(/\D/g, '');
  if (!cleaned.startsWith('55')) return [cleaned];

  const ddd = cleaned.slice(2, 4);
  const rest = cleaned.slice(4);

  const variants = new Set<string>();
  variants.add(cleaned);

  if (rest.length === 8) {
    variants.add(`55${ddd}9${rest}`);
  }

  if (rest.length === 9 && rest.startsWith('9')) {
    variants.add(`55${ddd}${rest.slice(1)}`);
  }

  return Array.from(variants);
}

function extractMessageText(data: EvolutionWebhookPayload['data']): string | null {
  if (!data) return null;
  const text = data.message?.conversation || 
               data.message?.extendedTextMessage?.text ||
               null;
  return text?.trim() || null;
}

function validateCpf(cpf: string): boolean {
  const cleanCpf = cpf.replace(/\D/g, '');
  if (cleanCpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cleanCpf)) return false;
  
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleanCpf.charAt(i)) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCpf.charAt(9))) return false;
  
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleanCpf.charAt(i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCpf.charAt(10))) return false;
  
  return true;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('pt-BR');
}

function getWeekday(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const weekdays = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  return weekdays[date.getDay()];
}

function formatTime(time: string): string {
  return time.substring(0, 5);
}

// ==========================================
// WHATSAPP MESSAGE SENDER
// ==========================================

async function sendWhatsAppMessage(
  config: EvolutionConfig,
  phone: string,
  message: string
): Promise<boolean> {
  try {
    let formattedPhone = phone.replace(/\D/g, '');
    if (!formattedPhone.startsWith('55')) {
      formattedPhone = '55' + formattedPhone;
    }

    // Evolution expects WhatsApp JID in many setups
    const destination = formattedPhone.includes('@')
      ? formattedPhone
      : `${formattedPhone}@s.whatsapp.net`;

    console.log(`[booking] Sending message to ${destination}`);

    const response = await fetch(`${config.api_url}/message/sendText/${config.instance_name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: config.api_key,
      },
      body: JSON.stringify({
        number: destination,
        text: message,
      }),
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error('[booking] WhatsApp API error:', responseText);
      return false;
    }

    console.log(`[booking] WhatsApp API ok (${response.status}):`, responseText);
    return true;
  } catch (error) {
    console.error('[booking] Error sending WhatsApp:', error);
    return false;
  }
}

// ==========================================
// BOOKING FLOW MESSAGES
// ==========================================

const MESSAGES = {
  welcome: `Olá! 👋
Para agendar sua consulta, por favor informe seu *CPF* (somente números).

_Digite MENU a qualquer momento para reiniciar._`,

  cpfInvalid: `❌ CPF inválido. Por favor, informe apenas os *11 números* do seu CPF.`,

  patientNotFound: `❌ Não localizamos seu cadastro em nosso sistema.

Para agendar, acesse nosso site ou entre em contato conosco.`,

  confirmIdentity: (name: string) => `Encontramos o cadastro em nome de *${name}*.

Confirma que é você?
Responda *SIM* para continuar ou *NÃO* para encerrar.`,

  identityDenied: `Tudo bem! Por questões de segurança, encerramos por aqui.

Se precisar de ajuda, entre em contato conosco.`,

  // Main menu after identity confirmed
  mainMenu: `O que você deseja fazer?

1️⃣ *Agendar* nova consulta
2️⃣ *Cancelar* consulta existente
3️⃣ *Reagendar* consulta

_Digite o número da opção desejada._`,

  selectProfessional: (professionals: Array<{ name: string; specialty: string }>) => {
    let msg = `Perfeito! 😊
Escolha o profissional desejado digitando o *número*:\n\n`;
    professionals.forEach((p, i) => {
      msg += `${i + 1}️⃣ Dr(a). ${p.name} – ${p.specialty || 'Clínica Geral'}\n`;
    });
    return msg.trim();
  },

  noProfessionals: `😔 No momento não temos profissionais disponíveis para agendamento.

Por favor, tente novamente mais tarde ou entre em contato conosco.`,

  professionalSelected: (name: string) => `Você escolheu *Dr(a). ${name}*.

Agora vamos escolher a data disponível.`,

  selectDate: (dates: Array<{ formatted: string; weekday: string }>) => {
    let msg = `📅 Escolha a data desejada:\n\n`;
    dates.forEach((d, i) => {
      msg += `${i + 1}️⃣ ${d.formatted} (${d.weekday})\n`;
    });
    return msg.trim();
  },

  noDates: `😔 Não há datas disponíveis para este profissional nos próximos dias.

Digite *MENU* para escolher outro profissional.`,

  selectTime: (times: Array<{ formatted: string }>) => {
    let msg = `⏰ Escolha o horário disponível:\n\n`;
    times.forEach((t, i) => {
      msg += `${i + 1}️⃣ ${t.formatted}\n`;
    });
    return msg.trim();
  },

  noTimes: `😔 Não há horários disponíveis nesta data.

Digite *MENU* para escolher outra data.`,

  confirmAppointment: (data: {
    patientName: string;
    professionalName: string;
    date: string;
    time: string;
  }) => `Confirme seu agendamento:

👤 Paciente: *${data.patientName}*
👨‍⚕️ Profissional: *Dr(a). ${data.professionalName}*
📅 Data: *${data.date}*
⏰ Horário: *${data.time}*

Digite *CONFIRMAR* para finalizar ou *CANCELAR* para encerrar.`,

  appointmentConfirmed: (data: {
    date: string;
    time: string;
    professionalName: string;
    clinicName: string;
  }) => `✅ *Agendamento confirmado com sucesso!*

📅 ${data.date} às ${data.time}
👨‍⚕️ Dr(a). ${data.professionalName}

Qualquer dúvida, estamos à disposição! 😊

${data.clinicName}`,

  appointmentCancelled: `❌ Agendamento cancelado.

Se desejar agendar novamente, digite *MENU*.`,

  // List appointments for cancel/reschedule
  listAppointments: (appointments: Array<{ date: string; time: string; professional: string }>) => {
    if (appointments.length === 0) {
      return `📋 Você não possui consultas agendadas.

Digite *MENU* para fazer um novo agendamento.`;
    }
    let msg = `📋 Suas próximas consultas:\n\n`;
    appointments.forEach((a, i) => {
      msg += `${i + 1}️⃣ *${a.date}* às *${a.time}*\n   👨‍⚕️ Dr(a). ${a.professional}\n\n`;
    });
    msg += `\nDigite o *número* da consulta que deseja selecionar ou *MENU* para voltar.`;
    return msg.trim();
  },

  noAppointments: `📋 Você não possui consultas agendadas para cancelar ou reagendar.

Digite *MENU* para fazer um novo agendamento.`,

  confirmCancel: (data: { date: string; time: string; professional: string }) => 
    `⚠️ Tem certeza que deseja *CANCELAR* esta consulta?

📅 Data: *${data.date}*
⏰ Horário: *${data.time}*
👨‍⚕️ Dr(a). ${data.professional}

Digite *SIM* para confirmar o cancelamento ou *NÃO* para voltar.`,

  cancelSuccess: `✅ Consulta cancelada com sucesso!

Se precisar reagendar, digite *MENU*.`,

  confirmReschedule: (data: {
    oldDate: string;
    oldTime: string;
    newDate: string;
    newTime: string;
    professional: string;
  }) => `📋 Confirme o reagendamento:

*De:* ${data.oldDate} às ${data.oldTime}
*Para:* ${data.newDate} às ${data.newTime}
👨‍⚕️ Dr(a). ${data.professional}

Digite *CONFIRMAR* para finalizar ou *CANCELAR* para desistir.`,

  rescheduleSuccess: (data: { date: string; time: string; professional: string }) => 
    `✅ *Consulta reagendada com sucesso!*

📅 Nova data: *${data.date}* às *${data.time}*
👨‍⚕️ Dr(a). ${data.professional}

Qualquer dúvida, estamos à disposição! 😊`,

  invalidOption: `❌ Opção inválida. Por favor, digite apenas o *número* da opção desejada.`,

  sessionExpired: `⏰ *Sessão expirada*

Você ficou mais de 60 segundos sem interagir.
Por segurança, iniciamos uma nova sessão.

Para continuar, *informe seu CPF* (apenas números):`,

  error: `😔 Ocorreu um erro inesperado. Por favor, tente novamente.

Digite *MENU* para reiniciar.`,

  slotTaken: `😔 Ops! Este horário acabou de ser reservado por outro paciente.

Por favor, escolha outro horário.`,

  // Hints/Tips for each state
  hintCpf: `\n\n💡 _Dica: Digite apenas os 11 números do CPF, sem pontos ou traços._`,
  
  hintSelectOption: `\n\n💡 _Dica: Responda apenas com o número da opção (ex: 1, 2, 3...)_`,
  
  hintConfirm: `\n\n💡 _Dica: Digite CONFIRMAR para prosseguir ou CANCELAR para desistir._`,
  
  hintYesNo: `\n\n💡 _Dica: Responda SIM ou NÃO._`,
  
  hintMenu: `\n\n💡 _Digite MENU a qualquer momento para recomeçar._`,

  timeoutWarning: `⏳ _Lembre-se: você tem 60 segundos para responder antes da sessão expirar._`,
};

// ==========================================
// SUPABASE HELPER TYPE
// ==========================================
// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

// ==========================================
// BOOKING STATE MACHINE
// ==========================================

async function handleBookingFlow(
  supabase: SupabaseClient,
  config: EvolutionConfig,
  phone: string,
  messageText: string,
  session: BookingSession | null,
  wasExpired: boolean = false
): Promise<{ handled: boolean; newState?: BookingState }> {
  
  // Check for global commands
  if (MENU_REGEX.test(messageText)) {
    await resetSession(supabase, config.clinic_id, phone);
    await sendWhatsAppMessage(config, phone, MESSAGES.welcome + MESSAGES.hintCpf);
    return { handled: true, newState: 'WAITING_CPF' };
  }

  // If session was expired, send expiration message
  if (wasExpired) {
    await sendWhatsAppMessage(config, phone, MESSAGES.sessionExpired);
    return { handled: true, newState: 'WAITING_CPF' };
  }

  // If no session, start new one
  if (!session) {
    await createOrResetSession(supabase, config.clinic_id, phone, 'WAITING_CPF');
    await sendWhatsAppMessage(config, phone, MESSAGES.welcome + MESSAGES.hintCpf);
    return { handled: true, newState: 'WAITING_CPF' };
  }

  // Handle based on current state
  switch (session.state) {
    case 'INIT':
      // First message after session created - send welcome and wait for CPF
      await updateSession(supabase, session.id, { state: 'WAITING_CPF' });
      await sendWhatsAppMessage(config, phone, MESSAGES.welcome);
      return { handled: true, newState: 'WAITING_CPF' };
    
    case 'WAITING_CPF':
      return await handleWaitingCpf(supabase, config, phone, messageText, session);
    
    case 'CONFIRM_IDENTITY':
      return await handleConfirmIdentity(supabase, config, phone, messageText, session);

    case 'MAIN_MENU':
      return await handleMainMenu(supabase, config, phone, messageText, session);
    
    case 'SELECT_PROFESSIONAL':
      return await handleSelectProfessional(supabase, config, phone, messageText, session);
    
    case 'SELECT_DATE':
      return await handleSelectDate(supabase, config, phone, messageText, session);
    
    case 'SELECT_TIME':
      return await handleSelectTime(supabase, config, phone, messageText, session);
    
    case 'CONFIRM_APPOINTMENT':
      return await handleConfirmAppointment(supabase, config, phone, messageText, session);

    case 'LIST_APPOINTMENTS':
      return await handleListAppointments(supabase, config, phone, messageText, session);

    case 'CONFIRM_CANCEL':
      return await handleConfirmCancel(supabase, config, phone, messageText, session);

    case 'RESCHEDULE_SELECT_DATE':
      return await handleRescheduleSelectDate(supabase, config, phone, messageText, session);

    case 'RESCHEDULE_SELECT_TIME':
      return await handleRescheduleSelectTime(supabase, config, phone, messageText, session);

    case 'CONFIRM_RESCHEDULE':
      return await handleConfirmReschedule(supabase, config, phone, messageText, session);
    
    case 'FINISHED':
      await createOrResetSession(supabase, config.clinic_id, phone, 'WAITING_CPF');
      await sendWhatsAppMessage(config, phone, MESSAGES.welcome);
      return { handled: true, newState: 'WAITING_CPF' };
    
    default:
      console.log(`[booking] Unknown state: ${session.state}, resetting to WAITING_CPF`);
      await updateSession(supabase, session.id, { state: 'WAITING_CPF' });
      await sendWhatsAppMessage(config, phone, MESSAGES.welcome);
      return { handled: true, newState: 'WAITING_CPF' };
  }
}

// ==========================================
// STATE HANDLERS
// ==========================================

async function handleWaitingCpf(
  supabase: SupabaseClient,
  config: EvolutionConfig,
  phone: string,
  messageText: string,
  session: BookingSession
): Promise<{ handled: boolean; newState?: BookingState }> {
  const cleanCpf = messageText.replace(/\D/g, '');
  
  if (!CPF_REGEX.test(cleanCpf) || !validateCpf(cleanCpf)) {
    await sendWhatsAppMessage(config, phone, MESSAGES.cpfInvalid + MESSAGES.hintCpf);
    return { handled: true, newState: 'WAITING_CPF' };
  }

  const phoneCandidates = getBrazilPhoneVariants(phone);
  
  const { data: patient, error } = await supabase
    .from('patients')
    .select('id, name, cpf')
    .eq('clinic_id', config.clinic_id)
    .eq('cpf', cleanCpf)
    .maybeSingle();

  if (error) {
    console.error('[booking] Error searching patient:', error);
    await sendWhatsAppMessage(config, phone, MESSAGES.error);
    return { handled: true, newState: 'WAITING_CPF' };
  }

  const patientData = patient as PatientRecord | null;

  if (!patientData) {
    const { data: patientByPhone } = await supabase
      .from('patients')
      .select('id, name, cpf')
      .eq('clinic_id', config.clinic_id)
      .in('phone', phoneCandidates)
      .maybeSingle();

    const patientByPhoneData = patientByPhone as PatientRecord | null;

    if (!patientByPhoneData) {
      await sendWhatsAppMessage(config, phone, MESSAGES.patientNotFound);
      return { handled: true, newState: 'WAITING_CPF' };
    }

    await updateSession(supabase, session.id, {
      state: 'CONFIRM_IDENTITY',
      patient_id: patientByPhoneData.id,
      patient_name: patientByPhoneData.name,
    });

    await sendWhatsAppMessage(config, phone, MESSAGES.confirmIdentity(patientByPhoneData.name) + MESSAGES.hintYesNo);
    return { handled: true, newState: 'CONFIRM_IDENTITY' };
  }

  await updateSession(supabase, session.id, {
    state: 'CONFIRM_IDENTITY',
    patient_id: patientData.id,
    patient_name: patientData.name,
  });

  await sendWhatsAppMessage(config, phone, MESSAGES.confirmIdentity(patientData.name) + MESSAGES.hintYesNo);
  return { handled: true, newState: 'CONFIRM_IDENTITY' };
}

async function handleConfirmIdentity(
  supabase: SupabaseClient,
  config: EvolutionConfig,
  phone: string,
  messageText: string,
  session: BookingSession
): Promise<{ handled: boolean; newState?: BookingState }> {
  if (POSITIVE_REGEX.test(messageText)) {
    // Go to main menu instead of directly to professional selection
    await updateSession(supabase, session.id, { state: 'MAIN_MENU' });
    await sendWhatsAppMessage(config, phone, MESSAGES.mainMenu + MESSAGES.hintSelectOption);
    return { handled: true, newState: 'MAIN_MENU' };
  }

  if (NEGATIVE_REGEX.test(messageText)) {
    await updateSession(supabase, session.id, { state: 'FINISHED' });
    await sendWhatsAppMessage(config, phone, MESSAGES.identityDenied);
    return { handled: true, newState: 'FINISHED' };
  }

  await sendWhatsAppMessage(config, phone, `Por favor, responda *SIM* ou *NÃO*.` + MESSAGES.hintYesNo);
  return { handled: true, newState: 'CONFIRM_IDENTITY' };
}

// ==========================================
// MAIN MENU HANDLER
// ==========================================

async function handleMainMenu(
  supabase: SupabaseClient,
  config: EvolutionConfig,
  phone: string,
  messageText: string,
  session: BookingSession
): Promise<{ handled: boolean; newState?: BookingState }> {
  const choice = messageText.trim();

  // Option 1: New appointment
  if (choice === '1') {
    const { data: professionals, error } = await supabase
      .from('professionals')
      .select('id, name, specialty, is_active')
      .eq('clinic_id', config.clinic_id)
      .eq('is_active', true)
      .order('name');

    if (error || !professionals || professionals.length === 0) {
      await sendWhatsAppMessage(config, phone, MESSAGES.noProfessionals);
      return { handled: true, newState: 'MAIN_MENU' };
    }

    const profList = (professionals as ProfessionalRecord[]).map(p => ({
      id: p.id,
      name: p.name,
      specialty: p.specialty || 'Clínica Geral',
    }));

    await updateSession(supabase, session.id, {
      state: 'SELECT_PROFESSIONAL',
      available_professionals: profList,
      action_type: 'new',
    });

    await sendWhatsAppMessage(config, phone, MESSAGES.selectProfessional(profList) + MESSAGES.hintSelectOption + MESSAGES.hintMenu);
    return { handled: true, newState: 'SELECT_PROFESSIONAL' };
  }

  // Option 2: Cancel appointment
  if (choice === '2') {
    const appointments = await getPatientAppointments(supabase, config.clinic_id, session.patient_id!);
    
    if (appointments.length === 0) {
      await sendWhatsAppMessage(config, phone, MESSAGES.noAppointments);
      return { handled: true, newState: 'MAIN_MENU' };
    }

    await updateSession(supabase, session.id, {
      state: 'LIST_APPOINTMENTS',
      pending_appointments: appointments,
      action_type: 'cancel',
    });

    await sendWhatsAppMessage(config, phone, MESSAGES.listAppointments(appointments) + MESSAGES.hintSelectOption);
    return { handled: true, newState: 'LIST_APPOINTMENTS' };
  }

  // Option 3: Reschedule appointment
  if (choice === '3') {
    const appointments = await getPatientAppointments(supabase, config.clinic_id, session.patient_id!);
    
    if (appointments.length === 0) {
      await sendWhatsAppMessage(config, phone, MESSAGES.noAppointments);
      return { handled: true, newState: 'MAIN_MENU' };
    }

    await updateSession(supabase, session.id, {
      state: 'LIST_APPOINTMENTS',
      pending_appointments: appointments,
      action_type: 'reschedule',
    });

    await sendWhatsAppMessage(config, phone, MESSAGES.listAppointments(appointments) + MESSAGES.hintSelectOption);
    return { handled: true, newState: 'LIST_APPOINTMENTS' };
  }

  await sendWhatsAppMessage(config, phone, MESSAGES.invalidOption + MESSAGES.hintSelectOption);
  return { handled: true, newState: 'MAIN_MENU' };
}

// ==========================================
// LIST APPOINTMENTS HANDLER (for cancel/reschedule)
// ==========================================

async function handleListAppointments(
  supabase: SupabaseClient,
  config: EvolutionConfig,
  phone: string,
  messageText: string,
  session: BookingSession
): Promise<{ handled: boolean; newState?: BookingState }> {
  const choice = parseInt(messageText.trim());
  const appointments = session.pending_appointments || [];

  if (isNaN(choice) || choice < 1 || choice > appointments.length) {
    await sendWhatsAppMessage(config, phone, MESSAGES.invalidOption + MESSAGES.hintSelectOption);
    return { handled: true, newState: 'LIST_APPOINTMENTS' };
  }

  const selected = appointments[choice - 1];

  await updateSession(supabase, session.id, {
    selected_appointment_id: selected.id,
  });

  if (session.action_type === 'cancel') {
    await updateSession(supabase, session.id, { state: 'CONFIRM_CANCEL' });
    await sendWhatsAppMessage(config, phone, MESSAGES.confirmCancel({
      date: selected.date,
      time: selected.time,
      professional: selected.professional,
    }) + MESSAGES.hintYesNo);
    return { handled: true, newState: 'CONFIRM_CANCEL' };
  }

  if (session.action_type === 'reschedule') {
    // Get the professional from the appointment to show available dates
    const { data: appointment } = await supabase
      .from('appointments')
      .select('professional_id')
      .eq('id', selected.id)
      .single();

    if (!appointment) {
      await sendWhatsAppMessage(config, phone, MESSAGES.error);
      return { handled: true, newState: 'MAIN_MENU' };
    }

    const availableDates = await getAvailableDates(supabase, config.clinic_id, appointment.professional_id);

    if (availableDates.length === 0) {
      await sendWhatsAppMessage(config, phone, MESSAGES.noDates);
      return { handled: true, newState: 'LIST_APPOINTMENTS' };
    }

    await updateSession(supabase, session.id, {
      state: 'RESCHEDULE_SELECT_DATE',
      selected_professional_id: appointment.professional_id,
      selected_professional_name: selected.professional,
      available_dates: availableDates,
    });

    await sendWhatsAppMessage(config, phone, `Escolha a nova data para reagendar:`);
    await sendWhatsAppMessage(config, phone, MESSAGES.selectDate(availableDates));
    return { handled: true, newState: 'RESCHEDULE_SELECT_DATE' };
  }

  return { handled: true, newState: 'MAIN_MENU' };
}

// ==========================================
// CONFIRM CANCEL HANDLER
// ==========================================

async function handleConfirmCancel(
  supabase: SupabaseClient,
  config: EvolutionConfig,
  phone: string,
  messageText: string,
  session: BookingSession
): Promise<{ handled: boolean; newState?: BookingState }> {
  if (POSITIVE_REGEX.test(messageText)) {
    // Cancel the appointment
    const { error } = await supabase
      .from('appointments')
      .update({ 
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: 'Cancelado pelo paciente via WhatsApp'
      })
      .eq('id', session.selected_appointment_id);

    if (error) {
      console.error('[booking] Error cancelling appointment:', error);
      await sendWhatsAppMessage(config, phone, MESSAGES.error);
      return { handled: true, newState: 'MAIN_MENU' };
    }

    await updateSession(supabase, session.id, { state: 'FINISHED' });
    await sendWhatsAppMessage(config, phone, MESSAGES.cancelSuccess);
    return { handled: true, newState: 'FINISHED' };
  }

  if (NEGATIVE_REGEX.test(messageText)) {
    await updateSession(supabase, session.id, { state: 'MAIN_MENU' });
    await sendWhatsAppMessage(config, phone, MESSAGES.mainMenu + MESSAGES.hintSelectOption);
    return { handled: true, newState: 'MAIN_MENU' };
  }

  await sendWhatsAppMessage(config, phone, `Por favor, responda *SIM* ou *NÃO*.` + MESSAGES.hintYesNo);
  return { handled: true, newState: 'CONFIRM_CANCEL' };
}

// ==========================================
// RESCHEDULE DATE HANDLER
// ==========================================

async function handleRescheduleSelectDate(
  supabase: SupabaseClient,
  config: EvolutionConfig,
  phone: string,
  messageText: string,
  session: BookingSession
): Promise<{ handled: boolean; newState?: BookingState }> {
  const choice = parseInt(messageText.trim());
  const dates = session.available_dates || [];

  if (isNaN(choice) || choice < 1 || choice > dates.length) {
    await sendWhatsAppMessage(config, phone, MESSAGES.invalidOption + MESSAGES.hintSelectOption);
    return { handled: true, newState: 'RESCHEDULE_SELECT_DATE' };
  }

  const selected = dates[choice - 1];

  const availableTimes = await getAvailableTimes(
    supabase, 
    config.clinic_id, 
    session.selected_professional_id!, 
    selected.date
  );

  if (availableTimes.length === 0) {
    await sendWhatsAppMessage(config, phone, MESSAGES.noTimes);
    return { handled: true, newState: 'RESCHEDULE_SELECT_DATE' };
  }

  await updateSession(supabase, session.id, {
    state: 'RESCHEDULE_SELECT_TIME',
    selected_date: selected.date,
    available_times: availableTimes,
  });

  await sendWhatsAppMessage(config, phone, MESSAGES.selectTime(availableTimes) + MESSAGES.hintSelectOption);
  return { handled: true, newState: 'RESCHEDULE_SELECT_TIME' };
}

// ==========================================
// RESCHEDULE TIME HANDLER
// ==========================================

async function handleRescheduleSelectTime(
  supabase: SupabaseClient,
  config: EvolutionConfig,
  phone: string,
  messageText: string,
  session: BookingSession
): Promise<{ handled: boolean; newState?: BookingState }> {
  const choice = parseInt(messageText.trim());
  const times = session.available_times || [];

  if (isNaN(choice) || choice < 1 || choice > times.length) {
    await sendWhatsAppMessage(config, phone, MESSAGES.invalidOption + MESSAGES.hintSelectOption);
    return { handled: true, newState: 'RESCHEDULE_SELECT_TIME' };
  }

  const selected = times[choice - 1];

  // Check slot availability before proceeding
  const isAvailable = await checkSlotAvailability(
    supabase,
    config.clinic_id,
    session.selected_professional_id!,
    session.selected_date!,
    selected.time
  );

  if (!isAvailable) {
    await sendWhatsAppMessage(config, phone, MESSAGES.slotTaken);
    return { handled: true, newState: 'RESCHEDULE_SELECT_TIME' };
  }

  await updateSession(supabase, session.id, {
    state: 'CONFIRM_RESCHEDULE',
    selected_time: selected.time,
  });

  // Get original appointment info
  const originalAppointment = session.pending_appointments?.find(a => a.id === session.selected_appointment_id);

  await sendWhatsAppMessage(config, phone, MESSAGES.confirmReschedule({
    oldDate: originalAppointment?.date || '',
    oldTime: originalAppointment?.time || '',
    newDate: formatDate(session.selected_date!),
    newTime: formatTime(selected.time),
    professional: session.selected_professional_name || '',
  }) + MESSAGES.hintConfirm);

  return { handled: true, newState: 'CONFIRM_RESCHEDULE' };
}

// ==========================================
// CONFIRM RESCHEDULE HANDLER
// ==========================================

async function handleConfirmReschedule(
  supabase: SupabaseClient,
  config: EvolutionConfig,
  phone: string,
  messageText: string,
  session: BookingSession
): Promise<{ handled: boolean; newState?: BookingState }> {
  if (POSITIVE_REGEX.test(messageText)) {
    // Calculate end time (default 30 min)
    const startTime = session.selected_time!;
    const [hours, minutes] = startTime.split(':').map(Number);
    const endDate = new Date();
    endDate.setHours(hours, minutes + 30, 0, 0);
    const endTime = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;

    // Update the appointment with new date/time
    const { error } = await supabase
      .from('appointments')
      .update({ 
        appointment_date: session.selected_date,
        start_time: startTime,
        end_time: endTime,
        status: 'scheduled', // Reset to scheduled
        confirmed_at: null,
      })
      .eq('id', session.selected_appointment_id);

    if (error) {
      console.error('[booking] Error rescheduling appointment:', error);
      
      // Handle specific errors
      if (error.message?.includes('LIMITE_AGENDAMENTO_CPF')) {
        await sendWhatsAppMessage(config, phone, 
          `❌ Não foi possível reagendar: você já possui o limite de agendamentos com este profissional no mês da nova data.\n\nEscolha uma data em outro mês ou entre em contato com a clínica.`
        );
        return { handled: true, newState: 'MAIN_MENU' };
      }
      
      if (error.message?.includes('FERIADO')) {
        const holidayMatch = error.message.match(/FERIADO: (.+)/);
        const holidayMsg = holidayMatch ? holidayMatch[1] : 'A data selecionada é feriado.';
        await sendWhatsAppMessage(config, phone, `❌ ${holidayMsg}\n\nPor favor, escolha outra data.`);
        return { handled: true, newState: 'RESCHEDULE_SELECT_DATE' };
      }
      
      if (error.message?.includes('HORARIO_INVALIDO')) {
        await sendWhatsAppMessage(config, phone, 
          `❌ O horário selecionado não está mais disponível.\n\nPor favor, escolha outro horário.`
        );
        return { handled: true, newState: 'RESCHEDULE_SELECT_TIME' };
      }

      // Check for expired patient card
      if (error.message?.includes('CARTEIRINHA_VENCIDA')) {
        await sendWhatsAppMessage(config, phone, 
          `❌ Sua carteirinha digital está *vencida*.\n\nPor favor, entre em contato com a clínica para renovar sua carteirinha antes de reagendar.`
        );
        await updateSession(supabase, session.id, { state: 'FINISHED' });
        return { handled: true, newState: 'FINISHED' };
      }
      
      await sendWhatsAppMessage(config, phone, MESSAGES.error);
      return { handled: true, newState: 'MAIN_MENU' };
    }

    await updateSession(supabase, session.id, { state: 'FINISHED' });
    await sendWhatsAppMessage(config, phone, MESSAGES.rescheduleSuccess({
      date: formatDate(session.selected_date!),
      time: formatTime(startTime),
      professional: session.selected_professional_name || '',
    }));
    return { handled: true, newState: 'FINISHED' };
  }

  if (NEGATIVE_REGEX.test(messageText)) {
    await updateSession(supabase, session.id, { state: 'MAIN_MENU' });
    await sendWhatsAppMessage(config, phone, MESSAGES.mainMenu);
    return { handled: true, newState: 'MAIN_MENU' };
  }

  await sendWhatsAppMessage(config, phone, `Por favor, responda *CONFIRMAR* ou *CANCELAR*.`);
  return { handled: true, newState: 'CONFIRM_RESCHEDULE' };
}

// ==========================================
// GET PATIENT APPOINTMENTS
// ==========================================

async function getPatientAppointments(
  supabase: SupabaseClient,
  clinicId: string,
  patientId: string
): Promise<Array<{ id: string; date: string; time: string; professional: string }>> {
  const today = new Date().toISOString().split('T')[0];
  
  const { data, error } = await supabase
    .from('appointments')
    .select(`
      id, 
      appointment_date, 
      start_time,
      professional:professionals (name)
    `)
    .eq('clinic_id', clinicId)
    .eq('patient_id', patientId)
    .in('status', ['scheduled', 'confirmed'])
    .gte('appointment_date', today)
    .order('appointment_date', { ascending: true })
    .order('start_time', { ascending: true })
    .limit(10);

  if (error || !data) {
    console.error('[booking] Error fetching patient appointments:', error);
    return [];
  }

  return data.map((a: { id: string; appointment_date: string; start_time: string; professional: { name: string } | null }) => ({
    id: a.id,
    date: formatDate(a.appointment_date),
    time: formatTime(a.start_time),
    professional: a.professional?.name || 'Não informado',
  }));
}

async function handleSelectProfessional(
  supabase: SupabaseClient,
  config: EvolutionConfig,
  phone: string,
  messageText: string,
  session: BookingSession
): Promise<{ handled: boolean; newState?: BookingState }> {
  const choice = parseInt(messageText.trim());
  const professionals = session.available_professionals || [];

  if (isNaN(choice) || choice < 1 || choice > professionals.length) {
    await sendWhatsAppMessage(config, phone, MESSAGES.invalidOption + MESSAGES.hintSelectOption);
    return { handled: true, newState: 'SELECT_PROFESSIONAL' };
  }

  const selected = professionals[choice - 1];

  // Check CPF appointment limit BEFORE proceeding with date selection
  const limitCheck = await checkCpfAppointmentLimit(
    supabase,
    config.clinic_id,
    session.patient_id!,
    selected.id
  );

  if (limitCheck.limitReached) {
    await sendWhatsAppMessage(config, phone, 
      `❌ Você já atingiu o limite de *${limitCheck.maxAllowed} agendamento(s)* com *${selected.name}* neste mês.\n\nPor favor, escolha outro profissional.`
    );
    return { handled: true, newState: 'SELECT_PROFESSIONAL' };
  }

  const availableDates = await getAvailableDates(supabase, config.clinic_id, selected.id);

  if (availableDates.length === 0) {
    await sendWhatsAppMessage(config, phone, MESSAGES.noDates);
    return { handled: true, newState: 'SELECT_PROFESSIONAL' };
  }

  await updateSession(supabase, session.id, {
    state: 'SELECT_DATE',
    selected_professional_id: selected.id,
    selected_professional_name: selected.name,
    available_dates: availableDates,
  });

  await sendWhatsAppMessage(config, phone, MESSAGES.professionalSelected(selected.name));
  await sendWhatsAppMessage(config, phone, MESSAGES.selectDate(availableDates) + MESSAGES.hintSelectOption + MESSAGES.hintMenu);
  return { handled: true, newState: 'SELECT_DATE' };
}

async function handleSelectDate(
  supabase: SupabaseClient,
  config: EvolutionConfig,
  phone: string,
  messageText: string,
  session: BookingSession
): Promise<{ handled: boolean; newState?: BookingState }> {
  const choice = parseInt(messageText.trim());
  const dates = session.available_dates || [];

  if (isNaN(choice) || choice < 1 || choice > dates.length) {
    await sendWhatsAppMessage(config, phone, MESSAGES.invalidOption + MESSAGES.hintSelectOption);
    return { handled: true, newState: 'SELECT_DATE' };
  }

  const selected = dates[choice - 1];

  const availableTimes = await getAvailableTimes(
    supabase, 
    config.clinic_id, 
    session.selected_professional_id!, 
    selected.date
  );

  if (availableTimes.length === 0) {
    await sendWhatsAppMessage(config, phone, MESSAGES.noTimes);
    return { handled: true, newState: 'SELECT_DATE' };
  }

  await updateSession(supabase, session.id, {
    state: 'SELECT_TIME',
    selected_date: selected.date,
    available_times: availableTimes,
  });

  await sendWhatsAppMessage(config, phone, MESSAGES.selectTime(availableTimes) + MESSAGES.hintSelectOption + MESSAGES.hintMenu);
  return { handled: true, newState: 'SELECT_TIME' };
}

async function handleSelectTime(
  supabase: SupabaseClient,
  config: EvolutionConfig,
  phone: string,
  messageText: string,
  session: BookingSession
): Promise<{ handled: boolean; newState?: BookingState }> {
  const choice = parseInt(messageText.trim());
  const times = session.available_times || [];

  if (isNaN(choice) || choice < 1 || choice > times.length) {
    await sendWhatsAppMessage(config, phone, MESSAGES.invalidOption + MESSAGES.hintSelectOption);
    return { handled: true, newState: 'SELECT_TIME' };
  }

  const selected = times[choice - 1];

  await updateSession(supabase, session.id, {
    state: 'CONFIRM_APPOINTMENT',
    selected_time: selected.time,
  });

  await sendWhatsAppMessage(config, phone, MESSAGES.confirmAppointment({
    patientName: session.patient_name || '',
    professionalName: session.selected_professional_name || '',
    date: formatDate(session.selected_date!),
    time: selected.formatted,
  }) + MESSAGES.hintConfirm);

  return { handled: true, newState: 'CONFIRM_APPOINTMENT' };
}

async function handleConfirmAppointment(
  supabase: SupabaseClient,
  config: EvolutionConfig,
  phone: string,
  messageText: string,
  session: BookingSession
): Promise<{ handled: boolean; newState?: BookingState }> {
  const confirmRegex = /^(confirmar|confirmo|sim|s|ok|👍)$/i;
  const cancelRegex = /^(cancelar|cancelo|não|nao|n|❌)$/i;

  if (cancelRegex.test(messageText)) {
    await updateSession(supabase, session.id, { state: 'FINISHED' });
    await sendWhatsAppMessage(config, phone, MESSAGES.appointmentCancelled);
    return { handled: true, newState: 'FINISHED' };
  }

  if (!confirmRegex.test(messageText)) {
    await sendWhatsAppMessage(config, phone, `Por favor, digite *CONFIRMAR* ou *CANCELAR*.` + MESSAGES.hintConfirm);
    return { handled: true, newState: 'CONFIRM_APPOINTMENT' };
  }

  const slotAvailable = await checkSlotAvailability(
    supabase,
    config.clinic_id,
    session.selected_professional_id!,
    session.selected_date!,
    session.selected_time!
  );

  if (!slotAvailable) {
    const availableTimes = await getAvailableTimes(
      supabase,
      config.clinic_id,
      session.selected_professional_id!,
      session.selected_date!
    );

    if (availableTimes.length === 0) {
      await sendWhatsAppMessage(config, phone, MESSAGES.noTimes);
      await updateSession(supabase, session.id, { state: 'SELECT_DATE' });
      return { handled: true, newState: 'SELECT_DATE' };
    }

    await updateSession(supabase, session.id, {
      state: 'SELECT_TIME',
      available_times: availableTimes,
    });

    await sendWhatsAppMessage(config, phone, MESSAGES.slotTaken);
    await sendWhatsAppMessage(config, phone, MESSAGES.selectTime(availableTimes));
    return { handled: true, newState: 'SELECT_TIME' };
  }

  const { data: professional } = await supabase
    .from('professionals')
    .select('appointment_duration')
    .eq('id', session.selected_professional_id)
    .single();

  const professionalData = professional as { appointment_duration?: number } | null;
  const duration = professionalData?.appointment_duration || 30;

  const [hours, minutes] = session.selected_time!.split(':').map(Number);
  const endMinutes = hours * 60 + minutes + duration;
  const endHours = Math.floor(endMinutes / 60);
  const endMins = endMinutes % 60;
  const endTime = `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;

  const { data: appointment, error: appointmentError } = await supabase
    .from('appointments')
    .insert({
      clinic_id: config.clinic_id,
      patient_id: session.patient_id,
      professional_id: session.selected_professional_id,
      appointment_date: session.selected_date,
      start_time: session.selected_time,
      end_time: endTime,
      duration_minutes: duration,
      status: 'confirmed',
      type: 'first_visit',
      confirmed_at: new Date().toISOString(),
      notes: 'Agendado via WhatsApp',
    })
    .select('id')
    .single();

  if (appointmentError) {
    console.error('[booking] Error creating appointment:', appointmentError);
    
    // Check for CPF restriction limit error
    if (appointmentError.message?.includes('LIMITE_AGENDAMENTO_CPF')) {
      const limitMatch = appointmentError.message.match(/limite de (\d+) agendamento/i);
      const limit = limitMatch ? limitMatch[1] : '1';
      await sendWhatsAppMessage(config, phone, 
        `❌ Você já atingiu o limite de *${limit} agendamento(s)* com este profissional neste mês.\n\nPor favor, escolha outro profissional ou aguarde o próximo mês.`
      );
      await updateSession(supabase, session.id, { state: 'SELECT_PROFESSIONAL' });
      return { handled: true, newState: 'SELECT_PROFESSIONAL' };
    }
    
    // Check for slot conflict
    if (appointmentError.code === '23505' || appointmentError.message?.includes('conflict')) {
      await sendWhatsAppMessage(config, phone, MESSAGES.slotTaken);
      return { handled: true, newState: 'SELECT_TIME' };
    }

    // Check for holiday restriction
    if (appointmentError.message?.includes('FERIADO')) {
      await sendWhatsAppMessage(config, phone, `❌ Não é possível agendar nesta data pois é feriado.\n\nEscolha outra data.`);
      return { handled: true, newState: 'SELECT_DATE' };
    }

    // Check for schedule validation error
    if (appointmentError.message?.includes('HORARIO_INVALIDO')) {
      await sendWhatsAppMessage(config, phone, `❌ Este horário não está disponível.\n\nEscolha outro horário.`);
      return { handled: true, newState: 'SELECT_TIME' };
    }

    // Check for expired patient card
    if (appointmentError.message?.includes('CARTEIRINHA_VENCIDA')) {
      await sendWhatsAppMessage(config, phone, 
        `❌ Sua carteirinha digital está *vencida*.\n\nPor favor, entre em contato com a clínica para renovar sua carteirinha antes de agendar.`
      );
      await updateSession(supabase, session.id, { state: 'FINISHED' });
      return { handled: true, newState: 'FINISHED' };
    }

    await sendWhatsAppMessage(config, phone, MESSAGES.error);
    return { handled: true, newState: 'CONFIRM_APPOINTMENT' };
  }

  const appointmentData = appointment as { id: string };

  const { data: clinic } = await supabase
    .from('clinics')
    .select('name')
    .eq('id', config.clinic_id)
    .single();

  const clinicData = clinic as { name?: string } | null;

  await updateSession(supabase, session.id, { state: 'FINISHED' });

  await sendWhatsAppMessage(config, phone, MESSAGES.appointmentConfirmed({
    date: formatDate(session.selected_date!),
    time: formatTime(session.selected_time!),
    professionalName: session.selected_professional_name || '',
    clinicName: clinicData?.name || '',
  }));

  const monthYear = new Date().toISOString().slice(0, 7);
  await supabase.from('message_logs').insert({
    clinic_id: config.clinic_id,
    message_type: 'whatsapp_booking_confirmed',
    phone,
    month_year: monthYear,
  });

  console.log(`[booking] Appointment created: ${appointmentData.id}`);
  return { handled: true, newState: 'FINISHED' };
}

// ==========================================
// AVAILABILITY HELPERS
// ==========================================

async function getAvailableDates(
  supabase: SupabaseClient,
  clinicId: string,
  professionalId: string
): Promise<Array<{ date: string; formatted: string; weekday: string }>> {
  const dates: Array<{ date: string; formatted: string; weekday: string }> = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data: professional } = await supabase
    .from('professionals')
    .select('schedule')
    .eq('id', professionalId)
    .single();

  const professionalData = professional as { schedule?: Record<string, { enabled: boolean; slots: Array<{ start: string; end: string }> }> } | null;

  if (!professionalData?.schedule) return dates;

  const schedule = professionalData.schedule;
  const dayMap: Record<number, string> = {
    0: 'sunday',
    1: 'monday',
    2: 'tuesday',
    3: 'wednesday',
    4: 'thursday',
    5: 'friday',
    6: 'saturday',
  };

  for (let i = 1; i <= 14 && dates.length < 5; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    
    const dayOfWeek = date.getDay();
    const dayKey = dayMap[dayOfWeek];
    const daySchedule = schedule[dayKey];

    if (!daySchedule?.enabled || !daySchedule.slots?.length) continue;

    const dateStr = date.toISOString().split('T')[0];

    // Check if it's a holiday using direct query instead of RPC
    const { data: clinicHoliday } = await supabase
      .from('clinic_holidays')
      .select('id')
      .eq('clinic_id', clinicId)
      .eq('holiday_date', dateStr)
      .maybeSingle();

    if (clinicHoliday) continue;

    const hasAvailableSlots = await hasAvailableSlotsOnDate(
      supabase,
      clinicId,
      professionalId,
      dateStr,
      daySchedule.slots
    );

    if (hasAvailableSlots) {
      dates.push({
        date: dateStr,
        formatted: formatDate(dateStr),
        weekday: getWeekday(dateStr),
      });
    }
  }

  return dates;
}

async function hasAvailableSlotsOnDate(
  supabase: SupabaseClient,
  clinicId: string,
  professionalId: string,
  date: string,
  slots: Array<{ start: string; end: string }>
): Promise<boolean> {
  const { data: appointments } = await supabase
    .from('appointments')
    .select('start_time, end_time')
    .eq('clinic_id', clinicId)
    .eq('professional_id', professionalId)
    .eq('appointment_date', date)
    .in('status', ['scheduled', 'confirmed']);

  const appointmentsData = (appointments || []) as Array<{ start_time: string; end_time: string }>;
  const bookedTimes = new Set<string>();
  appointmentsData.forEach(apt => {
    bookedTimes.add(apt.start_time.substring(0, 5));
  });

  const { data: professional } = await supabase
    .from('professionals')
    .select('appointment_duration')
    .eq('id', professionalId)
    .single();

  const professionalData = professional as { appointment_duration?: number } | null;
  const duration = professionalData?.appointment_duration || 30;

  for (const slot of slots) {
    const [startH, startM] = slot.start.split(':').map(Number);
    const [endH, endM] = slot.end.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    for (let m = startMinutes; m + duration <= endMinutes; m += duration) {
      const h = Math.floor(m / 60);
      const min = m % 60;
      const timeStr = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
      
      if (!bookedTimes.has(timeStr)) {
        return true;
      }
    }
  }

  return false;
}

async function getAvailableTimes(
  supabase: SupabaseClient,
  clinicId: string,
  professionalId: string,
  date: string
): Promise<Array<{ time: string; formatted: string }>> {
  const times: Array<{ time: string; formatted: string }> = [];

  const { data: professional } = await supabase
    .from('professionals')
    .select('schedule, appointment_duration')
    .eq('id', professionalId)
    .single();

  const professionalData = professional as { 
    schedule?: Record<string, { enabled: boolean; slots: Array<{ start: string; end: string }> }>;
    appointment_duration?: number;
  } | null;

  if (!professionalData?.schedule) return times;

  const schedule = professionalData.schedule;
  const duration = professionalData.appointment_duration || 30;

  const dateObj = new Date(date + 'T00:00:00');
  const dayOfWeek = dateObj.getDay();
  const dayMap: Record<number, string> = {
    0: 'sunday', 1: 'monday', 2: 'tuesday', 3: 'wednesday',
    4: 'thursday', 5: 'friday', 6: 'saturday',
  };

  const daySchedule = schedule[dayMap[dayOfWeek]];
  if (!daySchedule?.enabled || !daySchedule.slots?.length) return times;

  const { data: appointments } = await supabase
    .from('appointments')
    .select('start_time, end_time')
    .eq('clinic_id', clinicId)
    .eq('professional_id', professionalId)
    .eq('appointment_date', date)
    .in('status', ['scheduled', 'confirmed']);

  const appointmentsData = (appointments || []) as Array<{ start_time: string; end_time: string }>;
  const bookedTimes = new Set<string>();
  appointmentsData.forEach(apt => {
    bookedTimes.add(apt.start_time.substring(0, 5));
  });

  for (const slot of daySchedule.slots) {
    const [startH, startM] = slot.start.split(':').map(Number);
    const [endH, endM] = slot.end.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    for (let m = startMinutes; m + duration <= endMinutes; m += duration) {
      const h = Math.floor(m / 60);
      const min = m % 60;
      const timeStr = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
      
      if (!bookedTimes.has(timeStr)) {
        times.push({
          time: timeStr,
          formatted: timeStr,
        });
      }
    }
  }

  return times.slice(0, 10);
}

async function checkCpfAppointmentLimit(
  supabase: SupabaseClient,
  clinicId: string,
  patientId: string,
  professionalId: string
): Promise<{ limitReached: boolean; maxAllowed: number }> {
  // Get clinic's CPF appointment limit setting
  const { data: clinic } = await supabase
    .from('clinics')
    .select('max_appointments_per_cpf_month')
    .eq('id', clinicId)
    .single();

  const maxAllowed = (clinic as { max_appointments_per_cpf_month: number | null } | null)?.max_appointments_per_cpf_month;
  
  // If no limit configured (NULL or 0), allow
  if (!maxAllowed || maxAllowed === 0) {
    return { limitReached: false, maxAllowed: 0 };
  }

  // Get patient CPF
  const { data: patient } = await supabase
    .from('patients')
    .select('cpf')
    .eq('id', patientId)
    .single();

  const patientCpf = (patient as { cpf: string | null } | null)?.cpf;

  // If no CPF, can't validate - allow
  if (!patientCpf) {
    return { limitReached: false, maxAllowed };
  }

  // Calculate month boundaries
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  // Count existing appointments in the same month for same professional and CPF
  const { data: existingAppointments, error } = await supabase
    .from('appointments')
    .select('id, patient:patients!inner(cpf)')
    .eq('clinic_id', clinicId)
    .eq('professional_id', professionalId)
    .gte('appointment_date', monthStart)
    .lte('appointment_date', monthEnd)
    .neq('status', 'cancelled');

  if (error) {
    console.error('[booking] Error checking CPF limit:', error);
    return { limitReached: false, maxAllowed };
  }

  // Filter by matching CPF
  const matchingAppointments = (existingAppointments || []).filter((apt: { patient: { cpf: string } }) => 
    apt.patient?.cpf === patientCpf
  );

  const currentCount = matchingAppointments.length;

  console.log(`[booking] CPF limit check: patient=${patientId}, professional=${professionalId}, month=${monthStart}, count=${currentCount}, max=${maxAllowed}`);

  return { 
    limitReached: currentCount >= maxAllowed, 
    maxAllowed 
  };
}

async function checkSlotAvailability(
  supabase: SupabaseClient,
  clinicId: string,
  professionalId: string,
  date: string,
  time: string
): Promise<boolean> {
  const { data: existing } = await supabase
    .from('appointments')
    .select('id')
    .eq('clinic_id', clinicId)
    .eq('professional_id', professionalId)
    .eq('appointment_date', date)
    .eq('start_time', time)
    .in('status', ['scheduled', 'confirmed'])
    .maybeSingle();

  return !existing;
}

// ==========================================
// SESSION MANAGEMENT
// ==========================================

async function getOrCreateSession(
  supabase: SupabaseClient,
  clinicId: string,
  phone: string
): Promise<{ session: BookingSession | null; wasExpired: boolean }> {
  // First, check if there's ANY session (even expired) to detect expiration
  const { data: anySession, error: anyError } = await supabase
    .from('whatsapp_booking_sessions')
    .select('*')
    .eq('clinic_id', clinicId)
    .eq('phone', phone)
    .neq('state', 'FINISHED')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (anyError) {
    console.error('[booking] Error fetching session:', anyError);
    return { session: null, wasExpired: false };
  }

  // Check if session exists but is expired
  const isExpired = anySession && new Date(anySession.expires_at) < new Date();
  
  if (isExpired) {
    console.log(`[booking] Session expired for ${phone}, was in state: ${anySession.state}`);
    // Delete expired session
    await supabase
      .from('whatsapp_booking_sessions')
      .delete()
      .eq('id', anySession.id);
    
    // Create new session
    try {
      const newSession = await createOrResetSession(supabase, clinicId, phone, 'WAITING_CPF');
      return { session: newSession, wasExpired: true };
    } catch (e) {
      console.error('[booking] Error creating session after expiry:', e);
      return { session: null, wasExpired: true };
    }
  }

  // Session is valid
  if (anySession) {
    return { session: anySession as BookingSession, wasExpired: false };
  }

  // No session at all, create new one
  try {
    const newSession = await createOrResetSession(supabase, clinicId, phone, 'WAITING_CPF');
    return { session: newSession, wasExpired: false };
  } catch (e) {
    console.error('[booking] Error creating session:', e);
    return { session: null, wasExpired: false };
  }
}

async function createOrResetSession(
  supabase: SupabaseClient,
  clinicId: string,
  phone: string,
  state: BookingState
): Promise<BookingSession> {
  await supabase
    .from('whatsapp_booking_sessions')
    .delete()
    .eq('clinic_id', clinicId)
    .eq('phone', phone);

  // Session expires in 60 seconds of inactivity
  const { data: session, error } = await supabase
    .from('whatsapp_booking_sessions')
    .insert({
      clinic_id: clinicId,
      phone,
      state,
      expires_at: new Date(Date.now() + 60 * 1000).toISOString(),
    })
    .select('*')
    .single();

  if (error) {
    console.error('[booking] Error creating session:', error);
    throw error;
  }

  return session as BookingSession;
}

async function updateSession(
  supabase: SupabaseClient,
  sessionId: string,
  updates: Partial<BookingSession>
): Promise<void> {
  // Renew session for 60 seconds on each interaction
  const { error } = await supabase
    .from('whatsapp_booking_sessions')
    .update({
      ...updates,
      expires_at: new Date(Date.now() + 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId);

  if (error) {
    console.error('[booking] Error updating session:', error);
  }
}

async function resetSession(
  supabase: SupabaseClient,
  clinicId: string,
  phone: string
): Promise<void> {
  await supabase
    .from('whatsapp_booking_sessions')
    .delete()
    .eq('clinic_id', clinicId)
    .eq('phone', phone);
}

// ==========================================
// CONFIRMATION FLOW (EXISTING)
// ==========================================

async function handleConfirmationFlow(
  supabase: SupabaseClient,
  phone: string,
  messageText: string,
  phoneCandidates: string[]
): Promise<{ handled: boolean; clinicId?: string }> {
  const { data: pendingConfirmations, error: pendingError } = await supabase
    .from('pending_confirmations')
    .select(`id, appointment_id, clinic_id, expires_at`)
    .in('phone', phoneCandidates)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .order('sent_at', { ascending: false })
    .limit(1);

  if (pendingError) {
    console.error('[webhook] Error fetching pending confirmations:', pendingError);
    return { handled: false };
  }

  const pendingData = pendingConfirmations as Array<{
    id: string;
    appointment_id: string;
    clinic_id: string;
    expires_at: string;
  }> | null;

  if (!pendingData || pendingData.length === 0) {
    return { handled: false };
  }

  let action: 'confirmed' | 'cancelled' | 'ignored' = 'ignored';
  if (POSITIVE_REGEX.test(messageText.trim())) {
    action = 'confirmed';
  } else if (NEGATIVE_REGEX.test(messageText.trim())) {
    action = 'cancelled';
  }

  if (action === 'ignored') {
    return { handled: false, clinicId: pendingData[0].clinic_id };
  }

  const pending = pendingData[0];

  const { data: appointment, error: appointmentError } = await supabase
    .from('appointments')
    .select(`id, appointment_date, start_time, status, patient:patients (name), professional:professionals (name)`)
    .eq('id', pending.appointment_id)
    .single();

  if (appointmentError || !appointment) {
    console.error('[webhook] Error fetching appointment:', appointmentError);
    return { handled: false, clinicId: pending.clinic_id };
  }

  const appointmentData = appointment as AppointmentRecord;

  const newStatus = action === 'confirmed' ? 'confirmed' : 'cancelled';
  const updateFields: Record<string, unknown> = { status: newStatus };

  if (action === 'confirmed') {
    updateFields.confirmed_at = new Date().toISOString();
  } else {
    updateFields.cancelled_at = new Date().toISOString();
    updateFields.cancellation_reason = 'Cancelado pelo paciente via WhatsApp';
  }

  await supabase.from('appointments').update(updateFields).eq('id', appointmentData.id);
  await supabase.from('pending_confirmations').update({ status: action }).eq('id', pending.id);

  const { data: evolutionConfig } = await supabase
    .from('evolution_configs')
    .select('api_url, api_key, instance_name, direct_reply_enabled')
    .eq('clinic_id', pending.clinic_id)
    .maybeSingle();

  const { data: clinic } = await supabase
    .from('clinics')
    .select('name')
    .eq('id', pending.clinic_id)
    .single();

  const evolutionConfigData = evolutionConfig as EvolutionConfig | null;
  const clinicData = clinic as { name?: string } | null;

  if (evolutionConfigData?.api_url && evolutionConfigData?.api_key) {
    const dateFormatted = formatDate(appointmentData.appointment_date);
    const time = appointmentData.start_time?.substring(0, 5) || '';
    const professionalName = (appointmentData.professional as { name?: string })?.name || 'Profissional';

    let responseMessage = '';
    if (action === 'confirmed') {
      responseMessage = `✅ Consulta confirmada com sucesso!\n\n📅 ${dateFormatted} às ${time}\n👨‍⚕️ ${professionalName}\n\nAguardamos você!\n${clinicData?.name || ''}`;
    } else {
      responseMessage = `❌ Consulta cancelada.\n\nA consulta de ${dateFormatted} às ${time} foi cancelada conforme solicitado.\n\nCaso deseje reagendar, entre em contato conosco.\n${clinicData?.name || ''}`;
    }

    await sendWhatsAppMessage(
      { ...evolutionConfigData, clinic_id: pending.clinic_id },
      phone,
      responseMessage
    );

    const monthYear = new Date().toISOString().slice(0, 7);
    await supabase.from('message_logs').insert({
      clinic_id: pending.clinic_id,
      message_type: action === 'confirmed' ? 'confirmation_response' : 'cancellation_response',
      phone,
      month_year: monthYear,
    });
  }

  console.log(`[webhook] Processed ${action} for appointment ${appointmentData.id}`);
  return { handled: true, clinicId: pending.clinic_id };
}

// ==========================================
// MAIN HANDLER
// ==========================================

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

    if (payload.event !== 'MESSAGES_UPSERT' && payload.event !== 'messages.upsert') {
      return new Response(
        JSON.stringify({ success: true, message: 'Event ignored' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (payload.data?.key?.fromMe) {
      return new Response(
        JSON.stringify({ success: true, message: 'Self message ignored' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const remoteJid = payload.data?.key?.remoteJid || '';
    const phone = normalizePhone(remoteJid.replace('@s.whatsapp.net', ''));
    const messageText = extractMessageText(payload.data);

    console.log(`[webhook] Phone: ${phone}, Message: "${messageText}"`);

    if (!phone || !messageText) {
      return new Response(
        JSON.stringify({ success: true, message: 'No action needed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const phoneCandidates = getBrazilPhoneVariants(phone);

    const confirmResult = await handleConfirmationFlow(supabase, phone, messageText, phoneCandidates);
    
    let clinicId = confirmResult.clinicId;

    if (!confirmResult.handled) {
      // Find config by instance name - each clinic should have unique instance name
      const { data: configByInstance, error: configError } = await supabase
        .from('evolution_configs')
        .select('clinic_id, api_url, api_key, instance_name, direct_reply_enabled')
        .eq('instance_name', payload.instance)
        .eq('is_connected', true)
        .eq('direct_reply_enabled', true);

      if (configError) {
        console.error('[webhook] Error fetching config:', configError);
      }

      // If multiple clinics share same instance, log warning
      if (configByInstance && configByInstance.length > 1) {
        console.warn(`[webhook] WARNING: Multiple clinics (${configByInstance.length}) share the same instance "${payload.instance}". ` +
          `Each clinic should have a unique Evolution instance for proper routing. ` +
          `Using first match: clinic_id=${configByInstance[0].clinic_id}`);
      }

      const configData = configByInstance && configByInstance.length > 0 
        ? (configByInstance[0] as EvolutionConfig) 
        : null;

      console.log(`[webhook] Instance "${payload.instance}" -> clinic: ${configData?.clinic_id ?? 'not found'}`);

      if (configData) {
        clinicId = configData.clinic_id;
        console.log(`[webhook] Processing booking flow for clinic ${clinicId}`);

        const sessionResult = await getOrCreateSession(supabase, clinicId, phone);
        console.log(`[webhook] Session state: ${sessionResult?.session?.state ?? 'null'}, wasExpired: ${sessionResult?.wasExpired}`);

        if (sessionResult?.session) {
          await handleBookingFlow(
            supabase,
            configData,
            phone,
            messageText,
            sessionResult.session,
            sessionResult.wasExpired
          );
        } else {
          console.error('[webhook] Failed to get or create session');
        }
      } else {
        console.log(`[webhook] No config found with direct_reply_enabled for instance: ${payload.instance}`);
      }
    }

    if (clinicId) {
      await supabase.from('whatsapp_incoming_logs').insert({
        clinic_id: clinicId,
        phone,
        message_text: messageText,
        raw_payload: payload,
        processed: true,
        processed_action: 'booking_flow',
      });
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[webhook] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
