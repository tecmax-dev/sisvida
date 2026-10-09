// Calcula as vagas livres de um profissional (agenda - consultas ativas - bloqueios - feriados).
// Espelha src/lib/waitingListNextSlot.ts, com horário de Brasília (UTC-3).

const DAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const pad = (n: number) => String(n).padStart(2, "0");
const toMin = (t: string) => { const [h, m] = String(t).slice(0, 5).split(":").map(Number); return h * 60 + m; };
const fromMin = (n: number) => `${pad(Math.floor(n / 60))}:${pad(n % 60)}`;

export interface FreeSlot { date: string; time: string; end: string }

/** Data/hora atual em Brasília. */
export function brNow() {
  const d = new Date(Date.now() - 3 * 3600_000);
  return { date: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`, minutes: d.getUTCHours() * 60 + d.getUTCMinutes() };
}

function addDays(date: string, n: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function scheduleSlots(prof: any, date: string): Array<{ start: number; dur: number }> {
  const schedule = prof?.schedule;
  if (!schedule) return [];
  const dayKey = DAY_KEYS[new Date(`${date}T12:00:00Z`).getUTCDay()];
  const def = prof.appointment_duration || 30;
  const out = new Map<number, number>();
  const blocks = schedule._blocks as any[] | undefined;
  if (blocks && blocks.length > 0) {
    for (const b of blocks) {
      if (b.start_date && date < b.start_date) continue;
      if (b.end_date && date > b.end_date) continue;
      if (b.days?.length && !b.days.includes(dayKey)) continue;
      const dur = b.duration || def;
      for (let c = toMin(b.start_time); c < toMin(b.end_time); c += dur) out.set(c, dur);
    }
  } else {
    const ds = schedule[dayKey];
    if (ds?.enabled && Array.isArray(ds.slots)) {
      for (const s of ds.slots) for (let c = toMin(s.start); c < toMin(s.end); c += def) out.set(c, def);
    }
  }
  return [...out.entries()].sort((a, b) => a[0] - b[0]).map(([start, dur]) => ({ start, dur }));
}

export async function listFreeSlots(admin: any, clinicId: string, professionalId: string, daysAhead = 15, freed?: { date: string; time: string } | null): Promise<FreeSlot[]> {
  const { data: prof } = await admin.from("professionals")
    .select("id, schedule, appointment_duration, is_active").eq("id", professionalId).maybeSingle();
  if (!prof || prof.is_active === false) return [];
  const now = brNow();
  const endDate = addDays(now.date, daysAhead);
  const [{ data: appts }, { data: blocks }] = await Promise.all([
    admin.from("appointments").select("appointment_date, start_time, end_time")
      .eq("clinic_id", clinicId).eq("professional_id", professionalId)
      .gte("appointment_date", now.date).lte("appointment_date", endDate)
      .not("status", "in", "(cancelled,no_show)"),
    admin.from("appointment_slot_blocks").select("block_date, start_time")
      .eq("clinic_id", clinicId).eq("professional_id", professionalId)
      .gte("block_date", now.date).lte("block_date", endDate),
  ]);
  const result: FreeSlot[] = [];
  for (let i = 0; i <= daysAhead; i++) {
    const date = addDays(now.date, i);
    const slots = scheduleSlots(prof, date);
    if (!slots.length) continue;
    const { data: hol } = await admin.rpc("is_holiday", { p_clinic_id: clinicId, p_date: date });
    if ((hol as any)?.[0]?.is_holiday) continue;
    // A vaga que acabou de ser liberada conta como livre mesmo que o cancelamento ainda não tenha sido gravado.
    const freedTime = freed && freed.date === date ? String(freed.time).slice(0, 5) : null;
    const dayAppts = (appts || []).filter((a: any) => a.appointment_date === date && String(a.start_time).slice(0, 5) !== freedTime);
    const dayBlocks = new Set((blocks || []).filter((b: any) => b.block_date === date).map((b: any) => String(b.start_time).slice(0, 5)));
    for (const { start, dur } of slots) {
      if (date === now.date && start <= now.minutes) continue;
      const t = fromMin(start);
      if (dayBlocks.has(t)) continue;
      const busy = dayAppts.some((a: any) => start < toMin(a.end_time) && start + dur > toMin(a.start_time));
      if (busy) continue;
      result.push({ date, time: t, end: fromMin(start + dur) });
    }
  }
  return result;
}
