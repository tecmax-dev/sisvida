// Date helpers to avoid off-by-one issues caused by timezone when parsing YYYY-MM-DD.

/**
 * Parses an ISO date (YYYY-MM-DD) or timestamp string into a local Date set to 12:00.
 * This prevents the common timezone shift (e.g. showing the previous day in America/Sao_Paulo).
 */
export function parseDateOnlyToLocalNoon(value: string): Date {
  const dateOnly = (value || "").slice(0, 10);
  const match = dateOnly.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return new Date(NaN);

  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

/** Formats YYYY-MM-DD (or timestamp) as DD/MM/YYYY without timezone conversions. */
export function formatDateBR(value?: string | null): string {
  if (!value) return "";
  const dateOnly = value.slice(0, 10);
  const match = dateOnly.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;
  return `${match[3]}/${match[2]}/${match[1]}`;
}
