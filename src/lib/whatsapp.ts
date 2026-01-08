import { supabase } from "@/integrations/supabase/client";
import { extractFunctionsError } from "@/lib/functionsError";

// Open WhatsApp chat with a phone number
export function openWhatsApp(phone: string, message?: string): void {
  const cleanedPhone = phone.replace(/\D/g, '');
  // Add Brazil country code if not present
  const phoneWithCountry = cleanedPhone.startsWith('55') ? cleanedPhone : `55${cleanedPhone}`;
  const encodedMessage = message ? `&text=${encodeURIComponent(message)}` : '';
  window.open(`https://wa.me/${phoneWithCountry}?${encodedMessage}`, '_blank');
}

interface SendWhatsAppParams {
  phone: string;
  message: string;
  clinicId: string;
  type?: 'reminder' | 'confirmation' | 'custom';
}

interface SendWhatsAppDocumentParams {
  phone: string;
  clinicId: string;
  pdfBase64: string;
  fileName: string;
  caption?: string;
}

interface WhatsAppResponse {
  success: boolean;
  error?: string;
  data?: any;
}

const SESSION_EXPIRED_MESSAGE = "Sessão expirada. Por favor, faça login novamente.";

function isAuthError(error: any): boolean {
  const message = error?.message || '';
  return (
    message.includes('Auth session missing') ||
    message.includes('Invalid token') ||
    message.includes('session_not_found') ||
    message.includes('JWT expired') ||
    message.includes('not authenticated')
  );
}

async function checkSession(): Promise<boolean> {
  const { data: { session }, error } = await supabase.auth.getSession();
  return !error && !!session;
}

// Extrair mensagem de erro real de FunctionsHttpError (Response object)
async function extractHttpErrorMessage(error: any): Promise<string> {
  try {
    // FunctionsHttpError tem error.context como Response
    const context = error?.context;
    
    // Verificar se context é um Response (tem método text)
    if (context && typeof context.text === 'function') {
      const cloned = context.clone();
      const text = await cloned.text();
      
      if (text) {
        // Tentar parsear como JSON
        try {
          const json = JSON.parse(text);
          if (json.error && typeof json.error === 'string') {
            return json.error;
          }
          if (json.message && typeof json.message === 'string') {
            return json.message;
          }
        } catch {
          // Não é JSON, retornar texto limitado
          return text.slice(0, 500);
        }
      }
    }
    
    // Fallback para extractFunctionsError
    const extracted = extractFunctionsError(error);
    return extracted.message;
  } catch (e) {
    console.error('Error extracting HTTP error message:', e);
    const extracted = extractFunctionsError(error);
    return extracted.message;
  }
}

export async function sendWhatsAppMessage(params: SendWhatsAppParams): Promise<WhatsAppResponse> {
  try {
    // Verificar sessão ativa antes de enviar
    if (!await checkSession()) {
      return { success: false, error: SESSION_EXPIRED_MESSAGE };
    }

    const { data, error } = await supabase.functions.invoke('send-whatsapp', {
      body: params,
    });

    if (error) {
      console.error('Error invoking send-whatsapp function:', error);
      if (isAuthError(error)) {
        return { success: false, error: SESSION_EXPIRED_MESSAGE };
      }
      // Usar extração async para ler o body do Response
      const errorMessage = await extractHttpErrorMessage(error);
      return { success: false, error: errorMessage };
    }

    // Check if the response contains an error
    if (data && !data.success) {
      return { success: false, error: data.error || 'Erro ao enviar mensagem' };
    }

    return data as WhatsAppResponse;
  } catch (error: unknown) {
    console.error('Error sending WhatsApp:', error);
    if (isAuthError(error)) {
      return { success: false, error: SESSION_EXPIRED_MESSAGE };
    }
    const errorMessage = await extractHttpErrorMessage(error);
    return { success: false, error: errorMessage };
  }
}

export async function sendWhatsAppDocument(params: SendWhatsAppDocumentParams): Promise<WhatsAppResponse> {
  try {
    // Verificar sessão ativa antes de enviar
    if (!await checkSession()) {
      return { success: false, error: SESSION_EXPIRED_MESSAGE };
    }

    const { data, error } = await supabase.functions.invoke('send-whatsapp-document', {
      body: params,
    });

    if (error) {
      console.error('Error invoking send-whatsapp-document function:', error);
      if (isAuthError(error)) {
        return { success: false, error: SESSION_EXPIRED_MESSAGE };
      }
      
      // Usar extração async para ler o body do Response
      const errorMessage = await extractHttpErrorMessage(error);
      
      // Check for limit exceeded error
      if (errorMessage.includes('Limite') || errorMessage.includes('limite')) {
        return { 
          success: false, 
          error: "📊 Limite de mensagens atingido!\n\nSua clínica atingiu o limite mensal de envios do plano atual. Para continuar enviando, faça upgrade do seu plano ou aguarde o próximo mês." 
        };
      }
      
      return { success: false, error: errorMessage };
    }

    // Check if the response contains an error
    if (data && !data.success) {
      return { success: false, error: data.error || 'Erro ao enviar documento' };
    }

    return data as WhatsAppResponse;
  } catch (error: unknown) {
    console.error('Error sending WhatsApp document:', error);
    if (isAuthError(error)) {
      return { success: false, error: SESSION_EXPIRED_MESSAGE };
    }
    const errorMessage = await extractHttpErrorMessage(error);
    return { success: false, error: errorMessage };
  }
}

