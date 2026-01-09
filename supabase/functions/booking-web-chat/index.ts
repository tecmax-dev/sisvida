import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type BookingState =
  | "WAITING_CPF"
  | "CONFIRM_IDENTITY"
  | "SELECT_BOOKING_FOR"
  | "SELECT_DEPENDENT"
  | "SELECT_PROFESSIONAL"
  | "SELECT_DATE"
  | "SELECT_TIME"
  | "CONFIRM_APPOINTMENT"
  | "FINISHED";

interface BookingSession {
  id: string;
  clinic_id: string;
  phone: string;
  state: BookingState;
  patient_id: string | null;
  patient_name: string | null;
  selected_professional_id: string | null;
  selected_professional_name: string | null;
  selected_date: string | null;
  selected_time: string | null;
  selected_procedure_id: string | null;
  available_professionals: Array<{ id: string; name: string; specialty: string }> | null;
  available_dates: Array<{ date: string; formatted: string; weekday: string }> | null;
  available_times: Array<{ time: string; formatted: string }> | null;
  available_dependents: Array<{ id: string; name: string; cpf: string }> | null;
  selected_dependent_id: string | null;
  selected_dependent_name: string | null;
  booking_for: "titular" | "dependent" | null;
  expires_at: string;
}

const SESSION_TTL_MS = 10 * 60 * 1000;

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("pt-BR");
}

function getWeekday(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  const weekdays = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  return weekdays[date.getDay()];
}

function formatTime(time: string): string {
  return time.substring(0, 5);
}

function validateCpf(cpf: string): boolean {
  const cleanCpf = cpf.replace(/\D/g, "");
  if (cleanCpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cleanCpf)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cleanCpf.charAt(i)) * (10 - i);
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCpf.charAt(9))) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cleanCpf.charAt(i)) * (11 - i);
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCpf.charAt(10))) return false;

  return true;
}

async function createOrResetSession(
  supabase: SupabaseClient,
  clinicId: string,
  phone: string,
  state: BookingState
): Promise<BookingSession> {
  await supabase.from("whatsapp_booking_sessions").delete().eq("clinic_id", clinicId).eq("phone", phone);

  const { data: session, error } = await supabase
    .from("whatsapp_booking_sessions")
    .insert({
      clinic_id: clinicId,
      phone,
      state,
      expires_at: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
    })
    .select("*")
    .single();

  if (error) throw error;
  return session as BookingSession;
}

async function getOrCreateSession(
  supabase: SupabaseClient,
  clinicId: string,
  phone: string
): Promise<BookingSession> {
  const { data: anySession, error } = await supabase
    .from("whatsapp_booking_sessions")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("phone", phone)
    .neq("state", "FINISHED")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  const isExpired = anySession && new Date(anySession.expires_at) < new Date();
  if (isExpired) {
    await supabase.from("whatsapp_booking_sessions").delete().eq("id", anySession.id);
    return await createOrResetSession(supabase, clinicId, phone, "WAITING_CPF");
  }

  if (anySession) return anySession as BookingSession;
  return await createOrResetSession(supabase, clinicId, phone, "WAITING_CPF");
}

