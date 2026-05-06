 function getZapsterDeptIdFromQueue(queueId: string | null): string {
   const map: Record<string, string> = {
     '2c1ef611-09d4-4866-b0db-19164e8f8611': 'fa193a46-e119-4994-852b-29e551ab37f1', // Associdos
     'f6f0911b-8bb5-49c1-8d86-e519dc7515d4': '3259b59a-8f9d-4027-8520-2b78167d59ab', // Empresas
     'c7efdda1-d773-40ea-84e5-4c8b46e0ef8e': '3259b59a-8f9d-4027-8520-2b78167d59ab', // Contabilidade
      '6644c29c-95b9-414f-ba8c-62a2402ede34': '972827ca-657d-4c37-a164-944e6e6113b3', // Administrativo -> Outros assuntos
   };
   return (queueId && map[queueId]) || 'fa193a46-e119-4994-852b-29e551ab37f1';
 }
 
 function getZapsterDeptIdFromKeyword(text: string): string | null {
   const lower = text.toLowerCase();
   if (lower.includes('associado')) return 'fa193a46-e119-4994-852b-29e551ab37f1';
   if (lower.includes('empresa')) return '3259b59a-8f9d-4027-8520-2b78167d59ab';
   if (lower.includes('contabilidade') || lower.includes('contador')) return '3259b59a-8f9d-4027-8520-2b78167d59ab';
   return null;
 }
 
