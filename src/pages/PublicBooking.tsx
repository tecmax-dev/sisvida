import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  Calendar, 
  Clock, 
  User, 
  Phone, 
  Mail, 
  Loader2, 
  ChevronLeft, 
  ChevronRight,
  CheckCircle2,
  Building2,
  Stethoscope,
  ArrowRight,
  MapPin,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ResponsiveSelect } from "@/components/ui/responsive-select";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { extractFunctionsError } from "@/lib/functionsError";
import { Logo } from "@/components/layout/Logo";

const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const monthNames = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const baseAppointmentTypes = [
  { value: "first_visit", label: "Primeira Consulta" },
  { value: "return", label: "Retorno" },
  { value: "exam", label: "Exame" },
  { value: "procedure", label: "Procedimento" },
  { value: "telemedicine", label: "Telemedicina" },
];

interface Clinic {
  id: string;
  name: string;
  slug: string;
  phone: string | null;
  address: string | null;
  logo_url: string | null;
  opening_time: string | null;
  closing_time: string | null;
  holidays_enabled: boolean | null;
  state_code: string | null;
  city: string | null;
}

interface Professional {
  id: string;
  name: string;
  specialty: string | null;
  appointment_duration: number | null;
  schedule: Record<string, { enabled: boolean; slots: { start: string; end: string }[] }> | null;
  avatar_url: string | null;
  telemedicine_enabled: boolean;
  slug: string | null;
}

interface InsurancePlan {
  id: string;
  name: string;
}

interface Procedure {
  id: string;
  name: string;
  description: string | null;
  price: number;
  duration_minutes: number | null;
  category: string | null;
  color: string | null;
}

interface ProcedureInsurancePrice {
  procedure_id: string;
  insurance_plan_id: string;
  price: number;
}

