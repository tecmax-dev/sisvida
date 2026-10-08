import { AlertCircle, CheckCircle2, UserCheck, Clock, XCircle, Ban } from "lucide-react";

export const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
export const weekDaysFull = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export const monthNames = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export const appointmentTypes = [
  { value: "first_visit", label: "Primeira Consulta" },
  { value: "return", label: "Retorno" },
  { value: "exam", label: "Exame" },
  { value: "procedure", label: "Procedimento" },
  { value: "telemedicine", label: "Telemedicina" },
];

export const SINDICATO_CLINIC_ID = "89e7585e-7bce-4e58-91fa-c37080d1170d";
export const RODOVIARIOS_REMINDER_PROFESSIONALS = ['marcelo aguiar', 'jorge avelar', 'pedro roberto'];
export const RODOVIARIOS_REMINDER_LOCATION = 'Av. Antonio Carlos Magalhães, 1062, Bairro Malhado — Sede do Sindicato dos Rodoviários, ao lado da Igreja Testemunhas de Jeová';

export const getOfficialReminderLocation = (professionalName?: string, fallback = 'Sindicato') => {
  const normalizedName = String(professionalName || '').toLowerCase();
  return RODOVIARIOS_REMINDER_PROFESSIONALS.some((name) => normalizedName.includes(name))
    ? RODOVIARIOS_REMINDER_LOCATION
    : fallback;
};

export const defaultTimeSlots = [
  "08:00", "09:00", "10:00", "11:00", "12:00",
  "13:00", "14:00", "15:00", "16:00", "17:00", "18:00",
];

// Calcula os slots do dia (livres e ocupados) respeitando agenda e intervalos
export const calculateProfessionalSlots = (
  professional: { id: string; schedule?: any; appointment_duration?: number | null },
  appointments: { id?: string; start_time: string; end_time: string; status: string }[],
  selectedDate: Date,
  slotBlocks: { id: string; professional_id: string; start_time: string; end_time: string; reason: string | null }[] = []
): { time: string; type: 'free' | 'booked' | 'blocked'; duration: number; appointment?: any; block?: { id: string; reason: string | null } }[] => {
  if (!professional.schedule) return [];

  const dayOfWeek = selectedDate.getDay();
  const dayMap: Record<number, string> = {
    0: 'sunday', 1: 'monday', 2: 'tuesday', 3: 'wednesday',
    4: 'thursday', 5: 'friday', 6: 'saturday'
  };
  const dayKey = dayMap[dayOfWeek];
  const schedule = professional.schedule;
  const daySchedule = schedule[dayKey];
  const blocks = schedule?._blocks as Array<{ days: string[]; start_time: string; end_time: string; duration?: number; start_date?: string; end_date?: string }> | undefined;

  const defaultDuration = professional.appointment_duration || 30;
  const y = selectedDate.getFullYear();
  const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
  const d = String(selectedDate.getDate()).padStart(2, '0');
  const dateStr = `${y}-${m}-${d}`;

  // Filtrar apenas agendamentos ativos
  const activeAppointments = appointments.filter(a => a.status !== 'cancelled');

  const allTimeSlots: string[] = [];

  // Primeiro, verificar _blocks (nova estrutura de agenda)
  if (blocks && blocks.length > 0) {
    for (const block of blocks) {
      if (block.start_date && dateStr < block.start_date) continue;
      if (block.end_date && dateStr > block.end_date) continue;
      if (block.days && block.days.length > 0 && !block.days.includes(dayKey)) continue;

      const [sh, sm] = String(block.start_time).split(':').map(Number);
      const [eh, em] = String(block.end_time).split(':').map(Number);
      const interval = block.duration || defaultDuration;

      let cur = sh * 60 + sm;
      const end = eh * 60 + em;

      while (cur < end) {
        const h = Math.floor(cur / 60);
        const m = cur % 60;
        allTimeSlots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
        cur += interval;
      }
    }
  }

  // IMPORTANTE: Se existem _blocks definidos, NÃO usar o fallback do schedule antigo.
  // O fallback só deve ser usado quando o profissional ainda usa a estrutura antiga (sem _blocks).
  const hasBlocks = blocks && blocks.length > 0;

  if (allTimeSlots.length === 0 && !hasBlocks && daySchedule?.enabled && Array.isArray(daySchedule.slots) && daySchedule.slots.length > 0) {
    for (const s of daySchedule.slots as Array<{ start: string; end: string }>) {
      const [sh, sm] = String(s.start).split(':').map(Number);
      const [eh, em] = String(s.end).split(':').map(Number);

      let cur = sh * 60 + sm;
      const end = eh * 60 + em;

      while (cur < end) {
        const h = Math.floor(cur / 60);
        const m = cur % 60;
        allTimeSlots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
        cur += defaultDuration;
      }
    }
  }

  if (allTimeSlots.length === 0) return [];

  const uniqueSlots = Array.from(new Set(allTimeSlots)).sort();

  const result: { time: string; type: 'free' | 'booked' | 'blocked'; duration: number; appointment?: any; block?: { id: string; reason: string | null } }[] = [];

  const profBlocks = slotBlocks.filter(b => b.professional_id === professional.id);

  for (const timeStr of uniqueSlots) {
    const [h, m] = timeStr.split(':').map(Number);
    const slotMinutes = h * 60 + m;

    const appointment = activeAppointments.find(apt => {
      const aptStart = apt.start_time.substring(0, 5);
      const aptEnd = apt.end_time.substring(0, 5);
      const [aptStartH, aptStartM] = aptStart.split(':').map(Number);
      const [aptEndH, aptEndM] = aptEnd.split(':').map(Number);
      const aptStartMinutes = aptStartH * 60 + aptStartM;
      const aptEndMinutes = aptEndH * 60 + aptEndM;
      return slotMinutes >= aptStartMinutes && slotMinutes < aptEndMinutes;
    });

    if (appointment) {
      const aptStart = appointment.start_time.substring(0, 5);
      result.push({
        time: timeStr,
        type: 'booked',
        duration: defaultDuration,
        appointment: timeStr === aptStart ? appointment : undefined,
      });
    } else {
      const block = profBlocks.find(b => b.start_time.substring(0, 5) === timeStr);
      if (block) {
        result.push({
          time: timeStr,
          type: 'blocked',
          duration: defaultDuration,
          block: { id: block.id, reason: block.reason },
        });
      } else {
        result.push({ time: timeStr, type: 'free', duration: defaultDuration });
      }
    }
  }

  return result;
};

