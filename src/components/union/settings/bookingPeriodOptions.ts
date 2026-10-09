// Períodos de controle de agendamento. "monthly" = mês do calendário (regra original);
// "days_N" = janela móvel de N dias antes/depois da consulta (aplicada no banco).
export const BOOKING_PERIOD_OPTIONS = [
  { value: "monthly", label: "Mensal (mês do calendário)", short: "mês" },
  { value: "days_15", label: "Quinzenal (a cada 15 dias)", short: "15 dias" },
  { value: "days_30", label: "A cada 30 dias", short: "30 dias" },
  { value: "days_45", label: "A cada 45 dias", short: "45 dias" },
  { value: "days_60", label: "A cada 60 dias", short: "60 dias" },
  { value: "days_90", label: "A cada 90 dias", short: "90 dias" },
  { value: "days_180", label: "A cada 180 dias", short: "180 dias" },
];

export const normalizeBookingPeriod = (p?: string | null) =>
  BOOKING_PERIOD_OPTIONS.some((o) => o.value === p) ? (p as string) : "monthly";

export const bookingPeriodShort = (p: string) =>
  BOOKING_PERIOD_OPTIONS.find((o) => o.value === p)?.short || "mês";