// whatsapp-webhook v2.1 - 2026-02-18
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { AsyncLocalStorage } from "node:async_hooks";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ==========================================
// SYNCHRONOUS REPLY STORAGE
// ==========================================
const syncReplyStore = new AsyncLocalStorage<string[]>();

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
      remoteJidAlt?: string;
      fromMe?: boolean;
      id?: string;
    };
    message?: {
      conversation?: string;
      extendedTextMessage?: {
        text?: string;
      };
      // Interactive button response (plural - Evolution API native)
      buttonsResponseMessage?: {
        selectedButtonId?: string;
        selectedDisplayText?: string;
      };
      // Interactive button response (singular - Whazing/alternative format)
      buttonResponseMessage?: {
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
      // Reaction used by some WhatsApp clients as a fallback when buttons are not rendered
      reactionMessage?: {
        text?: string;
        key?: {
          remoteJid?: string;
          fromMe?: boolean;
          id?: string;
        };
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
      // Outgoing interactive message (bot menus)
      interactiveMessage?: Record<string, unknown>;
      buttonsMessage?: Record<string, unknown>;
      templateMessage?: Record<string, unknown>;
      videoMessage?: Record<string, unknown>;
      audioMessage?: Record<string, unknown>;
      stickerMessage?: Record<string, unknown>;
    };
    messageType?: string;
    messageTimestamp?: number | string;
    pushName?: string;
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

function createSuccessResponse(data: any) {
  const collector = syncReplyStore.getStore();
  if (collector && collector.length > 0) {
    data.reply = collector.join('\n\n');
  }
  return new Response(JSON.stringify({ success: true, ...data }), {
    headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }
  });
}

 function normalizePhone(phone: string): string {
   if (!phone) return "";
   // Evolution can send remoteJid like "55DDDNÚMERO:device@s.whatsapp.net".
   // For session consistency, strip the ":device" suffix and keep only the real phone digits.
   let base = phone.replace(/@s\.whatsapp\.net$/, '');
   base = base.replace(/:\d+$/, '');
 
    const cleaned = base.replace(/\D/g, '');
    
    // Map specific Zap Responder / Evolution test numbers to a fixed session phone
    // Common test numbers from Zap Responder / Evolution: "0", "550", "55", etc.
    if (cleaned === "0" || cleaned === "550" || cleaned === "55" || cleaned === "5500" || cleaned === "") {
      return "550000000000";
    }
    
    return cleaned.startsWith('55') ? cleaned : '55' + cleaned;
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
  const messageAny = data.message as any;
  
  // Check for interactive button response (plural - Evolution API native)
   const explicitId =
     data.message?.buttonsResponseMessage?.selectedButtonId ||
     (data.message as any)?.interactive?.button_reply?.id ||
     (data.message as any)?.interactive?.list_reply?.id ||
     data.message?.buttonResponseMessage?.selectedButtonId ||
     data.message?.listResponseMessage?.singleSelectReply?.selectedRowId ||
     messageAny?.buttonReplyMessage?.id ||
     messageAny?.buttonReplyMessage?.selectedId ||
     messageAny?.buttonReplyMessage?.selectedButtonId ||
     messageAny?.interactiveResponseMessage?.id ||
     messageAny?.interactiveResponseMessage?.button_id ||
     messageAny?.templateButtonReplyMessage?.selectedId;
 
   if (explicitId) {
      console.log('[extractMessageText] Found explicit ID:', explicitId);
      if (explicitId === 'whazing_associado' || explicitId === 'Sou Associado') return 'Sou Associado';
      if (explicitId === 'whazing_empresa' || explicitId === 'Sou Empresa') return 'Sou Empresa';
      if (explicitId === 'whazing_contabilidade' || explicitId === 'Sou Contabilidade') return 'Sou Contabilidade';
      if (explicitId === 'whazing_sub_boleto') return '2ª Via Boleto';
      if (explicitId === 'whazing_sub_convencoes') return 'Convenções Coletivas';
      if (explicitId === 'whazing_sub_outros') return 'Outros Assuntos';
      if (explicitId === 'whazing_sub_carteirinha') return 'Atualizar Carteirinha';
      return String(explicitId);
    }
 
    if (data.message?.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson) {
     try {
       const params = JSON.parse(data.message.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson);
       const bId = params.id || params.button_id || params.buttonId || params.selectedButtonId || params.selectedId || params.payload;
       if (bId) {
          if (bId === 'whazing_associado' || bId === 'Sou Associado') return 'Sou Associado';
          if (bId === 'whazing_empresa' || bId === 'Sou Empresa') return 'Sou Empresa';
          if (bId === 'whazing_contabilidade' || bId === 'Sou Contabilidade') return 'Sou Contabilidade';
         return String(bId);
       }
     } catch { /* ignore */ }
   }

  // Some clients/instances deliver the user's choice as a reaction to the button/message.
  // Treat positive/negative reactions as confirmation/cancellation fallbacks.
  const reactionText = messageAny?.reactionMessage?.text;
  if (typeof reactionText === 'string' && reactionText.trim()) {
    const normalizedReaction = reactionText.trim();
    console.log('[extractMessageText] Found reactionMessage:', normalizedReaction);
    if (/^(✅|👍|✔️|☑️|👌|sim|s)$/i.test(normalizedReaction)) return 'SIM';
    if (/^(❌|👎|✖️|🚫|não|nao|n)$/i.test(normalizedReaction)) return 'NÃO';
    return normalizedReaction;
  }
  
  // Check for button reply (alternative format)
  if (data.message?.templateButtonReplyMessage?.selectedId) {
    return data.message.templateButtonReplyMessage.selectedId;
  }
  
  // Fallback: check selectedDisplayText from any button response as last resort
  const displayText = data.message?.buttonsResponseMessage?.selectedDisplayText ||
                      data.message?.buttonResponseMessage?.selectedDisplayText;
  if (displayText) {
    console.log('[extractMessageText] Fallback to selectedDisplayText:', displayText);
    // Map display text to action keywords for confirmation flow
    if (displayText.includes('Confirmar')) return 'SIM';
    if (displayText.includes('Cancelar')) return 'NÃO';
    return displayText;
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
  // Evolution API sendText expects the numeric WhatsApp number. Sending a JID
  // (ex: 5573...@s.whatsapp.net) can be accepted as PENDING and then fail with
  // messages.update status=ERROR, which made LIA look silent in Whazing.
  return formattedPhone;
}

const WHATSAPP_EMOJI_REGEX = /[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\uFE0F\u200D\u20E3]/gu;

function sanitizeOutgoingWhatsAppText(text: string): string {
  return text
    .replace(WHATSAPP_EMOJI_REGEX, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
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

async function sendWhazingTextMessage(phone: string, message: string): Promise<boolean> {
  const whazingUrl = Deno.env.get('WHAZING_API_URL');
  const whazingToken = Deno.env.get('WHAZING_API_TOKEN');

  if (!whazingUrl || !whazingToken) {
    console.warn('[whazing-text] WHAZING_API_URL or WHAZING_API_TOKEN not set');
    return false;
  }

  try {
    const cleanPhone = formatPhoneForWhatsApp(phone);
    const safeMessage = sanitizeOutgoingWhatsAppText(message);
    const payload = buildWhazingTextPayload(whazingUrl, cleanPhone, safeMessage);
    
    console.log(`[whazing-text] Sending to ${cleanPhone}. URL: ${getWhazingSendUrl(whazingUrl)}`);

    const response = await fetch(getWhazingSendUrl(whazingUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${whazingToken}`,
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    if (!response.ok) {
      console.error('[whazing-text] API error:', response.status, responseText);
      return false;
    }

    console.log(`[whazing-text] Message sent successfully to ${cleanPhone}`);
    return true;
  } catch (error) {
    console.error('[whazing-text] Error sending message:', error);
    return false;
  }
}

 async function sendZapsterMessage(clinicId: string, phone: string, message: string, departmentId?: string): Promise<boolean> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    console.log(`[zapster-send] Calling send-whatsapp-zapresponder for clinic ${clinicId} phone ${phone}`);

    const response = await fetch(`${supabaseUrl}/functions/v1/send-whatsapp-zapresponder`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
         clinicId,
         phone,
         message: sanitizeOutgoingWhatsAppText(message),
         departmentId,
       }),
    });
    
    if (!response.ok) {
      console.error('[zapster-send] Error calling send function:', await response.text());
      return false;
    }
    return true;
  } catch (error) {
    console.error('[zapster-send] Exception:', error);
    return false;
  }
}

async function sendZapsterButtons(clinicId: string, phone: string, bodyText: string, buttons: Array<{ id: string; title: string }>): Promise<boolean> {
  // Zap Responder "Não Oficial" pode ter limitações com botões reais via API.
  // Como fallback, enviamos como texto com opções numeradas se os botões falharem.
  // Mas tentaremos enviar via send-whatsapp-zapresponder se suportado.
  // Por enquanto, enviamos apenas o texto consolidado para garantir entrega.
  const buttonText = buttons.map((b, i) => `\n${i + 1}️⃣ ${b.title}`).join('');
  const fullText = `${bodyText}${buttonText}`;
  return await sendZapsterMessage(clinicId, phone, fullText);
}

async function sendMetaButtons(phone: string, title: string, description: string, buttons: ButtonOption[], footer?: string, explicitPhoneId?: string): Promise<boolean> {
   try {
     // ID real do número 73 3231 1784 (hardcoded para evitar uso do WABA ID errado da env)
    const PHONE_ID = explicitPhoneId || Deno.env.get('META_PHONE_NUMBER_ID') || "1110151302179856";
    const FINAL_PHONE_ID = (PHONE_ID === "937233212814035" || PHONE_ID === "1522701919380063") ? "1110151302179856" : PHONE_ID;

     const TOKEN = Deno.env.get('META_WHATSAPP_TOKEN');
    if (!FINAL_PHONE_ID || !TOKEN) {
       console.error('[meta-buttons] Missing META_PHONE_NUMBER_ID or META_WHATSAPP_TOKEN');
       return false;
     }
 
     const digits = phone.replace(/\D/g, '');
     const to = digits.startsWith('55') ? digits : `55${digits}`;
 
      // Strip markdown from header text as Meta doesn't allow it
      const cleanTitle = title.replace(/[\*_~`#]/g, '').trim().substring(0, 60);
      const cleanDescription = description.substring(0, 1024) || "Selecione uma opção abaixo:";

      const payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "interactive",
        interactive: {
          type: "button",
          header: { type: "text", text: cleanTitle },
          body: { text: cleanDescription },
          ...(footer ? { footer: { text: footer.substring(0, 72) } } : {}),
          action: {
            buttons: buttons.slice(0, 3).map(b => ({
              type: "reply",
              reply: {
                id: b.id,
                title: (b.text || b.title || "").substring(0, 20)
              }
            }))
          }
        }
      };
 
     const r = await fetch(`https://graph.facebook.com/v21.0/${FINAL_PHONE_ID}/messages`, {
       method: 'POST',
       headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
       body: JSON.stringify(payload),
     });
 
      if (!r.ok) {
        const errorText = await r.text();
        console.error('[meta-buttons] Meta error:', errorText);
        
        // Fallback: If interactive buttons are not supported/authorized, send as TEXT
        if (errorText.includes('GraphMethodException') || errorText.includes('permissions')) {
          console.log(`[meta-buttons] Falling back to TEXT for ${to} due to Meta permission error`);
          const buttonText = buttons.map((b, i) => `\n${i + 1}️⃣ ${b.text || b.title}`).join('');
          const fullText = `${title}\n\n${description}\n${buttonText}${footer ? `\n\n_${footer}_` : ''}`;
          return await sendMetaText(phone, fullText);
        }
        return false;
      }
      return true;
   } catch (e) {
     console.error('[meta-buttons] Exception:', e);
     return false;
   }
 }
 
async function sendWhatsAppMessage(
  config: EvolutionConfig,
  phone: string,
  message: string,
  explicitPhoneId?: string
): Promise<boolean> {
  try {
    const collector = syncReplyStore.getStore();
    if (collector) {
      console.log(`[booking] Collecting sync message for phone ${phone}`);
      collector.push(message);
      return true;
    }

    const safeMessage = sanitizeOutgoingWhatsAppText(message);
    
    const destination = formatPhoneForWhatsApp(phone);

    if (config.api_url === 'meta') {
      console.log(`[booking] Routing text to Meta Cloud API for ${destination}`);
      return await sendMetaText(phone, message, explicitPhoneId);
    }

    if (config.api_url === 'zapster') {
      console.log(`[booking] Routing to Zapster for ${destination}`);
      return await sendZapsterMessage(config.clinic_id, phone, message);
    }

    // Priority 1: Evolution API if configured
    if (config.api_url && config.api_url !== 'zapster') {
      console.log(`[booking] Sending message to ${destination} via Evolution`);
      try {
        const response = await fetch(`${config.api_url}/message/sendText/${config.instance_name}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: config.api_key,
          },
          body: JSON.stringify({
            number: destination,
            text: safeMessage,
          }),
        });

        if (response.ok) {
          console.log(`[booking] Evolution API ok (${response.status})`);
          return true;
        }
        console.error('[booking] Evolution API error:', await response.text());
      } catch (err) {
        console.error('[booking] Error calling Evolution API:', err);
      }
    }

    // Priority 2: Whazing fallback
    const whazingSent = await sendWhazingTextMessage(phone, safeMessage);
    if (whazingSent) return true;

    return false;
  } catch (error) {
    console.error('[booking] Error sending WhatsApp:', error);
    return false;
  }
}

/**
 * Envia texto livre via Meta Cloud API (somente válido dentro da janela de 24h).
 * Usado especificamente pelo fluxo de homologação do sindicato, que opera no
 * número oficial Meta. Não substitui sendWhatsAppMessage (Evolution) — é uma
 * via paralela isolada.
 */
async function sendMetaText(phone: string, text: string, explicitPhoneId?: string): Promise<boolean> {
  try {
    // ID real do número 73 3231 1784 (hardcoded para evitar uso do WABA ID errado da env)
    const PHONE_ID = explicitPhoneId || Deno.env.get('META_PHONE_NUMBER_ID') || "1110151302179856";
    const FINAL_PHONE_ID = (PHONE_ID === "937233212814035" || PHONE_ID === "1522701919380063") ? "1110151302179856" : PHONE_ID;

    const TOKEN = Deno.env.get('META_WHATSAPP_TOKEN');
    if (!FINAL_PHONE_ID || !TOKEN) {
      console.error('[meta-text] Missing META_PHONE_NUMBER_ID or META_WHATSAPP_TOKEN');
      return false;
    }
    const digits = phone.replace(/\D/g, '');
    const to = digits.startsWith('55') ? digits : `55${digits}`;
    const r = await fetch(
      `https://graph.facebook.com/v21.0/${FINAL_PHONE_ID}/messages`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: text },
        }),
      }
    );
    if (!r.ok) {
      console.error('[meta-text] Meta error:', await r.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error('[meta-text] Exception:', e);
    return false;
  }
}

// ==========================================
// INTERACTIVE OPTIONS SENDER
// Interactive flows must send native WhatsApp buttons only — never numbered text lists.
// ==========================================

interface ButtonOption {
  id: string;
  text?: string;
  title?: string;
}

async function sendWhatsAppButtons(
  config: EvolutionConfig,
  phone: string,
  title: string,
  description: string,
  buttons: ButtonOption[],
  footer?: string,
  explicitPhoneId?: string
): Promise<boolean> {
  try {
    // Limit to 3 options
    const limitedButtons = buttons.slice(0, 3).map((button) => ({
      id: button.id,
      text: sanitizeOutgoingWhatsAppText(button.text || button.title || '').substring(0, 20),
    })).filter((button) => button.id && button.text);
    console.log(`[booking] Sending interactive buttons to ${phone}:`, limitedButtons.map(b => b.text));

    if (limitedButtons.length === 0) {
      console.warn(`[booking] No valid buttons to send to ${phone}`);
      return false;
    }

    const bodyText = `${title}\n\n${description}${footer ? `\n\n_${footer}_` : ''}`;
    const buttonText = limitedButtons.map((b, i) => `\n${i + 1}️⃣ ${b.text}`).join('');
    const fullText = `${bodyText}${buttonText}`;

    // Special Routing: If API URL is 'meta', use Meta Cloud API
    if (config.api_url === 'meta') {
      console.log(`[booking] Routing buttons to Meta Cloud API for ${phone}`);
      return await sendMetaButtons(phone, title, description, limitedButtons, footer, explicitPhoneId);
    }

    // If we are in a synchronous call (collector exists), push to it and return
    const collector = syncReplyStore.getStore();
    if (collector) {
      console.log(`[booking] Collecting sync buttons for phone ${phone}`);
      collector.push(fullText);
      return true;
    }

    const whazingButtons = limitedButtons.map((b, index) => ({
      id: b.id || `option_${index + 1}`,
      title: b.text,
    }));

    if (config.api_url === 'zapster') {
      console.log(`[booking] Routing buttons to Zapster for ${phone}`);
      return await sendZapsterButtons(config.clinic_id, phone, bodyText, whazingButtons);
    }

    const destination = formatPhoneForWhatsApp(phone);

    // Priority 1: Evolution API
    if (config.api_url && !config.api_url.includes('z-api.io') && config.api_url !== 'zapster') {
      console.log(`[booking] Sending buttons to ${destination} via Evolution`);
      try {
        const response = await fetch(`${config.api_url}/message/sendButtons/${config.instance_name}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: config.api_key },
          body: JSON.stringify({
            number: destination,
            title: title,
            description: description,
            footer: footer || "Selecione uma opção",
            buttons: limitedButtons.map(b => ({
              type: "reply",
              reply: { id: b.id, title: b.text }
            }))
          }),
        });

        if (response.ok) {
          console.log(`[booking] Evolution buttons sent successfully`);
          return true;
        }
        
        console.warn(`[booking] Evolution buttons failed (${response.status}), falling back to text:`, await response.text());
        // Fallback to text within Evolution
        const textResponse = await fetch(`${config.api_url}/message/sendText/${config.instance_name}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: config.api_key },
          body: JSON.stringify({ number: destination, text: fullText }),
        });
        if (textResponse.ok) return true;
      } catch (err) {
        console.error('[booking] Error calling Evolution buttons API:', err);
      }
    }

    // Priority 2: Whazing
    const whazingSent = await sendWhazingButtons(phone, sanitizeOutgoingWhatsAppText(bodyText), whazingButtons);
    if (whazingSent) return true;

    console.warn(`[booking] Failed to send buttons to ${phone} via all providers.`);
    return false;
  } catch (error) {
    console.error('[booking] Error in sendWhatsAppButtons:', error);
    return false;
  }
}

// ==========================================
// WHAZING - AGENT TAKEOVER DETECTION
// ==========================================

/**
 * Check if a human agent has taken over the ticket in Whazing.
 * When status is "open" and userId is set, it means an attendant assumed the conversation.
 * Returns true if bot should STOP processing (agent is handling it).
 */
async function isWhazingAgentHandling(phone: string): Promise<boolean> {
  const whazingUrl = Deno.env.get('WHAZING_API_URL');
  const whazingToken = Deno.env.get('WHAZING_API_TOKEN');

  if (!whazingUrl || !whazingToken) return false;

  try {
    let cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone.startsWith('55')) cleanPhone = '55' + cleanPhone;

    const apiUrl = whazingUrl.replace(/\/$/, '');
    const response = await fetch(`${apiUrl}/showticket`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${whazingToken}`,
      },
      body: JSON.stringify({ number: cleanPhone }),
    });

    if (!response.ok) {
      console.log(`[whazing-agent-check] API returned ${response.status} for ${cleanPhone}`);
      return false;
    }

    const ticket = await response.json();
    
    // If ticket status is "open" and has a userId assigned, an agent is handling it
    if (ticket && ticket.status === 'open' && ticket.userId) {
      console.log(`[whazing-agent-check] Agent takeover detected for ${cleanPhone}: ticket #${ticket.id}, userId=${ticket.userId}, status=${ticket.status}`);
      return true;
    }

    console.log(`[whazing-agent-check] No agent takeover for ${cleanPhone}: status=${ticket?.status || 'unknown'}, userId=${ticket?.userId || 'none'}`);
    return false;
  } catch (error) {
    console.error('[whazing-agent-check] Error checking ticket:', error);
    return false; // On error, don't block the bot
  }
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

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${whazingToken}`,
    };

    const apiOficialUrl = getWhazingApiPlusUrl(whazingUrl);
    const safeBodyText = sanitizeOutgoingWhatsAppText(bodyText);
    const safeButtons = buttons.map((button) => ({
      ...button,
      title: sanitizeOutgoingWhatsAppText(button.title),
    }));
    console.log(`[whazing] Sending ${buttons.length}-button menu to ${cleanPhone} via API PLUS/native buttons`);

    let response = await fetch(apiOficialUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(buildWhazingButtonPayload(whazingUrl, cleanPhone, safeBodyText, safeButtons)),
    });

    let responseText = await response.text();
    if (!response.ok && isChatgooExternalUrl(whazingUrl)) {
      console.warn(`[whazing] API PLUS failed (${response.status}); retrying external endpoint as fallback`, responseText.substring(0, 300));
      response = await fetch(getWhazingSendUrl(whazingUrl), {
        method: 'POST',
        headers,
        body: JSON.stringify(buildWhazingExternalButtonPayload(cleanPhone, safeBodyText, safeButtons)),
      });
      responseText = await response.text();
    }

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

async function sendWhazingMenuButtons(config: EvolutionConfig, phone: string, explicitPhoneId?: string): Promise<boolean> {
  return sendWhatsAppButtons(config, phone, 
    "Olá! 👋 Bem-vindo(a) ao atendimento.",
    "Como podemos ajudá-lo(a) hoje?\n\nDigite o número da opção desejada:",
    [
      { id: "whazing_associado", text: "Sou Associado" },
      { id: "whazing_empresa", text: "Sou Empresa" },
      { id: "whazing_contabilidade", text: "Sou Contabilidade" },
    ],
    "",
    explicitPhoneId
  );
}

type WhazingCategory = 'associado' | 'empresa' | 'contabilidade';

async function sendWhazingSubMenu(config: EvolutionConfig, phone: string, category: WhazingCategory, explicitPhoneId?: string): Promise<boolean> {
  const subMenus: Record<WhazingCategory, { text: string; buttons: Array<{ id: string; title: string }> }> = {
    associado: {
      text: "Você selecionou *Sou Associado*.\n\nEscolha o que deseja (digite o número):",
      buttons: [
        { id: "whazing_sub_carteirinha", title: "Atualizar Carteirinha" },
        { id: "whazing_sub_convencoes", title: "Convenções Coletivas" },
        { id: "whazing_sub_outros", title: "Outros Assuntos" },
      ],
    },
    empresa: {
      text: "Você selecionou *Sou Empresa*.\n\nEscolha o que deseja (digite o número):",
      buttons: [
        { id: "whazing_sub_boleto", title: "2ª Via Boleto" },
        { id: "whazing_sub_convencoes", title: "Convenções Coletivas" },
        { id: "whazing_sub_outros", title: "Outros Assuntos" },
      ],
    },
    contabilidade: {
      text: "Você selecionou *Sou Contabilidade*.\n\nEscolha o que deseja (digite o número):",
      buttons: [
        { id: "whazing_sub_boleto", title: "2ª Via Boleto" },
        { id: "whazing_sub_convencoes", title: "Convenções Coletivas" },
        { id: "whazing_sub_outros", title: "Outros Assuntos" },
      ],
    },
  };

  const sub = subMenus[category];
  return sendWhatsAppButtons(config, phone, sub.text, "", sub.buttons.map(b => ({ id: b.id, text: b.title })), "", explicitPhoneId);
}

function parseWhazingCategory(messages: unknown): WhazingCategory | null {
  if (!messages || typeof messages !== 'object' || Array.isArray(messages)) return null;
  const category = (messages as Record<string, unknown>).whazing_category;
  return category === 'associado' || category === 'empresa' || category === 'contabilidade' ? category : null;
}

async function storeWhazingContext(
  supabase: any,
  clinicId: string,
  phone: string,
  category: WhazingCategory,
  lastMenuType: 'main' | 'sub' | 'followup' = 'main'
): Promise<void> {
  const { error } = await supabase.from('whatsapp_ai_conversations').insert({
    clinic_id: clinicId,
    phone,
    messages: { 
      whazing_category: category, 
      last_menu_type: lastMenuType,
      source: 'whazing_menu' 
    },
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });

  if (error) {
    console.log('[webhook] Could not store whazing context:', error.message);
  }
}

async function getWhazingContext(
  supabase: any,
  clinicId: string,
  phoneCandidates: string[],
  fallback: WhazingCategory = 'associado'
): Promise<{ category: WhazingCategory; lastMenuType: string | null }> {
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
    return { category: fallback, lastMenuType: null };
  }

  for (const row of data ?? []) {
    const parsed = parseWhazingCategory(row.messages);
    const lastMenuType = (row.messages as any)?.last_menu_type || null;
    if (parsed) return { category: parsed, lastMenuType };
  }

  return { category: fallback, lastMenuType: null };
}

function normalizeSupportText(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function getBrazilSupportContext(): {
  date: string;
  formatted: string;
  isBusinessDay: boolean;
  isBusinessHours: boolean;
} {
  const now = new Date();
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const time = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now);
  const dayName = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'long',
  }).format(now);
  const dayShort = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short',
  }).format(now);

  const dayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  const dayOfWeek = dayMap[dayShort] ?? 0;
  const isBusinessDay = dayOfWeek >= 1 && dayOfWeek <= 5;
  const [hours, minutes] = time.split(':').map(Number);
  const totalMinutes = (hours * 60) + minutes;
   // 09h às 12h (540-720) e 13h às 16h (780-960)
   const isBusinessHours = isBusinessDay && (
     (totalMinutes >= 540 && totalMinutes < 720) ||
     (totalMinutes >= 780 && totalMinutes < 960)
   );

  return {
    date,
    formatted: `${dayName}, ${date.split('-').reverse().join('/')} às ${time}`,
    isBusinessDay,
    isBusinessHours,
  };
}

async function getHumanSupportAvailability(
  supabase: any,
  clinicId: string,
): Promise<{ isHumanAvailable: boolean; reason: string; formatted: string }> {
  const brazilContext = getBrazilSupportContext();
  let isHoliday = false;

  try {
    const { data, error } = await supabase.rpc('is_holiday', {
      p_clinic_id: clinicId,
      p_date: brazilContext.date,
    });

    if (error) {
      console.error('[webhook] is_holiday RPC error during support handoff:', error);
    } else {
      const row = Array.isArray(data) ? data[0] : null;
      isHoliday = Boolean(row?.is_holiday);
    }
  } catch (error) {
    console.error('[webhook] Failed to check holiday during support handoff:', error);
  }

  const isHumanAvailable = brazilContext.isBusinessHours && !isHoliday;
  const reason = isHoliday
    ? 'feriado'
    : !brazilContext.isBusinessDay
      ? 'fim de semana'
      : !brazilContext.isBusinessHours
        ? 'fora do horário'
        : 'disponível';

  return {
    isHumanAvailable,
    reason,
    formatted: brazilContext.formatted,
  };
}

async function freezeBotForHumanHandoff(
  supabase: any,
  phone: string,
  contactName: string | null,
  lastMessage: string,
  options: { queueId?: string, messageId?: string, timestamp?: number } = {}
): Promise<void> {
  const now = new Date().toISOString();
  const timestamp = options.timestamp || Math.floor(Date.now() / 1000);
  const messageId = options.messageId || `handoff-${phone}-${Date.now()}`;

  const { error } = await supabase
    .from('whazing_tickets')
    .upsert({
      ticket_id: phone,
      contact_number: phone,
      ...(contactName ? { contact_name: contactName } : {}),
      last_message: lastMessage.slice(0, 500),
      status: 'open',
      opened_at: now,
      updated_at: now,
      closed_at: null,
      bot_active: false,
      ...(options.queueId ? { assigned_queue_id: options.queueId } : {}),
    }, { onConflict: 'ticket_id' });

  if (error) {
    console.error('[webhook] Failed to freeze bot for human handoff:', error);
    return;
  }

  // Also insert the message into whazing_messages so it appears in the dashboard
  const { error: msgError } = await supabase.from('whazing_messages').upsert({
    ticket_id: phone,
    message_id: messageId,
    body: lastMessage.slice(0, 2000),
    from_me: false,
    sender_name: contactName || 'Contato',
    sender_phone: phone,
    timestamp: timestamp,
  }, { onConflict: 'message_id' });

  if (msgError) {
    console.error('[webhook] Failed to mirror handoff message to whazing_messages:', msgError);
  }
}

function buildDirectHumanHandoffMessage(isHumanAvailable: boolean): string {
  if (isHumanAvailable) {
    return `Entendi! Vou encaminhar você para um atendente humano. 🙏

Nosso atendimento funciona de segunda a sexta, das 09h às 12h e das 13h às 16h (exceto feriados).

Por favor, aguarde um momento por aqui.`;
  }

    return `Fora do horário de atendimento, mas recebemos seu contato e em breve retornaremos.`;
}

function buildAskSubjectMessage(): string {
  return `Claro! Para que eu possa te encaminhar para a equipe certa, *qual é o assunto* que você gostaria de tratar com nosso atendimento? 📝

Pode descrever em poucas palavras (ex: dúvida sobre boleto, questão jurídica, contribuição da empresa, etc.).`;
}

/**
 * Uses Lovable AI Gateway to classify a free-text subject into one of the
 * available Whazing queues. Returns the chosen queue (id + name) or null
 * if classification fails.
 */
async function classifySubjectToQueue(
  supabase: any,
  subjectText: string,
): Promise<{ id: string; name: string } | null> {
  try {
    const { data: queues, error: qErr } = await supabase
      .from('whazing_queues')
      .select('id, name, description')
      .order('name');

    if (qErr || !queues || queues.length === 0) {
      console.error('[webhook] classifySubjectToQueue: failed to load queues', qErr);
      return null;
    }

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      console.warn('[webhook] classifySubjectToQueue: LOVABLE_API_KEY missing, falling back to default queue');
      const fallback = queues.find((q: any) => /suporte|administr/i.test(q.name)) || queues[0];
      return { id: fallback.id, name: fallback.name };
    }

    const queueList = queues
      .map((q: any, i: number) => `${i + 1}. ${q.name}${q.description ? ` — ${q.description}` : ''}`)
      .join('\n');

    const systemPrompt = `Você é um classificador de mensagens de WhatsApp para uma central de atendimento de um sindicato/clínica. Sua tarefa é escolher a fila MAIS adequada para encaminhar o atendimento humano, com base no assunto descrito pelo usuário.

Filas disponíveis:
${queueList}

Responda APENAS com um JSON no formato {"queue_name":"<nome exato da fila>"} sem explicações.`;

    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Assunto: ${subjectText}` },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!resp.ok) {
      console.error('[webhook] classifySubjectToQueue: AI gateway error', resp.status, await resp.text());
      return { id: queues[0].id, name: queues[0].name };
    }

    const json = await resp.json();
    const raw = json?.choices?.[0]?.message?.content || '{}';
    let parsed: any = {};
    try { parsed = JSON.parse(raw); } catch { /* ignore */ }
    const chosenName = String(parsed?.queue_name || '').trim().toLowerCase();
    const match = queues.find((q: any) => q.name.toLowerCase() === chosenName)
      || queues.find((q: any) => chosenName.includes(q.name.toLowerCase()) || q.name.toLowerCase().includes(chosenName));

    if (match) return { id: match.id, name: match.name };
    console.warn('[webhook] classifySubjectToQueue: no match for', chosenName, '→ using first queue');
    return { id: queues[0].id, name: queues[0].name };
  } catch (err) {
    console.error('[webhook] classifySubjectToQueue: exception', err);
    return null;
  }
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
  if (messageData?.buttonsResponseMessage?.selectedButtonId) {
    return messageData.buttonsResponseMessage.selectedButtonId;
  }
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
      return params.id || params.button_id || params.buttonId || params.selectedButtonId || params.selectedId || params.payload || null;
    } catch { /* ignore */ }
  }
  return messageData?.buttonReplyMessage?.id ||
    messageData?.buttonReplyMessage?.selectedId ||
    messageData?.buttonReplyMessage?.selectedButtonId ||
    messageData?.interactiveResponseMessage?.id ||
    messageData?.interactiveResponseMessage?.button_id ||
    messageData?.templateButtonReplyMessage?.selectedId ||
    messageData?.reactionMessage?.text ||
    null;
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
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      console.log('[ai] OPENAI_API_KEY not configured, falling back to regex');
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

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
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
    // Verificar se precisa incluir local específico (Rodoviários)
    const lowerName = data.professionalName.toLowerCase();
    const isRodoviariosProfessional = lowerName.includes('marcelo aguiar') || lowerName.includes('jorge avelar') || lowerName.includes('pedro roberto');
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
   messageText: string,
   explicitPhoneId?: string | null
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
           await sendWhatsAppMessage(config, phone, 'Desculpe, ocorreu um erro ao iniciar o fluxo de boletos. Por favor, tente novamente.', explicitPhoneId);
        }
      } catch (boletoError) {
        console.error('[ai-booking] Exception calling boleto flow:', boletoError);
         await sendWhatsAppMessage(config, phone, 'Desculpe, ocorreu um erro ao iniciar o fluxo de boletos.', explicitPhoneId);
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

     await sendWhatsAppMessage(config, phone, appBlockMsg, explicitPhoneId);
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
         false,
         explicitPhoneId
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
         await handleBookingFlow(supabase, config, phone, messageText, newSession, false, explicitPhoneId);
        return;
      } else {
        // CPF has 11 digits but failed validation - send clear error message
        console.log(`[ai-booking] CPF has 11 digits but failed checksum validation`);
         await sendWhatsAppMessage(config, phone, 
           `❌ *CPF inválido*\n\nO CPF informado não passou na validação. Por favor, verifique se digitou corretamente.\n\n💡 Digite apenas os 11 números do seu CPF.`,
           explicitPhoneId
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

    // Detect if we are in a synchronous call to collect responses
    const collector = syncReplyStore.getStore();
    const isSync = !!collector;

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
         conversation_history: conversationHistory,
         deliver_response_via_caller: isSync,
         explicit_phone_id: explicitPhoneId || null
       }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('[ai-booking] AI assistant error:', aiResponse.status, errorText);
       await sendWhatsAppMessage(config, phone, 'Desculpe, ocorreu um erro. Por favor, tente novamente em instantes.', explicitPhoneId);
      return;
    }

    const aiData = await aiResponse.json();
    
    // CHECK FOR BOOKING HANDOFF
    if (aiData.handoff_to_booking === true) {
      // SAFETY CHECK: Never proceed with booking handoff if booking is disabled
      if (config.booking_enabled !== true) {
        console.log('[ai-booking] handoff_to_booking=true but booking_enabled=false - blocking handoff');
         await sendWhatsAppMessage(config, phone, MESSAGES.bookingMaintenance, explicitPhoneId);
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
      
       await sendWhatsAppMessage(config, phone, bookingWelcome, explicitPhoneId);
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
  const trimmedText = messageText.trim();

  // Determine action and extract appointment ID from button if available
  let action: 'confirmed' | 'cancelled' | 'ignored' = 'ignored';
  let buttonAppointmentId: string | null = null;

  if (trimmedText.startsWith('confirm_apt_')) {
    action = 'confirmed';
    buttonAppointmentId = trimmedText.replace('confirm_apt_', '');
  } else if (trimmedText.startsWith('cancel_apt_')) {
    action = 'cancelled';
    buttonAppointmentId = trimmedText.replace('cancel_apt_', '');
  } else if (POSITIVE_REGEX.test(trimmedText)) {
    action = 'confirmed';
  } else if (NEGATIVE_REGEX.test(trimmedText)) {
    action = 'cancelled';
  }

  // If we can't determine any action, bail early
  if (action === 'ignored') {
    return { handled: false };
  }

  // Try to find pending confirmation by phone
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
  }

  const pendingData = pendingConfirmations as Array<{
    id: string;
    appointment_id: string;
    clinic_id: string;
    expires_at: string;
  }> | null;

  let appointmentId: string | null = null;
  let pendingId: string | null = null;
  let clinicId: string | null = null;

  if (pendingData && pendingData.length > 0) {
    // Use pending confirmation record
    appointmentId = pendingData[0].appointment_id;
    pendingId = pendingData[0].id;
    clinicId = pendingData[0].clinic_id;
    console.log(`[webhook] Found pending confirmation for appointment ${appointmentId}`);
  } else if (buttonAppointmentId) {
    // FALLBACK: No pending_confirmation found, but we have the appointment ID from the button
    console.log(`[webhook] No pending_confirmation found, using button appointment ID: ${buttonAppointmentId}`);
    appointmentId = buttonAppointmentId;
  } else {
    // Text-based confirm/cancel but no pending confirmation -> can't process
    console.log('[webhook] Action detected but no pending confirmation and no button appointment ID');
    return { handled: false };
  }

  const { data: appointment, error: appointmentError } = await supabase
    .from('appointments')
    .select(`id, appointment_date, start_time, status, clinic_id, patient:patients (name), professional:professionals (name)`)
    .eq('id', appointmentId)
    .single();

  if (appointmentError || !appointment) {
    console.error('[webhook] Error fetching appointment:', appointmentError);
    return { handled: false, clinicId: clinicId || undefined };
  }

  const appointmentData = appointment as AppointmentRecord & { clinic_id?: string };

  // Resolve clinic_id from pending or from appointment itself
  if (!clinicId && appointmentData.clinic_id) {
    clinicId = appointmentData.clinic_id;
  }

  // Don't re-process already confirmed/cancelled appointments
  if (appointmentData.status === 'confirmed' && action === 'confirmed') {
    console.log(`[webhook] Appointment ${appointmentId} already confirmed, sending acknowledgment`);
    // Still send a response so user knows it worked
    const { data: evolutionConfig } = await supabase
      .from('evolution_configs')
      .select('api_url, api_key, instance_name, direct_reply_enabled, clinic_id')
      .eq('clinic_id', clinicId)
      .maybeSingle();
    const evoConfig = evolutionConfig as EvolutionConfig | null;
    if (evoConfig?.api_url && evoConfig?.api_key) {
      const dateFormatted = formatDate(appointmentData.appointment_date);
      const time = appointmentData.start_time?.substring(0, 5) || '';
      await sendWhatsAppMessage(
        { ...evoConfig, clinic_id: clinicId! },
        phone,
        `✅ Sua consulta de ${dateFormatted} às ${time} já está confirmada. Aguardamos você!`
      );
    }
    return { handled: true, clinicId: clinicId || undefined };
  }

  if (appointmentData.status === 'cancelled' && action === 'cancelled') {
    console.log(`[webhook] Appointment ${appointmentId} already cancelled`);
    return { handled: true, clinicId: clinicId || undefined };
  }

  const newStatus = action === 'confirmed' ? 'confirmed' : 'cancelled';
  const updateFields: Record<string, unknown> = { status: newStatus };

  if (action === 'confirmed') {
    updateFields.confirmed_at = new Date().toISOString();
  } else {
    updateFields.cancelled_at = new Date().toISOString();
    updateFields.cancellation_reason = 'Cancelado pelo paciente via WhatsApp';
  }

  await supabase.from('appointments').update(updateFields).eq('id', appointmentData.id);

  // Update pending_confirmation if we found one
  if (pendingId) {
    await supabase.from('pending_confirmations').update({ status: action }).eq('id', pendingId);
  }

  const { data: evolutionConfig } = await supabase
    .from('evolution_configs')
    .select('api_url, api_key, instance_name, direct_reply_enabled')
    .eq('clinic_id', clinicId)
    .maybeSingle();

  const { data: clinic } = await supabase
    .from('clinics')
    .select('name')
    .eq('id', clinicId)
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
      { ...evolutionConfigData, clinic_id: clinicId! },
      phone,
      responseMessage
    );

    const monthYear = new Date().toISOString().slice(0, 7);
    await supabase.from('message_logs').insert({
      clinic_id: clinicId,
      message_type: action === 'confirmed' ? 'confirmation_response' : 'cancellation_response',
      phone,
      month_year: monthYear,
    });
  }

  console.log(`[webhook] Processed ${action} for appointment ${appointmentData.id}`);
  return { handled: true, clinicId: clinicId || undefined };
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

