import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface HomologacaoAppointment {
  id: string;
  employee_name: string;
  company_name: string;
  company_phone: string;
  appointment_date: string;
  start_time: string;
  protocol_number?: string | null;
  professional?: { name: string } | null;
}

interface SendWhatsAppResult {
  success: boolean;
  error?: string;
}

// Generate unique protocol number: HOM-YYYYMMDD-NNNN
export async function generateProtocolNumber(clinicId: string, date: string): Promise<string> {
  const dateStr = date.replace(/-/g, "");
  
  // Count existing protocols for this date
  const { count } = await supabase
    .from("homologacao_appointments")
    .select("*", { count: "exact", head: true })
    .eq("clinic_id", clinicId)
    .ilike("protocol_number", `HOM-${dateStr}-%`);
  
  const sequence = String((count || 0) + 1).padStart(4, "0");
  return `HOM-${dateStr}-${sequence}`;
}

// Format phone number for WhatsApp
function formatWhatsAppPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  
  // Add Brazil country code if not present
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return digits;
  }
  return digits;
}

// Format reminder message
export function formatReminderMessage(appointment: HomologacaoAppointment, recipientType?: "company" | "manager" | "professional"): string {
  const date = format(new Date(appointment.appointment_date + "T12:00:00"), "dd/MM/yyyy");
  const time = appointment.start_time?.slice(0, 5) || "";

  const greeting = recipientType === "professional"
    ? `Prezado(a) ${appointment.professional?.name || "Profissional"},`
    : recipientType === "manager"
    ? "Prezado(a) Gestor(a),"
    : "Prezado(a),";

  const instruction = recipientType === "professional"
    ? "Você possui uma homologação agendada. Confira os detalhes abaixo:"
    : recipientType === "manager"
    ? "Segue lembrete de uma homologação sob sua gestão:"
    : "Este é um lembrete do agendamento de homologação:";

  return `🔔 *Lembrete de Homologação*

${greeting}

${instruction}

📋 *Funcionário:* ${appointment.employee_name}
🏢 *Empresa:* ${appointment.company_name}
📅 *Data:* ${date}
🕐 *Horário:* ${time}
${appointment.professional ? `👤 *Profissional:* ${appointment.professional.name}` : ""}

📍 *Local:* Rua Coronel Paiva, 99, Centro
   Ilhéus - BA
   _(Ao lado da Sorveteria Chiquinho)_
📞 *Telefone:* (11) 5194-3839

Por favor, compareça no horário agendado com toda a documentação necessária.

_Esta é uma mensagem automática._`;
}

// Format confirmation message
export function formatConfirmationMessage(appointment: HomologacaoAppointment): string {
  const date = format(new Date(appointment.appointment_date + "T12:00:00"), "dd/MM/yyyy");
  const time = appointment.start_time?.slice(0, 5) || "";

  return `✅ *Confirmação de Homologação*

Prezado(a),

Seu agendamento de homologação foi *confirmado* com sucesso!

📋 *Funcionário:* ${appointment.employee_name}
🏢 *Empresa:* ${appointment.company_name}
📅 *Data:* ${date}
🕐 *Horário:* ${time}
${appointment.professional ? `👤 *Profissional:* ${appointment.professional.name}` : ""}

📍 *Local:* Rua Coronel Paiva, 99, Centro
   Ilhéus - BA
   _(Ao lado da Sorveteria Chiquinho)_
📞 *Telefone:* (11) 5194-3839

Por favor, compareça no horário agendado com toda a documentação necessária.

_Esta é uma mensagem automática._`;
}

// Format protocol message
export function formatProtocolMessage(appointment: HomologacaoAppointment): string {
  const date = format(new Date(appointment.appointment_date + "T12:00:00"), "dd/MM/yyyy");
  
  return `✅ *Protocolo de Homologação*

O processo de homologação foi concluído com sucesso.

📋 *Funcionário:* ${appointment.employee_name}
🏢 *Empresa:* ${appointment.company_name}
📅 *Data:* ${date}
📝 *Protocolo:* ${appointment.protocol_number || "N/A"}

📍 *Local:* Rua Coronel Paiva, 99, Centro
   Ilhéus - BA
   _(Ao lado da Sorveteria Chiquinho)_
📞 *Telefone:* (11) 5194-3839

Guarde este protocolo para seus registros.

_Este é um comprovante oficial._`;
}

// Send WhatsApp via Evolution API (through edge function)
export async function sendWhatsAppViaEvolution(
  clinicId: string,
  phone: string, 
  message: string
): Promise<SendWhatsAppResult> {
  console.log(`[sendWhatsAppViaEvolution] Iniciando envio: clinicId=${clinicId}, phone=${phone}, msgLen=${message.length}`);
  
  try {
    const { data, error } = await supabase.functions.invoke('send-whatsapp', {
      body: {
        phone,
        message,
        clinicId,
        type: 'custom',
      },
    });

    console.log('[sendWhatsAppViaEvolution] Response:', { data, error: error?.message });

    if (error) {
      const errMsg = error.message || JSON.stringify(error) || 'Erro ao invocar função';
      console.error('[sendWhatsAppViaEvolution] Invoke error:', errMsg);
      return { success: false, error: errMsg };
    }

    if (data && !data.success) {
      console.error('[sendWhatsAppViaEvolution] Function returned error:', data.error);
      return { success: false, error: data.error || 'Erro ao enviar mensagem' };
    }

    console.log('[sendWhatsAppViaEvolution] Mensagem enviada com sucesso');
    return { success: true };
  } catch (err: any) {
    const errMsg = err?.message || JSON.stringify(err) || 'Erro desconhecido';
    console.error('[sendWhatsAppViaEvolution] Exception:', errMsg, err);
    return { success: false, error: errMsg };
  }
}

// Open WhatsApp with message (legacy - opens WhatsApp Web)
export function openWhatsAppChat(phone: string, message: string): void {
  const formattedPhone = formatWhatsAppPhone(phone);
  const encodedMessage = encodeURIComponent(message);
  window.open(`https://wa.me/${formattedPhone}?text=${encodedMessage}`, "_blank");
}

// Log notification to the new homologacao_notification_logs table
export async function logHomologacaoNotification(
  appointmentId: string,
  clinicId: string,
  channel: "whatsapp" | "email",
  status: "sent" | "pending" | "failed",
  recipientPhone?: string,
  recipientEmail?: string,
  message?: string,
  errorMessage?: string,
  protocolSent?: boolean
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    await supabase.from("homologacao_notification_logs").insert({
      appointment_id: appointmentId,
      clinic_id: clinicId,
      channel,
      recipient_phone: recipientPhone || null,
      recipient_email: recipientEmail || null,
      message: message || null,
      status,
      sent_at: status === "sent" ? new Date().toISOString() : null,
      error_message: errorMessage || null,
      protocol_sent: protocolSent || false,
      created_by: user?.id || null,
    });
  } catch (err) {
    console.error("Failed to log homologacao notification:", err);
  }
}
