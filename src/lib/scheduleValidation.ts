/**
 * Helper function to check if an error is a schedule validation error
 * and return a user-friendly message
 */
export function handleScheduleValidationError(error: any): {
  isScheduleError: boolean;
  message: string;
} {
  const errorMessage = error?.message || error?.toString() || "";
  
  if (errorMessage.includes("HORARIO_INVALIDO")) {
    // Extract the message after "HORARIO_INVALIDO: "
    const match = errorMessage.match(/HORARIO_INVALIDO:\s*(.+)/);
    return {
      isScheduleError: true,
      message: match ? match[1].trim() : "Horário indisponível para este profissional.",
    };
  }
  
  return {
    isScheduleError: false,
    message: error?.message || "Tente novamente.",
  };
}