async function updateSession(
  supabase: SupabaseClient,
  sessionId: string,
  updates: Partial<BookingSession>
) {
  const { error } = await supabase
    .from("whatsapp_booking_sessions")
    .update({
      ...updates,
      expires_at: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId);
  if (error) console.error("[booking-web-chat] updateSession error:", error);
}

async function hasAvailableSlotsOnDate(
  supabase: SupabaseClient,
  clinicId: string,
  professionalId: string,
  date: string,
  slots: Array<{ start: string; end: string }>,
  stepMinutes: number,
  currentTimeForToday?: Date | null
): Promise<boolean> {
  const { data: appointments } = await supabase
    .from("appointments")
    .select("start_time")
    .eq("clinic_id", clinicId)
    .eq("professional_id", professionalId)
    .eq("appointment_date", date)
    .in("status", ["scheduled", "confirmed"]);

  const bookedTimes = new Set<string>();
  (appointments || []).forEach((apt: any) => bookedTimes.add(String(apt.start_time).substring(0, 5)));

  const { data: professional } = await supabase
    .from("professionals")
    .select("appointment_duration")
    .eq("id", professionalId)
    .single();

  const duration = (professional as any)?.appointment_duration || 30;

  const minAllowedMinutes = currentTimeForToday
    ? currentTimeForToday.getHours() * 60 + currentTimeForToday.getMinutes() + 30
    : 0;

  for (const slot of slots) {
    const [startH, startM] = slot.start.split(":").map(Number);
    const [endH, endM] = slot.end.split(":").map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    for (let m = startMinutes; m + duration <= endMinutes; m += Math.max(1, stepMinutes)) {
      if (currentTimeForToday && m < minAllowedMinutes) continue;

      const h = Math.floor(m / 60);
      const min = m % 60;
      const timeStr = `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
      if (!bookedTimes.has(timeStr)) return true;
    }
  }

  return false;
}

async function getAvailableDates(
  supabase: SupabaseClient,
  clinicId: string,
  professionalId: string
): Promise<Array<{ date: string; formatted: string; weekday: string }>> {
  const dates: Array<{ date: string; formatted: string; weekday: string }> = [];

  const getBrazilNow = () => {
    const now = new Date();
    const brazilOffset = -3 * 60;
    const utcOffset = now.getTimezoneOffset();
    return new Date(now.getTime() + (utcOffset + brazilOffset) * 60000);
  };

  const dayMap: Record<number, string> = {
    0: "sunday",
    1: "monday",
    2: "tuesday",
    3: "wednesday",
    4: "thursday",
    5: "friday",
    6: "saturday",
  };

  const { data: professional } = await supabase
    .from("professionals")
    .select("schedule, appointment_duration")
    .eq("id", professionalId)
    .single();

  const professionalData = professional as any;
  if (!professionalData?.schedule) return dates;

  const schedule = professionalData.schedule;
  const duration = professionalData.appointment_duration || 30;

  const getSlotsForDate = (dateStr: string, dayKey: string) => {
    if (schedule?._blocks && Array.isArray(schedule._blocks) && schedule._blocks.length > 0) {
      const slots: Array<{ start: string; end: string }> = [];
      let stepMinutes = 5;

      for (const block of schedule._blocks) {
        if (!block?.days?.includes?.(dayKey)) continue;
        if (block.start_date && dateStr < block.start_date) continue;
        if (block.end_date && dateStr > block.end_date) continue;

        if (typeof block.duration === "number") stepMinutes = block.duration;
        if (typeof block.block_interval === "number") stepMinutes = block.block_interval;

        if (block.start_time && block.end_time) {
          slots.push({ start: block.start_time, end: block.end_time });
        }

        if (Array.isArray(block.slots)) {
          for (const s of block.slots) {
            if (s?.start && s?.end) slots.push({ start: s.start, end: s.end });
          }
        }
      }

      if (slots.length === 0) return null;
      return { slots, stepMinutes };
    }

    const daySchedule = schedule?.[dayKey];
    if (!daySchedule?.enabled || !Array.isArray(daySchedule.slots) || daySchedule.slots.length === 0) return null;
    return { slots: daySchedule.slots, stepMinutes: duration };
  };

  const applyExceptionToSlots = async (
    dateStr: string,
    base: { slots: Array<{ start: string; end: string }>; stepMinutes: number } | null
  ) => {
    const { data: exception } = await supabase
      .from("professional_schedule_exceptions")
      .select("is_day_off, start_time, end_time")
      .eq("clinic_id", clinicId)
      .eq("professional_id", professionalId)
      .eq("exception_date", dateStr)
      .maybeSingle();

    const ex = exception as any;
    if (!ex) return base;
    if (ex.is_day_off) return null;
    if (ex.start_time && ex.end_time) {
      return { slots: [{ start: ex.start_time, end: ex.end_time }], stepMinutes: base?.stepMinutes ?? 5 };
    }
    return base;
  };

  const isHolidayDate = async (dateStr: string): Promise<boolean> => {
    const { data, error } = await supabase.rpc("is_holiday", {
      p_clinic_id: clinicId,
      p_date: dateStr,
    });
    if (error) {
      console.error("[booking-web-chat] is_holiday error:", error);
      return false;
    }
    const row = Array.isArray(data) ? data[0] : null;
    return Boolean((row as any)?.is_holiday);
  };

  const brazilNow = getBrazilNow();
  const today = new Date(brazilNow);
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i <= 14 && dates.length < 5; i++) {
    const dateObj = new Date(today);
    dateObj.setDate(dateObj.getDate() + i);

    const dateStr = dateObj.toISOString().split("T")[0];
    const dayKey = dayMap[dateObj.getDay()];

    let scheduleForDay = getSlotsForDate(dateStr, dayKey);
    scheduleForDay = await applyExceptionToSlots(dateStr, scheduleForDay);
    if (!scheduleForDay) continue;

    if (await isHolidayDate(dateStr)) continue;

    if (i === 0) {
      const currentMinutes = brazilNow.getHours() * 60 + brazilNow.getMinutes();
      const minAllowedMinutes = currentMinutes + 30;

      let hasAvailableSlotToday = false;
      for (const slot of scheduleForDay.slots) {
        const [endH, endM] = slot.end.split(":").map(Number);
        const endMinutes = endH * 60 + endM;
        if (endMinutes > minAllowedMinutes + duration) {
          hasAvailableSlotToday = true;
          break;
        }
      }
      if (!hasAvailableSlotToday) continue;
    }

    const hasSlots = await hasAvailableSlotsOnDate(
      supabase,
      clinicId,
      professionalId,
      dateStr,
      scheduleForDay.slots,
      scheduleForDay.stepMinutes,
      i === 0 ? brazilNow : null
    );

    if (hasSlots) {
      dates.push({
        date: dateStr,
        formatted: formatDate(dateStr),
        weekday: getWeekday(dateStr),
      });
    }
  }

  return dates;
}

async function getAvailableTimes(
  supabase: SupabaseClient,
  clinicId: string,
  professionalId: string,
  date: string
): Promise<Array<{ time: string; formatted: string }>> {
  const times: Array<{ time: string; formatted: string }> = [];

  const { data: professional } = await supabase
    .from("professionals")
    .select("schedule, appointment_duration")
    .eq("id", professionalId)
    .single();

  const professionalData = professional as any;
  if (!professionalData?.schedule) return times;

  const schedule = professionalData.schedule;
  const duration = professionalData.appointment_duration || 30;

  const { data: holidayData, error: holidayErr } = await supabase.rpc("is_holiday", {
    p_clinic_id: clinicId,
    p_date: date,
  });
  if (!holidayErr) {
    const row = Array.isArray(holidayData) ? holidayData[0] : null;
    if ((row as any)?.is_holiday) return times;
  }

  const { data: exception } = await supabase
    .from("professional_schedule_exceptions")
    .select("is_day_off, start_time, end_time")
    .eq("clinic_id", clinicId)
    .eq("professional_id", professionalId)
    .eq("exception_date", date)
    .maybeSingle();

  const ex = exception as any;
  if (ex?.is_day_off) return times;

  const dayMap: Record<number, string> = {
    0: "sunday",
    1: "monday",
    2: "tuesday",
    3: "wednesday",
    4: "thursday",
    5: "friday",
    6: "saturday",
  };

  const dateObj = new Date(date + "T00:00:00");
  const dayKey = dayMap[dateObj.getDay()];

  let slots: Array<{ start: string; end: string }> = [];
  let stepMinutes = duration;

  if (schedule?._blocks && Array.isArray(schedule._blocks) && schedule._blocks.length > 0) {
    stepMinutes = 5;

    for (const block of schedule._blocks) {
      if (!block?.days?.includes?.(dayKey)) continue;
      if (block.start_date && date < block.start_date) continue;
      if (block.end_date && date > block.end_date) continue;

      if (typeof block.duration === "number") stepMinutes = block.duration;
      if (typeof block.block_interval === "number") stepMinutes = block.block_interval;

      if (block.start_time && block.end_time) {
        slots.push({ start: block.start_time, end: block.end_time });
      }

      if (Array.isArray(block.slots)) {
        for (const s of block.slots) {
          if (s?.start && s?.end) slots.push({ start: s.start, end: s.end });
        }
      }
    }
  } else {
    const daySchedule = schedule?.[dayKey];
    if (!daySchedule?.enabled || !Array.isArray(daySchedule.slots) || daySchedule.slots.length === 0) return times;
    slots = daySchedule.slots;
  }

  if (ex?.start_time && ex?.end_time) {
    slots = [{ start: ex.start_time, end: ex.end_time }];
  }

  if (!slots.length) return times;

  const { data: appointments } = await supabase
    .from("appointments")
    .select("start_time")
    .eq("clinic_id", clinicId)
    .eq("professional_id", professionalId)
    .eq("appointment_date", date)
    .in("status", ["scheduled", "confirmed"]);

  const bookedTimes = new Set<string>();
  (appointments || []).forEach((apt: any) => bookedTimes.add(String(apt.start_time).substring(0, 5)));

  const now = new Date();
  const brazilOffset = -3 * 60;
  const utcOffset = now.getTimezoneOffset();
  const brazilNow = new Date(now.getTime() + (utcOffset + brazilOffset) * 60000);
  const todayStr = brazilNow.toISOString().split("T")[0];
  const isToday = date === todayStr;
  const currentMinutes = isToday ? brazilNow.getHours() * 60 + brazilNow.getMinutes() : 0;
  const minAllowedMinutes = currentMinutes + 30;

  for (const slot of slots) {
    const [startH, startM] = slot.start.split(":").map(Number);
    const [endH, endM] = slot.end.split(":").map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    for (let m = startMinutes; m + duration <= endMinutes; m += Math.max(1, stepMinutes)) {
      if (isToday && m < minAllowedMinutes) continue;

      const h = Math.floor(m / 60);
      const min = m % 60;
      const timeStr = `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;

      if (!bookedTimes.has(timeStr)) times.push({ time: timeStr, formatted: formatTime(timeStr) });
    }
  }

  return times.slice(0, 10);
}

function numberedList(items: string[]): string {
  return items.map((t, i) => `${i + 1} - ${t}`).join("\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { clinic_id, phone, message } = await req.json();
    if (!clinic_id || !phone) {
      return new Response(JSON.stringify({ error: "clinic_id and phone are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const session = await getOrCreateSession(supabase, clinic_id, phone);
    const msg = String(message || "").trim();

    console.log(`[booking-web-chat] state=${session.state} msg="${msg}"`);

    // Entry prompt (when called with empty message)
    if (!msg) {
      return new Response(
        JSON.stringify({
          response: "Para agendar sua consulta, informe seu CPF ou número da carteirinha (apenas números):",
          state: session.state,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1) WAITING_CPF
    if (session.state === "WAITING_CPF") {
      // Check if input contains card prefix (e.g., SECMI-000001)
      const cardPrefixMatch = msg.toUpperCase().match(/^([A-Z]+-)?(\d{5,10})$/);
      let numbersOnly = msg.replace(/\D/g, "");
      
      // If card format with prefix, extract just the digits
      if (cardPrefixMatch) {
        numbersOnly = cardPrefixMatch[2];
        console.log(`[booking-web-chat] Card format detected: ${msg} -> digits: ${numbersOnly}`);
      }
      
      // If 5-10 digits, treat as card number
      if (numbersOnly.length >= 5 && numbersOnly.length <= 10) {
        console.log(`[booking-web-chat] Searching by card number: ${numbersOnly}`);
        
        // Search in patient_cards (titulares)
        const { data: patientCard } = await supabase
          .from("patient_cards")
          .select("patient_id, expires_at, is_active, card_number")
          .eq("clinic_id", clinic_id)
          .eq("is_active", true)
          .or(`card_number.ilike.%${numbersOnly},card_number.ilike.%-${numbersOnly}`)
          .maybeSingle();
        
        if (patientCard) {
          // Check if card is expired
          if (patientCard.expires_at && new Date(patientCard.expires_at) < new Date()) {
            const expDate = new Date(patientCard.expires_at).toLocaleDateString("pt-BR");
            return new Response(
              JSON.stringify({
                response: `Sua carteirinha (${patientCard.card_number}) expirou em ${expDate}. Por favor, renove para poder agendar.`,
                state: session.state,
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          
          // Get patient data
          const { data: patient } = await supabase
            .from("patients")
            .select("id, name, is_active, no_show_blocked_until, no_show_unblocked_at")
            .eq("id", patientCard.patient_id)
            .maybeSingle();
          
          if (!patient || patient.is_active === false) {
            return new Response(
              JSON.stringify({
                response: "Cadastro inativo. Por favor, procure o atendimento para regularizar.",
                state: session.state,
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          
          // Check no-show block
          const today = new Date().toISOString().split("T")[0];
          if (patient.no_show_blocked_until && patient.no_show_blocked_until >= today && !patient.no_show_unblocked_at) {
            const blockDate = new Date(patient.no_show_blocked_until + "T00:00:00");
            const formattedBlockDate = blockDate.toLocaleDateString("pt-BR");
            return new Response(
              JSON.stringify({
                response: `Seu cadastro está bloqueado para novos agendamentos até ${formattedBlockDate} devido a não comparecimento anterior.`,
                state: session.state,
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          
          await updateSession(supabase, session.id, {
            state: "CONFIRM_IDENTITY",
            patient_id: patient.id,
            patient_name: patient.name,
          });
          
          return new Response(
            JSON.stringify({
              response: `Encontrei o cadastro: *${patient.name}*\n\n1 - Confirmar\n2 - Não sou eu`,
              state: "CONFIRM_IDENTITY",
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        // Search in patient_dependents
        const { data: dependent } = await supabase
          .from("patient_dependents")
          .select("id, name, patient_id, card_number, card_expires_at")
          .eq("clinic_id", clinic_id)
          .eq("is_active", true)
          .or(`card_number.ilike.%${numbersOnly},card_number.ilike.%-${numbersOnly}`)
          .maybeSingle();
        
        if (dependent) {
          // Check if dependent card is expired
          if (dependent.card_expires_at && new Date(dependent.card_expires_at) < new Date()) {
            const expDate = new Date(dependent.card_expires_at).toLocaleDateString("pt-BR");
            return new Response(
              JSON.stringify({
                response: `A carteirinha do dependente (${dependent.card_number}) expirou em ${expDate}. Por favor, renove para poder agendar.`,
                state: session.state,
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          
          // Get titular patient data
          const { data: titularPatient } = await supabase
            .from("patients")
            .select("id, name, is_active")
            .eq("id", dependent.patient_id)
            .maybeSingle();
          
          if (!titularPatient || titularPatient.is_active === false) {
            return new Response(
              JSON.stringify({
                response: "Cadastro do titular inativo. Por favor, procure o atendimento para regularizar.",
                state: session.state,
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          
          await updateSession(supabase, session.id, {
            state: "CONFIRM_IDENTITY",
            patient_id: titularPatient.id,
            patient_name: titularPatient.name,
            selected_dependent_id: dependent.id,
            selected_dependent_name: dependent.name,
            booking_for: "dependent",
          });
          
          return new Response(
            JSON.stringify({
              response: `Encontrei o cadastro do dependente: *${dependent.name}*\n\n1 - Confirmar\n2 - Não sou eu`,
              state: "CONFIRM_IDENTITY",
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        // Card not found
        return new Response(
          JSON.stringify({
            response: "Carteirinha não encontrada. Verifique o número ou informe seu CPF (11 números).",
            state: session.state,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // If exactly 11 digits, treat as CPF
      if (numbersOnly.length !== 11 || !validateCpf(numbersOnly)) {
        return new Response(
          JSON.stringify({
            response: "Entrada inválida. Por favor, informe:\n• CPF: 11 números\n• Carteirinha: apenas os números da carteirinha",
            state: session.state,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const cpf = numbersOnly;
      const formattedCpf = cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
      
      const { data: patient } = await supabase
        .from("patients")
        .select("id, name, is_active, no_show_blocked_until, no_show_unblocked_at")
        .eq("clinic_id", clinic_id)
        .or(`cpf.eq.${cpf},cpf.eq.${formattedCpf}`)
        .maybeSingle();

      if (!patient) {
        return new Response(
          JSON.stringify({
            response: "Não encontrei seu cadastro. Para agendar, é necessário estar cadastrado no sistema. Procure o atendimento do sindicato.",
            state: session.state,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verificar se paciente está ativo
      if (patient.is_active === false) {
        return new Response(
          JSON.stringify({
            response: "Seu cadastro está inativo. Por favor, procure o atendimento do sindicato para regularizar.",
            state: session.state,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verificar bloqueio por no-show
      const today = new Date().toISOString().split("T")[0];
      if (patient.no_show_blocked_until && patient.no_show_blocked_until >= today && !patient.no_show_unblocked_at) {
        const blockDate = new Date(patient.no_show_blocked_until + "T00:00:00");
        const formattedBlockDate = blockDate.toLocaleDateString("pt-BR");
        return new Response(
          JSON.stringify({
            response: `Seu cadastro está bloqueado para novos agendamentos até ${formattedBlockDate} devido a não comparecimento anterior. Para liberação, procure o atendimento do sindicato.`,
            state: session.state,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verificar carteirinha válida
      const { data: cardData } = await supabase.rpc("is_patient_card_valid", {
        p_patient_id: patient.id,
        p_clinic_id: clinic_id,
      });
      const cardRow = Array.isArray(cardData) ? cardData[0] : cardData;
      if (cardRow?.card_number && cardRow.is_valid === false) {
        const expDate = new Date(cardRow.expires_at);
        const formattedExpDate = expDate.toLocaleDateString("pt-BR");
        return new Response(
          JSON.stringify({
            response: `Sua carteirinha (${cardRow.card_number}) expirou em ${formattedExpDate}. Por favor, renove para poder agendar.`,
            state: session.state,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await updateSession(supabase, session.id, {
        state: "CONFIRM_IDENTITY",
        patient_id: patient.id,
        patient_name: patient.name,
      });

      return new Response(
        JSON.stringify({
          response: `Encontrei o cadastro: *${patient.name}*\n\n1 - Confirmar\n2 - Não sou eu`,
          state: "CONFIRM_IDENTITY",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2) CONFIRM_IDENTITY
    if (session.state === "CONFIRM_IDENTITY") {
      if (msg === "1" || /^sim/i.test(msg)) {
        // Check if patient has active dependents
        const { data: dependents } = await supabase
          .from("patient_dependents")
          .select("id, name, cpf")
          .eq("patient_id", session.patient_id)
          .eq("is_active", true)
          .order("name", { ascending: true });

        const activeDependents = (dependents || []).map((d: any) => ({
          id: d.id,
          name: d.name,
          cpf: d.cpf,
        }));

        if (activeDependents.length > 0) {
          // Has dependents - ask who the appointment is for
          await updateSession(supabase, session.id, {
            state: "SELECT_BOOKING_FOR",
            available_dependents: activeDependents,
          });

          return new Response(
            JSON.stringify({
              response: `Para quem é o agendamento?\n\n1 - Para mim (*${session.patient_name}*)\n2 - Para um dependente`,
              state: "SELECT_BOOKING_FOR",
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // No dependents - go directly to professional selection
        const { data: pros, error } = await supabase
          .from("professionals")
          .select("id, name, specialty")
          .eq("clinic_id", clinic_id)
          .eq("is_active", true)
          .order("name", { ascending: true });

        if (error) throw error;

        const professionals = (pros || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          specialty: p.specialty || "Não informada",
        }));

        if (!professionals.length) {
          return new Response(
            JSON.stringify({
              response: "No momento não há profissionais disponíveis para agendamento.",
              state: "CONFIRM_IDENTITY",
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        await updateSession(supabase, session.id, {
          state: "SELECT_PROFESSIONAL",
          available_professionals: professionals,
          booking_for: "titular",
        });

        return new Response(
          JSON.stringify({
            response: `Perfeito. Com qual profissional você quer agendar?\n\n${numberedList(
              professionals.map((p) => `${p.name} (${p.specialty})`)
            )}`,
            state: "SELECT_PROFESSIONAL",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Not confirmed
      await createOrResetSession(supabase, clinic_id, phone, "WAITING_CPF");
      return new Response(
        JSON.stringify({
          response: "Sem problemas. Informe novamente o CPF do titular (11 números):",
          state: "WAITING_CPF",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2.1) SELECT_BOOKING_FOR - Choose between titular or dependent
    if (session.state === "SELECT_BOOKING_FOR") {
      if (msg === "1") {
        // Booking for titular
        const { data: pros, error } = await supabase
          .from("professionals")
          .select("id, name, specialty")
          .eq("clinic_id", clinic_id)
          .eq("is_active", true)
          .order("name", { ascending: true });

        if (error) throw error;

        const professionals = (pros || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          specialty: p.specialty || "Não informada",
        }));

        if (!professionals.length) {
          return new Response(
            JSON.stringify({
              response: "No momento não há profissionais disponíveis para agendamento.",
              state: "SELECT_BOOKING_FOR",
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        await updateSession(supabase, session.id, {
          state: "SELECT_PROFESSIONAL",
          available_professionals: professionals,
          booking_for: "titular",
          selected_dependent_id: null,
          selected_dependent_name: null,
        });

        return new Response(
          JSON.stringify({
            response: `Agendando para *${session.patient_name}*.\n\nCom qual profissional você quer agendar?\n\n${numberedList(
              professionals.map((p) => `${p.name} (${p.specialty})`)
            )}`,
            state: "SELECT_PROFESSIONAL",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (msg === "2") {
        // Booking for dependent - show list
        const dependents = session.available_dependents || [];
        
        if (!dependents.length) {
          return new Response(
            JSON.stringify({
              response: "Não encontrei dependentes ativos no seu cadastro. O agendamento será para você.",
              state: "SELECT_BOOKING_FOR",
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        await updateSession(supabase, session.id, {
          state: "SELECT_DEPENDENT",
        });

        return new Response(
          JSON.stringify({
            response: `Escolha o dependente:\n\n${numberedList(dependents.map((d: any) => d.name))}`,
            state: "SELECT_DEPENDENT",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          response: "Opção inválida. Escolha 1 ou 2.",
          state: session.state,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2.2) SELECT_DEPENDENT - Choose which dependent
    if (session.state === "SELECT_DEPENDENT") {
      const dependents = session.available_dependents || [];
      const choice = parseInt(msg, 10);
      
      if (isNaN(choice) || choice < 1 || choice > dependents.length) {
        return new Response(
          JSON.stringify({
            response: `Opção inválida. Escolha um número de 1 a ${dependents.length}.`,
            state: session.state,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const selectedDependent = dependents[choice - 1];

      // Get professionals
      const { data: pros, error } = await supabase
        .from("professionals")
        .select("id, name, specialty")
        .eq("clinic_id", clinic_id)
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (error) throw error;

      const professionals = (pros || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        specialty: p.specialty || "Não informada",
      }));

      if (!professionals.length) {
        return new Response(
          JSON.stringify({
            response: "No momento não há profissionais disponíveis para agendamento.",
            state: "SELECT_DEPENDENT",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await updateSession(supabase, session.id, {
        state: "SELECT_PROFESSIONAL",
        available_professionals: professionals,
        booking_for: "dependent",
        selected_dependent_id: selectedDependent.id,
        selected_dependent_name: selectedDependent.name,
      });

      return new Response(
        JSON.stringify({
          response: `Agendando para *${selectedDependent.name}*.\n\nCom qual profissional você quer agendar?\n\n${numberedList(
            professionals.map((p) => `${p.name} (${p.specialty})`)
          )}`,
          state: "SELECT_PROFESSIONAL",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3) SELECT_PROFESSIONAL
    if (session.state === "SELECT_PROFESSIONAL") {
      const professionals = session.available_professionals || [];
      const choice = parseInt(msg, 10);
      if (isNaN(choice) || choice < 1 || choice > professionals.length) {
        return new Response(
          JSON.stringify({
            response: `Opção inválida. Escolha um número de 1 a ${professionals.length}.`,
            state: session.state,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const selected = professionals[choice - 1];
      const dates = await getAvailableDates(supabase, clinic_id, selected.id);
      if (!dates.length) {
        return new Response(
          JSON.stringify({
            response: `Não encontrei datas disponíveis para *${selected.name}*. Escolha outro profissional.`,
            state: session.state,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await updateSession(supabase, session.id, {
        state: "SELECT_DATE",
        selected_professional_id: selected.id,
        selected_professional_name: selected.name,
        available_dates: dates,
      });

      return new Response(
        JSON.stringify({
          response: `✅ Selecionado: *${selected.name}*\n\nAgora escolha a data:\n\n${numberedList(
            dates.map((d) => `${d.formatted} (${d.weekday})`)
          )}`,
          state: "SELECT_DATE",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4) SELECT_DATE
    if (session.state === "SELECT_DATE") {
      const dates = session.available_dates || [];
      const choice = parseInt(msg, 10);
      if (isNaN(choice) || choice < 1 || choice > dates.length) {
        return new Response(
          JSON.stringify({
            response: `Opção inválida. Escolha um número de 1 a ${dates.length}.`,
            state: session.state,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const selectedDate = dates[choice - 1];
      const professionalId = session.selected_professional_id;
      if (!professionalId) {
        await createOrResetSession(supabase, clinic_id, phone, "WAITING_CPF");
        return new Response(
          JSON.stringify({
            response: "Ops, perdi o contexto. Vamos recomeçar: informe seu CPF (11 números).",
            state: "WAITING_CPF",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const times = await getAvailableTimes(supabase, clinic_id, professionalId, selectedDate.date);
      if (!times.length) {
        return new Response(
          JSON.stringify({
            response: `Não há horários disponíveis em ${selectedDate.formatted}. Escolha outra data.`,
            state: session.state,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await updateSession(supabase, session.id, {
        state: "SELECT_TIME",
        selected_date: selectedDate.date,
        available_times: times,
      });

      return new Response(
        JSON.stringify({
          response: `Agora escolha o horário para *${session.selected_professional_name}* em *${selectedDate.formatted}*:\n\n${numberedList(
            times.map((t) => t.formatted)
          )}`,
          state: "SELECT_TIME",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5) SELECT_TIME
    if (session.state === "SELECT_TIME") {
      const times = session.available_times || [];
      const choice = parseInt(msg, 10);
      if (isNaN(choice) || choice < 1 || choice > times.length) {
        return new Response(
          JSON.stringify({
            response: `Opção inválida. Escolha um número de 1 a ${times.length}.`,
            state: session.state,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const selectedTime = times[choice - 1];

      await updateSession(supabase, session.id, {
        state: "CONFIRM_APPOINTMENT",
        selected_time: selectedTime.time,
      });

      // Build confirmation message with dependent name if applicable
      const bookingForName = session.booking_for === "dependent" && session.selected_dependent_name
        ? session.selected_dependent_name
        : session.patient_name;

      return new Response(
        JSON.stringify({
          response: `Confirma o agendamento?\n\nPaciente: *${bookingForName}*\nProfissional: *${session.selected_professional_name}*\nData: *${formatDate(session.selected_date!)}*\nHorário: *${selectedTime.formatted}*\n\n1 - Confirmar\n2 - Cancelar`,
          state: "CONFIRM_APPOINTMENT",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6) CONFIRM_APPOINTMENT - Create real appointment
    if (session.state === "CONFIRM_APPOINTMENT") {
      if (msg === "1" || /^sim/i.test(msg)) {
        const patientId = session.patient_id;
        const professionalId = session.selected_professional_id;
        const appointmentDate = session.selected_date;
        const startTime = session.selected_time;

        if (!patientId || !professionalId || !appointmentDate || !startTime) {
          await createOrResetSession(supabase, clinic_id, phone, "WAITING_CPF");
          return new Response(
            JSON.stringify({
              response: "Ops, perdi o contexto. Vamos recomeçar: informe seu CPF (11 números).",
              state: "WAITING_CPF",
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Get professional's appointment duration
        const { data: proData } = await supabase
          .from("professionals")
          .select("appointment_duration")
          .eq("id", professionalId)
          .single();
        const duration = (proData as any)?.appointment_duration || 30;

        // Calculate end time
        const [h, m] = startTime.split(":").map(Number);
        const endMinutes = h * 60 + m + duration;
        const endH = Math.floor(endMinutes / 60);
        const endM = endMinutes % 60;
        const endTime = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}:00`;

        // Create the appointment - database triggers will validate all rules
        // Include dependent_id if booking is for a dependent
        const appointmentData: any = {
          clinic_id: clinic_id,
          patient_id: patientId,
          professional_id: professionalId,
          appointment_date: appointmentDate,
          start_time: startTime + ":00",
          end_time: endTime,
          duration_minutes: duration,
          status: "scheduled",
          type: "primeira-consulta",
        };

        // Add dependent_id if booking for dependent
        if (session.booking_for === "dependent" && session.selected_dependent_id) {
          appointmentData.dependent_id = session.selected_dependent_id;
        }

        const { data: appointment, error: insertError } = await supabase
          .from("appointments")
          .insert(appointmentData)
          .select("id")
          .single();

        if (insertError) {
          console.error("[booking-web-chat] Insert error:", insertError);
          
          // Parse specific error messages from database triggers
          const errMsg = insertError.message || "";
          
          if (errMsg.includes("LIMITE_AGENDAMENTO_CPF")) {
            await updateSession(supabase, session.id, { state: "FINISHED" });
            return new Response(
              JSON.stringify({
                response: "❌ Você já atingiu o limite de agendamentos com este profissional neste mês.",
                state: "FINISHED",
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          if (errMsg.includes("LIMITE_AGENDAMENTO_DEPENDENTE")) {
            const depName = session.selected_dependent_name || "O dependente";
            await updateSession(supabase, session.id, { state: "FINISHED" });
            return new Response(
              JSON.stringify({
                response: `❌ ${depName} já atingiu o limite de agendamentos com este profissional neste mês.`,
                state: "FINISHED",
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          
          if (errMsg.includes("CARTEIRINHA_VENCIDA")) {
            await updateSession(supabase, session.id, { state: "FINISHED" });
            return new Response(
              JSON.stringify({
                response: "❌ Sua carteirinha está vencida. Renove para poder agendar.",
                state: "FINISHED",
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          
          if (errMsg.includes("HORARIO_INVALIDO")) {
            await updateSession(supabase, session.id, { state: "FINISHED" });
            return new Response(
              JSON.stringify({
                response: "❌ Este horário não está mais disponível. Por favor, tente novamente.",
                state: "FINISHED",
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          
          if (errMsg.includes("FERIADO")) {
            await updateSession(supabase, session.id, { state: "FINISHED" });
            return new Response(
              JSON.stringify({
                response: "❌ Esta data é feriado e não há atendimento.",
                state: "FINISHED",
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          
          if (errMsg.includes("PACIENTE_BLOQUEADO")) {
            await updateSession(supabase, session.id, { state: "FINISHED" });
            return new Response(
              JSON.stringify({
                response: "❌ Seu cadastro está bloqueado devido a não comparecimento anterior.",
                state: "FINISHED",
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          // Generic error
          return new Response(
            JSON.stringify({
              response: "❌ Não foi possível criar o agendamento. Tente novamente ou procure o atendimento.",
              state: "FINISHED",
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        await updateSession(supabase, session.id, { state: "FINISHED" });
        
        // Build success message with patient name
        const bookingForName = session.booking_for === "dependent" && session.selected_dependent_name
          ? session.selected_dependent_name
          : session.patient_name;

        return new Response(
          JSON.stringify({
            response: `✅ Agendamento confirmado!\n\nPaciente: *${bookingForName}*\nProfissional: *${session.selected_professional_name}*\nData: *${formatDate(appointmentDate)}*\nHorário: *${formatTime(startTime)}*\n\nCompareça com 10 minutos de antecedência.`,
            state: "FINISHED",
            booking_complete: true,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await createOrResetSession(supabase, clinic_id, phone, "WAITING_CPF");
      return new Response(
        JSON.stringify({
          response: "Ok, cancelado. Se quiser tentar novamente, informe seu CPF.",
          state: "WAITING_CPF",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Default fallback
    await createOrResetSession(supabase, clinic_id, phone, "WAITING_CPF");
    return new Response(
      JSON.stringify({
        response: "Vamos recomeçar. Informe seu CPF (11 números):",
        state: "WAITING_CPF",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[booking-web-chat] Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
        response: "Desculpe, ocorreu um erro no agendamento. Tente novamente.",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
