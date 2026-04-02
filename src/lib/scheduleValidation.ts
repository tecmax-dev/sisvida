/**
 * Utilitários para validação de agendamentos
 */

/**
 * Verifica se o erro é de validação de agendamento (horário ou feriado)
 */
export function isScheduleValidationError(error: any): boolean {
  const message = error?.message || error?.toString() || "";
  return message.includes("HORARIO_INVALIDO:") || message.includes("FERIADO:") || message.includes("CONFLITO:") || message.includes("idx_appointments_no_duplicate_slot") || message.includes("duplicate key");
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
  
  // Erro de conflito de horário
  if (errorMessage.includes("CONFLITO:")) {
    const match = errorMessage.match(/CONFLITO:\s*(.+)/);
    return {
      isScheduleError: true,
      message: match ? match[1].trim() : "Já existe um agendamento para este profissional neste horário.",
    };
  }

  // Erro de índice unique (race condition - dois agendamentos simultâneos)
  if (errorMessage.includes("idx_appointments_no_duplicate_slot") || (errorMessage.includes("duplicate key") && errorMessage.includes("appointments"))) {
    return {
      isScheduleError: true,
      message: "Este horário acabou de ser reservado por outro usuário. Atualize a agenda e tente outro horário.",
    };
  }
  
  return {
    isScheduleError: false,
    message: error?.message || "Tente novamente.",
  };
}
