// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  queueForProfessional,
  isQueuePrivileged,
  computeReservedSlots,
  isSlotAvailableForPatient,
  type QueueEntry,
  type PendingOffer,
} from "@/lib/waitingListAvailability";

const PROF_A = "prof-a";
const PROF_B = "prof-b";
const DANIELLE = "pat-danielle";
const OUTRO = "pat-outro";
const DATE = "2026-08-10";

const queue = (over: Partial<QueueEntry> = {}): QueueEntry => ({
  id: "q1",
  patient_id: DANIELLE,
  professional_id: PROF_A,
  created_at: "2026-08-01T10:00:00Z",
  queue_status: "ATIVO",
  ...over,
});

const offer = (over: Partial<PendingOffer> = {}): PendingOffer => ({
  patient_id: DANIELLE,
  professional_id: PROF_A,
  appointment_date: DATE,
  start_time: "09:00:00",
  end_time: "09:30:00",
  ...over,
});

describe("fila de espera — isolamento por profissional", () => {
  it("fila do profissional A não aparece na fila do profissional B", () => {
    const entries = [queue()];
    expect(queueForProfessional(entries, PROF_B)).toHaveLength(0);
    expect(queueForProfessional(entries, PROF_A)).toHaveLength(1);
  });

  it("associado na fila do Dr. A pode agendar normalmente com a Dra. B", () => {
    expect(
      isQueuePrivileged({
        patientId: DANIELLE,
        professionalId: PROF_B,
        queueEntries: [queue()],
      }),
    ).toBe(true);
  });

  it("fila do Dr. A não reserva vagas liberadas da Dra. B", () => {
    const reserved = computeReservedSlots({
      patientId: OUTRO,
      professionalId: PROF_B,
      queueEntries: [queue()],
      freedAppointments: [{ start_time: "10:00:00", end_time: "10:30:00" }],
    });
    expect(reserved).toHaveLength(0);
  });

  it("entradas não ATIVAS são ignoradas", () => {
    const entries = [queue({ queue_status: "ATENDIDO" })];
    expect(queueForProfessional(entries, PROF_A)).toHaveLength(0);
    expect(
      isQueuePrivileged({ patientId: OUTRO, professionalId: PROF_A, queueEntries: entries }),
    ).toBe(true);
  });
});

describe("privilégio dentro da fila do próprio profissional", () => {
  it("qualquer posição na fila do profissional é privilegiada (não só o primeiro)", () => {
    const entries = [
      queue({ id: "q1", patient_id: OUTRO, created_at: "2026-08-01T08:00:00Z" }),
      queue({ id: "q2", patient_id: DANIELLE, created_at: "2026-08-02T08:00:00Z" }),
    ];
    expect(
      isQueuePrivileged({ patientId: DANIELLE, professionalId: PROF_A, queueEntries: entries }),
    ).toBe(true);
  });

  it("quem não está na fila não pode ocupar vaga liberada quando há fila ativa", () => {
    expect(
      isQueuePrivileged({ patientId: OUTRO, professionalId: PROF_A, queueEntries: [queue()] }),
    ).toBe(false);
  });

  it("oferta pendente também concede privilégio", () => {
    expect(
      isQueuePrivileged({
        patientId: OUTRO,
        professionalId: PROF_A,
        queueEntries: [queue()],
        pendingOffers: [offer({ patient_id: OUTRO })],
      }),
    ).toBe(true);
  });

  it("sem paciente identificado e com fila ativa, não há privilégio", () => {
    expect(
      isQueuePrivileged({ patientId: null, professionalId: PROF_A, queueEntries: [queue()] }),
    ).toBe(false);
  });
});

describe("disponibilidade retornada pelas edge functions (cenários de sobreposição)", () => {
  const freed = [{ start_time: "09:00:00", end_time: "09:30:00" }];

  it("vaga liberada fica reservada para quem está fora da fila", () => {
    const reserved = computeReservedSlots({
      patientId: OUTRO,
      professionalId: PROF_A,
      queueEntries: [queue()],
      freedAppointments: freed,
    });
    expect(reserved).toEqual([
      { start_time: "09:00:00", end_time: "09:30:00", status: "reserved_waiting_list" },
    ]);
  });

  it("mesma vaga fica livre para quem está na fila daquele profissional", () => {
    const reserved = computeReservedSlots({
      patientId: DANIELLE,
      professionalId: PROF_A,
      queueEntries: [queue()],
      freedAppointments: freed,
    });
    expect(reserved).toHaveLength(0);
  });

  it("agenda regular (sem cancelamento) permanece aberta mesmo com fila ativa", () => {
    expect(
      isSlotAvailableForPatient({
        slot: { start_time: "14:00:00", end_time: "14:30:00" },
        patientId: OUTRO,
        professionalId: PROF_A,
        queueEntries: [queue()],
        freedAppointments: freed,
      }),
    ).toBe(true);
  });

  it("vaga liberada que já foi reagendada (ativa) não é reservada nem duplicada", () => {
    const reserved = computeReservedSlots({
      patientId: OUTRO,
      professionalId: PROF_A,
      queueEntries: [queue()],
      freedAppointments: freed,
      activeAppointments: [{ start_time: "09:00:00", end_time: "09:30:00", status: "scheduled" }],
    });
    expect(reserved).toHaveLength(0);
  });

  it("oferta pendente para outro associado bloqueia o slot, mas não para o ofertado", () => {
    const base = { professionalId: PROF_A, queueEntries: [queue()], pendingOffers: [offer()] };
    expect(computeReservedSlots({ ...base, patientId: OUTRO })).toContainEqual({
      start_time: "09:00:00",
      end_time: "09:30:00",
      status: "reserved_waiting_list",
    });
    expect(computeReservedSlots({ ...base, patientId: DANIELLE })).toHaveLength(0);
  });

  it("não duplica reserva quando a vaga liberada também tem oferta pendente", () => {
    const reserved = computeReservedSlots({
      patientId: OUTRO,
      professionalId: PROF_A,
      queueEntries: [queue()],
      pendingOffers: [offer()],
      freedAppointments: freed,
    });
    expect(reserved).toHaveLength(1);
  });

  it("slot já ocupado por agendamento ativo é indisponível para qualquer um", () => {
    expect(
      isSlotAvailableForPatient({
        slot: { start_time: "11:00:00", end_time: "11:30:00" },
        patientId: DANIELLE,
        professionalId: PROF_A,
        queueEntries: [queue()],
        activeAppointments: [{ start_time: "11:00:00", end_time: "11:30:00" }],
      }),
    ).toBe(false);
  });

  it("cenário Danielle: fila com Dr. Jorge não impede agendamento com Dra. Juliane", () => {
    const entries = [queue({ professional_id: "jorge", patient_id: DANIELLE })];
    expect(
      isSlotAvailableForPatient({
        slot: { start_time: "08:00:00", end_time: "08:30:00" },
        patientId: DANIELLE,
        professionalId: "juliane",
        queueEntries: entries,
        freedAppointments: [{ start_time: "08:00:00", end_time: "08:30:00" }],
      }),
    ).toBe(true);
  });
});
