/**
 * Regras puras de disponibilidade x Fila de Espera.
 *
 * Princípios (espelham mobile-slot-availability / mobile-create-booking / CalendarPage):
 * 1. A fila é SEMPRE por profissional: fila do profissional A nunca bloqueia o profissional B.
 * 2. Apenas vagas LIBERADAS (cancelamento/no_show) e ofertas PENDENTES ficam reservadas.
 *    A agenda regular do profissional continua aberta a todos.
 * 3. Quem está em qualquer posição da fila DAQUELE profissional é privilegiado.
 */

export interface QueueEntry {
  id: string;
  patient_id: string;
  professional_id: string;
  created_at: string;
  queue_status?: string;
}

export interface PendingOffer {
  patient_id: string;
  professional_id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
}

export interface SlotRef {
  start_time: string;
  end_time: string;
  status?: string;
}

export interface ReservedSlot extends SlotRef {
  status: "reserved_waiting_list";
}

/** Entradas ATIVAS da fila do profissional informado. */
export function queueForProfessional(
  entries: QueueEntry[],
  professionalId: string,
): QueueEntry[] {
  return entries
    .filter(
      (e) =>
        e.professional_id === professionalId &&
        (e.queue_status ?? "ATIVO") === "ATIVO",
    )
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/** O paciente pode ocupar vagas liberadas deste profissional? */
export function isQueuePrivileged(params: {
  patientId?: string | null;
  professionalId: string;
  queueEntries: QueueEntry[];
  pendingOffers?: PendingOffer[];
}): boolean {
  const { patientId, professionalId, queueEntries, pendingOffers = [] } = params;
  const queue = queueForProfessional(queueEntries, professionalId);
  if (queue.length === 0) return true; // sem fila: agenda livre para todos
  if (!patientId) return false;
  const hasOwnOffer = pendingOffers.some(
    (o) => o.professional_id === professionalId && o.patient_id === patientId,
  );
  return hasOwnOffer || queue.some((q) => q.patient_id === patientId);
}

const sameSlot = (a: SlotRef, b: SlotRef) =>
  a.start_time === b.start_time && a.end_time === b.end_time;

/** Slots que devem ser exibidos como indisponíveis por causa da fila. */
export function computeReservedSlots(params: {
  patientId?: string | null;
  professionalId: string;
  queueEntries: QueueEntry[];
  pendingOffers?: PendingOffer[];
  freedAppointments?: SlotRef[];
  activeAppointments?: SlotRef[];
}): ReservedSlot[] {
  const {
    patientId,
    professionalId,
    queueEntries,
    pendingOffers = [],
    freedAppointments = [],
    activeAppointments = [],
  } = params;

  const reserved: ReservedSlot[] = [];

  // Ofertas pendentes: visíveis apenas para o associado ofertado
  for (const offer of pendingOffers) {
    if (offer.professional_id !== professionalId) continue;
    if (patientId && offer.patient_id === patientId) continue;
    reserved.push({
      start_time: offer.start_time,
      end_time: offer.end_time,
      status: "reserved_waiting_list",
    });
  }

  const privileged = isQueuePrivileged({
    patientId,
    professionalId,
    queueEntries,
    pendingOffers,
  });

  if (!privileged) {
    for (const freed of freedAppointments) {
      if (activeAppointments.some((a) => sameSlot(a, freed))) continue;
      if (reserved.some((r) => sameSlot(r, freed))) continue;
      reserved.push({
        start_time: freed.start_time,
        end_time: freed.end_time,
        status: "reserved_waiting_list",
      });
    }
  }

  return reserved;
}

/** Um slot específico está disponível para este paciente? */
export function isSlotAvailableForPatient(params: {
  slot: SlotRef;
  patientId?: string | null;
  professionalId: string;
  queueEntries: QueueEntry[];
  pendingOffers?: PendingOffer[];
  freedAppointments?: SlotRef[];
  activeAppointments?: SlotRef[];
}): boolean {
  const { slot, activeAppointments = [] } = params;
  if (activeAppointments.some((a) => sameSlot(a, slot))) return false;
  return !computeReservedSlots(params).some((r) => sameSlot(r, slot));
}
