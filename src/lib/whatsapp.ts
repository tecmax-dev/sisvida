import { supabase } from "@/integrations/supabase/client";

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
      return { success: false, error: error.message };
    }

    return data as WhatsAppResponse;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('Error sending WhatsApp:', errorMessage);
    if (isAuthError(error)) {
      return { success: false, error: SESSION_EXPIRED_MESSAGE };
    }
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
      
      // Check for limit exceeded error (429 status)
      if (error.message?.includes('non-2xx') || error.message?.includes('429')) {
        return { 
          success: false, 
          error: "📊 Limite de mensagens atingido!\n\nSua clínica atingiu o limite mensal de envios do plano atual. Para continuar enviando, faça upgrade do seu plano ou aguarde o próximo mês." 
        };
      }
      
      return { success: false, error: error.message };
    }

    // Check if the response contains a limit error
    if (data && !data.success && data.error?.includes('Limite de mensagens')) {
      return { 
        success: false, 
        error: "📊 Limite de mensagens atingido!\n\nSua clínica atingiu o limite mensal de envios do plano atual. Para continuar enviando, faça upgrade do seu plano ou aguarde o próximo mês." 
      };
    }

    return data as WhatsAppResponse;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('Error sending WhatsApp document:', errorMessage);
    if (isAuthError(error)) {
      return { success: false, error: SESSION_EXPIRED_MESSAGE };
    }
    return { success: false, error: errorMessage };
  }
}

export function formatAppointmentReminder(
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
