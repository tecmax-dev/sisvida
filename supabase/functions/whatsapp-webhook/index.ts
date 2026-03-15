// whatsapp-webhook v2.1 - 2026-02-18
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
  | 'WAITING_REGISTRATION_RELATIONSHIP'
  | 'OFFER_REGISTRATION'
  | 'SELECT_REGISTRATION_TYPE'
  | 'WAITING_REGISTRATION_DEPENDENT_CPF'
  | 'WAITING_REGISTRATION_TITULAR_CPF'
  | 'SELECT_INSURANCE_PLAN'
  | 'WAITING_REGISTRATION_NAME'
  | 'WAITING_REGISTRATION_BIRTHDATE'
  | 'WAITING_REGISTRATION_CNPJ'
  | 'CONFIRM_COMPANY'
  | 'CONFIRM_REGISTRATION'
  | 'WAITING_DEPENDENT_CPF_PHOTO'
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
  // Registration flow fields
  pending_registration_cpf?: string | null;
  pending_registration_name?: string | null;
  pending_registration_birthdate?: string | null;
  pending_registration_cnpj?: string | null;
  pending_registration_type?: 'titular' | 'dependent' | null;
  pending_registration_titular_cpf?: string | null;
  pending_registration_insurance_plan_id?: string | null;
  pending_registration_relationship?: string | null;
  available_insurance_plans?: Array<{ id: string; name: string }> | null;
}

interface EvolutionConfig {
  api_url: string;
  api_key: string;
  instance_name: string;
  clinic_id: string;
  direct_reply_enabled?: boolean;
  booking_enabled?: boolean;
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
  // Evolution can send remoteJid like "55DDDNÚMERO:device@s.whatsapp.net".
  // For session consistency, strip the ":device" suffix and keep only the real phone digits.
  let base = phone.replace(/@s\.whatsapp\.net$/, '');
  base = base.replace(/:\d+$/, '');

  let cleaned = base.replace(/\D/g, '');
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
// TEXT-BASED OPTIONS SENDER (no interactive buttons)
// Always uses numbered text format for maximum compatibility
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
  // Limit to 3 options
  const limitedButtons = buttons.slice(0, 3);
  
  console.log(`[booking] Sending text options to ${phone}:`, limitedButtons.map(b => b.text));

  // Always use numbered text format (no native buttons)
  const numberedOptions = limitedButtons.map((b, i) => `${i + 1}️⃣ ${b.text}`).join('\n');
  const textMessage = `${title}\n\n${description}\n\n${numberedOptions}${footer ? `\n\n_${footer}_` : ''}`;
  
  return await sendWhatsAppMessage(config, phone, textMessage);
}

// ==========================================
// WHAZING API PLUS - INTERACTIVE BUTTONS
// ==========================================

