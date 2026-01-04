import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCenter, pointerWithin } from "@dnd-kit/core";
import { sendWhatsAppMessage, formatAppointmentConfirmation, formatAppointmentReminder, formatTelemedicineInvite } from "@/lib/whatsapp";
import { ToastAction } from "@/components/ui/toast";
import { AppointmentPanel } from "@/components/appointments/AppointmentPanel";
import { PreAttendanceDialog } from "@/components/appointments/PreAttendanceDialog";
import { AppointmentAuditDialog } from "@/components/appointments/AppointmentAuditDialog";
import { DraggableAppointment } from "@/components/appointments/DraggableAppointment";
import { DroppableTimeSlot } from "@/components/appointments/DroppableTimeSlot";
import { DragOverlayContent } from "@/components/appointments/DragOverlayContent";
import { DragInstructions } from "@/components/appointments/DragInstructions";
import { RecurrenceSelector, RecurrenceConfig, calculateRecurringDates } from "@/components/appointments/RecurrenceSelector";
import { TimeSlotPicker } from "@/components/appointments/TimeSlotPicker";
import { generateId } from "@/lib/generateId";
import { 
  findConflictingAppointments, 
  findAllConflictingAppointments, 
  calculateEndTime,
  getConflictMessage,
} from "@/lib/appointmentConflictUtils";
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus,
  Clock,
  User,
  Loader2,
  Calendar as CalendarIcon,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Pencil,
  Trash2,
  Filter,
  CalendarDays,
  LayoutGrid,
  Check,
  Search,
  Send,
  UserCheck,
  Stethoscope,
  Play,
  GripVertical,
  Video,
  AlertTriangle,
  Activity,
  History,
  Ban,
  CalendarClock,
  ClipboardCheck,
  UserX,
  CalendarCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { handleScheduleValidationError } from "@/lib/scheduleValidation";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { RealtimeIndicator } from "@/components/ui/realtime-indicator";

const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const weekDaysFull = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

const monthNames = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const appointmentTypes = [
  { value: "first_visit", label: "Primeira Consulta" },
  { value: "return", label: "Retorno" },
  { value: "exam", label: "Exame" },
  { value: "procedure", label: "Procedimento" },
  { value: "telemedicine", label: "Telemedicina" },
];

const defaultTimeSlots = [
  "08:00", "09:00", "10:00", "11:00", "12:00",
  "13:00", "14:00", "15:00", "16:00", "17:00", "18:00",
];

// Calcula os slots do dia (livres e ocupados) respeitando agenda e intervalos
const calculateProfessionalSlots = (
  professional: { id: string; schedule?: any; appointment_duration?: number | null },
  appointments: { id?: string; start_time: string; end_time: string; status: string }[],
  selectedDate: Date
): { time: string; type: 'free' | 'booked'; duration: number; appointment?: any }[] => {
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
  const activeAppointments = appointments.filter(a => a.status !== 'cancelled' && a.status !== 'no_show');

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

  // Se não tiver _blocks ou não gerou slots, usar estrutura antiga (slots por dia)
  if (allTimeSlots.length === 0 && daySchedule?.enabled && Array.isArray(daySchedule.slots) && daySchedule.slots.length > 0) {
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

  const result: { time: string; type: 'free' | 'booked'; duration: number; appointment?: any }[] = [];

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
      result.push({ time: timeStr, type: 'free', duration: defaultDuration });
    }
  }

  return result;
};

// Normaliza texto para busca: remove acentos, pontuação e converte para minúsculo
const normalizeForSearch = (text: string): string => {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^\w\s]/g, ''); // Remove pontuação
};

