import { supabase } from "@/integrations/supabase/client";

export interface FoundSlot {
  date: string; // YYYY-MM-DD
  time: string; // HH:MM:SS
  professionalId: string;
  professionalName: string;
}

const DAY_KEYS: Record<number, string> = {
  0: "sunday",
  1: "monday",
  2: "tuesday",
  3: "wednesday",
  4: "thursday",
  5: "friday",
  6: "saturday",
};

const toDateStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Gera os horários da agenda do profissional para uma data. */
function scheduleTimesForDate(
  professional: { schedule?: any; appointment_duration?: number | null },
  date: Date,
): string[] {
  const schedule = professional.schedule;
  if (!schedule) return [];

  const dayKey = DAY_KEYS[date.getDay()];
  const dateStr = toDateStr(date);
  const defaultDuration = professional.appointment_duration || 30;
  const blocks = schedule?._blocks as
    | Array<{ days: string[]; start_time: string; end_time: string; duration?: number; start_date?: string; end_date?: string }>
    | undefined;

  const times: string[] = [];

  if (blocks && blocks.length > 0) {
    for (const block of blocks) {
      if (block.start_date && dateStr < block.start_date) continue;
      if (block.end_date && dateStr > block.end_date) continue;
      if (block.days && block.days.length > 0 && !block.days.includes(dayKey)) continue;

      const [sh, sm] = String(block.start_time).split(":").map(Number);
      const [eh, em] = String(block.end_time).split(":").map(Number);
      const interval = block.duration || defaultDuration;
      let cur = sh * 60 + sm;
      const end = eh * 60 + em;
      while (cur < end) {
        times.push(`${String(Math.floor(cur / 60)).padStart(2, "0")}:${String(cur % 60).padStart(2, "0")}`);
        cur += interval;
      }
    }
    return Array.from(new Set(times)).sort();
  }

  const daySchedule = schedule[dayKey];
  if (daySchedule?.enabled && Array.isArray(daySchedule.slots)) {
    for (const s of daySchedule.slots as Array<{ start: string; end: string }>) {
      const [sh, sm] = String(s.start).split(":").map(Number);
      const [eh, em] = String(s.end).split(":").map(Number);
      let cur = sh * 60 + sm;
      const end = eh * 60 + em;
      while (cur < end) {
        times.push(`${String(Math.floor(cur / 60)).padStart(2, "0")}:${String(cur % 60).padStart(2, "0")}`);
        cur += defaultDuration;
      }
    }
  }

  return Array.from(new Set(times)).sort();
}

/**
 * Procura automaticamente a próxima vaga livre do profissional
 * (agenda regular menos agendamentos ativos, bloqueios e feriados).
 */
