/**
 * Utilitários para validação de agendamentos
 */

/**
 * Verifica se o erro é de validação de agendamento (horário ou feriado)
 */
export function isScheduleValidationError(error: any): boolean {
  const message = error?.message || error?.toString() || "";
  return message.includes("HORARIO_INVALIDO:") || message.includes("FERIADO:");
}

/**
 * Helper function to check if an error is a schedule validation error
 * and return a user-friendly message
 */
export function handleScheduleValidationError(error: any): {
  isScheduleError: boolean;
  message: string;
} {
  const errorMessage = error?.message || error?.toString() || "";
  
  // Erro de horário inválido
  if (errorMessage.includes("HORARIO_INVALIDO")) {
    const match = errorMessage.match(/HORARIO_INVALIDO:\s*(.+)/);
    return {
      isScheduleError: true,
      message: match ? match[1].trim() : "Horário indisponível para este profissional.",
    };
  }
  
  // Erro de feriado
  if (errorMessage.includes("FERIADO:")) {
    const match = errorMessage.match(/FERIADO:\s*(.+)/);
    return {
      isScheduleError: true,
      message: match ? match[1].trim() : "Não é possível agendar em feriados.",
    };
  }
  
  return {
    isScheduleError: false,
    message: error?.message || "Tente novamente.",
  };
}
