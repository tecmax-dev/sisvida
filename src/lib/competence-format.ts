/**
 * Helper para formatação de competência em formato numeral
 * Ex: 12/2025 em vez de "Dezembro/2025"
 */

/**
 * Formata a competência no formato MM/YYYY (numeral)
 * @param month Mês (1-12)
 * @param year Ano
 * @returns String formatada, ex: "12/2025"
 */
export function formatCompetence(month: number, year: number): string {
  return `${String(month).padStart(2, "0")}/${year}`;
}

/**
 * Formata a competência no formato abreviado MM/YYYY
 * @param month Mês (1-12)
 * @param year Ano
 * @returns String formatada, ex: "12/2025"
 */
export function formatCompetenceShort(month: number, year: number): string {
  return `${String(month).padStart(2, "0")}/${year}`;
}

/**
 * Obtém o nome do mês por extenso (para uso legado se necessário)
 * @param month Mês (1-12)
 * @returns Nome do mês
 */
export function getMonthName(month: number): string {
  const months = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];
  return months[month - 1] || "";
}

/**
 * Obtém abreviação do mês (3 letras)
 * @param month Mês (1-12)
 * @returns Abreviação do mês
 */
export function getMonthAbbr(month: number): string {
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return months[month - 1] || "";
}
