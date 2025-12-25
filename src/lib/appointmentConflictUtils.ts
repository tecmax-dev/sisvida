/**
 * Utility functions for checking appointment time conflicts
 */

interface AppointmentSlot {
  id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  professional_id: string;
  status: string;
  duration_minutes?: number | null;
}

interface ConflictCheckParams {
  appointmentDate: string;
  startTime: string;
  durationMinutes: number;
  professionalId: string;
  excludeAppointmentId?: string;
}

/**
 * Converts time string (HH:MM) to total minutes from midnight
 */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Converts total minutes to time string (HH:MM)
 */
export function minutesToTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

/**
 * Calculates end time based on start time and duration
 */
export function calculateEndTime(startTime: string, durationMinutes: number): string {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = startMinutes + durationMinutes;
  return minutesToTime(endMinutes);
}

/**
 * Checks if two time ranges overlap
 */
export function doTimesOverlap(
  start1: string, 
  end1: string, 
  start2: string, 
  end2: string
): boolean {
  const s1 = timeToMinutes(start1);
  const e1 = timeToMinutes(end1);
  const s2 = timeToMinutes(start2);
  const e2 = timeToMinutes(end2);
  
  // Two ranges overlap if start1 < end2 AND start2 < end1
  return s1 < e2 && s2 < e1;
}

/**
 * Finds conflicting appointments for a given time slot
 */
export function findConflictingAppointments(
  existingAppointments: AppointmentSlot[],
  params: ConflictCheckParams
): AppointmentSlot[] {
  const { appointmentDate, startTime, durationMinutes, professionalId, excludeAppointmentId } = params;
  
  const endTime = calculateEndTime(startTime, durationMinutes);
  
  return existingAppointments.filter(apt => {
    // Exclude the appointment being edited
    if (excludeAppointmentId && apt.id === excludeAppointmentId) {
      return false;
    }
    
    // Only check same date and professional
    if (apt.appointment_date !== appointmentDate) {
      return false;
    }
    
    if (apt.professional_id !== professionalId) {
      return false;
    }
    
    // Only check active appointments (not cancelled/no_show)
    if (apt.status === 'cancelled' || apt.status === 'no_show') {
      return false;
    }
    
    // Check time overlap
    return doTimesOverlap(startTime, endTime, apt.start_time, apt.end_time);
  });
}

/**
 * Checks if there are any conflicts for a proposed appointment
 */
export function hasConflict(
  existingAppointments: AppointmentSlot[],
  params: ConflictCheckParams
): boolean {
  return findConflictingAppointments(existingAppointments, params).length > 0;
}

/**
 * Gets a human-readable conflict message
 */
export function getConflictMessage(
  conflicts: AppointmentSlot[],
  patientNames?: Record<string, string>
): string {
  if (conflicts.length === 0) return "";
  
  if (conflicts.length === 1) {
    const conflict = conflicts[0];
    const patientName = patientNames?.[conflict.id] || 'outro paciente';
    return `Horário conflita com agendamento de ${patientName} (${conflict.start_time.slice(0, 5)} - ${conflict.end_time.slice(0, 5)})`;
  }
  
  return `Horário conflita com ${conflicts.length} agendamentos existentes`;
}

/**
 * Finds all appointments that have conflicts with other appointments
 */
export function findAllConflictingAppointments(appointments: AppointmentSlot[]): Set<string> {
  const conflictingIds = new Set<string>();
  
  // Group by date and professional
  const grouped: Record<string, AppointmentSlot[]> = {};
  
  for (const apt of appointments) {
    if (apt.status === 'cancelled' || apt.status === 'no_show') continue;
    
    const key = `${apt.appointment_date}_${apt.professional_id}`;
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(apt);
  }
  
  // Check for conflicts within each group
  for (const key in grouped) {
    const group = grouped[key];
    
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const apt1 = group[i];
        const apt2 = group[j];
        
        if (doTimesOverlap(apt1.start_time, apt1.end_time, apt2.start_time, apt2.end_time)) {
          conflictingIds.add(apt1.id);
          conflictingIds.add(apt2.id);
        }
      }
    }
  }
  
  return conflictingIds;
}

/**
 * Validates that appointment duration is compatible with selected procedure
 */
export function validateDurationWithProcedure(
  selectedDuration: number,
  procedureDuration: number | null | undefined
): { valid: boolean; message?: string } {
  if (!procedureDuration) {
    return { valid: true };
  }
  
  if (selectedDuration < procedureDuration) {
    return {
      valid: false,
      message: `O procedimento selecionado requer no mínimo ${procedureDuration} minutos. Duração selecionada: ${selectedDuration} minutos.`
    };
  }
  
  return { valid: true };
}
