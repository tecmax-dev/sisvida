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

export async function sendWhatsAppMessage(params: SendWhatsAppParams): Promise<WhatsAppResponse> {
  try {
    const { data, error } = await supabase.functions.invoke('send-whatsapp', {
      body: params,
    });

    if (error) {
      console.error('Error invoking send-whatsapp function:', error);
      return { success: false, error: error.message };
    }

    return data as WhatsAppResponse;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('Error sending WhatsApp:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

export async function sendWhatsAppDocument(params: SendWhatsAppDocumentParams): Promise<WhatsAppResponse> {
  try {
    const { data, error } = await supabase.functions.invoke('send-whatsapp-document', {
      body: params,
    });

    if (error) {
      console.error('Error invoking send-whatsapp-document function:', error);
      return { success: false, error: error.message };
    }

    return data as WhatsAppResponse;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('Error sending WhatsApp document:', errorMessage);
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
