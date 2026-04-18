/**
 * Utilitários para formatação e mascaramento de CPF.
 *
 * IMPORTANTE: o mascaramento aqui é APENAS visual. A busca/comparação
 * deve sempre usar o valor real (digitos) armazenado no banco.
 */

/** Remove tudo que não é dígito */
export function cleanCpf(cpf: string | null | undefined): string {
  if (!cpf) return "";
  return cpf.replace(/\D/g, "");
}

/** Formata CPF: 12345678900 → 123.456.789-00. Devolve string original se inválida. */
export function formatCpf(cpf: string | null | undefined): string {
  if (!cpf) return "";
  const digits = cleanCpf(cpf);
  if (digits.length !== 11) return cpf;
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

/**
 * Mascara o CPF, mostrando apenas os 2 últimos dígitos:
 * 123.456.789-00 → ***.***.***-00
 */
export function maskCpf(cpf: string | null | undefined): string {
  if (!cpf) return "";
  const digits = cleanCpf(cpf);
  if (digits.length !== 11) {
    // CPF parcial/inválido — mascara tudo menos os 2 últimos para não vazar info
    if (digits.length >= 2) return `***.***.***-${digits.slice(-2)}`;
    return "***.***.***-**";
  }
  return `***.***.***-${digits.slice(-2)}`;
}

/**
 * Decide se exibe o CPF formatado completo ou mascarado, baseado em permissão.
 */
export function displayCpf(cpf: string | null | undefined, canSeeFull: boolean): string {
  if (!cpf) return "";
  return canSeeFull ? formatCpf(cpf) : maskCpf(cpf);
}