async function handleWebhook(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    console.log(`[webhook] Incoming request: ${req.method} ${new URL(req.url).pathname}`);

    // Log raw body for debugging
    const rawBody = await req.text();
    console.log('[webhook] Raw body received:', rawBody);
    
    // Parse the body
    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch (parseError) {
      console.error('[webhook] JSON parse error:', parseError);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid JSON' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

     // Helper for sync responses
     const createSuccessResponse = (extraData: any = {}) => {
       const collector = syncReplyStore.getStore();
       const responseData: any = { success: true, ...extraData };
       if (collector && collector.length > 0) {
         responseData.reply = collector.join('\n\n');
       }
       return new Response(
         JSON.stringify(responseData),
         { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     };
 
    // Support for simple payload format (e.g. from Zap Responder)
    // If it's the internal test ("phone": "0") or a real message without 'event'
    // Support for Z-API or simple payload format (e.g. from Zap Responder)
    const isZApi = payload.instanceId && payload.phone && (payload.type === 'ReceivedCallback' || payload.text);
    const isSimple = !payload.event && payload.phone !== undefined && payload.message !== undefined;

    if (isZApi || isSimple) {
      console.log(`[webhook] ${isZApi ? 'Z-API' : 'Simple'} payload detected, mapping to Evolution format`);

      let mappedPhone = payload.phone;
      let mappedMessage = payload.message || payload.text?.message;
      let mappedInstance = payload.instanceId || payload.instance || payload.instanceName;

      // Zap Responder test mapping
      if (String(mappedPhone) === '0' || String(mappedPhone).startsWith('0@')) {
        mappedPhone = '5573999999999';
        mappedMessage = 'oi';
      }

      // Z-API mapping
      if (isZApi) {
        mappedPhone = String(mappedPhone).replace(/\D/g, '');
        console.log(`[webhook] Z-API payload from ${mappedPhone} (${payload.type})`);
        
        const mappedData: any = {
          key: {
            remoteJid: `${mappedPhone}@s.whatsapp.net`,
            fromMe: payload.fromMe || false,
            id: payload.messageId || `zapi_${Date.now()}`
          },
          pushName: payload.senderName || payload.chatName || 'Contato',
          messageTimestamp: Math.floor((payload.momment || Date.now()) / 1000)
        };

        // Handle different Z-API message types
        if (payload.text?.message) {
          mappedData.message = { conversation: String(payload.text.message) };
        } else if (payload.buttonsResponseMessage) {
          mappedData.message = {
            buttonsResponseMessage: {
              selectedButtonId: payload.buttonsResponseMessage.buttonId,
              selectedDisplayText: payload.buttonsResponseMessage.message
            }
          };
        } else if (payload.listResponseMessage) {
          mappedData.message = {
            listResponseMessage: {
              singleSelectReply: {
                selectedRowId: payload.listResponseMessage.selectedRowId
              },
              title: payload.listResponseMessage.title,
              description: payload.listResponseMessage.message
            }
          };
        } else if (payload.image) {
          mappedData.message = {
            imageMessage: {
              caption: payload.image.caption,
              mimetype: payload.image.mimeType,
              url: payload.image.imageUrl
            }
          };
        } else if (payload.audio) {
          mappedData.message = {
            audioMessage: {
              mimetype: payload.audio.mimeType,
              url: payload.audio.audioUrl
            }
          };
        } else {
          // Default fallback
          mappedData.message = { conversation: String(mappedMessage || '') };
        }

        payload = {
          event: 'messages.upsert',
          instance: mappedInstance,
          data: mappedData
        };
      } else {
        // Simple/Zap Responder mapping
        payload = {
          event: 'messages.upsert',
          instance: mappedInstance,
          data: {
            key: {
              remoteJid: String(mappedPhone).includes('@') ? String(mappedPhone) : `${mappedPhone}@s.whatsapp.net`,
              fromMe: payload.fromMe || false,
              id: payload.messageId || `mapped_${Date.now()}`
            },
            message: {
              conversation: String(mappedMessage || '')
            },
            pushName: payload.senderName || payload.pushName || payload.name || 'Contato',
            messageTimestamp: Math.floor(Date.now() / 1000)
          }
        };
      }
    }

    console.log('[webhook] Received event:', payload.event);
    console.log('[webhook] Instance:', payload.instance);

    // Keep Evolution connection status in sync even when the admin panel is not open.
    // Without this, the webhook ignores inbound messages because evolution_configs.is_connected
    // can remain false after reconnecting/scanning a new WhatsApp number.
    const connectionUpdateEvents = ['CONNECTION_UPDATE', 'connection.update'];
    if (payload.event && connectionUpdateEvents.includes(payload.event)) {
      const connectionData = (payload.data ?? {}) as Record<string, any>;
      const instanceName = payload.instance || connectionData.instance;
      const state = String(connectionData.state || connectionData.status || '').toLowerCase();
      const rawWuid = String(connectionData.wuid || connectionData.ownerJid || (payload as any).sender || '');
      const phoneNumber = rawWuid.replace(/@.*$/, '').replace(/\D/g, '') || null;
      const isConnected = state === 'open' || state === 'connected';
      const isDisconnected = ['close', 'closed', 'disconnected', 'logout', 'logged_out'].includes(state);

      if (instanceName && (isConnected || isDisconnected)) {
        const { error: connectionSyncError } = await supabase
          .from('evolution_configs')
          .update({
            is_connected: isConnected,
            connected_at: isConnected ? new Date().toISOString() : null,
            phone_number: isConnected ? phoneNumber : null,
          })
          .eq('instance_name', instanceName);

        if (connectionSyncError) {
          console.error('[webhook] Error syncing connection status:', connectionSyncError);
        } else {
          console.log(`[webhook] Synced connection status for ${instanceName}: ${state}${phoneNumber ? ` (${phoneNumber})` : ''}`);
        }
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Connection update processed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle chat close/archive/delete events from Whazing/Evolution
    const chatCloseEvents = ['CHATS_UPDATE', 'chats.update', 'CHATS_DELETE', 'chats.delete'];
    if (payload.event && chatCloseEvents.includes(payload.event)) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);
        const now = new Date().toISOString();

        // CHATS_UPDATE may contain array or single chat data
        const chats = Array.isArray(payload.data) ? payload.data : [payload.data];

        for (const chat of chats) {
          // Extract phone from remoteJid or id
          const jid = chat?.id || chat?.remoteJid || chat?.chatId || '';
          const phone = jid.replace(/@.*$/, '').replace(/\D/g, '');

          if (!phone) continue;

          // Detect archive or delete → close ticket
          const isArchived = chat?.archive === true || chat?.archived === true;
          const isUnarchived = chat?.archive === false || chat?.archived === false;
          const isDelete = payload.event === 'CHATS_DELETE' || payload.event === 'chats.delete';

          if (isArchived || isDelete) {
            const { error } = await supabase
              .from('whazing_tickets')
              .update({ status: 'closed', closed_at: now, updated_at: now })
              .eq('ticket_id', phone)
              .neq('status', 'closed');

            if (error) {
              console.error(`[webhook] Error closing ticket for ${phone}:`, error);
            } else {
              console.log(`[webhook] Ticket closed for ${phone} (event: ${payload.event})`);
            }
          } else if (isUnarchived) {
            // Unarchive → reopen ticket
            const { error } = await supabase
              .from('whazing_tickets')
              .update({ status: 'open', closed_at: null, updated_at: now })
              .eq('ticket_id', phone)
              .eq('status', 'closed');

            if (error) {
              console.error(`[webhook] Error reopening ticket for ${phone}:`, error);
            } else {
              console.log(`[webhook] Ticket reopened for ${phone} (event: ${payload.event}, unarchived)`);
            }
          }
        }

        return new Response(
          JSON.stringify({ success: true, message: 'Chat event processed' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (chatErr) {
        console.error('[webhook] Error processing chat event:', chatErr);
        return new Response(
          JSON.stringify({ success: true, message: 'Chat event error logged' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ---- Mirror outgoing / non-upsert messages to whazing dashboard ----
    const isSendMessage = payload.event === 'send.message' || payload.event === 'SEND_MESSAGE';
    const isMessagesUpsert = payload.event === 'MESSAGES_UPSERT' || payload.event === 'messages.upsert';
    const isMessagesUpdate = payload.event === 'MESSAGES_UPDATE' || payload.event === 'messages.update';
    const isFromMe = payload.data?.key?.fromMe === true || (payload.data as any)?.fromMe === true;

    if (isMessagesUpdate && isFromMe) {
      try {
        const statusData = payload.data as any;
        const statusMessageId = statusData?.keyId || statusData?.key?.id || '';
        const statusRemoteJid = statusData?.remoteJid || statusData?.key?.remoteJid || '';
        const statusPhone = normalizePhone(String(statusRemoteJid).replace('@s.whatsapp.net', ''));
        const deliveryStatus = String(statusData?.status || '').toUpperCase();

        if (statusMessageId && deliveryStatus) {
          const updatePayload: Record<string, unknown> = {
            status: deliveryStatus,
          };

          if (statusPhone) {
            updatePayload.ticket_id = statusPhone;
          }

          const { error: statusUpdateError } = await supabase
            .from('whazing_messages')
            .upsert({
              message_id: statusMessageId,
              ...updatePayload,
            }, { onConflict: 'message_id' });

          if (statusUpdateError) {
            console.error('[webhook] Error updating outgoing message status:', statusUpdateError);
          } else {
            console.log(`[webhook] Updated outgoing message ${statusMessageId} to status ${deliveryStatus}`);
          }
        }
      } catch (statusErr) {
        console.error('[webhook] Error processing messages.update status:', statusErr);
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Outgoing message status updated' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (isSendMessage || (isMessagesUpsert && isFromMe)) {
      // Mirror outgoing messages so the dashboard shows the full conversation
      try {
        const outRemoteJid = payload.data?.key?.remoteJid || '';
        if (!outRemoteJid.endsWith('@g.us')) {
          const outPhone = normalizePhone(outRemoteJid.replace('@s.whatsapp.net', ''));
          const outMsgId = payload.data?.key?.id || '';
          const outPushName = payload.data?.pushName || '';
          const outNow = new Date().toISOString();

          // Extract text from various message formats (outgoing can be conversation, interactive, etc.)
          let outText: string | null = null;
          const outMsg = payload.data?.message;
          if (outMsg?.conversation) {
            outText = outMsg.conversation;
          } else if (outMsg?.extendedTextMessage?.text) {
            outText = outMsg.extendedTextMessage.text;
          } else if (outMsg?.interactiveMessage) {
            // Bot menus sent via Whazing apioficial
            const im = outMsg.interactiveMessage as Record<string, any>;
            const headerTitle = im?.header?.title || '';
            const bodyText = im?.body?.text || '';
            outText = [headerTitle, bodyText].filter(Boolean).join('\n').trim() || null;
          } else if (outMsg?.buttonsMessage) {
            const bm = outMsg.buttonsMessage as Record<string, any>;
            outText = bm?.contentText || bm?.text || null;
          } else if (outMsg?.templateMessage) {
            const tm = outMsg.templateMessage as Record<string, any>;
            outText = tm?.hydratedTemplate?.hydratedContentText || tm?.hydratedFourRowTemplate?.hydratedContentText || null;
          }

          // Also extract from templateButtonReplyMessage (user selecting a button echoed as fromMe)
          if (!outText) {
            outText = extractMessageText(payload.data);
          }

          // Determine media type for outgoing
          let outMediaType: string | null = null;
          if (outMsg?.imageMessage) outMediaType = 'image';
          else if (outMsg?.videoMessage) outMediaType = 'video';
          else if (outMsg?.audioMessage) outMediaType = 'audio';
          else if (outMsg?.documentMessage) outMediaType = 'document';
          else if (outMsg?.stickerMessage) outMediaType = 'sticker';

          if (outPhone && (outText || outMediaType)) {
            // Upsert ticket (update last_message, reopen if closed)
            const { data: existingOutTkt } = await supabase
              .from('whazing_tickets')
              .select('id, status')
              .eq('ticket_id', outPhone)
              .maybeSingle();

            const outTktData: Record<string, unknown> = {
              ticket_id: outPhone,
              contact_number: outPhone,
              last_message: outText ? outText.slice(0, 500) : '[mídia]',
              updated_at: outNow,
            };
            if (!existingOutTkt) {
              outTktData.status = 'open';
              outTktData.opened_at = outNow;
              if (outPushName) outTktData.contact_name = outPushName;
            } else if (existingOutTkt.status === 'closed') {
              outTktData.status = 'open';
              outTktData.opened_at = outNow;
              outTktData.closed_at = null;
            }

            await supabase.from('whazing_tickets').upsert(outTktData, { onConflict: 'ticket_id' });

            // Save outgoing message
            if (outMsgId) {
              const outTs = (payload.data as any)?.messageTimestamp
                ? Number((payload.data as any).messageTimestamp)
                : Math.floor(Date.now() / 1000);
              await supabase.from('whazing_messages').upsert({
                ticket_id: outPhone,
                message_id: outMsgId,
                body: (outText || '[mídia]').slice(0, 2000),
                from_me: true,
                media_type: outMediaType,
                sender_name: outPushName || 'Bot',
                sender_phone: null,
                timestamp: outTs,
              }, { onConflict: 'message_id' });
            }

            console.log(`[webhook] Mirrored outgoing message for ${outPhone}: "${(outText || '[mídia]').slice(0, 80)}"`);
          }
        }
      } catch (mirrorOutErr) {
        console.error('[webhook] Error mirroring outgoing message:', mirrorOutErr);
      }

      // For send.message events, stop here (no further processing needed)
      if (isSendMessage) {
        return new Response(
          JSON.stringify({ success: true, message: 'Outgoing message mirrored' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // For fromMe messages.upsert, also stop (don't process as incoming)
      if (isFromMe) {
        return new Response(
          JSON.stringify({ success: true, message: 'Self message mirrored' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (!isMessagesUpsert) {
      return new Response(
        JSON.stringify({ success: true, message: 'Event ignored' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const primaryRemoteJid = payload.data?.key?.remoteJid || '';
    const alternateRemoteJid = (payload.data?.key as any)?.remoteJidAlt || '';
    const remoteJid = primaryRemoteJid.includes('@lid') && alternateRemoteJid
      ? alternateRemoteJid
      : primaryRemoteJid;

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

    // ===== HOMOLOGAÇÃO: resposta de botão de lembrete (Confirmar/Cancelar) =====
    // Intercepta ANTES de qualquer outro fluxo. Se o telefone tem agendamento
    // de homologação ativo nas próximas 48h e a resposta é exatamente
    // "Confirmar" ou "Cancelar", trata aqui e encerra. O botão "Reagendar" é
    // do tipo URL e não chega como mensagem ao webhook.
    if (phone && messageText) {
      const trimmed = messageText.trim().toLowerCase();
      const isConfirmReply = trimmed === 'confirmar' || trimmed === '✅ confirmar';
      const isCancelReply = trimmed === 'cancelar' || trimmed === '❌ cancelar';

      if (isConfirmReply || isCancelReply) {
        try {
          const phoneVariants = getBrazilPhoneVariants(phone);
          const todayIso = new Date().toISOString().slice(0, 10);
          const in48h = new Date(Date.now() + 48 * 3600 * 1000).toISOString().slice(0, 10);

          // Busca por telefone da empresa OU do funcionário, agendamento futuro ativo
          const { data: homAppts } = await supabase
            .from('homologacao_appointments')
            .select('id, clinic_id, employee_name, company_name, appointment_date, start_time, status, professional_id')
            .or(
              phoneVariants.map((p) => `company_phone.eq.${p},employee_phone.eq.${p}`).join(',')
            )
            .gte('appointment_date', todayIso)
            .lte('appointment_date', in48h)
            .in('status', ['scheduled', 'confirmed'])
            .order('appointment_date', { ascending: true })
            .order('start_time', { ascending: true })
            .limit(1);

          const appt = homAppts?.[0];

          if (appt) {
            console.log(`[webhook][homologacao] ${isConfirmReply ? 'Confirmar' : 'Cancelar'} para appt ${appt.id} (${phone})`);
            const dateFmt = `${appt.appointment_date.split('-').reverse().join('/')}`;
            const timeFmt = String(appt.start_time).slice(0, 5);

            if (isConfirmReply) {
              await supabase
                .from('homologacao_appointments')
                .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
                .eq('id', appt.id);

              await sendMetaText(
                phone,
                `✅ *Agendamento confirmado!*\n\n` +
                  `Funcionário: ${appt.employee_name}\n` +
                  `Empresa: ${appt.company_name}\n` +
                  `Data: ${dateFmt} às ${timeFmt}\n\n` +
                  `📍 Rua Coronel Paiva, 99 - Centro - Ilhéus/BA\n` +
                  `Aguardamos no horário agendado com toda a documentação necessária.`
              );
            } else {
              await supabase
                .from('homologacao_appointments')
                .update({
                  status: 'cancelled',
                  cancelled_at: new Date().toISOString(),
                  cancellation_reason: 'Cancelado pela empresa via WhatsApp (lembrete)',
                })
                .eq('id', appt.id);

              await sendMetaText(
                phone,
                `❌ *Agendamento cancelado.*\n\n` +
                  `O agendamento de ${appt.employee_name} (${appt.company_name}) em ${dateFmt} às ${timeFmt} foi cancelado conforme solicitado.\n\n` +
                  `Para reagendar, acesse: https://prosindweb.com.br/agendamento/profissional/ione-atos-1`
              );
            }

            return new Response(
              JSON.stringify({ success: true, message: `Homologacao ${isConfirmReply ? 'confirmed' : 'cancelled'}` }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        } catch (err) {
          console.error('[webhook][homologacao] Error handling reminder reply:', err);
        }
      }
    }
    // ===== /HOMOLOGAÇÃO =====

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
     // EXCEPTION: Allow the test number 550000000000
     const MIN_PHONE_LENGTH = 12;
     if (phone && phone.length < MIN_PHONE_LENGTH && !phone.startsWith("550000")) {
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
      // If we have a phone but no message text, it might be an unhandled media type or a new Evolution format.
      // Log more detail to help debug if the flow "stops" for a user.
      if (phone) {
        console.warn(`[webhook] No messageText extracted for phone ${phone}. Payload snippet:`, 
          JSON.stringify(payload).slice(0, 1000)
        );
      } else {
        console.warn('[webhook] No phone or messageText extracted');
      }

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

      // Check if clinic_id was explicitly provided (e.g. from zapster-webhook or meta routing)
      let explicitClinicId = (payload as any).clinic_id;
      
      // Special routing for Meta Official (Sindicato)
      if (!explicitClinicId && (payload.instance === 'meta' || payload.instance === 'meta_official')) {
        explicitClinicId = "89e7585e-7bce-4e58-91fa-c37080d1170d";
        console.log(`[webhook] Mapping Meta instance to Sindicato clinic: ${explicitClinicId}. Incoming PhoneID: ${payload.metadata?.phone_number_id}`);
      }

      // Correção de ID de telefone global para o Sindicato (seja via instance ou explicitClinicId)
      if (explicitClinicId === "89e7585e-7bce-4e58-91fa-c37080d1170d") {
        const incomingId = payload.metadata?.phone_number_id;
        if (incomingId === "937233212814035" || incomingId === "1522701919380063" || !incomingId) {
          console.log(`[webhook] Forçando Phone ID correto para Sindicato (${incomingId || 'vazio'} -> 1110151302179856)`);
          if (!payload.metadata) payload.metadata = {};
          payload.metadata.phone_number_id = "1110151302179856";
        }
      }

      const explicitPhoneId = payload.metadata?.phone_number_id || null;

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

       // Fallback: Find config by instance name or instance id (for Z-API)
       if (!configData) {
         const { data: configByInstance, error: configError } = await supabase
           .from('evolution_configs')
           .select('clinic_id, api_url, api_key, instance_name, direct_reply_enabled, booking_enabled, instance_id, zapi_token')
           .or(`instance_name.eq."${payload.instance}",instance_id.eq."${payload.instance}"`)
           .eq('is_connected', true);

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

        configData = configByInstance && configByInstance.length > 0 ? (configByInstance[0] as any) : null;
        if (configData) {
           // Map internal fields to EvolutionConfig interface if necessary
           configData = {
             clinic_id: configData.clinic_id,
             api_url: configData.api_url,
             api_key: configData.api_key,
             instance_name: configData.instance_name,
             direct_reply_enabled: configData.direct_reply_enabled,
             booking_enabled: configData.booking_enabled,
           } as EvolutionConfig;
        }
        console.log(`[webhook] Instance "${payload.instance}" -> clinic: ${configData?.clinic_id ?? 'not found'}`);
      }
      
      // PRE-EMPTIVE ROUTING FOR SINDICATO (META)
      const isSindicatoClinic = explicitClinicId === "89e7585e-7bce-4e58-91fa-c37080d1170d";
      const isMetaInstance = payload.instance === 'meta' || payload.instance === 'meta_official';
      
      if (isSindicatoClinic || isMetaInstance) {
        console.log(`[webhook] Sindicato/Meta request detected. Forcing Meta configuration.`);
        configData = {
          clinic_id: "89e7585e-7bce-4e58-91fa-c37080d1170d",
          instance_name: 'meta_official',
          api_url: 'meta',
          api_key: 'meta',
          booking_enabled: true,
          direct_reply_enabled: true
        } as EvolutionConfig;
      }

      // Standard routing if not already handled by Sindicato force
      if (!configData) {
        // Final fallback: Check zapster_configs
        if (payload.instance || explicitClinicId) {
          const query = supabase.from('zapster_configs').select('clinic_id, instance_id').eq('is_active', true);
          if (explicitClinicId) query.eq('clinic_id', explicitClinicId);
          else query.eq('instance_id', payload.instance);

          const { data: zapsterConfigs } = await query.limit(1);
          const zapsterCfg = zapsterConfigs && zapsterConfigs.length > 0 ? zapsterConfigs[0] : null;

          if (zapsterCfg) {
            console.log(`[webhook] Found Zapster config for clinic ${zapsterCfg.clinic_id}`);
            configData = {
              clinic_id: zapsterCfg.clinic_id,
              instance_name: zapsterCfg.instance_id,
              api_url: 'zapster',
              api_key: 'zapster',
              booking_enabled: true,
              direct_reply_enabled: true
            } as EvolutionConfig;
          }
        }
      }
       if (configData) {
         clinicId = configData.clinic_id;
         console.log(`[webhook] Processing for clinic ${clinicId}`);
 
        const messageTextTrim = messageText?.trim();

        // If the user has already been transferred to a human attendant, keep the
        // bot silent until the user explicitly requests MENU/reiniciar.
        let botSkipped = false;
        if (messageTextTrim && !/^(0|menu|reiniciar)$/i.test(messageTextTrim)) {
          const { data: pausedTicket } = await supabase
            .from('whazing_tickets')
            .select('bot_active, status')
            .eq('ticket_id', phone)
            .maybeSingle();

          if (pausedTicket?.bot_active === false && pausedTicket?.status === 'open') {
            console.log(`[webhook] Bot paused for human handoff on ${phone}; message mirrored only.`);
            const nowIso = new Date().toISOString();
            await supabase.from('whazing_tickets').upsert({
              ticket_id: phone,
              contact_number: phone,
              ...(payload.data?.pushName ? { contact_name: payload.data.pushName } : {}),
              last_message: messageTextTrim.slice(0, 500),
              status: 'open',
              updated_at: nowIso,
              closed_at: null,
              bot_active: false,
            }, { onConflict: 'ticket_id' });
            await supabase.from('whazing_messages').upsert({
              ticket_id: phone,
              message_id: payload.data?.key?.id || `handoff-in-${Date.now()}`,
              body: messageTextTrim.slice(0, 2000),
              from_me: false,
              sender_name: payload.data?.pushName || 'Contato',
              sender_phone: phone,
              timestamp: payload.data?.messageTimestamp ? Number(payload.data.messageTimestamp) : Math.floor(Date.now() / 1000),
            }, { onConflict: 'message_id' });
            botSkipped = true;
            return createSuccessResponse({ message: 'Human handoff active; bot paused' });
          }
        }

        if (!botSkipped) {
        // ===== WHAZING / META BUTTON RESPONSE HANDLER =====
        // Force main menu on test command "0" or reset keywords
        if (messageTextTrim === '0' || messageTextTrim?.toLowerCase() === 'reiniciar' || messageTextTrim?.toLowerCase() === 'menu') {
          await supabase
            .from('whazing_tickets')
            .update({ bot_active: true, updated_at: new Date().toISOString() })
            .eq('ticket_id', phone);
          await supabase
            .from('whatsapp_ai_conversations')
            .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
            .eq('clinic_id', clinicId)
            .in('phone', phoneCandidates)
            .contains('messages', { source: 'whazing_menu' });
          await sendWhazingMenuButtons(configData, phone, explicitPhoneId);
          return createSuccessResponse({ message: 'Main menu triggered' });
        }
        
        // ===== WHAZING / META CONTEXT RETRIEVAL =====
        const { category: storedCategory, lastMenuType } = await getWhazingContext(supabase, clinicId, phoneCandidates, null as any);
        
        // Level IDs for mapping
        const whazingLevel1Ids = ['whazing_associado', 'whazing_empresa', 'whazing_contabilidade', 'Sou Associado', 'Sou Empresa', 'Sou Contabilidade'];
        const whazingLevel2Ids = ['whazing_sub_carteirinha', 'whazing_sub_convencoes', 'whazing_sub_outros', 'whazing_sub_boleto', 'Atualizar Carteirinha', 'Convenções Coletivas', 'Outros Assuntos', '2ª Via Boleto'];
        const whazingFollowUpIds = ['whazing_voltar_menu', 'whazing_falar_atendente', 'whazing_voltar_sub', 'whazing_outros_juridico', 'whazing_outros_homologacao', 'whazing_outros_atendente'];

        const messageTextLower = messageTextTrim?.toLowerCase() || '';
        
        let isWhazingLevel1 = whazingLevel1Ids.includes(messageTextTrim) || 
                             ['sou associado', 'sou empresa', 'sou contabilidade'].includes(messageTextLower);
        let isWhazingLevel2 = whazingLevel2Ids.includes(messageTextTrim) || 
                             ['atualizar carteirinha', 'carteirinha', 'conveções coletivas', 'cct', 'outros assuntos', 'outros', '2ª via boleto', 'boleto'].includes(messageTextLower);
        let isWhazingFollowUp = whazingFollowUpIds.includes(messageTextTrim);
        const isWhazingLegacy = messageTextTrim === 'whazing_outros';

        // Numeric Disambiguation (1, 2, 3) based on lastMenuType
        if (['1', '2', '3'].includes(messageTextTrim)) {
          if (!lastMenuType || lastMenuType === 'main') {
            isWhazingLevel1 = true;
          } else if (lastMenuType === 'sub') {
            isWhazingLevel2 = true;
          } else if (lastMenuType === 'followup') {
            isWhazingFollowUp = true;
          }
        }

        // ===== FOLLOW-UP BUTTON HANDLER (Level 3) =====
        if (isWhazingFollowUp) {
          let followUpId = messageTextTrim;
          
          // Numeric choice mapping for follow-up
          if (followUpId === '1') followUpId = 'whazing_falar_atendente';
          else if (followUpId === '2') followUpId = 'whazing_voltar_sub';
          else if (followUpId === '3') followUpId = 'whazing_voltar_menu';

          console.log(`[webhook] Whazing follow-up action: "${followUpId}"`);

          // Mirror/reopen local ticket immediately so dashboard reflects the active chat
          try {
            const now = new Date().toISOString();
            const { data: existingFollowUpTicket } = await supabase
              .from('whazing_tickets')
              .select('id, status')
              .eq('ticket_id', phone)
              .maybeSingle();

            const followUpPushName = payload.data?.pushName;
            const followUpTicketData: Record<string, unknown> = {
              ticket_id: phone,
              contact_number: phone,
              ...(followUpPushName ? { contact_name: followUpPushName } : {}),
              last_message: followUpId,
              updated_at: now,
              closed_at: null,
            };

            if (!existingFollowUpTicket || existingFollowUpTicket.status === 'closed') {
              followUpTicketData.status = 'open';
              followUpTicketData.opened_at = now;
            }

            const { error: followUpUpsertError } = await supabase
              .from('whazing_tickets')
              .upsert(followUpTicketData, { onConflict: 'ticket_id' });

            if (followUpUpsertError) {
              console.error('[webhook] Failed to mirror follow-up ticket locally:', followUpUpsertError);
            } else {
              console.log(`[webhook] Follow-up ticket mirrored locally for ${phone}`);
            }
          } catch (mirrorError) {
            console.error('[webhook] Failed to mirror follow-up ticket locally:', mirrorError);
          }

          if (followUpId === 'whazing_voltar_menu') {
            // Send main menu again
            await sendWhazingMenuButtons(configData, phone, explicitPhoneId);
            return createSuccessResponse({ message: 'Main menu resent' });
          }

          if (followUpId === 'whazing_voltar_sub' || followUpId === 'Voltar') {
            const targetCategory = (storedCategory as WhazingCategory) || 'associado';
            console.log(`[webhook] Returning to sub-menu for category: ${targetCategory}`);
            await sendWhazingSubMenu(configData, phone, targetCategory, explicitPhoneId);
            await storeWhazingContext(supabase, clinicId, phone, targetCategory, 'sub');
            return createSuccessResponse({ message: `Sub-menu resent for ${targetCategory}` });
          }

          if (followUpId === 'whazing_falar_atendente' || followUpId === 'whazing_outros_atendente' || followUpId === 'Falar c/ Atendente') {
            console.log(`[webhook] Human handoff requested via Whazing button for ${phone}`);
            const supportAvailability = await getHumanSupportAvailability(supabase, clinicId);
            const handoffText = buildDirectHumanHandoffMessage(supportAvailability.isHumanAvailable);
            
            // Default queue: Administrativo (6644c29c-95b9-414f-ba8c-62a2402ede34)
            const queueId = "6644c29c-95b9-414f-ba8c-62a2402ede34";

             // Map Whazing category to Zap Responder Department ID
             const zapsterDeptMap: Record<string, string> = {
               'associado': 'fa193a46-e119-4994-852b-29e551ab37f1',
               'empresa': '3259b59a-8f9d-4027-8520-2b78167d59ab',
               'contabilidade': '3259b59a-8f9d-4027-8520-2b78167d59ab', // Mapping to Empresas as fallback
             };
              const targetZapsterDeptId = (storedCategory && zapsterDeptMap[storedCategory as string]) || '972827ca-657d-4c37-a164-944e6e6113b3';
              const deptName = storedCategory === 'associado' ? 'Associados' : (storedCategory === 'empresa' || storedCategory === 'contabilidade' ? 'Empresas/Escritórios' : 'Outros assuntos');
 
              // Notify Zap Responder for Handoff using sendZapsterMessage which handles multiple endpoints
              await sendZapsterMessage(
                clinicId, 
                phone, 
                `🔔 *SOLICITAÇÃO DE ATENDIMENTO HUMANO*\n\nO usuário solicitou falar com um atendente pelo menu WhatsApp.\n\n*Nome:* ${payload.data?.pushName || 'Usuário'}\n*Fila:* ${deptName}\n*Mensagem:* Solicitação via menu de botões.`, 
                targetZapsterDeptId
              );

            await freezeBotForHumanHandoff(
              supabase,
              phone,
              payload.data?.pushName || null,
              'Solicitou falar com atendente pelo menu Outros Assuntos',
              { 
                queueId,
                messageId: payload.data?.key?.id,
                timestamp: payload.data?.messageTimestamp ? Number(payload.data.messageTimestamp) : undefined
              }
            );

            await supabase.from('whatsapp_ai_conversations').insert({
              clinic_id: clinicId,
              phone,
              messages: {
                source: 'whazing_menu',
                action: 'handoff_completed',
                support_stage: 'human_handoff_active',
                context: `Perfil: ${storedCategory || 'associado'} | Menu: Outros Assuntos`,
              },
              expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            });

            await sendWhatsAppMessage(configData, phone, handoffText, explicitPhoneId);
            return createSuccessResponse({ message: 'Routed to atendente' });
          }

          // "Outros Assuntos" sub-option: Jurídico
          if (followUpId === 'whazing_outros_juridico' || followUpId === 'Juridico') {
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
            await storeWhazingContext(supabase, clinicId, phone, currentCategory, 'followup');
            await new Promise(resolve => setTimeout(resolve, 2000));
            await sendWhatsAppButtons(configData, phone, "Posso ajudar com mais alguma coisa?", "", [
              { id: "whazing_falar_atendente", title: "Falar c/ Atendente" },
              { id: "whazing_voltar_sub", title: "Voltar" },
              { id: "whazing_voltar_menu", title: "Menu Principal" },
            ], "", explicitPhoneId);

            return createSuccessResponse({ message: 'Routed to juridico' });
          }

          // "Outros Assuntos" sub-option: Homologações
          if (followUpId === 'whazing_outros_homologacao' || followUpId === 'Homologacoes' || followUpId === 'homologacao') {
            // Send informational message with scheduling link using general helper
            const homologacaoMsg = `📋 *Homologações*\n\nO agendamento de homologação é realizado através do portal do sindicato.\n\nAcesse o link abaixo para agendar:\n👉 https://prosindweb.com.br/agendamento/profissional/ione-atos-1`;
            
            await sendWhatsAppMessage(configData, phone, homologacaoMsg, explicitPhoneId);

            // Set context for follow-up buttons
            await storeWhazingContext(supabase, clinicId, phone, (storedCategory as any) || 'associado', 'followup');
            
            // Follow-up buttons
            await new Promise(resolve => setTimeout(resolve, 2000));
            await sendWhatsAppButtons(configData, phone, "Posso ajudar com mais alguma coisa?", "", [
              { id: "whazing_falar_atendente", title: "Falar c/ Atendente" },
              { id: "whazing_voltar_sub", title: "Voltar" },
              { id: "whazing_voltar_menu", title: "Menu Principal" },
            ], "", explicitPhoneId);

            return createSuccessResponse({ message: 'Routed to homologacao' });
          }
        }

        // LEVEL 1: Main menu choices
        if (isWhazingLevel1) {
          const categoryMap: Record<string, WhazingCategory> = {
            whazing_associado: 'associado',
            whazing_empresa: 'empresa',
            whazing_contabilidade: 'contabilidade',
            'Sou Associado': 'associado',
            'Sou Empresa': 'empresa',
            'Sou Contabilidade': 'contabilidade',
            'sou associado': 'associado',
            'sou empresa': 'empresa',
            'sou contabilidade': 'contabilidade',
            '1': 'associado',
            '2': 'empresa',
            '3': 'contabilidade',
          };
          
          let lookupKey = messageTextTrim;
          if (!categoryMap[lookupKey]) {
            lookupKey = messageTextTrim.toLowerCase();
          }
          
          const category = categoryMap[lookupKey];
          
          if (!category) {
            console.log(`[webhook] Whazing L1: Choice "${messageTextTrim}" not in category map, skipping.`);
            return createSuccessResponse({ message: 'Invalid L1 choice' });
          }
          
          console.log(`[webhook] Whazing L1 choice: "${messageTextTrim}" → ${category}`);

          await storeWhazingContext(supabase, clinicId, phone, category, 'sub');
          await sendWhazingSubMenu(configData, phone, category, explicitPhoneId);
          
          await supabase.from('whatsapp_incoming_logs').insert({
            clinic_id: clinicId,
            phone,
            message_text: `[whazing-L1] ${messageText} → sub-menu ${category}`,
            raw_payload: payload,
            processed: true,
            processed_action: 'whazing_submenu_sent',
          });

           return createSuccessResponse({ message: `Whazing sub-menu sent for ${category}` });
        }

        // LEVEL 2: Sub-menu choices (1, 2, 3 when category is already set)
          if (isWhazingLevel2 || isWhazingLegacy || ['Convenções Coletivas', 'Outros Assuntos', 'Homologacoes', 'Juridico'].includes(messageTextTrim)) {
          const currentCategory = storedCategory || 'associado';
          console.log(`[webhook] Whazing L2 button: "${messageTextTrim}" (category: ${currentCategory})`);
          
           let btnId = messageText.trim();
 
           // Map numeric choices (1, 2, 3) to button IDs based on category
            const btnLower = btnId.toLowerCase();
            
            if (btnId === '1') {
              btnId = (storedCategory === 'associado') ? 'whazing_sub_carteirinha' : 'whazing_sub_boleto';
            } else if (btnLower.includes('carteirinha')) {
              btnId = 'whazing_sub_carteirinha';
            } else if (btnLower.includes('boleto')) {
              btnId = 'whazing_sub_boleto';
            } else if (btnLower === 'sou empresa' || btnLower === 'empresa') {
              btnId = 'whazing_empresa';
            } else if (btnLower === 'sou associado' || btnLower === 'associado') {
              btnId = 'whazing_associado';
            } else if (btnLower === 'sou contabilidade' || btnLower === 'contabilidade') {
              btnId = 'whazing_contabilidade';
            } else if (btnId === '2' || btnLower.includes('convenções') || btnLower.includes('cct')) {
              btnId = 'whazing_sub_convencoes';
            } else if (btnId === '3' || btnLower.includes('outros assuntos') || btnLower === 'outros') {
              btnId = 'whazing_sub_outros';
            } else if (btnLower.includes('homologacao') || btnLower.includes('homologação')) {
              btnId = 'whazing_outros_homologacao';
            } else if (btnLower.includes('juridico') || btnLower.includes('jurídico')) {
              btnId = 'whazing_outros_juridico';
            }

          // ── BOLETO: route directly to boleto-whatsapp-flow ──
          if (btnId === 'whazing_sub_boleto') {
            console.log(`[webhook] Whazing boleto button → direct boleto flow (category: ${currentCategory})`);
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
                   },
                   explicit_phone_id: explicitPhoneId
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

            return createSuccessResponse({ message: 'Whazing boleto flow started directly' });
          }

          // ── CARTEIRINHA: redirect to app (not available via WhatsApp) ──
          if (btnId === 'whazing_sub_carteirinha') {
            console.log(`[webhook] Whazing carteirinha button → redirect to app`);
            const textMessage = `📱 *Atualização de Carteirinha*\n\n⚠️ A atualização da carteirinha deve ser realizada *exclusivamente pelo aplicativo do sindicato*. Este serviço *não está disponível* por WhatsApp.\n\n📋 *Como fazer:*\n1️⃣ Abra o app do sindicato\n2️⃣ Na tela principal, em *"Nossos Serviços"*, toque em *"Atualizar Carteirinha"*\n3️⃣ Envie a foto do contracheque pelo app\n4️⃣ Aguarde a análise da equipe\n\n📥 *Baixe o app:*\n👉 https://prosindweb.com.br/sindicato/instalar\n\nSiga este procedimento para evitar erros e garantir a atualização correta da sua carteirinha. ✅`;
            
            await sendWhatsAppMessage(configData, phone, textMessage, explicitPhoneId);

            // Send follow-up buttons
            await new Promise(resolve => setTimeout(resolve, 2000));
            await storeWhazingContext(supabase, clinicId, phone, currentCategory, 'followup');
            await sendWhatsAppButtons(configData, phone, "Posso ajudar com mais alguma coisa?", "", [
              { id: "whazing_falar_atendente", title: "Falar c/ Atendente" },
              { id: "whazing_voltar_sub", title: "Voltar" },
              { id: "whazing_voltar_menu", title: "Menu Principal" },
            ], "", explicitPhoneId);

            return createSuccessResponse({ message: 'Carteirinha redirect sent' });
          }

          // ── OUTROS ASSUNTOS: show category-specific sub-menu ──
          if (btnId === 'whazing_sub_outros' || btnId === 'whazing_outros' || btnId === 'Outros Assuntos' || btnId === 'Outros') {
            console.log(`[webhook] Whazing "Outros Assuntos" → sub-menu (${currentCategory})`);
            await storeWhazingContext(supabase, clinicId, phone, currentCategory, 'followup');

            if (currentCategory === 'associado') {
              await sendWhatsAppButtons(configData, phone, "*Outros Assuntos - Associado*\n\nComo podemos ajudar?", "", [
                { id: "whazing_outros_juridico", title: "Juridico" },
                { id: "whazing_outros_atendente", title: "Falar c/ Atendente" },
                { id: "whazing_voltar_sub", title: "Voltar" },
              ], "", explicitPhoneId);
            } else {
              await sendWhatsAppButtons(configData, phone, "*Outros Assuntos*\n\nComo podemos ajudar?", "", [
                { id: "whazing_outros_juridico", title: "Juridico" },
                { id: "whazing_outros_homologacao", title: "Homologacoes" },
                { id: "whazing_falar_atendente", title: "Falar c/ Atendente" },
              ], "", explicitPhoneId);
            }
            return createSuccessResponse({ message: `Outros Assuntos sub-menu sent` });
          }

          // ── OTHER SUB-BUTTONS: route via external-integration (AI) ──
          const subActionMap: Record<string, string> = {
            'whazing_sub_convencoes': 'cct',
            'Convenções Coletivas': 'cct',
          };
          const isCct = messageTextTrim.includes('Convenções') || btnId === 'whazing_sub_convencoes' || btnId === 'Convenções Coletivas';

          if (isCct) {
            console.log(`[webhook] Direct CCT response for ${phone}`);
            const cctMsg = `O Sindicato dos Comerciários de Ilhéus e Região informa que a Convenção Coletiva de Trabalho (CCT) 2026/2027 do comércio varejista de Ilhéus e demais cidades da base territorial, bem como do comércio atacadista (supermercados), ainda não foi finalizada.

As negociações seguem em andamento entre as partes envolvidas, não havendo, até o presente momento, definição ou fechamento dos termos da nova convenção.

No que se refere ao comércio varejista, está agendada uma nova reunião para o dia 24 de abril de 2026, ocasião em que as partes darão continuidade às tratativas, com o objetivo de avançar nas negociações e buscar a formalização da CCT.

O Sindicato reforça seu compromisso em manter a categoria informada sobre quaisquer atualizações.

Link para consulta das CCTs anteriores: https://comerciariosilheus.org.br/ccts/

Atenciosamente,
Sindicato dos Comerciários de Ilhéus e Região`;

            await sendWhatsAppMessage(configData, phone, cctMsg, explicitPhoneId);
            
            // Send follow-up buttons
            await storeWhazingContext(supabase, clinicId, phone, (storedCategory as any) || 'associado', 'followup');
            await new Promise(resolve => setTimeout(resolve, 2000));
            await sendWhatsAppButtons(configData, phone, "O que deseja fazer agora?", "", [
              { id: "whazing_falar_atendente", title: "Falar c/ Atendente" },
              { id: "whazing_voltar_sub", title: "Voltar" },
              { id: "whazing_voltar_menu", title: "Menu Principal" },
            ], "", explicitPhoneId);

            return createSuccessResponse({ message: 'Direct CCT info sent' });
          }

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

            if (action !== 'atendente') {
              // Send follow-up buttons only for informational flows.
              // For human-support handoff, avoid re-opening submenus/buttons and causing loop/re-entry.
              await storeWhazingContext(supabase, clinicId, phone, (storedCategory as any) || 'associado', 'followup');
              await new Promise(resolve => setTimeout(resolve, 2000));
              await sendWhatsAppButtons(configData, phone, "O que deseja fazer agora?", "", [
                { id: "whazing_falar_atendente", title: "Falar c/ Atendente" },
                { id: "whazing_voltar_sub", title: "Voltar" },
                { id: "whazing_voltar_menu", title: "Menu Principal" },
              ], "", explicitPhoneId);
            } else {
              console.log('[webhook] Skipping follow-up buttons after atendente handoff to avoid loop');
            }
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

           return createSuccessResponse({ message: 'Whazing button response processed' });
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

          // Also check for an open whazing ticket — if the user is in the middle of a
          // Whazing flow (ticket still open), do NOT treat this as a fresh conversation
          const { data: openWhazingTicket } = await supabase
            .from('whazing_tickets')
            .select('id')
            .in('contact_number', phoneCandidates.map(p => p.replace(/\D/g, '')))
            .eq('status', 'open')
            .limit(1)
            .maybeSingle();

          const isFreshConversation = !anyBookingSession && !anyBoletoSession && !anyAiConversation && !openWhazingTicket;
          
          // Check if message is a greeting or generic first message (not a CPF, number, or specific action)
          const msgClean = messageText.trim();
          const isCpf = /^\d{11}$/.test(msgClean.replace(/\D/g, ''));
          const isNumericOption = /^\d{1,2}$/.test(msgClean);
          const isBoletoKeyword = /^(boleto|2[ª°]?\s*via|segunda\s*via)/i.test(msgClean);
          const isHumanSupportShortcut = /^(outro assunto|outro|outros assuntos?|atendente|falar com atendente|falar com humano|quero falar com atendente|preciso de atendente|suporte|ajuda)$/i.test(msgClean);
          const isNotSpecificAction = !isCpf && !isNumericOption && !isBoletoKeyword && !MENU_REGEX.test(msgClean) && !CANCEL_REGEX.test(msgClean) && !isHumanSupportShortcut;

          // Greetings/menu commands should always restart the Whazing button menu,
          // even with an active AI session.
          const isGreeting = /^(oi|olá|ola|hey|hi|hello|bom\s*dia|boa\s*tarde|boa\s*noite|eai|e\s*ai|opa|fala)/i.test(msgClean);
          const isMenuCommand = MENU_REGEX.test(msgClean);
          // A greeting/menu command should re-open the main menu even if a previous Whazing ticket
          // is still open or an AI conversation exists — only active booking/boleto
          // flows should block the menu reset.
          const shouldShowMenu = (isGreeting || isMenuCommand) && !anyBookingSession && !anyBoletoSession;

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

          // Reset temporary Whazing category sessions on greeting/menu so the
          // next numeric answer is interpreted as a fresh level-1 choice.
          if (shouldShowMenu) {
            await supabase
              .from('whatsapp_ai_conversations')
              .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
              .eq('clinic_id', clinicId)
              .in('phone', phoneCandidates)
              .contains('messages', { source: 'whazing_menu' });
          }

          // If it's a greeting with a stale open Whazing ticket, close it so the
          // initial menu is shown again on next interactions.
          if (shouldShowMenu && openWhazingTicket) {
            console.log(`[webhook] Greeting detected with open Whazing ticket - closing stale ticket to reset menu`);
            await supabase
              .from('whazing_tickets')
              .update({ status: 'closed', closed_at: new Date().toISOString() })
              .eq('id', (openWhazingTicket as { id: string }).id);
          }

          if ((isFreshConversation && isNotSpecificAction) || shouldShowMenu) {
            console.log(`[webhook] Fresh conversation detected - sending Whazing interactive buttons to ${phone}`);
     console.log(`[webhook] Fresh conversation or greeting - sending Whazing menu to ${phone}`);
     const buttonsSent = await sendWhatsAppButtons(configData, phone, 
       "Olá! 👋 Bem-vindo(a) ao atendimento.",
       "Como podemos ajudá-lo(a) hoje?\n\nDigite o número da opção desejada:",
       [
         { id: "whazing_associado", title: "Sou Associado" },
         { id: "whazing_empresa", title: "Sou Empresa" },
         { id: "whazing_contabilidade", title: "Sou Contabilidade" },
       ]
     );
            
            if (buttonsSent) {
              await supabase.from('whatsapp_incoming_logs').insert({
                clinic_id: clinicId,
                phone,
                message_text: messageText,
                raw_payload: payload,
                processed: true,
                processed_action: 'whazing_menu_sent',
              });

               return createSuccessResponse({ message: 'Whazing menu buttons sent' });
            }
            console.log('[webhook] Whazing buttons failed, falling through to normal flow');
          }
        }
        // ===== END WHAZING INITIAL MENU =====

        // ===== BOLETO BUTTON ROUTING =====
        // Keep raw button IDs. The boleto function validates each ID against the current state,
        // preventing duplicated/late button events from advancing the flow automatically.
        const rawBtnId = messageText?.trim();
        const isBoletoButton = rawBtnId?.startsWith('boleto_') ?? false;
        if (isBoletoButton) {
          console.log(`[webhook] Boleto button "${rawBtnId}" routed as raw id`);
        }
        // ===== END BOLETO BUTTON ROUTING =====

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

        // FALLBACK: If user clicked a boleto interactive button but the session expired,
        // look at recent (last 90 min) non-finished sessions and revive them by extending expiry.
        // This prevents the "back to initial menu" bug when the user takes longer than 15min
        // to confirm via WhatsApp buttons.
        let revivedBoletoSession = activeBoletoSession;
        if (!activeBoletoSession && isBoletoButton) {
          const ninetyMinAgo = new Date(Date.now() - 90 * 60 * 1000).toISOString();
          const { data: recentSession } = await supabase
            .from('whatsapp_boleto_sessions')
            .select('*')
            .eq('clinic_id', clinicId)
            .in('phone', phoneCandidates)
            .gt('updated_at', ninetyMinAgo)
            .neq('state', 'FINISHED')
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (recentSession) {
            console.log(`[webhook] Reviving expired boleto session ${recentSession.id} (state=${recentSession.state}) for boleto button "${rawBtnId}"`);
            const newExpiry = new Date(Date.now() + 30 * 60 * 1000).toISOString();
            await supabase
              .from('whatsapp_boleto_sessions')
              .update({ expires_at: newExpiry })
              .eq('id', recentSession.id);
            revivedBoletoSession = { ...recentSession, expires_at: newExpiry };
          }
        }

        // '6' is also boleto when booking is disabled (menu without booking: 6=boleto)
        const isBoletoRequest = /^(6|7|boleto|2[ª°]?\s*via|segunda\s*via)/i.test(messageText.trim()) && configData.booking_enabled === false
          ? /^(6|boleto|2[ª°]?\s*via|segunda\s*via)/i.test(messageText.trim())
          : /^(7|boleto|2[ª°]?\s*via|segunda\s*via)/i.test(messageText.trim());

        if (revivedBoletoSession || isBoletoRequest || isBoletoButton) {
          console.log(`[webhook] Routing to boleto flow - active session: ${!!revivedBoletoSession}, is request: ${isBoletoRequest}, is button: ${isBoletoButton}`);
          
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
                message: (revivedBoletoSession || isBoletoButton) ? messageText : undefined,
                action: (!revivedBoletoSession && !isBoletoButton) ? 'start' : undefined,
                 evolution_config: {
                   api_url: configData.api_url,
                   api_key: configData.api_key,
                   instance_name: configData.instance_name,
                 },
                 explicit_phone_id: explicitPhoneId
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
              return new Response(
                JSON.stringify({ success: false, message: 'Boleto flow failed without AI fallback' }),
                { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
          } catch (boletoError) {
            console.error('[webhook] Error calling boleto flow:', boletoError);
            return new Response(
              JSON.stringify({ success: false, message: 'Boleto flow unavailable without AI fallback' }),
              { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
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
            const hasBookingIntent = (bookingIntentRegex.test(msgLower) || isBookingMenuOption) && !isBoletoRequest;

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

              await sendWhatsAppMessage(configData, phone, appOnlyMsg, explicitPhoneId);

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
              `⚠️ *Recurso indisponível*\n\nO agendamento por WhatsApp não está disponível para esta clínica.\n\nPor favor, entre em contato diretamente com a clínica para realizar seu agendamento.`,
              explicitPhoneId
            );
             return createSuccessResponse({ message: 'Feature not available for clinic' });
          }

          console.log(`[webhook] Clinic ${clinicId} has whatsapp_booking feature - proceeding`);
        } else {
          // booking_enabled=false: skip plan check, route non-booking messages directly to AI assistant
          console.log(`[webhook] booking_enabled=false for clinic ${clinicId} - skipping plan check, routing non-booking message to AI`);
          const supabaseUrlEnv = Deno.env.get('SUPABASE_URL')!;
          const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

          let aiMessage = messageText;
          try {
            const { data: activeAiContexts } = await supabase
              .from('whatsapp_ai_conversations')
              .select('messages, created_at')
              .eq('clinic_id', clinicId)
              .in('phone', phoneCandidates)
              .gt('expires_at', new Date().toISOString())
              .order('created_at', { ascending: false })
              .limit(10);

            const latestAtendenteContext = activeAiContexts?.find((row: any) =>
              row?.messages?.source === 'external_integration' &&
              row?.messages?.action === 'atendente'
            );

            // Check if we are already waiting for the user to describe the subject
            const isAwaitingSubject = activeAiContexts?.some((row: any) =>
              row?.messages?.action === 'awaiting_handoff_subject'
            );

            if (latestAtendenteContext || isAwaitingSubject) {
              const normalizedInput = normalizeSupportText(messageText || '');
              const isGenericSupportReply = /^(outro assunto|outro|outros|outros assuntos?|atendente|falar com atendente|humano|suporte|ajuda)$/.test(normalizedInput);

              if (isAwaitingSubject && messageText && messageText.trim().length > 0 && !isGenericSupportReply) {
                console.log(`[webhook] Received subject for human handoff: "${messageText}"`);

                // Classify the subject into a queue using Lovable AI
                const chosenQueue = await classifySubjectToQueue(supabase, messageText);
                const supportAvailability = await getHumanSupportAvailability(supabase, clinicId);

                await freezeBotForHumanHandoff(
                  supabase,
                  phone,
                  payload.data?.pushName || null,
                  messageText,
                  {
                    queueId: chosenQueue?.id,
                    messageId: payload.data?.key?.id,
                    timestamp: payload.data?.messageTimestamp ? Number(payload.data.messageTimestamp) : undefined
                  }
                );

                if (chosenQueue) {
                   const cleanedPhone = phone.replace(/\D/g, '');
                   await supabase
                     .from('whazing_tickets')
                     .update({
                       subject: messageText.slice(0, 250),
                       updated_at: new Date().toISOString(),
                     })
                     .eq('contact_number', cleanedPhone);
                   console.log(`[webhook] Ticket subject updated for queue "${chosenQueue.name}"`);
                }

                // Expire the awaiting_subject session
                await supabase
                  .from('whatsapp_ai_conversations')
                  .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
                  .eq('clinic_id', clinicId)
                  .in('phone', phoneCandidates);

                await supabase.from('whatsapp_ai_conversations').insert({
                  clinic_id: clinicId,
                  phone,
                  messages: {
                    source: 'webhook_human_handoff',
                    action: 'handoff_completed',
                    subject: messageText,
                    queue_id: chosenQueue?.id || null,
                    queue_name: chosenQueue?.name || null,
                  },
                  expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
                });

                const queueLine = chosenQueue
                  ? `\n\n📌 Encaminhei para a equipe de *${chosenQueue.name}*.`
                  : '';
                const handoffMessage = buildDirectHumanHandoffMessage(supportAvailability.isHumanAvailable) + queueLine;
                await sendWhatsAppMessage(configData, phone, handoffMessage, explicitPhoneId);
                
                 // Notify Zap Responder of completion of handoff (with subject)
                 const zapDeptId = getZapsterDeptIdFromQueue(chosenQueue?.id || null);
                 await sendZapsterMessage(
                   clinicId, 
                   phone, 
                   `✅ *HANDOFF CONCLUÍDO*\n\nAssunto: ${messageText}${chosenQueue ? `\nFila: ${chosenQueue.name}` : ''}\n\nO robô foi pausado.`,
                   zapDeptId
                 );

                 return createSuccessResponse({ message: 'Subject captured and routed to queue' });
              }

              if (isGenericSupportReply) {
                const supportAvailability = await getHumanSupportAvailability(supabase, clinicId);
                console.log(`[webhook] User requested human support (${normalizedInput || 'empty'}) - asking for subject before routing. availability=${supportAvailability.isHumanAvailable}`);

                // Ask for subject first; do NOT freeze the bot yet, so we can still classify the reply
                await supabase.from('whatsapp_ai_conversations').insert({
                  clinic_id: clinicId,
                  phone,
                  messages: {
                    source: 'webhook_human_handoff',
                    action: 'awaiting_handoff_subject',
                    support_stage: 'awaiting_subject',
                    original_text: messageText,
                    human_available: supportAvailability.isHumanAvailable,
                    reason: supportAvailability.reason,
                  },
                  expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
                });

                await sendWhatsAppMessage(configData, phone, buildAskSubjectMessage(), explicitPhoneId);

                 return createSuccessResponse({ message: 'Asked user for subject' });
              }

              aiMessage = `[Contexto: o usuário já escolheu falar com atendente no menu externo e a mensagem abaixo é a resposta sobre o assunto para encaminhamento humano.] ${messageText}`;

              console.log(`[webhook] Enriched AI context for atendente flow (${normalizedInput || 'empty'})`);
            }
          } catch (contextErr) {
            console.error('[webhook] Failed to load AI context for non-booking path:', contextErr);
          }

          // Ensure an AI conversation session exists so subsequent messages
          // are NOT treated as "fresh conversations" (which re-triggers the menu → loop)
          try {
            await supabase.from('whatsapp_ai_conversations').insert({
              clinic_id: clinicId,
              phone,
              messages: { source: 'webhook_non_booking', text: messageText },
              expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
            });
          } catch (_e) { /* session may already exist */ }

          try {
            const collector = syncReplyStore.getStore();
            const isSync = !!collector;

            const aiResponse = await fetch(`${supabaseUrlEnv}/functions/v1/whatsapp-ai-assistant`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseAnonKey}`,
              },
              body: JSON.stringify({
                clinic_id: clinicId,
                phone,
                message: aiMessage,
                evolution_config: {
                  api_url: configData.api_url,
                  api_key: configData.api_key,
                  instance_name: configData.instance_name,
                },
                booking_enabled: false,
                 deliver_response_via_caller: isSync,
                 explicit_phone_id: explicitPhoneId,
                 // Only suppress LIA's internal text menu when the user selected an
                // external menu option (ex: "1-2"). If Whazing buttons fail (403),
                // greetings like "oi" must still receive the normal text menu.
                suppress_internal_menu: externalMenuMode,
                external_menu_mode: externalMenuMode,
              }),
            });

            if (isSync && aiResponse.ok && collector) {
              const aiData = await aiResponse.json();
              if (aiData.response) {
                collector.push(aiData.response);
              }
            }
          } catch (aiErr) {
            console.error('[webhook] Error calling AI assistant (non-booking path):', aiErr);
          }
           return createSuccessResponse({ message: 'Non-booking message routed to AI' });
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
          await handleAIBookingFlow(supabase, configData, phone, messageText, explicitPhoneId);
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
        } // end if (!botSkipped)
      } else {
        console.log(`[webhook] No config found with direct_reply_enabled for instance: ${payload.instance}`);
      }
    }

    // Mirror to whazing_tickets / whazing_messages for dashboard
    try {
      const ticketId = phone;
      const now = new Date().toISOString();
      const pushName = payload.data?.pushName || '';
      const fromMe = payload.data?.key?.fromMe || false;
      const msgId = payload.data?.key?.id || '';

      // Determine media type
      let whMediaType: string | null = null;
      const msg = payload.data?.message;
      if (msg?.imageMessage) whMediaType = 'image';
      else if (msg?.videoMessage) whMediaType = 'video';
      else if (msg?.audioMessage) whMediaType = 'audio';
      else if (msg?.documentMessage) whMediaType = 'document';
      else if (msg?.stickerMessage) whMediaType = 'sticker';

      // For mirroring, prefer human-readable display text for button/list responses
      let mirrorText = messageText;
      if (msg?.buttonsResponseMessage) {
        const displayText = msg.buttonsResponseMessage.selectedDisplayText as string | undefined;
        const buttonId = msg.buttonsResponseMessage.selectedButtonId as string | undefined;
        mirrorText = displayText || buttonId || messageText;
        console.log(`[mirror] Button response: display="${displayText}", id="${buttonId}"`);
      } else if (msg?.buttonResponseMessage) {
        const displayText = msg.buttonResponseMessage.selectedDisplayText as string | undefined;
        const buttonId = msg.buttonResponseMessage.selectedButtonId as string | undefined;
        mirrorText = displayText || buttonId || messageText;
        console.log(`[mirror] Button response (alt): display="${displayText}", id="${buttonId}"`);
      } else if (msg?.listResponseMessage) {
        const rowId = msg.listResponseMessage?.singleSelectReply?.selectedRowId as string | undefined;
        mirrorText = rowId || messageText;
        console.log(`[mirror] List response: rowId="${rowId}"`);
      } else if (msg?.templateButtonReplyMessage) {
        const selectedId = msg.templateButtonReplyMessage.selectedId as string | undefined;
        mirrorText = selectedId || messageText;
        console.log(`[mirror] Template button reply: id="${selectedId}"`);
      } else if (msg?.interactiveResponseMessage) {
        try {
          const paramsJson = msg.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson as string | undefined;
          if (paramsJson) {
            const params = JSON.parse(paramsJson);
            mirrorText = params.display || params.id || messageText;
          }
        } catch { /* ignore */ }
        console.log(`[mirror] Interactive response: "${mirrorText}"`);
      } else if ((msg as any)?.interactive) {
        const im = (msg as any).interactive;
        mirrorText = im.button_reply?.title || im.button_reply?.id || im.list_reply?.title || im.list_reply?.id || messageText;
        console.log(`[mirror] Meta interactive response: "${mirrorText}"`);
      }

      // Upsert ticket
      const { data: existingTkt } = await supabase
        .from('whazing_tickets')
        .select('id, status')
        .eq('ticket_id', ticketId)
        .maybeSingle();

      const tktData: Record<string, unknown> = {
        ticket_id: ticketId,
        contact_number: phone,
        ...(pushName ? { contact_name: pushName } : {}),
        last_message: mirrorText ? mirrorText.slice(0, 500) : null,
        updated_at: now,
      };

      if (!existingTkt) {
        tktData.status = 'open';
        tktData.opened_at = now;
      } else if (existingTkt?.status === 'closed') {
        tktData.status = 'open';
        tktData.opened_at = now;
        tktData.closed_at = null;
      }

      await supabase.from('whazing_tickets').upsert(tktData, { onConflict: 'ticket_id' });

      // Save message (including button clicks that may have no standard text)
      if (msgId && (mirrorText || whMediaType)) {
        const ts = payload.data?.messageTimestamp
          ? Number(payload.data.messageTimestamp)
          : Math.floor(Date.now() / 1000);
        await supabase.from('whazing_messages').upsert({
          ticket_id: ticketId,
          message_id: msgId,
          body: (mirrorText || '[mídia]').slice(0, 2000),
          from_me: fromMe,
          media_type: whMediaType,
          sender_name: fromMe ? 'Atendente' : (pushName || 'Contato'),
          sender_phone: fromMe ? null : phone,
          timestamp: ts,
        }, { onConflict: 'message_id' });
      }
    } catch (mirrorErr) {
      console.error('[webhook] Whazing mirror error:', mirrorErr);
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

    const collector = syncReplyStore.getStore();
    const responseData: any = { success: true };
    if (collector && collector.length > 0) {
      responseData.reply = collector.join('\n\n');
    }

    return new Response(
      JSON.stringify(responseData),
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
}

serve(async (req) => {
  const collector: string[] = [];
  // Only use the synchronous reply collector for explicit internal tests.
  // Real Evolution API webhooks must send messages through the provider; if
  // they run inside AsyncLocalStorage, sendWhatsAppButtons/sendWhatsAppMessage
  // only append to the HTTP response and nothing is delivered to WhatsApp.
  const clonedReq = req.clone();
  let isTestPayload = false;
  try {
    const body = await clonedReq.json();
    isTestPayload = body.test === true || body.is_test === true || body.from_internal_tester === true;
  } catch { /* ignore */ }

  if (isTestPayload) {
    return await syncReplyStore.run(collector, () => handleWebhook(req));
  }

  return await handleWebhook(req);
});
