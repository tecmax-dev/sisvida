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
  employee_prior_notice_date?: string | null;
  company_name: string;
  company_cnpj?: string | null;
  company_phone?: string;
  company_email?: string | null;
  company_contact_name?: string | null;
  notes?: string | null;
  confirmation_token?: string;
  protocol_number?: string | null;
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

  return data.appointment as HomologacaoAppointmentResponse;
}