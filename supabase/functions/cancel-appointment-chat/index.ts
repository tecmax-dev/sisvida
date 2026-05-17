import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SESSION_TTL_MS = 10 * 60 * 1000;
const ACTION = "cancel";

type CancelState =
  | "CANCEL_WAITING_CPF"
  | "CANCEL_CONFIRM_IDENTITY"
  | "CANCEL_SELECT_APPT"
  | "CANCEL_CONFIRM"
  | "FINISHED";

function validateCpf(cpf: string): boolean {
  const c = cpf.replace(/\D/g, "");
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) s += parseInt(c.charAt(i)) * (10 - i);
  let r = (s * 10) % 11;
  if (r >= 10) r = 0;
  if (r !== parseInt(c.charAt(9))) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += parseInt(c.charAt(i)) * (11 - i);
  r = (s * 10) % 11;
  if (r >= 10) r = 0;
  return r === parseInt(c.charAt(10));
}

function fmtDate(d: string): string {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}
function weekday(d: string): string {
  const dt = new Date(d + "T12:00:00");
  return ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"][dt.getDay()];
}
function fmtTime(t: string): string { return String(t).substring(0, 5); }

async function getOrCreate(
  supabase: SupabaseClient, clinicId: string, phone: string
): Promise<any> {
  // Reset any non-cancel session for this phone (avoid mixing with booking flow)
  // We only manage rows with action_type='cancel' here.
  const { data: existing } = await supabase
    .from("whatsapp_booking_sessions")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("phone", phone)
    .eq("action_type", ACTION)
    .neq("state", "FINISHED")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing && new Date(existing.expires_at) >= new Date()) return existing;
  if (existing) await supabase.from("whatsapp_booking_sessions").delete().eq("id", existing.id);

  const { data: created, error } = await supabase
    .from("whatsapp_booking_sessions")
    .insert({
      clinic_id: clinicId,
      phone,
      state: "CANCEL_WAITING_CPF",
      action_type: ACTION,
      expires_at: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
    })
    .select("*")
    .single();
  if (error) throw error;
  return created;
}

