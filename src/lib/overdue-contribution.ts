export interface OverdueContributionInput {
  status: string;
  due_date: string;
}

/**
 * Considera vencida somente uma contribuição com vencimento anterior ao dia atual.
 * O status overdue sozinho não basta: registros com data futura são excluídos.
 */
export function isOverdueContribution(
  contribution: OverdueContributionInput,
  today: Date = new Date(),
): boolean {
  const todayMidnight = new Date(today);
  todayMidnight.setHours(0, 0, 0, 0);

  const dueDate = new Date(`${contribution.due_date.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(dueDate.getTime())) return false;

  const isPastDue = dueDate.getTime() < todayMidnight.getTime();
  return isPastDue && (contribution.status === "overdue" || contribution.status === "pending");
}
