import { supabase } from "@/integrations/supabase/client";

interface SendWhatsAppParams {
  phone: string;
  message: string;
  clinicId: string;
  type?: 'reminder' | 'confirmation' | 'custom';
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