export async function findNextFreeSlot(params: {
  clinicId: string;
  professionalId: string;
  daysAhead?: number;
  preferredTimes?: string[] | null;
}): Promise<FoundSlot | null> {
  const { clinicId, professionalId, daysAhead = 30, preferredTimes } = params;

  const { data: professional } = await supabase
    .from("professionals")
    .select("id, name, schedule, appointment_duration, is_active")
    .eq("id", professionalId)
    .maybeSingle();

  if (!professional || professional.is_active === false) return null;

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + daysAhead);

  const startStr = toDateStr(start);
  const endStr = toDateStr(end);

  const [{ data: appointments }, { data: slotBlocks }] = await Promise.all([
    supabase
      .from("appointments")
      .select("appointment_date, start_time, end_time, status")
      .eq("clinic_id", clinicId)
      .eq("professional_id", professionalId)
      .gte("appointment_date", startStr)
      .lte("appointment_date", endStr)
      .not("status", "in", "(cancelled,no_show)"),
    supabase
      .from("appointment_slot_blocks")
      .select("block_date, start_time")
      .eq("clinic_id", clinicId)
      .eq("professional_id", professionalId)
      .gte("block_date", startStr)
      .lte("block_date", endStr),
  ]);

  const now = new Date();
  const holidayCache = new Map<string, boolean>();

  for (let i = 0; i <= daysAhead; i++) {
    const day = new Date(start);
    day.setDate(day.getDate() + i);
    const dateStr = toDateStr(day);

    let times = scheduleTimesForDate(professional as any, day);
    if (times.length === 0) continue;

    if (!holidayCache.has(dateStr)) {
      const { data: holiday } = await supabase.rpc("is_holiday", {
        p_clinic_id: clinicId,
        p_date: dateStr,
      });
      holidayCache.set(dateStr, Boolean((holiday as any)?.[0]?.is_holiday));
    }
    if (holidayCache.get(dateStr)) continue;

    const dayAppointments = (appointments || []).filter((a: any) => a.appointment_date === dateStr);
    const dayBlocks = (slotBlocks || []).filter((b: any) => b.block_date === dateStr);

    if (preferredTimes && preferredTimes.length > 0) {
      const prefs = preferredTimes.map((t) => t.slice(0, 5));
      const filtered = times.filter((t) => prefs.includes(t));
      if (filtered.length > 0) times = filtered;
    }

    for (const time of times) {
      const [h, m] = time.split(":").map(Number);
      const slotDate = new Date(day);
      slotDate.setHours(h, m, 0, 0);
      if (slotDate.getTime() <= now.getTime()) continue;

      const slotMinutes = h * 60 + m;

      const busy = dayAppointments.some((apt: any) => {
        const [ash, asm] = String(apt.start_time).slice(0, 5).split(":").map(Number);
        const [aeh, aem] = String(apt.end_time).slice(0, 5).split(":").map(Number);
        return slotMinutes >= ash * 60 + asm && slotMinutes < aeh * 60 + aem;
      });
      if (busy) continue;

      const blocked = dayBlocks.some((b: any) => String(b.start_time).slice(0, 5) === time);
      if (blocked) continue;

      return {
        date: dateStr,
        time: `${time}:00`,
        professionalId,
        professionalName: (professional as any).name,
      };
    }
  }

  return null;
}

/**
 * Confere se um dia/horário específico ainda está livre na agenda do profissional
 * (dentro do expediente, no futuro, sem consulta ativa, bloqueio ou feriado).
 */
export async function isSlotStillFree(params: {
  clinicId: string;
  professionalId: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM[:SS]
}): Promise<boolean> {
  const { clinicId, professionalId, date } = params;
  const time = params.time.slice(0, 5);
  const { data: professional } = await supabase
    .from("professionals")
    .select("id, name, schedule, appointment_duration, is_active")
    .eq("id", professionalId)
    .maybeSingle();
  if (!professional || professional.is_active === false) return false;

  const [y, mo, d] = date.split("-").map(Number);
  const [h, m] = time.split(":").map(Number);
  const day = new Date(y, mo - 1, d, 12, 0, 0);
  const slot = new Date(y, mo - 1, d, h, m, 0);
  if (slot.getTime() <= Date.now()) return false;
  if (!scheduleTimesForDate(professional as any, day).includes(time)) return false;

  const [{ data: holiday }, { data: appts }, { data: blocks }] = await Promise.all([
    supabase.rpc("is_holiday", { p_clinic_id: clinicId, p_date: date }),
    supabase
      .from("appointments")
      .select("start_time, end_time")
      .eq("clinic_id", clinicId)
      .eq("professional_id", professionalId)
      .eq("appointment_date", date)
      .not("status", "in", "(cancelled,no_show)"),
    supabase
      .from("appointment_slot_blocks")
      .select("start_time")
      .eq("clinic_id", clinicId)
      .eq("professional_id", professionalId)
      .eq("block_date", date),
  ]);
  if ((holiday as any)?.[0]?.is_holiday) return false;
  const mins = h * 60 + m;
  const busy = (appts || []).some((a: any) => {
    const [ash, asm] = String(a.start_time).slice(0, 5).split(":").map(Number);
    const [aeh, aem] = String(a.end_time).slice(0, 5).split(":").map(Number);
    return mins >= ash * 60 + asm && mins < aeh * 60 + aem;
  });
  if (busy) return false;
  return !(blocks || []).some((b: any) => String(b.start_time).slice(0, 5) === time);
}
