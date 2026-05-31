import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, cache-control, pragma, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const jsonHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json",
  "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate",
};

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const timeRegex = /^\d{2}:\d{2}$/;

function errorResponse(error: string, status = 200) {
  return new Response(JSON.stringify({ success: false, error }), {
    status,
    headers: jsonHeaders,
  });
}

function calculateEndTime(time: string, durationMinutes: number) {
  const [hours, minutes] = time.split(":").map(Number);
  const date = new Date(2000, 0, 1, hours, minutes, 0, 0);
  date.setMinutes(date.getMinutes() + durationMinutes);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function mapAppointmentError(message: string) {
  if (message.includes("LIMITE_AGENDAMENTO_DEPENDENTE")) {
    return "Limite de agendamentos de dependentes atingido para este profissional neste período.";
  }

  if (message.includes("LIMITE_AGENDAMENTO_CPF")) {
    return "Você já possui agendamento para este profissional neste mês.";
  }

  if (message.includes("booking_window_exceeded") || message.includes("Agendamento indisponível")) {
    return "Agendamento indisponível para este período.";
  }

  if (message.includes("HORARIO_BLOQUEADO")) {
    return "Este horário foi bloqueado na agenda e não está mais disponível.";
  }

  if (message.includes("HORARIO_INVALIDO")) {
    const match = message.match(/HORARIO_INVALIDO:\s*(.+)/);
    return match ? match[1].trim() : "O profissional não atende neste horário.";
  }

  if (message.includes("FERIADO")) {
    const match = message.match(/FERIADO:\s*(.+)/);
    return match ? match[1].trim() : "Não é possível agendar nesta data.";
  }

  if (message.includes("CARTEIRINHA_DEPENDENTE_VENCIDA")) {
    const match = message.match(/CARTEIRINHA_DEPENDENTE_VENCIDA:\s*(.+)/);
    return match ? match[1].trim() : "A carteirinha do dependente está vencida.";
  }

  if (message.includes("CARTEIRINHA_VENCIDA")) {
    const match = message.match(/CARTEIRINHA_VENCIDA:\s*(.+)/);
    return match ? match[1].trim() : "Sua carteirinha está vencida.";
  }

  if (message.includes("PACIENTE_BLOQUEADO_NO_SHOW")) {
    const match = message.match(/PACIENTE_BLOQUEADO_NO_SHOW:\s*(.+)/);
    return match ? match[1].trim() : "Paciente bloqueado por não comparecimento.";
  }

  if (message.includes("DEPENDENTE_INVALIDO")) {
    const match = message.match(/DEPENDENTE_INVALIDO:\s*(.+)/);
    return match ? match[1].trim() : "Dependente inválido.";
  }

  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));

    const clinicId = String(body?.clinicId || "").trim();
    const patientId = String(body?.patientId || "").trim();
    const professionalId = String(body?.professionalId || "").trim();
    const dependentId = body?.dependentId ? String(body.dependentId).trim() : null;
    const date = String(body?.date || "").trim();
    const time = String(body?.time || "").trim();
    const type = String(body?.type || "first_visit").trim();
    const durationMinutes = Number(body?.durationMinutes || 0);

    if (!uuidRegex.test(clinicId)) return errorResponse("Clínica inválida", 400);
    if (!uuidRegex.test(patientId)) return errorResponse("Paciente inválido", 400);
    if (!uuidRegex.test(professionalId)) return errorResponse("Profissional inválido", 400);
    if (dependentId && !uuidRegex.test(dependentId)) return errorResponse("Dependente inválido", 400);
    if (!dateRegex.test(date)) return errorResponse("Data inválida", 400);
    if (!timeRegex.test(time)) return errorResponse("Horário inválido", 400);
    if (!Number.isFinite(durationMinutes) || durationMinutes < 5 || durationMinutes > 480) {
      return errorResponse("Duração inválida", 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const [{ data: patient, error: patientError }, { data: professional, error: professionalError }] = await Promise.all([
      supabase
        .from("patients")
        .select("id, clinic_id, is_active, gender")
        .eq("id", patientId)
        .maybeSingle(),
      supabase
        .from("professionals")
        .select("id, clinic_id, is_active, name")
        .eq("id", professionalId)
        .maybeSingle(),
    ]);

    if (patientError || !patient || patient.clinic_id !== clinicId || patient.is_active === false) {
      return errorResponse("Paciente inválido ou inativo.");
    }

    if (professionalError || !professional || professional.clinic_id !== clinicId || professional.is_active === false) {
      return errorResponse("Profissional indisponível.");
    }

    // Regra Daniela Sales: a restrição "somente mulheres" vale apenas para o
    // serviço de Massoterapia. Como Daniela também atende outros procedimentos
    // abertos a homens e o fluxo mobile não captura o tipo de serviço, NÃO
    // bloqueamos no servidor — a confirmação fica no cliente (UI).

    if (dependentId) {
      const { data: dependent, error: dependentError } = await supabase
        .from("patient_dependents")
        .select("id, patient_id, clinic_id, is_active, pending_approval, name")
        .eq("id", dependentId)
        .maybeSingle();

      if (
        dependentError ||
        !dependent ||
        dependent.patient_id !== patientId ||
        dependent.clinic_id !== clinicId ||
        dependent.is_active === false
      ) {
        return errorResponse("Dependente inválido.");
      }

      if (dependent.pending_approval) {
        return errorResponse(`O cadastro de ${dependent.name} ainda está aguardando aprovação.`);
      }
    }

    const endTime = calculateEndTime(time, durationMinutes);

    const [{ data: existingAppointments, error: existingAppointmentsError }, { data: slotBlocks, error: slotBlocksError }] = await Promise.all([
      supabase
        .from("appointments")
        .select("id, start_time, end_time")
        .eq("clinic_id", clinicId)
        .eq("professional_id", professionalId)
        .eq("appointment_date", date)
        .in("status", ["scheduled", "confirmed", "in_progress", "arrived"])
        .lt("start_time", endTime)
        .gt("end_time", time),
      supabase
        .from("appointment_slot_blocks")
        .select("id, start_time, end_time")
        .eq("clinic_id", clinicId)
        .eq("professional_id", professionalId)
        .eq("block_date", date)
        .lt("start_time", endTime)
        .gt("end_time", time),
    ]);

    if (existingAppointmentsError || slotBlocksError) {
      console.error("[mobile-create-booking] Error checking conflicts/blocks:", existingAppointmentsError || slotBlocksError);
      return errorResponse("Não foi possível validar o horário. Tente novamente.", 500);
    }

    if (existingAppointments && existingAppointments.length > 0) {
      return errorResponse("Este horário já está ocupado. Por favor, escolha outro horário.");
    }

    if (slotBlocks && slotBlocks.length > 0) {
      return errorResponse("Este horário foi bloqueado na agenda e não está mais disponível.");
    }

    const { data: appointment, error: appointmentError } = await supabase
      .from("appointments")
      .insert({
        clinic_id: clinicId,
        patient_id: patientId,
        professional_id: professionalId,
        dependent_id: dependentId,
        appointment_date: date,
        start_time: time,
        end_time: endTime,
        duration_minutes: durationMinutes,
        type,
        status: "scheduled",
      })
      .select("id")
      .single();

    if (appointmentError) {
      console.error("[mobile-create-booking] Error creating appointment:", appointmentError);

      const message = appointmentError.message || "";
      const friendlyMessage = mapAppointmentError(message);
      if (friendlyMessage) return errorResponse(friendlyMessage);

      return errorResponse("Não foi possível realizar o agendamento.", 500);
    }

    return new Response(JSON.stringify({ success: true, appointmentId: appointment.id }), {
      headers: jsonHeaders,
    });
  } catch (err) {
    console.error("[mobile-create-booking] Error:", err);
    return errorResponse("Erro interno ao criar agendamento.", 500);
  }
});