export default function PublicBooking() {
  const { clinicSlug } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [insurancePlans, setInsurancePlans] = useState<InsurancePlan[]>([]);
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [procedureInsurancePrices, setProcedureInsurancePrices] = useState<ProcedureInsurancePrice[]>([]);
  const [existingAppointments, setExistingAppointments] = useState<string[]>([]);
  const [existingAppointmentsWithDuration, setExistingAppointmentsWithDuration] = useState<Array<{ start_time: string; duration_minutes: number | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [clinicHasTelemedicine, setClinicHasTelemedicine] = useState(false);
  const [holidays, setHolidays] = useState<Set<string>>(new Set());
  
  // Calendar
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  
  // Form
  const [step, setStep] = useState(1);
  const [selectedProfessional, setSelectedProfessional] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [selectedType, setSelectedType] = useState("first_visit");
  const [selectedProcedure, setSelectedProcedure] = useState("");
  const [patientName, setPatientName] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [patientEmail, setPatientEmail] = useState("");
  const [selectedInsurance, setSelectedInsurance] = useState("");
  const [patientCpf, setPatientCpf] = useState("");
  const [searchingPatient, setSearchingPatient] = useState(false);
  const [patientFound, setPatientFound] = useState(false);
  
  // Dependents
  interface Dependent {
    id: string;
    name: string;
    relationship: string | null;
    card_expires_at: string | null;
  }
  const [dependents, setDependents] = useState<Dependent[]>([]);
  const [selectedDependent, setSelectedDependent] = useState<string>(""); // "" = titular, "id" = dependent

  useEffect(() => {
    fetchClinicData();
  }, [clinicSlug]);

  useEffect(() => {
    if (clinic && selectedProfessional && selectedDate) {
      fetchExistingAppointments();
    }
  }, [clinic, selectedProfessional, selectedDate]);

  const fetchClinicData = async () => {
    if (!clinicSlug) return;
    
    setLoading(true);
    try {
      const { data: clinicData, error: clinicError } = await supabase
        .from('clinics')
        .select('*')
        .eq('slug', clinicSlug)
        .single();

      if (clinicError || !clinicData) {
        toast({
          title: "Clínica não encontrada",
          description: "Verifique o link de agendamento",
          variant: "destructive",
        });
        return;
      }

      setClinic(clinicData);

      // Check if clinic plan includes telemedicine feature
      const { data: subscriptionData } = await supabase
        .from('subscriptions')
        .select(`
          plan_id,
          subscription_plans!inner(
            id
          )
        `)
        .eq('clinic_id', clinicData.id)
        .in('status', ['trial', 'active'])
        .maybeSingle();

      if (subscriptionData?.plan_id) {
        const { data: planFeaturesData } = await supabase
          .from('plan_features')
          .select(`
            feature_id,
            system_features!inner(key)
          `)
          .eq('plan_id', subscriptionData.plan_id);

        const hasTelemedicine = planFeaturesData?.some(
          (pf: any) => pf.system_features?.key === 'telemedicine'
        ) || false;
        setClinicHasTelemedicine(hasTelemedicine);
      }

      // Fetch professionals with schedules
      const { data: professionalsData } = await supabase
        .from('professionals')
        .select('id, name, specialty, appointment_duration, schedule, avatar_url, telemedicine_enabled, slug')
        .eq('clinic_id', clinicData.id)
        .eq('is_active', true);

      setProfessionals(professionalsData as Professional[] || []);

      // Fetch insurance plans
      const { data: insuranceData } = await supabase
        .from('insurance_plans')
        .select('id, name')
        .eq('clinic_id', clinicData.id)
        .eq('is_active', true);

      setInsurancePlans(insuranceData || []);

      // Fetch active procedures
      const { data: proceduresData } = await supabase
        .from('procedures')
        .select('id, name, description, price, duration_minutes, category, color')
        .eq('clinic_id', clinicData.id)
        .eq('is_active', true);

      setProcedures(proceduresData || []);

      // Fetch procedure insurance prices
      if (proceduresData && proceduresData.length > 0) {
        const procedureIds = proceduresData.map(p => p.id);
        const { data: pricesData } = await supabase
          .from('procedure_insurance_prices')
          .select('procedure_id, insurance_plan_id, price')
          .in('procedure_id', procedureIds);
        
        setProcedureInsurancePrices(pricesData || []);
      }

      // Fetch holidays if enabled
      if (clinicData.holidays_enabled !== false) {
        await fetchHolidays(clinicData);
      }
    } catch (error) {
      console.error('Error fetching clinic data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchHolidays = async (clinicData: Clinic) => {
    try {
      const holidayDates = new Set<string>();
      const currentYear = new Date().getFullYear();
      const years = [currentYear, currentYear + 1];

      // Fetch national holidays
      const { data: nationalHolidays } = await supabase
        .from('national_holidays')
        .select('holiday_date, is_recurring, recurring_month, recurring_day');

      nationalHolidays?.forEach((h: any) => {
        if (h.is_recurring && h.recurring_month && h.recurring_day) {
          years.forEach(year => {
            const dateStr = `${year}-${String(h.recurring_month).padStart(2, '0')}-${String(h.recurring_day).padStart(2, '0')}`;
            holidayDates.add(dateStr);
          });
        } else if (h.holiday_date) {
          holidayDates.add(h.holiday_date);
        }
      });

      // Fetch state holidays if clinic has state configured
      if (clinicData.state_code) {
        const { data: stateHolidays } = await supabase
          .from('state_holidays')
          .select('holiday_date, is_recurring, recurring_month, recurring_day')
          .eq('state_code', clinicData.state_code);

        stateHolidays?.forEach((h: any) => {
          if (h.is_recurring && h.recurring_month && h.recurring_day) {
            years.forEach(year => {
              const dateStr = `${year}-${String(h.recurring_month).padStart(2, '0')}-${String(h.recurring_day).padStart(2, '0')}`;
              holidayDates.add(dateStr);
            });
          } else if (h.holiday_date) {
            holidayDates.add(h.holiday_date);
          }
        });
      }

      // Fetch municipal holidays if clinic has state and city configured
      if (clinicData.state_code && clinicData.city) {
        const { data: municipalHolidays } = await supabase
          .from('municipal_holidays')
          .select('holiday_date, is_recurring, recurring_month, recurring_day')
          .eq('state_code', clinicData.state_code)
          .eq('city', clinicData.city);

        municipalHolidays?.forEach((h: any) => {
          if (h.is_recurring && h.recurring_month && h.recurring_day) {
            years.forEach(year => {
              const dateStr = `${year}-${String(h.recurring_month).padStart(2, '0')}-${String(h.recurring_day).padStart(2, '0')}`;
              holidayDates.add(dateStr);
            });
          } else if (h.holiday_date) {
            holidayDates.add(h.holiday_date);
          }
        });
      }

      // Fetch clinic-specific holidays
      const { data: clinicHolidays } = await supabase
        .from('clinic_holidays')
        .select('holiday_date, is_recurring, recurring_month, recurring_day')
        .eq('clinic_id', clinicData.id);

      clinicHolidays?.forEach((h: any) => {
        if (h.is_recurring && h.recurring_month && h.recurring_day) {
          years.forEach(year => {
            const dateStr = `${year}-${String(h.recurring_month).padStart(2, '0')}-${String(h.recurring_day).padStart(2, '0')}`;
            holidayDates.add(dateStr);
          });
        } else if (h.holiday_date) {
          holidayDates.add(h.holiday_date);
        }
      });

      setHolidays(holidayDates);
    } catch (error) {
      console.error('Error fetching holidays:', error);
    }
  };

  const fetchExistingAppointments = async () => {
    if (!clinic || !selectedProfessional || !selectedDate) return;

    const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`;
    
    const { data } = await supabase
      .from('appointments')
      .select('start_time, duration_minutes')
      .eq('clinic_id', clinic.id)
      .eq('professional_id', selectedProfessional)
      .eq('appointment_date', dateStr)
      .in('status', ['scheduled', 'confirmed']);

    setExistingAppointments(data?.map(a => a.start_time.substring(0, 5)) || []);
    setExistingAppointmentsWithDuration(data || []);
  };

  const appointmentDuration = useMemo(() => {
    if (selectedProcedure) {
      const procedure = procedures.find(p => p.id === selectedProcedure);
      if (procedure?.duration_minutes) return procedure.duration_minutes;
    }
    const professional = professionals.find(p => p.id === selectedProfessional);
    return professional?.appointment_duration || 30;
  }, [selectedProcedure, selectedProfessional, procedures, professionals]);

  // Helper to check if a time slot conflicts with existing appointments
  const isSlotConflicting = (slotTime: string, slotDuration: number, existingAppts: Array<{start_time: string, duration_minutes: number | null}>, defaultDuration: number) => {
    const [slotHour, slotMin] = slotTime.split(':').map(Number);
    const slotStart = slotHour * 60 + slotMin;
    const slotEnd = slotStart + slotDuration;

    for (const appt of existingAppts) {
      const apptTime = appt.start_time.substring(0, 5);
      const [apptHour, apptMin] = apptTime.split(':').map(Number);
      const apptStart = apptHour * 60 + apptMin;
      const apptDuration = appt.duration_minutes || defaultDuration;
      const apptEnd = apptStart + apptDuration;

      // Check for overlap: slots conflict if one starts before the other ends
      if (slotStart < apptEnd && slotEnd > apptStart) {
        return true;
      }
    }
    return false;
  };

  const availableTimeSlots = useMemo(() => {
    if (!selectedDate || !selectedProfessional) return [];
    
    const professional = professionals.find(p => p.id === selectedProfessional);
    if (!professional) return [];
    
    const dayIndex = selectedDate.getDay();
    const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayKey = dayKeys[dayIndex];
    
    const schedule = professional.schedule as Record<string, any> | null;
    if (!schedule) return [];
    
    const duration = appointmentDuration;
    const defaultProfDuration = professional.appointment_duration || 30;
    const selectedDateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`;

    const uniqueSortTimes = (times: string[]) => {
      const unique = Array.from(new Set(times));
      unique.sort((a, b) => {
        const [aH, aM] = a.split(':').map(Number);
        const [bH, bM] = b.split(':').map(Number);
        return (aH * 60 + aM) - (bH * 60 + bM);
      });
      return unique;
    };

    // Check if we have the new _blocks format
    if (schedule._blocks && Array.isArray(schedule._blocks) && schedule._blocks.length > 0) {
      const slots: string[] = [];

      schedule._blocks.forEach((block: any) => {
        if (!block.days || !block.days.includes(dayKey)) return;
        if (block.start_date && selectedDateStr < block.start_date) return;
        if (block.end_date && selectedDateStr > block.end_date) return;

        const [startHour, startMin] = String(block.start_time).split(':').map(Number);
        const [endHour, endMin] = String(block.end_time).split(':').map(Number);

        const slotStartMinutes = startHour * 60 + startMin;
        const slotEndMinutes = endHour * 60 + endMin;

        const blockInterval = Number(block.duration || defaultProfDuration);
        let current = slotStartMinutes;

        while (current + duration <= slotEndMinutes) {
          const hour = Math.floor(current / 60);
          const min = current % 60;
          const timeStr = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;

          if (!isSlotConflicting(timeStr, duration, existingAppointmentsWithDuration, defaultProfDuration)) {
            slots.push(timeStr);
          }

          current += blockInterval;
        }
      });

      return uniqueSortTimes(slots);
    }

    // Fallback to old format
    if (!schedule[dayKey] || !schedule[dayKey].enabled) {
      return [];
    }

    const slots: string[] = [];
    const daySchedule = schedule[dayKey];

    daySchedule.slots.forEach((slot: { start: string; end: string }) => {
      const [startHour, startMin] = slot.start.split(':').map(Number);
      const [endHour, endMin] = slot.end.split(':').map(Number);

      const slotStartMinutes = startHour * 60 + startMin;
      const slotEndMinutes = endHour * 60 + endMin;

      const scheduleIsHourOnly = daySchedule.slots.every((s: { start: string; end: string }) =>
        s.start.endsWith(':00') && s.end.endsWith(':00')
      );

      const slotInterval = scheduleIsHourOnly ? 60 : defaultProfDuration;
      let current = slotStartMinutes;

      while (current + duration <= slotEndMinutes) {
        const hour = Math.floor(current / 60);
        const min = current % 60;
        const timeStr = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;

        if (!isSlotConflicting(timeStr, duration, existingAppointmentsWithDuration, defaultProfDuration)) {
          slots.push(timeStr);
        }

        current += slotInterval;
      }
    });

    return uniqueSortTimes(slots);
  }, [selectedDate, selectedProfessional, professionals, existingAppointmentsWithDuration, appointmentDuration]);

  const appointmentTypes = useMemo(() => {
    if (!clinicHasTelemedicine) {
      return baseAppointmentTypes.filter(t => t.value !== 'telemedicine');
    }
    
    if (selectedProfessional) {
      const prof = professionals.find(p => p.id === selectedProfessional);
      if (!prof?.telemedicine_enabled) {
        return baseAppointmentTypes.filter(t => t.value !== 'telemedicine');
      }
    }
    
    return baseAppointmentTypes;
  }, [clinicHasTelemedicine, selectedProfessional, professionals]);

  const getProcedurePrice = (procedureId: string, defaultPrice: number): number => {
    if (!selectedInsurance) return defaultPrice;
    
    const insurancePrice = procedureInsurancePrices.find(
      p => p.procedure_id === procedureId && p.insurance_plan_id === selectedInsurance
    );
    
    return insurancePrice ? insurancePrice.price : defaultPrice;
  };

  const isDayAvailable = (date: Date) => {
    if (!selectedProfessional) return true;
    
    const professional = professionals.find(p => p.id === selectedProfessional);
    if (!professional?.schedule) return true;
    
    const dayIndex = date.getDay();
    const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayKey = dayKeys[dayIndex];
    const schedule = professional.schedule as Record<string, any>;
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    
    // Check new _blocks format first
    if (schedule._blocks && Array.isArray(schedule._blocks) && schedule._blocks.length > 0) {
      return schedule._blocks.some((block: any) => {
        if (!block.days || !block.days.includes(dayKey)) return false;
        if (block.start_date && dateStr < block.start_date) return false;
        if (block.end_date && dateStr > block.end_date) return false;
        return true;
      });
    }
    
    // Fallback to old format
    return schedule[dayKey]?.enabled || false;
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: (Date | null)[] = [];

    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push(null);
    }

    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  };

  const isHoliday = (date: Date) => {
    // Avoid timezone shifts from toISOString(); we need the user's local calendar date.
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    return holidays.has(dateStr);
  };

  const isDateDisabled = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date < today) return true;
    if (!isDayAvailable(date)) return true;
    if (isHoliday(date)) return true;
    return false;
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };

  const formatCpf = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
    if (numbers.length <= 9) return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
    return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9, 11)}`;
  };

  const validateCpf = (cpf: string): boolean => {
    const cleanCpf = cpf.replace(/\D/g, '');
    if (cleanCpf.length !== 11) return false;
    
    // Check for known invalid patterns (all same digits)
    if (/^(\d)\1+$/.test(cleanCpf)) return false;
    
    // Validate first verification digit
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cleanCpf[i]) * (10 - i);
    }
    let remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cleanCpf[9])) return false;
    
    // Validate second verification digit
    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(cleanCpf[i]) * (11 - i);
    }
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cleanCpf[10])) return false;
    
    return true;
  };

  const [cpfError, setCpfError] = useState("");

  const searchPatientByCpf = async (cpf: string) => {
    const cleanCpf = cpf.replace(/\D/g, '');
    if (cleanCpf.length !== 11 || !clinic) return;
    
    if (!validateCpf(cleanCpf)) {
      setCpfError("CPF inválido");
      return;
    }
    
    setCpfError("");
    setSearchingPatient(true);
    setPatientFound(false);
    
    try {
      const { data, error } = await supabase.functions.invoke('search-patient-by-cpf', {
        body: { clinicId: clinic.id, cpf: cleanCpf }
      });
      
      if (error) throw error;
      
      if (data?.patient) {
        setPatientName(data.patient.name);
        setPatientPhone(formatPhone(data.patient.phone));
        setPatientEmail(data.patient.email || '');
        setPatientFound(true);
        
        // Set dependents if available
        if (data.dependents && data.dependents.length > 0) {
          setDependents(data.dependents);
          setSelectedDependent(""); // Default to titular
        } else {
          setDependents([]);
          setSelectedDependent("");
        }
        
        toast({ 
          title: "Cadastro encontrado!", 
          description: data.dependents?.length > 0 
            ? `Seus dados foram preenchidos. Você tem ${data.dependents.length} dependente(s) cadastrado(s).`
            : "Seus dados foram preenchidos automaticamente." 
        });
      }
    } catch (err) {
      console.error('Error searching patient:', err);
    } finally {
      setSearchingPatient(false);
    }
  };

  // Debounced CPF search
  useEffect(() => {
    const cleanCpf = patientCpf.replace(/\D/g, '');
    if (cleanCpf.length === 11 && clinic) {
      const timeoutId = setTimeout(() => {
        searchPatientByCpf(patientCpf);
      }, 500);
      return () => clearTimeout(timeoutId);
    } else {
      setPatientFound(false);
      setCpfError("");
      setDependents([]);
      setSelectedDependent("");
    }
  }, [patientCpf, clinic]);

  const handleSubmit = async () => {
    if (!clinic || !selectedDate || !selectedProfessional || !selectedTime || !patientName || !patientPhone) {
      toast({
        title: "Preencha todos os campos",
        variant: "destructive",
      });
      return;
    }

    const trimmedName = patientName.trim();
    if (trimmedName.length < 2 || trimmedName.length > 100) {
      toast({
        title: "Nome inválido",
        description: "O nome deve ter entre 2 e 100 caracteres",
        variant: "destructive",
      });
      return;
    }

    const phoneClean = patientPhone.replace(/\D/g, '');
    if (phoneClean.length < 10 || phoneClean.length > 11) {
      toast({
        title: "Telefone inválido",
        description: "O telefone deve ter 10 ou 11 dígitos",
        variant: "destructive",
      });
      return;
    }

    if (patientEmail && patientEmail.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(patientEmail.trim())) {
        toast({
          title: "Email inválido",
          description: "Por favor, insira um email válido",
          variant: "destructive",
        });
        return;
      }
    }

    setSubmitting(true);
    try {
      const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`;

      const { data, error } = await supabase.functions.invoke('create-public-booking', {
        body: {
          clinicId: clinic.id,
          professionalId: selectedProfessional,
          date: dateStr,
          time: selectedTime,
          type: selectedType,
          patientName: trimmedName,
          patientPhone: phoneClean,
          patientEmail: patientEmail?.trim() || null,
          patientCpf: patientCpf?.replace(/\D/g, '') || null,
          procedureId: selectedProcedure || null,
          insurancePlanId: selectedInsurance || null,
          durationMinutes: appointmentDuration,
          dependentId: selectedDependent || null,
        },
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || 'Erro ao criar agendamento');
      }

      setSuccess(true);
      toast({
        title: "Agendamento realizado!",
        description: "Você receberá uma confirmação em breve.",
      });
    } catch (error: unknown) {
      console.error("Error creating appointment:", error);

      // 1) best-effort extraction from common Supabase error shapes
      let { message: derivedMessage } = extractFunctionsError(error);

      // 2) If Supabase only gave us the generic non-2xx message, try to read the actual response body
      if (derivedMessage.includes("non-2xx")) {
        try {
          const anyErr: any = error;
          const res: any = anyErr?.context?.response;
          if (res && typeof res.text === "function") {
            const rawText = await res.text();
            const parsed = (() => {
              try {
                return JSON.parse(rawText);
              } catch {
                return null;
              }
            })();

            const msgFromBody =
              (parsed && typeof parsed.error === "string" && parsed.error) ||
              (parsed && typeof parsed.message === "string" && parsed.message) ||
              (typeof rawText === "string" && rawText.trim() ? rawText : null);

            if (msgFromBody) derivedMessage = msgFromBody;
          }
        } catch {
          // ignore
        }
      }

      let title = "Erro ao agendar";
      let description = derivedMessage || "Tente novamente";

      if (derivedMessage.includes("HORARIO_INVALIDO") || derivedMessage.includes("horário")) {
        title = "Horário indisponível";
        const match = derivedMessage.match(/HORARIO_INVALIDO:\s*(.+)/);
        description = match ? match[1].trim() : derivedMessage;
      } else if (derivedMessage.includes("carteirinha") || derivedMessage.includes("CARTEIRINHA")) {
        title = "Carteirinha vencida";
        description = derivedMessage;
      } else if (derivedMessage.includes("LIMITE_AGENDAMENTO") || derivedMessage.includes("limite")) {
        title = "Limite de agendamentos";
        description = derivedMessage;
      } else if (derivedMessage.includes("DEPENDENTE_INVALIDO") || derivedMessage.includes("dependente")) {
        title = "Dependente inválido";
        description = derivedMessage;
      } else if (derivedMessage.includes("FERIADO") || derivedMessage.includes("feriado")) {
        title = "Data indisponível";
        description = derivedMessage;
      } else if (derivedMessage.includes("Rate limit") || derivedMessage.includes("429")) {
        title = "Muitas tentativas";
        description = "Por favor, aguarde alguns minutos antes de tentar novamente.";
      } else if (derivedMessage.includes("non-2xx")) {
        description = "Não foi possível concluir o agendamento. Verifique os dados e tente novamente.";
      }

      toast({
        title,
        description,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleProfessionalClick = (professional: Professional) => {
    if (professional.slug && clinic) {
      navigate(`/profissional/${clinic.slug}/${professional.slug}`);
    } else {
      setSelectedProfessional(professional.id);
      setStep(2);
    }
  };

  const selectedProfessionalData = professionals.find(p => p.id === selectedProfessional);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!clinic) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">Clínica não encontrada</h2>
            <p className="text-muted-foreground">Verifique o link de agendamento</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Agendamento Confirmado!</h2>
            <p className="text-muted-foreground mb-6">
              Você receberá uma confirmação por WhatsApp em breve.
            </p>
            <div className="bg-muted/50 rounded-lg p-4 text-left mb-6">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Profissional:</span>
                  <span className="font-medium">{selectedProfessionalData?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Data:</span>
                  <span className="font-medium">
                    {selectedDate?.toLocaleDateString('pt-BR')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Horário:</span>
                  <span className="font-medium">{selectedTime}</span>
                </div>
              </div>
            </div>
            <Button onClick={() => {
              setSuccess(false);
              setStep(1);
              setSelectedProfessional("");
              setSelectedDate(null);
              setSelectedTime("");
              setPatientName("");
              setPatientPhone("");
              setPatientEmail("");
            }} variant="outline" className="w-full">
              Fazer outro agendamento
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {clinic.logo_url ? (
                <img src={clinic.logo_url} alt={clinic.name} className="h-10 w-auto" />
              ) : (
                <Logo size="sm" />
              )}
              <div>
                <h1 className="font-semibold text-foreground">{clinic.name}</h1>
                {clinic.address && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {clinic.address}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Step 1: Select Professional */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold mb-2">Escolha o Profissional</h2>
              <p className="text-muted-foreground">Selecione o profissional para sua consulta</p>
            </div>

            {professionals.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {professionals.map((professional) => (
                  <Card 
                    key={professional.id} 
                    className="cursor-pointer hover:shadow-lg hover:border-primary/50 transition-all duration-200 group"
                    onClick={() => handleProfessionalClick(professional)}
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start gap-4">
                        <Avatar className="w-16 h-16 border-2 border-primary/10">
                          <AvatarImage src={professional.avatar_url || undefined} alt={professional.name} />
                          <AvatarFallback className="text-lg bg-primary/10 text-primary font-semibold">
                            {professional.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                            {professional.name}
                          </h3>
                          {professional.specialty && (
                            <p className="text-sm text-muted-foreground mt-0.5">
                              {professional.specialty}
                            </p>
                          )}
                          {professional.telemedicine_enabled && clinicHasTelemedicine && (
                            <Badge variant="secondary" className="mt-2 text-xs">
                              Telemedicina disponível
                            </Badge>
                          )}
                        </div>
                        <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Stethoscope className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Nenhum profissional disponível no momento</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Step 2: Select Date & Time */}
        {step === 2 && selectedProfessionalData && (
          <div className="space-y-6">
            {/* Back Button */}
            <Button variant="ghost" onClick={() => setStep(1)} className="gap-2">
              <ChevronLeft className="h-4 w-4" />
              Voltar
            </Button>

            {/* Professional Info */}
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={selectedProfessionalData.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {selectedProfessionalData.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold">{selectedProfessionalData.name}</h3>
                    {selectedProfessionalData.specialty && (
                      <p className="text-sm text-muted-foreground">{selectedProfessionalData.specialty}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Procedure Selection - Moved before date/time for mobile visibility */}
            {procedures.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Procedimento (opcional)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveSelect
                    value={selectedProcedure}
                    onValueChange={setSelectedProcedure}
                    options={procedures.map((procedure) => ({
                      value: procedure.id,
                      label: procedure.name + (procedure.price > 0 ? ` - R$ ${getProcedurePrice(procedure.id, procedure.price).toFixed(2)}` : ''),
                    }))}
                    placeholder="Selecione um procedimento"
                    title="Procedimento"
                  />
                </CardContent>
              </Card>
            )}

            <div className="grid lg:grid-cols-2 gap-6">
              {/* Left: Date Selection */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Calendar className="h-5 w-5 text-primary" />
                    Escolha a Data
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-3">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="font-medium">
                        {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-7 gap-1 mb-2">
                      {weekDays.map((day) => (
                        <div key={day} className="text-center text-xs font-medium text-muted-foreground py-1">
                          {day}
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {getDaysInMonth(currentMonth).map((date, index) => (
                        <div key={index} className="aspect-square relative">
                          {date && (
                            <button
                              onClick={() => !isDateDisabled(date) && setSelectedDate(date)}
                              disabled={isDateDisabled(date)}
                              title={isHoliday(date) ? "Feriado" : undefined}
                              className={cn(
                                "w-full h-full rounded-md text-sm font-medium transition-colors",
                                isHoliday(date)
                                  ? "bg-destructive/10 text-destructive/70 cursor-not-allowed dark:bg-destructive/15 dark:text-destructive/70"
                                  : isDateDisabled(date) 
                                    ? "text-muted-foreground/40 cursor-not-allowed" 
                                    : "hover:bg-primary/10",
                                selectedDate?.toDateString() === date.toDateString() 
                                  ? "bg-primary text-primary-foreground hover:bg-primary" 
                                  : ""
                              )}
                            >
                              {date.getDate()}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Right: Time Selection */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Clock className="h-5 w-5 text-primary" />
                    Escolha o Horário
                  </CardTitle>
                  {selectedDate && (
                    <CardDescription>
                      {selectedDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  {!selectedDate ? (
                    <p className="text-muted-foreground text-center py-8">
                      Selecione uma data primeiro
                    </p>
                  ) : availableTimeSlots.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2">
                      {Array.from(new Set(availableTimeSlots)).map((time) => (
                        <button
                          key={time}
                          onClick={() => setSelectedTime(time)}
                          className={cn(
                            "py-3 px-4 rounded-lg text-sm font-medium border transition-all",
                            selectedTime === time
                              ? "bg-primary text-primary-foreground border-primary shadow-md"
                              : "border-border hover:border-primary hover:bg-primary/5"
                          )}
                        >
                          {time}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">
                      Nenhum horário disponível para esta data
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Continue Button */}
            <Button
              onClick={() => setStep(3)}
              disabled={!selectedDate || !selectedTime}
              className="w-full h-12 text-base"
              size="lg"
            >
              Continuar
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        )}

        {/* Step 3: Patient Info */}
        {step === 3 && selectedProfessionalData && (
          <div className="space-y-6">
            {/* Back Button */}
            <Button variant="ghost" onClick={() => setStep(2)} className="gap-2">
              <ChevronLeft className="h-4 w-4" />
              Voltar
            </Button>

            {/* Summary Card */}
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-4">
                <div className="flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" />
                    <span className="font-medium">{selectedProfessionalData.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    <span>{selectedDate?.toLocaleDateString('pt-BR')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    <span>{selectedTime}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Seus Dados</CardTitle>
                <CardDescription>Preencha suas informações para confirmar o agendamento</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  {/* Insurance Plan */}
                  {insurancePlans.length > 0 && (
                    <div className="sm:col-span-2">
                      <Label>Convênio</Label>
                      <ResponsiveSelect
                        value={selectedInsurance}
                        onValueChange={setSelectedInsurance}
                        options={[
                          { value: "particular", label: "Particular" },
                          ...insurancePlans.map((plan) => ({
                            value: plan.id,
                            label: plan.name,
                          })),
                        ]}
                        placeholder="Particular"
                        title="Convênio"
                        className="mt-1.5"
                      />
                    </div>
                  )}

                  {/* Appointment Type */}
                  <div className="sm:col-span-2">
                    <Label>Tipo de Consulta</Label>
                    <ResponsiveSelect
                      value={selectedType}
                      onValueChange={setSelectedType}
                      options={appointmentTypes}
                      placeholder="Selecione o tipo"
                      title="Tipo de Consulta"
                      className="mt-1.5"
                    />
                  </div>

                  {/* CPF - Auto Search */}
                  <div className="sm:col-span-2">
                    <Label htmlFor="patientCpf">CPF</Label>
                    <div className="relative">
                      <Input
                        id="patientCpf"
                        value={patientCpf}
                        onChange={(e) => setPatientCpf(formatCpf(e.target.value))}
                        placeholder="000.000.000-00"
                        maxLength={14}
                        className={cn("mt-1.5 pr-10", cpfError && "border-destructive")}
                      />
                      {searchingPatient && (
                        <Loader2 className="absolute right-3 top-1/2 translate-y-[-25%] h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                      {patientFound && !searchingPatient && (
                        <CheckCircle2 className="absolute right-3 top-1/2 translate-y-[-25%] h-4 w-4 text-green-500" />
                      )}
                    </div>
                    {cpfError ? (
                      <p className="text-xs text-destructive mt-1">{cpfError}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-1">
                        Digite seu CPF para buscar seu cadastro automaticamente
                      </p>
                    )}
                  </div>

                  {/* Dependent Selection - Only show if patient found and has dependents */}
                  {patientFound && dependents.length > 0 && (
                    <div className="sm:col-span-2">
                      <Label>Para quem é esta consulta?</Label>
                      <ResponsiveSelect
                        value={selectedDependent || "titular"}
                        onValueChange={(val) => setSelectedDependent(val === "titular" ? "" : val)}
                        options={[
                          { value: "titular", label: `${patientName} (Titular)` },
                          ...dependents.map((dep) => {
                            const isExpired = dep.card_expires_at && new Date(dep.card_expires_at) < new Date();
                            return {
                              value: dep.id,
                              label: `${dep.name}${dep.relationship ? ` (${dep.relationship})` : ''}${isExpired ? ' - Carteirinha vencida' : ''}`,
                              disabled: isExpired,
                            };
                          }),
                        ]}
                        placeholder="Selecione"
                        title="Para quem é a consulta"
                        className="mt-1.5"
                      />
                      {selectedDependent && (
                        <p className="text-xs text-primary mt-1">
                          Agendando para dependente: {dependents.find(d => d.id === selectedDependent)?.name}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Patient Name */}
                  <div className="sm:col-span-2">
                    <Label htmlFor="patientName">Nome completo *</Label>
                    <Input
                      id="patientName"
                      value={patientName}
                      onChange={(e) => setPatientName(e.target.value)}
                      placeholder="Seu nome completo"
                      className="mt-1.5"
                      disabled={patientFound}
                    />
                  </div>

                  {/* Phone */}
                  <div>
                    <Label htmlFor="patientPhone">Telefone / WhatsApp *</Label>
                    <Input
                      id="patientPhone"
                      value={patientPhone}
                      onChange={(e) => setPatientPhone(formatPhone(e.target.value))}
                      placeholder="(00) 00000-0000"
                      maxLength={15}
                      className="mt-1.5"
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <Label htmlFor="patientEmail">Email (opcional)</Label>
                    <Input
                      id="patientEmail"
                      type="email"
                      value={patientEmail}
                      onChange={(e) => setPatientEmail(e.target.value)}
                      placeholder="seu@email.com"
                      className="mt-1.5"
                    />
                  </div>
                </div>

                {/* Submit Button */}
                <Button
                  onClick={handleSubmit}
                  disabled={submitting || !patientName || !patientPhone}
                  className="w-full h-12 text-base mt-6"
                  size="lg"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Agendando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-5 w-5" />
                      Confirmar Agendamento
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}