async function sendWhazingButtons(phone: string, bodyText: string, buttons: Array<{ id: string; title: string }>): Promise<boolean> {
  const whazingUrl = Deno.env.get('WHAZING_API_URL');
  const whazingToken = Deno.env.get('WHAZING_API_TOKEN');

  if (!whazingUrl || !whazingToken) {
    console.log('[whazing] API not configured (missing WHAZING_API_URL or WHAZING_API_TOKEN)');
    return false;
  }

  try {
    let cleanPhone = phone.replace(/@s\.whatsapp\.net$/, '').replace(/\D/g, '');
    if (!cleanPhone.startsWith('55')) cleanPhone = '55' + cleanPhone;

    const apiOficialUrl = whazingUrl.replace(/\/$/, '') + '/apioficial';
    console.log(`[whazing] Sending ${buttons.length}-button menu to ${cleanPhone}`);

    const response = await fetch(apiOficialUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${whazingToken}`,
      },
      body: JSON.stringify({
        number: cleanPhone,
        contents: {
          type: "button",
          body: { text: bodyText },
          action: {
            buttons: buttons.map(b => ({ type: "reply", reply: { id: b.id, title: b.title } }))
          }
        }
      }),
    });

    const responseText = await response.text();
    if (!response.ok) {
      console.error('[whazing] API error:', response.status, responseText);
      return false;
    }
    console.log('[whazing] Buttons sent successfully:', responseText.substring(0, 200));
    return true;
  } catch (error) {
    console.error('[whazing] Error sending buttons:', error);
    return false;
  }
}

async function sendWhazingMenuButtons(phone: string): Promise<boolean> {
  return sendWhazingButtons(phone, 
    "Olá! 👋 Bem-vindo(a) ao atendimento.\n\nComo podemos ajudá-lo(a) hoje?",
    [
      { id: "whazing_associado", title: "Sou Associado" },
      { id: "whazing_empresa", title: "Sou Empresa" },
      { id: "whazing_contabilidade", title: "Sou Contabilidade" },
    ]
  );
}

type WhazingCategory = 'associado' | 'empresa' | 'contabilidade';

async function sendWhazingSubMenu(phone: string, category: WhazingCategory): Promise<boolean> {
  const subMenus: Record<WhazingCategory, { text: string; buttons: Array<{ id: string; title: string }> }> = {
    associado: {
      text: "Você selecionou *Sou Associado*.\n\nEscolha o que deseja:",
      buttons: [
        { id: "whazing_sub_carteirinha", title: "Atualizar Carteirinha" },
        { id: "whazing_sub_convencoes", title: "Convenções Coletivas" },
        { id: "whazing_sub_outros", title: "Outros Assuntos" },
      ],
    },
    empresa: {
      text: "Você selecionou *Sou Empresa*.\n\nEscolha o que deseja:",
      buttons: [
        { id: "whazing_sub_boleto", title: "2ª Via Boleto" },
        { id: "whazing_sub_convencoes", title: "Convenções Coletivas" },
        { id: "whazing_sub_outros", title: "Outros Assuntos" },
      ],
    },
    contabilidade: {
      text: "Você selecionou *Sou Contabilidade*.\n\nEscolha o que deseja:",
      buttons: [
        { id: "whazing_sub_boleto", title: "2ª Via Boleto" },
        { id: "whazing_sub_convencoes", title: "Convenções Coletivas" },
        { id: "whazing_sub_outros", title: "Outros Assuntos" },
      ],
    },
  };

  return sendWhazingButtons(phone, subMenus[category].text, subMenus[category].buttons);
}

function parseWhazingCategory(messages: unknown): WhazingCategory | null {
  if (!messages || typeof messages !== 'object' || Array.isArray(messages)) return null;
  const category = (messages as Record<string, unknown>).whazing_category;
  return category === 'associado' || category === 'empresa' || category === 'contabilidade' ? category : null;
}

async function storeWhazingCategory(
  supabase: ReturnType<typeof createClient>,
  clinicId: string,
  phone: string,
  category: WhazingCategory
): Promise<void> {
  const { error } = await supabase.from('whatsapp_ai_conversations').insert({
    clinic_id: clinicId,
    phone,
    messages: { whazing_category: category, source: 'whazing_menu' },
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });

  if (error) {
    console.log('[webhook] Could not store whazing category session:', error.message);
  }
}

async function getWhazingCategory(
  supabase: ReturnType<typeof createClient>,
  clinicId: string,
  phoneCandidates: string[],
  fallback: WhazingCategory = 'associado'
): Promise<WhazingCategory> {
  const { data, error } = await supabase
    .from('whatsapp_ai_conversations')
    .select('messages, created_at')
    .eq('clinic_id', clinicId)
    .in('phone', phoneCandidates)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.log('[webhook] Could not retrieve whazing category:', error.message);
    return fallback;
  }

  for (const row of data ?? []) {
    const parsed = parseWhazingCategory(row.messages);
    if (parsed) return parsed;
  }

  return fallback;
}

// ==========================================
// TEXT-BASED LIST SENDER (no interactive lists)
// Always uses numbered text format for maximum compatibility
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
  console.log(`[booking] Sending text list to ${phone}: ${sections.reduce((acc, s) => acc + s.rows.length, 0)} items`);

  // Always use numbered text format (no native lists)
  let textMessage = `${title}\n\n${description}\n\n`;
  let globalIndex = 1;
  
  sections.forEach(section => {
    if (section.title) textMessage += `*${section.title}*\n`;
    section.rows.forEach((row) => {
      textMessage += `${globalIndex}️⃣ ${row.title}${row.description ? ` - ${row.description}` : ''}\n`;
      globalIndex++;
    });
    textMessage += '\n';
  });
  
  if (footer) textMessage += footer;
  
  return await sendWhatsAppMessage(config, phone, textMessage.trim());
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
- CPF tem EXATAMENTE 11 dígitos. NÃO classifique números com 5-10 dígitos como CPF!
- Carteirinha digital tem 5 a 10 dígitos (NÃO tente extrair como CPF)

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
        model: 'openai/gpt-5-mini',
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
Para agendar sua consulta, por favor informe seu *CPF* ou *número da carteirinha* (apenas números).

_Digite MENU a qualquer momento para reiniciar._`,

  cpfInvalid: `❌ Entrada inválida. Por favor, informe:
• *CPF*: 11 números
• *Carteirinha*: apenas os números da carteirinha`,

  patientNotFound: `❌ Não localizamos seu cadastro em nosso sistema.

Deseja se cadastrar agora? É rápido e você já poderá agendar!

1️⃣ *Sim*, quero me cadastrar
2️⃣ *Não*, vou entrar em contato por outro meio`,

  offerRegistration: `Para completar seu cadastro, preciso de algumas informações.

Por favor, informe seu *nome completo*:`,

  askBirthDate: (name: string) => `Olá, *${name}*! 👋

Agora informe sua *data de nascimento* no formato DD/MM/AAAA:
(Exemplo: 15/03/1990)`,

  askEmployerCnpj: `Informe o *CNPJ da empresa* onde você trabalha:

_Digite apenas os 14 números do CNPJ._`,

  confirmRegistration: (name: string, birthDate: string, cnpj: string | null) => {
    let msg = `📋 *Confirme seus dados:*\n\n`;
    msg += `👤 Nome: *${name}*\n`;
    msg += `📅 Nascimento: *${birthDate}*\n`;
    if (cnpj) {
      msg += `🏢 CNPJ: *${cnpj}*\n`;
    }
    msg += `📱 WhatsApp: _(este número)_\n\n`;
    msg += `Os dados estão corretos?\n`;
    msg += `1️⃣ *Sim*, confirmar cadastro\n`;
    msg += `2️⃣ *Não*, começar novamente`;
    return msg;
  },

  // Registration type selection (titular or dependent)
  selectRegistrationType: `📝 *Tipo de cadastro:*

Você deseja se cadastrar como:

1️⃣ *Titular* (paciente principal)
2️⃣ *Dependente* de outro paciente`,

  askTitularCpf: `Você está se cadastrando como *dependente*.

Por favor, informe o *CPF do titular* (responsável):`,

  titularNotFound: `❌ Não encontramos o titular com este CPF.

Verifique o número e tente novamente, ou digite *1* para se cadastrar como titular.`,

  // Insurance plan selection
  selectInsurancePlan: (plans: Array<{ name: string }>) => {
    let msg = `🏥 *Selecione o convênio:*\n\n`;
    plans.forEach((p, i) => {
      msg += `${i + 1}️⃣ ${p.name}\n`;
    });
    return msg.trim();
  },

  noInsurancePlans: `ℹ️ Esta clínica não possui convênios cadastrados. Continuando com cadastro particular.`,

  registrationSuccess: (name: string) => `✅ *Cadastro realizado com sucesso!*

Olá, *${name}*! Seja bem-vindo(a)! 🎉

Sua carteirinha digital foi criada com validade de 15 dias.

Agora você já pode agendar sua consulta! Por favor, informe novamente seu *CPF*:`,

  registrationError: `❌ Ocorreu um erro ao realizar seu cadastro.

Por favor, tente novamente ou entre em contato conosco.`,

  invalidBirthDate: `❌ Data inválida. Por favor, informe no formato *DD/MM/AAAA*.
(Exemplo: 15/03/1990)`,

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
    return `Ops! A carteirinha de *${firstName}* está vencida desde *${expiryDate}*. 😕\n\nEntre em contato com o Sindicato para renovar, depois é só voltar aqui! 💪`;
  },

  // Main menu after identity confirmed - dynamic based on booking_enabled
  mainMenu: `O que você deseja fazer?

1️⃣ *Agendar* nova consulta
2️⃣ *Cancelar* consulta existente
3️⃣ *Reagendar* consulta
4️⃣ *Ver* minhas consultas

_Digite o número da opção desejada._`,

  // Menu without booking option
  mainMenuNoBooking: `O que você deseja fazer?

1️⃣ *Cancelar* consulta existente
2️⃣ *Reagendar* consulta
3️⃣ *Ver* minhas consultas

_Digite o número da opção desejada._`,

  // Booking app-only message (v2 - force redeploy)
  bookingMaintenance: `⚠️ *Agendamento somente pelo aplicativo*

O agendamento por WhatsApp está desativado. Utilize nosso aplicativo para agendar suas consultas com praticidade.

📲 *Abrir o app agora:*
👉 https://prosindweb.com.br/app

_(Se o app já estiver instalado no seu celular, o link acima abrirá diretamente nele)_

📥 *Ainda não instalou?*
👉 https://prosindweb.com.br/app/instalar

• iPhone: abra pelo *Safari* → Compartilhar → Adicionar à Tela Inicial
• Android: abra pelo *Chrome* → menu ⋮ → Adicionar à tela inicial`,

  // Helper function to get the appropriate menu based on booking_enabled
  getMainMenu: (bookingEnabled: boolean) => bookingEnabled 
    ? `O que você deseja fazer?

1️⃣ *Agendar* nova consulta
2️⃣ *Cancelar* consulta existente
3️⃣ *Reagendar* consulta
4️⃣ *Ver* minhas consultas

_Digite o número da opção desejada._`
    : `O que você deseja fazer?

1️⃣ *Cancelar* consulta existente
2️⃣ *Reagendar* consulta
3️⃣ *Ver* minhas consultas

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
  }) => {
    // Verificar se precisa incluir local específico (Dr. Marcelo Aguiar ou Dr. Jorge Avelar)
    const lowerName = data.professionalName.toLowerCase();
    const isRodoviariosProfessional = lowerName.includes('marcelo aguiar') || lowerName.includes('jorge avelar');
    const locationInfo = isRodoviariosProfessional 
      ? `\n\n📍 *Local:* Av. Antonio Carlos Magalhães, 1062, Bairro Malhado\n   Sede do Sindicato dos Rodoviários\n   (ao lado da Igreja Testemunhas de Jeová)`
      : '';
    
    return `✅ *Agendamento confirmado com sucesso!*

📅 ${data.date} às ${data.time}
👨‍⚕️ Dr(a). ${data.professionalName}${locationInfo}

⏳ *Compareça com 15 minutos de antecedência.*

Qualquer dúvida, estamos à disposição! 😊

${data.clinicName}`;
  },

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
  hintCpf: `\n\n💡 _Dica: Digite apenas os números do CPF (11 dígitos) ou da carteirinha (5 a 10 dígitos)._`,
  
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
// AI BOOKING FLOW HANDLER
// ==========================================

async function handleAIBookingFlow(
  supabase: SupabaseClient,
  config: EvolutionConfig,
  phone: string,
  messageText: string
): Promise<void> {
  const clinicId = config.clinic_id;
  console.log(`[ai-booking] Processing message for clinic ${clinicId}, phone ${phone}`);

  // =========================================================================
  // CRITICAL: Check if booking is disabled FIRST - block ALL attempts unconditionally
  // This includes: active sessions, CPF inputs, AI conversation, keywords — EVERYTHING
  // =========================================================================
  if (config.booking_enabled === false) {
    const msgTrimmed = (messageText || '').trim();

    // Exception: option '6' = boleto flow. Allow it to pass through to boleto-whatsapp-flow.
    if (msgTrimmed === '6') {
      console.log(`[ai-booking] booking_enabled=false but message is '6' (boleto) - redirecting to boleto flow instead of blocking`);
      const supabaseUrlEnv = Deno.env.get('SUPABASE_URL') || '';
      try {
        const boletoResponse = await fetch(`${supabaseUrlEnv}/functions/v1/boleto-whatsapp-flow`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''}`,
          },
          body: JSON.stringify({
            clinic_id: clinicId,
            phone,
            evolution_config: config,
          }),
        });
        if (boletoResponse.ok) {
          console.log('[ai-booking] Boleto flow initiated successfully from option 6 (booking disabled)');
        } else {
          const errorText = await boletoResponse.text();
          console.error('[ai-booking] Boleto flow error:', errorText);
          await sendWhatsAppMessage(config, phone, 'Desculpe, ocorreu um erro ao iniciar o fluxo de boletos. Por favor, tente novamente.');
        }
      } catch (boletoError) {
        console.error('[ai-booking] Exception calling boleto flow:', boletoError);
        await sendWhatsAppMessage(config, phone, 'Desculpe, ocorreu um erro ao iniciar o fluxo de boletos.');
      }
      return;
    }

    console.log(`[ai-booking] ABSOLUTE BLOCK: booking_enabled=false for clinic ${clinicId}. Terminating all booking flows.`);

    // Expire any active booking sessions so they don't resume
    await supabase
      .from('whatsapp_booking_sessions')
      .update({ state: 'FINISHED', expires_at: new Date().toISOString() })
      .eq('clinic_id', clinicId)
      .eq('phone', phone)
      .neq('state', 'FINISHED');

    // Expire any active AI conversations so they don't resume
    await supabase
      .from('whatsapp_ai_conversations')
      .update({ expires_at: new Date().toISOString() })
      .eq('clinic_id', clinicId)
      .eq('phone', phone);

    const appBlockMsg = `⚠️ *Agendamento somente pelo aplicativo*

O agendamento por WhatsApp está desativado. Utilize nosso aplicativo para agendar suas consultas com praticidade.

📲 *Abrir o app agora:*
👉 https://prosindweb.com.br/app

_(Se o app já estiver instalado no seu celular, o link acima abrirá diretamente nele)_

📥 *Ainda não instalou?*
👉 https://prosindweb.com.br/app/instalar

• iPhone: abra pelo *Safari* → Compartilhar → Adicionar à Tela Inicial
• Android: abra pelo *Chrome* → menu ⋮ → Adicionar à tela inicial`;

    await sendWhatsAppMessage(config, phone, appBlockMsg);
    return;
  }
  // =========================================================================

  try {
    // FIRST: Check if there's an active booking session - if so, use traditional flow
    const { data: existingBookingSession } = await supabase
      .from('whatsapp_booking_sessions')
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('phone', phone)
      .neq('state', 'FINISHED')
      .gt('expires_at', new Date().toISOString())
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingBookingSession) {
      console.log(`[ai-booking] Found active booking session in state: ${existingBookingSession.state}, switching to traditional flow`);
      // Use traditional booking flow for active sessions
      await handleBookingFlow(
        supabase,
        config,
        phone,
        messageText,
        existingBookingSession as BookingSession,
        false
      );
      return;
    }

    // Check if message looks like a CPF (user might be starting booking directly)
    const maybeCpf = messageText.replace(/\D/g, '');
    console.log(`[ai-booking] Checking if message is CPF: "${maybeCpf}" (length: ${maybeCpf.length})`);
    
    if (maybeCpf.length === 11) {
      const isValidCpf = validateCpf(maybeCpf);
      console.log(`[ai-booking] CPF validation result: ${isValidCpf} for ${maybeCpf.substring(0, 3)}***`);
      
      if (isValidCpf) {
        console.log(`[ai-booking] Detected valid CPF, creating booking session and processing`);
        // Create session and process CPF directly through traditional flow
        const newSession = await createOrResetSession(supabase, clinicId, phone, 'WAITING_CPF');
        await handleBookingFlow(supabase, config, phone, messageText, newSession, false);
        return;
      } else {
        // CPF has 11 digits but failed validation - send clear error message
        console.log(`[ai-booking] CPF has 11 digits but failed checksum validation`);
        await sendWhatsAppMessage(config, phone, 
          `❌ *CPF inválido*\n\nO CPF informado não passou na validação. Por favor, verifique se digitou corretamente.\n\n💡 Digite apenas os 11 números do seu CPF.`
        );
        return;
      }
    }

    // Get or create AI conversation
    const { data: existingConversation } = await supabase
      .from('whatsapp_ai_conversations')
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('phone', phone)
      .gt('expires_at', new Date().toISOString())
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let conversationHistory: Array<{ role: string; content: string }> = [];
    let conversationId = existingConversation?.id;

    if (existingConversation) {
      conversationHistory = existingConversation.messages || [];
      console.log(`[ai-booking] Found existing conversation with ${conversationHistory.length} messages`);
    } else {
      // Create new conversation
      const { data: newConversation } = await supabase
        .from('whatsapp_ai_conversations')
        .insert({
          clinic_id: clinicId,
          phone: phone,
          messages: [],
          expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 minutes
        })
        .select()
        .single();

      conversationId = newConversation?.id;
      console.log(`[ai-booking] Created new conversation: ${conversationId}`);
    }

    // Call the AI assistant
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const aiResponse = await fetch(`${supabaseUrl}/functions/v1/whatsapp-ai-assistant`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({
        message: messageText,
        clinic_id: clinicId,
        phone: phone,
        conversation_history: conversationHistory
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('[ai-booking] AI assistant error:', aiResponse.status, errorText);
      await sendWhatsAppMessage(config, phone, 'Desculpe, ocorreu um erro. Por favor, tente novamente em instantes.');
      return;
    }

    const aiData = await aiResponse.json();
    
    // CHECK FOR BOOKING HANDOFF
    if (aiData.handoff_to_booking === true) {
      // SAFETY CHECK: Never proceed with booking handoff if booking is disabled
      if (config.booking_enabled === false) {
        console.log('[ai-booking] handoff_to_booking=true but booking_enabled=false - blocking handoff');
        await sendWhatsAppMessage(config, phone, MESSAGES.bookingMaintenance);
        return;
      }

      console.log('[ai-booking] AI requested handoff to booking flow');
      
      // Clear the AI conversation to avoid confusion
      if (conversationId) {
        await supabase
          .from('whatsapp_ai_conversations')
          .delete()
          .eq('id', conversationId);
      }
      
      // Create a booking session and start the flow
      await createOrResetSession(supabase, clinicId, phone, 'WAITING_CPF');
      
      // Send the booking welcome message
      const bookingWelcome = `📅 *Agendamento de Consultas*\n\n` +
        `Para iniciar seu agendamento, por favor informe seu *CPF* ou *número da carteirinha* (apenas números).\n\n` +
        `💡 Exemplos:\n` +
        `• CPF: 12345678901 (11 dígitos)\n` +
        `• Carteirinha: 000001 (5 a 10 dígitos)`;
      
      await sendWhatsAppMessage(config, phone, bookingWelcome);
      return;
    }
    
    // CHECK FOR BOLETO HANDOFF
    if (aiData.handoff_to_boleto === true) {
      console.log('[ai-booking] AI requested handoff to boleto flow');
      
      // Clear the AI conversation to avoid confusion
      if (conversationId) {
        await supabase
          .from('whatsapp_ai_conversations')
          .delete()
          .eq('id', conversationId);
      }
      
      // Call boleto flow edge function to start the flow
      const supabaseUrlEnv = Deno.env.get('SUPABASE_URL')!;
      const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
      
      try {
        const boletoResponse = await fetch(`${supabaseUrlEnv}/functions/v1/boleto-whatsapp-flow`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({
            clinic_id: clinicId,
            phone: phone,
            action: 'start',
            evolution_config: {
              api_url: config.api_url,
              api_key: config.api_key,
              instance_name: config.instance_name,
            }
          }),
        });

        if (boletoResponse.ok) {
          const boletoResult = await boletoResponse.json();
          console.log(`[ai-booking] Boleto flow started: state=${boletoResult.state}`);
        } else {
          const errorText = await boletoResponse.text();
          console.error('[ai-booking] Boleto flow error:', errorText);
          await sendWhatsAppMessage(config, phone, 'Desculpe, ocorreu um erro ao iniciar o fluxo de boletos. Por favor, tente novamente.');
        }
      } catch (boletoError) {
        console.error('[ai-booking] Error calling boleto flow:', boletoError);
        await sendWhatsAppMessage(config, phone, 'Desculpe, ocorreu um erro. Por favor, tente novamente.');
      }
      return;
    }
    
    const responseText = aiData.response || 'Desculpe, não consegui processar sua mensagem.';

    console.log(`[ai-booking] AI response: ${responseText.substring(0, 100)}...`);

    // Update conversation history
    const updatedHistory = [
      ...conversationHistory,
      { role: 'user', content: messageText },
      { role: 'assistant', content: responseText }
    ];

    // Keep only last 20 messages to avoid token limits
    const trimmedHistory = updatedHistory.slice(-20);

    await supabase
      .from('whatsapp_ai_conversations')
      .update({
        messages: trimmedHistory,
        updated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString()
      })
      .eq('id', conversationId);

    // Send response via WhatsApp
    await sendWhatsAppMessage(config, phone, responseText);

  } catch (error) {
    console.error('[ai-booking] Error:', error);
    await sendWhatsAppMessage(config, phone, 'Desculpe, ocorreu um erro. Por favor, tente novamente.');
  }
}

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
  
  // Define registration states that should NOT allow navigation/interruption
  const registrationStates: BookingState[] = [
    'OFFER_REGISTRATION',
    'SELECT_REGISTRATION_TYPE', 
    'WAITING_REGISTRATION_DEPENDENT_CPF',
    'WAITING_REGISTRATION_TITULAR_CPF',
    'SELECT_INSURANCE_PLAN',
    'WAITING_REGISTRATION_NAME',
    'WAITING_REGISTRATION_BIRTHDATE',
    'WAITING_REGISTRATION_RELATIONSHIP',
    'WAITING_REGISTRATION_CNPJ',
    'CONFIRM_COMPANY',
    'CONFIRM_REGISTRATION',
    'WAITING_DEPENDENT_CPF_PHOTO'
  ];
  
  // States that are purely registration (not booking) - allow even when booking disabled
  const pureRegistrationStates: BookingState[] = [
    'OFFER_REGISTRATION',
    'SELECT_REGISTRATION_TYPE', 
    'WAITING_REGISTRATION_DEPENDENT_CPF',
    'WAITING_REGISTRATION_TITULAR_CPF',
    'SELECT_INSURANCE_PLAN',
    'WAITING_REGISTRATION_NAME',
    'WAITING_REGISTRATION_BIRTHDATE',
    'WAITING_REGISTRATION_RELATIONSHIP',
    'WAITING_REGISTRATION_CNPJ',
    'CONFIRM_COMPANY',
    'CONFIRM_REGISTRATION',
    'WAITING_DEPENDENT_CPF_PHOTO'
  ];
  
  // States that involve actual booking - block when booking disabled
  const bookingStates: BookingState[] = [
    'SELECT_BOOKING_FOR',
    'SELECT_PROFESSIONAL',
    'SELECT_PROCEDURE',
    'SELECT_DATE',
    'SELECT_TIME',
    'CONFIRM_APPOINTMENT',
    'RESCHEDULE_SELECT_DATE',
    'RESCHEDULE_SELECT_TIME',
    'CONFIRM_RESCHEDULE'
  ];
  
  const isInRegistrationFlow = session && registrationStates.includes(session.state as BookingState);
  const isInBookingFlow = session && bookingStates.includes(session.state as BookingState);
  const isInPureRegistration = session && pureRegistrationStates.includes(session.state as BookingState);
  
  // CRITICAL: Check if booking is disabled GLOBALLY - block all booking-related flows
  if (config.booking_enabled === false && isInBookingFlow) {
    console.log(`[booking] GLOBAL BLOCK: booking_enabled=false, blocking state ${session?.state} for clinic ${config.clinic_id}`);
    await sendWhatsAppMessage(config, phone, MESSAGES.bookingMaintenance);
    // Reset to WAITING_CPF to prevent further booking attempts
    if (session) {
      await updateSession(supabase, session.id, { state: 'FINISHED' });
    }
    return { handled: true, newState: 'FINISHED' };
  }

  // Check for global commands - BUT block MENU during registration to prevent skipping steps
  if (MENU_REGEX.test(messageText)) {
    if (isInRegistrationFlow) {
      // During registration, don't allow MENU - user must complete or explicitly cancel
      console.log(`[booking] Blocking MENU command during registration state: ${session!.state}`);
      await sendWhatsAppMessage(config, phone, 
        `⚠️ Você está no meio do cadastro e precisa completá-lo para continuar.\n\n` +
        `Por favor, responda à pergunta atual ou digite *CANCELAR* se deseja desistir do cadastro.`
      );
      return { handled: true, newState: session!.state };
    }
    await resetSession(supabase, config.clinic_id, phone);
    await sendWhatsAppMessage(config, phone, MESSAGES.welcome + MESSAGES.hintCpf);
    return { handled: true, newState: 'WAITING_CPF' };
  }
  
  // Check for explicit cancel during registration
  if (isInRegistrationFlow && /^(cancelar|desistir|sair)$/i.test(messageText.trim())) {
    console.log(`[booking] User cancelled registration at state: ${session!.state}`);
    await resetSession(supabase, config.clinic_id, phone);
    await sendWhatsAppMessage(config, phone, 
      `❌ Cadastro cancelado.\n\nSe quiser tentar novamente, digite *MENU* ou informe seu CPF.`
    );
    return { handled: true, newState: 'WAITING_CPF' };
  }

  // Fast-path CPF (don’t depend on AI; WhatsApp sometimes sends formats the AI won’t parse)
  const maybeCpf = messageText.replace(/\D/g, '');
  const skipFastPathStates: BookingState[] = ['WAITING_REGISTRATION_DEPENDENT_CPF', 'WAITING_REGISTRATION_TITULAR_CPF', 'SELECT_REGISTRATION_TYPE', 'SELECT_INSURANCE_PLAN', 'WAITING_REGISTRATION_NAME', 'WAITING_REGISTRATION_BIRTHDATE', 'WAITING_REGISTRATION_CNPJ', 'CONFIRM_COMPANY', 'CONFIRM_REGISTRATION', 'OFFER_REGISTRATION'];
  const shouldSkipFastPath = session && skipFastPathStates.includes(session.state as BookingState);
  
  if (CPF_REGEX.test(maybeCpf) && validateCpf(maybeCpf) && !shouldSkipFastPath) {
    const currentSession = session ?? await createOrResetSession(supabase, config.clinic_id, phone, 'WAITING_CPF');
    return await handleWaitingCpf(supabase, config, phone, maybeCpf, currentSession);
  }

  // Fast-path for card numbers (5-10 digits) - bypass AI to avoid misclassification
  if (maybeCpf.length >= 5 && maybeCpf.length <= 10 && !shouldSkipFastPath) {
    console.log(`[booking] Fast-path for card number (${maybeCpf.length} digits): ${maybeCpf}`);
    const currentSession = session ?? await createOrResetSession(supabase, config.clinic_id, phone, 'WAITING_CPF');
    return await handleWaitingCpf(supabase, config, phone, maybeCpf, currentSession);
  }

  // Fast-path for card numbers with prefix (e.g., SECMI-000001)
  const cardPrefixMatch = messageText.toUpperCase().match(/^([A-Z]+-)?(\d{5,10})$/);
  if (cardPrefixMatch && !shouldSkipFastPath) {
    console.log(`[booking] Fast-path for prefixed card: ${messageText}`);
    const currentSession = session ?? await createOrResetSession(supabase, config.clinic_id, phone, 'WAITING_CPF');
    return await handleWaitingCpf(supabase, config, phone, messageText, currentSession);
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
    // Extract CPF from AI if detected - BUT skip during registration states where CPF has different meaning
    const skipAiCpfStates: BookingState[] = ['WAITING_REGISTRATION_DEPENDENT_CPF', 'WAITING_REGISTRATION_TITULAR_CPF', 'SELECT_REGISTRATION_TYPE', 'SELECT_INSURANCE_PLAN', 'WAITING_REGISTRATION_NAME', 'WAITING_REGISTRATION_BIRTHDATE', 'WAITING_REGISTRATION_CNPJ', 'CONFIRM_COMPANY', 'CONFIRM_REGISTRATION', 'OFFER_REGISTRATION'];
    const shouldSkipAiCpf = skipAiCpfStates.includes(session.state as BookingState);
    
    if (aiResult.entities?.cpf && !shouldSkipAiCpf) {
      const cleanCpf = aiResult.entities.cpf.replace(/\D/g, '');
      if (CPF_REGEX.test(cleanCpf) && validateCpf(cleanCpf)) {
        console.log('[booking] AI detected valid CPF:', cleanCpf.slice(0, 3) + '***');
        return await handleWaitingCpf(supabase, config, phone, cleanCpf, session);
      }
    }

    // Handle INFO intent - respond to informational questions without requiring CPF
    // BUT block during registration to prevent skipping steps
    if (aiResult.intent === 'info' && aiResult.friendly_response && !isInRegistrationFlow) {
      console.log('[booking] AI detected info intent - responding directly');
      const infoMsg = `${aiResult.friendly_response}\n\n` +
        '💡 Posso ajudar com mais alguma coisa?\n\n' +
        '📅 Para *agendar*, *cancelar* ou *consultar* suas consultas, basta me informar seu CPF.';
      
      await sendWhatsAppMessage(config, phone, infoMsg);
      return { handled: true, newState: session.state };
    }

    // Handle QUERY_SCHEDULE intent - respond with professional schedules without requiring CPF
    // BUT block during registration to prevent skipping steps
    if (aiResult.intent === 'query_schedule' && !isInRegistrationFlow) {
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
    // BUT NEVER allow navigation away from registration states - user MUST complete registration flow
    // (registrationStates and isInRegistrationFlow are already defined at the top of the function)
    
    // Block navigation intents during registration - user must complete the flow
    if (isInRegistrationFlow && ['schedule', 'cancel', 'reschedule', 'list'].includes(aiResult.intent)) {
      console.log(`[booking] Blocking ${aiResult.intent} intent during registration state: ${session.state}`);
      // Don't navigate, let the state handler process the message
    } else {
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
    
    // Registration flow states
    case 'OFFER_REGISTRATION':
      return await handleOfferRegistration(supabase, config, phone, messageText, session);
    
    case 'SELECT_REGISTRATION_TYPE':
      return await handleSelectRegistrationType(supabase, config, phone, messageText, session);

    case 'WAITING_REGISTRATION_DEPENDENT_CPF':
      return await handleWaitingRegistrationDependentCpf(supabase, config, phone, messageText, session!);
    
    case 'WAITING_REGISTRATION_TITULAR_CPF':
      return await handleWaitingRegistrationTitularCpf(supabase, config, phone, messageText, session!);

    case 'SELECT_INSURANCE_PLAN':
      return await handleSelectInsurancePlan(supabase, config, phone, messageText, session!);
    
    case 'WAITING_REGISTRATION_NAME':
      return await handleWaitingRegistrationName(supabase, config, phone, messageText, session);
    
    case 'WAITING_REGISTRATION_BIRTHDATE':
      return await handleWaitingRegistrationBirthdate(supabase, config, phone, messageText, session);
    
    case 'WAITING_REGISTRATION_RELATIONSHIP':
      return await handleWaitingRegistrationRelationship(supabase, config, phone, messageText, session);
    
    case 'WAITING_DEPENDENT_CPF_PHOTO':
      return await handleWaitingDependentCpfPhoto(supabase, config, phone, messageText, session);
    
    case 'WAITING_REGISTRATION_CNPJ':
      return await handleWaitingRegistrationCnpj(supabase, config, phone, messageText, session);
    
    case 'CONFIRM_COMPANY':
      return await handleConfirmCompany(supabase, config, phone, messageText, session);
    
    case 'CONFIRM_REGISTRATION':
      return await handleConfirmRegistration(supabase, config, phone, messageText, session);
    
    case 'FINISHED':
      // Only restart if user explicitly wants to (typed menu, agendar, etc.)
      if (MENU_REGEX.test(messageText)) {
        await createOrResetSession(supabase, config.clinic_id, phone, 'WAITING_CPF');
        await sendWhatsAppMessage(config, phone, MESSAGES.welcome);
        return { handled: true, newState: 'WAITING_CPF' };
      }
      // Otherwise, silently ignore or send a polite message
      await sendWhatsAppMessage(config, phone, 
        `✅ Seu agendamento já foi confirmado!\n\nPara fazer outro agendamento, digite *MENU*.`
      );
      return { handled: true, newState: 'FINISHED' };
    
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
// CARD NUMBER SEARCH HANDLER
// ==========================================

async function handleCardNumberSearch(
  supabase: SupabaseClient,
  config: EvolutionConfig,
  phone: string,
  cardNumbers: string,
  session: BookingSession
): Promise<{ handled: boolean; newState?: BookingState }> {
  console.log(`[booking] Searching by card number: ${cardNumbers}`);
  
  // Fetch clinic name for messages
  const { data: clinicInfo } = await supabase
    .from('clinics')
    .select('name')
    .eq('id', config.clinic_id)
    .single();
  const clinicName = clinicInfo?.name || 'a clínica';

  // 1. Search in patient_cards (titulares)
  const { data: patientCard } = await supabase
    .from('patient_cards')
    .select('patient_id, expires_at, is_active, card_number')
    .eq('clinic_id', config.clinic_id)
    .eq('is_active', true)
    .or(`card_number.ilike.%${cardNumbers},card_number.ilike.%-${cardNumbers}`)
    .maybeSingle();

  if (patientCard) {
    // Check if card is expired
    if (patientCard.expires_at && new Date(patientCard.expires_at) < new Date()) {
      await sendWhatsAppMessage(config, phone, 
        `❌ Sua carteirinha (${patientCard.card_number}) está *vencida*.\n\nPor favor, renove para poder agendar.`);
      return { handled: true, newState: 'WAITING_CPF' };
    }
    
    // Get patient data
    const { data: patient } = await supabase
      .from('patients')
      .select('id, name, cpf, is_active, inactivation_reason')
      .eq('id', patientCard.patient_id)
      .maybeSingle();
    
    if (!patient) {
      await sendWhatsAppMessage(config, phone, 
        `❌ Carteirinha não encontrada.\n\nVerifique o número ou informe seu *CPF*.`);
      return { handled: true, newState: 'WAITING_CPF' };
    }
    
    if (patient.is_active === false) {
      console.log(`[booking] Patient ${patient.id} is inactive. Reason: ${patient.inactivation_reason}`);
      await sendWhatsAppMessage(config, phone, MESSAGES.patientInactive(clinicName, patient.inactivation_reason));
      return { handled: true, newState: 'FINISHED' };
    }

    // Fetch patient's dependents
    const { data: dependents } = await supabase
      .from('patient_dependents')
      .select('id, name, relationship, card_expires_at')
      .eq('patient_id', patient.id)
      .eq('is_active', true)
      .order('name');

    const dependentsData = (dependents || []) as Array<{ id: string; name: string; relationship: string | null; card_expires_at: string | null }>;
    console.log(`[booking] Found ${dependentsData.length} dependents for patient ${patient.id}`);
    
    await updateSession(supabase, session.id, {
      state: 'CONFIRM_IDENTITY',
      patient_id: patient.id,
      patient_name: patient.name,
      available_dependents: dependentsData.length > 0 ? dependentsData : null,
      is_dependent_direct_booking: false,
    });
    
    await sendWhatsAppButtons(
      config,
      phone,
      '🔐 Confirmação',
      `Encontramos o cadastro em nome de *${patient.name}*.\n\nConfirma que é você?`,
      [
        { id: 'confirm_yes', text: '✅ Sim, sou eu' },
        { id: 'confirm_no', text: '❌ Não sou eu' }
      ],
      'Responda 1 ou 2'
    );
    
    return { handled: true, newState: 'CONFIRM_IDENTITY' };
  }

  // 2. Search in patient_dependents
  const { data: dependent } = await supabase
    .from('patient_dependents')
    .select('id, name, patient_id, card_number, card_expires_at, relationship')
    .eq('clinic_id', config.clinic_id)
    .eq('is_active', true)
    .or(`card_number.ilike.%${cardNumbers},card_number.ilike.%-${cardNumbers}`)
    .maybeSingle();

  if (dependent) {
    // Check if dependent card is expired
    if (dependent.card_expires_at && new Date(dependent.card_expires_at) < new Date()) {
      const formattedExpiry = new Date(dependent.card_expires_at).toLocaleDateString('pt-BR');
      await sendWhatsAppMessage(config, phone, MESSAGES.dependentCardExpired(dependent.name, formattedExpiry));
      return { handled: true, newState: 'WAITING_CPF' };
    }
    
    // Get titular patient data
    const { data: titularPatient } = await supabase
      .from('patients')
      .select('id, name, is_active, inactivation_reason')
      .eq('id', dependent.patient_id)
      .maybeSingle();
    
    if (!titularPatient) {
      await sendWhatsAppMessage(config, phone, 
        `❌ Carteirinha não encontrada.\n\nVerifique o número ou informe seu *CPF*.`);
      return { handled: true, newState: 'WAITING_CPF' };
    }
    
    if (titularPatient.is_active === false) {
      console.log(`[booking] Titular patient ${titularPatient.id} is inactive. Dependent cannot book.`);
      await sendWhatsAppMessage(config, phone, MESSAGES.patientInactive(clinicName, titularPatient.inactivation_reason));
      return { handled: true, newState: 'FINISHED' };
    }

    // For dependent direct booking
    await updateSession(supabase, session.id, {
      state: 'CONFIRM_IDENTITY',
      patient_id: titularPatient.id,
      patient_name: titularPatient.name,
      selected_dependent_id: dependent.id,
      selected_dependent_name: dependent.name,
      booking_for: 'dependent',
      is_dependent_direct_booking: true,
      available_dependents: null,
    });

    await sendWhatsAppButtons(
      config,
      phone,
      '🔐 Confirmação',
      `Encontramos o cadastro em nome de *${dependent.name}*.\n\nConfirma que é você?`,
      [
        { id: 'confirm_yes', text: '✅ Sim, sou eu' },
        { id: 'confirm_no', text: '❌ Não sou eu' }
      ],
      'Responda 1 ou 2'
    );

    return { handled: true, newState: 'CONFIRM_IDENTITY' };
  }

  // 3. Not found
  await sendWhatsAppMessage(config, phone, 
    `❌ Carteirinha não encontrada.\n\nVerifique o número ou informe seu *CPF*.`);
  return { handled: true, newState: 'WAITING_CPF' };
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
  // Check if user clicked "Fazer cadastro" button from the identity denial flow
  if (messageText === 'new_register' || messageText === '2') {
    // User wants to register - go to registration type selection
    await updateSession(supabase, session.id, { state: 'SELECT_REGISTRATION_TYPE' });
    await sendWhatsAppButtons(
      config,
      phone,
      '📝 Tipo de Cadastro',
      MESSAGES.selectRegistrationType,
      [
        { id: 'reg_titular', text: '1️⃣ Titular' },
        { id: 'reg_dependent', text: '2️⃣ Dependente' }
      ],
      'Responda 1 ou 2'
    );
    return { handled: true, newState: 'SELECT_REGISTRATION_TYPE' };
  }

  // Check if user clicked "retry_cpf" button - just prompt for CPF again
  if (messageText === 'retry_cpf' || messageText === '1') {
    // Check if this is truly the first time (not a number being treated as a CPF)
    // Only handle as retry if session was just reset (no patient_id)
    if (!session.patient_id) {
      await sendWhatsAppMessage(config, phone, `📋 Por favor, informe seu *CPF* ou *número da carteirinha* (apenas números):`);
      return { handled: true, newState: 'WAITING_CPF' };
    }
  }

  // Check if input contains card prefix (e.g., SECMI-000001)
  const cardPrefixMatch = messageText.toUpperCase().match(/^([A-Z]+-)?(\d{5,10})$/);
  if (cardPrefixMatch) {
    const cardDigits = cardPrefixMatch[2];
    console.log(`[booking] Card format detected: ${messageText} -> digits: ${cardDigits}`);
    return await handleCardNumberSearch(supabase, config, phone, cardDigits, session);
  }
  
  // Extract only numbers from input
  const numbersOnly = messageText.replace(/\D/g, '');
  
  // If exactly 11 digits, treat as CPF
  if (numbersOnly.length === 11) {
    if (!validateCpf(numbersOnly)) {
      await sendWhatsAppMessage(config, phone, MESSAGES.cpfInvalid + MESSAGES.hintCpf);
      return { handled: true, newState: 'WAITING_CPF' };
    }
    // Continue with CPF flow (existing logic below will handle it)
  }
  // If 5-10 digits, treat as card number
  else if (numbersOnly.length >= 5 && numbersOnly.length <= 10) {
    return await handleCardNumberSearch(supabase, config, phone, numbersOnly, session);
  }
  // Otherwise, invalid input
  else {
    await sendWhatsAppMessage(config, phone, MESSAGES.cpfInvalid + MESSAGES.hintCpf);
    return { handled: true, newState: 'WAITING_CPF' };
  }

  const cleanCpf = numbersOnly;

  const phoneCandidates = getBrazilPhoneVariants(phone);

  // Fetch clinic name for messages
  const { data: clinicInfo } = await supabase
    .from('clinics')
    .select('name')
    .eq('id', config.clinic_id)
    .single();
  const clinicName = clinicInfo?.name || 'a clínica';
  
  // First, try to find a titular patient by CPF
  // Support both formatted (XXX.XXX.XXX-XX) and unformatted (XXXXXXXXXXX) CPF
  const formattedCpf = cleanCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  console.log(`[booking] Searching patient by CPF: ${cleanCpf.substring(0, 3)}*** or formatted ${formattedCpf.substring(0, 7)}***`);
  
  const { data: patient, error } = await supabase
    .from('patients')
    .select('id, name, cpf, is_active, inactivation_reason')
    .eq('clinic_id', config.clinic_id)
    .or(`cpf.eq.${cleanCpf},cpf.eq.${formattedCpf}`)
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
    // Support both formatted and unformatted CPF for dependents
    // CRITICAL: Also check pending_approval to block dependents awaiting approval
    const { data: dependentByCpf } = await supabase
      .from('patient_dependents')
      .select('id, name, cpf, patient_id, card_expires_at, relationship, is_active, pending_approval')
      .eq('clinic_id', config.clinic_id)
      .or(`cpf.eq.${cleanCpf},cpf.eq.${formattedCpf}`)
      .maybeSingle();

    if (dependentByCpf) {
      console.log(`[booking] Found dependent by CPF: ${dependentByCpf.name} (${dependentByCpf.id}), is_active=${dependentByCpf.is_active}, pending_approval=${dependentByCpf.pending_approval}`);
      
      // CRITICAL: Block dependents with pending_approval or inactive status
      if (dependentByCpf.pending_approval === true || dependentByCpf.is_active === false) {
        console.log(`[booking] Dependent ${dependentByCpf.id} blocked: pending_approval=${dependentByCpf.pending_approval}, is_active=${dependentByCpf.is_active}`);
        await sendWhatsAppMessage(config, phone, 
          `⏳ *Cadastro Pendente de Aprovação*\n\n` +
          `Olá! O cadastro de *${dependentByCpf.name}* ainda está *aguardando aprovação* pela nossa equipe.\n\n` +
          `📋 Você será notificado assim que o cadastro for aprovado.\n\n` +
          `Enquanto isso, não é possível realizar agendamentos.\n\n` +
          `Em caso de dúvidas, entre em contato com o sindicato.`
        );
        return { handled: true, newState: 'FINISHED' };
      }
      
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
      // Patient not found - offer registration
      console.log(`[booking] Patient not found for CPF ${cleanCpf}, offering registration`);
      await updateSession(supabase, session.id, {
        state: 'OFFER_REGISTRATION',
        pending_registration_cpf: cleanCpf,
      });
      await sendWhatsAppButtons(
        config,
        phone,
        '📝 Cadastro',
        MESSAGES.patientNotFound,
        [
          { id: 'register_yes', text: '✅ Sim, cadastrar' },
          { id: 'register_no', text: '❌ Não' }
        ],
        'Responda 1 ou 2'
      );
      return { handled: true, newState: 'OFFER_REGISTRATION' };
    }

    // Check if patient found by phone is inactive
    if (patientData.is_active === false) {
      console.log(`[booking] Patient ${patientData.id} (by phone) is inactive. Reason: ${patientData.inactivation_reason}`);
      await sendWhatsAppMessage(config, phone, MESSAGES.patientInactive(clinicName, patientData.inactivation_reason));
      return { handled: true, newState: 'FINISHED' };
    }
  }

  // Fetch patient's dependents (for titular flow)
  // CRITICAL: Filter out dependents with pending_approval to prevent booking
  const { data: dependents } = await supabase
    .from('patient_dependents')
    .select('id, name, relationship, card_expires_at, pending_approval')
    .eq('patient_id', patientData.id)
    .eq('is_active', true)
    .or('pending_approval.is.null,pending_approval.eq.false')
    .order('name');

  const dependentsData = (dependents || []) as Array<{ id: string; name: string; relationship: string | null; card_expires_at: string | null }>;
  console.log(`[booking] Found ${dependentsData.length} approved dependents for patient ${patientData.id}`);

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
    // CRITICAL: Check patient card validity IMMEDIATELY after identity confirmation
    if (!session.patient_id) {
      console.warn('[booking] proceedAfterConfirmation called without patient_id; skipping card validation');
    } else {
      const { data: cardCheck, error: cardCheckError } = await supabase.rpc('is_patient_card_valid', {
        p_patient_id: session.patient_id,
        p_clinic_id: config.clinic_id,
      });

      if (cardCheckError) {
        console.error('[booking] Error checking patient card validity:', cardCheckError);
      }

      const cardRow: any = Array.isArray(cardCheck) ? cardCheck[0] : cardCheck;
      console.log('[booking] Card validity check result:', cardRow);

      if (cardRow && cardRow.card_number && cardRow.is_valid === false) {
        console.log(`[booking] Patient card expired at identity confirmation: ${cardRow.card_number}`);

        // Get the card ID for payslip request
        const { data: patientCard } = await supabase
          .from('patient_cards')
          .select('id, card_number, expires_at')
          .eq('patient_id', session.patient_id)
          .eq('clinic_id', config.clinic_id)
          .eq('is_active', true)
          .order('expires_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (patientCard) {
          // Check if there's already a pending payslip request
          const { data: existingRequest } = await supabase
            .from('payslip_requests')
            .select('id, status')
            .eq('patient_id', session.patient_id)
            .eq('clinic_id', config.clinic_id)
            .in('status', ['pending', 'received'])
            .maybeSingle();

          if (existingRequest) {
            console.log(`[booking] Patient already has pending payslip request: ${existingRequest.id}`);
            if (existingRequest.status === 'pending') {
              await sendWhatsAppMessage(
                config,
                phone,
                `📋 Olá, *${session.patient_name}*!

` +
                  `Sua carteirinha (${cardRow.card_number}) está *vencida*.

` +
                  `Você já tem uma solicitação de renovação em aberto!

` +
                  `📸 *Envie uma foto do seu contracheque* para que possamos renovar sua carteirinha.

` +
                  `Após o envio, aguarde a análise (até 48h úteis).`
              );
            } else {
              await sendWhatsAppMessage(
                config,
                phone,
                `📋 Olá, *${session.patient_name}*!

` +
                  `Sua carteirinha (${cardRow.card_number}) está *vencida*.

` +
                  `✅ Recebemos seu contracheque e ele está *em análise*.

` +
                  `Aguarde a liberação (até 48h úteis). Você receberá uma mensagem assim que for aprovado! 🙏`
              );
            }
          } else {
            // Create new payslip request
            const { data: newRequest, error: requestError } = await supabase
              .from('payslip_requests')
              .insert({
                clinic_id: config.clinic_id,
                patient_id: session.patient_id,
                card_id: patientCard.id,
                status: 'pending',
              })
              .select('id')
              .single();

            if (requestError) {
              console.error('[booking] Error creating payslip request:', requestError);
            } else {
              console.log(`[booking] Created payslip request: ${newRequest.id}`);
            }

            await sendWhatsAppMessage(
              config,
              phone,
              `📋 Olá, *${session.patient_name}*!

` +
                `Sua carteirinha (${cardRow.card_number}) está *vencida*.

` +
                `Para renovar, precisamos verificar seu vínculo empregatício.

` +
                `📸 *Por favor, envie uma foto do seu contracheque* (holerite) mais recente.

` +
                `⚠️ *Importante:*
` +
                `• A foto deve estar legível
` +
                `• Deve constar seu nome e data
` +
                `• Após o envio, aguarde a análise (até 48h úteis)

` +
                `_Você receberá uma confirmação assim que enviar a imagem._`
            );
          }
        } else {
          await sendWhatsAppMessage(
            config,
            phone,
            `❌ Olá, *${session.patient_name}*!

Sua carteirinha está vencida.

Por favor, entre em contato com a clínica para renovar sua carteirinha.`
          );
        }

        await updateSession(supabase, session.id, { state: 'FINISHED' });
        return { handled: true, newState: 'FINISHED' };
      }
    }

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
    
    // No dependents - go directly to professional selection (skip main menu for faster flow)
    return await proceedToSelectProfessional(supabase, config, phone, session, 'titular', null, null);
  };

  // Check for interactive button response first
  if (messageText === 'confirm_yes' || messageText.toLowerCase() === 'sim, sou eu' || messageText.toLowerCase() === '✅ sim, sou eu') {
    return await proceedAfterConfirmation();
  }
  
  if (messageText === 'confirm_no' || messageText.toLowerCase() === 'não sou eu' || messageText.toLowerCase() === '❌ não sou eu') {
    // Instead of just ending, offer alternatives
    await updateSession(supabase, session.id, { 
      state: 'WAITING_CPF',
      patient_id: null,
      patient_name: null,
    });
    await sendWhatsAppButtons(
      config,
      phone,
      '🔄 Próximos passos',
      `Sem problemas! Você pode:\n\n1️⃣ *Tentar outro CPF* - talvez tenha digitado errado\n2️⃣ *Fazer novo cadastro* - se ainda não é cadastrado`,
      [
        { id: 'retry_cpf', text: '1️⃣ Digitar outro CPF' },
        { id: 'new_register', text: '2️⃣ Fazer cadastro' }
      ],
      'Responda 1 ou 2'
    );
    return { handled: true, newState: 'WAITING_CPF' };
  }

  // Try regex patterns
  if (POSITIVE_REGEX.test(messageText)) {
    return await proceedAfterConfirmation();
  }

  if (NEGATIVE_REGEX.test(messageText)) {
    // Instead of just ending, offer alternatives
    await updateSession(supabase, session.id, { 
      state: 'WAITING_CPF',
      patient_id: null,
      patient_name: null,
    });
    await sendWhatsAppButtons(
      config,
      phone,
      '🔄 Próximos passos',
      `Sem problemas! Você pode:\n\n1️⃣ *Tentar outro CPF* - talvez tenha digitado errado\n2️⃣ *Fazer novo cadastro* - se ainda não é cadastrado`,
      [
        { id: 'retry_cpf', text: '1️⃣ Digitar outro CPF' },
        { id: 'new_register', text: '2️⃣ Fazer cadastro' }
      ],
      'Responda 1 ou 2'
    );
    return { handled: true, newState: 'WAITING_CPF' };
  }

  // Try AI for natural language confirmation
  const aiResult = await getAIIntent(messageText, 'CONFIRM_IDENTITY');
  console.log('[identity] AI result:', aiResult);

  if (aiResult.confidence >= 0.7) {
    if (aiResult.intent === 'confirm') {
      return await proceedAfterConfirmation();
    }
    if (aiResult.intent === 'deny') {
      // Instead of just ending, offer alternatives
      await updateSession(supabase, session.id, { 
        state: 'WAITING_CPF',
        patient_id: null,
        patient_name: null,
      });
      await sendWhatsAppButtons(
        config,
        phone,
        '🔄 Próximos passos',
        `Sem problemas! Você pode:\n\n1️⃣ *Tentar outro CPF* - talvez tenha digitado errado\n2️⃣ *Fazer novo cadastro* - se ainda não é cadastrado`,
        [
          { id: 'retry_cpf', text: '1️⃣ Digitar outro CPF' },
          { id: 'new_register', text: '2️⃣ Fazer cadastro' }
        ],
        'Responda 1 ou 2'
      );
      return { handled: true, newState: 'WAITING_CPF' };
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
  patientName: string,
  bookingEnabled: boolean = true
): Promise<boolean> {
  const buttons = bookingEnabled
    ? [
        { id: 'menu_schedule', text: '📅 Agendar' },
        { id: 'menu_cancel', text: '❌ Cancelar' },
        { id: 'menu_list', text: '📋 Minhas consultas' }
      ]
    : [
        { id: 'menu_cancel', text: '❌ Cancelar' },
        { id: 'menu_list', text: '📋 Minhas consultas' }
      ];

  return await sendWhatsAppButtons(
    config,
    phone,
    '📋 Menu Principal',
    `Olá, *${patientName}*! 👋\n\nO que você gostaria de fazer?`,
    buttons,
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
  // CRITICAL: Check if booking is enabled BEFORE proceeding to any booking flow
  if (config.booking_enabled === false) {
    console.log(`[booking] Booking disabled for clinic ${config.clinic_id} - blocking at proceedToSelectProfessional`);
    await sendWhatsAppMessage(config, phone, MESSAGES.bookingMaintenance);
    return { handled: true, newState: 'FINISHED' };
  }

  // CRITICAL: If booking for dependent, verify dependent is approved and active
  if (bookingFor === 'dependent' && dependentId) {
    const { data: dependentCheck } = await supabase
      .from('patient_dependents')
      .select('id, name, is_active, pending_approval')
      .eq('id', dependentId)
      .single();
    
    if (dependentCheck?.pending_approval === true || dependentCheck?.is_active === false) {
      console.log(`[booking] Dependent ${dependentId} blocked at proceedToSelectProfessional: pending_approval=${dependentCheck?.pending_approval}, is_active=${dependentCheck?.is_active}`);
      await sendWhatsAppMessage(config, phone, 
        `⏳ *Cadastro Pendente de Aprovação*\n\n` +
        `O cadastro de *${dependentName || 'dependente'}* ainda está *aguardando aprovação*.\n\n` +
        `Você será notificado quando o cadastro for aprovado.`
      );
      return { handled: true, newState: 'FINISHED' };
    }
  }

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
  const bookingEnabled = config.booking_enabled !== false;

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
  // Then check traditional numeric patterns - adjust based on booking_enabled
  else if (bookingEnabled) {
    // With booking: 1=schedule, 2=cancel, 3=reschedule, 4=list
    if (choice === '1') intent = 'schedule';
    else if (choice === '2') intent = 'cancel';
    else if (choice === '3') intent = 'reschedule';
    else if (choice === '4') intent = 'list';
  } else {
    // Without booking: 1=cancel, 2=reschedule, 3=list, 6=boleto
    if (choice === '1') intent = 'cancel';
    else if (choice === '2') intent = 'reschedule';
    else if (choice === '3') intent = 'list';
    else if (choice === '6') {
      // Option 6 = boleto flow when booking is disabled
      console.log('[menu] Option 6 selected with booking disabled - redirecting to boleto flow');
      const supabaseUrlEnv = Deno.env.get('SUPABASE_URL') || '';
      try {
        const boletoResponse = await fetch(`${supabaseUrlEnv}/functions/v1/boleto-whatsapp-flow`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''}`,
          },
          body: JSON.stringify({
            clinic_id: config.clinic_id,
            phone,
            evolution_config: config,
          }),
        });
        if (boletoResponse.ok) {
          console.log('[menu] Boleto flow initiated from option 6 (no booking)');
        } else {
          const errorText = await boletoResponse.text();
          console.error('[menu] Boleto flow error from option 6:', errorText);
          await sendWhatsAppMessage(config, phone, 'Desculpe, ocorreu um erro ao iniciar o fluxo de boletos. Por favor, tente novamente.');
        }
      } catch (boletoError) {
        console.error('[menu] Exception calling boleto flow from option 6:', boletoError);
        await sendWhatsAppMessage(config, phone, 'Desculpe, ocorreu um erro ao iniciar o fluxo de boletos.');
      }
      return { handled: true, newState: 'MAIN_MENU' };
    }
  }
  
  // Try AI for natural language if no intent yet
  if (!intent) {
    const aiResult = await getAIIntent(messageText, 'MAIN_MENU');
    console.log('[menu] AI result:', aiResult);
    
    if (aiResult.confidence >= 0.7) {
      if (aiResult.intent === 'schedule') intent = 'schedule';
      else if (aiResult.intent === 'cancel') intent = 'cancel';
      else if (aiResult.intent === 'reschedule') intent = 'reschedule';
      else if (aiResult.intent === 'list') intent = 'list';
      else if (aiResult.intent === 'select_option' && aiResult.entities.option_number) {
        const num = aiResult.entities.option_number;
        if (bookingEnabled) {
          if (num === 1) intent = 'schedule';
          else if (num === 2) intent = 'cancel';
          else if (num === 3) intent = 'reschedule';
          else if (num === 4) intent = 'list';
        } else {
          if (num === 1) intent = 'cancel';
          else if (num === 2) intent = 'reschedule';
          else if (num === 3) intent = 'list';
        }
      }
    }
  }

  // Handle schedule intent - check if booking is enabled
  if (intent === 'schedule') {
    if (!bookingEnabled) {
      await sendWhatsAppMessage(config, phone, MESSAGES.bookingMaintenance);
      return { handled: true, newState: 'MAIN_MENU' };
    }
    
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

  // Fallback - didn't understand (show appropriate menu)
  const fallbackMsg = bookingEnabled
    ? `Não entendi. Por favor, escolha uma opção:\n\n1️⃣ Agendar\n2️⃣ Cancelar\n3️⃣ Reagendar\n4️⃣ Ver consultas\n\n_Ou diga o que deseja fazer (ex: "quero marcar consulta")_`
    : `Não entendi. Por favor, escolha uma opção:\n\n1️⃣ Cancelar\n2️⃣ Reagendar\n3️⃣ Ver consultas\n\n_Ou diga o que deseja fazer_`;
  
  await sendWhatsAppMessage(config, phone, fallbackMsg + MESSAGES.hintMenu);
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
// REGISTRATION FLOW HANDLERS
// ==========================================

async function handleOfferRegistration(
  supabase: SupabaseClient,
  config: EvolutionConfig,
  phone: string,
  messageText: string,
  session: BookingSession
): Promise<{ handled: boolean; newState?: BookingState }> {
  const isYes = POSITIVE_REGEX.test(messageText) || messageText.includes('register_yes') || messageText === '1';
  const isNo = NEGATIVE_REGEX.test(messageText) || messageText.includes('register_no') || messageText === '2';
  
  if (isYes) {
    // Go to registration type selection first
    await updateSession(supabase, session.id, { state: 'SELECT_REGISTRATION_TYPE' });
    await sendWhatsAppButtons(
      config,
      phone,
      '📝 Tipo de Cadastro',
      MESSAGES.selectRegistrationType,
      [
        { id: 'reg_titular', text: '1️⃣ Titular' },
        { id: 'reg_dependent', text: '2️⃣ Dependente' }
      ],
      'Responda 1 ou 2'
    );
    return { handled: true, newState: 'SELECT_REGISTRATION_TYPE' };
  }
  
  if (isNo) {
    await updateSession(supabase, session.id, { state: 'FINISHED' });
    await sendWhatsAppMessage(config, phone, `Tudo bem! Se precisar, entre em contato conosco por outros meios. Até breve! 👋`);
    return { handled: true, newState: 'FINISHED' };
  }
  
  // Invalid response
  await sendWhatsAppMessage(config, phone, `Por favor, responda *1* para cadastrar ou *2* para não.`);
  return { handled: true, newState: 'OFFER_REGISTRATION' };
}

// Handler for SELECT_REGISTRATION_TYPE state
async function handleSelectRegistrationType(
  supabase: SupabaseClient,
  config: EvolutionConfig,
  phone: string,
  messageText: string,
  session: BookingSession
): Promise<{ handled: boolean; newState?: BookingState }> {
  const isTitular = messageText === '1' || messageText.includes('reg_titular') || /titular/i.test(messageText);
  const isDependent = messageText === '2' || messageText.includes('reg_dependent') || /dependente/i.test(messageText);
  
  if (isTitular) {
    // Mark as titular and proceed to insurance plan selection
    await updateSession(supabase, session.id, {
      state: 'SELECT_INSURANCE_PLAN',
      pending_registration_type: 'titular',
    });
    return await promptInsurancePlanSelection(supabase, config, phone, session);
  }
  
  if (isDependent) {
    // For dependents, we MUST always ask the dependent's CPF.
    // Reason: the session may already have pending_registration_cpf filled with the *titular* CPF
    // from the initial "offer registration" flow, which would incorrectly be reused for the dependent.
    await updateSession(supabase, session.id, {
      state: 'WAITING_REGISTRATION_DEPENDENT_CPF',
      pending_registration_type: 'dependent',
      pending_registration_cpf: null,
      pending_registration_titular_cpf: null,
    });

    await sendWhatsAppMessage(config, phone, `📝 Informe o *CPF do dependente* (11 dígitos):`);
    return { handled: true, newState: 'WAITING_REGISTRATION_DEPENDENT_CPF' };
  }
  
  // Invalid response
  await sendWhatsAppButtons(
    config,
    phone,
    '📝 Tipo de Cadastro',
    `Por favor, escolha uma opção:\n\n1️⃣ *Titular* (paciente principal)\n2️⃣ *Dependente* de outro paciente`,
    [
      { id: 'reg_titular', text: '1️⃣ Titular' },
      { id: 'reg_dependent', text: '2️⃣ Dependente' }
    ],
    'Responda 1 ou 2'
  );
  return { handled: true, newState: 'SELECT_REGISTRATION_TYPE' };
}

// Handler for WAITING_REGISTRATION_DEPENDENT_CPF state
async function handleWaitingRegistrationDependentCpf(
  supabase: SupabaseClient,
  config: EvolutionConfig,
  phone: string,
  messageText: string,
  session: BookingSession
): Promise<{ handled: boolean; newState?: BookingState }> {
  const input = messageText.trim();
  const cleanCpf = input.replace(/\D/g, '');

  if (cleanCpf.length !== 11) {
    await sendWhatsAppMessage(config, phone, `❌ CPF inválido. Informe os 11 dígitos do CPF do dependente.`);
    return { handled: true, newState: 'WAITING_REGISTRATION_DEPENDENT_CPF' };
  }

  if (!validateCpf(cleanCpf)) {
    await sendWhatsAppMessage(config, phone, `❌ CPF com dígitos verificadores inválidos. Verifique e tente novamente.`);
    return { handled: true, newState: 'WAITING_REGISTRATION_DEPENDENT_CPF' };
  }

  // Store the dependent's CPF and proceed to ask for titular's CPF
  await updateSession(supabase, session.id, {
    state: 'WAITING_REGISTRATION_TITULAR_CPF',
    pending_registration_type: 'dependent',
    pending_registration_cpf: cleanCpf,
  });

  await sendWhatsAppMessage(config, phone, MESSAGES.askTitularCpf);
  return { handled: true, newState: 'WAITING_REGISTRATION_TITULAR_CPF' };
}

// Handler for WAITING_REGISTRATION_TITULAR_CPF state
async function handleWaitingRegistrationTitularCpf(
  supabase: SupabaseClient,
  config: EvolutionConfig,
  phone: string,
  messageText: string,
  session: BookingSession
): Promise<{ handled: boolean; newState?: BookingState }> {
  const input = messageText.trim();
  
  // Check if user wants to switch to titular
  if (input === '1') {
    await updateSession(supabase, session.id, {
      state: 'SELECT_INSURANCE_PLAN',
      pending_registration_type: 'titular',
      pending_registration_titular_cpf: null,
    });
    return await promptInsurancePlanSelection(supabase, config, phone, session);
  }
  
  // Clean and validate CPF
  const cleanCpf = input.replace(/\D/g, '');
  
  if (cleanCpf.length !== 11) {
    await sendWhatsAppMessage(config, phone, `❌ CPF inválido. Informe os 11 dígitos do CPF do titular ou digite *1* para se cadastrar como titular.`);
    return { handled: true, newState: 'WAITING_REGISTRATION_TITULAR_CPF' };
  }
  
  if (!validateCpf(cleanCpf)) {
    await sendWhatsAppMessage(config, phone, `❌ CPF com dígitos verificadores inválidos. Verifique e tente novamente.`);
    return { handled: true, newState: 'WAITING_REGISTRATION_TITULAR_CPF' };
  }
  
  // Look for titular patient - support both formatted and unformatted CPF
  const formattedTitularCpf = cleanCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  const { data: titularPatient, error } = await supabase
    .from('patients')
    .select('id, name, insurance_plan_id')
    .eq('clinic_id', config.clinic_id)
    .or(`cpf.eq.${cleanCpf},cpf.eq.${formattedTitularCpf}`)
    .eq('is_active', true)
    .maybeSingle();
  
  if (error || !titularPatient) {
    await sendWhatsAppMessage(config, phone, MESSAGES.titularNotFound);
    return { handled: true, newState: 'WAITING_REGISTRATION_TITULAR_CPF' };
  }
  
  // Store titular info and use same insurance plan as titular
  await updateSession(supabase, session.id, {
    state: 'WAITING_REGISTRATION_NAME',
    pending_registration_titular_cpf: cleanCpf,
    pending_registration_insurance_plan_id: titularPatient.insurance_plan_id,
  });
  
  const titularFirstName = titularPatient.name.split(' ')[0];
  await sendWhatsAppMessage(config, phone, `✅ Titular encontrado: *${titularPatient.name}*\n\nAgora, informe o *nome completo* do dependente:`);
  return { handled: true, newState: 'WAITING_REGISTRATION_NAME' };
}

// Helper to prompt insurance plan selection
async function promptInsurancePlanSelection(
  supabase: SupabaseClient,
  config: EvolutionConfig,
  phone: string,
  session: BookingSession
): Promise<{ handled: boolean; newState?: BookingState }> {
  // Fetch active insurance plans for the clinic
  // Exclude "Rodoviários" from the list during new registration
  const { data: allPlans, error } = await supabase
    .from('insurance_plans')
    .select('id, name')
    .eq('clinic_id', config.clinic_id)
    .eq('is_active', true)
    .order('name');
  
  // Filter out "Rodoviários" plan (case-insensitive)
  const plans = allPlans?.filter((p: { name: string }) => 
    !p.name.toLowerCase().includes('rodoviário') && 
    !p.name.toLowerCase().includes('rodoviarios')
  ) || [];
  
  if (error || !plans || plans.length === 0) {
    // No plans available, continue without one
    await updateSession(supabase, session.id, {
      state: 'WAITING_REGISTRATION_NAME',
      pending_registration_insurance_plan_id: null,
      available_insurance_plans: null,
    });
    await sendWhatsAppMessage(config, phone, MESSAGES.noInsurancePlans + `\n\n` + MESSAGES.offerRegistration);
    return { handled: true, newState: 'WAITING_REGISTRATION_NAME' };
  }
  
  // Store plans in session and show selection
  await updateSession(supabase, session.id, {
    state: 'SELECT_INSURANCE_PLAN',
    available_insurance_plans: plans,
  });
  
  // Create list sections with rows (max 10)
  const listSections: ListSection[] = [{
    title: 'Convênios Disponíveis',
    rows: plans.slice(0, 10).map((p: any, i: number) => ({
      id: `plan_${p.id}`,
      title: `${i + 1}️⃣ ${p.name}`.substring(0, 24),
      description: ''
    }))
  }];
  
  await sendWhatsAppList(
    config,
    phone,
    '🏥 Convênio',
    MESSAGES.selectInsurancePlan(plans),
    'Selecionar Convênio',
    listSections,
    'Escolha o número do convênio'
  );
  
  return { handled: true, newState: 'SELECT_INSURANCE_PLAN' };
}

// Handler for SELECT_INSURANCE_PLAN state
async function handleSelectInsurancePlan(
  supabase: SupabaseClient,
  config: EvolutionConfig,
  phone: string,
  messageText: string,
  session: BookingSession
): Promise<{ handled: boolean; newState?: BookingState }> {
  const plans = session.available_insurance_plans || [];
  
  // Try numeric selection
  const numChoice = parseInt(messageText.trim());
  let selectedPlan: { id: string; name: string } | null = null;
  
  if (!isNaN(numChoice) && numChoice >= 1 && numChoice <= plans.length) {
    selectedPlan = plans[numChoice - 1];
  } else {
    // Try to match by button ID
    const planIdMatch = messageText.match(/plan_([a-f0-9-]+)/i);
    if (planIdMatch) {
      selectedPlan = plans.find(p => p.id === planIdMatch[1]) || null;
    }
    
    // Try to match by name
    if (!selectedPlan) {
      const lowerInput = messageText.toLowerCase().trim();
      selectedPlan = plans.find(p => p.name.toLowerCase().includes(lowerInput)) || null;
    }
  }
  
  if (!selectedPlan) {
    await sendWhatsAppMessage(config, phone, `❌ Opção inválida. Por favor, digite o *número* do convênio:\n\n${plans.map((p: any, i: number) => `${i + 1}️⃣ ${p.name}`).join('\n')}`);
    return { handled: true, newState: 'SELECT_INSURANCE_PLAN' };
  }
  
  // Store selected plan and proceed to name
  await updateSession(supabase, session.id, {
    state: 'WAITING_REGISTRATION_NAME',
    pending_registration_insurance_plan_id: selectedPlan.id,
  });
  
  await sendWhatsAppMessage(config, phone, `✅ Convênio selecionado: *${selectedPlan.name}*\n\n` + MESSAGES.offerRegistration);
  return { handled: true, newState: 'WAITING_REGISTRATION_NAME' };
}

async function handleWaitingRegistrationName(
  supabase: SupabaseClient,
  config: EvolutionConfig,
  phone: string,
  messageText: string,
  session: BookingSession
): Promise<{ handled: boolean; newState?: BookingState }> {
  const name = messageText.trim();
  
  // Validate name (at least 3 characters, contains at least a space for full name)
  if (name.length < 3) {
    await sendWhatsAppMessage(config, phone, `❌ Nome muito curto. Por favor, informe seu *nome completo*:`);
    return { handled: true, newState: 'WAITING_REGISTRATION_NAME' };
  }
  
  // Store name and ask for birth date
  await updateSession(supabase, session.id, {
    state: 'WAITING_REGISTRATION_BIRTHDATE',
    pending_registration_name: name,
  });
  
  const firstName = name.split(' ')[0];
  await sendWhatsAppMessage(config, phone, MESSAGES.askBirthDate(firstName));
  return { handled: true, newState: 'WAITING_REGISTRATION_BIRTHDATE' };
}

function parseDate(dateStr: string): Date | null {
  // Try DD/MM/YYYY format
  const ddmmyyyyMatch = dateStr.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (ddmmyyyyMatch) {
    const day = parseInt(ddmmyyyyMatch[1]);
    const month = parseInt(ddmmyyyyMatch[2]) - 1;
    const year = parseInt(ddmmyyyyMatch[3]);
    const date = new Date(year, month, day);
    if (date.getDate() === day && date.getMonth() === month && date.getFullYear() === year) {
      return date;
    }
  }
  return null;
}

async function handleWaitingRegistrationBirthdate(
  supabase: SupabaseClient,
  config: EvolutionConfig,
  phone: string,
  messageText: string,
  session: BookingSession
): Promise<{ handled: boolean; newState?: BookingState }> {
  const dateStr = messageText.trim();
  const parsedDate = parseDate(dateStr);
  
  if (!parsedDate) {
    await sendWhatsAppMessage(config, phone, MESSAGES.invalidBirthDate);
    return { handled: true, newState: 'WAITING_REGISTRATION_BIRTHDATE' };
  }
  
  // Check if date is reasonable (not in future, not too old)
  const today = new Date();
  if (parsedDate > today) {
    await sendWhatsAppMessage(config, phone, `❌ A data não pode ser no futuro. Por favor, informe sua data de nascimento:`);
    return { handled: true, newState: 'WAITING_REGISTRATION_BIRTHDATE' };
  }
  
  const age = today.getFullYear() - parsedDate.getFullYear();
  if (age > 120) {
    await sendWhatsAppMessage(config, phone, `❌ Data inválida. Por favor, verifique e informe novamente:`);
    return { handled: true, newState: 'WAITING_REGISTRATION_BIRTHDATE' };
  }
  
  // Format date as YYYY-MM-DD for database
  const dbDate = parsedDate.toISOString().split('T')[0];
  const displayDate = parsedDate.toLocaleDateString('pt-BR');
  
  // Check if registering as dependent - ask for relationship
  const isDependent = session.pending_registration_type === 'dependent' && session.pending_registration_titular_cpf;
  
  if (isDependent) {
    // Ask for relationship
    await updateSession(supabase, session.id, {
      state: 'WAITING_REGISTRATION_RELATIONSHIP',
      pending_registration_birthdate: dbDate,
    });
    
    const relationshipMsg = `👨‍👩‍👧 *Qual é o parentesco com o titular?*\n\n` +
      `1️⃣ Filho(a) _(até 21 anos)_\n` +
      `2️⃣ Cônjuge\n` +
      `3️⃣ Pai\n` +
      `4️⃣ Mãe\n\n` +
      `Responda com o número correspondente:`;
    
    await sendWhatsAppMessage(config, phone, relationshipMsg);
    
    return { handled: true, newState: 'WAITING_REGISTRATION_RELATIONSHIP' };
  }
  
  // For titular, ask for CNPJ
  await updateSession(supabase, session.id, {
    state: 'WAITING_REGISTRATION_CNPJ',
    pending_registration_birthdate: dbDate,
  });
  
  await sendWhatsAppMessage(config, phone, MESSAGES.askEmployerCnpj);
  return { handled: true, newState: 'WAITING_REGISTRATION_CNPJ' };
}

// Relationship options mapping - Only allowed: filho (até 21 anos), conjuge, pai, mae
const RELATIONSHIP_OPTIONS: { [key: string]: string } = {
  '1': 'filho',
  '2': 'conjuge',
  '3': 'pai',
  '4': 'mae',
};

const RELATIONSHIP_LABELS: { [key: string]: string } = {
  'filho': 'Filho(a)',
  'conjuge': 'Cônjuge',
  'pai': 'Pai',
  'mae': 'Mãe',
};

// Calculate age from birth date
function calculateAge(birthDate: Date): number {
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

async function handleWaitingRegistrationRelationship(
  supabase: SupabaseClient,
  config: EvolutionConfig,
  phone: string,
  messageText: string,
  session: BookingSession
): Promise<{ handled: boolean; newState?: BookingState }> {
  const input = messageText.trim();
  
  // Check if valid option (1-4 only - filho, conjuge, pai, mae)
  const relationship = RELATIONSHIP_OPTIONS[input];
  
  if (!relationship) {
    await sendWhatsAppMessage(config, phone, 
      `❌ Opção inválida. Por favor, escolha um número de 1 a 4:\n\n` +
      `1️⃣ Filho(a) _(até 21 anos)_\n` +
      `2️⃣ Cônjuge\n` +
      `3️⃣ Pai\n` +
      `4️⃣ Mãe`
    );
    return { handled: true, newState: 'WAITING_REGISTRATION_RELATIONSHIP' };
  }
  
  // Validate age for "filho" - must be 21 or younger
  if (relationship === 'filho' && session.pending_registration_birthdate) {
    const birthDate = new Date(session.pending_registration_birthdate + 'T12:00:00');
    const age = calculateAge(birthDate);
    
    if (age > 21) {
      await sendWhatsAppMessage(config, phone, 
        `❌ *Não é possível cadastrar filho(a) com mais de 21 anos como dependente.*\n\n` +
        `A idade calculada é ${age} anos.\n\n` +
        `Se necessário, o familiar pode fazer seu próprio cadastro como *titular* na empresa onde trabalha.`
      );
      
      // Clear registration and restart
      await updateSession(supabase, session.id, {
        state: 'WAITING_CPF',
        pending_registration_cpf: null,
        pending_registration_name: null,
        pending_registration_birthdate: null,
        pending_registration_type: null,
        pending_registration_titular_cpf: null,
        pending_registration_relationship: null,
      });
      
      return { handled: true, newState: 'WAITING_CPF' };
    }
  }
  
  // Store relationship and ask for CPF photo
  await updateSession(supabase, session.id, {
    state: 'WAITING_DEPENDENT_CPF_PHOTO',
    pending_registration_relationship: relationship,
    pending_registration_cnpj: null, // Ensure no CNPJ for dependent
  });
  
  // Format birthdate for display
  const displayDate = session.pending_registration_birthdate 
    ? new Date(session.pending_registration_birthdate + 'T12:00:00').toLocaleDateString('pt-BR')
    : '';
  
  const relationshipLabel = RELATIONSHIP_LABELS[relationship] || relationship;
  
  // Build confirmation message and ask for CPF photo
  const photoRequestMsg = `📋 *Seus dados:*\n\n` +
    `👤 *Nome:* ${session.pending_registration_name || ''}\n` +
    `📅 *Nascimento:* ${displayDate}\n` +
    `👨‍👩‍👧 *Parentesco:* ${relationshipLabel}\n\n` +
    `📸 *Última etapa!*\n\n` +
    `Por favor, envie uma *foto do CPF* do dependente para validação.\n\n` +
    `⚠️ A foto deve estar legível e mostrar o número do CPF claramente.\n\n` +
    `_Seu cadastro será analisado e você receberá uma notificação quando for aprovado._`;
  
  await sendWhatsAppMessage(config, phone, photoRequestMsg);
  
  return { handled: true, newState: 'WAITING_DEPENDENT_CPF_PHOTO' };
}

// Handler for receiving CPF photo - creates inactive dependent pending approval
// Handle CPF photo upload for dependent registration (called from main handler when image is received)
async function handleDependentCpfPhotoUpload(
  supabase: SupabaseClient,
  phone: string,
  instanceName: string,
  messageId: string,
  imageData: any,
  messageType: string,
  session: any
): Promise<boolean> {
  console.log('[dependent-cpf] Processing CPF photo for dependent registration');
  
  try {
    // Fetch Evolution API config from evolution_configs table
    const { data: evolutionConfig } = await supabase
      .from('evolution_configs')
      .select('api_url, api_key, instance_name, clinic_id')
      .eq('clinic_id', session.clinic_id)
      .maybeSingle();
    
    if (!evolutionConfig?.api_url || !evolutionConfig?.api_key) {
      console.error('[dependent-cpf] No Evolution config found for clinic:', session.clinic_id);
      return false;
    }
    
    const config: EvolutionConfig = {
      api_url: evolutionConfig.api_url,
      api_key: evolutionConfig.api_key,
      instance_name: evolutionConfig.instance_name,
      clinic_id: evolutionConfig.clinic_id,
    };
    
    // Download image via Evolution API
    let photoUrl: string | null = null;
    
    try {
      const downloadUrl = `${config.api_url}/chat/getBase64FromMediaMessage/${config.instance_name}`;
      const mediaResponse = await fetch(downloadUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': config.api_key,
        },
        body: JSON.stringify({
          message: { key: { id: messageId } },
          convertToMp4: false,
        }),
      });
      
      if (mediaResponse.ok) {
        const mediaData = await mediaResponse.json();
        const base64 = mediaData?.base64;
        
        if (base64) {
          // Upload to storage
          const fileName = `${session.clinic_id}/${Date.now()}_${phone.replace(/\D/g, '')}.jpg`;
          const binaryData = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
          
          const { error: uploadError } = await supabase.storage
            .from('dependent-cpf-photos')
            .upload(fileName, binaryData, {
              contentType: 'image/jpeg',
              upsert: true,
            });
          
          if (!uploadError) {
            photoUrl = fileName;
            console.log('[dependent-cpf] Photo uploaded successfully:', fileName);
          } else {
            console.error('[dependent-cpf] Upload error:', uploadError);
          }
        }
      } else {
        console.error('[dependent-cpf] Media download failed:', mediaResponse.status);
      }
    } catch (mediaError) {
      console.error('[dependent-cpf] Media processing error:', mediaError);
    }
    
    // Find titular patient
    const titularCpfClean = session.pending_registration_titular_cpf?.replace(/\D/g, '') || '';
    const titularCpfFormatted = titularCpfClean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    
    const { data: titularPatient } = await supabase
      .from('patients')
      .select('id, name, insurance_plan_id')
      .eq('clinic_id', config.clinic_id)
      .or(`cpf.eq.${titularCpfClean},cpf.eq.${titularCpfFormatted}`)
      .eq('is_active', true)
      .maybeSingle();
    
    if (!titularPatient) {
      await sendWhatsAppMessage(config, phone, `❌ Não foi possível localizar o titular. Tente novamente.`);
      await updateSession(supabase, session.id, { state: 'WAITING_CPF' });
      return true;
    }
    
    // Generate card number
    const { data: cardNumber } = await supabase.rpc('generate_card_number', { 
      p_clinic_id: config.clinic_id, 
      p_patient_id: titularPatient.id 
    });
    
    // Get titular's card expiry
    const { data: titularCard } = await supabase
      .from('patient_cards')
      .select('expires_at')
      .eq('patient_id', titularPatient.id)
      .eq('is_active', true)
      .order('expires_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    const expiresDate = titularCard?.expires_at || new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();
    
    // Create dependent as INACTIVE with pending_approval = true
    const { data: dependent, error: dependentError } = await supabase
      .from('patient_dependents')
      .insert({
        clinic_id: config.clinic_id,
        patient_id: titularPatient.id,
        name: session.pending_registration_name!.trim(),
        cpf: session.pending_registration_cpf?.replace(/\D/g, '') || null,
        birth_date: session.pending_registration_birthdate,
        phone: phone.replace(/\D/g, ''),
        relationship: session.pending_registration_relationship || null,
        card_number: cardNumber || null,
        card_expires_at: expiresDate,
        insurance_plan_id: titularPatient.insurance_plan_id || null,
        is_active: false,
        pending_approval: true,
      })
      .select('id, name')
      .single();
    
    if (dependentError) {
      console.error('[dependent-cpf] Error creating dependent:', dependentError);
      await sendWhatsAppMessage(config, phone, `❌ Erro ao processar cadastro. Tente novamente.`);
      return true;
    }
    
    // Create approval request WITH photo URL
    await supabase
      .from('pending_dependent_approvals')
      .insert({
        clinic_id: config.clinic_id,
        patient_id: titularPatient.id,
        dependent_id: dependent.id,
        requester_phone: phone.replace(/\D/g, ''),
        cpf_photo_url: photoUrl,
        status: 'pending',
      });
    
    // Clear session
    await updateSession(supabase, session.id, {
      state: 'FINISHED',
      pending_registration_cpf: null,
      pending_registration_name: null,
      pending_registration_birthdate: null,
      pending_registration_type: null,
      pending_registration_titular_cpf: null,
      pending_registration_relationship: null,
    });
    
    // Send CORRECT confirmation message
    await sendWhatsAppMessage(config, phone, 
      `✅ *Foto do CPF recebida!*\n\n` +
      `👤 Dependente: *${dependent.name}*\n` +
      `👨‍👩‍👧 Titular: *${titularPatient.name}*\n\n` +
      `📋 Seu cadastro está *aguardando aprovação* pela nossa equipe.\n\n` +
      `Você será notificado assim que a análise for concluída! 🎉`
    );
    
    console.log(`[dependent-cpf] Successfully processed CPF photo for ${dependent.name}`);
    return true;
    
  } catch (error) {
    console.error('[dependent-cpf] Error:', error);
    return false;
  }
}

async function handleWaitingDependentCpfPhoto(
  supabase: SupabaseClient,
  config: EvolutionConfig,
  phone: string,
  messageText: string,
  session: BookingSession
): Promise<{ handled: boolean; newState?: BookingState }> {
  // Check if user wants to cancel
  if (/^(cancelar|desistir|sair)$/i.test(messageText.trim())) {
    await updateSession(supabase, session.id, {
      state: 'WAITING_CPF',
      pending_registration_cpf: null,
      pending_registration_name: null,
      pending_registration_birthdate: null,
      pending_registration_type: null,
      pending_registration_titular_cpf: null,
      pending_registration_relationship: null,
    });
    await sendWhatsAppMessage(config, phone, `❌ Cadastro cancelado.\n\nDigite *MENU* para recomeçar.`);
    return { handled: true, newState: 'WAITING_CPF' };
  }
  
  // If text message received, guide user to send photo
  await sendWhatsAppMessage(config, phone, 
    `📸 *Aguardando foto do CPF*\n\n` +
    `Por favor, envie uma *foto* do documento CPF do dependente *${session.pending_registration_name || ''}*.\n\n` +
    `💡 Dica: Tire a foto em local bem iluminado para melhor visualização.\n\n` +
    `Digite *cancelar* para desistir.`
  );
  
  return { handled: true, newState: 'WAITING_DEPENDENT_CPF_PHOTO' };
}

// Validate CNPJ checksum
function isValidCNPJ(cnpj: string): boolean {
  const cleanCnpj = cnpj.replace(/\D/g, '');
  if (cleanCnpj.length !== 14) return false;
  
  // Check for known invalid patterns
  if (/^(\d)\1+$/.test(cleanCnpj)) return false;
  
  // Validate check digits
  let size = cleanCnpj.length - 2;
  let numbers = cleanCnpj.substring(0, size);
  const digits = cleanCnpj.substring(size);
  let sum = 0;
  let pos = size - 7;
  
  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  
  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(0))) return false;
  
  size = size + 1;
  numbers = cleanCnpj.substring(0, size);
  sum = 0;
  pos = size - 7;
  
  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  
  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  return result === parseInt(digits.charAt(1));
}

// Fetch company data from Brasil API
async function fetchCNPJData(cnpj: string): Promise<{ razaoSocial: string | null; nomeFantasia: string | null; valid: boolean }> {
  try {
    const cleanCnpj = cnpj.replace(/\D/g, '');
    console.log(`[cnpj] Fetching data for CNPJ: ${cleanCnpj}`);
    
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });
    
    if (!response.ok) {
      console.log(`[cnpj] Brasil API returned status ${response.status}`);
      return { razaoSocial: null, nomeFantasia: null, valid: false };
    }
    
    const data = await response.json();
    console.log(`[cnpj] Brasil API response:`, { razaoSocial: data.razao_social, nomeFantasia: data.nome_fantasia });
    
    return {
      razaoSocial: data.razao_social || null,
      nomeFantasia: data.nome_fantasia || null,
      valid: true,
    };
  } catch (error) {
    console.error('[cnpj] Error fetching CNPJ data:', error);
    return { razaoSocial: null, nomeFantasia: null, valid: false };
  }
}

async function handleWaitingRegistrationCnpj(
  supabase: SupabaseClient,
  config: EvolutionConfig,
  phone: string,
  messageText: string,
  session: BookingSession
): Promise<{ handled: boolean; newState?: BookingState }> {
  const input = messageText.trim().toLowerCase();
  
  // CNPJ is now REQUIRED for titular registration - do not allow skipping
  // Block any skip attempts
  if (input === 'pular' || input === 'skip' || input === '0' || input === 'não' || input === 'nao' || input === 'n') {
    await sendWhatsAppMessage(config, phone, `❌ O CNPJ da empresa é *obrigatório* para o cadastro.\n\nPor favor, digite os *14 números* do CNPJ:`);
    return { handled: true, newState: 'WAITING_REGISTRATION_CNPJ' };
  }
  
  // Clean and validate CNPJ
  const cleanCnpj = messageText.replace(/\D/g, '');
  
  if (cleanCnpj.length !== 14) {
    await sendWhatsAppMessage(config, phone, `❌ CNPJ inválido (deve ter 14 dígitos).\n\nPor favor, digite o CNPJ completo da empresa:`);
    return { handled: true, newState: 'WAITING_REGISTRATION_CNPJ' };
  }
  
  // Validate CNPJ checksum
  if (!isValidCNPJ(cleanCnpj)) {
    await sendWhatsAppMessage(config, phone, `❌ CNPJ inválido. Verifique os dígitos e tente novamente:`);
    return { handled: true, newState: 'WAITING_REGISTRATION_CNPJ' };
  }
  
  // Send "searching" feedback to user
  await sendWhatsAppMessage(config, phone, `🔍 Buscando dados da empresa...`);
  
  // Fetch company data from Receita Federal via Brasil API
  const companyData = await fetchCNPJData(cleanCnpj);
  
  if (!companyData.valid) {
    await sendWhatsAppMessage(config, phone, `⚠️ Não foi possível encontrar este CNPJ na Receita Federal.\n\nVerifique o número e tente novamente:`);
    return { handled: true, newState: 'WAITING_REGISTRATION_CNPJ' };
  }
  
  // Prefer nome_fantasia, fallback to razao_social
  const employerName = companyData.nomeFantasia || companyData.razaoSocial || null;
  
  if (employerName) {
    console.log(`[cnpj] Company found: ${employerName}`);
    
    // Format CNPJ for display
    const formattedCnpj = cleanCnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    
    // Store CNPJ and employer name in session, go to CONFIRM_COMPANY state
    await updateSession(supabase, session.id, {
      state: 'CONFIRM_COMPANY',
      pending_registration_cnpj: JSON.stringify({ cnpj: cleanCnpj, employerName }),
    });
    
    // Ask user to confirm the company
    await sendWhatsAppButtons(
      config,
      phone,
      '🏢 Confirmar Empresa',
      `✅ *Empresa encontrada:*\n\n🏢 *${employerName}*\n📝 CNPJ: ${formattedCnpj}\n\nEssa é a sua empresa?`,
      [
        { id: 'company_yes', text: '✅ Sim, confirmar' },
        { id: 'company_no', text: '❌ Não, digitar outro' }
      ],
      'Responda 1 ou 2'
    );
    
    return { handled: true, newState: 'CONFIRM_COMPANY' };
  } else {
    // Company found but no name - just store CNPJ and proceed
    await updateSession(supabase, session.id, {
      state: 'CONFIRM_REGISTRATION',
      pending_registration_cnpj: cleanCnpj,
    });
    
    // Format display date
    const birthDate = session.pending_registration_birthdate 
      ? new Date(session.pending_registration_birthdate + 'T00:00:00').toLocaleDateString('pt-BR')
      : '';
    
    const formattedCnpj = cleanCnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    const confirmMsg = MESSAGES.confirmRegistration(session.pending_registration_name || '', birthDate, formattedCnpj);
    
    await sendWhatsAppButtons(
      config,
      phone,
      '📋 Confirmar Cadastro',
      confirmMsg,
      [
        { id: 'confirm_yes', text: '✅ Confirmar' },
        { id: 'confirm_no', text: '❌ Recomeçar' }
      ],
      'Responda 1 ou 2'
    );
    
    return { handled: true, newState: 'CONFIRM_REGISTRATION' };
  }
}

async function handleConfirmCompany(
  supabase: SupabaseClient,
  config: EvolutionConfig,
  phone: string,
  messageText: string,
  session: BookingSession
): Promise<{ handled: boolean; newState?: BookingState }> {
  const isYes = POSITIVE_REGEX.test(messageText) || messageText.includes('company_yes') || messageText === '1';
  const isNo = NEGATIVE_REGEX.test(messageText) || messageText.includes('company_no') || messageText === '2';
  
  if (isNo) {
    // User wants to enter a different CNPJ
    await updateSession(supabase, session.id, {
      state: 'WAITING_REGISTRATION_CNPJ',
      pending_registration_cnpj: null,
    });
    await sendWhatsAppMessage(config, phone, `📝 Digite o CNPJ correto da sua empresa ou "pular" para continuar sem:`);
    return { handled: true, newState: 'WAITING_REGISTRATION_CNPJ' };
  }
  
  if (isYes) {
    // Company confirmed - proceed to final registration confirmation
    // Parse the stored data
    let employerName: string | null = null;
    let cnpj: string | null = null;
    
    if (session.pending_registration_cnpj) {
      try {
        const cnpjData = JSON.parse(session.pending_registration_cnpj);
        cnpj = cnpjData.cnpj || null;
        employerName = cnpjData.employerName || null;
      } catch {
        cnpj = session.pending_registration_cnpj;
      }
    }
    
    // Update state to CONFIRM_REGISTRATION
    await updateSession(supabase, session.id, {
      state: 'CONFIRM_REGISTRATION',
    });
    
    // Format display date
    const birthDate = session.pending_registration_birthdate 
      ? new Date(session.pending_registration_birthdate + 'T00:00:00').toLocaleDateString('pt-BR')
      : '';
    
    // Format CNPJ for display
    const formattedCnpj = cnpj 
      ? cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
      : null;
    
    // Build confirmation message with company name
    let confirmMsg: string;
    if (employerName && cnpj) {
      confirmMsg = `📋 *Confirme seus dados:*\n\n` +
        `👤 *Nome:* ${session.pending_registration_name || ''}\n` +
        `📅 *Nascimento:* ${birthDate}\n` +
        `🏢 *Empresa:* ${employerName}\n` +
        `📝 *CNPJ:* ${formattedCnpj}\n\n` +
        `Os dados estão corretos?`;
    } else {
      confirmMsg = MESSAGES.confirmRegistration(session.pending_registration_name || '', birthDate, formattedCnpj);
    }
    
    await sendWhatsAppButtons(
      config,
      phone,
      '📋 Confirmar Cadastro',
      confirmMsg,
      [
        { id: 'confirm_yes', text: '✅ Confirmar' },
        { id: 'confirm_no', text: '❌ Recomeçar' }
      ],
      'Responda 1 ou 2'
    );
    
    return { handled: true, newState: 'CONFIRM_REGISTRATION' };
  }
  
  // Unrecognized response
  await sendWhatsAppButtons(
    config,
    phone,
    '🏢 Confirmar Empresa',
    `Por favor, confirme se esta é a sua empresa:\n\nResponda *1* para SIM ou *2* para NÃO`,
    [
      { id: 'company_yes', text: '✅ Sim, confirmar' },
      { id: 'company_no', text: '❌ Não, digitar outro' }
    ],
    'Responda 1 ou 2'
  );
  
  return { handled: true, newState: 'CONFIRM_COMPANY' };
}

async function handleConfirmRegistration(
  supabase: SupabaseClient,
  config: EvolutionConfig,
  phone: string,
  messageText: string,
  session: BookingSession
): Promise<{ handled: boolean; newState?: BookingState }> {
  const isYes = POSITIVE_REGEX.test(messageText) || messageText.includes('confirm_yes') || messageText === '1';
  const isNo = NEGATIVE_REGEX.test(messageText) || messageText.includes('confirm_no') || messageText === '2';
  
  if (isNo) {
    // Start over - clear all registration data
    await updateSession(supabase, session.id, {
      state: 'WAITING_CPF',
      pending_registration_cpf: null,
      pending_registration_name: null,
      pending_registration_birthdate: null,
      pending_registration_cnpj: null,
      pending_registration_type: null,
      pending_registration_titular_cpf: null,
      pending_registration_insurance_plan_id: null,
      pending_registration_relationship: null,
      available_insurance_plans: null,
    });
    await sendWhatsAppMessage(config, phone, MESSAGES.welcome + MESSAGES.hintCpf);
    return { handled: true, newState: 'WAITING_CPF' };
  }
  
  if (isYes) {
    try {
      // Clean phone for storage
      const cleanPhone = phone.replace(/\D/g, '');
      
      // Parse CNPJ data - might be JSON with employer name
      let employerCnpj: string | null = null;
      let employerName: string | null = null;
      
      if (session.pending_registration_cnpj) {
        try {
          // Try to parse as JSON (contains cnpj + employerName)
          const cnpjData = JSON.parse(session.pending_registration_cnpj);
          employerCnpj = cnpjData.cnpj || null;
          employerName = cnpjData.employerName || null;
          console.log(`[registration] Parsed CNPJ data: cnpj=${employerCnpj}, employerName=${employerName}`);
        } catch {
          // Not JSON, use as plain CNPJ
          employerCnpj = session.pending_registration_cnpj;
          console.log(`[registration] Plain CNPJ: ${employerCnpj}`);
        }
      }
      
      // Check if registering as dependent
      const isDependent = session.pending_registration_type === 'dependent' && session.pending_registration_titular_cpf;
      
      if (isDependent) {
        // Find titular patient - support both formatted and unformatted CPF
        const titularCpfClean = session.pending_registration_titular_cpf?.replace(/\D/g, '') || '';
        const titularCpfFormatted = titularCpfClean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
        const { data: titularPatient, error: titularError } = await supabase
          .from('patients')
          .select('id, name, insurance_plan_id')
          .eq('clinic_id', config.clinic_id)
          .or(`cpf.eq.${titularCpfClean},cpf.eq.${titularCpfFormatted}`)
          .eq('is_active', true)
          .maybeSingle();
        
        if (titularError || !titularPatient) {
          console.error('[registration] Titular not found for dependent:', titularError);
          await sendWhatsAppMessage(config, phone, `❌ Não foi possível localizar o titular. Por favor, tente novamente.`);
          await updateSession(supabase, session.id, { state: 'WAITING_CPF' });
          return { handled: true, newState: 'WAITING_CPF' };
        }
        
        // Generate card number for dependent (uses titular's registration_number)
        const { data: dependentCardNumber, error: cardNumberError } = await supabase.rpc(
          'generate_card_number',
          { p_clinic_id: config.clinic_id, p_patient_id: titularPatient.id }
        );
        
        if (cardNumberError) {
          console.error('[registration] Error generating dependent card number:', cardNumberError);
        }
        
        // Get titular's card to sync expiry date
        const { data: titularCard } = await supabase
          .from('patient_cards')
          .select('expires_at')
          .eq('patient_id', titularPatient.id)
          .eq('is_active', true)
          .order('expires_at', { ascending: false })
          .limit(1)
          .single();
        
        // Calculate expiry: use titular's or default 15 days
        let cardExpiresAt: string;
        if (titularCard?.expires_at) {
          cardExpiresAt = titularCard.expires_at;
        } else {
          const expiresDate = new Date();
          expiresDate.setDate(expiresDate.getDate() + 15);
          cardExpiresAt = expiresDate.toISOString();
        }
        
        // Ensure CPF is properly formatted (digits only)
        const dependentCpf = session.pending_registration_cpf?.replace(/\D/g, '') || null;
        console.log(`[registration] Creating dependent with CPF: ${dependentCpf}`);
        
        // Create dependent record linked to titular with card data
        const { data: dependent, error: dependentError } = await supabase
          .from('patient_dependents')
          .insert({
            clinic_id: config.clinic_id,
            patient_id: titularPatient.id,
            name: session.pending_registration_name!.trim(),
            cpf: dependentCpf,
            birth_date: session.pending_registration_birthdate,
            phone: cleanPhone,
            relationship: session.pending_registration_relationship || null,
            card_number: dependentCardNumber || null,
            card_expires_at: cardExpiresAt,
            insurance_plan_id: titularPatient.insurance_plan_id || null,
            is_active: true,
          })
          .select('id, name, cpf, card_number, card_expires_at')
          .single();
        
        if (dependentError) {
          console.error('[registration] Error creating dependent:', dependentError);
          if (dependentError.message?.includes('CPF_DUPLICADO') || dependentError.message?.includes('duplicate')) {
            await sendWhatsAppMessage(config, phone, `❌ Este CPF já está cadastrado no sistema.\n\nPor favor, informe outro CPF ou entre em contato conosco.`);
            await updateSession(supabase, session.id, { state: 'WAITING_CPF' });
            return { handled: true, newState: 'WAITING_CPF' };
          }
          await sendWhatsAppMessage(config, phone, MESSAGES.registrationError);
          return { handled: true, newState: 'FINISHED' };
        }
        
        console.log(`[registration] Dependent created: ${dependent.id} - ${dependent.name} (CPF: ${dependent.cpf}, Card: ${dependent.card_number}, Expires: ${dependent.card_expires_at}) linked to titular ${titularPatient.id}`);
        
        // Clear registration data
        await updateSession(supabase, session.id, {
          state: 'WAITING_CPF',
          pending_registration_cpf: null,
          pending_registration_name: null,
          pending_registration_birthdate: null,
          pending_registration_cnpj: null,
          pending_registration_type: null,
          pending_registration_titular_cpf: null,
          pending_registration_insurance_plan_id: null,
          pending_registration_relationship: null,
          available_insurance_plans: null,
        });
        
        const firstName = dependent.name.split(' ')[0];
        await sendWhatsAppMessage(config, phone, 
          `✅ *Cadastro de dependente realizado com sucesso!*\n\n` +
          `👤 Dependente: *${dependent.name}*\n` +
          `👨‍👩‍👧 Titular: *${titularPatient.name}*\n` +
          `💳 Carteirinha: *${dependent.card_number || 'Gerada'}*\n\n` +
          `Olá, *${firstName}*! Seja bem-vindo(a)! 🎉\n\n` +
          `Agora você já pode agendar sua consulta! Por favor, informe novamente seu *CPF*:`
        );
        return { handled: true, newState: 'WAITING_CPF' };
        
      } else {
        // Create patient as titular with insurance plan
        const { data: patient, error: patientError } = await supabase
          .from('patients')
          .insert({
            clinic_id: config.clinic_id,
            name: session.pending_registration_name!.trim(),
            cpf: session.pending_registration_cpf,
            birth_date: session.pending_registration_birthdate,
            phone: cleanPhone,
            employer_cnpj: employerCnpj,
            employer_name: employerName,
            insurance_plan_id: session.pending_registration_insurance_plan_id || null,
          })
          .select('id, name')
          .single();
        
        if (patientError) {
          console.error('[registration] Error creating patient:', patientError);
          if (patientError.message?.includes('CPF_DUPLICADO')) {
            await sendWhatsAppMessage(config, phone, `❌ Este CPF já está cadastrado no sistema.\n\nPor favor, informe outro CPF ou entre em contato conosco.`);
            await updateSession(supabase, session.id, { state: 'WAITING_CPF' });
            return { handled: true, newState: 'WAITING_CPF' };
          }
          await sendWhatsAppMessage(config, phone, MESSAGES.registrationError);
          return { handled: true, newState: 'FINISHED' };
        }
        
        console.log(`[registration] Patient created: ${patient.id} - ${patient.name}`);
        
        // Generate card number (uses patient's registration_number)
        const { data: cardNumber, error: cardError } = await supabase.rpc(
          'generate_card_number',
          { p_clinic_id: config.clinic_id, p_patient_id: patient.id }
        );
        
        if (cardError) {
          console.error('[registration] Error generating card number:', cardError);
        } else {
          // Calculate 15 days from now
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 15);
          
          // Create patient card
          const { error: insertCardError } = await supabase
            .from('patient_cards')
            .insert({
              clinic_id: config.clinic_id,
              patient_id: patient.id,
              card_number: cardNumber,
              issued_at: new Date().toISOString(),
              expires_at: expiresAt.toISOString(),
              is_active: true,
            });
          
          if (insertCardError) {
            console.error('[registration] Error creating card:', insertCardError);
          } else {
            console.log(`[registration] Card created for patient ${patient.id}`);
          }
        }
        
        // After successful registration, keep the same identified patient and go straight to the main menu
        await updateSession(supabase, session.id, {
          state: 'MAIN_MENU',
          patient_id: patient.id,
          patient_name: patient.name,
          action_type: null,
          selected_professional_id: null,
          selected_professional_name: null,
          selected_procedure_id: null,
          selected_date: null,
          selected_time: null,
          available_professionals: null,
          available_procedures: null,
          available_dates: null,
          available_times: null,
          pending_appointments: null,
          appointments_list: null,
          list_action: null,
          selected_appointment_id: null,
          booking_for: 'titular',
          selected_dependent_id: null,
          selected_dependent_name: null,
          is_dependent_direct_booking: false,

          // Clear registration data
          pending_registration_cpf: null,
          pending_registration_name: null,
          pending_registration_birthdate: null,
          pending_registration_cnpj: null,
          pending_registration_type: null,
          pending_registration_titular_cpf: null,
          pending_registration_insurance_plan_id: null,
          pending_registration_relationship: null,
          available_insurance_plans: null,
        });
        
        const firstName = patient.name.split(' ')[0];
        await sendWhatsAppMessage(
          config,
          phone,
          `✅ *Cadastro realizado com sucesso!*

Olá, *${firstName}*! Seja bem-vindo(a)! 🎉

Sua carteirinha digital foi criada com validade de *15 dias*.

${MESSAGES.mainMenu}${MESSAGES.hintSelectOption}`
        );
        return { handled: true, newState: 'MAIN_MENU' };
      }
      
    } catch (error) {
      console.error('[registration] Unexpected error:', error);
      await sendWhatsAppMessage(config, phone, MESSAGES.registrationError);
      return { handled: true, newState: 'FINISHED' };
    }
  }
  
  // Invalid response
  await sendWhatsAppMessage(config, phone, `Por favor, responda *1* para confirmar ou *2* para recomeçar.`);
  return { handled: true, newState: 'CONFIRM_REGISTRATION' };
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

  // Check if patient is blocked for this specific professional due to no-show
  const { data: patientBlockCheck } = await supabase
    .from('patients')
    .select('no_show_blocked_until, no_show_unblocked_at, no_show_blocked_professional_id')
    .eq('id', session.patient_id)
    .single();

  if (patientBlockCheck && 
      patientBlockCheck.no_show_blocked_until && 
      patientBlockCheck.no_show_unblocked_at === null &&
      patientBlockCheck.no_show_blocked_professional_id === selected.id) {
    const blockDate = new Date(patientBlockCheck.no_show_blocked_until);
    if (blockDate >= new Date()) {
      const formattedDate = blockDate.toLocaleDateString('pt-BR');
      await sendWhatsAppMessage(config, phone, 
        `❌ Você está bloqueado(a) para agendar com *${selected.name}* até *${formattedDate}* devido a não comparecimento em consulta anterior.\n\n` +
        `Você pode:\n` +
        `• Escolher outro profissional\n` +
        `• Solicitar liberação ao administrador da clínica\n\n` +
        `Por favor, escolha outro profissional:`
      );
      return { handled: true, newState: 'SELECT_PROFESSIONAL' };
    }
  }

  // Check CPF appointment limit BEFORE proceeding with date selection
  // Pass dependent_id to check limit for the specific person (patient or dependent)
  const limitCheck = await checkCpfAppointmentLimit(
    supabase,
    config.clinic_id,
    session.patient_id!,
    selected.id,
    session.selected_dependent_id
  );

  if (limitCheck.limitReached) {
    const whoMessage = session.selected_dependent_name 
      ? `*${session.selected_dependent_name}* já atingiu`
      : `Você já atingiu`;
    await sendWhatsAppMessage(config, phone, 
      `❌ ${whoMessage} o limite de *${limitCheck.maxAllowed} agendamento(s)* com *${selected.name}* neste mês.\n\nPor favor, escolha outro profissional.`
    );
    return { handled: true, newState: 'SELECT_PROFESSIONAL' };
  }

  // Check for expired patient card
  const { data: cardCheck } = await supabase.rpc('is_patient_card_valid', {
    p_patient_id: session.patient_id,
    p_clinic_id: config.clinic_id
  });

  if (cardCheck && cardCheck[0] && cardCheck[0].card_number && !cardCheck[0].is_valid) {
    console.log(`[booking] Patient card expired: ${cardCheck[0].card_number}`);
    
    // Get the card ID for payslip request
    const { data: patientCard } = await supabase
      .from('patient_cards')
      .select('id, card_number, expires_at')
      .eq('patient_id', session.patient_id)
      .eq('clinic_id', config.clinic_id)
      .eq('is_active', true)
      .order('expires_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (patientCard) {
      // Check if there's already a pending payslip request
      const { data: existingRequest } = await supabase
        .from('payslip_requests')
        .select('id, status')
        .eq('patient_id', session.patient_id)
        .eq('clinic_id', config.clinic_id)
        .in('status', ['pending', 'received'])
        .maybeSingle();

      const expiryDate = new Date(cardCheck[0].expires_at).toLocaleDateString('pt-BR');

      if (existingRequest) {
        // Already has a pending request
        console.log(`[booking] Patient already has pending payslip request: ${existingRequest.id}`);
        if (existingRequest.status === 'pending') {
          await sendWhatsAppMessage(config, phone, 
            `📋 Sua carteirinha (${cardCheck[0].card_number}) está vencida desde *${expiryDate}*.\n\n` +
            `Você já tem uma solicitação de renovação em aberto!\n\n` +
            `📸 *Envie uma foto do seu contracheque* para que possamos renovar sua carteirinha.\n\n` +
            `Após o envio, aguarde a análise (até 48h úteis).`
          );
        } else {
          // Status is 'received' - waiting for review
          await sendWhatsAppMessage(config, phone, 
            `📋 Sua carteirinha (${cardCheck[0].card_number}) está vencida desde *${expiryDate}*.\n\n` +
            `✅ Recebemos seu contracheque e ele está *em análise*.\n\n` +
            `Aguarde a liberação (até 48h úteis). Você receberá uma mensagem assim que for aprovado! 🙏`
          );
        }
      } else {
        // Create new payslip request
        const { data: newRequest, error: requestError } = await supabase
          .from('payslip_requests')
          .insert({
            clinic_id: config.clinic_id,
            patient_id: session.patient_id,
            card_id: patientCard.id,
            status: 'pending',
          })
          .select('id')
          .single();

        if (requestError) {
          console.error('[booking] Error creating payslip request:', requestError);
        } else {
          console.log(`[booking] Created payslip request: ${newRequest.id}`);
        }

        await sendWhatsAppMessage(config, phone, 
          `📋 Sua carteirinha (${cardCheck[0].card_number}) está vencida desde *${expiryDate}*.\n\n` +
          `Para renovar, precisamos verificar seu vínculo empregatício.\n\n` +
          `📸 *Por favor, envie uma foto do seu contracheque* (holerite) mais recente.\n\n` +
          `⚠️ *Importante:*\n` +
          `• A foto deve estar legível\n` +
          `• Deve constar seu nome e data\n` +
          `• Após o envio, aguarde a análise (até 48h úteis)\n\n` +
          `_Você receberá uma confirmação assim que enviar a imagem._`
        );
      }
    } else {
      // No card found, generic message
      await sendWhatsAppMessage(config, phone, 
        `❌ Sua carteirinha está vencida.\n\nPor favor, entre em contato com a clínica para renovar sua carteirinha.`
      );
    }
    
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
    // Delete session instead of setting to FINISHED to avoid asking CPF again
    await supabase.from('whatsapp_booking_sessions').delete().eq('id', session.id);
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

  // CRITICAL: Re-validate patient card before creating appointment
  const { data: cardCheck } = await supabase.rpc('is_patient_card_valid', {
    p_patient_id: session.patient_id,
    p_clinic_id: config.clinic_id
  });

  if (cardCheck && cardCheck[0] && cardCheck[0].card_number && !cardCheck[0].is_valid) {
    console.log(`[booking] Patient card expired at confirmation: ${cardCheck[0].card_number}`);
    
    // Get the card ID for payslip request
    const { data: patientCard } = await supabase
      .from('patient_cards')
      .select('id, card_number, expires_at')
      .eq('patient_id', session.patient_id)
      .eq('clinic_id', config.clinic_id)
      .eq('is_active', true)
      .order('expires_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (patientCard) {
      // Check if there's already a pending payslip request
      const { data: existingRequest } = await supabase
        .from('payslip_requests')
        .select('id, status')
        .eq('patient_id', session.patient_id)
        .eq('clinic_id', config.clinic_id)
        .in('status', ['pending', 'received'])
        .maybeSingle();

      const expiryDate = new Date(cardCheck[0].expires_at).toLocaleDateString('pt-BR');

      if (existingRequest) {
        console.log(`[booking] Patient already has pending payslip request: ${existingRequest.id}`);
        if (existingRequest.status === 'pending') {
          await sendWhatsAppMessage(config, phone, 
            `📋 Sua carteirinha (${cardCheck[0].card_number}) está vencida desde *${expiryDate}*.\n\n` +
            `Você já tem uma solicitação de renovação em aberto!\n\n` +
            `📸 *Envie uma foto do seu contracheque* para que possamos renovar sua carteirinha.\n\n` +
            `Após o envio, aguarde a análise (até 48h úteis).`
          );
        } else {
          await sendWhatsAppMessage(config, phone, 
            `📋 Sua carteirinha (${cardCheck[0].card_number}) está vencida desde *${expiryDate}*.\n\n` +
            `✅ Recebemos seu contracheque e ele está *em análise*.\n\n` +
            `Aguarde a liberação (até 48h úteis). Você receberá uma mensagem assim que for aprovado! 🙏`
          );
        }
      } else {
        // Create new payslip request
        const { data: newRequest, error: requestError } = await supabase
          .from('payslip_requests')
          .insert({
            clinic_id: config.clinic_id,
            patient_id: session.patient_id,
            card_id: patientCard.id,
            status: 'pending',
          })
          .select('id')
          .single();

        if (requestError) {
          console.error('[booking] Error creating payslip request:', requestError);
        } else {
          console.log(`[booking] Created payslip request: ${newRequest.id}`);
        }

        await sendWhatsAppMessage(config, phone, 
          `📋 Sua carteirinha (${cardCheck[0].card_number}) está vencida desde *${expiryDate}*.\n\n` +
          `Para renovar, precisamos verificar seu vínculo empregatício.\n\n` +
          `📸 *Por favor, envie uma foto do seu contracheque* (holerite) mais recente.\n\n` +
          `⚠️ *Importante:*\n` +
          `• A foto deve estar legível\n` +
          `• Deve constar seu nome e data\n` +
          `• Após o envio, aguarde a análise (até 48h úteis)\n\n` +
          `_Você receberá uma confirmação assim que enviar a imagem._`
        );
      }
    } else {
      await sendWhatsAppMessage(config, phone, 
        `❌ Sua carteirinha está vencida.\n\nPor favor, entre em contato com a clínica para renovar sua carteirinha.`
      );
    }
    
    await updateSession(supabase, session.id, { state: 'FINISHED' });
    return { handled: true, newState: 'FINISHED' };
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

    // Check for booking window exceeded (sindicato restriction)
    if (appointmentError.message?.includes('booking_window_exceeded') || appointmentError.message?.includes('Agendamento indisponível')) {
      await sendWhatsAppMessage(config, phone, 
        `❌ *Agendamento indisponível para este período*\n\nA data selecionada está fora do período permitido para agendamentos.\n\nEscolha outra data disponível.`
      );
      await updateSession(supabase, session.id, { state: 'SELECT_DATE' });
      return { handled: true, newState: 'SELECT_DATE' };
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

  // Delete session instead of setting to FINISHED to avoid asking CPF again
  await supabase.from('whatsapp_booking_sessions').delete().eq('id', session.id);

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

  // Fetch booking_months_ahead configuration from clinic
  const { data: clinicConfig } = await supabase
    .from('clinics')
    .select('booking_months_ahead')
    .eq('id', clinicId)
    .single();
  
  // Only apply restriction if explicitly configured (union clinics)
  // Default to 12 months (no practical restriction) for regular clinics
  const bookingMonthsAhead = clinicConfig?.booking_months_ahead ?? 12;

  // Calculate the last allowed date based on booking_months_ahead
  const brazilNowForLimit = getBrazilNow();
  const lastAllowedDate = new Date(brazilNowForLimit.getFullYear(), brazilNowForLimit.getMonth() + bookingMonthsAhead, 0);
  lastAllowedDate.setHours(23, 59, 59, 999);

  console.log(`[booking] getAvailableDates: bookingMonthsAhead=${bookingMonthsAhead}, lastAllowedDate=${lastAllowedDate.toISOString().split('T')[0]}`);

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

  // Calculate max days to search based on booking_months_ahead
  const maxDaysToSearch = Math.min(90, bookingMonthsAhead * 31); // Cap at 90 days for performance

  // Start from today (i=0) to include same-day booking if there are available slots
  for (let i = 0; i <= maxDaysToSearch && dates.length < 5; i++) {
    const dateObj = new Date(today);
    dateObj.setDate(dateObj.getDate() + i);

    // Check if date exceeds the allowed booking window
    if (dateObj > lastAllowedDate) {
      console.log(`[booking] Date ${dateObj.toISOString().split('T')[0]} exceeds lastAllowedDate, stopping search`);
      break;
    }

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
  professionalId: string,
  dependentId?: string | null
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

  // Calculate month boundaries
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  // Build query based on whether it's a dependent or the main patient
  let existingAppointmentsQuery = supabase
    .from('appointments')
    .select('id')
    .eq('clinic_id', clinicId)
    .eq('professional_id', professionalId)
    .gte('appointment_date', monthStart)
    .lte('appointment_date', monthEnd)
    .neq('status', 'cancelled');

  if (dependentId) {
    // For dependent: count only THIS dependent's appointments
    existingAppointmentsQuery = existingAppointmentsQuery.eq('dependent_id', dependentId);
    console.log(`[booking] CPF limit check for DEPENDENT: dependentId=${dependentId}, professional=${professionalId}, month=${monthStart}`);
  } else {
    // For main patient: count only patient's appointments (without dependent)
    existingAppointmentsQuery = existingAppointmentsQuery
      .eq('patient_id', patientId)
      .is('dependent_id', null);
    console.log(`[booking] CPF limit check for PATIENT: patientId=${patientId}, professional=${professionalId}, month=${monthStart}`);
  }

  const { data: existingAppointments, error } = await existingAppointmentsQuery;

  if (error) {
    console.error('[booking] Error checking CPF limit:', error);
    return { limitReached: false, maxAllowed };
  }

  const currentCount = existingAppointments?.length || 0;

  console.log(`[booking] CPF limit result: count=${currentCount}, max=${maxAllowed}, limitReached=${currentCount >= maxAllowed}`);

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
  // Get professional's appointment duration to calculate end time
  const { data: professional } = await supabase
    .from('professionals')
    .select('appointment_duration')
    .eq('id', professionalId)
    .single();
  
  const duration = (professional as { appointment_duration?: number } | null)?.appointment_duration || 30;
  
  // Calculate proposed end time
  const [hours, minutes] = time.split(':').map(Number);
  const endMinutes = hours * 60 + minutes + duration;
  const endHours = Math.floor(endMinutes / 60);
  const endMins = endMinutes % 60;
  const endTime = `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;
  
  // Check for overlapping appointments using time range overlap logic:
  // Two ranges overlap if: start1 < end2 AND start2 < end1
  const { data: existing } = await supabase
    .from('appointments')
    .select('id, start_time, end_time')
    .eq('clinic_id', clinicId)
    .eq('professional_id', professionalId)
    .eq('appointment_date', date)
    .in('status', ['scheduled', 'confirmed', 'in_progress'])
    .lt('start_time', endTime)  // existing start < new end
    .gt('end_time', time);       // existing end > new start

  if (existing && existing.length > 0) {
    console.log(`[booking] Slot conflict detected: ${time}-${endTime} overlaps with existing appointment ${existing[0].start_time}-${existing[0].end_time}`);
    return false;
  }

  return true;
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
  const trimmedText = messageText.trim();
  
  // Handle interactive button responses (confirm_apt_* / cancel_apt_*)
  if (trimmedText.startsWith('confirm_apt_')) {
    action = 'confirmed';
  } else if (trimmedText.startsWith('cancel_apt_')) {
    action = 'cancelled';
  } else if (POSITIVE_REGEX.test(trimmedText)) {
    action = 'confirmed';
  } else if (NEGATIVE_REGEX.test(trimmedText)) {
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
    // Log raw body for debugging
    const rawBody = await req.text();
    console.log('[webhook] Raw body received:', rawBody.substring(0, 500));
    
    // Parse the body
    let payload: EvolutionWebhookPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch (parseError) {
      console.error('[webhook] JSON parse error:', parseError);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid JSON' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
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

    // Ignore group messages: interactive official templates/buttons are not reliable in groups
    // and can fall back to raw "templateoficial" command text.
    if (remoteJid.endsWith('@g.us')) {
      console.log(`[webhook] Group message ignored: ${remoteJid}`);
      return new Response(
        JSON.stringify({ success: true, message: 'Group message ignored' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const phone = normalizePhone(remoteJid.replace('@s.whatsapp.net', ''));
    let messageText = extractMessageText(payload.data);
    const messageType = payload.data?.messageType;
    const imageMessage = payload.data?.message?.imageMessage;
    const documentMessage = payload.data?.message?.documentMessage;

    console.log(`[webhook] Phone: ${phone}, Message: "${messageText}", Type: ${messageType}`);

    // Handle image/document messages - check session state first
    if (phone && (imageMessage || documentMessage || messageType === 'imageMessage' || messageType === 'documentMessage')) {
      
      // PRIORITY: Check if session is waiting for dependent CPF photo
      const phoneCandidatesForImage = getBrazilPhoneVariants(phone);
      const { data: dependentPhotoSession } = await supabase
        .from('whatsapp_booking_sessions')
        .select('id, state, clinic_id, pending_registration_name, pending_registration_birthdate, pending_registration_relationship, pending_registration_titular_cpf, pending_registration_cpf')
        .in('phone', phoneCandidatesForImage)
        .eq('state', 'WAITING_DEPENDENT_CPF_PHOTO')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      // If waiting for dependent CPF photo, process in that flow
      if (dependentPhotoSession) {
        console.log('[webhook] Processing as dependent CPF photo');
        const cpfPhotoHandled = await handleDependentCpfPhotoUpload(
          supabase,
          phone,
          payload.instance || '',
          payload.data?.key?.id || '',
          imageMessage || documentMessage,
          messageType || '',
          dependentPhotoSession
        );
        
        if (cpfPhotoHandled) {
          return new Response(
            JSON.stringify({ success: true, message: 'Dependent CPF photo processed' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
      
      // Otherwise, process as payslip
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
          .select('clinic_id, api_url, api_key, instance_name, direct_reply_enabled, booking_enabled')
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
          .select('clinic_id, api_url, api_key, instance_name, direct_reply_enabled, booking_enabled')
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
        console.log(`[webhook] Processing for clinic ${clinicId}`);

        // ===== WHAZING BUTTON RESPONSE HANDLER =====
        // Level 1 buttons: main categories → send sub-menu
        const whazingLevel1Ids = ['whazing_associado', 'whazing_empresa', 'whazing_contabilidade'];
        const isWhazingLevel1 = whazingLevel1Ids.includes(messageText?.trim());

        // Level 2 buttons: sub-options → route to flow
        const whazingLevel2Ids = ['whazing_sub_carteirinha', 'whazing_sub_convencoes', 'whazing_sub_outros', 'whazing_sub_boleto'];
        const isWhazingLevel2 = whazingLevel2Ids.includes(messageText?.trim());

        // Level 3 buttons: follow-up actions after AI response + "Outros Assuntos" sub-options
        const whazingFollowUpIds = ['whazing_voltar_menu', 'whazing_falar_atendente', 'whazing_voltar_sub', 'whazing_outros_juridico', 'whazing_outros_homologacao', 'whazing_outros_atendente'];
        const isWhazingFollowUp = whazingFollowUpIds.includes(messageText?.trim());

        // Also handle legacy button IDs (whazing_outros)
        const isWhazingLegacy = messageText?.trim() === 'whazing_outros';

        // ===== FOLLOW-UP BUTTON HANDLER (Level 3) =====
        if (isWhazingFollowUp) {
          const followUpId = messageText.trim();
          console.log(`[webhook] Whazing follow-up button: "${followUpId}"`);

          if (followUpId === 'whazing_voltar_menu') {
            // Send main menu again
            await sendWhazingMenuButtons(phone);
            return new Response(
              JSON.stringify({ success: true, message: 'Main menu resent' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          if (followUpId === 'whazing_voltar_sub') {
            // Retrieve stored category and resend sub-menu
            const storedCat = await getWhazingCategory(supabase, clinicId, phoneCandidates, 'associado');
            await sendWhazingSubMenu(phone, storedCat);
            return new Response(
              JSON.stringify({ success: true, message: `Sub-menu resent for ${storedCat}` }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          if (followUpId === 'whazing_falar_atendente' || followUpId === 'whazing_outros_atendente') {
            // Route to atendente via external-integration
            const storedCat = await getWhazingCategory(supabase, clinicId, phoneCandidates, 'associado');

            const supabaseUrlEnv2 = Deno.env.get('SUPABASE_URL')!;
            const supabaseAnonKey2 = Deno.env.get('SUPABASE_ANON_KEY')!;
            try {
              await fetch(`${supabaseUrlEnv2}/functions/v1/external-integration`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${supabaseAnonKey2}`,
                },
                body: JSON.stringify({
                  phone,
                  action: 'atendente',
                  context: `Perfil: ${storedCat}`,
                  clinic_id: clinicId,
                  instance_name: configData.instance_name,
                }),
              });
            } catch (_e) { /* ignore */ }
            return new Response(
              JSON.stringify({ success: true, message: 'Routed to atendente' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // "Outros Assuntos" sub-option: Jurídico
          if (followUpId === 'whazing_outros_juridico') {
            const storedCat = await getWhazingCategory(supabase, clinicId, phoneCandidates, 'associado');

            const supabaseUrlEnv2 = Deno.env.get('SUPABASE_URL')!;
            const supabaseAnonKey2 = Deno.env.get('SUPABASE_ANON_KEY')!;
            try {
              const extResponse = await fetch(`${supabaseUrlEnv2}/functions/v1/external-integration`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${supabaseAnonKey2}`,
                },
                body: JSON.stringify({
                  phone,
                  action: 'juridico',
                  context: `Perfil: ${storedCat}`,
                  clinic_id: clinicId,
                  instance_name: configData.instance_name,
                }),
              });
              const extResult = await extResponse.json();
              console.log(`[webhook] Juridico result:`, JSON.stringify(extResult).substring(0, 300));
            } catch (_e) { /* ignore */ }

            // Follow-up buttons after AI response
            await new Promise(resolve => setTimeout(resolve, 2000));
            await sendWhazingButtons(phone, "Posso ajudar com mais alguma coisa?", [
              { id: "whazing_falar_atendente", title: "Falar c/ Atendente" },
              { id: "whazing_voltar_sub", title: "Voltar" },
              { id: "whazing_voltar_menu", title: "Menu Principal" },
            ]);

            return new Response(
              JSON.stringify({ success: true, message: 'Routed to juridico' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // "Outros Assuntos" sub-option: Homologações
          if (followUpId === 'whazing_outros_homologacao') {
            // Send informational message with scheduling link
            const homologacaoMsg = `📋 *Homologações*\n\nO agendamento de homologação é realizado através do portal do sindicato.\n\nAcesse o link abaixo para agendar:\n👉 https://prosindweb.com.br/agendamento/profissional/ione-atos-1`;
            
            try {
              await fetch(`${configData.api_url}/message/sendText/${configData.instance_name}`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'apikey': configData.api_key,
                },
                body: JSON.stringify({
                  number: phone,
                  text: homologacaoMsg,
                }),
              });
            } catch (_e) { /* ignore */ }

            // Follow-up buttons
            await new Promise(resolve => setTimeout(resolve, 2000));
            await sendWhazingButtons(phone, "Posso ajudar com mais alguma coisa?", [
              { id: "whazing_falar_atendente", title: "Falar c/ Atendente" },
              { id: "whazing_voltar_sub", title: "Voltar" },
              { id: "whazing_voltar_menu", title: "Menu Principal" },
            ]);

            return new Response(
              JSON.stringify({ success: true, message: 'Routed to homologacao' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        if (isWhazingLevel1) {
          console.log(`[webhook] Whazing Level 1 button: "${messageText}" → sending sub-menu`);
          
          const categoryMap: Record<string, WhazingCategory> = {
            whazing_associado: 'associado',
            whazing_empresa: 'empresa',
            whazing_contabilidade: 'contabilidade',
          };
          const category = categoryMap[messageText.trim()] ?? 'associado';

          // Store the selected category in a temporary session for context
          await storeWhazingCategory(supabase, clinicId, phone, category);

          const subSent = await sendWhazingSubMenu(phone, category);
          
          await supabase.from('whatsapp_incoming_logs').insert({
            clinic_id: clinicId,
            phone,
            message_text: `[whazing-L1] ${messageText} → sub-menu ${category}`,
            raw_payload: payload,
            processed: true,
            processed_action: 'whazing_submenu_sent',
          });

          return new Response(
            JSON.stringify({ success: true, message: `Whazing sub-menu sent for ${category}` }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (isWhazingLevel2 || isWhazingLegacy) {
          console.log(`[webhook] Whazing Level 2 button: "${messageText}" → routing to flow`);

          // Retrieve stored category context
          const storedCategory = await getWhazingCategory(supabase, clinicId, phoneCandidates, 'associado');

          const btnId = messageText.trim();

          // ── BOLETO: route directly to boleto-whatsapp-flow ──
          if (btnId === 'whazing_sub_boleto') {
            console.log(`[webhook] Whazing boleto button → direct boleto flow (category: ${storedCategory})`);
            const supabaseUrlEnv = Deno.env.get('SUPABASE_URL')!;
            const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

            try {
              const boletoResponse = await fetch(`${supabaseUrlEnv}/functions/v1/boleto-whatsapp-flow`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${supabaseAnonKey}`,
                },
                body: JSON.stringify({
                  clinic_id: clinicId,
                  phone: phone,
                  action: 'start',
                  evolution_config: {
                    api_url: configData.api_url,
                    api_key: configData.api_key,
                    instance_name: configData.instance_name,
                  }
                }),
              });

              if (boletoResponse.ok) {
                const boletoResult = await boletoResponse.json();
                console.log(`[webhook] Boleto flow started via Whazing button: state=${boletoResult.state}`);
              } else {
                const errText = await boletoResponse.text();
                console.error('[webhook] Boleto flow error from Whazing button:', errText);
              }
            } catch (bErr) {
              console.error('[webhook] Error calling boleto flow from Whazing button:', bErr);
            }

            await supabase.from('whatsapp_incoming_logs').insert({
              clinic_id: clinicId,
              phone,
              message_text: `[whazing-L2] ${storedCategory}/boleto → direct boleto flow`,
              raw_payload: payload,
              processed: true,
              processed_action: 'whazing_boleto_direct',
            });

            return new Response(
              JSON.stringify({ success: true, message: 'Whazing boleto flow started directly' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // ── CARTEIRINHA: redirect to app (not available via WhatsApp) ──
          if (btnId === 'whazing_sub_carteirinha') {
            console.log(`[webhook] Whazing carteirinha button → redirect to app`);

            // Send image guide first
            const whazingUrl = Deno.env.get('WHAZING_API_URL');
            const whazingToken = Deno.env.get('WHAZING_API_TOKEN');
            if (whazingUrl && whazingToken) {
              let cleanPhoneImg = phone.replace(/@s\.whatsapp\.net$/, '').replace(/\D/g, '');
              if (!cleanPhoneImg.startsWith('55')) cleanPhoneImg = '55' + cleanPhoneImg;
              const apiOficialUrl = whazingUrl.replace(/\/$/, '') + '/apioficial';

              const imageUrl = 'https://czmnkrurkzuerrcjzbkp.supabase.co/storage/v1/object/public/whatsapp-assets/carteirinha-app-guide.jpg';
              const caption = `📱 *Atualização de Carteirinha*\n\nA atualização da carteirinha é feita de forma rápida e prática diretamente pelo *aplicativo do sindicato*! 📲\n\n📋 *Como fazer:*\n1️⃣ Abra o app do sindicato\n2️⃣ Na tela principal, em *"Nossos Serviços"*, toque em *"Atualizar Carteirinha"*\n3️⃣ Siga as instruções na tela\n\n📥 *Baixe o app:*\n👉 https://prosindweb.com.br/sindicato/instalar\n\n⚠️ Este serviço *não está disponível* por WhatsApp.`;

              try {
                await fetch(apiOficialUrl, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${whazingToken}`,
                  },
                  body: JSON.stringify({
                    number: cleanPhoneImg,
                    contents: {
                      type: "image",
                      body: { url: imageUrl },
                      caption: caption,
                    }
                  }),
                });
              } catch (imgErr) {
                console.error('[whazing] Error sending carteirinha image:', imgErr);
              }
            }

            // Send follow-up buttons after image
            await new Promise(resolve => setTimeout(resolve, 2000));
            await sendWhazingButtons(phone, "Posso ajudar com mais alguma coisa?", [
              { id: "whazing_falar_atendente", title: "Falar c/ Atendente" },
              { id: "whazing_voltar_sub", title: "Voltar" },
              { id: "whazing_voltar_menu", title: "Menu Principal" },
            ]);

            await supabase.from('whatsapp_incoming_logs').insert({
              clinic_id: clinicId,
              phone,
              message_text: `[whazing-L2] ${storedCategory}/carteirinha → redirect to app`,
              raw_payload: payload,
              processed: true,
              processed_action: 'whazing_carteirinha_redirect',
            });

            return new Response(
              JSON.stringify({ success: true, message: 'Carteirinha redirect sent' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // ── OUTROS ASSUNTOS: show category-specific sub-menu ──
          if (btnId === 'whazing_sub_outros' || btnId === 'whazing_outros') {
            console.log(`[webhook] Whazing "Outros Assuntos" → category-specific sub-menu (${storedCategory})`);

            if (storedCategory === 'associado') {
              await sendWhazingButtons(phone, "*Outros Assuntos - Associado*\n\nComo podemos ajudar?", [
                { id: "whazing_outros_juridico", title: "Juridico" },
                { id: "whazing_outros_atendente", title: "Falar c/ Atendente" },
                { id: "whazing_voltar_sub", title: "Voltar" },
              ]);
            } else {
              // empresa / contabilidade
              await sendWhazingButtons(phone, "*Outros Assuntos*\n\nComo podemos ajudar?", [
                { id: "whazing_outros_juridico", title: "Juridico" },
                { id: "whazing_outros_homologacao", title: "Homologacoes" },
                { id: "whazing_outros_atendente", title: "Falar c/ Atendente" },
              ]);
            }

            await supabase.from('whatsapp_incoming_logs').insert({
              clinic_id: clinicId,
              phone,
              message_text: `[whazing-L2] ${storedCategory}/outros → sub-menu`,
              raw_payload: payload,
              processed: true,
              processed_action: 'whazing_outros_submenu',
            });

            return new Response(
              JSON.stringify({ success: true, message: `Outros Assuntos sub-menu sent for ${storedCategory}` }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // ── OTHER SUB-BUTTONS: route via external-integration (AI) ──
          const subActionMap: Record<string, string> = {
            'whazing_sub_convencoes': 'cct',
          };
          const action = subActionMap[btnId] || 'atendente';
          const contextStr = `Perfil: ${storedCategory}`;

          // Route to external-integration function
          const supabaseUrlEnv = Deno.env.get('SUPABASE_URL')!;
          const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

          try {
            const extResponse = await fetch(`${supabaseUrlEnv}/functions/v1/external-integration`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseAnonKey}`,
              },
              body: JSON.stringify({
                phone: phone,
                action: action,
                context: contextStr,
                clinic_id: clinicId,
                instance_name: configData.instance_name,
              }),
            });

            const extResult = await extResponse.json();
            console.log(`[webhook] External-integration result:`, JSON.stringify(extResult).substring(0, 300));

            // Send follow-up buttons after AI response (with small delay for message ordering)
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const followUpButtons = action === 'atendente'
              ? [
                  { id: "whazing_voltar_sub", title: "Voltar" },
                  { id: "whazing_voltar_menu", title: "Menu Principal" },
                ]
              : [
                  { id: "whazing_falar_atendente", title: "Falar c/ Atendente" },
                  { id: "whazing_voltar_sub", title: "Voltar" },
                  { id: "whazing_voltar_menu", title: "Menu Principal" },
                ];
            
            await sendWhazingButtons(phone, "O que deseja fazer agora?", followUpButtons);
          } catch (extErr) {
            console.error('[webhook] Error calling external-integration for Whazing button:', extErr);
          }

          await supabase.from('whatsapp_incoming_logs').insert({
            clinic_id: clinicId,
            phone,
            message_text: `[whazing-L2] ${storedCategory}/${btnId}`,
            raw_payload: payload,
            processed: true,
            processed_action: 'whazing_button_response',
          });

          return new Response(
            JSON.stringify({ success: true, message: 'Whazing button response processed' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        // ===== END WHAZING BUTTON RESPONSE HANDLER =====

        // ===== WHAZING INITIAL MENU - FRESH CONVERSATION =====
        // If Whazing is configured and this is a fresh conversation (no active sessions),
        // send interactive buttons instead of proceeding to text-based flows.
        // This MUST run BEFORE the DEFINITIVE GATE to handle booking_enabled=false clinics.
        const whazingUrl = Deno.env.get('WHAZING_API_URL');
        const whazingToken = Deno.env.get('WHAZING_API_TOKEN');
        
        if (whazingUrl && whazingToken) {
          // Check for any active sessions (booking, boleto, AI)
          const { data: anyBookingSession } = await supabase
            .from('whatsapp_booking_sessions')
            .select('id, state')
            .eq('clinic_id', clinicId)
            .in('phone', phoneCandidates)
            .neq('state', 'FINISHED')
            .gt('expires_at', new Date().toISOString())
            .limit(1)
            .maybeSingle();

          const { data: anyBoletoSession } = await supabase
            .from('whatsapp_boleto_sessions')
            .select('id')
            .eq('clinic_id', clinicId)
            .in('phone', phoneCandidates)
            .gt('expires_at', new Date().toISOString())
            .neq('state', 'FINISHED')
            .limit(1)
            .maybeSingle();

          const { data: anyAiConversation } = await supabase
            .from('whatsapp_ai_conversations')
            .select('id')
            .eq('clinic_id', clinicId)
            .in('phone', phoneCandidates)
            .gt('expires_at', new Date().toISOString())
            .limit(1)
            .maybeSingle();

          const isFreshConversation = !anyBookingSession && !anyBoletoSession && !anyAiConversation;
          
          // Check if message is a greeting or generic first message (not a CPF, number, or specific action)
          const msgClean = messageText.trim();
          const isCpf = /^\d{11}$/.test(msgClean.replace(/\D/g, ''));
          const isNumericOption = /^\d{1,2}$/.test(msgClean);
          const isBoletoKeyword = /^(boleto|2[ª°]?\s*via|segunda\s*via)/i.test(msgClean);
          const isNotSpecificAction = !isCpf && !isNumericOption && !isBoletoKeyword && !MENU_REGEX.test(msgClean) && !CANCEL_REGEX.test(msgClean);

          // Greetings should always restart the menu, even with an active AI session
          const isGreeting = /^(oi|olá|ola|hey|hi|hello|bom\s*dia|boa\s*tarde|boa\s*noite|eai|e\s*ai|opa|fala)/i.test(msgClean);
          const shouldShowMenu = isGreeting && !anyBookingSession && !anyBoletoSession;

          // If it's a greeting with an active AI session, expire the old session first
          if (shouldShowMenu && anyAiConversation) {
            console.log(`[webhook] Greeting detected with active AI session - expiring old session to show Whazing menu`);
            await supabase
              .from('whatsapp_ai_conversations')
              .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
              .eq('clinic_id', clinicId)
              .in('phone', phoneCandidates)
              .gt('expires_at', new Date().toISOString());
          }

          if ((isFreshConversation || shouldShowMenu) && isNotSpecificAction) {
            console.log(`[webhook] Fresh conversation detected - sending Whazing interactive buttons to ${phone}`);
            const buttonsSent = await sendWhazingMenuButtons(phone);
            
            if (buttonsSent) {
              await supabase.from('whatsapp_incoming_logs').insert({
                clinic_id: clinicId,
                phone,
                message_text: messageText,
                raw_payload: payload,
                processed: true,
                processed_action: 'whazing_menu_sent',
              });

              return new Response(
                JSON.stringify({ success: true, message: 'Whazing menu buttons sent' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
            console.log('[webhook] Whazing buttons failed, falling through to normal flow');
          }
        }
        // ===== END WHAZING INITIAL MENU =====

        // ===== BOLETO BUTTON ID TRANSLATION =====
        // Convert Whazing interactive button IDs from boleto flow into text the flow understands
        const boletoButtonMap: Record<string, string> = {
          'boleto_a_vencer': '1',
          'boleto_vencido': '2',
          'boleto_sim': 'sim',
          'boleto_nao': 'não',
          'boleto_confirmar': 'confirmar',
          'boleto_cancelar': 'cancelar',
          'boleto_type_1': '1',
          'boleto_type_2': '2',
          'boleto_type_3': '3',
          'boleto_taxa_1': '1',
          'boleto_taxa_2': '2',
          'boleto_contrib_1': '1',
          'boleto_contrib_2': '2',
          'boleto_contrib_3': '3',
          'boleto_contrib_mais': 'mais',
          'boleto_contrib_voltar': 'voltar',
          'boleto_year_1': '1',
          'boleto_year_2': '2',
          'boleto_year_3': '3',
        };
        const boletoButtonText = boletoButtonMap[messageText?.trim()];
        if (boletoButtonText) {
          console.log(`[webhook] Boleto button "${messageText}" → translated to "${boletoButtonText}"`);
          messageText = boletoButtonText;
        }
        // ===== END BOLETO BUTTON ID TRANSLATION =====

        // Check if there's an active boleto session or user is requesting boleto (option 7)
        const { data: activeBoletoSession } = await supabase
          .from('whatsapp_boleto_sessions')
          .select('*')
          .eq('clinic_id', clinicId)
          .in('phone', phoneCandidates)
          .gt('expires_at', new Date().toISOString())
          .neq('state', 'FINISHED')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        // '6' is also boleto when booking is disabled (menu without booking: 6=boleto)
        const isBoletoRequest = /^(6|7|boleto|2[ª°]?\s*via|segunda\s*via)/i.test(messageText.trim()) && configData.booking_enabled === false
          ? /^(6|boleto|2[ª°]?\s*via|segunda\s*via)/i.test(messageText.trim())
          : /^(7|boleto|2[ª°]?\s*via|segunda\s*via)/i.test(messageText.trim());

        if (activeBoletoSession || isBoletoRequest) {
          console.log(`[webhook] Routing to boleto flow - active session: ${!!activeBoletoSession}, is request: ${isBoletoRequest}`);
          
          // Call boleto flow edge function
          const supabaseUrlEnv = Deno.env.get('SUPABASE_URL')!;
          const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
          
          try {
            const boletoResponse = await fetch(`${supabaseUrlEnv}/functions/v1/boleto-whatsapp-flow`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseAnonKey}`,
              },
              body: JSON.stringify({
                clinic_id: clinicId,
                phone: phone,
                message: activeBoletoSession ? messageText : undefined,
                action: !activeBoletoSession ? 'start' : undefined,
                evolution_config: {
                  api_url: configData.api_url,
                  api_key: configData.api_key,
                  instance_name: configData.instance_name,
                }
              }),
            });

            if (boletoResponse.ok) {
              const boletoResult = await boletoResponse.json();
              console.log(`[webhook] Boleto flow result: state=${boletoResult.state}`);
              
              // Log the interaction
              await supabase.from('whatsapp_incoming_logs').insert({
                clinic_id: clinicId,
                phone,
                message_text: messageText,
                raw_payload: payload,
                processed: true,
                processed_action: 'boleto_flow',
              });

              return new Response(
                JSON.stringify({ success: true, message: 'Boleto flow processed' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            } else {
              const errorText = await boletoResponse.text();
              console.error('[webhook] Boleto flow error:', errorText);
            }
          } catch (boletoError) {
            console.error('[webhook] Error calling boleto flow:', boletoError);
          }
        }

        // =========================================================================
        // DEFINITIVE GATE: If booking_enabled=false, block BOOKING-RELATED messages.
        // THIS RUNS FIRST - before any feature/plan checks - to guarantee the correct
        // "Agendamento somente pelo aplicativo" message is always shown when booking is disabled.
        // Non-booking messages (greetings, farewells, general questions) pass through
        // to the AI assistant for normal handling.
        // =========================================================================
        let externalMenuMode = false;
        if (configData.booking_enabled === false) {
          const msgTrimmed = (messageText || '').trim();
          const msgLower = msgTrimmed.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

          // ---------------------------------------------------------------
          // REGRA ABSOLUTA quando agendamento está DESATIVADO:
          //   Opção 5 = Outros assuntos → passa para IA (atendimento humano geral)
          //   Opção 6 = Boleto → já capturado acima por isBoletoRequest
          //   QUALQUER outra menção a consulta/médico/agendamento → APP_ONLY_MESSAGE
          //   Seleções do menu externo (ex: "1", "1-2") devem seguir para IA
          //   SEM apresentar o menu interno deste sistema.
          // ---------------------------------------------------------------

          const isExternalMenuSelection = /^\d+(?:-\d+)*$/.test(msgTrimmed);
          const isCompositeMenuSelection = /^\d+(?:-\d+)+$/.test(msgTrimmed);

          if (isExternalMenuSelection) {
            externalMenuMode = true;
            if (isCompositeMenuSelection) {
              console.log(`[webhook] booking_enabled=false and external composite selection "${msgTrimmed}" detected - routing to AI (external menu mode)`);
            }
          }

          // Opção 5 = outros assuntos → deixa a IA tratar (atendimento geral, não médico)
          if (msgTrimmed === '5') {
            console.log(`[webhook] booking_enabled=false but option '5' (outros assuntos) - passing to AI assistant`);
            // fall through to AI handling below
          } else {
            // EXPANDED booking intent detection - covers ALL medical/scheduling keywords
            // including doctor names, specialties, scheduling verbs and non-external numeric fallbacks
            const bookingIntentRegex = /\b(agendar|agendamento|agenda|consulta|consultas|marcar|desmarcar|cancelar|remarcar|reagendar|retorno|retornar|horario|horarios|medico|medicos|doutor|doutora|dentista|exame|exames|profissional|disponivel|disponibilidade|vaga|vagas|atendimento|especialidade|pediatra|clinico|ginecologista|especialista|ortopedista|cardiologista|alcides|juliane|uiara|tiuba|dr |dra |dr\.|dra\.|pediatrico|nutricionist|fisioterapeuta|psicologo|psicologa|data|datas|quando atende|proxima data|proximos dias|proxima semana|tem vaga|tem horario|quero agendar|preciso agendar|gostaria de agendar|quero marcar|preciso marcar|quero consulta|preciso de consulta|quero ver medico|ir ao medico)\b/i;
            const isBookingMenuOption = /^[1-4]$/.test(msgTrimmed) && !isExternalMenuSelection;
            const hasBookingIntent = bookingIntentRegex.test(msgLower) || isBookingMenuOption;

            if (hasBookingIntent) {
              console.log(`[webhook] DEFINITIVE BLOCK: booking_enabled=false, booking intent detected for clinic ${clinicId}. Message: "${messageText}"`);

              // Expire active booking sessions
              await supabase
                .from('whatsapp_booking_sessions')
                .update({ state: 'FINISHED', expires_at: new Date().toISOString() })
                .eq('clinic_id', clinicId)
                .in('phone', phoneCandidates)
                .neq('state', 'FINISHED');

              const appOnlyMsg = `⚠️ *Agendamento somente pelo aplicativo*

O agendamento por WhatsApp está desativado. Utilize nosso aplicativo para agendar suas consultas com praticidade.

📲 *Abrir o app agora:*
👉 https://prosindweb.com.br/app

_(Se o app já estiver instalado no seu celular, o link acima abrirá diretamente nele)_

📥 *Ainda não instalou?*
👉 https://prosindweb.com.br/app/instalar

• iPhone: abra pelo *Safari* → Compartilhar → Adicionar à Tela Inicial
• Android: abra pelo *Chrome* → menu ⋮ → Adicionar à tela inicial`;

              await sendWhatsAppMessage(configData, phone, appOnlyMsg);

              await supabase.from('whatsapp_incoming_logs').insert({
                clinic_id: clinicId,
                phone,
                message_text: messageText,
                raw_payload: payload,
                processed: true,
                processed_action: 'booking_blocked_app_only',
              });

              return new Response(
                JSON.stringify({ success: true, message: 'Booking blocked - app only' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            } else {
              // Non-booking message (greetings, farewells, etc.): let AI handle
              console.log(`[webhook] booking_enabled=false but no booking intent - passing to AI. Message: "${messageText}"`);
            }
          }
        }
        // =========================================================================

        // ===== EXISTING BOOKING FLOW =====
        // CRITICAL: When booking_enabled=false, SKIP the plan feature check entirely.
        // The DEFINITIVE GATE above already handled all booking-related messages (sent app-only message or exited).
        // If we reach here with booking_enabled=false, the message is non-booking (option 5, greeting, farewell)
        // and should go directly to the AI assistant — NOT blocked by the plan check.
        if (configData.booking_enabled !== false) {
          // Check if clinic has whatsapp_booking feature in their plan
          const { data: hasBookingFeature } = await supabase
            .from('subscriptions')
            .select(`
              plan_id,
              status,
              subscription_plans!inner (
                plan_features!inner (
                  system_features!inner (
                    key
                  )
                )
              )
            `)
            .eq('clinic_id', clinicId)
            .in('status', ['active', 'trial'])
            .eq('subscription_plans.plan_features.system_features.key', 'whatsapp_booking')
            .maybeSingle();

          if (!hasBookingFeature) {
            console.log(`[webhook] Clinic ${clinicId} does NOT have whatsapp_booking feature - blocking booking flow`);
            await sendWhatsAppMessage(
              configData,
              phone,
              `⚠️ *Recurso indisponível*\n\nO agendamento por WhatsApp não está disponível para esta clínica.\n\nPor favor, entre em contato diretamente com a clínica para realizar seu agendamento.`
            );
            return new Response(
              JSON.stringify({ success: true, message: 'Feature not available for clinic' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          console.log(`[webhook] Clinic ${clinicId} has whatsapp_booking feature - proceeding`);
        } else {
          // booking_enabled=false: skip plan check, route non-booking messages directly to AI assistant
          console.log(`[webhook] booking_enabled=false for clinic ${clinicId} - skipping plan check, routing non-booking message to AI`);
          const supabaseUrlEnv = Deno.env.get('SUPABASE_URL')!;
          const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
          try {
            await fetch(`${supabaseUrlEnv}/functions/v1/whatsapp-ai-assistant`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseAnonKey}`,
              },
              body: JSON.stringify({
                clinic_id: clinicId,
                phone,
                message: messageText,
                evolution_config: {
                  api_url: configData.api_url,
                  api_key: configData.api_key,
                  instance_name: configData.instance_name,
                },
                booking_enabled: false,
                suppress_internal_menu: true,
                external_menu_mode: externalMenuMode,
              }),
            });
          } catch (aiErr) {
            console.error('[webhook] Error calling AI assistant (non-booking path):', aiErr);
          }
          return new Response(
            JSON.stringify({ success: true, message: 'Non-booking message routed to AI' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }




        // Check if clinic uses AI booking
        const { data: clinicSettings } = await supabase
          .from('clinics')
          .select('use_ai_booking')
          .eq('id', clinicId)
          .single();

        if (clinicSettings?.use_ai_booking) {
          // Use AI-powered booking flow
          console.log(`[webhook] Using AI booking for clinic ${clinicId}`);
          await handleAIBookingFlow(supabase, configData, phone, messageText);
        } else {
          // Use traditional menu-based flow
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