// Normaliza texto para busca: remove acentos, pontuação e converte para minúsculo
export const normalizeForSearch = (text: string): string => {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^\w\s]/g, ''); // Remove pontuação
};

// Helper para obter nome de exibição do agendamento (dependente ou paciente)
export const getAppointmentDisplayName = (apt: { 
  patient?: { name: string } | null; 
  dependent?: { name: string } | null;
  dependent_id?: string | null;
} | null | undefined): string => {
  if (!apt) return "Paciente";
  // Se tem dependente, mostrar nome do dependente
  if (apt.dependent_id && apt.dependent?.name) {
    return apt.dependent.name;
  }
  return apt.patient?.name || "Paciente";
};

export const toHslColor = (input?: string | null): string | null => {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("hsl(")) return trimmed;

  // suporta #rgb e #rrggbb
  if (trimmed.startsWith("#")) {
    const hex = trimmed.replace("#", "");
    const full =
      hex.length === 3
        ? hex
            .split("")
            .map((c) => c + c)
            .join("")
        : hex;

    if (full.length !== 6) return null;

    const r = parseInt(full.slice(0, 2), 16) / 255;
    const g = parseInt(full.slice(2, 4), 16) / 255;
    const b = parseInt(full.slice(4, 6), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;

    let h = 0;
    if (delta !== 0) {
      if (max === r) h = ((g - b) / delta) % 6;
      else if (max === g) h = (b - r) / delta + 2;
      else h = (r - g) / delta + 4;
      h = Math.round(h * 60);
      if (h < 0) h += 360;
    }

    const l = (max + min) / 2;
    const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

    const sPct = Math.round(s * 100);
    const lPct = Math.round(l * 100);
    return `hsl(${h} ${sPct}% ${lPct}%)`;
  }

  return null;
};

export const parseHsl = (hsl: string): { h: number; s: number; l: number } | null => {
  const m = hsl
    .trim()
    .match(/^hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)$/i);
  if (!m) return null;
  return { h: Number(m[1]), s: Number(m[2]), l: Number(m[3]) };
};

export const hslWithAlpha = (hsl: string, alpha: number): string => {
  const p = parseHsl(hsl);
  if (!p) return hsl;
  const a = Math.max(0, Math.min(1, alpha));
  return `hsl(${p.h} ${p.s}% ${p.l}% / ${a})`;
};

export const shiftHslHue = (hsl: string, degrees: number): string => {
  const p = parseHsl(hsl);
  if (!p) return hsl;
  const h = ((p.h + degrees) % 360 + 360) % 360;
  return `hsl(${h} ${p.s}% ${p.l}%)`;
};

export const statusConfig = {
  scheduled: { icon: AlertCircle, color: "text-amber-600", bgColor: "bg-amber-100", label: "A confirmar" },
  confirmed: { icon: CheckCircle2, color: "text-blue-600", bgColor: "bg-blue-100", label: "Confirmado" },
  arrived: { icon: UserCheck, color: "text-green-600", bgColor: "bg-green-100", label: "Chegou" },
  in_progress: { icon: Clock, color: "text-purple-600", bgColor: "bg-purple-100", label: "Em atendimento" },
  completed: { icon: CheckCircle2, color: "text-gray-500", bgColor: "bg-gray-100", label: "Concluído" },
  cancelled: { icon: XCircle, color: "text-red-600", bgColor: "bg-red-100", label: "Cancelado" },
  no_show: { icon: XCircle, color: "text-orange-600", bgColor: "bg-orange-100", label: "Faltou" },
  blocked: { icon: Ban, color: "text-slate-600", bgColor: "bg-slate-200", label: "Bloqueado" },
};

export type ViewMode = "day" | "week" | "month";

export interface Patient {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  birth_date?: string | null;
  cpf?: string | null;
  matchedDependentName?: string | null;
}

export interface Professional {
  id: string;
  name: string;
  specialty: string | null;
  appointment_duration?: number | null;
  schedule?: any | null;
  avatar_url?: string | null;
  max_patient_age?: number | null;
}

export interface Appointment {
  id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  type: string;
  status: string;
  notes: string | null;
  patient_id: string;
  professional_id: string;
  started_at: string | null;
  completed_at: string | null;
  duration_minutes: number | null;
  confirmation_token: string | null;
  procedure_id: string | null;
  dependent_id: string | null;
  procedure?: { id: string; name: string; price: number } | null;
  patient: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    birth_date: string | null;
    no_show_blocked_until: string | null;
    no_show_unblocked_at: string | null;
    insurance_plan?: {
      id: string;
      name: string;
      color: string | null;
    } | null;
  };
  professional: {
    id: string;
    name: string;
    specialty?: string | null;
    avatar_url?: string | null;
  };
  dependent?: {
    id: string;
    name: string;
    birth_date: string | null;
  } | null;
}

