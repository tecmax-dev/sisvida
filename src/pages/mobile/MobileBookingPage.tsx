import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  ArrowLeft, 
  Loader2, 
  User,
  AlertTriangle,
  Check,
  CreditCard,
  Upload,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, addMinutes, isBefore, isSameDay, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DateTimeSelectionStep } from "@/components/mobile/DateTimeSelectionStep";
import { Badge } from "@/components/ui/badge";
import { useMobileAuth } from "@/contexts/MobileAuthContext";
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
// Category tabs removed - showing all professionals in single list

// Day name mapping (getDay returns 0=Sunday, 1=Monday, etc.)
const dayMap: Record<number, string> = {
  0: 'sunday',
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday'
};

interface ScheduleBlock {
  days: string[];
  start_time: string;
  end_time: string;
  duration?: number;
  start_date?: string;
  end_date?: string;
}

interface ProfessionalSchedule {
  _blocks?: ScheduleBlock[];
  [key: string]: { enabled: boolean; slots: { start: string; end: string }[] } | ScheduleBlock[] | undefined;
}

interface ProfessionalSpecialty {
  id: string;
  name: string;
  category: 'medical' | 'dental' | 'aesthetic' | 'therapy' | 'massage';
}

interface Professional {
  id: string;
  name: string;
  specialty: string | null;
  appointment_duration: number;
  schedule: ProfessionalSchedule | null;
  avatar_url: string | null;
  specialties?: ProfessionalSpecialty[];
  max_patient_age?: number | null;
}

interface Dependent {
  id: string;
  name: string;
  birth_date: string | null;
  relationship?: string | null;
  gender?: string | null;
}

// Age limit for dependents (in years)
const DEPENDENT_MAX_AGE = 21;

// Only "child" dependents are subject to max age rule.
// (Fix: previously the rule was applied to any dependent, e.g. cônjuge.)
const isAgeRestrictedDependent = (dep: Dependent) => {
  const rel = (dep.relationship || "").toLowerCase().trim();
  // Cobre: "filho", "filha", "Filho(a)", "Filho(a) - até 21 anos", etc.
  return rel.startsWith("filh");
};

// Calculate age from birth date
const calculateAge = (birthDate: string): number => {
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
};

// ---- Regra: profissional exclusiva para pacientes do sexo feminino (Karen Feire) ----
const isFemaleOnlyProfessional = (name?: string | null) =>
  !!name && /karen\s+f(r)?eire/i.test(name);

const isMaleGenderValue = (gender?: string | null) => {
  const g = (gender || "").toLowerCase().trim();
  return g === "m" || g === "masculino" || g === "male" || g === "homem";
};

// Fallback: heurística por parentesco (quando o dependente ainda não tem sexo cadastrado)
const isMaleRelationship = (relationship?: string | null) => {
  const r = (relationship || "").toLowerCase().trim();
  return /^(filho|marido|esposo|pai|irm[ãa]o|av[ôo]|neto|enteado|sobrinho|tio|primo|companheiro|genro|padrasto)\b/.test(r)
    && !/^(filha|irm[ãa]|av[óo]|neta|enteada|sobrinha|tia|prima|companheira|nora|madrasta)\b/.test(r);
};

const isFemaleGenderValue = (gender?: string | null) => {
  const g = (gender || "").toLowerCase().trim();
  return g === "f" || g === "feminino" || g === "female" || g === "mulher";
};

// Sexo do dependente: usa o campo cadastrado quando existir; senão, heurística por parentesco
const isDependentMale = (dep?: { gender?: string | null; relationship?: string | null } | null) => {
  if (isFemaleGenderValue(dep?.gender)) return false;
  if (isMaleGenderValue(dep?.gender)) return true;
  return isMaleRelationship(dep?.relationship);
};

const FEMALE_ONLY_MESSAGE = "Esta profissional atende exclusivamente pacientes do sexo feminino.";

interface TimeSlot {
  time: string;
  available: boolean;
}

/**
 * MOBILE RULE - INEGOCIÁVEL:
 * 
 * ❌ PROIBIDO: supabase.from("professionals"), supabase.from("patient_cards")
 * ✅ USAR: Edge Function mobile-booking-init (bypassa RLS com service_role)
 * 
 * Sessão Supabase client-side NÃO é confiável no mobile.
 * Toda lógica de carregamento inicial passa pela Edge Function.
 */