export function formatAppointmentReminder(
  patientName: string,
  clinicName: string,
  date: string,
  time: string,
  professionalName: string,
  confirmationLink?: string,
  directReplyEnabled?: boolean
): string {
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
    confirmationLink ? `Para confirmar ou cancelar sua consulta, acesse:` : `Por favor, confirme sua presença respondendo esta mensagem.`,
    confirmationLink ? confirmationLink : null,
    ``,
    `Atenciosamente,`,
    `Equipe ${clinicName}`,
  ].filter(Boolean);

  return lines.join('\n');
}

export function formatAppointmentConfirmation(
  patientName: string,
  clinicName: string,
  date: string,
  time: string,
  professionalName?: string
): string {
  const lines = [
    `Olá ${patientName}! ✅`,
    ``,
    `Sua consulta foi confirmada com sucesso!`,
    ``,
    `📅 *Data:* ${date}`,
    `🕐 *Horário:* ${time}`,
    professionalName ? `👨‍⚕️ *Profissional:* ${professionalName}` : null,
    `🏥 *Local:* ${clinicName}`,
    ``,
    `Agradecemos a confirmação. Até lá!`,
    ``,
    `Atenciosamente,`,
    `Equipe ${clinicName}`,
  ].filter(Boolean);

  return lines.join('\n');
}

export function formatAppointmentCancellation(
  patientName: string,
  clinicName: string,
  date: string,
  time: string
): string {
  const lines = [
    `Olá ${patientName},`,
    ``,
    `Informamos que sua consulta agendada para ${date} às ${time} foi cancelada.`,
    ``,
    `Caso deseje reagendar, entre em contato conosco ou acesse nosso sistema de agendamento online.`,
    ``,
    `Atenciosamente,`,
    `Equipe ${clinicName}`,
  ];

  return lines.join('\n');
}

export function formatExamRequest(
  patientName: string,
  clinicName: string,
  date: string,
  professionalName: string
): string {
  return `Olá ${patientName}! 👋

📋 *Solicitação de Exames*

O(a) Dr(a). ${professionalName} da ${clinicName} está enviando sua solicitação de exames.

📅 *Data:* ${date}

📎 O documento em PDF está anexado a esta mensagem.

⚠️ *Importante:*
• Leve este documento ao laboratório/clínica de imagens
• Siga as orientações de preparo de cada exame
• Em caso de dúvidas, entre em contato conosco

Atenciosamente,
Equipe ${clinicName}`;
}

export function formatTelemedicineInvite(
  patientName: string,
  clinicName: string,
  date: string,
  time: string,
  professionalName: string,
  telemedicineLink: string
): string {
  const lines = [
    `Olá ${patientName}! 👋`,
    ``,
    `Sua *teleconsulta* foi agendada com sucesso!`,
    ``,
    `📅 *Data:* ${date}`,
    `🕐 *Horário:* ${time}`,
    `👨‍⚕️ *Profissional:* ${professionalName}`,
    `🏥 *Clínica:* ${clinicName}`,
    ``,
    `📹 *Link para a consulta:*`,
    telemedicineLink,
    ``,
    `⚠️ *Importante:*`,
    `• Acesse o link 5 minutos antes do horário`,
    `• Use um navegador atualizado (Chrome, Firefox, Safari)`,
    `• Verifique se sua câmera e microfone estão funcionando`,
    `• Escolha um local silencioso e bem iluminado`,
    ``,
    `Atenciosamente,`,
    `Equipe ${clinicName}`,
  ];

  return lines.join('\n');
}

export function formatPaymentReceipt(
  patientName: string,
  clinicName: string,
  amount: string,
  description: string,
  date: string
): string {
  return `Olá ${patientName}! 👋

📃 *Recibo de Pagamento*

A ${clinicName} envia o comprovante do seu pagamento:

💰 *Valor:* ${amount}
📝 *Descrição:* ${description}
📅 *Data:* ${date}

📎 O recibo em PDF está anexado a esta mensagem.

Agradecemos a preferência!

Atenciosamente,
Equipe ${clinicName}`;
}

export function formatProfessionalCancellation(
  patientName: string,
  clinicName: string,
  date: string,
  time: string,
  professionalName: string,
  reason?: string
): string {
  const lines = [
    `Olá ${patientName}! 😊`,
    ``,
    `Entramos em contato para informar que, infelizmente, precisaremos remarcar sua consulta agendada para:`,
    ``,
    `📅 *Data:* ${date}`,
    `🕐 *Horário:* ${time}`,
    `👨‍⚕️ *Profissional:* ${professionalName}`,
    ``,
    reason ? `📝 *Motivo:* ${reason}` : null,
    reason ? `` : null,
    `Pedimos sinceras desculpas pelo transtorno. O(a) ${professionalName} não poderá realizar atendimentos neste horário devido a um imprevisto.`,
    ``,
    `🔄 *Para reagendar:*`,
    `• Responda esta mensagem com sua preferência de novo horário`,
    `• Ou entre em contato conosco pelo telefone da clínica`,
    ``,
    `Estamos à disposição para encontrar o melhor horário para você!`,
    ``,
    `Atenciosamente,`,
    `Equipe ${clinicName} 💙`,
  ].filter(Boolean);

  return lines.join('\n');
}