async function update(supabase: SupabaseClient, id: string, updates: Record<string, any>) {
  await supabase
    .from("whatsapp_booking_sessions")
    .update({
      ...updates,
      expires_at: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
}

async function fetchUpcomingForFamily(
  supabase: SupabaseClient,
  clinicId: string,
  patientId: string,
) {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("appointments")
    .select(`
      id, appointment_date, start_time, status, dependent_id,
      professional:professionals(name),
      dependent:patient_dependents(name)
    `)
    .eq("clinic_id", clinicId)
    .eq("patient_id", patientId)
    .in("status", ["scheduled", "confirmed"])
    .gte("appointment_date", today)
    .order("appointment_date", { ascending: true })
    .order("start_time", { ascending: true })
    .limit(10);
  if (error) throw error;
  return (data || []).map((a: any) => ({
    id: a.id,
    date: a.appointment_date,
    time: fmtTime(a.start_time),
    professional_name: a.professional?.name || "Profissional",
    beneficiary: a.dependent?.name || null,
  }));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { clinic_id, phone, message } = await req.json();
    if (!clinic_id || !phone) {
      return new Response(JSON.stringify({ error: "clinic_id and phone are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const session = await getOrCreate(supabase, clinic_id, phone);
    const msg = String(message || "").trim();
    const state: CancelState = session.state;

    console.log(`[cancel-chat] state=${state} msg="${msg}"`);

    const respond = (response: string, st: CancelState) =>
      new Response(JSON.stringify({ response, state: st }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    // Entry prompt
    if (!msg) {
      return respond(
        "Para *cancelar* uma consulta, informe seu CPF (apenas números, 11 dígitos):",
        state,
      );
    }

    // 1) WAITING_CPF
    if (state === "CANCEL_WAITING_CPF") {
      const digits = msg.replace(/\D/g, "");
      if (digits.length !== 11 || !validateCpf(digits)) {
        return respond("CPF inválido. Informe 11 números do CPF do titular.", state);
      }
      const fmt = digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
      const { data: patient } = await supabase
        .from("patients")
        .select("id, name, is_active")
        .eq("clinic_id", clinic_id)
        .or(`cpf.eq.${digits},cpf.eq.${fmt}`)
        .maybeSingle();
      if (!patient) {
        return respond("Não encontrei cadastro com este CPF. Procure o atendimento.", state);
      }
      if (patient.is_active === false) {
        return respond("Cadastro inativo. Procure o atendimento.", state);
      }
      await update(supabase, session.id, {
        state: "CANCEL_CONFIRM_IDENTITY",
        patient_id: patient.id,
        patient_name: patient.name,
      });
      return respond(
        `Encontrei o cadastro: *${patient.name}*\n\n1 - Confirmar\n2 - Não sou eu`,
        "CANCEL_CONFIRM_IDENTITY",
      );
    }

    // 2) CONFIRM IDENTITY
    if (state === "CANCEL_CONFIRM_IDENTITY") {
      if (msg === "2" || /^n(a|ã)o/i.test(msg)) {
        await update(supabase, session.id, {
          state: "CANCEL_WAITING_CPF",
          patient_id: null,
          patient_name: null,
        });
        return respond("Ok, informe novamente o CPF do titular (11 números):", "CANCEL_WAITING_CPF");
      }
      if (msg !== "1" && !/^sim/i.test(msg)) {
        return respond("Responda *1* para confirmar ou *2* para informar outro CPF.", state);
      }

      const list = await fetchUpcomingForFamily(supabase, clinic_id, session.patient_id);
      if (list.length === 0) {
        await update(supabase, session.id, { state: "FINISHED" });
        return respond(
          "Você não possui consultas agendadas. Para marcar uma nova, envie *agendar consulta*.",
          "FINISHED",
        );
      }
      await update(supabase, session.id, {
        state: "CANCEL_SELECT_APPT",
        appointments_list: list,
      });
      const lines = list.map((a: any, i: number) => {
        const who = a.beneficiary ? ` — ${a.beneficiary}` : "";
        return `${i + 1} - ${fmtDate(a.date)} ${weekday(a.date)} ${a.time} • ${a.professional_name}${who}`;
      });
      return respond(
        `Selecione a consulta que deseja *cancelar*:\n\n${lines.join("\n")}`,
        "CANCEL_SELECT_APPT",
      );
    }

    // 3) SELECT APPT
    if (state === "CANCEL_SELECT_APPT") {
      const list: any[] = Array.isArray(session.appointments_list) ? session.appointments_list : [];
      const idx = parseInt(msg, 10) - 1;
      if (!Number.isInteger(idx) || idx < 0 || idx >= list.length) {
        return respond(`Opção inválida. Envie um número entre 1 e ${list.length}.`, state);
      }
      const chosen = list[idx];
      await update(supabase, session.id, {
        state: "CANCEL_CONFIRM",
        selected_appointment_id: chosen.id,
      });
      const who = chosen.beneficiary ? ` para *${chosen.beneficiary}*` : "";
      return respond(
        `Confirma o *cancelamento* da consulta${who} em *${fmtDate(chosen.date)} ${weekday(chosen.date)} às ${chosen.time}* com *${chosen.professional_name}*?\n\n1 - Sim, cancelar\n2 - Não, manter`,
        "CANCEL_CONFIRM",
      );
    }

    // 4) CONFIRM CANCEL
    if (state === "CANCEL_CONFIRM") {
      if (msg === "2" || /^n(a|ã)o/i.test(msg)) {
        await update(supabase, session.id, { state: "FINISHED" });
        return respond("Ok, sua consulta foi *mantida*. ✅", "FINISHED");
      }
      if (msg !== "1" && !/^sim/i.test(msg)) {
        return respond("Responda *1* para confirmar o cancelamento ou *2* para manter.", state);
      }
      const apptId = session.selected_appointment_id;
      if (!apptId) {
        await update(supabase, session.id, { state: "FINISHED" });
        return respond("Não foi possível identificar a consulta. Tente novamente.", "FINISHED");
      }
      const { error: updErr } = await supabase
        .from("appointments")
        .update({ status: "cancelled" })
        .eq("id", apptId)
        .eq("clinic_id", clinic_id)
        .in("status", ["scheduled", "confirmed"]);
      if (updErr) {
        console.error("[cancel-chat] update appt error", updErr);
        await update(supabase, session.id, { state: "FINISHED" });
        return respond(
          "Não foi possível cancelar agora. Tente novamente ou procure o atendimento.",
          "FINISHED",
        );
      }
      await update(supabase, session.id, { state: "FINISHED" });
      return respond(
        "✅ Consulta *cancelada* com sucesso. Para marcar uma nova, envie *agendar consulta*.",
        "FINISHED",
      );
    }

    // Fallback
    await update(supabase, session.id, { state: "FINISHED" });
    return respond("Sessão encerrada. Envie *cancelar consulta* para tentar novamente.", "FINISHED");
  } catch (e) {
    console.error("[cancel-chat] error", e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});