// Helper para obter nome de exibição do agendamento (dependente ou paciente)
const getAppointmentDisplayName = (apt: { 
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

const toHslColor = (input?: string | null): string | null => {
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

const parseHsl = (hsl: string): { h: number; s: number; l: number } | null => {
  const m = hsl
    .trim()
    .match(/^hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)$/i);
  if (!m) return null;
  return { h: Number(m[1]), s: Number(m[2]), l: Number(m[3]) };
};

const hslWithAlpha = (hsl: string, alpha: number): string => {
  const p = parseHsl(hsl);
  if (!p) return hsl;
  const a = Math.max(0, Math.min(1, alpha));
  return `hsl(${p.h} ${p.s}% ${p.l}% / ${a})`;
};

const shiftHslHue = (hsl: string, degrees: number): string => {
  const p = parseHsl(hsl);
  if (!p) return hsl;
  const h = ((p.h + degrees) % 360 + 360) % 360;
  return `hsl(${h} ${p.s}% ${p.l}%)`;
};

const statusConfig = {
  scheduled: { icon: AlertCircle, color: "text-amber-600", bgColor: "bg-amber-100", label: "A confirmar" },
  confirmed: { icon: CheckCircle2, color: "text-blue-600", bgColor: "bg-blue-100", label: "Confirmado" },
  arrived: { icon: UserCheck, color: "text-green-600", bgColor: "bg-green-100", label: "Chegou" },
  in_progress: { icon: Clock, color: "text-purple-600", bgColor: "bg-purple-100", label: "Em atendimento" },
  completed: { icon: CheckCircle2, color: "text-gray-500", bgColor: "bg-gray-100", label: "Concluído" },
  cancelled: { icon: XCircle, color: "text-red-600", bgColor: "bg-red-100", label: "Cancelado" },
  no_show: { icon: XCircle, color: "text-orange-600", bgColor: "bg-orange-100", label: "Faltou" },
};

type ViewMode = "day" | "week" | "month";

interface Patient {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  birth_date?: string | null;
  cpf?: string | null;
}

interface Professional {
  id: string;
  name: string;
  specialty: string | null;
  appointment_duration?: number | null;
  schedule?: any | null;
  avatar_url?: string | null;
}

interface Appointment {
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
  } | null;
}

export default function CalendarPage() {
  const { currentClinic, user, userRoles } = useAuth();
  const { isProfessionalOnly, hasPermission } = usePermissions();
  
  // Permissão para atender pacientes (requer acesso a prontuários médicos)
  const canAttendPatient = hasPermission('manage_medical_records');
  const { toast } = useToast();
  const navigate = useNavigate();
  
  // Use sessionStorage to preserve selected date across tab switches
  const getInitialSelectedDate = (): Date => {
    const stored = sessionStorage.getItem('calendar_selected_date');
    if (stored) {
      const parsed = new Date(stored);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    }
    return new Date();
  };

  const getInitialCurrentDate = (): Date => {
    const stored = sessionStorage.getItem('calendar_current_date');
    if (stored) {
      const parsed = new Date(stored);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    }
    return new Date();
  };

  const getInitialViewMode = (): ViewMode => {
    const stored = sessionStorage.getItem('calendar_view_mode');
    if (stored && ['day', 'week', 'month'].includes(stored)) {
      return stored as ViewMode;
    }
    return 'day';
  };

  const isValidDate = (d: unknown): d is Date => d instanceof Date && !isNaN(d.getTime());

  const formatPtBrLongDate = (d: Date) => {
    if (!isValidDate(d)) return "Data selecionada";
    try {
      return d.toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return "Data selecionada";
    }
  };

  const [currentDate, setCurrentDate] = useState<Date>(getInitialCurrentDate);
  const [selectedDate, setSelectedDate] = useState<Date>(getInitialSelectedDate);

  // Proteção: se por qualquer motivo a data ficar inválida, corrigir imediatamente (evita "Algo deu errado")
  useEffect(() => {
    const selectedOk = isValidDate(selectedDate);
    const currentOk = isValidDate(currentDate);

    if (selectedOk && currentOk) return;

    console.error('[CalendarPage] Data inválida detectada. selectedDate/currentDate:', {
      selectedDate,
      currentDate,
    });

    const fallback = new Date();
    if (!selectedOk) setSelectedDate(fallback);
    if (!currentOk) setCurrentDate(fallback);

    toast({
      title: "Erro de calendário",
      description: "O calendário detectou uma data inválida e foi resetado automaticamente. Tente novamente.",
      variant: "destructive",
    });
  }, [selectedDate, currentDate, toast]);

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [holidays, setHolidays] = useState<Map<string, string>>(new Map()); // date -> holiday name
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // View mode - also persisted
  const [viewMode, setViewMode] = useState<ViewMode>(getInitialViewMode);
  
  // Filters and Search - now supports multiple professionals
  const [filterProfessionals, setFilterProfessionals] = useState<string[]>([]);
  const [filterType, setFilterType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showCancelledNoShow, setShowCancelledNoShow] = useState(false); // By default hide cancelled/no_show
  
  // WhatsApp state
  const [sendingWhatsApp, setSendingWhatsApp] = useState<string | null>(null);
  const [sendingTelemedicineLink, setSendingTelemedicineLink] = useState<string | null>(null);
  const [directReplyEnabled, setDirectReplyEnabled] = useState(false);
  const [sendingBulkReminder, setSendingBulkReminder] = useState<string | null>(null); // professionalId or null
  
  // Edit state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  
  // Cancel state
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancellingAppointment, setCancellingAppointment] = useState<Appointment | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  
  // Reschedule state (for drag-drop simulation)
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
  const [reschedulingAppointment, setReschedulingAppointment] = useState<Appointment | null>(null);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  
  // Appointment Panel state
  const [appointmentPanelOpen, setAppointmentPanelOpen] = useState(false);
  const [selectedAppointmentForPanel, setSelectedAppointmentForPanel] = useState<Appointment | null>(null);
  
  // Pre-attendance state
  const [preAttendanceDialogOpen, setPreAttendanceDialogOpen] = useState(false);
  const [preAttendanceAppointment, setPreAttendanceAppointment] = useState<Appointment | null>(null);
  
  // Audit state
  const [auditDialogOpen, setAuditDialogOpen] = useState(false);
  const [auditAppointment, setAuditAppointment] = useState<Appointment | null>(null);
  
  // Drag and Drop state
  const [activeAppointment, setActiveAppointment] = useState<Appointment | null>(null);
  
  // Calendar visibility state
  const [showCalendar, setShowCalendar] = useState(false);
  
  // Form state
  const [formPatient, setFormPatient] = useState("");
  const [formProfessional, setFormProfessional] = useState("");
  const [formTime, setFormTime] = useState("");
  const [formType, setFormType] = useState("first_visit");
  const [formNotes, setFormNotes] = useState("");
  const [formDuration, setFormDuration] = useState<number | null>(null); // null = usar duração do profissional
  const [patientSearchOpen, setPatientSearchOpen] = useState(false);
  const [patientSearchQuery, setPatientSearchQuery] = useState("");
  const [patientSearchResults, setPatientSearchResults] = useState<Patient[]>([]);
  const [isSearchingPatients, setIsSearchingPatients] = useState(false);
  const [selectedPatientName, setSelectedPatientName] = useState("");
  
  // Recurrence state
  const [recurrenceConfig, setRecurrenceConfig] = useState<RecurrenceConfig>({
    enabled: false,
    frequency: "weekly",
    limitType: "sessions",
    sessions: 4,
    endDate: "",
  });
  
  // Múltiplos horários para recorrência manual
  const [selectedMultipleTimes, setSelectedMultipleTimes] = useState<string[]>([]);
  
  // Professional user state
  const [loggedInProfessionalId, setLoggedInProfessionalId] = useState<string | null>(null);

  const toDateKey = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const timeSlots = useMemo(() => {
    try {
      const getDayKey = (date: Date) => {
        const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        return dayKeys[date.getDay()];
      };

      // Prioridade para definir de qual profissional vem a grade de horários:
      // 1) Se estiver arrastando para reagendar: profissional do agendamento
      // 2) Se houver profissional filtrado
      // 3) Se estiver criando/editando: profissional selecionado no formulário
      // 4) Se o usuário for um profissional: o próprio
      const selectedProfId =
        activeAppointment?.professional_id ||
        (filterProfessionals.length === 1
          ? filterProfessionals[0]
          : (formProfessional || (isProfessionalOnly && loggedInProfessionalId ? loggedInProfessionalId : null)));

      if (!selectedProfId) return defaultTimeSlots;

      const prof = professionals.find((p) => p.id === selectedProfId);
      const schedule = prof?.schedule as any;
      const appointmentDuration = prof?.appointment_duration || 30;
      if (!schedule) return defaultTimeSlots;

      const dayKey = getDayKey(selectedDate);
      const daySchedule = schedule?.[dayKey];
      const blocks = schedule?._blocks as Array<{ days: string[]; start_time: string; end_time: string; duration?: number; start_date?: string; end_date?: string }> | undefined;
      
      const slots: string[] = [];
      const dateStr = toDateKey(selectedDate);

      // Primeiro, verificar _blocks (nova estrutura de agenda)
      if (blocks && blocks.length > 0) {
        for (const block of blocks) {
          // Verificar se o bloco está ativo para esta data
          if (block.start_date && dateStr < block.start_date) continue;
          if (block.end_date && dateStr > block.end_date) continue;
          
          // Verificar se o dia da semana está incluído
          if (block.days && block.days.length > 0) {
            if (!block.days.includes(dayKey)) continue;
          }
          
          const [sh, sm] = String(block.start_time || '').split(':').map(Number);
          const [eh, em] = String(block.end_time || '').split(':').map(Number);
          if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) continue;
          
          const interval = block.duration || appointmentDuration;
          
          let cur = sh * 60 + sm;
          const end = eh * 60 + em;
          
          while (cur < end) {
            const h = Math.floor(cur / 60);
            const m = cur % 60;
            slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
            cur += interval;
          }
        }
      }
      
      // Se não tiver _blocks ou não gerou slots, usar estrutura antiga (slots por dia)
      if (slots.length === 0 && daySchedule?.enabled && Array.isArray(daySchedule.slots) && daySchedule.slots.length > 0) {
        for (const s of daySchedule.slots as Array<{ start: string; end: string }>) {
          const [sh, sm] = String(s.start || '').split(':').map(Number);
          const [eh, em] = String(s.end || '').split(':').map(Number);
          if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) continue;
          
          let cur = sh * 60 + sm;
          const end = eh * 60 + em;
          
          while (cur < end) {
            const h = Math.floor(cur / 60);
            const m = cur % 60;
            slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
            cur += appointmentDuration;
          }
        }
      }
      
      if (slots.length === 0) return defaultTimeSlots;

      return Array.from(new Set(slots)).sort();
    } catch (err) {
      console.error('[CalendarPage] Error calculating timeSlots:', err);
      return defaultTimeSlots;
    }
  }, [activeAppointment, filterProfessionals, formProfessional, isProfessionalOnly, loggedInProfessionalId, professionals, selectedDate]);

  // Agendamentos do profissional selecionado para a data selecionada (para TimeSlotPicker)
  const professionalAppointmentsForDate = useMemo(() => {
    const dateStr = toDateKey(selectedDate);
    const profId = formProfessional || (isProfessionalOnly && loggedInProfessionalId ? loggedInProfessionalId : null);
    if (!profId) return [];
    
    return appointments.filter(apt => 
      apt.appointment_date === dateStr && 
      apt.professional_id === profId
    ).map(apt => ({
      start_time: apt.start_time,
      end_time: apt.end_time,
      status: apt.status,
    }));
  }, [appointments, selectedDate, formProfessional, isProfessionalOnly, loggedInProfessionalId]);

  // Duração para o TimeSlotPicker
  const currentDuration = useMemo(() => {
    if (formDuration) return formDuration;
    const prof = professionals.find(p => p.id === formProfessional);
    return prof?.appointment_duration || 30;
  }, [formDuration, formProfessional, professionals]);

  const getDateRange = useCallback(() => {
    if (viewMode === "day") {
      const dateStr = toDateKey(selectedDate);
      return { startDate: dateStr, endDate: dateStr };
    } else if (viewMode === "week") {
      const start = new Date(selectedDate);
      start.setDate(start.getDate() - start.getDay());
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return {
        startDate: toDateKey(start),
        endDate: toDateKey(end),
      };
    } else {
      const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      return {
        startDate: toDateKey(start),
        endDate: toDateKey(end),
      };
    }
  }, [viewMode, selectedDate, currentDate]);

  const fetchAppointments = useCallback(async () => {
    if (!currentClinic) return;
    
    // Para profissionais, aguardar o ID ser carregado antes de buscar
    if (isProfessionalOnly && !loggedInProfessionalId) return;
    
    setLoading(true);
    
    try {
      const { startDate, endDate } = getDateRange();
      
      let query = supabase
        .from('appointments')
        .select(`
          id,
          appointment_date,
          start_time,
          end_time,
          type,
          status,
          notes,
          patient_id,
          professional_id,
          started_at,
          completed_at,
          duration_minutes,
          confirmation_token,
          procedure_id,
          dependent_id,
          procedure:procedures (id, name, price),
          patient:patients (id, name, phone, email, birth_date, no_show_blocked_until, no_show_unblocked_at, insurance_plan:insurance_plans (id, name, color)),
          professional:professionals (id, name, specialty, avatar_url),
          dependent:patient_dependents!appointments_dependent_id_fkey (id, name)
        `)
        .eq('clinic_id', currentClinic.id)
        .gte('appointment_date', startDate)
        .lte('appointment_date', endDate);

      // CORREÇÃO DE SEGURANÇA: Profissionais só veem seus próprios agendamentos
      if (isProfessionalOnly && loggedInProfessionalId) {
        query = query.eq('professional_id', loggedInProfessionalId);
      }

      const { data, error } = await query
        .order('appointment_date')
        .order('start_time');

      console.log('[DEBUG CalendarPage] fetchAppointments - startDate:', startDate, 'endDate:', endDate, 'count:', data?.length, 'isProfessionalOnly:', isProfessionalOnly, 'loggedInProfessionalId:', loggedInProfessionalId);

      if (error) throw error;
      setAppointments(data as unknown as Appointment[]);
    } catch (error) {
      console.error("Error fetching appointments:", error);
    } finally {
      setLoading(false);
    }
  }, [currentClinic, getDateRange, isProfessionalOnly, loggedInProfessionalId]);

  // Persist selected date, current date, and view mode to sessionStorage
  useEffect(() => {
    if (!isValidDate(selectedDate)) {
      console.error('[CalendarPage] selectedDate inválida:', selectedDate);
      toast({
        title: "Erro de data",
        description: "A data selecionada ficou inválida. Recarregue a página e tente novamente.",
        variant: "destructive",
      });
      return;
    }

    sessionStorage.setItem('calendar_selected_date', selectedDate.toISOString());
  }, [selectedDate, toast]);

  useEffect(() => {
    if (!isValidDate(currentDate)) {
      console.error('[CalendarPage] currentDate inválida:', currentDate);
      return;
    }
    sessionStorage.setItem('calendar_current_date', currentDate.toISOString());
  }, [currentDate]);

  useEffect(() => {
    sessionStorage.setItem('calendar_view_mode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (currentClinic) {
      fetchData();
      fetchHolidays();
    }
  }, [currentClinic]);

  // Fetch logged-in professional's ID if user is linked to a professional via user_roles
  useEffect(() => {
    const fetchLoggedInProfessional = async () => {
      if (!user?.id || !currentClinic?.id) return;
      
      // First check if user has a professional_id linked in user_roles
      const currentRole = userRoles.find(r => r.clinic_id === currentClinic.id);
      if (currentRole?.professional_id) {
        setLoggedInProfessionalId(currentRole.professional_id);
        setFormProfessional(currentRole.professional_id);
        // Auto-filter to this professional
        setFilterProfessionals([currentRole.professional_id]);
        return;
      }
      
      // Fallback: If user is professional-only, check by user_id in professionals table
      if (!isProfessionalOnly) return;
      
      const { data } = await supabase
        .from('professionals')
        .select('id')
        .eq('user_id', user.id)
        .eq('clinic_id', currentClinic.id)
        .maybeSingle();
      
      if (data) {
        setLoggedInProfessionalId(data.id);
        setFormProfessional(data.id);
      }
    };

    fetchLoggedInProfessional();
  }, [isProfessionalOnly, user?.id, currentClinic?.id, userRoles]);

  useEffect(() => {
    if (currentClinic) {
      fetchAppointments();
    }
  }, [currentClinic, selectedDate, viewMode, fetchAppointments]);

  const fetchData = async () => {
    if (!currentClinic) {
      console.log('[DEBUG CalendarPage] fetchData - currentClinic is null');
      return;
    }
    
    console.log('[DEBUG CalendarPage] fetchData - clinic_id:', currentClinic.id, 'user:', user?.id);
    
    try {
      const { data: patientsData, error: patientsError } = await supabase
        .from('patients')
        .select('id, name, phone, email, birth_date, cpf')
        .eq('clinic_id', currentClinic.id)
        .order('name');
      
      console.log('[DEBUG CalendarPage] patients fetched:', patientsData?.length, 'error:', patientsError);
      if (patientsData) setPatients(patientsData);

      let professionalsQuery = supabase
        .from('professionals')
        .select('id, name, specialty, appointment_duration, schedule, avatar_url')
        .eq('clinic_id', currentClinic.id)
        .eq('is_active', true);

      // CORREÇÃO DE SEGURANÇA: Profissionais só veem a si mesmos na lista
      // (precisa aguardar o loggedInProfessionalId ser carregado via useEffect separado)
      // A filtragem é feita depois via useMemo: availableProfessionals
      
      const { data: professionalsData, error: professionalsError } = await professionalsQuery.order('name');
      
      console.log('[DEBUG CalendarPage] professionals fetched:', professionalsData, 'error:', professionalsError);
      if (professionalsData) setProfessionals(professionalsData);

      // Fetch evolution config for direct reply setting
      const { data: evolutionConfig } = await supabase
        .from('evolution_configs')
        .select('direct_reply_enabled')
        .eq('clinic_id', currentClinic.id)
        .maybeSingle();
      
      if (evolutionConfig) {
        setDirectReplyEnabled(evolutionConfig.direct_reply_enabled ?? false);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  // Busca de pacientes no servidor com debounce
  const searchPatients = useCallback(async (query: string) => {
    if (!currentClinic || query.length < 2) {
      setPatientSearchResults([]);
      return;
    }

    setIsSearchingPatients(true);
    try {
      // Normaliza a busca removendo pontuação para CPF
      const normalizedQuery = query.replace(/[^\w\s]/g, '');
      
      // Busca por nome (usando ilike) ou CPF
      const { data, error } = await supabase
        .from('patients')
        .select('id, name, phone, email, birth_date, cpf, is_active')
        .eq('clinic_id', currentClinic.id)
        .eq('is_active', true)
        .or(`name.ilike.%${query}%,cpf.ilike.%${normalizedQuery}%`)
        .order('name')
        .limit(50);

      if (error) {
        console.error('Error searching patients:', error);
        return;
      }

      setPatientSearchResults(data || []);
    } catch (error) {
      console.error('Error searching patients:', error);
    } finally {
      setIsSearchingPatients(false);
    }
  }, [currentClinic]);

  // Debounce para busca de pacientes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (patientSearchQuery) {
        searchPatients(patientSearchQuery);
      } else {
        setPatientSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [patientSearchQuery, searchPatients]);

  const fetchHolidays = async () => {
    if (!currentClinic) return;

    try {
      const holidayMap = new Map<string, string>();
      const currentYear = new Date().getFullYear();
      const years = [currentYear, currentYear + 1];

      // Check if clinic has holidays enabled
      const { data: clinicData } = await supabase
        .from('clinics')
        .select('holidays_enabled, state_code, city')
        .eq('id', currentClinic.id)
        .single();

      if (clinicData?.holidays_enabled === false) {
        setHolidays(holidayMap);
        return;
      }

      // Fetch national holidays
      const { data: nationalHolidays } = await supabase
        .from('national_holidays')
        .select('name, holiday_date, is_recurring, recurring_month, recurring_day');

      nationalHolidays?.forEach((h: any) => {
        if (h.is_recurring && h.recurring_month && h.recurring_day) {
          years.forEach(year => {
            const dateStr = `${year}-${String(h.recurring_month).padStart(2, '0')}-${String(h.recurring_day).padStart(2, '0')}`;
            holidayMap.set(dateStr, h.name);
          });
        } else if (h.holiday_date) {
          holidayMap.set(h.holiday_date, h.name);
        }
      });

      // Fetch state holidays if clinic has state configured
      if (clinicData?.state_code) {
        const { data: stateHolidays } = await supabase
          .from('state_holidays')
          .select('name, holiday_date, is_recurring, recurring_month, recurring_day')
          .eq('state_code', clinicData.state_code);

        stateHolidays?.forEach((h: any) => {
          if (h.is_recurring && h.recurring_month && h.recurring_day) {
            years.forEach(year => {
              const dateStr = `${year}-${String(h.recurring_month).padStart(2, '0')}-${String(h.recurring_day).padStart(2, '0')}`;
              holidayMap.set(dateStr, h.name);
            });
          } else if (h.holiday_date) {
            holidayMap.set(h.holiday_date, h.name);
          }
        });
      }

      // Fetch municipal holidays if clinic has state and city configured
      if (clinicData?.state_code && clinicData?.city) {
        const { data: municipalHolidays } = await supabase
          .from('municipal_holidays')
          .select('name, holiday_date, is_recurring, recurring_month, recurring_day')
          .eq('state_code', clinicData.state_code)
          .eq('city', clinicData.city);

        municipalHolidays?.forEach((h: any) => {
          if (h.is_recurring && h.recurring_month && h.recurring_day) {
            years.forEach(year => {
              const dateStr = `${year}-${String(h.recurring_month).padStart(2, '0')}-${String(h.recurring_day).padStart(2, '0')}`;
              holidayMap.set(dateStr, h.name);
            });
          } else if (h.holiday_date) {
            holidayMap.set(h.holiday_date, h.name);
          }
        });
      }

      // Fetch clinic-specific holidays
      const { data: clinicHolidays } = await supabase
        .from('clinic_holidays')
        .select('name, holiday_date, is_recurring, recurring_month, recurring_day')
        .eq('clinic_id', currentClinic.id);

      clinicHolidays?.forEach((h: any) => {
        if (h.is_recurring && h.recurring_month && h.recurring_day) {
          years.forEach(year => {
            const dateStr = `${year}-${String(h.recurring_month).padStart(2, '0')}-${String(h.recurring_day).padStart(2, '0')}`;
            holidayMap.set(dateStr, h.name);
          });
        } else if (h.holiday_date) {
          holidayMap.set(h.holiday_date, h.name);
        }
      });

      setHolidays(holidayMap);
    } catch (error) {
      console.error('Error fetching holidays:', error);
    }
  };

  // Realtime subscription for automatic updates
  useRealtimeSubscription({
    table: "appointments",
    filter: currentClinic ? { column: "clinic_id", value: currentClinic.id } : undefined,
    onInsert: () => fetchAppointments(),
    onUpdate: () => fetchAppointments(),
    onDelete: () => fetchAppointments(),
    enabled: !!currentClinic,
  });

  // Filter and search appointments
  const filteredAppointments = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return appointments.filter(apt => {
      // For professional users, only show their own appointments
      if (isProfessionalOnly && loggedInProfessionalId && apt.professional_id !== loggedInProfessionalId) return false;
      // Filter cancelled/no_show appointments based on checkbox state
      if (!showCancelledNoShow && (apt.status === 'cancelled' || apt.status === 'no_show')) return false;
      if (filterProfessionals.length > 0 && !filterProfessionals.includes(apt.professional_id)) return false;
      if (filterType !== "all" && apt.type !== filterType) return false;
      if (query) {
        const patientName = apt.patient?.name?.toLowerCase() || "";
        const patient = patients.find(p => p.id === apt.patient_id);
        const patientPhone = patient?.phone?.toLowerCase() || "";
        if (!patientName.includes(query) && !patientPhone.includes(query)) return false;
      }
      return true;
    });
  }, [appointments, filterProfessionals, filterType, searchQuery, patients, showCancelledNoShow, isProfessionalOnly, loggedInProfessionalId]);

  // Lista de profissionais disponíveis (filtrada para usuários com papel professional)
  const availableProfessionals = useMemo(() => {
    if (isProfessionalOnly && loggedInProfessionalId) {
      return professionals.filter(p => p.id === loggedInProfessionalId);
    }
    return professionals;
  }, [professionals, isProfessionalOnly, loggedInProfessionalId]);

  // Detect conflicting appointments
  const conflictingAppointmentIds = useMemo(() => {
    return findAllConflictingAppointments(appointments);
  }, [appointments]);

  // Show notification when conflicts are detected
  useEffect(() => {
    if (conflictingAppointmentIds.size > 0 && !loading) {
      toast({
        title: `⚠️ ${conflictingAppointmentIds.size} agendamento(s) com conflito`,
        description: "Existem agendamentos com conflitos de horário. Verifique e ajuste os horários.",
        variant: "destructive",
        duration: 6000,
      });
    }
  }, [conflictingAppointmentIds.size, loading]);

  // Status priority for sorting (active appointments first)
  const statusPriority: Record<string, number> = {
    'in_progress': 1,   // Em atendimento - máxima prioridade
    'scheduled': 2,     // Agendado
    'confirmed': 3,     // Confirmado
    'cancelled': 4,     // Cancelado - baixa prioridade
    'completed': 5,     // Concluído - baixa prioridade
    'no_show': 6,       // Não compareceu - baixa prioridade
  };

  // Get appointments for a specific date (sorted by status priority then by time)
  const getAppointmentsForDate = (date: Date) => {
    const dateStr = toDateKey(date);
    return filteredAppointments
      .filter((apt) => apt.appointment_date === dateStr)
      .sort((a, b) => {
        // First: sort by status priority
        const priorityA = statusPriority[a.status] || 99;
        const priorityB = statusPriority[b.status] || 99;

        if (priorityA !== priorityB) {
          return priorityA - priorityB;
        }

        // Second: sort by time (within same priority group)
        return a.start_time.localeCompare(b.start_time);
      });
  };

  const isHoliday = (date: Date): string | null => {
    const dateStr = toDateKey(date);
    return holidays.get(dateStr) || null;
  };

  const handleCreateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Proteção contra clique duplo - verificar se já está salvando
    if (saving) return;
    
    // Verificar se tem múltiplos horários selecionados (modo manual de recorrência)
    const hasMultipleSlots = recurrenceConfig.enabled && Array.isArray(selectedMultipleTimes) && selectedMultipleTimes.length > 0;
    const effectiveTime = hasMultipleSlots ? selectedMultipleTimes[0] : formTime;
    
    // Validação mais robusta do horário
    const isTimeValid = effectiveTime && typeof effectiveTime === 'string' && effectiveTime.match(/^\d{2}:\d{2}$/);
    
    if (!formPatient || !formProfessional || (!isTimeValid && !hasMultipleSlots)) {
      toast({
        title: "Campos obrigatórios",
        description: !formPatient ? "Selecione um paciente." : 
                     !formProfessional ? "Selecione um profissional." :
                     "Selecione um horário disponível.",
        variant: "destructive",
      });
      return;
    }

    if (!currentClinic || !user) return;
    
    // Mover setSaving para o início para evitar cliques duplos
    setSaving(true);

    // Validate recurrence config - só exigir data final se não tiver múltiplos slots selecionados
    if (recurrenceConfig.enabled && !hasMultipleSlots && recurrenceConfig.limitType === "date" && !recurrenceConfig.endDate) {
      toast({
        title: "Data final obrigatória",
        description: "Informe a data final para agendamentos recorrentes.",
        variant: "destructive",
      });
      setSaving(false);
      return;
    }

    // Check if patient is active before creating appointment
    const { data: patientData, error: patientError } = await supabase
      .from('patients')
      .select('is_active, name')
      .eq('id', formPatient)
      .single();

    if (patientError || !patientData) {
      toast({
        title: "Paciente não encontrado",
        description: "O paciente selecionado não foi encontrado.",
        variant: "destructive",
      });
      setSaving(false);
      return;
    }

    if (patientData.is_active === false) {
      toast({
        title: "Paciente inativo",
        description: `${patientData.name} está inativo e não pode realizar agendamentos.`,
        variant: "destructive",
      });
      setSaving(false);
      return;
    }

    // Usar duração do formulário (se definida) ou duração padrão do profissional
    const selectedProfessional = professionals.find(p => p.id === formProfessional);
    const defaultDuration = selectedProfessional?.appointment_duration || 30;
    const durationMinutes = formDuration ?? defaultDuration;
    
    // Determinar lista de agendamentos a criar
    let appointmentsToCreate: Array<{
      clinic_id: string;
      patient_id: string;
      professional_id: string;
      appointment_date: string;
      start_time: string;
      end_time: string;
      type: "first_visit" | "return" | "exam" | "procedure";
      status: "scheduled";
      notes: string | null;
      created_by: string;
      duration_minutes: number;
      is_recurring: boolean;
      recurrence_group_id: string | null;
    }> = [];
    
    const recurrenceGroupId = recurrenceConfig.enabled ? generateId() : null;
    const dateStr = selectedDate.toISOString().split('T')[0];
    
    if (hasMultipleSlots) {
      // Modo com múltiplos horários selecionados - criar na mesma data
      // Verificar conflitos para cada horário
      for (const time of selectedMultipleTimes) {
        const conflicts = findConflictingAppointments(appointments, {
          appointmentDate: dateStr,
          startTime: time,
          durationMinutes,
          professionalId: formProfessional,
        });

        if (conflicts.length > 0) {
          const patientNames: Record<string, string> = {};
          conflicts.forEach(c => {
            const apt = appointments.find(a => a.id === c.id);
            if (apt?.patient?.name) {
              patientNames[c.id] = apt.patient.name;
            }
          });
          
          toast({
            title: "Conflito de horário",
            description: `Conflito às ${time}: ${getConflictMessage(conflicts, patientNames)}`,
            variant: "destructive",
          });
          setSaving(false);
          return;
        }
        
        appointmentsToCreate.push({
          clinic_id: currentClinic.id,
          patient_id: formPatient,
          professional_id: formProfessional,
          appointment_date: dateStr,
          start_time: time,
          end_time: calculateEndTime(time, durationMinutes),
          type: formType as "first_visit" | "return" | "exam" | "procedure",
          status: "scheduled" as const,
          notes: formNotes.trim() || null,
          created_by: user.id,
          duration_minutes: durationMinutes,
          is_recurring: true,
          recurrence_group_id: recurrenceGroupId,
        });
      }
    } else {
      // Modo padrão - usar datas recorrentes calculadas
      const recurringDates = calculateRecurringDates(selectedDate, recurrenceConfig);
      
      // Check for conflicts on all dates
      for (const date of recurringDates) {
        const dateDateStr = date.toISOString().split('T')[0];
        const conflicts = findConflictingAppointments(appointments, {
          appointmentDate: dateDateStr,
          startTime: formTime,
          durationMinutes,
          professionalId: formProfessional,
        });

        if (conflicts.length > 0) {
          const patientNames: Record<string, string> = {};
          conflicts.forEach(c => {
            const apt = appointments.find(a => a.id === c.id);
            if (apt?.patient?.name) {
              patientNames[c.id] = apt.patient.name;
            }
          });
          
          toast({
            title: "Conflito de horário",
            description: `Conflito em ${date.toLocaleDateString('pt-BR')}: ${getConflictMessage(conflicts, patientNames)}`,
            variant: "destructive",
          });
          setSaving(false);
          return;
        }
        
        appointmentsToCreate.push({
          clinic_id: currentClinic.id,
          patient_id: formPatient,
          professional_id: formProfessional,
          appointment_date: dateDateStr,
          start_time: formTime,
          end_time: calculateEndTime(formTime, durationMinutes),
          type: formType as "first_visit" | "return" | "exam" | "procedure",
          status: "scheduled" as const,
          notes: formNotes.trim() || null,
          created_by: user.id,
          duration_minutes: durationMinutes,
          is_recurring: recurrenceConfig.enabled,
          recurrence_group_id: recurrenceGroupId,
        });
      }
    }

    try {
      const { error } = await supabase
        .from('appointments')
        .insert(appointmentsToCreate);

      if (error) throw error;

      const count = appointmentsToCreate.length;
      toast({
        title: count > 1 ? `${count} agendamentos criados` : "Agendamento criado",
        description: count > 1 
          ? `Foram agendadas ${count} consultas com sucesso.`
          : "A consulta foi agendada com sucesso.",
      });

      setDialogOpen(false);
      resetForm();
      fetchAppointments();
    } catch (error: any) {
      const { isScheduleError, message } = handleScheduleValidationError(error);
      toast({
        title: isScheduleError ? "Horário indisponível" : "Erro ao agendar",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEditAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formPatient || !formProfessional || !formTime || !editingAppointment) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    // Check if patient is active before editing appointment
    const { data: patientData, error: patientError } = await supabase
      .from('patients')
      .select('is_active, name')
      .eq('id', formPatient)
      .single();

    if (patientError || !patientData) {
      toast({
        title: "Paciente não encontrado",
        description: "O paciente selecionado não foi encontrado.",
        variant: "destructive",
      });
      return;
    }

    if (patientData.is_active === false) {
      toast({
        title: "Paciente inativo",
        description: `${patientData.name} está inativo e não pode realizar agendamentos.`,
        variant: "destructive",
      });
      return;
    }

    const durationMinutes = formDuration ?? editingAppointment.duration_minutes ?? 30;
    
    // Check for conflicts before saving (exclude current appointment)
    const conflicts = findConflictingAppointments(appointments, {
      appointmentDate: editingAppointment.appointment_date,
      startTime: formTime,
      durationMinutes,
      professionalId: formProfessional,
      excludeAppointmentId: editingAppointment.id,
    });

    if (conflicts.length > 0) {
      const patientNames: Record<string, string> = {};
      conflicts.forEach(c => {
        const apt = appointments.find(a => a.id === c.id);
        if (apt?.patient?.name) {
          patientNames[c.id] = apt.patient.name;
        }
      });
      
      toast({
        title: "Conflito de horário",
        description: getConflictMessage(conflicts, patientNames),
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    try {
      const endTime = calculateEndTime(formTime, durationMinutes);

      const { error } = await supabase
        .from('appointments')
        .update({
          patient_id: formPatient,
          professional_id: formProfessional,
          start_time: formTime,
          end_time: endTime,
          type: formType as "first_visit" | "return" | "exam" | "procedure",
          notes: formNotes.trim() || null,
          duration_minutes: durationMinutes,
        })
        .eq('id', editingAppointment.id);

      if (error) throw error;

      toast({
        title: "Agendamento atualizado",
        description: "As alterações foram salvas com sucesso.",
      });

      setEditDialogOpen(false);
      setEditingAppointment(null);
      resetForm();
      fetchAppointments();
    } catch (error: any) {
      const { isScheduleError, message } = handleScheduleValidationError(error);
      toast({
        title: isScheduleError ? "Horário indisponível" : "Erro ao atualizar",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCancelAppointment = async () => {
    if (!cancellingAppointment) return;

    setSaving(true);

    try {
      const { error } = await supabase
        .from('appointments')
        .update({
          status: "cancelled" as const,
          cancellation_reason: cancelReason.trim() || null,
          cancelled_at: new Date().toISOString(),
        })
        .eq('id', cancellingAppointment.id);

      if (error) throw error;

      // Check waiting list and notify first patient
      if (currentClinic) {
        const { data: waitingPatients } = await supabase
          .from('waiting_list')
          .select('*, patient:patients(id, name, phone)')
          .eq('clinic_id', currentClinic.id)
          .eq('is_active', true)
          .order('created_at', { ascending: true });

        if (waitingPatients && waitingPatients.length > 0) {
          const firstWaiting = waitingPatients[0];
          const formattedDate = new Date(cancellingAppointment.appointment_date + 'T12:00:00').toLocaleDateString('pt-BR');
          
          // Try to send WhatsApp notification
          if (firstWaiting.patient?.phone) {
            const message = `Olá ${firstWaiting.patient.name}! 🎉\n\n` +
              `Temos uma boa notícia! Uma vaga abriu para o dia ${formattedDate} às ${cancellingAppointment.start_time.slice(0, 5)}.\n\n` +
              `Entre em contato conosco o mais rápido possível para confirmar o agendamento.\n\n` +
              `Atenciosamente,\n${currentClinic.name}`;

            sendWhatsAppMessage({
              phone: firstWaiting.patient.phone,
              message,
              clinicId: currentClinic.id,
              type: 'custom',
            }).then(result => {
              if (result.success) {
                toast({
                  title: "Lista de espera notificada",
                  description: `${firstWaiting.patient.name} foi notificado sobre a vaga disponível.`,
                });
              }
            }).catch(err => {
              console.error('Error sending waiting list notification:', err);
            });
          }

          toast({
            title: "Agendamento cancelado",
            description: `Vaga liberada! ${waitingPatients.length} paciente(s) na lista de espera.`,
          });
        } else {
          toast({
            title: "Agendamento cancelado",
            description: "A consulta foi cancelada com sucesso.",
          });
        }
      } else {
        toast({
          title: "Agendamento cancelado",
          description: "A consulta foi cancelada com sucesso.",
        });
      }

      setCancelDialogOpen(false);
      setCancellingAppointment(null);
      setCancelReason("");
      fetchAppointments();
    } catch (error: any) {
      toast({
        title: "Erro ao cancelar",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStatus = async (appointment: Appointment, newStatus: string) => {
    try {
      const updateData: Record<string, any> = {
        status: newStatus as "scheduled" | "confirmed" | "arrived" | "completed" | "cancelled" | "no_show" | "in_progress",
      };

      if (newStatus === "confirmed") {
        updateData.confirmed_at = new Date().toISOString();
      }

      if (newStatus === "arrived") {
        // Mark that patient has arrived
        updateData.confirmed_at = updateData.confirmed_at || new Date().toISOString();
      }

      const { error } = await supabase
        .from('appointments')
        .update(updateData)
        .eq('id', appointment.id);

      if (error) throw error;

      // Send WhatsApp confirmation when status is confirmed
      if (newStatus === "confirmed" && currentClinic) {
        const patient = patients.find(p => p.id === appointment.patient_id);
        const professional = professionals.find(p => p.id === appointment.professional_id);
        
        if (patient?.phone) {
          const formattedDate = new Date(appointment.appointment_date + 'T12:00:00').toLocaleDateString('pt-BR');
          const message = formatAppointmentConfirmation(
            patient.name,
            currentClinic.name,
            formattedDate,
            appointment.start_time,
            professional?.name
          );
          
          sendWhatsAppMessage({
            phone: patient.phone,
            message,
            clinicId: currentClinic.id,
            type: 'confirmation',
          }).then(result => {
            if (!result.success) {
              const isNotConnected = result.error?.includes("não está conectado") || 
                                     result.error?.includes("não configurado");
              toast({
                title: isNotConnected ? "WhatsApp não conectado" : "Erro ao enviar confirmação",
                description: isNotConnected 
                  ? "Configure o WhatsApp nas Configurações → Integração WhatsApp" 
                  : result.error,
                variant: "destructive",
                action: isNotConnected ? (
                  <ToastAction altText="Configurar" onClick={() => navigate("/dashboard/settings")}>
                    Configurar
                  </ToastAction>
                ) : undefined,
              });
            }
          }).catch(err => {
            console.error('Error sending WhatsApp confirmation:', err);
          });
        }
      }

      toast({
        title: "Status atualizado",
        description: `Agendamento marcado como ${statusConfig[newStatus as keyof typeof statusConfig]?.label || newStatus}.`,
      });

      fetchAppointments();
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar status",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
    }
  };

  // Handle patient arrival - update status and open pre-attendance dialog
  const handlePatientArrived = async (appointment: Appointment) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({
          status: 'arrived' as const,
          confirmed_at: new Date().toISOString(),
        })
        .eq('id', appointment.id);

      if (error) throw error;

      toast({
        title: "Paciente chegou",
        description: "Registre os sinais vitais no pré-atendimento.",
      });

      // Refresh appointments list
      await fetchAppointments();

      // Open pre-attendance dialog
      setPreAttendanceAppointment(appointment);
      setPreAttendanceDialogOpen(true);
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar status",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
    }
  };

  // Start appointment and navigate directly to attendance page
  const handleStartAttendance = async (appointment: Appointment) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({
          status: 'in_progress',
          started_at: new Date().toISOString(),
        })
        .eq('id', appointment.id);

      if (error) throw error;

      toast({
        title: "Atendimento iniciado",
        description: "Bom atendimento!",
      });

      // Navigate directly to attendance page
      navigate(`/dashboard/atendimento/${appointment.id}`);
    } catch (error: any) {
      toast({
        title: "Erro ao iniciar atendimento",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
    }
  };

  // Helper function to check if date/time is in the past
  const isDateTimeInPast = (date: string, time: string): boolean => {
    const now = new Date();
    const targetDateTime = new Date(`${date}T${time}:00`);
    return targetDateTime < now;
  };

  const handleReschedule = async () => {
    if (!reschedulingAppointment || !newDate || !newTime) return;

    // Validate: cannot reschedule to past date/time
    if (isDateTimeInPast(newDate, newTime)) {
      toast({
        title: "Horário não permitido",
        description: "Não é possível reagendar para uma data ou horário que já passou.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    try {
      const [hours, minutes] = newTime.split(':');
      const endHours = parseInt(hours) + (parseInt(minutes) + 30 >= 60 ? 1 : 0);
      const endMinutes = (parseInt(minutes) + 30) % 60;
      const endTime = `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;

      const { error } = await supabase
        .from('appointments')
        .update({
          appointment_date: newDate,
          start_time: newTime,
          end_time: endTime,
        })
        .eq('id', reschedulingAppointment.id);

      if (error) throw error;

      toast({
        title: "Agendamento reagendado",
        description: "A consulta foi reagendada com sucesso.",
      });

      setRescheduleDialogOpen(false);
      setReschedulingAppointment(null);
      setNewDate("");
      setNewTime("");
      fetchAppointments();
    } catch (error: any) {
      const { isScheduleError, message } = handleScheduleValidationError(error);
      toast({
        title: isScheduleError ? "Horário indisponível" : "Erro ao reagendar",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const openEditDialog = (appointment: Appointment) => {
    navigate(`/dashboard/appointments/${appointment.id}/edit?returnTo=/dashboard/calendar`);
  };

  const openCancelDialog = (appointment: Appointment) => {
    setCancellingAppointment(appointment);
    setCancelReason("");
    setCancelDialogOpen(true);
  };

  const openRescheduleDialog = (appointment: Appointment) => {
    setReschedulingAppointment(appointment);
    setNewDate(appointment.appointment_date);
    setNewTime(appointment.start_time.slice(0, 5));
    setRescheduleDialogOpen(true);
  };

  const openAuditDialog = (appointment: Appointment) => {
    setAuditAppointment(appointment);
    setAuditDialogOpen(true);
  };

  const resetForm = () => {
    setFormPatient("");
    setSelectedPatientName("");
    // Keep professional selection for logged-in professionals
    if (!loggedInProfessionalId) {
      setFormProfessional("");
    }
    setFormTime("");
    setFormType("first_visit");
    setFormNotes("");
    setFormDuration(null); // Resetar para usar duração padrão do profissional
    setSelectedMultipleTimes([]); // Limpar seleção múltipla
    // Reset recurrence
    setRecurrenceConfig({
      enabled: false,
      frequency: "weekly",
      limitType: "sessions",
      sessions: 4,
      endDate: "",
    });
  };

  const openNewAppointmentWithTime = (time: string, date?: Date) => {
    // Check permission before opening dialog
    if (!hasPermission('manage_calendar')) return;
    
    resetForm();
    setFormTime(time);
    if (date) {
      setSelectedDate(date);
    }
    setDialogOpen(true);
  };

  const openAppointmentPanel = (appointment: Appointment) => {
    // Recepcionistas/atendentes não têm acesso à página de atendimento
    // Eles podem apenas editar o agendamento
    if (!canAttendPatient) {
      openEditDialog(appointment);
      return;
    }
    // Navigate to dedicated attendance page instead of opening modal
    navigate(`/dashboard/atendimento/${appointment.id}`);
  };

  // Drag and Drop handlers
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const appointment = active.data.current?.appointment;
    if (appointment) {
      setActiveAppointment(appointment);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveAppointment(null);

    if (!over) return;

    const appointment = active.data.current?.appointment as Appointment;
    if (!appointment) return;

    // Parse the drop target ID (format: "date_time")
    const overId = over.id as string;
    const [newDate, newTime] = overId.split('_');

    if (!newDate || !newTime) return;

    // Check if the appointment was dropped in its original position
    const originalDate = active.data.current?.originalDate;
    const originalTime = active.data.current?.originalTime;
    
    if (newDate === originalDate && newTime === originalTime) {
      return; // No change needed
    }

    // Check for conflicts using the proper conflict detection
    const duration = appointment.duration_minutes || 30;
    const conflicts = findConflictingAppointments(appointments, {
      appointmentDate: newDate,
      startTime: newTime,
      durationMinutes: duration,
      professionalId: appointment.professional_id,
      excludeAppointmentId: appointment.id,
    });

    if (conflicts.length > 0) {
      const patientNames: Record<string, string> = {};
      conflicts.forEach(c => {
        const apt = appointments.find(a => a.id === c.id);
        if (apt?.patient?.name) {
          patientNames[c.id] = apt.patient.name;
        }
      });
      
      toast({
        title: "Conflito de horário",
        description: getConflictMessage(conflicts, patientNames),
        variant: "destructive",
      });
      return;
    }

    // Validate: cannot reschedule to past date/time
    if (isDateTimeInPast(newDate, newTime)) {
      toast({
        title: "Horário não permitido",
        description: "Não é possível reagendar para uma data ou horário que já passou.",
        variant: "destructive",
      });
      return;
    }

    // Calculate end time based on duration
    const endTime = calculateEndTime(newTime, duration);

    // Store original values for undo
    const originalAppointmentDate = appointment.appointment_date;
    const originalStartTime = appointment.start_time;
    const originalEndTime = appointment.end_time;

    // Update in database
    try {
      const { error } = await supabase
        .from('appointments')
        .update({
          appointment_date: newDate,
          start_time: newTime,
          end_time: endTime,
        })
        .eq('id', appointment.id);

      if (error) throw error;

      const formattedOldDate = new Date(originalAppointmentDate + 'T12:00:00').toLocaleDateString('pt-BR');
      const formattedNewDate = new Date(newDate + 'T12:00:00').toLocaleDateString('pt-BR');

      toast({
        title: "✓ Agendamento reagendado",
        description: `${getAppointmentDisplayName(appointment)}: ${formattedOldDate} ${originalStartTime.slice(0, 5)} → ${formattedNewDate} ${newTime}`,
        action: (
          <ToastAction 
            altText="Desfazer" 
            onClick={async () => {
              try {
                await supabase
                  .from('appointments')
                  .update({
                    appointment_date: originalAppointmentDate,
                    start_time: originalStartTime,
                    end_time: originalEndTime,
                  })
                  .eq('id', appointment.id);
                
                toast({
                  title: "Reagendamento desfeito",
                  description: `Voltou para ${formattedOldDate} às ${originalStartTime.slice(0, 5)}`,
                });
                
                fetchAppointments();
              } catch (undoError) {
                toast({
                  title: "Erro ao desfazer",
                  description: "Não foi possível desfazer o reagendamento.",
                  variant: "destructive",
                });
              }
            }}
          >
            Desfazer
          </ToastAction>
        ),
      });

      fetchAppointments();
    } catch (error: any) {
      const { isScheduleError, message } = handleScheduleValidationError(error);
      toast({
        title: isScheduleError ? "Horário indisponível" : "Erro ao reagendar",
        description: message,
        variant: "destructive",
      });
    }
  };

  const handleDragCancel = () => {
    setActiveAppointment(null);
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();
    
    const days = [];
    
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDay - 1; i >= 0; i--) {
      days.push({ day: prevMonthLastDay - i, isCurrentMonth: false, date: new Date(year, month - 1, prevMonthLastDay - i) });
    }
    
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ day: i, isCurrentMonth: true, date: new Date(year, month, i) });
    }
    
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push({ day: i, isCurrentMonth: false, date: new Date(year, month + 1, i) });
    }
    
    return days;
  };

  const getWeekDays = () => {
    const start = new Date(selectedDate);
    start.setDate(start.getDate() - start.getDay());
    const days = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const navigateMonth = (direction: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + direction, 1));
  };

  const navigateWeek = (direction: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + (direction * 7));
    setSelectedDate(newDate);
    setCurrentDate(newDate);
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const isSelected = (date: Date) => {
    return (
      date.getDate() === selectedDate.getDate() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getFullYear() === selectedDate.getFullYear()
    );
  };

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    if (viewMode === "month") {
      setViewMode("day");
    }
  };

  const typeLabels: Record<string, string> = {
    first_visit: "Primeira Consulta",
    return: "Retorno",
    exam: "Exame",
    procedure: "Procedimento",
  };

  const hasActiveFilters = filterProfessionals.length > 0 || filterType !== "all" || searchQuery.trim() !== "";

  const handleSendWhatsAppReminder = async (appointment: Appointment) => {
    // Para dependentes: nome do dependente; telefone: sempre do titular (paciente)
    const displayName = getAppointmentDisplayName(appointment);
    // Preferir o telefone já vindo no join; fallback para a lista de pacientes carregada na tela
    const phoneToUse = appointment.patient?.phone || patients.find(p => p.id === appointment.patient_id)?.phone;

    if (!phoneToUse) {
      toast({
        title: "Erro",
        description: appointment.dependent_id 
          ? "Dependente e titular não possuem telefone cadastrado."
          : "Paciente não possui telefone cadastrado.",
        variant: "destructive",
      });
      return;
    }

    setSendingWhatsApp(appointment.id);

    try {
      const appointmentDate = new Date(appointment.appointment_date + 'T12:00:00');
      const formattedDate = appointmentDate.toLocaleDateString('pt-BR', { 
        weekday: 'long', 
        day: 'numeric', 
        month: 'long' 
      });
      
      // Build confirmation link only if direct reply is NOT enabled
      const baseUrl = window.location.origin;
      const confirmationLink = (!directReplyEnabled && appointment.confirmation_token)
        ? `${baseUrl}/consulta/${appointment.confirmation_token}`
        : undefined;
      
      const message = formatAppointmentReminder(
        displayName,
        currentClinic?.name || 'Clínica',
        formattedDate,
        appointment.start_time.slice(0, 5),
        appointment.professional?.name || 'Profissional',
        confirmationLink,
        directReplyEnabled
      );

      const { data, error } = await supabase.functions.invoke('send-whatsapp', {
        body: { 
          phone: phoneToUse, 
          message, 
          clinicId: currentClinic?.id,
          type: directReplyEnabled ? 'reminder_direct_reply' : 'reminder'
        },
      });

      if (error) throw error;

      if (data?.success) {
        // If direct reply is enabled, register pending confirmation
        if (directReplyEnabled && currentClinic) {
          const formattedPhone = phoneToUse.replace(/\D/g, '');
          const phoneWithCountry = formattedPhone.startsWith('55') ? formattedPhone : '55' + formattedPhone;
          
          // Calculate expiry time (1 hour before appointment)
          const appointmentDateTime = new Date(`${appointment.appointment_date}T${appointment.start_time}`);
          const expiresAt = new Date(appointmentDateTime.getTime() - 60 * 60 * 1000);

          await supabase
            .from('pending_confirmations')
            .insert({
              clinic_id: currentClinic.id,
              appointment_id: appointment.id,
              phone: phoneWithCountry,
              expires_at: expiresAt.toISOString(),
              status: 'pending'
            });
        }

        toast({
          title: "Lembrete enviado",
          description: directReplyEnabled 
            ? `Mensagem enviada para ${displayName}. Aguardando resposta SIM ou NÃO.`
            : `Mensagem enviada para ${displayName}.`,
        });
      } else {
        throw new Error(data?.error || 'Erro ao enviar mensagem');
      }
    } catch (error: any) {
      const errorMessage = error.message || "";
      const isNotConnected = errorMessage.includes("não está conectado") || 
                             errorMessage.includes("não configurado") ||
                             errorMessage.includes("Edge Function returned a non-2xx");
      
      toast({
        title: isNotConnected ? "WhatsApp não conectado" : "Erro ao enviar WhatsApp",
        description: isNotConnected 
          ? "Configure e conecte o WhatsApp nas Configurações → Integração WhatsApp" 
          : (errorMessage || "Tente novamente."),
        variant: "destructive",
        action: isNotConnected ? (
          <ToastAction altText="Ir para configurações" onClick={() => navigate("/dashboard/settings")}>
            Configurar
          </ToastAction>
        ) : undefined,
      });
    } finally {
      setSendingWhatsApp(null);
    }
  };

  // Envio de lembretes em massa para todos os agendamentos visíveis de um profissional
  const handleBulkWhatsAppReminder = async (professionalId: string, appointmentsToSend: Appointment[]) => {
    // Filtrar apenas agendamentos elegíveis (não cancelados, não concluídos, não faltou)
    const eligibleAppointments = appointmentsToSend.filter(apt => 
      apt.status !== 'cancelled' && 
      apt.status !== 'completed' && 
      apt.status !== 'no_show'
    );

    if (eligibleAppointments.length === 0) {
      toast({
        title: "Nenhum agendamento elegível",
        description: "Não há agendamentos pendentes para enviar lembrete.",
        variant: "destructive",
      });
      return;
    }

    setSendingBulkReminder(professionalId);

    let successCount = 0;
    let errorCount = 0;

    for (const appointment of eligibleAppointments) {
      const patient = patients.find(p => p.id === appointment.patient_id);
      const displayName = getAppointmentDisplayName(appointment);
      const phoneToUse = patient?.phone;

      if (!phoneToUse) {
        errorCount++;
        continue;
      }

      try {
        const appointmentDate = new Date(appointment.appointment_date + 'T12:00:00');
        const formattedDate = appointmentDate.toLocaleDateString('pt-BR', { 
          weekday: 'long', 
          day: 'numeric', 
          month: 'long' 
        });
        
        const baseUrl = window.location.origin;
        const confirmationLink = (!directReplyEnabled && appointment.confirmation_token)
          ? `${baseUrl}/consulta/${appointment.confirmation_token}`
          : undefined;
        
        const message = formatAppointmentReminder(
          displayName,
          currentClinic?.name || 'Clínica',
          formattedDate,
          appointment.start_time.slice(0, 5),
          appointment.professional?.name || 'Profissional',
          confirmationLink,
          directReplyEnabled
        );

        const { data, error } = await supabase.functions.invoke('send-whatsapp', {
          body: { 
            phone: phoneToUse, 
            message, 
            clinicId: currentClinic?.id,
            type: directReplyEnabled ? 'reminder_direct_reply' : 'reminder'
          },
        });

        if (error) {
          errorCount++;
        } else if (data?.success) {
          successCount++;
        } else {
          errorCount++;
        }

        // Pequeno delay para não sobrecarregar a API
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch {
        errorCount++;
      }
    }

    setSendingBulkReminder(null);

    toast({
      title: "Lembretes enviados",
      description: `${successCount} enviado(s) com sucesso${errorCount > 0 ? `, ${errorCount} falha(s)` : ''}.`,
      variant: successCount > 0 ? "default" : "destructive",
    });
  };

  const handleSendTelemedicineLink = async (appointment: Appointment) => {
    // Para dependentes: nome do dependente; telefone: sempre do titular (paciente)
    const displayName = getAppointmentDisplayName(appointment);
    const phoneToUse = appointment.patient?.phone;

    if (!phoneToUse) {
      toast({
        title: "Telefone não cadastrado",
        description: appointment.dependent_id 
          ? "Dependente e titular não possuem telefone para envio do WhatsApp."
          : "O paciente não possui telefone para envio do WhatsApp.",
        variant: "destructive",
      });
      return;
    }

    if (!currentClinic) return;

    setSendingTelemedicineLink(appointment.id);

    try {
      // Buscar ou criar sessão de telemedicina
      const { data: sessionData, error: sessionError } = await supabase.functions.invoke('telemedicine', {
        body: { 
          action: 'create-session',
          appointmentId: appointment.id,
          clinicId: currentClinic.id
        },
      });

      if (sessionError || !sessionData?.session) {
        throw new Error(sessionError?.message || "Erro ao criar sessão de telemedicina");
      }

      const telemedicineLink = `${window.location.origin}/telemedicina/${sessionData.session.patient_token}`;
      
      // Formatar data
      const dateObj = new Date(appointment.appointment_date + 'T00:00:00');
      const formattedDate = dateObj.toLocaleDateString('pt-BR');
      const formattedTime = appointment.start_time.slice(0, 5);

      const message = formatTelemedicineInvite(
        displayName,
        currentClinic.name || "Clínica",
        formattedDate,
        formattedTime,
        appointment.professional?.name || "Profissional",
        telemedicineLink
      );

      const result = await sendWhatsAppMessage({
        phone: phoneToUse,
        message,
        clinicId: currentClinic.id,
        type: "custom",
      });

      if (result.success) {
        toast({
          title: "Link enviado! 📹",
          description: `Link da teleconsulta enviado para ${phoneToUse}`,
        });
      } else {
        throw new Error(result.error || "Erro ao enviar mensagem");
      }
    } catch (error: any) {
      const errorMessage = error.message || "";
      const isNotConnected = errorMessage.includes("não está conectado") || 
                             errorMessage.includes("não configurado") ||
                             errorMessage.includes("Edge Function returned a non-2xx");
      
      toast({
        title: isNotConnected ? "WhatsApp não conectado" : "Erro ao enviar",
        description: isNotConnected 
          ? "Configure e conecte o WhatsApp nas Configurações → Integração WhatsApp" 
          : errorMessage,
        variant: "destructive",
        action: isNotConnected ? (
          <ToastAction altText="Ir para configurações" onClick={() => navigate("/dashboard/settings")}>
            Configurar
          </ToastAction>
        ) : undefined,
      });
    } finally {
      setSendingTelemedicineLink(null);
    }
  };

  const AppointmentFormFields = () => (
    <>
      <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10">
        <CalendarIcon className="h-5 w-5 text-primary" />
        <span className="font-medium text-foreground">
          {formatPtBrLongDate(selectedDate)}
        </span>
      </div>

      <div className="space-y-2">
        <Label>Paciente *</Label>
        <Popover open={patientSearchOpen} onOpenChange={(open) => {
          setPatientSearchOpen(open);
          if (!open) {
            setPatientSearchQuery("");
            setPatientSearchResults([]);
          }
        }}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={patientSearchOpen}
              className="w-full justify-between bg-background font-normal"
            >
              {selectedPatientName || "Digite para buscar paciente..."}
              <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
            <div className="p-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  autoFocus
                  placeholder="Buscar por nome ou CPF..."
                  value={patientSearchQuery}
                  onChange={(e) => setPatientSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="max-h-[320px] overflow-auto p-1 border-t">
              {isSearchingPatients ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                  Buscando...
                </div>
              ) : patientSearchQuery.length < 2 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Digite ao menos 2 caracteres para buscar
                </div>
              ) : patientSearchResults.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Nenhum paciente encontrado.
                </div>
              ) : (
                <div className="space-y-1">
                  {patientSearchResults.map((patient) => (
                    <button
                      key={patient.id}
                      type="button"
                      className={cn(
                        "w-full flex items-start gap-2 rounded-md px-2 py-2 text-left hover:bg-muted transition-colors",
                        formPatient === patient.id && "bg-muted"
                      )}
                      onClick={() => {
                        setFormPatient(patient.id);
                        setSelectedPatientName(patient.name);
                        setPatientSearchOpen(false);
                        setPatientSearchQuery("");
                        setPatientSearchResults([]);
                      }}
                    >
                      <Check
                        className={cn(
                          "mt-0.5 h-4 w-4",
                          formPatient === patient.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex flex-col">
                        <span className="text-sm">{patient.name}</span>
                        {patient.cpf && (
                          <span className="text-xs text-muted-foreground">
                            CPF: {patient.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div className="space-y-2">
        <Label>Profissional *</Label>
        <Select 
          value={formProfessional} 
          onValueChange={setFormProfessional}
          disabled={!!loggedInProfessionalId}
        >
          <SelectTrigger className="bg-background">
            <SelectValue placeholder="Selecione o profissional" />
          </SelectTrigger>
          <SelectContent className="bg-popover border border-border shadow-lg z-50">
            {availableProfessionals.length > 0 ? (
              availableProfessionals.map((prof) => (
                <SelectItem key={prof.id} value={prof.id}>
                  {prof.name} {prof.specialty && `- ${prof.specialty}`}
                </SelectItem>
              ))
            ) : (
              <div className="p-2 text-sm text-muted-foreground text-center">
                Nenhum profissional cadastrado
              </div>
            )}
          </SelectContent>
        </Select>
        {loggedInProfessionalId && (
          <p className="text-xs text-muted-foreground">
            Seu perfil de profissional está selecionado automaticamente
          </p>
        )}
      </div>

      {formProfessional && (
        <TimeSlotPicker
          allSlots={timeSlots}
          existingAppointments={professionalAppointmentsForDate}
          selectedTime={formTime}
          onSelectTime={setFormTime}
          multiSelectEnabled={recurrenceConfig.enabled}
          selectedTimes={selectedMultipleTimes}
          onSelectMultiple={setSelectedMultipleTimes}
          duration={currentDuration}
          disabled={saving}
        />
      )}
      
      {!formProfessional && (
        <div className="space-y-2">
          <Label>Horário *</Label>
          <div className="border rounded-lg p-4 bg-muted/50 text-center">
            <p className="text-sm text-muted-foreground">
              Selecione um profissional para ver os horários disponíveis
            </p>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label>Duração (minutos)</Label>
        <Select 
          value={formDuration?.toString() || "__default__"} 
          onValueChange={(value) => setFormDuration(value === "__default__" ? null : parseInt(value))}
        >
          <SelectTrigger className="bg-background">
            <SelectValue placeholder={`Padrão (${professionals.find(p => p.id === formProfessional)?.appointment_duration || 30} min)`} />
          </SelectTrigger>
          <SelectContent className="bg-popover border border-border shadow-lg z-50">
            <SelectItem value="__default__">Padrão do profissional</SelectItem>
            <SelectItem value="5">5 minutos</SelectItem>
            <SelectItem value="10">10 minutos</SelectItem>
            <SelectItem value="15">15 minutos</SelectItem>
            <SelectItem value="20">20 minutos</SelectItem>
            <SelectItem value="30">30 minutos</SelectItem>
            <SelectItem value="45">45 minutos</SelectItem>
            <SelectItem value="60">60 minutos</SelectItem>
            <SelectItem value="90">90 minutos</SelectItem>
            <SelectItem value="120">120 minutos</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Se não alterado, usa a duração configurada do profissional
        </p>
      </div>

      <div className="space-y-2">
        <Label>Tipo de Consulta</Label>
        <Select value={formType} onValueChange={setFormType}>
          <SelectTrigger className="bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-popover border border-border shadow-lg z-50">
            {appointmentTypes.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Observações</Label>
        <Input
          value={formNotes}
          onChange={(e) => setFormNotes(e.target.value)}
          placeholder="Anotações sobre o agendamento (opcional)"
        />
      </div>

      {/* Recurrence selector - only for new appointments, not edit */}
      {!editingAppointment && (
        <RecurrenceSelector
          value={recurrenceConfig}
          onChange={setRecurrenceConfig}
          minDate={selectedDate.toISOString().split('T')[0]}
        />
      )}
    </>
  );

  // Componente compacto de linha de agendamento (estilo lista)
  const AppointmentCard = ({ appointment }: { appointment: Appointment }) => {
    const status = statusConfig[appointment.status as keyof typeof statusConfig] || statusConfig.scheduled;
    const StatusIcon = status.icon;
    const isCancelled = appointment.status === "cancelled";
    const isCompleted = appointment.status === "completed";
    const isNoShow = appointment.status === "no_show";
    const isInProgress = appointment.status === "in_progress";
    const canModify = !isCancelled && !isCompleted && !isNoShow;
    const canAttend = appointment.status === "scheduled" || appointment.status === "confirmed" || appointment.status === "arrived" || isInProgress;
    const hasConflict = conflictingAppointmentIds.has(appointment.id);
    
    // Verifica se paciente está bloqueado por falta (no-show)
    const isPatientBlocked = appointment.patient?.no_show_blocked_until 
      && new Date(appointment.patient.no_show_blocked_until) >= new Date()
      && !appointment.patient.no_show_unblocked_at;
    
    // Determina cor do badge de horário baseado no status
    const getTimeBadgeStyle = () => {
      if (hasConflict && !isCancelled) return "bg-destructive text-destructive-foreground";
      if (isInProgress) return "bg-info text-info-foreground";
      if (isCompleted) return "bg-muted text-muted-foreground";
      if (isCancelled || isNoShow) return "bg-muted/50 text-muted-foreground/50";
      return "bg-primary text-primary-foreground";
    };

    // Ícone de status simplificado
    const getStatusIcon = () => {
      if (isCancelled || isNoShow) return <XCircle className="h-4 w-4 text-destructive" />;
      if (isCompleted) return <CheckCircle2 className="h-4 w-4 text-muted-foreground" />;
      if (isInProgress) return <Play className="h-4 w-4 text-info" />;
      if (appointment.status === "arrived") return <UserCheck className="h-4 w-4 text-success" />;
      if (appointment.status === "confirmed") return <CheckCircle2 className="h-4 w-4 text-success" />;
      return <AlertCircle className="h-4 w-4 text-warning" />;
    };
    
    return (
      <div
        className={cn(
          "flex items-center gap-3 py-2 px-3 hover:bg-muted/50 transition-all group cursor-pointer",
          isCancelled && "opacity-50",
          isNoShow && "opacity-60",
          hasConflict && !isCancelled && "bg-destructive/5"
        )}
        onClick={() => openAppointmentPanel(appointment)}
      >
        {/* Badge de horário compacto */}
        <Badge 
          variant="secondary" 
          className={cn(
            "font-mono font-medium text-xs px-2 py-1 min-w-[50px] justify-center rounded-sm",
            getTimeBadgeStyle()
          )}
        >
          {appointment.start_time.slice(0, 5)}
        </Badge>

        {/* Ícone de status */}
        <div className="flex-shrink-0" title={status.label}>
          {getStatusIcon()}
        </div>

        {/* Nome do paciente - flex-1 para ocupar espaço */}
        <div className="flex-1 min-w-0 flex items-center gap-2">
          {appointment.type === "return" && (
            <span className="text-muted-foreground text-xs">(R)</span>
          )}
          <span className={cn(
            "font-medium truncate uppercase text-sm",
            (isCancelled || isNoShow) && "line-through text-muted-foreground"
          )}>
            {getAppointmentDisplayName(appointment)}
          </span>
          {/* Badge de dependente */}
          {appointment.dependent_id && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 h-4 flex-shrink-0 bg-primary/20 text-primary border-primary/50"
            >
              DEP
            </Badge>
          )}
          {/* Badge do convênio - apenas para titular (não dependentes) */}
          {appointment.patient?.insurance_plan && !appointment.dependent_id && (() => {
            const insuranceColor =
              toHslColor(appointment.patient.insurance_plan.color) ??
              "hsl(var(--accent))";

            return (
              <Badge
                className="text-[10px] px-1.5 py-0 h-4 flex-shrink-0 font-medium border"
                style={{
                  backgroundColor: hslWithAlpha(insuranceColor, 0.22),
                  color: insuranceColor,
                  borderColor: hslWithAlpha(insuranceColor, 0.55),
                }}
              >
                {appointment.patient.insurance_plan.name}
              </Badge>
            );
          })()}
          {hasConflict && !isCancelled && (
            <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
          )}
          {/* Ícone de bloqueio por falta (no-show) */}
          {isPatientBlocked && (
            <div 
              className="flex items-center gap-1 flex-shrink-0"
              title={`Paciente bloqueado até ${new Date(appointment.patient.no_show_blocked_until!).toLocaleDateString('pt-BR')}`}
            >
              <Ban className="h-4 w-4 text-destructive" />
            </div>
          )}
        </div>

        {/* Menu de ações - três pontos sempre visível */}
        {canModify && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="5" r="2" />
                  <circle cx="12" cy="12" r="2" />
                  <circle cx="12" cy="19" r="2" />
                </svg>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover min-w-[180px]" onClick={(e) => e.stopPropagation()}>
              {/* Atender - apenas para quem tem permissão de prontuário médico */}
              {canAttend && canAttendPatient && (
                <DropdownMenuItem onClick={() => openAppointmentPanel(appointment)}>
                  <Stethoscope className="h-4 w-4 mr-2" />
                  {isInProgress ? "Continuar Atendimento" : "Atender"}
                </DropdownMenuItem>
              )}
              
              {/* Mudar status */}
              {appointment.status === "scheduled" && (
                <>
                  <DropdownMenuItem onClick={() => handleUpdateStatus(appointment, "confirmed")}>
                    <CheckCircle2 className="h-4 w-4 mr-2 text-blue-600" />
                    Confirmar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handlePatientArrived(appointment)}>
                    <UserCheck className="h-4 w-4 mr-2 text-green-600" />
                    Chegou
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleUpdateStatus(appointment, "no_show")}>
                    <XCircle className="h-4 w-4 mr-2 text-orange-600" />
                    Faltou
                  </DropdownMenuItem>
                </>
              )}
              
              {appointment.status === "confirmed" && (
                <>
                  <DropdownMenuItem onClick={() => handlePatientArrived(appointment)}>
                    <UserCheck className="h-4 w-4 mr-2 text-green-600" />
                    Chegou
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleUpdateStatus(appointment, "no_show")}>
                    <XCircle className="h-4 w-4 mr-2 text-orange-600" />
                    Faltou
                  </DropdownMenuItem>
                </>
              )}
              
              {/* Iniciar Atendimento - apenas para quem tem permissão de prontuário médico */}
              {appointment.status === "arrived" && canAttendPatient && (
                <DropdownMenuItem onClick={() => handleStartAttendance(appointment)}>
                  <Stethoscope className="h-4 w-4 mr-2 text-purple-600" />
                  Iniciar Atendimento
                </DropdownMenuItem>
              )}
              
              {/* Concluir - apenas para quem tem permissão de prontuário médico */}
              {appointment.status === "in_progress" && canAttendPatient && (
                <DropdownMenuItem onClick={() => handleUpdateStatus(appointment, "completed")}>
                  <Check className="h-4 w-4 mr-2 text-gray-500" />
                  Concluir
                </DropdownMenuItem>
              )}

              <DropdownMenuSeparator />
              
              {/* Pré-atendimento - disponível para todos agendamentos não cancelados/concluídos */}
              {(appointment.status === "scheduled" || appointment.status === "confirmed" || appointment.status === "arrived") && (
                <DropdownMenuItem onClick={() => {
                  setPreAttendanceAppointment(appointment);
                  setPreAttendanceDialogOpen(true);
                }}>
                  <Activity className="h-4 w-4 mr-2 text-purple-600" />
                  Pré-Atendimento
                </DropdownMenuItem>
              )}
              
              {/* Telemedicina */}
              {appointment.type === "telemedicine" && (
                <DropdownMenuItem 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSendTelemedicineLink(appointment);
                  }}
                  disabled={sendingTelemedicineLink === appointment.id}
                >
                  <Video className="h-4 w-4 mr-2 text-info" />
                  Enviar Link Telemedicina
                </DropdownMenuItem>
              )}
              
              {/* WhatsApp */}
              <DropdownMenuItem 
                onClick={(e) => {
                  e.stopPropagation();
                  handleSendWhatsAppReminder(appointment);
                }}
                disabled={sendingWhatsApp === appointment.id}
              >
                <Send className="h-4 w-4 mr-2 text-success" />
                Enviar Lembrete WhatsApp
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              
              {/* Reagendar */}
              <DropdownMenuItem onClick={() => openRescheduleDialog(appointment)}>
                <CalendarDays className="h-4 w-4 mr-2" />
                Reagendar
              </DropdownMenuItem>
              
              {/* Editar */}
              <DropdownMenuItem onClick={() => openEditDialog(appointment)}>
                <Pencil className="h-4 w-4 mr-2" />
                Editar
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              
              {/* Auditoria */}
              <DropdownMenuItem onClick={() => openAuditDialog(appointment)}>
                <History className="h-4 w-4 mr-2" />
                Auditoria
              </DropdownMenuItem>
              
              {/* Cancelar */}
              <DropdownMenuItem 
                onClick={() => openCancelDialog(appointment)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Cancelar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Status fixo para agendamentos não modificáveis */}
        {!canModify && (
          <Badge variant="outline" className={cn("text-xs", status.color)}>
            {status.label}
          </Badge>
        )}
      </div>
    );
  };

  // Componente reutilizável para o painel de horários livres
  const TimeSlotsPanel = ({ forDate }: { forDate: Date }) => {
    const dateStr = toDateKey(forDate);
    const dayAppointments = getAppointmentsForDate(forDate);
    const holidayName = isHoliday(forDate);
    
    if (holidayName) {
      return (
        <div className="p-3 rounded-lg border border-dashed border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/20">
          <p className="text-xs text-red-600 dark:text-red-400 font-medium mb-2 text-center">
            🚫 Feriado
          </p>
          <div className="text-center text-sm text-red-500 dark:text-red-400">
            {holidayName}
          </div>
          <p className="text-xs text-red-500/60 text-center mt-2 italic">
            Agendamentos bloqueados
          </p>
        </div>
      );
    }
    
    return (
      <div className="p-3 rounded-lg border border-dashed border-border/50">
        <p className="text-xs text-muted-foreground font-medium mb-2 text-center">
          Horários livres - {forDate.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })}
        </p>
        <div className="grid grid-cols-4 gap-1">
          {timeSlots.map((time) => {
            const hasAppointment = dayAppointments.some(
              apt => apt.start_time.slice(0, 5) === time && apt.status !== 'cancelled'
            );
            return (
              <DroppableTimeSlot
                key={time}
                date={dateStr}
                time={time}
                disabled={hasAppointment}
                isOccupied={hasAppointment}
                onClick={() => {
                  setSelectedDate(forDate);
                  openNewAppointmentWithTime(time);
                }}
                className={cn(
                  "p-1.5 text-center rounded-md text-xs transition-colors",
                  hasAppointment 
                    ? "bg-muted/40 text-muted-foreground/40 cursor-not-allowed" 
                    : "bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary-foreground"
                )}
              />
            );
          })}
        </div>
      </div>
    );
  };

  // Gera cores suaves diferentes para cada profissional (memoizado fora do WeekView)
  const professionalColors = useMemo(() => {
    const colors = [
      'hsl(45 85% 75%)',   // Amarelo suave
      'hsl(160 55% 70%)',  // Verde água
      'hsl(200 65% 75%)',  // Azul claro
      'hsl(280 45% 75%)',  // Roxo suave
      'hsl(25 75% 70%)',   // Laranja suave
      'hsl(340 55% 75%)',  // Rosa suave
      'hsl(100 45% 70%)',  // Verde limão
      'hsl(220 55% 75%)',  // Azul médio
    ];
    const colorMap: Record<string, string> = {};
    professionals.forEach((prof, index) => {
      colorMap[prof.id] = colors[index % colors.length];
    });
    return colorMap;
  }, [professionals]);

  // Gera time slots para o grid semanal
  const weekTimeSlots = useMemo(() => {
    return ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"];
  }, []);

  const WeekView = () => {
    const weekDaysData = getWeekDays();

    // Agrupa agendamentos por dia e horário
    const getAppointmentsForSlot = (date: Date, time: string) => {
      const dateStr = toDateKey(date);
      return filteredAppointments.filter(apt => {
        if (apt.appointment_date !== dateStr) return false;
        // Verifica se o agendamento começa neste slot ou está em andamento neste horário
        const aptStartMinutes = parseInt(apt.start_time.slice(0, 2)) * 60 + parseInt(apt.start_time.slice(3, 5));
        const aptEndMinutes = parseInt(apt.end_time.slice(0, 2)) * 60 + parseInt(apt.end_time.slice(3, 5));
        const slotMinutes = parseInt(time.slice(0, 2)) * 60 + parseInt(time.slice(3, 5));
        // Retorna se o slot está dentro do período do agendamento
        return aptStartMinutes <= slotMinutes && slotMinutes < aptEndMinutes;
      });
    };

    return (
      <div className="overflow-x-auto">
        <div className="min-w-[900px]">
          {/* Header com dias da semana */}
          <div className="grid grid-cols-8 gap-px bg-border/50 rounded-t-lg overflow-hidden">
            {/* Coluna de horários */}
            <div className="bg-muted/30 p-3 text-center">
              <span className="text-xs font-medium text-muted-foreground">Horário</span>
            </div>
            
            {/* Colunas dos dias */}
            {weekDaysData.map((date, i) => {
              const isTodayDate = isToday(date);
              const holidayName = isHoliday(date);
              
              return (
                <button
                  key={i}
                  onClick={() => handleDayClick(date)}
                  className={cn(
                    "p-2 text-center transition-colors",
                    isTodayDate && !holidayName && "bg-primary/10",
                    holidayName && "bg-red-50 dark:bg-red-950/20",
                    !isTodayDate && !holidayName && "bg-card hover:bg-muted/50"
                  )}
                >
                  <div className={cn(
                    "text-xs font-medium",
                    holidayName ? "text-red-500" : "text-muted-foreground"
                  )}>
                    {weekDaysFull[i]}
                  </div>
                  <div className={cn(
                    "text-lg font-bold",
                    isTodayDate && !holidayName && "text-primary",
                    holidayName && "text-red-600"
                  )}>
                    {date.getDate()}/{monthNames[date.getMonth()].slice(0, 3)}
                  </div>
                </button>
              );
            })}
          </div>
          
          {/* Grid de horários */}
          <div className="border border-t-0 border-border/50 rounded-b-lg overflow-hidden">
            {weekTimeSlots.map((time, timeIndex) => (
              <div 
                key={time} 
                className={cn(
                  "grid grid-cols-8 gap-px min-h-[80px]",
                  timeIndex % 2 === 0 ? "bg-muted/10" : "bg-card"
                )}
              >
                {/* Coluna de horário */}
                <div className="p-2 flex items-start justify-center border-r border-border/30">
                  <span className="text-sm font-medium text-muted-foreground">{time}</span>
                </div>
                
                {/* Células dos dias */}
                {weekDaysData.map((date, dayIndex) => {
                  const dateStr = toDateKey(date);
                  const holidayName = isHoliday(date);
                  const slotAppointments = getAppointmentsForSlot(date, time);
                  
                  return (
                    <DroppableTimeSlot
                      key={`${dateStr}-${time}`}
                      date={dateStr}
                      time={time}
                      showTime={false}
                      isOccupied={!!holidayName}
                      className={cn(
                        "p-1 border-r border-border/20 relative min-h-[80px]",
                        holidayName && "bg-red-50/50 dark:bg-red-950/10"
                      )}
                    >
                      {holidayName && timeIndex === 5 ? (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-xs text-red-400 italic">Feriado</span>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {slotAppointments.map((apt) => {
                            const canDrag = apt.status !== "cancelled" && apt.status !== "completed" && apt.status !== "no_show" && apt.status !== "in_progress";
                            const profColor = professionalColors[apt.professional_id] || 'hsl(200 65% 75%)';
                            const displayName = getAppointmentDisplayName(apt);
                            const isStart = apt.start_time.slice(0, 5) === time;
                            const status = statusConfig[apt.status as keyof typeof statusConfig];
                            const StatusIcon = status?.icon || AlertCircle;
                            
                            // Só renderiza no slot de início
                            if (!isStart) return null;
                            
                            return (
                              <DraggableAppointment key={apt.id} appointment={apt}>
                                <div
                                  onClick={() => openAppointmentPanel(apt)}
                                  style={{ 
                                    backgroundColor: profColor,
                                    borderLeftColor: shiftHslHue(profColor, -20)
                                  }}
                                  className={cn(
                                    "rounded-md p-1.5 border-l-4 cursor-pointer transition-all hover:shadow-md hover:scale-[1.02]",
                                    apt.status === "cancelled" && "opacity-50",
                                    apt.status === "completed" && "opacity-70"
                                  )}
                                >
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="text-[10px] font-bold text-gray-700">
                                      {apt.start_time.slice(0, 5)} - {apt.end_time.slice(0, 5)}
                                    </span>
                                    {apt.status === "confirmed" && (
                                      <Check className="h-3 w-3 text-green-700" />
                                    )}
                                    {apt.status === "completed" && (
                                      <CheckCircle2 className="h-3 w-3 text-gray-600" />
                                    )}
                                  </div>
                                  <div className="text-xs font-medium text-gray-800 truncate mt-0.5">
                                    {displayName}
                                  </div>
                                </div>
                              </DraggableAppointment>
                            );
                          })}
                        </div>
                      )}
                    </DroppableTimeSlot>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const MonthView = () => {
    const days = getDaysInMonth(currentDate);

    return (
      <div className="flex gap-4">
        {/* Painel de horários do dia selecionado */}
        <div className="hidden lg:block w-48 flex-shrink-0">
          <TimeSlotsPanel forDate={selectedDate} />
        </div>
        
        {/* Grade do mês */}
        <div className="flex-1">
          <div className="grid grid-cols-7 gap-1 text-center text-xs mb-2">
            {weekDays.map((day) => (
              <div key={day} className="py-2 text-muted-foreground font-medium">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((item, i) => {
              const dayAppointments = getAppointmentsForDate(item.date);
              const isTodayDate = isToday(item.date);
              const isSelectedDate = isSelected(item.date);
              const dateStr = toDateKey(item.date);
              const isOccupied = dayAppointments.filter(a => a.status !== 'cancelled').length >= 10;
              const holidayName = isHoliday(item.date);
              
              return (
                <DroppableTimeSlot
                  key={i}
                  date={dateStr}
                  time="08:00"
                  showTime={false}
                  isOccupied={isOccupied || !!holidayName}
                  disabled={!item.isCurrentMonth}
                  className="p-0"
                >
                  <button
                    onClick={() => handleDayClick(item.date)}
                    title={holidayName || undefined}
                    className={cn(
                      "w-full aspect-square p-1 flex flex-col items-center justify-start text-sm rounded-lg transition-colors relative",
                      item.isCurrentMonth
                        ? "text-foreground hover:bg-muted"
                        : "text-muted-foreground/40",
                      holidayName && item.isCurrentMonth && "bg-red-100 dark:bg-red-950/30 text-red-600 dark:text-red-400",
                      isTodayDate && !holidayName && "bg-primary/10 text-primary font-semibold",
                      isSelectedDate && item.isCurrentMonth && "ring-2 ring-primary"
                    )}
                  >
                    <span>{item.day}</span>
                    {holidayName && item.isCurrentMonth && (
                      <span className="text-[8px] truncate max-w-full px-0.5" title={holidayName}>
                        Feriado
                      </span>
                    )}
                    {!holidayName && dayAppointments.length > 0 && (
                      <div className="flex gap-0.5 mt-1">
                        {dayAppointments.slice(0, 3).map((apt, j) => (
                          <div
                            key={j}
                            className={cn(
                              "w-1.5 h-1.5 rounded-full",
                              apt.status === "cancelled" ? "bg-destructive" :
                              apt.status === "confirmed" ? "bg-success" :
                              apt.status === "completed" ? "bg-info" : "bg-warning"
                            )}
                          />
                        ))}
                        {dayAppointments.length > 3 && (
                          <span className="text-[8px] text-muted-foreground">+{dayAppointments.length - 3}</span>
                        )}
                      </div>
                    )}
                  </button>
                </DroppableTimeSlot>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // Stats for the selected date
  const selectedDateAppointments = useMemo(() => {
    const dateStr = toDateKey(selectedDate);
    return appointments.filter(apt => apt.appointment_date === dateStr);
  }, [appointments, selectedDate]);

  const stats = useMemo(() => {
    const total = selectedDateAppointments.length;
    const confirmed = selectedDateAppointments.filter(apt => apt.status === 'confirmed' || apt.status === 'arrived').length;
    const pending = selectedDateAppointments.filter(apt => apt.status === 'scheduled').length;
    const completed = selectedDateAppointments.filter(apt => apt.status === 'completed').length;
    const cancelled = selectedDateAppointments.filter(apt => apt.status === 'cancelled' || apt.status === 'no_show').length;
    const inProgress = selectedDateAppointments.filter(apt => apt.status === 'in_progress').length;
    return { total, confirmed, pending, completed, cancelled, inProgress };
  }, [selectedDateAppointments]);

  return (
    <DndContext
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
      collisionDetection={pointerWithin}
    >
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <CalendarIcon className="h-6 w-6 text-primary" />
            Agenda
          </h1>
          <p className="text-muted-foreground">
            Gerencie os agendamentos da clínica
          </p>
          <RealtimeIndicator className="mt-1" />
        </div>
        <div className="flex items-center gap-2">
          {/* Calendar Toggle - apenas em view day */}
          {viewMode === "day" && (
            <Button
              variant={showCalendar ? "secondary" : "outline"}
              size="icon"
              onClick={() => setShowCalendar(!showCalendar)}
              title={showCalendar ? "Ocultar calendário" : "Mostrar calendário"}
            >
              <CalendarIcon className="h-4 w-4" />
            </Button>
          )}

          {/* View Mode Toggle */}
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
            <TabsList>
              <TabsTrigger value="day" className="gap-1">
                Dia
              </TabsTrigger>
              <TabsTrigger value="week" className="gap-1">
                Semana
              </TabsTrigger>
              <TabsTrigger value="month" className="gap-1">
                Mês
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Show Cancelled/No-Show Toggle */}
          <label className="flex items-center gap-2 cursor-pointer px-2 py-1.5 rounded-md border border-input hover:bg-accent transition-colors">
            <Checkbox
              id="show-cancelled"
              checked={showCancelledNoShow}
              onCheckedChange={(checked) => setShowCancelledNoShow(checked === true)}
              className="border-destructive data-[state=checked]:bg-destructive data-[state=checked]:border-destructive"
            />
            <span className="text-sm text-destructive font-medium whitespace-nowrap">Faltas/Cancelados</span>
          </label>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar paciente..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-48"
            />
          </div>

          {/* Filters */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" className="relative">
                <Filter className="h-4 w-4" />
                {hasActiveFilters && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full" />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72" align="end">
              <div className="space-y-4">
                <h4 className="font-medium">Filtros</h4>
                {/* Hide professional filter for professional users - they can only see their own appointments */}
                {!isProfessionalOnly && (
                  <div className="space-y-2">
                    <Label>Profissional</Label>
                    <div className="space-y-1 max-h-48 overflow-y-auto border rounded-md p-2">
                      {availableProfessionals.map((prof) => {
                        const isChecked = filterProfessionals.includes(prof.id);
                        return (
                          <label 
                            key={prof.id} 
                            className="flex items-center gap-2 py-1.5 px-2 hover:bg-accent rounded-md cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFilterProfessionals([...filterProfessionals, prof.id]);
                                } else {
                                  setFilterProfessionals(filterProfessionals.filter(id => id !== prof.id));
                                }
                              }}
                              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                            />
                            <span className="text-sm">{prof.name}</span>
                          </label>
                        );
                      })}
                    </div>
                    {filterProfessionals.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-xs"
                        onClick={() => setFilterProfessionals([])}
                      >
                        Limpar seleção ({filterProfessionals.length})
                      </Button>
                    )}
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Tipo de Consulta</Label>
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {appointmentTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      setFilterProfessionals([]);
                      setFilterType("all");
                      setSearchQuery("");
                    }}
                  >
                    Limpar filtros
                  </Button>
                )}
              </div>
            </PopoverContent>
          </Popover>

          {hasPermission('manage_calendar') && (
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button variant="hero">
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Agendamento
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Novo Agendamento</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateAppointment} className="space-y-4">
                  <AppointmentFormFields />
                  <div className="flex justify-end gap-3 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setDialogOpen(false)}
                    >
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={saving}>
                      {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {recurrenceConfig.enabled 
                        ? `Agendar ${calculateRecurringDates(selectedDate, recurrenceConfig).length} consultas`
                        : "Agendar"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <Card className="border-l-4 border-l-primary bg-primary/5">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">Total</span>
            </div>
            <p className="text-xl font-bold text-foreground mt-1">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500 bg-amber-500/5">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              <span className="text-xs font-medium text-muted-foreground">Pendentes</span>
            </div>
            <p className="text-xl font-bold text-amber-600 mt-1">{stats.pending}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500 bg-blue-500/5">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-blue-500" />
              <span className="text-xs font-medium text-muted-foreground">Confirmados</span>
            </div>
            <p className="text-xl font-bold text-blue-600 mt-1">{stats.confirmed}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500 bg-purple-500/5">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Stethoscope className="h-4 w-4 text-purple-500" />
              <span className="text-xs font-medium text-muted-foreground">Atendendo</span>
            </div>
            <p className="text-xl font-bold text-purple-600 mt-1">{stats.inProgress}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500 bg-emerald-500/5">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-emerald-500" />
              <span className="text-xs font-medium text-muted-foreground">Concluídos</span>
            </div>
            <p className="text-xl font-bold text-emerald-600 mt-1">{stats.completed}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-rose-500 bg-rose-500/5">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <UserX className="h-4 w-4 text-rose-500" />
              <span className="text-xs font-medium text-muted-foreground">Faltas/Canc.</span>
            </div>
            <p className="text-xl font-bold text-rose-600 mt-1">{stats.cancelled}</p>
          </CardContent>
        </Card>
      </div>

      {/* Active Filters */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Filtros ativos:</span>
          {searchQuery.trim() && (
            <Badge variant="secondary" className="gap-1">
              <Search className="h-3 w-3" />
              "{searchQuery}"
              <button onClick={() => setSearchQuery("")} className="ml-1 hover:text-foreground">×</button>
            </Badge>
          )}
          {filterProfessionals.length > 0 && (
            <Badge variant="secondary" className="gap-1">
              <UserCheck className="h-3 w-3" />
              {filterProfessionals.length === 1 
                ? professionals.find(p => p.id === filterProfessionals[0])?.name
                : `${filterProfessionals.length} profissionais`}
              <button onClick={() => setFilterProfessionals([])} className="ml-1 hover:text-foreground">×</button>
            </Badge>
          )}
          {filterType !== "all" && (
            <Badge variant="secondary" className="gap-1">
              {typeLabels[filterType]}
              <button onClick={() => setFilterType("all")} className="ml-1 hover:text-foreground">×</button>
            </Badge>
          )}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={(open) => {
        setEditDialogOpen(open);
        if (!open) {
          setEditingAppointment(null);
          resetForm();
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Agendamento</DialogTitle>
            <DialogDescription>
              Altere as informações do agendamento
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditAppointment} className="space-y-4">
            <AppointmentFormFields />
            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Alterações
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reschedule Dialog */}
      <Dialog open={rescheduleDialogOpen} onOpenChange={(open) => {
        setRescheduleDialogOpen(open);
        if (!open) {
          setReschedulingAppointment(null);
          setNewDate("");
          setNewTime("");
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reagendar Consulta</DialogTitle>
            <DialogDescription>
              Selecione a nova data e horário para a consulta
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {reschedulingAppointment && (
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="font-medium">{getAppointmentDisplayName(reschedulingAppointment)}</p>
                <p className="text-sm text-muted-foreground">
                  {typeLabels[reschedulingAppointment.type]} com {reschedulingAppointment.professional?.name}
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Nova Data</Label>
              <Input
                type="date"
                value={newDate}
                onChange={(e) => {
                  setNewDate(e.target.value);
                  // Reset time if date changes to today and current time is past
                  const today = new Date().toISOString().split('T')[0];
                  if (e.target.value === today && newTime) {
                    const now = new Date();
                    const [hours, minutes] = newTime.split(':').map(Number);
                    const slotTime = new Date();
                    slotTime.setHours(hours, minutes, 0, 0);
                    if (slotTime <= now) {
                      setNewTime("");
                    }
                  }
                }}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div className="space-y-2">
              <Label>Novo Horário</Label>
              <Select value={newTime} onValueChange={setNewTime}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o horário" />
                </SelectTrigger>
                <SelectContent>
                  {timeSlots
                    .filter((time) => {
                      // If selected date is today, filter out past times
                      const today = new Date().toISOString().split('T')[0];
                      if (newDate === today) {
                        const now = new Date();
                        const [hours, minutes] = time.split(':').map(Number);
                        const slotTime = new Date();
                        slotTime.setHours(hours, minutes, 0, 0);
                        return slotTime > now;
                      }
                      return true;
                    })
                    .map((time) => (
                      <SelectItem key={time} value={time}>
                        {time}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRescheduleDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button onClick={handleReschedule} disabled={saving || !newDate || !newTime}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Reagendar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Agendamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar este agendamento? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="cancel-reason">Motivo do cancelamento (opcional)</Label>
            <Textarea
              id="cancel-reason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Informe o motivo do cancelamento..."
              className="mt-2"
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setCancellingAppointment(null);
              setCancelReason("");
            }}>
              Voltar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelAppointment}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={saving}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar Cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Main Content */}
      <div className="flex gap-6">
        {/* Sidebar - Pacientes do dia (week view) */}
        {viewMode === "week" && (
          <Card className="w-56 shrink-0 hidden lg:block">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Pacientes do dia</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {(() => {
                const todayAppointments = getAppointmentsForDate(selectedDate)
                  .filter(apt => apt.status !== 'cancelled' && apt.status !== 'no_show')
                  .sort((a, b) => a.start_time.localeCompare(b.start_time));
                
                if (todayAppointments.length === 0) {
                  return (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      Nenhum agendamento
                    </p>
                  );
                }
                
                return (
                  <div className="space-y-1 max-h-[500px] overflow-y-auto">
                    {todayAppointments.map((apt) => {
                      const profColor = professionalColors[apt.professional_id] || 'hsl(200 65% 75%)';
                      const displayName = getAppointmentDisplayName(apt);
                      const status = statusConfig[apt.status as keyof typeof statusConfig];
                      const StatusIcon = status?.icon || AlertCircle;
                      
                      return (
                        <button
                          key={apt.id}
                          onClick={() => openRescheduleDialog(apt)}
                          className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors text-left"
                        >
                          <div 
                            className="w-1 h-8 rounded-full flex-shrink-0"
                            style={{ backgroundColor: profColor }}
                          />
                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-bold" style={{ color: profColor }}>
                              {apt.start_time.slice(0, 5)}
                            </span>
                            <p className="text-xs font-medium truncate text-foreground">
                              {displayName}
                            </p>
                          </div>
                          <StatusIcon className={cn("h-3.5 w-3.5 flex-shrink-0", status?.color)} />
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        )}
        
        {/* Mini Calendar (only in day view when showCalendar is true) */}
        {viewMode === "day" && showCalendar && (
          <Card className="w-72 shrink-0">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                </CardTitle>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => navigateMonth(-1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => navigateMonth(1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-7 gap-1 text-center text-xs mb-2">
                {weekDays.map((day) => (
                  <div key={day} className="py-2 text-muted-foreground font-medium">
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {getDaysInMonth(currentDate).map((item, i) => {
                  const dateStr = item.date.toISOString().split('T')[0];
                  const holidayName = isHoliday(item.date);
                  return (
                    <DroppableTimeSlot
                      key={i}
                      date={dateStr}
                      time="08:00"
                      showTime={false}
                      isOccupied={!!holidayName}
                      className="p-0"
                    >
                      <button
                        onClick={() => handleDayClick(item.date)}
                        title={holidayName || undefined}
                        className={cn(
                          "w-full aspect-square flex items-center justify-center text-sm rounded-lg transition-colors",
                          item.isCurrentMonth
                            ? "text-foreground hover:bg-muted"
                            : "text-muted-foreground/40",
                          holidayName && item.isCurrentMonth && "bg-red-100 dark:bg-red-950/30 text-red-600 dark:text-red-400",
                          isToday(item.date) && !holidayName &&
                            "bg-primary/10 text-primary font-semibold",
                          isSelected(item.date) && !holidayName &&
                            "bg-primary text-primary-foreground font-semibold",
                          isSelected(item.date) && holidayName && "ring-2 ring-primary"
                        )}
                      >
                        {item.day}
                      </button>
                    </DroppableTimeSlot>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Appointments List / Week View / Month View */}
        <Card className="flex-1">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {viewMode === "day" && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        const prev = new Date(selectedDate);
                        prev.setDate(prev.getDate() - 1);
                        setSelectedDate(prev);
                      }}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedDate(new Date())}
                    >
                      Hoje
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        const next = new Date(selectedDate);
                        next.setDate(next.getDate() + 1);
                        setSelectedDate(next);
                      }}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                <CardTitle className="text-base font-medium">
                  {viewMode === "day" && selectedDate.toLocaleDateString("pt-BR", { 
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric"
                  })}
                  {viewMode === "week" && `Semana de ${getWeekDays()[0].toLocaleDateString("pt-BR", { day: "numeric", month: "short" })} - ${getWeekDays()[6].toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}`}
                  {viewMode === "month" && `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`}
                </CardTitle>
              </div>
              {(viewMode === "week" || viewMode === "month") && (
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => viewMode === "week" ? navigateWeek(-1) : navigateMonth(-1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedDate(new Date());
                      setCurrentDate(new Date());
                    }}
                  >
                    Hoje
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => viewMode === "week" ? navigateWeek(1) : navigateMonth(1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                Carregando agendamentos...
              </div>
            ) : viewMode === "day" ? (
              (() => {
                const holidayName = isHoliday(selectedDate);
                if (holidayName) {
                  return (
                    <div className="p-6 rounded-lg border border-dashed border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/20 text-center">
                      <div className="text-3xl mb-3">🚫</div>
                      <p className="text-lg font-medium text-red-600 dark:text-red-400">Feriado</p>
                      <p className="text-sm text-red-500 dark:text-red-400 mt-1">{holidayName}</p>
                      <p className="text-xs text-red-500/60 mt-2 italic">Agendamentos bloqueados nesta data</p>
                    </div>
                  );
                }
                
                const dayAppointments = getAppointmentsForDate(selectedDate);
                
                // Filtrar por busca
                const filteredAppointments = searchQuery.trim() 
                  ? dayAppointments.filter(apt => {
                      const searchLower = normalizeForSearch(searchQuery);
                      const patientName = normalizeForSearch(getAppointmentDisplayName(apt));
                      const profName = normalizeForSearch(apt.professional?.name || '');
                      return patientName.includes(searchLower) || profName.includes(searchLower);
                    })
                  : dayAppointments;
                
                // Agrupar por profissional
                const groupedByProfessional = filteredAppointments.reduce((acc, apt) => {
                  const profId = apt.professional_id;
                  if (!acc[profId]) {
                    acc[profId] = {
                      professional: apt.professional,
                      appointments: []
                    };
                  }
                  acc[profId].appointments.push(apt);
                  return acc;
                }, {} as Record<string, { professional: Appointment['professional']; appointments: Appointment[] }>);
                
                const professionalGroups = Object.values(groupedByProfessional);
                
                if (professionalGroups.length === 0 && dayAppointments.length === 0) {
                  return (
                    <div className="text-center py-12 text-muted-foreground">
                      <CalendarIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                      <p className="mb-4">Nenhum agendamento para este dia</p>
                      {hasPermission('manage_calendar') && (
                        <Button variant="outline" onClick={() => setDialogOpen(true)}>
                          <Plus className="h-4 w-4 mr-2" />
                          Adicionar agendamento
                        </Button>
                      )}
                    </div>
                  );
                }
                
                if (dayAppointments.length > 0 && filteredAppointments.length === 0) {
                  return (
                    <div className="text-center py-8 text-muted-foreground">
                      <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Nenhum resultado para "{searchQuery}"</p>
                    </div>
                  );
                }
                
                // Mostrar profissionais em colunas lado a lado
                return (
                  <div className={cn(
                    "grid gap-6",
                    professionalGroups.length === 1 ? "grid-cols-1" :
                    professionalGroups.length === 2 ? "grid-cols-1 lg:grid-cols-2" :
                    "grid-cols-1 lg:grid-cols-2 xl:grid-cols-3"
                  )}>
                    {professionalGroups.map((group) => {
                      const activeAppointments = group.appointments.filter(a => a.status !== 'cancelled' && a.status !== 'no_show');
                      const totalAppointments = group.appointments.length;
                      
                      return (
                        <div key={group.professional.id} className="border rounded-lg overflow-hidden">
                          {/* Header do profissional */}
                          <div className="flex items-center gap-3 p-3 bg-muted/30 border-b">
                            {group.professional.avatar_url ? (
                              <img 
                                src={group.professional.avatar_url} 
                                alt={group.professional.name}
                                className="w-10 h-10 rounded-full object-cover border-2 border-primary/20"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <User className="h-5 w-5 text-primary" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-foreground truncate">{group.professional.name}</h3>
                              {group.professional.specialty && (
                                <p className="text-xs text-primary truncate">{group.professional.specialty}</p>
                              )}
                            </div>
                            <div className="text-right text-xs text-muted-foreground shrink-0">
                              <span className="font-medium text-primary">{activeAppointments.length} agendamento(s)</span>
                              <br />
                              <span>Total {totalAppointments}</span>
                            </div>
                            {/* Botão de lembrete em massa */}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-xs gap-1"
                              disabled={sendingBulkReminder === group.professional.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleBulkWhatsAppReminder(group.professional.id, group.appointments);
                              }}
                              title="Enviar lembrete via WhatsApp para todos"
                            >
                              {sendingBulkReminder === group.professional.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Send className="h-4 w-4 text-success" />
                              )}
                              <span className="hidden sm:inline">Lembrar todos</span>
                            </Button>
                          </div>
                          
                          {/* Lista de agendamentos e horários (inclui ocupados por intervalo) */}
                          <div className="divide-y divide-border/30">
                            {(() => {
                              const fullProfessional = professionals.find(p => p.id === group.professional.id);
                              const timeline = fullProfessional
                                ? calculateProfessionalSlots(fullProfessional, group.appointments, selectedDate)
                                : [];

                              if (timeline.length === 0) {
                                // fallback: mostrar só agendamentos existentes
                                return [...group.appointments]
                                  .sort((a, b) => a.start_time.localeCompare(b.start_time))
                                  .map((apt) => (
                                    <DraggableAppointment key={apt.id} appointment={apt}>
                                      <AppointmentCard appointment={apt} />
                                    </DraggableAppointment>
                                  ));
                              }

                              return timeline.map((slot, index) => {
                                try {
                                  // Slot ocupado: início do agendamento
                                  if (slot.type === 'booked' && slot.appointment) {
                                    return (
                                      <DraggableAppointment key={slot.appointment.id} appointment={slot.appointment}>
                                        <AppointmentCard appointment={slot.appointment} />
                                      </DraggableAppointment>
                                    );
                                  }

                                  // Slot ocupado: continuação do agendamento
                                  if (slot.type === 'booked') {
                                    return (
                                      <div
                                        key={`busy-${slot.time || index}-${index}`}
                                        className="flex items-center gap-3 px-3 py-2 bg-muted/20"
                                      >
                                        <div className="w-14 text-center py-1 rounded text-xs font-medium bg-muted text-muted-foreground">
                                          {slot.time || '--:--'}
                                        </div>
                                        <div className="flex-1 text-sm text-muted-foreground italic">
                                          Ocupado
                                        </div>
                                      </div>
                                    );
                                  }

                                  // Slot livre
                                  const slotTime = slot.time || '';
                                  const profId = group?.professional?.id || '';

                                  return (
                                    <div
                                      key={`free-${slotTime || index}-${index}`}
                                      className="flex items-center gap-3 px-3 py-2 bg-success/5 border-l-2 border-success/40"
                                    >
                                      <div className="w-14 text-center py-1 rounded text-xs font-medium bg-success/10 text-success">
                                        {slotTime || '--:--'}
                                      </div>
                                      <div className="flex-1 text-sm text-muted-foreground italic">
                                        Horário disponível
                                      </div>
                                      {hasPermission('manage_calendar') && profId && slotTime && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-7 px-2 text-xs text-success hover:text-success hover:bg-success/10"
                                          onClick={() => {
                                            setFormProfessional(profId);
                                            setFormTime(slotTime);
                                            setDialogOpen(true);
                                          }}
                                        >
                                          <Plus className="h-3 w-3 mr-1" />
                                          Agendar
                                        </Button>
                                      )}
                                    </div>
                                  );
                                } catch (slotErr) {
                                  console.error('[CalendarPage] Erro ao renderizar slot:', slotErr, slot);
                                  return (
                                    <div key={`error-${index}`} className="px-3 py-2 text-xs text-destructive">
                                      Erro ao exibir slot
                                    </div>
                                  );
                                }
                              });
                            })()}
                          </div>
                        </div>
                    );
                  })}
                </div>
              );
              })()
            ) : viewMode === "week" ? (
              <WeekView />
            ) : (
              <MonthView />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Appointment Panel */}
      {selectedAppointmentForPanel && currentClinic && (
        <AppointmentPanel
          isOpen={appointmentPanelOpen}
          appointment={{
            ...selectedAppointmentForPanel,
            patient: selectedAppointmentForPanel.patient as {
              id: string;
              name: string;
              phone: string;
              email: string | null;
              birth_date: string | null;
            }
          }}
          professionalId={selectedAppointmentForPanel.professional_id}
          clinicId={currentClinic.id}
          onClose={() => {
            setAppointmentPanelOpen(false);
            setSelectedAppointmentForPanel(null);
          }}
          onUpdate={fetchAppointments}
        />
      )}

      {/* Drag Instructions */}
      <DragInstructions 
        isVisible={!!activeAppointment} 
        patientName={getAppointmentDisplayName(activeAppointment)}
      />

      {/* Drag Overlay */}
      <DragOverlay>
        {activeAppointment && (
          <DragOverlayContent appointment={activeAppointment} />
        )}
      </DragOverlay>

      {/* Pre-Attendance Dialog */}
      {preAttendanceAppointment && (
        <PreAttendanceDialog
          open={preAttendanceDialogOpen}
          onOpenChange={(open) => {
            setPreAttendanceDialogOpen(open);
            if (!open) setPreAttendanceAppointment(null);
          }}
          appointmentId={preAttendanceAppointment.id}
          patientId={preAttendanceAppointment.patient_id}
          patientName={getAppointmentDisplayName(preAttendanceAppointment)}
          onSaved={fetchAppointments}
        />
      )}

      {/* Audit Dialog */}
      <AppointmentAuditDialog
        open={auditDialogOpen}
        onOpenChange={(open) => {
          setAuditDialogOpen(open);
          if (!open) setAuditAppointment(null);
        }}
        appointmentId={auditAppointment?.id || null}
        patientName={getAppointmentDisplayName(auditAppointment)}
        patientPhone={auditAppointment?.patient?.phone}
      />
    </div>
    </DndContext>
  );
}
