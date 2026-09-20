import { supabase } from "@/integrations/supabase/client";

export interface CreateHomologacaoAppointmentInput {
  id?: string;
  clinic_id: string;
  professional_id: string;
  service_type_id?: string | null;
  appointment_date: string;
  start_time: string;
  end_time: string;
  employee_name: string;
  employee_cpf?: string | null;
  employee_phone?: string | null;
  employee_prior_notice_date?: string | null;
  company_name: string;
  company_cnpj?: string | null;
  company_phone?: string;
  company_email?: string | null;
  company_contact_name?: string | null;
  notes?: string | null;
  confirmation_token?: string;
  protocol_number?: string | null;
  employee_whatsapp_consent?: boolean;
  company_whatsapp_consent?: boolean;
}

export interface HomologacaoAppointmentResponse {
  id: string;
  clinic_id: string;
  professional_id: string | null;
  service_type_id: string | null;
  appointment_date: string;
  start_time: string;
  end_time: string;
  employee_name: string;
  employee_cpf: string | null;
  employee_prior_notice_date: string | null;
  company_name: string;
  company_cnpj: string | null;
  company_phone: string;
  company_email: string | null;
  company_contact_name: string | null;
  notes: string | null;
  status: string;
  confirmation_token: string;
  protocol_number: string | null;
  employee_whatsapp_consent: boolean;
  company_whatsapp_consent: boolean;
}

async function extractEdgeErrorMessage(error: unknown): Promise<string> {
  const fallback = "Não foi possível criar o agendamento.";

  if (error instanceof Error) {
    const response = (error as Error & { context?: Response }).context;
    if (response) {
      try {
        const payload = await response.json();
        if (payload?.error === "slot_unavailable") return "Este horário acabou de ser ocupado. Escolha outro.";
        return payload?.details || payload?.error || error.message || fallback;
      } catch {
        return error.message || fallback;
      }
    }

    return error.message || fallback;
  }

  return fallback;
}

export async function createHomologacaoAppointment(input: CreateHomologacaoAppointmentInput) {
  const { data, error } = await supabase.functions.invoke("create-homologacao-appointment", {
    body: input,
  });

  if (error) {
    throw new Error(await extractEdgeErrorMessage(error));
  }

  if (!data?.success || !data?.appointment) {
    throw new Error(data?.details || data?.error || "Não foi possível criar o agendamento.");
  }

  // Record consent evidence if granted
  if (input.employee_whatsapp_consent || input.company_whatsapp_consent) {
    const appointmentId = data.appointment.id;
    const clinicId = input.clinic_id;
    
    const consents = [];
    
    if (input.employee_whatsapp_consent && input.employee_phone) {
      consents.push({
        tenant_id: clinicId,
        phone: input.employee_phone.replace(/\D/g, ""),
        consent_status: "granted",
        purpose: "SERVICE_OPERATIONAL",
        source: "HOMOLOGACAO_BOOKING",
        term_version: "whatsapp_homologacao_v1_2026",
        consent_text: "Autorizo o envio de confirmação e atualizações da homologação por WhatsApp.",
        person_id: appointmentId,
        user_agent: navigator.userAgent
      });
    }
    
    if (input.company_whatsapp_consent && input.company_phone) {
      consents.push({
        tenant_id: clinicId,
        phone: input.company_phone.replace(/\D/g, ""),
        consent_status: "granted",
        purpose: "SERVICE_OPERATIONAL",
        source: "HOMOLOGACAO_BOOKING",
        term_version: "whatsapp_homologacao_v1_2026",
        consent_text: "Autorizo o envio de confirmação e atualizações da homologação por WhatsApp.",
        person_id: appointmentId,
        user_agent: navigator.userAgent
      });
    }
    
    if (consents.length > 0) {
      const { error: consentError } = await supabase.from("whatsapp_consents").insert(consents);
      if (consentError) {
        throw new Error(`Não foi possível registrar o consentimento do WhatsApp: ${consentError.message}`);
      }
    }
  }

  return data.appointment as HomologacaoAppointmentResponse;
}