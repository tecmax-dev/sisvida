import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ==========================================
// REGEX PATTERNS
// ==========================================

// Accept common confirmations plus numeric fallbacks:
// 1 = SIM, 2 = NÃO (some clients don’t render buttons)
const POSITIVE_REGEX = /^(sim|s|confirmo|ok|👍|confirmado|confirmar|vou|yes|y|simmm|siim|sím|1\b)/i;
const NEGATIVE_REGEX = /^(não|nao|n|cancelo|cancelar|❌|desisto|nao vou|não vou|no|cancel|cancelado|2\b)/i;
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
  | 'SELECT_BOOKING_FOR'
  | 'SELECT_PROFESSIONAL'
  | 'SELECT_PROCEDURE'
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
      id?: string;
    };
    message?: {
      conversation?: string;
      extendedTextMessage?: {
        text?: string;
      };
      // Interactive button response
      buttonsResponseMessage?: {
        selectedButtonId?: string;
        selectedDisplayText?: string;
      };
      // List response
      listResponseMessage?: {
        singleSelectReply?: {
          selectedRowId?: string;
        };
      };
      // Interactive response (newer format)
      interactiveResponseMessage?: {
        nativeFlowResponseMessage?: {
          paramsJson?: string;
        };
      };
      // Template button response
      templateButtonReplyMessage?: {
        selectedId?: string;
      };
      // Image message
      imageMessage?: {
        url?: string;
        mimetype?: string;
        caption?: string;
        directPath?: string;
        mediaKey?: string;
        fileLength?: string;
        fileSha256?: string;
        fileEncSha256?: string;
      };
      // Document message
      documentMessage?: {
        url?: string;
        mimetype?: string;
        title?: string;
        fileName?: string;
        directPath?: string;
        mediaKey?: string;
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
  available_procedures?: Array<{ id: string; name: string; duration?: number }> | null;
  available_dates: Array<{ date: string; formatted: string; weekday: string }> | null;
  available_times: Array<{ time: string; formatted: string }> | null;
  // For cancel/reschedule flows
  pending_appointments: Array<{ id: string; date: string; time: string; professional: string }> | null;
  appointments_list?: Array<{ id: string; date: string; time: string; professional: string; professional_id?: string; procedure?: string; status: string; dependent_name?: string }> | null;
  list_action?: 'cancel' | 'reschedule' | null;
  selected_appointment_id: string | null;
  action_type: 'new' | 'cancel' | 'reschedule' | null;
  expires_at: string;
  // Dependent booking support
  available_dependents?: Array<{ id: string; name: string; relationship: string | null; card_expires_at: string | null }> | null;
  selected_dependent_id?: string | null;
  selected_dependent_name?: string | null;
  booking_for?: 'titular' | 'dependent';
  // When dependent logs in with their own CPF
  is_dependent_direct_booking?: boolean;
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
  is_active?: boolean;
  inactivation_reason?: string | null;
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
  professional?: { id?: string; name?: string };
  procedure?: { name?: string };
}

interface AIExtractedIntent {
  intent: 'schedule' | 'cancel' | 'reschedule' | 'list' | 'info' | 'query_schedule' | 'help' | 'confirm' | 'deny' | 'select_option' | 'unknown';
  entities: {
    professional_name?: string;
    specialty?: string;
    date?: string;
    time?: string;
    option_number?: number;
    cpf?: string;
  };
  confidence: number;
  friendly_response?: string;
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
  
  // Check for interactive button response first
  if (data.message?.buttonsResponseMessage?.selectedButtonId) {
    return data.message.buttonsResponseMessage.selectedButtonId;
  }
  
  // Check for list response
  if (data.message?.listResponseMessage?.singleSelectReply?.selectedRowId) {
    return data.message.listResponseMessage.singleSelectReply.selectedRowId;
  }
  
  // Check for interactive message response (newer Evolution API format)
  if (data.message?.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson) {
    try {
      const params = JSON.parse(data.message.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson);
      if (params.id) return params.id;
    } catch { /* ignore parse errors */ }
  }
  
  // Check for button reply (alternative format)
  if (data.message?.templateButtonReplyMessage?.selectedId) {
    return data.message.templateButtonReplyMessage.selectedId;
  }
  
  // Standard text message
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

// Helper to format phone for WhatsApp
function formatPhoneForWhatsApp(phone: string): string {
  let formattedPhone = phone.replace(/\D/g, '');
  if (!formattedPhone.startsWith('55')) {
    formattedPhone = '55' + formattedPhone;
  }
  return formattedPhone.includes('@')
    ? formattedPhone
    : `${formattedPhone}@s.whatsapp.net`;
}

async function sendWhatsAppMessage(
  config: EvolutionConfig,
  phone: string,
  message: string
): Promise<boolean> {
  try {
    const destination = formatPhoneForWhatsApp(phone);
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
// INTERACTIVE BUTTONS SENDER (up to 3 buttons)
// ==========================================

interface ButtonOption {
  id: string;
  text: string;
}

async function sendWhatsAppButtons(
  config: EvolutionConfig,
  phone: string,
  title: string,
  description: string,
  buttons: ButtonOption[],
  footer?: string
): Promise<boolean> {
  // Use only numbered text for maximum compatibility across all WhatsApp clients/devices
  console.log(`[booking] Sending numbered options to phone:`, buttons.map(b => b.text));
  
  const numberedOptions = buttons.map((b, i) => `${i + 1}️⃣ ${b.text}`).join('\n');
  const message = `${title}\n\n${description}\n\n${numberedOptions}${footer ? `\n\n${footer}` : ''}`;
  
  return await sendWhatsAppMessage(config, phone, message);
}

// ==========================================
// INTERACTIVE LIST SENDER (for many options)
// ==========================================

interface ListRow {
  id: string;
  title: string;
  description?: string;
}

interface ListSection {
  title: string;
  rows: ListRow[];
}

async function sendWhatsAppList(
  config: EvolutionConfig,
  phone: string,
  title: string,
  description: string,
  buttonText: string,
  sections: ListSection[],
  footer?: string
): Promise<boolean> {
  try {
    const destination = formatPhoneForWhatsApp(phone);
    console.log(`[booking] Sending list to ${destination}: ${sections.reduce((acc, s) => acc + s.rows.length, 0)} items`);

    // Format sections for Evolution API
    const formattedSections = sections.map(section => ({
      title: section.title.substring(0, 24),
      rows: section.rows.slice(0, 10).map(row => ({
        rowId: row.id,
        title: row.title.substring(0, 24),
        description: row.description?.substring(0, 72) || ''
      }))
    }));

    const response = await fetch(`${config.api_url}/message/sendList/${config.instance_name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: config.api_key,
      },
      body: JSON.stringify({
        number: destination,
        title: title.substring(0, 60),
        description: description.substring(0, 1024),
        buttonText: buttonText.substring(0, 20),
        footerText: footer?.substring(0, 60) || '',
        sections: formattedSections,
      }),
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error('[booking] WhatsApp List API error:', responseText);
      // Fallback to text message if list fails
      let fallbackMsg = `${title}\n\n${description}\n\n`;
      sections.forEach(section => {
        if (section.title) fallbackMsg += `*${section.title}*\n`;
        section.rows.forEach((row, i) => {
          fallbackMsg += `${i + 1}️⃣ ${row.title}${row.description ? ` - ${row.description}` : ''}\n`;
        });
        fallbackMsg += '\n';
      });
      if (footer) fallbackMsg += footer;
      return await sendWhatsAppMessage(config, phone, fallbackMsg.trim());
    }

    console.log(`[booking] WhatsApp List API ok (${response.status})`);
    return true;
  } catch (error) {
    console.error('[booking] Error sending WhatsApp list:', error);
    // Fallback to text message
    let fallbackMsg = `${title}\n\n${description}\n\n`;
    sections.forEach(section => {
      if (section.title) fallbackMsg += `*${section.title}*\n`;
      section.rows.forEach((row, i) => {
        fallbackMsg += `${i + 1}️⃣ ${row.title}${row.description ? ` - ${row.description}` : ''}\n`;
      });
      fallbackMsg += '\n';
    });
    if (footer) fallbackMsg += footer;
    return await sendWhatsAppMessage(config, phone, fallbackMsg.trim());
  }
}

// Helper to extract button/list response ID from message
function extractInteractiveResponseId(messageData: any): string | null {
  // Check for button response
  if (messageData?.buttonResponseMessage?.selectedButtonId) {
    return messageData.buttonResponseMessage.selectedButtonId;
  }
  // Check for list response
  if (messageData?.listResponseMessage?.singleSelectReply?.selectedRowId) {
    return messageData.listResponseMessage.singleSelectReply.selectedRowId;
  }
  // Check for interactive message response (newer format)
  if (messageData?.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson) {
    try {
      const params = JSON.parse(messageData.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson);
      return params.id || null;
    } catch { /* ignore */ }
  }
  return null;
}

// ==========================================
// AI ASSISTANT INTEGRATION
// ==========================================

async function getAIIntent(
  message: string,
  context: string,
  availableProfessionals?: Array<{ name: string; specialty: string }>,
  availableDates?: Array<{ date: string; formatted: string; weekday: string }>,
  availableTimes?: Array<{ time: string; formatted: string }>
): Promise<AIExtractedIntent> {
  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.log('[ai] LOVABLE_API_KEY not configured, falling back to regex');
      return { intent: 'unknown', entities: {}, confidence: 0 };
    }

    // Build context info for the AI
    let contextInfo = '';
    if (availableProfessionals && availableProfessionals.length > 0) {
      contextInfo += `\nProfissionais disponíveis: ${availableProfessionals.map((p, i) => `${i + 1}. ${p.name}`).join(', ')}`;
    }
    if (availableDates && availableDates.length > 0) {
      contextInfo += `\nDatas disponíveis: ${availableDates.map((d, i) => `${i + 1}. ${d.formatted} (${d.weekday})`).join(', ')}`;
    }
    if (availableTimes && availableTimes.length > 0) {
      contextInfo += `\nHorários disponíveis: ${availableTimes.map((t, i) => `${i + 1}. ${t.formatted}`).join(', ')}`;
    }

    const systemPrompt = `Você é um assistente de agendamento médico via WhatsApp, inteligente e dinâmico. Interprete a mensagem e extraia a intenção.

Estado atual: ${context}${contextInfo}

INTERPRETAÇÃO DE INTENÇÕES:
- Número sozinho (1, 2, 3...) = select_option com option_number
- "sim", "confirmo", "ok", "👍", "s" = confirm
- "não", "nao", "n", "❌" = deny
- Pedir para agendar/marcar = schedule
- Pedir para cancelar/desmarcar = cancel  
- Pedir para reagendar/remarcar = reschedule
- Ver consultas/agendamentos = list
- CPF tem 11 dígitos

EXTRAÇÃO DE ENTIDADES:
- Se mencionar nome de profissional (dr., dra., doutor, doutora, + nome), extrair professional_name
- Se mencionar especialidade (dentista, médico, psicólogo, fisioterapeuta), extrair specialty
- Se mencionar data (amanhã, segunda, dia 15), extrair date
- Se mencionar horário (14h, duas da tarde), extrair time

CONSULTAS SOBRE HORÁRIOS (intent=query_schedule):
- "que dia dr. X atende?" → query_schedule + professional_name
- "quais horários de dra. Y?" → query_schedule + professional_name
- "quando o dentista atende?" → query_schedule + specialty:"dentista"
- "horários disponíveis do dr. Z" → query_schedule + professional_name
- "dias de atendimento" → query_schedule

PERGUNTAS INFORMATIVAS (intent=info):
- "como faço para...", "como funciona", "o que é", "onde fica" = info
- Perguntas sobre carteirinha, renovação, documentos = info
- Para info, forneça friendly_response útil

EXEMPLOS:
- "quero marcar com dr. João amanhã" → schedule + professional_name:"João" + date:"amanhã"
- "que dia o Dr. Alcides atende?" → query_schedule + professional_name:"Alcides"
- "horários da dra. Daniela?" → query_schedule + professional_name:"Daniela"
- "quando o dentista atende?" → query_schedule + specialty:"dentista"
- "tem médico segunda?" → query_schedule + specialty:"médico" + date:"segunda"

Retorne APENAS JSON:
{"intent":"schedule|cancel|reschedule|list|info|query_schedule|help|confirm|deny|select_option|unknown","entities":{"professional_name":"...","specialty":"...","date":"...","time":"...","option_number":N,"cpf":"..."},"confidence":0.0-1.0,"friendly_response":"resposta amigável"}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
      }),
    });

    if (!response.ok) {
      console.error('[ai] Gateway error:', response.status);
      return { intent: 'unknown', entities: {}, confidence: 0 };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    console.log('[ai] Raw response:', content);

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log('[ai] Parsed intent:', parsed);
      return parsed;
    }
    
    return { intent: 'unknown', entities: {}, confidence: 0 };
  } catch (error) {
    console.error('[ai] Error:', error);
    return { intent: 'unknown', entities: {}, confidence: 0 };
  }
}

// Format professional schedule for display
function formatProfessionalSchedule(schedule: Record<string, { enabled: boolean; slots: Array<{ start: string; end: string }> }> | null): string {
  if (!schedule) return 'Horários não configurados.';
  
  const dayNames: Record<string, string> = {
    monday: 'Segunda',
    tuesday: 'Terça',
    wednesday: 'Quarta',
    thursday: 'Quinta',
    friday: 'Sexta',
    saturday: 'Sábado',
    sunday: 'Domingo'
  };
  
  const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const lines: string[] = [];
  
  for (const day of dayOrder) {
    const dayConfig = schedule[day];
    if (dayConfig?.enabled && dayConfig.slots?.length > 0) {
      const slots = dayConfig.slots.map(s => `${s.start.slice(0,5)} às ${s.end.slice(0,5)}`).join(', ');
      lines.push(`📅 *${dayNames[day]}*: ${slots}`);
    }
  }
  
  return lines.length > 0 ? lines.join('\n') : 'Sem horários configurados.';
}

// Find professionals by specialty
function findProfessionalsBySpecialty(
  specialty: string,
  professionals: Array<{ id: string; name: string; specialty: string; schedule?: any }>
): Array<{ id: string; name: string; specialty: string; schedule?: any }> {
  const normalizedSearch = specialty.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  return professionals.filter(p => {
    const normalizedSpecialty = p.specialty?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') || '';
    return normalizedSpecialty.includes(normalizedSearch) || normalizedSearch.includes(normalizedSpecialty);
  });
}

// Helper to find professional by name using fuzzy match
function findProfessionalByName(
  name: string,
  professionals: Array<{ id: string; name: string; specialty: string; schedule?: any }>
): { id: string; name: string; specialty: string; schedule?: any } | null {
  if (!name || !professionals || professionals.length === 0) return null;
  
  const normalizedSearch = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  // Try exact match first
  const exact = professionals.find(p => 
    p.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === normalizedSearch
  );
  if (exact) return exact;
  
  // Try partial match
  const partial = professionals.find(p => {
    const normalizedName = p.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return normalizedName.includes(normalizedSearch) || normalizedSearch.includes(normalizedName);
  });
  if (partial) return partial;
  
  // Try first name match
  const firstName = normalizedSearch.split(' ')[0];
  const byFirstName = professionals.find(p => {
    const profFirstName = p.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(' ')[0];
    return profFirstName === firstName;
  });
  
  return byFirstName || null;
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

  patientInactive: (clinicName: string, reason?: string | null) => {
    const reasonText = reason ? ` (${reason})` : '';
    return `❌ Seu cadastro está *inativo*${reasonText}.

Para realizar agendamentos, entre em contato com *${clinicName}* para regularizar sua situação.`;
  },

  confirmIdentity: (name: string) => `Encontramos o cadastro em nome de *${name}*.

Confirma que é você?
Responda *SIM* para continuar ou *NÃO* para encerrar.`,

  identityDenied: `Tudo bem! Por questões de segurança, encerramos por aqui.

Se precisar de ajuda, entre em contato conosco.`,

  // Select who the appointment is for (titular or dependent)
  selectBookingFor: (patientName: string, dependents: Array<{ name: string; relationship: string | null; card_expires_at: string | null }>) => {
    // Build a friendly message with first name
    const firstName = patientName.split(' ')[0];
    let msg = `${firstName}, você quer agendar para você ou para algum dependente? 😊\n\n`;
    msg += `1️⃣ Para mim (*${patientName}*)\n`;
    
    dependents.forEach((dep, i) => {
      const isExpired = dep.card_expires_at && new Date(dep.card_expires_at) < new Date();
      const expiredTag = isExpired ? ' ⚠️' : '';
      msg += `${i + 2}️⃣ *${dep.name}*${expiredTag}\n`;
    });
    
    // Add option for other actions (menu)
    const menuOption = 2 + dependents.length;
    msg += `\n${menuOption}️⃣ 📋 *Outras opções* (cancelar, reagendar, ver consultas)`;
    
    return msg.trim();
  },

  dependentCardExpired: (dependentName: string, expiryDate: string) => {
    const firstName = dependentName.split(' ')[0];
    return `Ops! A carteirinha de *${firstName}* está vencida desde *${expiryDate}*. 😕\n\nEntre em contato com a clínica para renovar, depois é só voltar aqui! 💪`;
  },

  // Main menu after identity confirmed
  mainMenu: `O que você deseja fazer?

1️⃣ *Agendar* nova consulta
2️⃣ *Cancelar* consulta existente
3️⃣ *Reagendar* consulta
4️⃣ *Ver* minhas consultas

_Digite o número da opção desejada._`,

  selectProfessional: (professionals: Array<{ name: string; specialty: string }>) => {
    let msg = `Perfeito! 😊
Escolha o profissional desejado digitando o *número*:\n\n`;
    professionals.forEach((p, i) => {
      msg += `${i + 1}️⃣ Dr(a). ${p.name} – ${p.specialty || 'Clínica Geral'}\n`;
    });
    return msg.trim();
  },

  selectProcedure: (professionalName: string, procedures: Array<{ name: string; duration?: number }>) => {
    let msg = `O(A) *Dr(a). ${professionalName}* realiza os seguintes procedimentos:\n\n`;
    procedures.forEach((p, i) => {
      const durationText = p.duration ? ` (${p.duration} min)` : '';
      msg += `${i + 1}️⃣ ${p.name}${durationText}\n`;
    });
    msg += `\n_Qual procedimento você deseja agendar?_`;
    return msg.trim();
  },

  noProfessionals: `😔 Poxa, que pena! No momento não conseguimos encontrar profissionais disponíveis para agendamento.

Mas não desanime! Isso pode ser temporário. Tente novamente mais tarde ou entre em contato conosco por telefone que teremos prazer em ajudá-lo(a). 💙`,

  professionalSelected: (name: string) => `Ótima escolha! ✨ Você selecionou *Dr(a). ${name}*.

Agora vamos encontrar a melhor data para você! 📅`,

  selectDate: (dates: Array<{ formatted: string; weekday: string }>) => {
    let msg = `📅 Maravilha! Aqui estão as datas disponíveis:\n\n`;
    dates.forEach((d, i) => {
      msg += `${i + 1}️⃣ ${d.formatted} (${d.weekday})\n`;
    });
    msg += `\n_Escolha o número da data que preferir!_`;
    return msg.trim();
  },

  noDates: (professionalName?: string) => {
    const profText = professionalName ? ` do(a) Dr(a). ${professionalName}` : '';
    return `😔 Que pena! Infelizmente não encontramos datas disponíveis${profText} nos próximos dias.

Isso pode acontecer quando a agenda está bem concorrida - é sinal de que o(a) profissional é muito procurado(a)! 🌟

💡 *Sugestões:*
• Digite *MENU* para ver outros profissionais
• Tente novamente em alguns dias
• Entre em contato conosco para lista de espera`;
  },

  selectTime: (times: Array<{ formatted: string }>) => {
    let msg = `⏰ Perfeito! Confira os horários disponíveis:\n\n`;
    times.forEach((t, i) => {
      msg += `${i + 1}️⃣ ${t.formatted}\n`;
    });
    msg += `\n_Qual horário fica melhor para você?_`;
    return msg.trim();
  },

  noTimes: (date?: string, professionalName?: string) => {
    const dateText = date ? ` para ${date}` : '';
    const profText = professionalName ? ` com Dr(a). ${professionalName}` : '';
    return `😔 Ah, que pena! Os horários${dateText}${profText} já foram todos preenchidos.

A boa notícia é que podemos tentar outra data! 📅

💡 *O que você pode fazer:*
• Responda com outra data (ex: "amanhã", "segunda")
• Digite *MENU* para recomeçar
• Entre em contato conosco para verificar cancelamentos`;
  },

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

Digite *SIM* para confirmar ou *NÃO* para cancelar.`,

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

Você ficou mais de 10 minutos sem interagir.
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

  // Fast-path CPF (don’t depend on AI; WhatsApp sometimes sends formats the AI won’t parse)
  const maybeCpf = messageText.replace(/\D/g, '');
  if (CPF_REGEX.test(maybeCpf) && validateCpf(maybeCpf)) {
    const currentSession = session ?? await createOrResetSession(supabase, config.clinic_id, phone, 'WAITING_CPF');
    return await handleWaitingCpf(supabase, config, phone, maybeCpf, currentSession);
  }

  // If session was expired, only interrupt when the message is NOT a CPF
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

  // ===== AI-FIRST APPROACH =====
  // Always use AI to understand user intent, then route accordingly
  const aiResult = await getAIIntent(messageText, session.state);
  console.log(`[booking] AI intent: ${aiResult.intent}, confidence: ${aiResult.confidence}, state: ${session.state}`);

  // Handle high-confidence AI intents that can override current state
  if (aiResult.confidence >= 0.6) {
    // Extract CPF from AI if detected (any state)
    if (aiResult.entities?.cpf) {
      const cleanCpf = aiResult.entities.cpf.replace(/\D/g, '');
      if (CPF_REGEX.test(cleanCpf) && validateCpf(cleanCpf)) {
        console.log('[booking] AI detected valid CPF:', cleanCpf.slice(0, 3) + '***');
        return await handleWaitingCpf(supabase, config, phone, cleanCpf, session);
      }
    }

    // Handle INFO intent - respond to informational questions without requiring CPF
    if (aiResult.intent === 'info' && aiResult.friendly_response) {
      console.log('[booking] AI detected info intent - responding directly');
      const infoMsg = `${aiResult.friendly_response}\n\n` +
        '💡 Posso ajudar com mais alguma coisa?\n\n' +
        '📅 Para *agendar*, *cancelar* ou *consultar* suas consultas, basta me informar seu CPF.';
      
      await sendWhatsAppMessage(config, phone, infoMsg);
      return { handled: true, newState: session.state };
    }

    // Handle QUERY_SCHEDULE intent - respond with professional schedules without requiring CPF
    if (aiResult.intent === 'query_schedule') {
      console.log('[booking] AI detected query_schedule intent');
      
      // Fetch professionals with schedules
      const { data: professionals } = await supabase
        .from('professionals')
        .select('id, name, schedule, professional_specialties(specialties(name))')
        .eq('clinic_id', config.clinic_id)
        .eq('is_active', true);
      
      if (!professionals || professionals.length === 0) {
        await sendWhatsAppMessage(config, phone, '❌ Não encontramos profissionais disponíveis no momento.');
        return { handled: true, newState: session.state };
      }

      // Format professionals with specialty
      const formattedProfessionals = professionals.map((p: any) => ({
        id: p.id as string,
        name: p.name as string,
        specialty: (p.professional_specialties as any)?.[0]?.specialties?.name || 'Especialidade não informada',
        schedule: p.schedule
      }));

      let responseMsg = '';

      // Check if looking for specific professional by name
      if (aiResult.entities?.professional_name) {
        const found = findProfessionalByName(aiResult.entities.professional_name, formattedProfessionals);
        if (found) {
          const scheduleText = formatProfessionalSchedule(found.schedule as any);
          responseMsg = `📋 *Horários de ${found.name}*\n${found.specialty}\n\n${scheduleText}`;
        } else {
          responseMsg = `❌ Não encontrei um profissional com esse nome.\n\n*Profissionais disponíveis:*\n${formattedProfessionals.map((p: any, i: number) => `${i + 1}. ${p.name} - ${p.specialty}`).join('\n')}`;
        }
      }
      // Check if looking by specialty
      else if (aiResult.entities?.specialty) {
        const found = findProfessionalsBySpecialty(aiResult.entities.specialty, formattedProfessionals);
        if (found.length > 0) {
          responseMsg = `📋 *Profissionais de ${aiResult.entities.specialty}:*\n\n`;
          for (const prof of found) {
            const scheduleText = formatProfessionalSchedule(prof.schedule as any);
            responseMsg += `👨‍⚕️ *${prof.name}*\n${scheduleText}\n\n`;
          }
        } else {
          responseMsg = `❌ Não encontrei profissionais dessa especialidade.\n\n*Profissionais disponíveis:*\n${formattedProfessionals.map((p: any, i: number) => `${i + 1}. ${p.name} - ${p.specialty}`).join('\n')}`;
        }
      }
      // List all professionals
      else {
        responseMsg = `📋 *Nossos Profissionais e Horários:*\n\n`;
        for (const prof of formattedProfessionals.slice(0, 5)) { // Limit to 5 to avoid too long message
          const scheduleText = formatProfessionalSchedule(prof.schedule as any);
          responseMsg += `👨‍⚕️ *${prof.name}* (${prof.specialty})\n${scheduleText}\n\n`;
        }
        if (formattedProfessionals.length > 5) {
          responseMsg += `_...e mais ${formattedProfessionals.length - 5} profissional(is)._\n`;
        }
      }

      responseMsg += '\n💡 Para *agendar* uma consulta, me informe seu CPF.';
      
      await sendWhatsAppMessage(config, phone, responseMsg);
      return { handled: true, newState: session.state };
    }

    // Handle greeting or schedule intent at WAITING_CPF state - respond friendly and ask for CPF
    if (session.state === 'WAITING_CPF' || session.state === 'INIT') {
      if (aiResult.intent === 'schedule' || aiResult.intent === 'help' || aiResult.intent === 'unknown') {
        // Use AI's friendly response if available, otherwise use default welcome
        const friendlyIntro = aiResult.friendly_response || 
          '👋 Olá! Que bom ter você aqui! Sou o assistente virtual de agendamentos.';
        
        const msg = `${friendlyIntro}\n\n` +
          '📋 Para agendar, cancelar ou consultar suas consultas, preciso primeiro confirmar sua identidade.\n\n' +
          MESSAGES.hintCpf;
        
        await updateSession(supabase, session.id, { state: 'WAITING_CPF' });
        await sendWhatsAppMessage(config, phone, msg);
        return { handled: true, newState: 'WAITING_CPF' };
      }
    }

    // Handle confirm/deny intents for confirmation states
    if (aiResult.intent === 'confirm' && ['CONFIRM_IDENTITY', 'CONFIRM_APPOINTMENT', 'CONFIRM_CANCEL', 'CONFIRM_RESCHEDULE'].includes(session.state)) {
      return await handleStateWithConfirm(supabase, config, phone, session);
    }
    
    if (aiResult.intent === 'deny' && ['CONFIRM_IDENTITY', 'CONFIRM_APPOINTMENT', 'CONFIRM_CANCEL', 'CONFIRM_RESCHEDULE'].includes(session.state)) {
      return await handleStateWithDeny(supabase, config, phone, session);
    }

    // Handle main menu navigation intents from any state after identity confirmed
    if (session.patient_id && aiResult.intent === 'schedule') {
      console.log('[booking] AI detected schedule intent');
      return await navigateToSchedule(supabase, config, phone, session);
    }
    
    if (session.patient_id && aiResult.intent === 'cancel') {
      console.log('[booking] AI detected cancel intent');
      return await navigateToCancel(supabase, config, phone, session);
    }
    
    if (session.patient_id && aiResult.intent === 'reschedule') {
      console.log('[booking] AI detected reschedule intent');
      return await navigateToReschedule(supabase, config, phone, session);
    }
    
    if (session.patient_id && aiResult.intent === 'list') {
      console.log('[booking] AI detected list intent');
      return await navigateToList(supabase, config, phone, session);
    }
  }

  // Handle based on current state (fallback to existing logic)
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

    case 'SELECT_BOOKING_FOR':
      return await handleSelectBookingFor(supabase, config, phone, messageText, session);
    
    case 'SELECT_PROFESSIONAL':
      return await handleSelectProfessional(supabase, config, phone, messageText, session);

    case 'SELECT_PROCEDURE':
      return await handleSelectProcedure(supabase, config, phone, messageText, session);
    
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
// AI-DRIVEN NAVIGATION HELPERS
// ==========================================

async function handleStateWithConfirm(
  supabase: SupabaseClient,
  config: EvolutionConfig,
  phone: string,
  session: BookingSession
): Promise<{ handled: boolean; newState?: BookingState }> {
  switch (session.state) {
    case 'CONFIRM_IDENTITY':
      // Use the same logic as handleConfirmIdentity for consistency
      return await handleConfirmIdentity(supabase, config, phone, 'sim', session);
    case 'CONFIRM_APPOINTMENT':
      return await handleConfirmAppointment(supabase, config, phone, 'sim', session);
    case 'CONFIRM_CANCEL':
      return await handleConfirmCancel(supabase, config, phone, 'sim', session);
    case 'CONFIRM_RESCHEDULE':
      return await handleConfirmReschedule(supabase, config, phone, 'sim', session);
    default:
      return { handled: false };
  }
}

async function handleStateWithDeny(
  supabase: SupabaseClient,
  config: EvolutionConfig,
  phone: string,
  session: BookingSession
): Promise<{ handled: boolean; newState?: BookingState }> {
  switch (session.state) {
    case 'CONFIRM_IDENTITY':
      await updateSession(supabase, session.id, { state: 'FINISHED' });
      await sendWhatsAppMessage(config, phone, MESSAGES.identityDenied);
      return { handled: true, newState: 'FINISHED' };
    case 'CONFIRM_APPOINTMENT':
      return await handleConfirmAppointment(supabase, config, phone, 'não', session);
    case 'CONFIRM_CANCEL':
      return await handleConfirmCancel(supabase, config, phone, 'não', session);
    case 'CONFIRM_RESCHEDULE':
      return await handleConfirmReschedule(supabase, config, phone, 'não', session);
    default:
      return { handled: false };
  }
}

async function navigateToSchedule(
  supabase: SupabaseClient,
  config: EvolutionConfig,
  phone: string,
  session: BookingSession
): Promise<{ handled: boolean; newState?: BookingState }> {
  // Load professionals and navigate to SELECT_PROFESSIONAL
  const { data: professionals } = await supabase
    .from('professionals')
    .select('id, name, specialty')
    .eq('clinic_id', config.clinic_id)
    .eq('is_active', true)
    .order('name');

  const profList = (professionals || []) as Array<{ id: string; name: string; specialty: string | null }>;
  
  if (profList.length === 0) {
    await sendWhatsAppMessage(config, phone, '❌ Não há profissionais disponíveis no momento.');
    return { handled: true, newState: 'MAIN_MENU' };
  }

  await updateSession(supabase, session.id, {
    state: 'SELECT_PROFESSIONAL',
    available_professionals: profList.map((p) => ({
      id: p.id,
      name: p.name,
      specialty: p.specialty || '',
    })),
  });

  const mappedList = profList.map((p) => ({ name: p.name, specialty: p.specialty || '' }));
  await sendWhatsAppMessage(config, phone, MESSAGES.selectProfessional(mappedList) + MESSAGES.hintSelectOption + MESSAGES.hintMenu);
  return { handled: true, newState: 'SELECT_PROFESSIONAL' };
}

async function navigateToCancel(
  supabase: SupabaseClient,
  config: EvolutionConfig,
  phone: string,
  session: BookingSession
): Promise<{ handled: boolean; newState?: BookingState }> {
  const allAppointments = await fetchPatientAndDependentsAppointments(supabase, config.clinic_id, session.patient_id!, session.patient_name || 'Titular');

  if (allAppointments.length === 0) {
    await sendWhatsAppMessage(config, phone, MESSAGES.noAppointments);
    await updateSession(supabase, session.id, { state: 'MAIN_MENU' });
    return { handled: true, newState: 'MAIN_MENU' };
  }

  await updateSession(supabase, session.id, {
    state: 'LIST_APPOINTMENTS',
    appointments_list: allAppointments,
    list_action: 'cancel',
  });

  let msg = '📋 *Consultas agendadas:*\n\n';
  allAppointments.forEach((a, i) => {
    const whoLabel = a.dependent_name ? `👤 ${a.dependent_name}` : `👤 ${session.patient_name || 'Titular'}`;
    msg += `*${i + 1}.* ${formatDate(a.date)} às ${formatTime(a.time)}\n`;
    msg += `   👨‍⚕️ ${a.professional}\n`;
    msg += `   ${whoLabel}\n\n`;
  });
  msg += '\n_Qual consulta deseja cancelar?_';

  await sendWhatsAppMessage(config, phone, msg + MESSAGES.hintSelectOption + MESSAGES.hintMenu);
  return { handled: true, newState: 'LIST_APPOINTMENTS' };
}

async function navigateToReschedule(
  supabase: SupabaseClient,
  config: EvolutionConfig,
  phone: string,
  session: BookingSession
): Promise<{ handled: boolean; newState?: BookingState }> {
  const allAppointments = await fetchPatientAndDependentsAppointments(supabase, config.clinic_id, session.patient_id!, session.patient_name || 'Titular');

  if (allAppointments.length === 0) {
    await sendWhatsAppMessage(config, phone, MESSAGES.noAppointments);
    await updateSession(supabase, session.id, { state: 'MAIN_MENU' });
    return { handled: true, newState: 'MAIN_MENU' };
  }

  await updateSession(supabase, session.id, {
    state: 'LIST_APPOINTMENTS',
    appointments_list: allAppointments,
    list_action: 'reschedule',
  });

  let msg = '📋 *Consultas agendadas:*\n\n';
  allAppointments.forEach((a, i) => {
    const whoLabel = a.dependent_name ? `👤 ${a.dependent_name}` : `👤 ${session.patient_name || 'Titular'}`;
    msg += `*${i + 1}.* ${formatDate(a.date)} às ${formatTime(a.time)}\n`;
    msg += `   👨‍⚕️ ${a.professional}\n`;
    msg += `   ${whoLabel}\n\n`;
  });
  msg += '\n_Qual consulta deseja reagendar?_';

  await sendWhatsAppMessage(config, phone, msg + MESSAGES.hintSelectOption + MESSAGES.hintMenu);
  return { handled: true, newState: 'LIST_APPOINTMENTS' };
}

async function navigateToList(
  supabase: SupabaseClient,
  config: EvolutionConfig,
  phone: string,
  session: BookingSession
): Promise<{ handled: boolean; newState?: BookingState }> {
  const allAppointments = await fetchPatientAndDependentsAppointments(supabase, config.clinic_id, session.patient_id!, session.patient_name || 'Titular');

  if (allAppointments.length === 0) {
    await sendWhatsAppMessage(config, phone, MESSAGES.noAppointments);
    await updateSession(supabase, session.id, { state: 'MAIN_MENU' });
    return { handled: true, newState: 'MAIN_MENU' };
  }

  let msg = '📋 *Suas consultas agendadas:*\n\n';
  allAppointments.forEach((a) => {
    const status = a.status === 'confirmed' ? '✅' : '📅';
    const whoLabel = a.dependent_name ? `👤 ${a.dependent_name}` : `👤 Você`;
    msg += `${status} *${formatDate(a.date)}* às *${formatTime(a.time)}*\n`;
    msg += `   👨‍⚕️ ${a.professional}\n`;
    if (a.procedure) msg += `   📋 ${a.procedure}\n`;
    msg += `   ${whoLabel}\n\n`;
  });

  await sendWhatsAppMessage(config, phone, msg + MESSAGES.mainMenu + MESSAGES.hintSelectOption);
  await updateSession(supabase, session.id, { state: 'MAIN_MENU' });
  return { handled: true, newState: 'MAIN_MENU' };
}

// Helper to fetch appointments for both titular and dependents
async function fetchPatientAndDependentsAppointments(
  supabase: SupabaseClient,
  clinicId: string,
  patientId: string,
  patientName: string
): Promise<Array<{ id: string; date: string; time: string; professional: string; professional_id?: string; procedure?: string; status: string; dependent_name?: string }>> {
  const now = new Date().toISOString();
  const todayStr = now.split('T')[0];

  // Fetch titular's appointments
  const { data: titularAppointments } = await supabase
    .from('appointments')
    .select(`
      id, appointment_date, start_time, status, dependent_id,
      professional:professionals!inner(id, name),
      procedure:procedures(name)
    `)
    .eq('patient_id', patientId)
    .eq('clinic_id', clinicId)
    .is('dependent_id', null)
    .gte('appointment_date', todayStr)
    .in('status', ['scheduled', 'confirmed'])
    .order('appointment_date')
    .order('start_time');

  // Fetch dependents
  const { data: dependents } = await supabase
    .from('patient_dependents')
    .select('id, name')
    .eq('patient_id', patientId)
    .eq('clinic_id', clinicId)
    .eq('is_active', true);

  const dependentList = (dependents || []) as Array<{ id: string; name: string }>;
  const dependentIds = dependentList.map((d) => d.id);
  const dependentMap = new Map(dependentList.map((d) => [d.id, d.name]));

  // Fetch dependents' appointments
  let dependentAppointments: any[] = [];
  if (dependentIds.length > 0) {
    const { data: depAppts } = await supabase
      .from('appointments')
      .select(`
        id, appointment_date, start_time, status, dependent_id,
        professional:professionals!inner(id, name),
        procedure:procedures(name)
      `)
      .eq('clinic_id', clinicId)
      .in('dependent_id', dependentIds)
      .gte('appointment_date', todayStr)
      .in('status', ['scheduled', 'confirmed'])
      .order('appointment_date')
      .order('start_time');

    dependentAppointments = depAppts || [];
  }

  const result: Array<{ id: string; date: string; time: string; professional: string; professional_id?: string; procedure?: string; status: string; dependent_name?: string }> = [];

  // Map titular appointments
  for (const a of (titularAppointments || []) as any[]) {
    result.push({
      id: a.id,
      date: a.appointment_date,
      time: a.start_time,
      professional: a.professional?.name || 'Profissional',
      professional_id: a.professional?.id,
      procedure: a.procedure?.name,
      status: a.status,
      dependent_name: undefined,
    });
  }

  // Map dependent appointments
  for (const a of dependentAppointments) {
    result.push({
      id: a.id,
      date: a.appointment_date,
      time: a.start_time,
      professional: a.professional?.name || 'Profissional',
      professional_id: a.professional?.id,
      procedure: a.procedure?.name,
      status: a.status,
      dependent_name: dependentMap.get(a.dependent_id) || 'Dependente',
    });
  }

  // Sort by date+time
  result.sort((x, y) => {
    const dateA = `${x.date} ${x.time}`;
    const dateB = `${y.date} ${y.time}`;
    return dateA.localeCompare(dateB);
  });

  return result;
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

  // Fetch clinic name for messages
  const { data: clinicInfo } = await supabase
    .from('clinics')
    .select('name')
    .eq('id', config.clinic_id)
    .single();
  const clinicName = clinicInfo?.name || 'a clínica';
  
  // First, try to find a titular patient by CPF
  const { data: patient, error } = await supabase
    .from('patients')
    .select('id, name, cpf, is_active, inactivation_reason')
    .eq('clinic_id', config.clinic_id)
    .eq('cpf', cleanCpf)
    .maybeSingle();

  if (error) {
    console.error('[booking] Error searching patient:', error);
    await sendWhatsAppMessage(config, phone, MESSAGES.error);
    return { handled: true, newState: 'WAITING_CPF' };
  }

  let patientData = patient as PatientRecord | null;

  // Check if patient is inactive
  if (patientData && patientData.is_active === false) {
    console.log(`[booking] Patient ${patientData.id} is inactive. Reason: ${patientData.inactivation_reason}`);
    await sendWhatsAppMessage(config, phone, MESSAGES.patientInactive(clinicName, patientData.inactivation_reason));
    return { handled: true, newState: 'FINISHED' };
  }

  // If no patient found by CPF, check if it's a dependent's CPF
  if (!patientData) {
    const { data: dependentByCpf } = await supabase
      .from('patient_dependents')
      .select('id, name, cpf, patient_id, card_expires_at, relationship')
      .eq('clinic_id', config.clinic_id)
      .eq('cpf', cleanCpf)
      .eq('is_active', true)
      .maybeSingle();

    if (dependentByCpf) {
      console.log(`[booking] Found dependent by CPF: ${dependentByCpf.name} (${dependentByCpf.id})`);
      
      // Check if dependent's card is expired
      if (dependentByCpf.card_expires_at) {
        const expiryDate = new Date(dependentByCpf.card_expires_at);
        if (expiryDate < new Date()) {
          const formattedExpiry = expiryDate.toLocaleDateString('pt-BR');
          await sendWhatsAppMessage(config, phone, MESSAGES.dependentCardExpired(dependentByCpf.name, formattedExpiry));
          return { handled: true, newState: 'WAITING_CPF' };
        }
      }
      
      // Get the titular patient info
      const { data: titularPatient } = await supabase
        .from('patients')
        .select('id, name, is_active, inactivation_reason')
        .eq('id', dependentByCpf.patient_id)
        .maybeSingle();

      if (!titularPatient) {
        await sendWhatsAppMessage(config, phone, MESSAGES.patientNotFound);
        return { handled: true, newState: 'WAITING_CPF' };
      }

      // Check if titular patient is inactive
      if (titularPatient.is_active === false) {
        console.log(`[booking] Titular patient ${titularPatient.id} is inactive. Dependent cannot book.`);
        await sendWhatsAppMessage(config, phone, MESSAGES.patientInactive(clinicName, titularPatient.inactivation_reason));
        return { handled: true, newState: 'FINISHED' };
      }

      // For dependent direct booking, we set the session to book directly for the dependent
      await updateSession(supabase, session.id, {
        state: 'CONFIRM_IDENTITY',
        patient_id: titularPatient.id,
        patient_name: titularPatient.name,
        selected_dependent_id: dependentByCpf.id,
        selected_dependent_name: dependentByCpf.name,
        booking_for: 'dependent',
        is_dependent_direct_booking: true,
        available_dependents: null, // No need to show dependent selection
      });

      // Send interactive buttons for dependent identity confirmation
      await sendWhatsAppButtons(
        config,
        phone,
        '🔐 Confirmação',
        `Encontramos o cadastro em nome de *${dependentByCpf.name}*.\n\nConfirma que é você?`,
        [
          { id: 'confirm_yes', text: '✅ Sim, sou eu' },
          { id: 'confirm_no', text: '❌ Não sou eu' }
        ],
        'Responda 1 ou 2'
      );

      return { handled: true, newState: 'CONFIRM_IDENTITY' };
    }
  }

  // If still no patient, try by phone
  if (!patientData) {
    const { data: patientByPhone } = await supabase
      .from('patients')
      .select('id, name, cpf, is_active, inactivation_reason')
      .eq('clinic_id', config.clinic_id)
      .in('phone', phoneCandidates)
      .maybeSingle();

    patientData = patientByPhone as PatientRecord | null;

    if (!patientData) {
      await sendWhatsAppMessage(config, phone, MESSAGES.patientNotFound);
      return { handled: true, newState: 'WAITING_CPF' };
    }

    // Check if patient found by phone is inactive
    if (patientData.is_active === false) {
      console.log(`[booking] Patient ${patientData.id} (by phone) is inactive. Reason: ${patientData.inactivation_reason}`);
      await sendWhatsAppMessage(config, phone, MESSAGES.patientInactive(clinicName, patientData.inactivation_reason));
      return { handled: true, newState: 'FINISHED' };
    }
  }

  // Fetch patient's dependents (for titular flow)
  const { data: dependents } = await supabase
    .from('patient_dependents')
    .select('id, name, relationship, card_expires_at')
    .eq('patient_id', patientData.id)
    .eq('is_active', true)
    .order('name');

  const dependentsData = (dependents || []) as Array<{ id: string; name: string; relationship: string | null; card_expires_at: string | null }>;
  console.log(`[booking] Found ${dependentsData.length} dependents for patient ${patientData.id}`);

  await updateSession(supabase, session.id, {
    state: 'CONFIRM_IDENTITY',
    patient_id: patientData.id,
    patient_name: patientData.name,
    available_dependents: dependentsData.length > 0 ? dependentsData : null,
    is_dependent_direct_booking: false,
  });

  // Send interactive buttons for identity confirmation
  await sendWhatsAppButtons(
    config,
    phone,
    '🔐 Confirmação',
    `Encontramos o cadastro em nome de *${patientData.name}*.\n\nConfirma que é você?`,
    [
      { id: 'confirm_yes', text: '✅ Sim, sou eu' },
      { id: 'confirm_no', text: '❌ Não sou eu' }
    ],
    'Responda 1 ou 2'
  );

  return { handled: true, newState: 'CONFIRM_IDENTITY' };
}

async function handleConfirmIdentity(
  supabase: SupabaseClient,
  config: EvolutionConfig,
  phone: string,
  messageText: string,
  session: BookingSession
): Promise<{ handled: boolean; newState?: BookingState }> {
  // Helper to proceed after identity confirmation
  const proceedAfterConfirmation = async (): Promise<{ handled: boolean; newState?: BookingState }> => {
    // If dependent logged in directly with their CPF, go straight to professional selection
    if (session.is_dependent_direct_booking && session.selected_dependent_id && session.selected_dependent_name) {
      console.log(`[booking] Dependent direct booking for ${session.selected_dependent_name}`);
      return await proceedToSelectProfessional(
        supabase,
        config,
        phone,
        session,
        'dependent',
        session.selected_dependent_id,
        session.selected_dependent_name
      );
    }
    
    // If patient has dependents (titular flow), ask who the appointment is for
    if (session.available_dependents && session.available_dependents.length > 0) {
      await updateSession(supabase, session.id, {
        state: 'SELECT_BOOKING_FOR',
        action_type: 'new',
      });
      await sendWhatsAppMessage(config, phone, MESSAGES.selectBookingFor(session.patient_name || '', session.available_dependents));
      return { handled: true, newState: 'SELECT_BOOKING_FOR' };
    }
    
    // No dependents - go to main menu with interactive buttons
    await updateSession(supabase, session.id, { state: 'MAIN_MENU' });
    await sendMainMenuButtons(config, phone, session.patient_name || 'Paciente');
    return { handled: true, newState: 'MAIN_MENU' };
  };

  // Check for interactive button response first
  if (messageText === 'confirm_yes' || messageText.toLowerCase() === 'sim, sou eu' || messageText.toLowerCase() === '✅ sim, sou eu') {
    return await proceedAfterConfirmation();
  }
  
  if (messageText === 'confirm_no' || messageText.toLowerCase() === 'não sou eu' || messageText.toLowerCase() === '❌ não sou eu') {
    await updateSession(supabase, session.id, { state: 'FINISHED' });
    await sendWhatsAppMessage(config, phone, MESSAGES.identityDenied);
    return { handled: true, newState: 'FINISHED' };
  }

  // Try regex patterns
  if (POSITIVE_REGEX.test(messageText)) {
    return await proceedAfterConfirmation();
  }

  if (NEGATIVE_REGEX.test(messageText)) {
    await updateSession(supabase, session.id, { state: 'FINISHED' });
    await sendWhatsAppMessage(config, phone, MESSAGES.identityDenied);
    return { handled: true, newState: 'FINISHED' };
  }

  // Try AI for natural language confirmation
  const aiResult = await getAIIntent(messageText, 'CONFIRM_IDENTITY');
  console.log('[identity] AI result:', aiResult);

  if (aiResult.confidence >= 0.7) {
    if (aiResult.intent === 'confirm') {
      return await proceedAfterConfirmation();
    }
    if (aiResult.intent === 'deny') {
      await updateSession(supabase, session.id, { state: 'FINISHED' });
      await sendWhatsAppMessage(config, phone, MESSAGES.identityDenied);
      return { handled: true, newState: 'FINISHED' };
    }
  }

  // Re-send buttons if user didn't respond correctly
  await sendWhatsAppButtons(
    config,
    phone,
    '🔐 Confirmação',
    `Por favor, confirme sua identidade clicando no botão abaixo:`,
    [
      { id: 'confirm_yes', text: '✅ Sim, sou eu' },
      { id: 'confirm_no', text: '❌ Não sou eu' }
    ]
  );
  return { handled: true, newState: 'CONFIRM_IDENTITY' };
}

// Helper to send main menu with interactive buttons
async function sendMainMenuButtons(
  config: EvolutionConfig,
  phone: string,
  patientName: string
): Promise<boolean> {
  return await sendWhatsAppButtons(
    config,
    phone,
    '📋 Menu Principal',
    `Olá, *${patientName}*! 👋\n\nO que você gostaria de fazer?`,
    [
      { id: 'menu_schedule', text: '📅 Agendar' },
      { id: 'menu_cancel', text: '❌ Cancelar' },
      { id: 'menu_list', text: '📋 Minhas consultas' }
    ],
    'Escolha uma opção'
  );
}

// ==========================================
// HELPER: PROCEED TO SELECT PROFESSIONAL
// ==========================================

async function proceedToSelectProfessional(
  supabase: SupabaseClient,
  config: EvolutionConfig,
  phone: string,
  session: BookingSession,
  bookingFor: 'titular' | 'dependent',
  dependentId: string | null,
  dependentName: string | null
): Promise<{ handled: boolean; newState?: BookingState }> {
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
    booking_for: bookingFor,
    selected_dependent_id: dependentId,
    selected_dependent_name: dependentName,
  });

  const forWhom = dependentName ? ` para *${dependentName}*` : '';
  await sendWhatsAppMessage(config, phone, `Agendando${forWhom}! 😊\n\n` + MESSAGES.selectProfessional(profList) + MESSAGES.hintSelectOption + MESSAGES.hintMenu);
  return { handled: true, newState: 'SELECT_PROFESSIONAL' };
}

// ==========================================
// SELECT BOOKING FOR HANDLER (TITULAR OR DEPENDENT)
// ==========================================

async function handleSelectBookingFor(
  supabase: SupabaseClient,
  config: EvolutionConfig,
  phone: string,
  messageText: string,
  session: BookingSession
): Promise<{ handled: boolean; newState?: BookingState }> {
  const choice = parseInt(messageText.trim());
  const dependents = session.available_dependents || [];
  const totalOptions = 2 + dependents.length; // 1 = titular + dependents + 1 = menu option

  if (isNaN(choice) || choice < 1 || choice > totalOptions) {
    await sendWhatsAppMessage(config, phone, MESSAGES.invalidOption + MESSAGES.hintSelectOption);
    return { handled: true, newState: 'SELECT_BOOKING_FOR' };
  }

  // Option 1 = Titular
  if (choice === 1) {
    return await proceedToSelectProfessional(supabase, config, phone, session, 'titular', null, null);
  }

  // Last option = Go to main menu
  if (choice === totalOptions) {
    await updateSession(supabase, session.id, { state: 'MAIN_MENU' });
    await sendWhatsAppMessage(config, phone, MESSAGES.mainMenu + MESSAGES.hintSelectOption);
    return { handled: true, newState: 'MAIN_MENU' };
  }

  // Options 2 to (totalOptions - 1) = Dependents
  const dependentIndex = choice - 2;
  const selectedDependent = dependents[dependentIndex];

  if (!selectedDependent) {
    await sendWhatsAppMessage(config, phone, MESSAGES.invalidOption + MESSAGES.hintSelectOption);
    return { handled: true, newState: 'SELECT_BOOKING_FOR' };
  }

  // Check if dependent's card is expired
  if (selectedDependent.card_expires_at) {
    const expiryDate = new Date(selectedDependent.card_expires_at);
    if (expiryDate < new Date()) {
      const formattedExpiry = expiryDate.toLocaleDateString('pt-BR');
      await sendWhatsAppMessage(config, phone, MESSAGES.dependentCardExpired(selectedDependent.name, formattedExpiry));
      
      // Return to booking for selection with a gentler prompt
      setTimeout(async () => {
        await sendWhatsAppMessage(config, phone, `Quer agendar para outra pessoa?\n\n` + MESSAGES.selectBookingFor(session.patient_name || '', dependents));
      }, 1000);
      return { handled: true, newState: 'SELECT_BOOKING_FOR' };
    }
  }

  console.log(`[booking] Selected dependent: ${selectedDependent.name} (${selectedDependent.id})`);

  return await proceedToSelectProfessional(
    supabase, 
    config, 
    phone, 
    session, 
    'dependent', 
    selectedDependent.id, 
    selectedDependent.name
  );
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
  const choice = messageText.trim().toLowerCase();

  // Try AI intent extraction for natural language
  let intent: 'schedule' | 'cancel' | 'reschedule' | 'list' | null = null;
  
  // Check for interactive button responses first
  if (choice === 'menu_schedule' || choice === '📅 agendar' || choice === 'agendar') {
    intent = 'schedule';
  } else if (choice === 'menu_cancel' || choice === '❌ cancelar' || choice === 'cancelar') {
    intent = 'cancel';
  } else if (choice === 'menu_reschedule' || choice === 'reagendar') {
    intent = 'reschedule';
  } else if (choice === 'menu_list' || choice === '📋 minhas consultas' || choice === 'minhas consultas' || choice === 'listar') {
    intent = 'list';
  }
  // Then check traditional numeric patterns
  else if (choice === '1') {
    intent = 'schedule';
  } else if (choice === '2') {
    intent = 'cancel';
  } else if (choice === '3') {
    intent = 'reschedule';
  } else if (choice === '4') {
    intent = 'list';
  } else {
    // Try AI for natural language
    const aiResult = await getAIIntent(messageText, 'MAIN_MENU');
    console.log('[menu] AI result:', aiResult);
    
    if (aiResult.confidence >= 0.7) {
      if (aiResult.intent === 'schedule') intent = 'schedule';
      else if (aiResult.intent === 'cancel') intent = 'cancel';
      else if (aiResult.intent === 'reschedule') intent = 'reschedule';
      else if (aiResult.intent === 'list') intent = 'list';
      else if (aiResult.intent === 'select_option' && aiResult.entities.option_number) {
        const num = aiResult.entities.option_number;
        if (num === 1) intent = 'schedule';
        else if (num === 2) intent = 'cancel';
        else if (num === 3) intent = 'reschedule';
        else if (num === 4) intent = 'list';
      }
    }
  }

  // Handle schedule intent
  if (intent === 'schedule') {
    // Check if patient has dependents - ask who the appointment is for
    if (session.available_dependents && session.available_dependents.length > 0) {
      await updateSession(supabase, session.id, {
        state: 'SELECT_BOOKING_FOR',
        action_type: 'new',
      });
      await sendWhatsAppMessage(config, phone, MESSAGES.selectBookingFor(session.patient_name || '', session.available_dependents));
      return { handled: true, newState: 'SELECT_BOOKING_FOR' };
    }

    // No dependents - go directly to professional selection
    return await proceedToSelectProfessional(supabase, config, phone, session, 'titular', null, null);
  }

  // Handle cancel intent - use navigateToCancel for consistency
  if (intent === 'cancel') {
    return await navigateToCancel(supabase, config, phone, session);
  }

  // Handle reschedule intent - use navigateToReschedule for consistency
  if (intent === 'reschedule') {
    return await navigateToReschedule(supabase, config, phone, session);
  }

  // Handle list intent - just view appointments (no action)
  if (intent === 'list') {
    return await navigateToList(supabase, config, phone, session);
  }

  // Fallback - didn't understand
  await sendWhatsAppMessage(config, phone, 
    `Não entendi. Por favor, escolha uma opção:\n\n1️⃣ Agendar\n2️⃣ Cancelar\n3️⃣ Reagendar\n4️⃣ Ver consultas\n\n_Ou diga o que deseja fazer (ex: "quero marcar consulta")_` + MESSAGES.hintMenu
  );
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
  // Use appointments_list (new) or pending_appointments (legacy fallback)
  const appointments = session.appointments_list || session.pending_appointments || [];

  if (isNaN(choice) || choice < 1 || choice > appointments.length) {
    await sendWhatsAppMessage(config, phone, MESSAGES.invalidOption + MESSAGES.hintSelectOption);
    return { handled: true, newState: 'LIST_APPOINTMENTS' };
  }

  const selected = appointments[choice - 1];

  await updateSession(supabase, session.id, {
    selected_appointment_id: selected.id,
  });

  // Use list_action (new) or action_type (legacy fallback)
  const actionType = session.list_action || session.action_type;
  
  if (actionType === 'cancel') {
    await updateSession(supabase, session.id, { state: 'CONFIRM_CANCEL' });
    await sendWhatsAppMessage(config, phone, MESSAGES.confirmCancel({
      date: selected.date,
      time: selected.time,
      professional: selected.professional,
    }) + MESSAGES.hintYesNo);
    return { handled: true, newState: 'CONFIRM_CANCEL' };
  }

  if (actionType === 'reschedule') {
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
      await sendWhatsAppMessage(config, phone, MESSAGES.noDates(selected.professional));
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
  const choice = messageText.trim().toLowerCase();
  
  // Check for interactive button response first
  const isConfirm = choice === 'cancel_confirm' || choice === '✅ sim, cancelar' || POSITIVE_REGEX.test(messageText);
  const isDeny = choice === 'cancel_deny' || choice === '❌ não cancelar' || NEGATIVE_REGEX.test(messageText);
  
  if (isConfirm) {
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

  if (isDeny) {
    await updateSession(supabase, session.id, { state: 'MAIN_MENU' });
    await sendMainMenuButtons(config, phone, session.patient_name || 'Paciente');
    return { handled: true, newState: 'MAIN_MENU' };
  }

  // Re-send buttons if user didn't respond correctly
  await sendWhatsAppButtons(
    config,
    phone,
    '⚠️ Confirmar cancelamento',
    `Deseja realmente cancelar esta consulta?`,
    [
      { id: 'cancel_confirm', text: '✅ Sim, cancelar' },
      { id: 'cancel_deny', text: '❌ Não cancelar' }
    ]
  );
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
    await sendWhatsAppMessage(config, phone, MESSAGES.noTimes(selected.formatted, session.selected_professional_name || undefined));
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
  const professionals = session.available_professionals || [];
  let selected: { id: string; name: string; specialty: string } | null = null;

  // First try numeric selection
  const numericChoice = parseInt(messageText.trim());
  if (!isNaN(numericChoice) && numericChoice >= 1 && numericChoice <= professionals.length) {
    selected = professionals[numericChoice - 1];
  }

  // If not numeric, try AI to extract professional name
  if (!selected) {
    const aiResult = await getAIIntent(
      messageText, 
      'SELECT_PROFESSIONAL',
      professionals
    );
    console.log('[professional] AI result:', aiResult);

    if (aiResult.confidence >= 0.6) {
      // Try to match by name
      if (aiResult.entities.professional_name) {
        selected = findProfessionalByName(aiResult.entities.professional_name, professionals);
      }
      // Try option number from AI
      if (!selected && aiResult.intent === 'select_option' && aiResult.entities.option_number) {
        const num = aiResult.entities.option_number;
        if (num >= 1 && num <= professionals.length) {
          selected = professionals[num - 1];
        }
      }
    }
  }

  if (!selected) {
    await sendWhatsAppMessage(config, phone, 
      `Não encontrei o profissional. Por favor, escolha pelo *número* ou digite o *nome*:\n\n${
        professionals.map((p, i) => `${i + 1}️⃣ ${p.name}`).join('\n')
      }` + MESSAGES.hintMenu
    );
    return { handled: true, newState: 'SELECT_PROFESSIONAL' };
  }

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

  // Check for expired patient card
  const { data: cardCheck } = await supabase.rpc('is_patient_card_valid', {
    p_patient_id: session.patient_id,
    p_clinic_id: config.clinic_id
  });

  if (cardCheck && cardCheck[0] && cardCheck[0].card_number && !cardCheck[0].is_valid) {
    await sendWhatsAppMessage(config, phone, 
      `❌ Sua carteirinha (${cardCheck[0].card_number}) está vencida.\n\nPor favor, renove sua carteirinha para agendar consultas.`
    );
    await updateSession(supabase, session.id, { state: 'FINISHED' });
    return { handled: true, newState: 'FINISHED' };
  }

  // Check if professional has multiple procedures configured
  const { data: professionalProcedures } = await supabase
    .from('professional_procedures')
    .select('procedure_id, procedures(id, name, duration)')
    .eq('professional_id', selected.id);

  const procedures = (professionalProcedures || [])
    .map((pp: any) => pp.procedures)
    .filter((p: any) => p !== null);

  console.log(`[booking] Professional ${selected.name} has ${procedures.length} procedures`);

  // If professional has more than 1 procedure, ask which one
  if (procedures.length > 1) {
    const procedureList = procedures.map((p: any) => ({
      id: p.id,
      name: p.name,
      duration: p.duration
    }));

    await updateSession(supabase, session.id, {
      state: 'SELECT_PROCEDURE',
      selected_professional_id: selected.id,
      selected_professional_name: selected.name,
      available_procedures: procedureList,
    });

    await sendWhatsAppMessage(config, phone, `✅ Selecionado: *Dr(a). ${selected.name}*\n\n` + MESSAGES.selectProcedure(selected.name, procedureList) + MESSAGES.hintSelectOption + MESSAGES.hintMenu);
    return { handled: true, newState: 'SELECT_PROCEDURE' };
  }

  // If only 1 procedure, auto-select it
  const selectedProcedure = procedures.length === 1 ? procedures[0] : null;

  const availableDates = await getAvailableDates(supabase, config.clinic_id, selected.id);

  if (availableDates.length === 0) {
    await sendWhatsAppMessage(config, phone, MESSAGES.noDates(selected.name));
    return { handled: true, newState: 'SELECT_PROFESSIONAL' };
  }

  await updateSession(supabase, session.id, {
    state: 'SELECT_DATE',
    selected_professional_id: selected.id,
    selected_professional_name: selected.name,
    selected_procedure_id: selectedProcedure?.id || null,
    available_dates: availableDates,
  });

  await sendWhatsAppMessage(config, phone, `✅ Selecionado: *Dr(a). ${selected.name}*\n\nAgora escolha a data:`);
  await sendWhatsAppMessage(config, phone, MESSAGES.selectDate(availableDates) + MESSAGES.hintSelectOption + MESSAGES.hintMenu);
  return { handled: true, newState: 'SELECT_DATE' };
}

// ==========================================
// SELECT PROCEDURE HANDLER
// ==========================================

async function handleSelectProcedure(
  supabase: SupabaseClient,
  config: EvolutionConfig,
  phone: string,
  messageText: string,
  session: BookingSession
): Promise<{ handled: boolean; newState?: BookingState }> {
  const procedures = session.available_procedures || [];

  // Numeric selection
  const choice = parseInt(messageText.trim());
  
  if (isNaN(choice) || choice < 1 || choice > procedures.length) {
    await sendWhatsAppMessage(config, phone, 
      `Por favor, escolha pelo *número* do procedimento:\n\n${
        procedures.map((p, i) => `${i + 1}️⃣ ${p.name}`).join('\n')
      }` + MESSAGES.hintMenu
    );
    return { handled: true, newState: 'SELECT_PROCEDURE' };
  }

  const selected = procedures[choice - 1];
  console.log(`[booking] Selected procedure: ${selected.name} (${selected.id})`);

  const availableDates = await getAvailableDates(supabase, config.clinic_id, session.selected_professional_id!);

  if (availableDates.length === 0) {
    await sendWhatsAppMessage(config, phone, MESSAGES.noDates(session.selected_professional_name || undefined));
    return { handled: true, newState: 'SELECT_PROFESSIONAL' };
  }

  await updateSession(supabase, session.id, {
    state: 'SELECT_DATE',
    selected_procedure_id: selected.id,
    available_dates: availableDates,
  });

  await sendWhatsAppMessage(config, phone, `✅ Procedimento: *${selected.name}*\n\nAgora escolha a data:`);
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
  const dates = session.available_dates || [];

  // 1) Numeric selection
  let choice = parseInt(messageText.trim());

  // 2) Natural language via AI (e.g. "amanhã", "quarta", "dia 15")
  if (isNaN(choice) && dates.length > 0) {
    const aiResult = await getAIIntent(
      messageText,
      'SELECT_DATE',
      undefined,
      dates
    );
    console.log('[date] AI result:', aiResult);

    if (aiResult.confidence >= 0.6) {
      if (typeof aiResult.entities?.option_number === 'number') {
        choice = aiResult.entities.option_number;
      } else if (aiResult.entities?.date) {
        const raw = aiResult.entities.date.trim();
        // If AI returns ISO date, match directly
        const isoMatch = raw.match(/^\d{4}-\d{2}-\d{2}$/);
        if (isoMatch) {
          const idx = dates.findIndex((d) => d.date === raw);
          if (idx >= 0) choice = idx + 1;
        }
      }
    }
  }

  if (isNaN(choice) || choice < 1 || choice > dates.length) {
    await sendWhatsAppMessage(
      config,
      phone,
      MESSAGES.invalidOption +
        MESSAGES.hintSelectOption +
        "\n\n_Se preferir, você pode escrever a data (ex: 'amanhã', 'quarta')._"
    );
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
    await sendWhatsAppMessage(config, phone, MESSAGES.noTimes(selected.formatted, session.selected_professional_name || undefined));
    return { handled: true, newState: 'SELECT_DATE' };
  }

  await updateSession(supabase, session.id, {
    state: 'SELECT_TIME',
    selected_date: selected.date,
    available_times: availableTimes,
  });

  await sendWhatsAppMessage(
    config,
    phone,
    MESSAGES.selectTime(availableTimes) + MESSAGES.hintSelectOption + MESSAGES.hintMenu
  );
  return { handled: true, newState: 'SELECT_TIME' };
}

async function handleSelectTime(
  supabase: SupabaseClient,
  config: EvolutionConfig,
  phone: string,
  messageText: string,
  session: BookingSession
): Promise<{ handled: boolean; newState?: BookingState }> {
  const times = session.available_times || [];

  // 1) Numeric selection
  let choice = parseInt(messageText.trim());

  // 2) Natural language via AI (e.g. "14h", "duas da tarde")
  if (isNaN(choice) && times.length > 0) {
    const aiResult = await getAIIntent(
      messageText,
      'SELECT_TIME',
      undefined,
      undefined,
      times
    );
    console.log('[time] AI result:', aiResult);

    if (aiResult.confidence >= 0.6) {
      if (typeof aiResult.entities?.option_number === 'number') {
        choice = aiResult.entities.option_number;
      } else if (aiResult.entities?.time) {
        const raw = aiResult.entities.time.trim().toLowerCase();
        const m1 = raw.match(/^(\d{1,2})(?::(\d{2}))?$/);
        const m2 = raw.match(/^(\d{1,2})h(?:(\d{2}))?$/);
        const hh = m1?.[1] ?? m2?.[1];
        const mm = m1?.[2] ?? m2?.[2] ?? '00';
        if (hh) {
          const normalized = `${String(parseInt(hh)).padStart(2, '0')}:${mm}`;
          const idx = times.findIndex((t) => t.time.startsWith(normalized));
          if (idx >= 0) choice = idx + 1;
        }
      }
    }
  }

  if (isNaN(choice) || choice < 1 || choice > times.length) {
    await sendWhatsAppMessage(
      config,
      phone,
      MESSAGES.invalidOption +
        MESSAGES.hintSelectOption +
        "\n\n_Se preferir, você pode escrever o horário (ex: '14h', '10:30')._"
    );
    return { handled: true, newState: 'SELECT_TIME' };
  }

  const selected = times[choice - 1];

  await updateSession(supabase, session.id, {
    state: 'CONFIRM_APPOINTMENT',
    selected_time: selected.time,
  });

  // Show patient or dependent name in confirmation message
  const displayName = session.booking_for === 'dependent' && session.selected_dependent_name
    ? session.selected_dependent_name
    : session.patient_name || '';

  // Send confirmation with interactive buttons
  await sendWhatsAppButtons(
    config,
    phone,
    '✅ Confirmar Agendamento',
    `👤 Paciente: *${displayName}*\n👨‍⚕️ Profissional: *Dr(a). ${session.selected_professional_name}*\n📅 Data: *${formatDate(session.selected_date!)}*\n⏰ Horário: *${selected.formatted}*\n\nConfirma este agendamento?`,
    [
      { id: 'appt_confirm', text: '✅ Confirmar' },
      { id: 'appt_cancel', text: '❌ Cancelar' }
    ],
    'Clique para confirmar'
  );

  return { handled: true, newState: 'CONFIRM_APPOINTMENT' };
}

async function handleConfirmAppointment(
  supabase: SupabaseClient,
  config: EvolutionConfig,
  phone: string,
  messageText: string,
  session: BookingSession
): Promise<{ handled: boolean; newState?: BookingState }> {
  const choice = messageText.trim().toLowerCase();
  
  // Check for interactive button response first
  const isConfirm = choice === 'appt_confirm' || choice === '✅ confirmar' || POSITIVE_REGEX.test(messageText);
  const isDeny = choice === 'appt_cancel' || choice === '❌ cancelar' || NEGATIVE_REGEX.test(messageText);
  
  if (isDeny) {
    await updateSession(supabase, session.id, { state: 'FINISHED' });
    await sendWhatsAppMessage(config, phone, MESSAGES.appointmentCancelled);
    return { handled: true, newState: 'FINISHED' };
  }

  if (!isConfirm) {
    // Re-send buttons if user didn't respond correctly
    await sendWhatsAppButtons(
      config,
      phone,
      '✅ Confirmar Agendamento',
      `Por favor, confirme o agendamento clicando no botão:`,
      [
        { id: 'appt_confirm', text: '✅ Confirmar' },
        { id: 'appt_cancel', text: '❌ Cancelar' }
      ]
    );
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
      await sendWhatsAppMessage(config, phone, MESSAGES.noTimes(session.selected_date || undefined, session.selected_professional_name || undefined));
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

  // Build appointment data - include dependent_id if booking for dependent
  const appointmentData: Record<string, unknown> = {
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
    notes: session.booking_for === 'dependent' 
      ? `Agendado via WhatsApp para dependente: ${session.selected_dependent_name}` 
      : 'Agendado via WhatsApp',
  };

  // Add dependent_id if booking for dependent
  if (session.booking_for === 'dependent' && session.selected_dependent_id) {
    appointmentData.dependent_id = session.selected_dependent_id;
    console.log(`[booking] Creating appointment for dependent: ${session.selected_dependent_id} (${session.selected_dependent_name})`);
  }

  const { data: appointment, error: appointmentError } = await supabase
    .from('appointments')
    .insert(appointmentData)
    .select('id')
    .single();

  if (appointmentError) {
    console.error('[booking] Error creating appointment:', appointmentError);
    
    // Check for no-show blocking error
    if (appointmentError.message?.includes('PACIENTE_BLOQUEADO_NO_SHOW')) {
      const dateMatch = appointmentError.message.match(/até (\d{2}\/\d{2}\/\d{4})/);
      const blockedUntil = dateMatch ? dateMatch[1] : 'data não informada';
      await sendWhatsAppMessage(config, phone, 
        `🚫 *Agendamento Bloqueado*\n\n` +
        `Você está temporariamente bloqueado para novos agendamentos até *${blockedUntil}* devido a não comparecimento em consulta anterior.\n\n` +
        `Para solicitar a liberação, entre em contato diretamente com a clínica.`
      );
      await updateSession(supabase, session.id, { state: 'FINISHED' });
      return { handled: true, newState: 'FINISHED' };
    }
    
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
    
    // Check for dependent limit error
    if (appointmentError.message?.includes('LIMITE_AGENDAMENTO_DEPENDENTE')) {
      const dependentName = session.selected_dependent_name || 'O dependente';
      const limitMatch = appointmentError.message.match(/limite de (\d+) agendamento/i);
      const limit = limitMatch ? limitMatch[1] : '1';
      await sendWhatsAppMessage(config, phone, 
        `❌ *${dependentName}* já atingiu o limite de *${limit} agendamento(s)* com este profissional neste mês.\n\n` +
        `Deseja agendar com outro profissional?`
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
      const whoExpired = session.booking_for === 'dependent' && session.selected_dependent_name
        ? `A carteirinha de *${session.selected_dependent_name}*`
        : 'Sua carteirinha digital';
      await sendWhatsAppMessage(config, phone, 
        `❌ ${whoExpired} está *vencida*.\n\nPor favor, entre em contato com a clínica para renovar a carteirinha antes de agendar.`
      );
      await updateSession(supabase, session.id, { state: 'FINISHED' });
      return { handled: true, newState: 'FINISHED' };
    }

    // Check for expired dependent card
    if (appointmentError.message?.includes('CARTEIRINHA_DEPENDENTE_VENCIDA')) {
      const match = appointmentError.message.match(/dependente \(([^)]+)\)/);
      const dependentName = match ? match[1] : session.selected_dependent_name || 'dependente';
      await sendWhatsAppMessage(config, phone, 
        `❌ A carteirinha do dependente *${dependentName}* está *vencida*.\n\nPor favor, entre em contato com a clínica para renovar a carteirinha antes de agendar.`
      );
      await updateSession(supabase, session.id, { state: 'FINISHED' });
      return { handled: true, newState: 'FINISHED' };
    }

    await sendWhatsAppMessage(config, phone, MESSAGES.error);
    return { handled: true, newState: 'CONFIRM_APPOINTMENT' };
  }

  const createdAppointment = appointment as { id: string };

  const { data: clinic } = await supabase
    .from('clinics')
    .select('name')
    .eq('id', config.clinic_id)
    .single();

  const clinicData = clinic as { name?: string } | null;

  await updateSession(supabase, session.id, { state: 'FINISHED' });

  // Build confirmation message - include dependent name if applicable
  const patientDisplayName = session.booking_for === 'dependent' && session.selected_dependent_name
    ? session.selected_dependent_name
    : session.patient_name || '';

  await sendWhatsAppMessage(config, phone, MESSAGES.appointmentConfirmed({
    date: formatDate(session.selected_date!),
    time: formatTime(session.selected_time!),
    professionalName: session.selected_professional_name || '',
    clinicName: clinicData?.name || '',
  }).replace(/Agendamento confirmado/, 
    session.booking_for === 'dependent' 
      ? `Agendamento para *${session.selected_dependent_name}* confirmado`
      : 'Agendamento confirmado'
  ));

  const monthYear = new Date().toISOString().slice(0, 7);
  await supabase.from('message_logs').insert({
    clinic_id: config.clinic_id,
    message_type: 'whatsapp_booking_confirmed',
    phone,
    month_year: monthYear,
  });

  console.log(`[booking] Appointment created: ${createdAppointment.id}${session.booking_for === 'dependent' ? ` for dependent ${session.selected_dependent_id}` : ''}`);
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

  const getBrazilNow = () => {
    const now = new Date();
    const brazilOffset = -3 * 60; // UTC-3
    const utcOffset = now.getTimezoneOffset();
    return new Date(now.getTime() + (utcOffset + brazilOffset) * 60000);
  };

  const dayMap: Record<number, string> = {
    0: 'sunday',
    1: 'monday',
    2: 'tuesday',
    3: 'wednesday',
    4: 'thursday',
    5: 'friday',
    6: 'saturday',
  };

  const { data: professional } = await supabase
    .from('professionals')
    .select('schedule, appointment_duration')
    .eq('id', professionalId)
    .single();

  const professionalData = professional as { schedule?: any; appointment_duration?: number } | null;
  if (!professionalData?.schedule) return dates;

  const schedule = professionalData.schedule as any;
  const duration = professionalData.appointment_duration || 30;

  const getSlotsForDate = (
    dateStr: string,
    dayKey: string
  ): { slots: Array<{ start: string; end: string }>; stepMinutes: number } | null => {
    // New block-based schedule
    if (schedule?._blocks && Array.isArray(schedule._blocks) && schedule._blocks.length > 0) {
      const slots: Array<{ start: string; end: string }> = [];
      let stepMinutes = 5;

      for (const block of schedule._blocks) {
        if (!block?.days?.includes?.(dayKey)) continue;
        if (block.start_date && dateStr < block.start_date) continue;
        if (block.end_date && dateStr > block.end_date) continue;

        // Some clinics store block-based schedules as start_time/end_time (+duration)
        if (typeof block.duration === 'number') stepMinutes = block.duration;
        if (typeof block.block_interval === 'number') stepMinutes = block.block_interval;

        if (block.start_time && block.end_time) {
          slots.push({ start: block.start_time, end: block.end_time });
        }

        if (Array.isArray(block.slots)) {
          for (const s of block.slots) {
            if (s?.start && s?.end) slots.push({ start: s.start, end: s.end });
          }
        }
      }

      if (slots.length === 0) return null;
      return { slots, stepMinutes };
    }

    // Old weekly schedule
    const daySchedule = schedule?.[dayKey];
    if (!daySchedule?.enabled || !Array.isArray(daySchedule.slots) || daySchedule.slots.length === 0) return null;
    return { slots: daySchedule.slots, stepMinutes: duration };
  };

  const applyExceptionToSlots = async (
    dateStr: string,
    base: { slots: Array<{ start: string; end: string }>; stepMinutes: number } | null
  ) => {
    const { data: exception } = await supabase
      .from('professional_schedule_exceptions')
      .select('is_day_off, start_time, end_time')
      .eq('clinic_id', clinicId)
      .eq('professional_id', professionalId)
      .eq('exception_date', dateStr)
      .maybeSingle();

    const ex = exception as { is_day_off: boolean | null; start_time: string | null; end_time: string | null } | null;

    if (!ex) return base;
    if (ex.is_day_off) return null;

    if (ex.start_time && ex.end_time) {
      return { slots: [{ start: ex.start_time, end: ex.end_time }], stepMinutes: base?.stepMinutes ?? 5 };
    }

    return base;
  };

  const isHolidayDate = async (dateStr: string): Promise<boolean> => {
    const { data, error } = await supabase.rpc('is_holiday', {
      p_clinic_id: clinicId,
      p_date: dateStr,
    });

    if (error) {
      console.error('[booking] is_holiday RPC error:', error);
      return false;
    }

    const row = Array.isArray(data) ? data[0] : null;
    return Boolean(row?.is_holiday);
  };

  const brazilNow = getBrazilNow();
  const today = new Date(brazilNow);
  today.setHours(0, 0, 0, 0);

  // Start from today (i=0) to include same-day booking if there are available slots
  for (let i = 0; i <= 14 && dates.length < 5; i++) {
    const dateObj = new Date(today);
    dateObj.setDate(dateObj.getDate() + i);

    const dateStr = dateObj.toISOString().split('T')[0];
    const dayKey = dayMap[dateObj.getDay()];

    // Só listar dias realmente configurados na agenda do profissional
    let scheduleForDay = getSlotsForDate(dateStr, dayKey);
    scheduleForDay = await applyExceptionToSlots(dateStr, scheduleForDay);
    if (!scheduleForDay) continue;

    // Bloquear feriados (nacional/estadual/municipal/da clínica)
    if (await isHolidayDate(dateStr)) continue;

    // For today, check if there are still available slots after current time
    if (i === 0) {
      const currentMinutes = brazilNow.getHours() * 60 + brazilNow.getMinutes();
      const minAllowedMinutes = currentMinutes + 30; // 30 min buffer

      let hasAvailableSlotToday = false;
      for (const slot of scheduleForDay.slots) {
        const [endH, endM] = slot.end.split(':').map(Number);
        const endMinutes = endH * 60 + endM;

        if (endMinutes > minAllowedMinutes + duration) {
          hasAvailableSlotToday = true;
          break;
        }
      }

      if (!hasAvailableSlotToday) continue;
    }

    const hasAvailableSlots = await hasAvailableSlotsOnDate(
      supabase,
      clinicId,
      professionalId,
      dateStr,
      scheduleForDay.slots,
      scheduleForDay.stepMinutes,
      i === 0 ? brazilNow : null
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
  slots: Array<{ start: string; end: string }>,
  stepMinutes: number,
  currentTimeForToday?: Date | null
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
  appointmentsData.forEach((apt) => {
    bookedTimes.add(apt.start_time.substring(0, 5));
  });

  const { data: professional } = await supabase
    .from('professionals')
    .select('appointment_duration')
    .eq('id', professionalId)
    .single();

  const professionalData = professional as { appointment_duration?: number } | null;
  const duration = professionalData?.appointment_duration || 30;

  // Calculate minimum allowed time for today
  const minAllowedMinutes = currentTimeForToday
    ? currentTimeForToday.getHours() * 60 + currentTimeForToday.getMinutes() + 30
    : 0;

  for (const slot of slots) {
    const [startH, startM] = slot.start.split(':').map(Number);
    const [endH, endM] = slot.end.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    for (let m = startMinutes; m + duration <= endMinutes; m += Math.max(1, stepMinutes)) {
      if (currentTimeForToday && m < minAllowedMinutes) continue;

      const h = Math.floor(m / 60);
      const min = m % 60;
      const timeStr = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;

      if (!bookedTimes.has(timeStr)) return true;
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

  const professionalData = professional as { schedule?: any; appointment_duration?: number } | null;
  if (!professionalData?.schedule) return times;

  const schedule = professionalData.schedule as any;
  const duration = professionalData.appointment_duration || 30;

  // Block holidays (national/state/municipal/clinic)
  const { data: holidayData, error: holidayErr } = await supabase.rpc('is_holiday', {
    p_clinic_id: clinicId,
    p_date: date,
  });
  if (holidayErr) {
    console.error('[booking] is_holiday RPC error:', holidayErr);
  } else {
    const row = Array.isArray(holidayData) ? holidayData[0] : null;
    if (row?.is_holiday) return times;
  }

  // Apply schedule exception (day off or reduced hours)
  const { data: exception } = await supabase
    .from('professional_schedule_exceptions')
    .select('is_day_off, start_time, end_time')
    .eq('clinic_id', clinicId)
    .eq('professional_id', professionalId)
    .eq('exception_date', date)
    .maybeSingle();

  const ex = exception as { is_day_off: boolean | null; start_time: string | null; end_time: string | null } | null;
  if (ex?.is_day_off) return times;

  const dayMap: Record<number, string> = {
    0: 'sunday',
    1: 'monday',
    2: 'tuesday',
    3: 'wednesday',
    4: 'thursday',
    5: 'friday',
    6: 'saturday',
  };

  const dateObj = new Date(date + 'T00:00:00');
  const dayKey = dayMap[dateObj.getDay()];

  let slots: Array<{ start: string; end: string }> = [];
  let stepMinutes = duration;

  // New block-based schedule
  if (schedule?._blocks && Array.isArray(schedule._blocks) && schedule._blocks.length > 0) {
    stepMinutes = 5;

    for (const block of schedule._blocks) {
      if (!block?.days?.includes?.(dayKey)) continue;
      if (block.start_date && date < block.start_date) continue;
      if (block.end_date && date > block.end_date) continue;

      if (typeof block.duration === 'number') stepMinutes = block.duration;
      if (typeof block.block_interval === 'number') stepMinutes = block.block_interval;

      // Block can be defined as start_time/end_time (common in Sindicato)
      if (block.start_time && block.end_time) {
        slots.push({ start: block.start_time, end: block.end_time });
      }

      if (Array.isArray(block.slots)) {
        for (const s of block.slots) {
          if (s?.start && s?.end) slots.push({ start: s.start, end: s.end });
        }
      }
    }
  } else {
    const daySchedule = schedule?.[dayKey];
    if (!daySchedule?.enabled || !Array.isArray(daySchedule.slots) || daySchedule.slots.length === 0) return times;
    slots = daySchedule.slots;
  }

  // Reduced-hours exception overrides slots
  if (ex?.start_time && ex?.end_time) {
    slots = [{ start: ex.start_time, end: ex.end_time }];
  }

  if (!slots.length) return times;

  const { data: appointments } = await supabase
    .from('appointments')
    .select('start_time, end_time')
    .eq('clinic_id', clinicId)
    .eq('professional_id', professionalId)
    .eq('appointment_date', date)
    .in('status', ['scheduled', 'confirmed']);

  const appointmentsData = (appointments || []) as Array<{ start_time: string; end_time: string }>;
  const bookedTimes = new Set<string>();
  appointmentsData.forEach((apt) => {
    bookedTimes.add(apt.start_time.substring(0, 5));
  });

  // Brazil time for "today" filtering
  const now = new Date();
  const brazilOffset = -3 * 60; // UTC-3
  const utcOffset = now.getTimezoneOffset();
  const brazilNow = new Date(now.getTime() + (utcOffset + brazilOffset) * 60000);
  const todayStr = brazilNow.toISOString().split('T')[0];
  const isToday = date === todayStr;
  const currentMinutes = isToday ? brazilNow.getHours() * 60 + brazilNow.getMinutes() : 0;
  const minAllowedMinutes = currentMinutes + 30;

  for (const slot of slots) {
    const [startH, startM] = slot.start.split(':').map(Number);
    const [endH, endM] = slot.end.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    for (let m = startMinutes; m + duration <= endMinutes; m += Math.max(1, stepMinutes)) {
      if (isToday && m < minAllowedMinutes) continue;

      const h = Math.floor(m / 60);
      const min = m % 60;
      const timeStr = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;

      if (!bookedTimes.has(timeStr)) {
        times.push({ time: timeStr, formatted: formatTime(timeStr) });
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

// Session TTL (inactivity)
const SESSION_TTL_MS = 10 * 60 * 1000;

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

  // Session expires after inactivity
  const { data: session, error } = await supabase
    .from('whatsapp_booking_sessions')
    .insert({
      clinic_id: clinicId,
      phone,
      state,
      expires_at: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
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
  // Renew session on each interaction
  const { error } = await supabase
    .from('whatsapp_booking_sessions')
    .update({
      ...updates,
      expires_at: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
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
// PAYSLIP IMAGE UPLOAD HANDLER
// ==========================================

interface MediaMessage {
  url?: string;
  mimetype?: string;
  caption?: string;
  directPath?: string;
  mediaKey?: string;
  fileLength?: string;
  title?: string;
  fileName?: string;
}

async function handlePayslipImageUpload(
  supabase: any,
  phone: string,
  instanceName: string,
  messageId: string,
  mediaMessage: MediaMessage | undefined,
  messageType: string
): Promise<boolean> {
  if (!mediaMessage) {
    console.log('[payslip] No media message found');
    return false;
  }

  console.log(`[payslip] Processing image from ${phone}, type: ${messageType}`);

  try {
    // First get Evolution config to determine the clinic
    const { data: evolutionConfig, error: configError } = await supabase
      .from('evolution_configs')
      .select('api_url, api_key, instance_name, clinic_id')
      .eq('instance_name', instanceName)
      .eq('is_connected', true)
      .limit(1)
      .maybeSingle();

    if (configError || !evolutionConfig) {
      console.error('[payslip] Evolution config not found for instance:', instanceName);
      return false;
    }

    console.log(`[payslip] Found Evolution config for clinic: ${evolutionConfig.clinic_id}`);

    const phoneCandidates = getBrazilPhoneVariants(phone);

    // Find patient by phone IN THE SPECIFIC CLINIC
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('id, name, clinic_id')
      .eq('clinic_id', evolutionConfig.clinic_id)
      .or(phoneCandidates.map(p => `phone.ilike.%${p.slice(-8)}%`).join(','))
      .limit(1)
      .maybeSingle();

    if (patientError || !patient) {
      console.log('[payslip] Patient not found for phone:', phone, 'in clinic:', evolutionConfig.clinic_id);
      return false;
    }

    console.log(`[payslip] Found patient: ${patient.name} (${patient.id}) in clinic ${patient.clinic_id}`);

    // Check if patient has a pending payslip request
    const { data: pendingRequest, error: requestError } = await supabase
      .from('payslip_requests')
      .select('id, card_id, clinic_id')
      .eq('patient_id', patient.id)
      .eq('clinic_id', evolutionConfig.clinic_id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (requestError) {
      console.error('[payslip] Error fetching pending request:', requestError);
      return false;
    }

    if (!pendingRequest) {
      console.log('[payslip] No pending payslip request for patient in clinic:', evolutionConfig.clinic_id);
      return false;
    }

    console.log(`[payslip] Found pending request: ${pendingRequest.id}`);

    // Download media from Evolution API
    const mediaUrl = `${evolutionConfig.api_url}/chat/getBase64FromMediaMessage/${evolutionConfig.instance_name}`;
    
    console.log(`[payslip] Downloading media from Evolution API`);
    
    const mediaResponse = await fetch(mediaUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionConfig.api_key,
      },
      body: JSON.stringify({
        message: {
          key: {
            id: messageId,
            remoteJid: `${phone}@s.whatsapp.net`,
          },
          messageType: messageType,
        },
        convertToMp4: false,
      }),
    });

    if (!mediaResponse.ok) {
      const errorText = await mediaResponse.text();
      console.error('[payslip] Failed to download media:', errorText);
      return false;
    }

    const mediaData = await mediaResponse.json();
    const base64Data = mediaData.base64;

    if (!base64Data) {
      console.error('[payslip] No base64 data in response');
      return false;
    }

    // Determine file extension from mimetype
    const mimeType = mediaMessage.mimetype || 'image/jpeg';
    const extension = mimeType.includes('pdf') ? 'pdf' : 
                      mimeType.includes('png') ? 'png' : 
                      mimeType.includes('webp') ? 'webp' : 'jpg';

    // Create file path: clinic_id/patient_id/timestamp.ext
    const timestamp = Date.now();
    const fileName = `${pendingRequest.clinic_id}/${patient.id}/${timestamp}.${extension}`;

    // Decode base64 and upload to storage
    const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('contra-cheques')
      .upload(fileName, binaryData, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      console.error('[payslip] Upload error:', uploadError);
      return false;
    }

    console.log(`[payslip] Uploaded to storage: ${uploadData.path}`);

    // Update payslip request
    const { error: updateError } = await supabase
      .from('payslip_requests')
      .update({
        status: 'received',
        received_at: new Date().toISOString(),
        attachment_path: uploadData.path,
        updated_at: new Date().toISOString(),
      })
      .eq('id', pendingRequest.id);

    if (updateError) {
      console.error('[payslip] Error updating request:', updateError);
      return false;
    }

    // Send confirmation message to patient
    const config: EvolutionConfig = {
      api_url: evolutionConfig.api_url,
      api_key: evolutionConfig.api_key,
      instance_name: evolutionConfig.instance_name,
      clinic_id: evolutionConfig.clinic_id,
    };

    await sendWhatsAppMessage(
      config,
      phone,
      `✅ Recebemos seu contracheque!\n\nObrigado, ${patient.name}. Nossa equipe irá analisar o documento e atualizar sua carteirinha.\n\nVocê será notificado quando a análise for concluída.`
    );

    console.log(`[payslip] Successfully processed payslip for ${patient.name}`);
    return true;

  } catch (error) {
    console.error('[payslip] Error processing payslip:', error);
    return false;
  }
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
    const messageType = payload.data?.messageType;
    const imageMessage = payload.data?.message?.imageMessage;
    const documentMessage = payload.data?.message?.documentMessage;

    console.log(`[webhook] Phone: ${phone}, Message: "${messageText}", Type: ${messageType}`);

    // Handle image/document messages for payslip submissions
    if (phone && (imageMessage || documentMessage || messageType === 'imageMessage' || messageType === 'documentMessage')) {
      const imageHandled = await handlePayslipImageUpload(
        supabase, 
        phone, 
        payload.instance || '',
        payload.data?.key?.id || '',
        imageMessage || documentMessage,
        messageType || ''
      );
      
      if (imageHandled) {
        return new Response(
          JSON.stringify({ success: true, message: 'Payslip image processed' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Validate phone number - must have at least 12 digits (DDI + DDD + number)
    const MIN_PHONE_LENGTH = 12;
    if (phone && phone.length < MIN_PHONE_LENGTH) {
      console.error(`[webhook] Invalid phone number: "${phone}" (original remoteJid: "${remoteJid}"). Expected DDI+DDD+number (min ${MIN_PHONE_LENGTH} digits).`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Telefone invalido', 
          detail: `Esperado DDI+DDD+numero (minimo ${MIN_PHONE_LENGTH} digitos)`,
          received: phone,
          remoteJid: remoteJid 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!phone || !messageText) {
      const messageObj = payload.data?.message ?? {};
      console.warn('[webhook] No phone or messageText extracted', {
        phone,
        messageText,
        messageKeys: Object.keys(messageObj as Record<string, unknown>),
      });

      return new Response(
        JSON.stringify({ success: true, message: 'No action needed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const phoneCandidates = getBrazilPhoneVariants(phone);

    const confirmResult = await handleConfirmationFlow(supabase, phone, messageText, phoneCandidates);
    
    let clinicId = confirmResult.clinicId;

    if (!confirmResult.handled) {
      // Prefer routing by existing active session (avoids ambiguity when multiple clinics share the same instance)
      const { data: activeSession, error: activeSessionError } = await supabase
        .from('whatsapp_booking_sessions')
        .select('clinic_id, updated_at')
        .in('phone', phoneCandidates)
        .neq('state', 'FINISHED')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (activeSessionError) {
        console.error('[webhook] Error fetching active session for routing:', activeSessionError);
      }

      let configData: EvolutionConfig | null = null;

      if (activeSession?.clinic_id) {
        const { data: configByClinic, error: configByClinicError } = await supabase
          .from('evolution_configs')
          .select('clinic_id, api_url, api_key, instance_name, direct_reply_enabled')
          .eq('clinic_id', activeSession.clinic_id)
          .eq('is_connected', true)
          .eq('direct_reply_enabled', true)
          .maybeSingle();

        if (configByClinicError) {
          console.error('[webhook] Error fetching config by clinic_id:', configByClinicError);
        }

        configData = (configByClinic as EvolutionConfig) ?? null;
        console.log(`[webhook] Routing by active session -> clinic: ${configData?.clinic_id ?? 'not found'}`);
      }

      // Fallback: Find config by instance name - each clinic should have unique instance name
      if (!configData) {
        const { data: configByInstance, error: configError } = await supabase
          .from('evolution_configs')
          .select('clinic_id, api_url, api_key, instance_name, direct_reply_enabled')
          .eq('instance_name', payload.instance)
          .eq('is_connected', true)
          .eq('direct_reply_enabled', true);

        if (configError) {
          console.error('[webhook] Error fetching config:', configError);
        }

        // If multiple clinics share same instance, log detailed warning with all affected clinics
        if (configByInstance && configByInstance.length > 1) {
          const affectedClinics = configByInstance.map(c => c.clinic_id).join(', ');
          console.warn(
            `[webhook] WARNING: Multiple clinics (${configByInstance.length}) share the same instance "${payload.instance}". ` +
              `Affected clinic_ids: [${affectedClinics}]. ` +
              `Each clinic should have a unique Evolution instance for proper routing. ` +
              `Using first match: clinic_id=${configByInstance[0].clinic_id}. ` +
              `TIP: Update instance_name in evolution_configs to be unique per clinic (e.g., "eclini_clinicaA", "eclini_clinicaB").`
          );
        }

        configData = configByInstance && configByInstance.length > 0 ? (configByInstance[0] as EvolutionConfig) : null;
        console.log(`[webhook] Instance "${payload.instance}" -> clinic: ${configData?.clinic_id ?? 'not found'}`);
      }

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
