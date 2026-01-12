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
export function formatReminderMessage(appointment: HomologacaoAppointment): string {
  const date = format(new Date(appointment.appointment_date + "T12:00:00"), "dd/MM/yyyy");
  const time = appointment.start_time?.slice(0, 5) || "";
  
  return `🔔 *Lembrete de Homologação*

Prezado(a),

Este é um lembrete do agendamento de homologação:

📋 *Funcionário:* ${appointment.employee_name}
🏢 *Empresa:* ${appointment.company_name}
📅 *Data:* ${date}
🕐 *Horário:* ${time}
${appointment.professional ? `👤 *Profissional:* ${appointment.professional.name}` : ""}

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

Guarde este protocolo para seus registros.

_Este é um comprovante oficial._`;
}

// Open WhatsApp with message
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
