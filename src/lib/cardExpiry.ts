/** Normaliza data de validade (YYYY-MM-DD) para meio-dia de Brasília, evitando regressão de um dia por fuso. */
export function toCardExpiryTimestamp(value: string): string {
  const only = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(only) ? `${only}T12:00:00-03:00` : value;
}