export default function MobileBookingPage() {
  const [step, setStep] = useState(1);
  const [patientType, setPatientType] = useState<"titular" | "dependent">("titular");
  const [selectedDependentId, setSelectedDependentId] = useState<string>("");
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string>("");
  
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [dependents, setDependents] = useState<Dependent[]>([]);
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [queueLocked, setQueueLocked] = useState(false);
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);
  const [noShowBlock, setNoShowBlock] = useState<{ professionalId: string; until: string } | null>(null);
  const [cardExpired, setCardExpired] = useState(false);
  const [cardExpiryDate, setCardExpiryDate] = useState<string | null>(null);
  const [noActiveCard, setNoActiveCard] = useState(false);
  const [bookingMonthsAhead, setBookingMonthsAhead] = useState(1);
  const [holidayDates, setHolidayDates] = useState<Set<string>>(new Set());
  
  // Booking limit config from edge function
  const [dependentBookingLimit, setDependentBookingLimit] = useState(1);
  const [dependentBookingPeriod, setDependentBookingPeriod] = useState("monthly");
  const [dependentBookingLimitEnabled, setDependentBookingLimitEnabled] = useState(true);
  const [titularBookingLimitEnabled, setTitularBookingLimitEnabled] = useState(true);
  const [maxAppointmentsPerCpfMonth, setMaxAppointmentsPerCpfMonth] = useState(1);
  const [minAdvanceBookingHours, setMinAdvanceBookingHours] = useState(6);
  const [titularBirthDate, setTitularBirthDate] = useState<string | null>(null);
  const [titularGender, setTitularGender] = useState<string | null>(null);
  const [massageConfirmOpen, setMassageConfirmOpen] = useState(false);
  const [massageConfirmText, setMassageConfirmText] = useState("");
  
  const clinicIdRef = useRef<string | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  
  // Reschedule state from navigation
  const rescheduleState = location.state as {
    rescheduleFrom?: string;
    professionalId?: string;
    procedureId?: string;
    dependentId?: string | null;
  } | null;
  const isReschedule = !!rescheduleState?.rescheduleFrom;
  
  const { patientId, initialized } = useMobileAuth();

  useEffect(() => {
    if (initialized && patientId) {
      loadProfessionals();
    }
  }, [initialized, patientId]);

  // Auto-setup reschedule: pre-select professional and skip to step 3
  useEffect(() => {
    if (isReschedule && professionals.length > 0 && rescheduleState?.professionalId) {
      const profExists = professionals.some(p => p.id === rescheduleState.professionalId);
      if (profExists) {
        setSelectedProfessionalId(rescheduleState.professionalId);
        if (rescheduleState.dependentId) {
          setPatientType("dependent");
          setSelectedDependentId(rescheduleState.dependentId);
        }
        setStep(3); // Go directly to date/time selection
      }
    }
  }, [isReschedule, professionals, rescheduleState]);

  useEffect(() => {
    if (selectedProfessionalId && selectedDate) {
      loadAvailableSlots();
    }
  }, [selectedProfessionalId, selectedDate, minAdvanceBookingHours]);

  /**
   * LÓGICA VIA EDGE FUNCTION (ZERO AUTH CLIENT-SIDE):
   * - Edge Function mobile-booking-init resolve tudo com SERVICE_ROLE
   * - Não depende de sessão Supabase no frontend
   * - Retorna: professionals, dependents, clinicId, blockedMessage, cardStatus
   */
  const loadProfessionals = async () => {
    if (!patientId) {
      console.error("[MobileBooking] ERRO: patientId ausente");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // CHAMADA ÚNICA À EDGE FUNCTION - ZERO QUERIES DIRETAS AO BANCO
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mobile-booking-init`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ patientId }),
        }
      );

      if (!response.ok) {
        console.error("[MobileBooking] Edge function retornou erro:", response.status);
        setError("Erro ao carregar dados.");
        setLoading(false);
        return;
      }

      const data = await response.json();
      console.log("[MobileBooking] Dados da Edge Function:", {
        professionals: data.professionals?.length || 0,
        dependents: data.dependents?.length || 0,
        clinicId: data.clinicId,
        noActiveCard: data.noActiveCard,
        cardExpired: data.cardExpired,
      });

      // Sem cartão ativo
      if (data.noActiveCard) {
        setNoActiveCard(true);
        setLoading(false);
        return;
      }

      // Cartão expirado
      if (data.cardExpired) {
        setCardExpired(true);
        setCardExpiryDate(data.cardExpiryDate);
        setLoading(false);
        return;
      }

      // Guardar clinicId no ref para uso no submit
      clinicIdRef.current = data.clinicId;

      // Processar feriados retornados pela Edge Function (feriados da clínica)
      const dates = new Set<string>();
      const addHoliday = (h: any) => {
        if (h.is_recurring && h.recurring_month && h.recurring_day) {
          const now = new Date();
          for (let y = now.getFullYear(); y <= now.getFullYear() + 1; y++) {
            const m = String(h.recurring_month).padStart(2, '0');
            const d = String(h.recurring_day).padStart(2, '0');
            dates.add(`${y}-${m}-${d}`);
          }
        } else if (h.holiday_date) {
          dates.add(h.holiday_date);
        }
      };
      (data.holidays || []).forEach(addHoliday);

      // Complementar com feriados nacionais, estaduais e municipais
      try {
        const [nat, clinicRow] = await Promise.all([
          supabase.from("national_holidays").select("holiday_date, is_recurring, recurring_month, recurring_day"),
          supabase.from("clinics").select("state_code, city, holidays_enabled").eq("id", data.clinicId).maybeSingle(),
        ]);

        if (clinicRow.data?.holidays_enabled !== false) {
          (nat.data || []).forEach(addHoliday);

          const stateCode = clinicRow.data?.state_code;
          const city = clinicRow.data?.city;

          if (stateCode) {
            const { data: st } = await supabase
              .from("state_holidays")
              .select("holiday_date, is_recurring, recurring_month, recurring_day")
              .eq("state_code", stateCode);
            (st || []).forEach(addHoliday);
          }

          if (stateCode && city) {
            const { data: mun } = await supabase
              .from("municipal_holidays")
              .select("holiday_date, is_recurring, recurring_month, recurring_day")
              .eq("state_code", stateCode)
              .eq("city", city);
            (mun || []).forEach(addHoliday);
          }
        }
      } catch (e) {
        console.warn("[MobileBooking] Falha ao carregar feriados oficiais", e);
      }

      setHolidayDates(dates);


      // Setar profissionais
      setProfessionals(data.professionals || []);

      // Setar dependentes (a edge function não retorna gender; complementar via RPC)
      const edgeDependents: Dependent[] = data.dependents || [];
      try {
        const { data: rpcDeps } = await supabase.rpc("get_patient_dependents", {
          p_patient_id: patientId,
        });
        if (rpcDeps) {
          const genderById = new Map(
            (rpcDeps as any[]).map((d) => [d.id as string, d.gender as string | null])
          );
          edgeDependents.forEach((dep) => {
            if (genderById.has(dep.id)) {
              dep.gender = genderById.get(dep.id) ?? dep.gender;
            }
          });
        }
      } catch (e) {
        console.warn("[MobileBooking] Falha ao complementar sexo dos dependentes", e);
      }
      setDependents(edgeDependents);

      // Setar configuração de meses
      if (data.bookingMonthsAhead) {
        setBookingMonthsAhead(data.bookingMonthsAhead);
      }

      // Setar configuração de limites de agendamento
      if (data.dependentBookingLimit !== undefined) setDependentBookingLimit(data.dependentBookingLimit);
      if (data.dependentBookingPeriod) setDependentBookingPeriod(data.dependentBookingPeriod);
      if (data.dependentBookingLimitEnabled !== undefined) setDependentBookingLimitEnabled(data.dependentBookingLimitEnabled);
      if (data.titularBookingLimitEnabled !== undefined) setTitularBookingLimitEnabled(data.titularBookingLimitEnabled);
      if (data.maxAppointmentsPerCpfMonth !== undefined) setMaxAppointmentsPerCpfMonth(data.maxAppointmentsPerCpfMonth);
      if (data.minAdvanceBookingHours !== undefined) setMinAdvanceBookingHours(data.minAdvanceBookingHours);
      
      // Setar data de nascimento do titular
      if (data.titularBirthDate) setTitularBirthDate(data.titularBirthDate);
      // Setar gênero do titular (necessário para regras específicas como Daniela Sales)
      if (data.titularGender) setTitularGender(data.titularGender);

      // Setar mensagem de bloqueio (se houver)
      if (data.blockedMessage) {
        setBlockedMessage(data.blockedMessage);
      }

      // Bloqueio por falta é POR PROFISSIONAL (apenas o profissional onde ocorreu a falta).
      if (data.noShowBlock && data.noShowBlock.professionalId && data.noShowBlock.until) {
        setNoShowBlock({
          professionalId: data.noShowBlock.professionalId,
          until: data.noShowBlock.until,
        });
      }

    } catch (err) {
      console.error("[MobileBooking] Error loading data:", err);
      setError("Erro ao carregar dados. Verifique sua conexão.");
    } finally {
      setLoading(false);
    }
  };

  // Check if a date is enabled for the selected professional based on schedule blocks
  const isDateEnabled = (date: Date, professional: Professional | undefined): boolean => {
    if (!professional?.schedule) return false;
    
    const blocks = professional.schedule._blocks;
    if (!blocks || blocks.length === 0) return false;
    
    const dayName = dayMap[getDay(date)];
    const dateStr = format(date, "yyyy-MM-dd");

    // Verificar se é feriado
    if (holidayDates.has(dateStr)) return false;
    
    // Check if this date is within any active block and the day is enabled
    return blocks.some(block => {
      if (!block.days.includes(dayName)) return false;
      
      if (block.start_date && block.end_date) {
        return dateStr >= block.start_date && dateStr <= block.end_date;
      }
      
      return true;
    });
  };

  // Get schedule blocks applicable for a specific date
  const getBlocksForDate = (date: Date, schedule: ProfessionalSchedule | null): ScheduleBlock[] => {
    if (!schedule?._blocks) return [];
    
    const dayName = dayMap[getDay(date)];
    const dateStr = format(date, "yyyy-MM-dd");
    
    return schedule._blocks.filter(block => {
      // Check if day of week matches
      if (!block.days.includes(dayName)) return false;
      
      // Check date range if specified
      if (block.start_date && block.end_date) {
        return dateStr >= block.start_date && dateStr <= block.end_date;
      }
      
      return true;
    });
  };

  const loadAvailableSlots = async () => {
    if (!selectedProfessionalId || !selectedDate) return;

    try {
      const professional = professionals.find(p => p.id === selectedProfessionalId);
      if (!professional?.schedule) {
        setAvailableSlots([]);
        return;
      }

      const dateStr = format(selectedDate, "yyyy-MM-dd");

      // Use edge function to bypass RLS (mobile JWT may be expired)
      const slotResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mobile-slot-availability?ts=${Date.now()}`,
        {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ professionalId: selectedProfessionalId, date: dateStr, patientId }),
        }
      );
      const slotData = slotResponse.ok ? await slotResponse.json() : { appointments: [] };
      const existingAppointments = slotData.appointments || [];
      const isQueueLocked = slotData.queueLocked === true;
      setQueueLocked(isQueueLocked);

      // Fila de espera ativa: nenhuma vaga livre é liberada para outros associados
      if (isQueueLocked) {
        setAvailableSlots([]);
        return;
      }

      // Get applicable blocks for this date
      const applicableBlocks = getBlocksForDate(selectedDate, professional.schedule);
      
      if (applicableBlocks.length === 0) {
        setAvailableSlots([]);
        return;
      }

      const slots: TimeSlot[] = [];
      const now = new Date();
      const defaultDuration = professional.appointment_duration || 30;

      // Generate slots from each applicable block
      for (const block of applicableBlocks) {
        const blockDuration = block.duration || defaultDuration;
        const [startHour, startMin] = block.start_time.split(":").map(Number);
        const [endHour, endMin] = block.end_time.split(":").map(Number);
        
        const startMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;
        
        for (let currentMinutes = startMinutes; currentMinutes + blockDuration <= endMinutes; currentMinutes += blockDuration) {
          const hours = Math.floor(currentMinutes / 60);
          const mins = currentMinutes % 60;
          const timeStr = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
          
          // Check if slot respects minimum advance booking hours (configurable)
          const slotDateTime = new Date(selectedDate);
          slotDateTime.setHours(hours, mins, 0, 0);
          const minAdvanceMs = minAdvanceBookingHours * 60 * 60 * 1000;
          if (minAdvanceMs > 0 && slotDateTime.getTime() - now.getTime() < minAdvanceMs) continue;
          
          // Check if slot conflicts with existing appointments
          const slotEndMinutes = currentMinutes + blockDuration;
          const slotEndTime = `${Math.floor(slotEndMinutes / 60).toString().padStart(2, '0')}:${(slotEndMinutes % 60).toString().padStart(2, '0')}`;
          
          const isOccupied = existingAppointments?.some(apt => {
            const aptStart = (apt.start_time as string).slice(0, 5);
            const aptEnd = (apt.end_time as string).slice(0, 5);
            // Check for any overlap
            return (timeStr < aptEnd && slotEndTime > aptStart);
          });
          
          // Avoid duplicate slots if blocks overlap
          if (!slots.some(s => s.time === timeStr)) {
            slots.push({ time: timeStr, available: !isOccupied });
          }
        }
      }

      // Sort slots by time
      slots.sort((a, b) => a.time.localeCompare(b.time));

      setAvailableSlots(slots);
    } catch (err) {
      console.error("Error loading slots:", err);
    }
  };

  const handleSubmit = async () => {
    if (!selectedProfessionalId || !selectedDate || !selectedTime) {
      toast({
        title: "Campos obrigatórios",
        description: "Selecione profissional, data e horário.",
        variant: "destructive",
      });
      return;
    }

    // Regra Daniela Sales: O Serviço de Massoterapia é SOMENTE para mulheres.
    // Como Daniela também atende outros procedimentos (abertos a homens), apenas
    // pedimos confirmação quando o paciente é do sexo masculino (titular) ou quando
    // não temos certeza do sexo (dependente). Nunca bloqueamos de forma categórica.
    const profSelected = professionals.find(p => p.id === selectedProfessionalId);

    // Regra Karen Feire: atendimento exclusivo para pacientes do sexo feminino.
    if (isFemaleOnlyProfessional(profSelected?.name)) {
      if (patientType === "titular" && isMaleGenderValue(titularGender)) {
        toast({
          title: "Atendimento exclusivo feminino",
          description: `${profSelected?.name} atende exclusivamente pacientes do sexo feminino.`,
          variant: "destructive",
        });
        return;
      }
      if (patientType === "dependent") {
        const dep = dependents.find(d => d.id === selectedDependentId);
        if (isDependentMale(dep)) {
          toast({
            title: "Atendimento exclusivo feminino",
            description: `${dep?.name || "O dependente"} não pode ser agendado com ${profSelected?.name}, que atende exclusivamente pacientes do sexo feminino.`,
            variant: "destructive",
          });
          return;
        }
      }
    }

    const isDanielaSales = !!profSelected && /daniela\s+sales/i.test(profSelected.name);
    if (isDanielaSales) {
      if (patientType === "titular") {
        const g = (titularGender || "").toLowerCase().trim();
        const isMale = g === "m" || g === "masculino" || g === "male";
        if (isMale) {
          setMassageConfirmText(
            "O Serviço de Massoterapia com Daniela Sales é SOMENTE para mulheres (sexo feminino). Daniela também atende outros procedimentos disponíveis para homens.\n\nConfirma que este agendamento NÃO é para Massoterapia?"
          );
          setMassageConfirmOpen(true);
          return;
        }
      } else if (patientType === "dependent") {
        const dep = dependents.find(d => d.id === selectedDependentId);
        const depName = dep?.name || "o(a) dependente";
        setMassageConfirmText(
          `O Serviço de Massoterapia com Daniela Sales é SOMENTE para mulheres (sexo feminino). Daniela também atende outros procedimentos disponíveis para homens.\n\nSe for Massoterapia, confirme que ${depName} é do sexo feminino. Caso contrário, confirme que o agendamento NÃO é para Massoterapia.\n\nDeseja prosseguir?`
        );
        setMassageConfirmOpen(true);
        return;
      }
    }

    await performBooking();
  };

  const performBooking = async () => {
    setSubmitting(true);

    try {
      const professional = professionals.find(p => p.id === selectedProfessionalId);
      if (!professional || !patientId || !clinicIdRef.current) {
        throw new Error("Não foi possível validar os dados do agendamento. Recarregue a tela e tente novamente.");
      }

      const isDependentBooking = patientType === "dependent" && !!selectedDependentId;
      const appointmentDate = format(selectedDate, "yyyy-MM-dd");

      // Validar gênero antes de enviar (redundância frontend)
      if (isFemaleOnlyProfessional(professional?.name)) {
        const isTitularMale = patientType === "titular" && isMaleGenderValue(titularGender);
        const selectedDep = dependents.find(d => d.id === selectedDependentId);
        const isDepMale = patientType === "dependent" && isDependentMale(selectedDep);
        
        if (isTitularMale || isDepMale) {
           throw new Error("Atendimento exclusivo para mulheres.");
        }
      }

      // Get the duration from the applicable block for this date
      const applicableBlocks = getBlocksForDate(selectedDate, professional?.schedule || null);
      const blockDuration = applicableBlocks[0]?.duration || professional?.appointment_duration || 30;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mobile-create-booking`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clinicId: clinicIdRef.current,
            patientId,
            professionalId: selectedProfessionalId,
            dependentId: isDependentBooking ? selectedDependentId : null,
            date: appointmentDate,
            time: selectedTime,
            durationMinutes: blockDuration,
            type: "first_visit",
          }),
        }
      );

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Não foi possível realizar o agendamento.");
      }

      // If reschedule, cancel the old appointment and notify via WhatsApp
      if (isReschedule && rescheduleState?.rescheduleFrom) {
        await supabase.functions.invoke("mobile-appointment-action", {
          body: {
            appointmentId: rescheduleState.rescheduleFrom,
            patientId,
            action: "cancel",
          },
        });
      }

      toast({
        title: isReschedule ? "Consulta remarcada!" : "Agendamento realizado!",
        description: `Consulta agendada para ${format(selectedDate, "dd/MM/yyyy", { locale: ptBR })} às ${selectedTime}.`,
      });

      navigate("/app/agendamentos");
    } catch (err: any) {
      console.error("Error creating appointment:", err);
      const rawMsg: string = String(err?.message || "");
      const cleanMsg = rawMsg.replace(/^[A-Z_]+:\s*/, "").trim();
      const isRule = /^[A-Z_]{4,}:/.test(rawMsg) ||
        /limite|já possui|já tem|já existe|não é permitido|nao e permitido|regra|carteirinha|bloquead|antecedência|período/i.test(rawMsg);
      toast({
        title: isRule ? "Agendamento não permitido pelas regras do sindicato" : "Não foi possível concluir o agendamento",
        description: isRule
          ? cleanMsg
          : (cleanMsg || "Tente novamente em alguns instantes."),
        variant: isRule ? "default" : "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  // No active card - prompt to get one
  if (noActiveCard) {
    return (
      <div className="min-h-screen bg-background">
        <div className="bg-emerald-600 text-white px-4 py-4 flex items-center gap-4">
          <button onClick={() => navigate("/app/home")} className="p-1">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-lg font-semibold flex-1 text-center pr-8">Agendar Consulta</h1>
        </div>
        <div className="p-6 flex flex-col items-center justify-center min-h-[60vh]">
          <div className="p-4 bg-amber-100 rounded-full mb-6">
            <CreditCard className="h-16 w-16 text-amber-600" />
          </div>
          <Badge variant="outline" className="mb-4">Sem Carteirinha</Badge>
          <h2 className="text-xl font-semibold text-foreground mb-2 text-center">Você ainda não possui carteirinha</h2>
          <p className="text-muted-foreground text-center mb-6">
            Para agendar consultas, você precisa solicitar sua carteirinha enviando seu contracheque.
          </p>
          <Button 
            className="w-full max-w-xs bg-emerald-600 hover:bg-emerald-700 mb-3"
            onClick={() => navigate("/app/atualizar-carteirinha")}
          >
            <Upload className="mr-2 h-4 w-4" />
            Solicitar Carteirinha
          </Button>
          <Button 
            variant="outline"
            className="w-full max-w-xs"
            onClick={() => navigate("/app/home")}
          >
            Voltar ao início
          </Button>
        </div>
      </div>
    );
  }

  // Card expired - show friendly update prompt
  if (cardExpired) {
    return (
      <div className="min-h-screen bg-background">
        <div className="bg-emerald-600 text-white px-4 py-4 flex items-center gap-4">
          <button onClick={() => navigate("/app/home")} className="p-1">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-lg font-semibold flex-1 text-center pr-8">Agendar Consulta</h1>
        </div>
        <div className="p-6 flex flex-col items-center justify-center min-h-[60vh]">
          <div className="p-4 bg-amber-100 rounded-full mb-6">
            <CreditCard className="h-16 w-16 text-amber-600" />
          </div>
          <Badge variant="destructive" className="mb-4">Carteirinha Vencida</Badge>
          <h2 className="text-xl font-semibold text-foreground mb-2 text-center">Sua carteirinha precisa ser renovada</h2>
          <p className="text-muted-foreground text-center mb-2">
            {cardExpiryDate ? `Venceu em ${format(new Date(cardExpiryDate), "dd/MM/yyyy", { locale: ptBR })}` : "Sua carteirinha está vencida."}
          </p>
          <p className="text-sm text-muted-foreground text-center mb-6">
            Para agendar consultas, atualize sua carteirinha enviando seu contracheque mais recente.
          </p>
          <Button 
            className="w-full max-w-xs bg-emerald-600 hover:bg-emerald-700 mb-3"
            onClick={() => navigate("/app/atualizar-carteirinha")}
          >
            <Upload className="mr-2 h-4 w-4" />
            Atualizar Agora
          </Button>
          <Button 
            variant="outline"
            className="w-full max-w-xs"
            onClick={() => navigate("/app/home")}
          >
            Voltar ao início
          </Button>
        </div>
      </div>
    );
  }

  if (blockedMessage) {
    return (
      <div className="min-h-screen bg-background">
        <div className="bg-emerald-600 text-white px-4 py-4 flex items-center gap-4">
          <button onClick={() => navigate("/app")} className="p-1">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-lg font-semibold flex-1 text-center pr-8">Agendar Consulta</h1>
        </div>
        <div className="p-6 flex flex-col items-center justify-center min-h-[60vh]">
          <AlertTriangle className="h-16 w-16 text-amber-500 mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2 text-center">Agendamento bloqueado</h2>
          <p className="text-muted-foreground text-center">{blockedMessage}</p>
          <Button 
            className="mt-6 bg-emerald-600 hover:bg-emerald-700"
            onClick={() => navigate("/app")}
          >
            Voltar ao início
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-emerald-600 text-white px-4 py-4 flex items-center gap-4">
        <button onClick={() => step > 1 ? setStep(step - 1) : navigate("/app")} className="p-1">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h1 className="text-lg font-semibold flex-1 text-center pr-8">{isReschedule ? "Remarcar Consulta" : "Agendar Consulta"}</h1>
      </div>

      {/* Progress - now 3 steps */}
      <div className="px-4 py-3 flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <div 
            key={s} 
            className={`flex-1 h-1 rounded-full ${s <= step ? 'bg-emerald-600' : 'bg-gray-200'}`}
          />
        ))}
      </div>

      <ScrollArea className="h-[calc(100vh-140px)]">
        <div className="p-4">
          {/* Step 1: Patient Type */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-foreground">Para quem é a consulta?</h2>
              
              <RadioGroup 
                value={patientType} 
                onValueChange={(v) => setPatientType(v as "titular" | "dependent")}
                className="space-y-3"
              >
                <Card className={`cursor-pointer ${patientType === "titular" ? "border-emerald-600" : ""}`}>
                  <CardContent className="p-4 flex items-center gap-4">
                    <RadioGroupItem value="titular" id="titular" />
                    <Label htmlFor="titular" className="flex-1 cursor-pointer">
                      <span className="font-medium">Para mim (Titular)</span>
                    </Label>
                  </CardContent>
                </Card>
                
                {dependents.length > 0 && (
                  <Card className={`cursor-pointer ${patientType === "dependent" ? "border-emerald-600" : ""}`}>
                    <CardContent className="p-4 flex items-center gap-4">
                      <RadioGroupItem value="dependent" id="dependent" />
                      <Label htmlFor="dependent" className="flex-1 cursor-pointer">
                        <span className="font-medium">Para um dependente</span>
                      </Label>
                    </CardContent>
                  </Card>
                )}
              </RadioGroup>

              {patientType === "dependent" && dependents.length > 0 && (
                <div className="space-y-2">
                  <Label>Selecione o dependente</Label>
                  <Select value={selectedDependentId} onValueChange={setSelectedDependentId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Escolha o dependente" />
                    </SelectTrigger>
                    <SelectContent>
                      {dependents.map((dep) => {
                        const age = dep.birth_date ? calculateAge(dep.birth_date) : null;
                        const isOverAge =
                          age !== null &&
                          age > DEPENDENT_MAX_AGE &&
                          isAgeRestrictedDependent(dep);
                        
                        return (
                          <SelectItem 
                            key={dep.id} 
                            value={dep.id}
                            disabled={isOverAge}
                          >
                            <div className="flex items-center gap-2">
                              <span>{dep.name}</span>
                              {isOverAge && (
                                <Badge variant="destructive" className="text-xs">
                                  Acima de {DEPENDENT_MAX_AGE} anos
                                </Badge>
                              )}
                              {age !== null && !isOverAge && (
                                <span className="text-xs text-muted-foreground">
                                  ({age} anos)
                                </span>
                              )}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  
                  {/* Show warning if selected dependent has no gender */}
                  {selectedDependentId && (() => {
                    const selectedDep = dependents.find(d => d.id === selectedDependentId);
                    if (selectedDep && !(selectedDep.gender || "").trim()) {
                      return (
                        <Card className="border-amber-200 bg-amber-50">
                          <CardContent className="p-3 flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
                            <p className="text-sm text-amber-800">
                              Informe o sexo deste dependente na tela de dependentes para liberar agendamentos.
                            </p>
                          </CardContent>
                        </Card>
                      );
                    }
                    return null;
                  })()}

                  {/* Show warning if selected dependent is over age limit */}
                  {selectedDependentId && (() => {
                    const selectedDep = dependents.find(d => d.id === selectedDependentId);
                    if (selectedDep?.birth_date) {
                      const age = calculateAge(selectedDep.birth_date);
                      if (age > DEPENDENT_MAX_AGE && isAgeRestrictedDependent(selectedDep)) {
                        return (
                          <Card className="border-amber-200 bg-amber-50">
                            <CardContent className="p-3 flex items-center gap-2">
                              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
                              <p className="text-sm text-amber-800">
                                Dependentes acima de {DEPENDENT_MAX_AGE} anos não podem agendar consultas.
                              </p>
                            </CardContent>
                          </Card>
                        );
                      }
                    }
                    return null;
                  })()}
                </div>
              )}

              <Button 
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                onClick={() => {
                  if (patientType === "dependent" && !selectedDependentId) {
                    toast({
                      title: "Selecione um dependente",
                      variant: "destructive",
                    });
                    return;
                  }
                  
                  // Validate age limit for dependents
                  if (patientType === "dependent" && selectedDependentId) {
                    const selectedDep = dependents.find(d => d.id === selectedDependentId);
                    if (selectedDep?.birth_date) {
                      const age = calculateAge(selectedDep.birth_date);
                      if (age > DEPENDENT_MAX_AGE && isAgeRestrictedDependent(selectedDep)) {
                        toast({
                          title: "Limite de idade excedido",
                          description: `Dependentes acima de ${DEPENDENT_MAX_AGE} anos não podem agendar consultas.`,
                          variant: "destructive",
                        });
                        return;
                      }
                    }

                    // Bloqueio: dependente sem sexo cadastrado não pode agendar (nenhum profissional)
                    if (!(selectedDep?.gender || "").trim()) {
                      toast({
                        title: "Sexo não informado",
                        description: `Informe o sexo de ${selectedDep?.name || "o dependente"} no cadastro de dependentes para liberar agendamentos.`,
                        variant: "destructive",
                      });
                      return;
                    }
                  }
                  
                  setStep(2);
                }}
              >
                Continuar
              </Button>
            </div>
          )}

          {/* Step 2: Professional Selection - Single List */}
          {step === 2 && (
            <div className="space-y-3">
              <h2 className="text-base font-semibold text-foreground">Escolha o profissional</h2>
              
              {/* Professionals List */}
              <div className="space-y-2">
                {professionals.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="p-4 text-center">
                      <p className="text-sm text-muted-foreground">
                        Nenhum profissional disponível
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  professionals.map((prof) => {
                    // Check age restriction for this professional
                    let isAgeBlocked = false;
                    let ageBlockReason = "";
                    if (prof.max_patient_age != null) {
                      let patientBirthDate: string | null = null;
                      if (patientType === "dependent" && selectedDependentId) {
                        const dep = dependents.find(d => d.id === selectedDependentId);
                        patientBirthDate = dep?.birth_date || null;
                      } else {
                        patientBirthDate = titularBirthDate;
                      }
                      if (patientBirthDate) {
                        const age = calculateAge(patientBirthDate);
                        if (age > prof.max_patient_age) {
                          isAgeBlocked = true;
                          ageBlockReason = `Atende apenas pacientes até ${prof.max_patient_age} anos`;
                        }
                      }
                    }

                    // Bloqueio por falta: aplica-se SOMENTE ao profissional onde houve a falta,
                    // e SOMENTE para o titular (dependentes não herdam o bloqueio).
                    let isNoShowBlocked = false;
                    let noShowReason = "";
                    if (
                      noShowBlock &&
                      noShowBlock.professionalId === prof.id &&
                      patientType === "titular"
                    ) {
                      const until = new Date(noShowBlock.until);
                      isNoShowBlocked = true;
                      noShowReason = `Bloqueado para este profissional até ${until.toLocaleDateString("pt-BR")} por falta anterior`;
                    }
                    const isBlocked = isAgeBlocked || isNoShowBlocked;
                    // Restrição de sexo: profissional exclusiva para mulheres
                    let isGenderBlocked = false;
                    if (isFemaleOnlyProfessional(prof.name)) {
                      if (patientType === "titular") {
                        isGenderBlocked = isMaleGenderValue(titularGender);
                      } else if (selectedDependentId) {
                        const dep = dependents.find(d => d.id === selectedDependentId);
                        isGenderBlocked = isDependentMale(dep);
                      }
                    }
                    const isBlockedFinal = isBlocked || isGenderBlocked;
                    const blockReason = isGenderBlocked
                      ? FEMALE_ONLY_MESSAGE
                      : isAgeBlocked
                        ? ageBlockReason
                        : noShowReason;

                    return (
                      <Card 
                        key={prof.id}
                        className={cn(
                          "transition-colors",
                          isBlockedFinal
                            ? "opacity-50 cursor-not-allowed" 
                            : "cursor-pointer active:scale-[0.98]",
                          selectedProfessionalId === prof.id && !isBlockedFinal
                            ? "border-emerald-600 bg-emerald-50" 
                            : ""
                        )}
                        onClick={() => {
                          if (isBlockedFinal) {
                            toast({
                              title: isGenderBlocked
                                ? "Atendimento exclusivo feminino"
                                : isNoShowBlocked
                                  ? "Agendamento bloqueado"
                                  : "Restrição de idade",
                              description: blockReason,
                              variant: "destructive",
                            });
                            return;
                          }
                          setSelectedProfessionalId(prof.id);
                          setSelectedDate(undefined);
                          setSelectedTime("");
                          setAvailableSlots([]);
                        }}
                      >
                        <CardContent className="p-3 flex items-center gap-3">
                          {prof.avatar_url ? (
                            <img 
                              src={prof.avatar_url} 
                              alt={prof.name}
                              className="w-10 h-10 rounded-full object-cover border border-border flex-shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                              <User className="h-5 w-5 text-emerald-600" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-foreground truncate">{prof.name}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {prof.specialties?.map(s => s.name).join(', ') || prof.specialty || ''}
                            </p>
                            {isAgeBlocked && (
                              <p className="text-xs text-red-500 font-medium mt-0.5">
                                ⚠️ {ageBlockReason}
                              </p>
                            )}
                            {isNoShowBlocked && (
                              <p className="text-xs text-red-500 font-medium mt-0.5">
                                ⚠️ {noShowReason}
                              </p>
                            )}
                            {isGenderBlocked && (
                              <p className="text-xs text-red-500 font-medium mt-0.5">
                                ⚠️ {FEMALE_ONLY_MESSAGE}
                              </p>
                            )}
                            {isFemaleOnlyProfessional(prof.name) && !isGenderBlocked && (
                              <p className="text-xs text-pink-600 mt-0.5">
                                Atendimento exclusivo para mulheres
                              </p>
                            )}
                            {prof.max_patient_age != null && !isAgeBlocked && (
                              <p className="text-xs text-amber-600 mt-0.5">
                                Até {prof.max_patient_age} anos
                              </p>
                            )}
                          </div>
                          {selectedProfessionalId === prof.id && !isBlockedFinal && (
                            <Check className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                          )}
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>

              <Button 
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                disabled={!selectedProfessionalId}
                onClick={() => {
                  // Double-check age restriction before proceeding
                  const prof = professionals.find(p => p.id === selectedProfessionalId);
                  if (isFemaleOnlyProfessional(prof?.name)) {
                    const dep = dependents.find(d => d.id === selectedDependentId);
                    const blockedByGender = patientType === "titular"
                      ? isMaleGenderValue(titularGender)
                      : isDependentMale(dep);
                    if (blockedByGender) {
                      toast({
                        title: "Atendimento exclusivo feminino",
                        description: `${prof?.name} ${FEMALE_ONLY_MESSAGE.toLowerCase()}`,
                        variant: "destructive",
                      });
                      return;
                    }
                  }
                  if (prof?.max_patient_age != null) {
                    let patientBirthDate: string | null = null;
                    if (patientType === "dependent" && selectedDependentId) {
                      const dep = dependents.find(d => d.id === selectedDependentId);
                      patientBirthDate = dep?.birth_date || null;
                    } else {
                      patientBirthDate = titularBirthDate;
                    }
                    if (patientBirthDate) {
                      const age = calculateAge(patientBirthDate);
                      if (age > prof.max_patient_age) {
                        toast({
                          title: "Restrição de idade",
                          description: `${prof.name} atende apenas pacientes até ${prof.max_patient_age} anos.`,
                          variant: "destructive",
                        });
                        return;
                      }
                    }
                  }
                  setStep(3);
                }}
              >
                Continuar
              </Button>
            </div>
          )}

          {/* Step 3: Date and Time in same screen */}
          {step === 3 && (
            <DateTimeSelectionStep
              selectedDate={selectedDate}
              setSelectedDate={(date) => {
                setSelectedDate(date);
                setSelectedTime(""); // Reset time when changing date
              }}
              selectedTime={selectedTime}
              setSelectedTime={setSelectedTime}
              availableSlots={availableSlots}
              queueLocked={queueLocked}
              professionals={professionals}
              selectedProfessionalId={selectedProfessionalId}
              clinicId={clinicIdRef.current}
              isDateEnabled={isDateEnabled}
              submitting={submitting}
              onSubmit={handleSubmit}
              bookingMonthsAhead={bookingMonthsAhead}
            />
          )}
        </div>
      </ScrollArea>
      <AlertDialog open={massageConfirmOpen} onOpenChange={setMassageConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Atenção — Massoterapia
            </AlertDialogTitle>
            <AlertDialogDescription className="whitespace-pre-line">
              {massageConfirmText}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setMassageConfirmOpen(false);
                void performBooking();
              }}
            >
              Confirmar e agendar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
