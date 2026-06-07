import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

type Kind = "confirmed" | "cancelled" | "already" | "expired" | "invalid" | "blocked";
function respond(kind: Kind, title: string, message: string, status = 200, appointment: any = null) {
  return new Response(JSON.stringify({ kind, title, message, appointment }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const token = (url.searchParams.get("t") || "").trim();
    const action = url.searchParams.get("x") === "1" ? "cancel" : "confirm";

    if (!token) {
      return respond("invalid", "Link inválido", "Token não informado.", 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: row, error } = await supabase
      .from("appointment_sms_tokens")
      .select("token, appointment_id, expires_at, confirmed_at, cancelled_at")
      .eq("token", token)
      .maybeSingle();

    if (error || !row) {
      return respond("invalid", "Link inválido", "Não foi possível localizar este agendamento.", 404);
    }

    if (new Date(row.expires_at).getTime() < Date.now()) {
      return respond("expired", "Link expirado", "Entre em contato com a clínica.", 410);
    }

    if (row.confirmed_at || row.cancelled_at) {
      const cancelled = !!row.cancelled_at;
      return respond(
        cancelled ? "cancelled" : "confirmed",
        cancelled ? "Já cancelado" : "Já confirmado",
        `Seu agendamento já foi ${cancelled ? "cancelado" : "confirmado"}.`,
      );
    }

    const { data: appt } = await supabase
      .from("appointments")
      .select("id, status, clinic_id, appointment_date, start_time, end_time, patient:patients(name), professional:professionals(name), clinic:clinics(name, address, phone)")
      .eq("id", row.appointment_id)
      .maybeSingle();

    if (!appt) {
      return respond("invalid", "Agendamento não encontrado", "Entre em contato com a clínica.", 404);
    }

    const apptInfo = {
      date: appt.appointment_date,
      start_time: appt.start_time,
      end_time: (appt as any).end_time ?? null,
      patient_name: (appt as any).patient?.name ?? null,
      professional_name: (appt as any).professional?.name ?? null,
      clinic_name: (appt as any).clinic?.name ?? null,
      clinic_address: (appt as any).clinic?.address ?? null,
      clinic_phone: (appt as any).clinic?.phone ?? null,
    };

    if (["completed", "cancelled", "no_show"].includes(appt.status)) {
      return respond(
        "blocked",
        "Não é possível alterar",
        `Este agendamento já está ${appt.status === "cancelled" ? "cancelado" : "finalizado"}.`,
        409,
        apptInfo,
      );
    }

    const ip = req.headers.get("x-forwarded-for") || "";
    const now = new Date().toISOString();

    if (action === "cancel") {
      await supabase.from("appointments").update({
        status: "cancelled",
        cancelled_at: now,
        cancellation_reason: "Cancelado pelo paciente via SMS",
      }).eq("id", appt.id);

      await supabase.from("appointment_sms_tokens").update({
        cancelled_at: now, action_ip: ip,
      }).eq("token", token);

      return respond(
        "cancelled",
        "Agendamento cancelado",
        "Recebemos sua resposta. Para reagendar, entre em contato com a clínica.",
        200,
        apptInfo,
      );
    }

    await supabase.from("appointments").update({
      status: "confirmed",
      confirmed_at: now,
    }).eq("id", appt.id);

    await supabase.from("appointment_sms_tokens").update({
      confirmed_at: now, action_ip: ip,
    }).eq("token", token);

    return respond(
      "confirmed",
      "Agendamento confirmado!",
      "Obrigado por confirmar. Aguardamos você no horário marcado.",
      200,
      apptInfo,
    );
  } catch (e) {
    console.error("[appointment-action]", e);
    return respond("invalid", "Erro", "Tente novamente em instantes.", 500);
  }
});