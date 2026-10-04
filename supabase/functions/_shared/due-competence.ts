// Regra "competência a vencer": aguardando valor e vencimento hoje ou depois (horário de Brasília).
export function todayBrasilia(now: Date = new Date()): string {
  return new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function isDueCompetence(
  c: { status: string; due_date: string | null },
  now: Date = new Date(),
): boolean {
  if (!["awaiting_value", "pending"].includes(c.status) || !c.due_date) return false;
  return c.due_date.slice(0, 10) >= todayBrasilia(now);
}
