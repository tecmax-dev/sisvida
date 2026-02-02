import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  Loader2, 
  User,
  AlertTriangle,
  Check,
  Scale,
  Calendar,
  Clock,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Upload,
  FileText,
  X,
} from "lucide-react";
import { format, parseISO, addMinutes, isBefore, startOfDay, isSameDay, addDays, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMobileAuth } from "@/contexts/MobileAuthContext";

interface LegalProfessional {
  id: string;
  name: string;
  function: string | null;
  avatar_url: string | null;
  phone: string | null;
  email: string | null;
}

interface LegalSchedule {
  id: string;
  professional_id: string;
  day_of_week: number; // 0 = Sunday, 1 = Monday, etc.
  start_time: string;
  end_time: string;
  capacity: number;
  is_active: boolean;
}

interface ServiceType {
  id: string;
  name: string;
  duration_minutes: number;
  description: string | null;
}

interface LegalAppointment {
  id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: string;
  professional_id: string;
}

interface TimeSlot {
  time: string;
  available: boolean;
}

export default function MobileLegalBookingPage() {
  const { patientId: authPatientId, clinicId: authClinicId, initialized } = useMobileAuth();
  const [step, setStep] = useState(1);
  const [professionals, setProfessionals] = useState<LegalProfessional[]>([]);
  const [schedules, setSchedules] = useState<LegalSchedule[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<string>("");
  const [selectedServiceTypeId, setSelectedServiceTypeId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string>("");
  
  const [existingAppointments, setExistingAppointments] = useState<LegalAppointment[]>([]);
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [patientBlocked, setPatientBlocked] = useState(false);
  const [isDependent, setIsDependent] = useState(false);
  const [monthlyLimitReached, setMonthlyLimitReached] = useState(false);
  const [cardExpired, setCardExpired] = useState(false);
  const [cardInfo, setCardInfo] = useState<{ id: string; expires_at: string | null; card_number: string } | null>(null);
  const [hasPendingPayslip, setHasPendingPayslip] = useState(false);
  const [uploadingPayslip, setUploadingPayslip] = useState(false);
  const [payslipFile, setPayslipFile] = useState<File | null>(null);
  const [payslipSubmitted, setPayslipSubmitted] = useState(false);
  
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (initialized && authPatientId && authClinicId) {
      loadInitialData();
    }
  }, [initialized, authPatientId, authClinicId]);

  useEffect(() => {
    if (selectedProfessionalId && selectedDate) {
      loadAvailableSlots();
    }
  }, [selectedProfessionalId, selectedDate, selectedServiceTypeId]);

  const loadInitialData = async () => {
    if (!authPatientId || !authClinicId) {
      console.error("[MobileLegalBooking] Sessão inválida - patientId/clinicId ausente");
      setLoading(false);
      return;
    }
    
    try {
      // Check if patient is active
      const { data: patientData, error: patientError } = await supabase
        .from("patients")
        .select("id, is_active, cpf")
        .eq("id", authPatientId)
        .single();

      if (patientError || !patientData?.is_active) {
        setPatientBlocked(true);
        setLoading(false);
        return;
      }

      // Check if this is a dependent (if patient_id exists in patient_dependents table)
      // Dependents don't have direct access to legal appointments - only titular
      const { data: dependentCheck } = await supabase
        .from("patient_dependents")
        .select("id")
        .eq("clinic_id", authClinicId)
        .eq("cpf", patientData.cpf)
        .eq("is_active", true)
        .limit(1);

      // If the CPF exists in dependents table and matches the patient, check if titular
      // A patient in the patients table is always a titular, dependents are in patient_dependents
      // But we need to verify the login wasn't done with a dependent's CPF
      const { data: asTitular } = await supabase
        .from("patients")
        .select("id")
        .eq("cpf", patientData.cpf)
        .eq("clinic_id", authClinicId)
        .eq("is_active", true)
        .single();

      // If patient logged in but their CPF also exists as a dependent of another patient
      // they should still be allowed as they are a titular. Only block if they're ONLY a dependent.
      if (!asTitular && dependentCheck && dependentCheck.length > 0) {
        setIsDependent(true);
        setLoading(false);
        return;
      }

      // Check monthly limit: 1 appointment per month for legal services
      const now = new Date();
      const firstDayOfMonth = format(new Date(now.getFullYear(), now.getMonth(), 1), "yyyy-MM-dd");
      const lastDayOfMonth = format(new Date(now.getFullYear(), now.getMonth() + 1, 0), "yyyy-MM-dd");

      const { data: monthlyAppts, error: monthlyError } = await (supabase
        .from("homologacao_appointments") as any)
        .select("id")
        .eq("clinic_id", authClinicId)
        .eq("employee_cpf", patientData.cpf)
        .gte("appointment_date", firstDayOfMonth)
        .lte("appointment_date", lastDayOfMonth)
        .neq("status", "cancelled");

      if (!monthlyError && monthlyAppts && monthlyAppts.length >= 1) {
        setMonthlyLimitReached(true);
        setLoading(false);
        return;
      }

      // Check if patient has valid (non-expired) card
      const { data: cardData } = await supabase
        .from("patient_cards")
        .select("id, expires_at, card_number")
        .eq("patient_id", authPatientId)
        .eq("clinic_id", authClinicId)
        .eq("is_active", true)
        .order("expires_at", { ascending: false })
        .limit(1)
        .single();

      if (cardData) {
        setCardInfo(cardData);
        
        // Check if card is expired using midday normalization to avoid timezone issues
        // (memory: timezone-safe-date-parsing-system-wide-v2)
        if (cardData.expires_at) {
          const expiryDate = parseISO(cardData.expires_at);
          expiryDate.setHours(12, 0, 0, 0);
          const todayMidDay = new Date();
          todayMidDay.setHours(12, 0, 0, 0);
          
          if (expiryDate < todayMidDay) {
            setCardExpired(true);
            
            // Check if there's already a pending payslip request
            const { data: pendingRequest } = await supabase
              .from("payslip_requests")
              .select("id, status")
              .eq("patient_id", authPatientId)
              .eq("card_id", cardData.id)
              .in("status", ["pending", "received"])
              .limit(1);
            
            if (pendingRequest && pendingRequest.length > 0) {
              setHasPendingPayslip(true);
            }
            
            setLoading(false);
            return;
          }
        }
      }

      // Load legal professionals
      const { data: professionalsData } = await supabase
        .from("homologacao_professionals")
        .select("id, name, function, avatar_url, phone, email")
        .eq("clinic_id", authClinicId)
        .eq("is_active", true)
        .order("name");

      setProfessionals((professionalsData || []) as LegalProfessional[]);

      // Load schedules
      const { data: schedulesData } = await supabase
        .from("homologacao_schedules")
        .select("*")
        .eq("clinic_id", authClinicId)
        .eq("is_active", true);

      setSchedules((schedulesData || []) as LegalSchedule[]);

      // Load service types
      const { data: serviceTypesData } = await supabase
        .from("homologacao_service_types")
        .select("id, name, duration_minutes, description")
        .eq("clinic_id", authClinicId)
        .eq("is_active", true)
        .order("order_index");

      setServiceTypes((serviceTypesData || []) as ServiceType[]);

      // Set default service type if only one exists
      if (serviceTypesData && serviceTypesData.length === 1) {
        setSelectedServiceTypeId(serviceTypesData[0].id);
      }
    } catch (err) {
      console.error("Error loading data:", err);
      toast({
        title: "Erro ao carregar dados",
        description: "Não foi possível carregar os dados. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Get schedules for a specific professional
  const getProfessionalSchedules = (professionalId: string): LegalSchedule[] => {
    return schedules.filter(s => s.professional_id === professionalId);
  };

  // Check if a date is enabled for the selected professional
  const isDateEnabled = (date: Date): boolean => {
    if (!selectedProfessionalId) return false;
    
    const profSchedules = getProfessionalSchedules(selectedProfessionalId);
    if (profSchedules.length === 0) return false;
    
    const dayOfWeek = date.getDay();
    return profSchedules.some(s => s.day_of_week === dayOfWeek && s.is_active);
  };

  // Generate available dates for the next 60 days
  const availableDates = useMemo(() => {
    if (!selectedProfessionalId) return [];
    
    const dates: Date[] = [];
    const today = startOfDay(new Date());
    
    for (let i = 0; i < 60; i++) {
      const date = addDays(today, i);
      if (isDateEnabled(date)) {
        dates.push(date);
      }
    }
    
    return dates;
  }, [selectedProfessionalId, schedules]);

  const loadAvailableSlots = async () => {
    if (!selectedProfessionalId || !selectedDate) return;

    try {
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const dayOfWeek = selectedDate.getDay();

      // Get schedule for this day
      const daySchedule = schedules.find(
        s => s.professional_id === selectedProfessionalId && s.day_of_week === dayOfWeek && s.is_active
      );

      if (!daySchedule) {
        setAvailableSlots([]);
        return;
      }

      // Get existing appointments for this day
      const { data: existingAppts } = await (supabase
        .from("homologacao_appointments") as any)
        .select("id, appointment_date, start_time, end_time, status, professional_id")
        .eq("professional_id", selectedProfessionalId)
        .eq("appointment_date", dateStr)
        .neq("status", "cancelled");

      setExistingAppointments((existingAppts || []) as LegalAppointment[]);

      // Get service duration
      const serviceType = serviceTypes.find(s => s.id === selectedServiceTypeId);
      const duration = serviceType?.duration_minutes || 30;

      // Generate slots
      const slots: TimeSlot[] = [];
      const now = new Date();
      
      const [startHour, startMin] = daySchedule.start_time.split(":").map(Number);
      const [endHour, endMin] = daySchedule.end_time.split(":").map(Number);
      
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;

      for (let currentMinutes = startMinutes; currentMinutes + duration <= endMinutes; currentMinutes += duration) {
        const hours = Math.floor(currentMinutes / 60);
        const mins = currentMinutes % 60;
        const timeStr = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
        
        // Check if slot is in the past for today
        if (isSameDay(selectedDate, now)) {
          const slotDateTime = new Date(selectedDate);
          slotDateTime.setHours(hours, mins);
          if (isBefore(slotDateTime, now)) continue;
        }
        
        // Check if slot conflicts with existing appointments
        const slotEndMinutes = currentMinutes + duration;
        const slotEndTime = `${Math.floor(slotEndMinutes / 60).toString().padStart(2, '0')}:${(slotEndMinutes % 60).toString().padStart(2, '0')}`;
        
        const isOccupied = existingAppts?.some(apt => {
          const aptStart = (apt.start_time as string).slice(0, 5);
          const aptEnd = (apt.end_time as string).slice(0, 5);
          return (timeStr < aptEnd && slotEndTime > aptStart);
        });
        
        slots.push({ time: timeStr, available: !isOccupied });
      }

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

    setSubmitting(true);

    try {
      // Get patient data
      const { data: patientData } = await supabase
        .from("patients")
        .select("name, cpf, phone, email")
        .eq("id", authPatientId)
        .single();

      if (!patientData) {
        throw new Error("Dados do paciente não encontrados");
      }

      // Get service duration
      const serviceType = serviceTypes.find(s => s.id === selectedServiceTypeId);
      const duration = serviceType?.duration_minutes || 30;

      const [hours, minutes] = selectedTime.split(":").map(Number);
      const endTime = format(addMinutes(new Date(2000, 0, 1, hours, minutes), duration), "HH:mm");

      const appointmentData = {
        clinic_id: authClinicId,
        professional_id: selectedProfessionalId,
        service_type_id: selectedServiceTypeId || null,
        appointment_date: format(selectedDate, "yyyy-MM-dd"),
        start_time: selectedTime,
        end_time: endTime,
        employee_name: patientData.name,
        employee_cpf: patientData.cpf,
        company_name: "Associado",
        company_phone: patientData.phone,
        company_email: patientData.email,
        status: "scheduled",
        notes: "Agendamento realizado via app mobile",
      };

      const { error } = await (supabase
        .from("homologacao_appointments") as any)
        .insert([appointmentData]);

      if (error) {
        throw error;
      }

      toast({
        title: "Agendamento realizado!",
        description: `Atendimento jurídico agendado para ${format(selectedDate, "dd/MM/yyyy", { locale: ptBR })} às ${selectedTime}.`,
      });

      navigate("/app/home");
    } catch (err: any) {
      console.error("Error creating appointment:", err);
      toast({
        title: "Erro ao agendar",
        description: err.message || "Não foi possível realizar o agendamento.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(n => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  const handlePayslipUpload = async () => {
    if (!payslipFile || !cardInfo) return;

    setUploadingPayslip(true);

    try {
      if (!authPatientId || !authClinicId) {
        throw new Error("Sessão inválida");
      }

      // Generate unique file path
      const fileExt = payslipFile.name.split('.').pop()?.toLowerCase() || 'pdf';
      const fileName = `${authPatientId}/${Date.now()}_contracheque.${fileExt}`;

      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from('patient-attachments')
        .upload(fileName, payslipFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        throw new Error("Erro ao fazer upload do arquivo");
      }

      // Create payslip request record
      const { error: requestError } = await supabase
        .from('payslip_requests')
        .insert({
          clinic_id: authClinicId,
          patient_id: authPatientId,
          card_id: cardInfo.id,
          status: 'received',
          received_at: new Date().toISOString(),
          attachment_path: fileName,
          notes: 'Enviado via app mobile - Agendamento Jurídico',
        });

      if (requestError) {
        console.error("Request error:", requestError);
        throw new Error("Erro ao registrar solicitação");
      }

      toast({
        title: "Contracheque enviado!",
        description: "Seu documento foi enviado para análise.",
      });

      setPayslipSubmitted(true);
    } catch (err: any) {
      console.error("Error uploading payslip:", err);
      toast({
        title: "Erro ao enviar",
        description: err.message || "Não foi possível enviar o contracheque.",
        variant: "destructive",
      });
    } finally {
      setUploadingPayslip(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (patientBlocked) {
    return (
      <div className="min-h-screen bg-background">
        <div className="bg-emerald-600 text-white px-4 py-4 flex items-center gap-4">
          <button onClick={() => navigate("/app/home")} className="p-1">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-lg font-semibold flex-1 text-center pr-8">Agendamento Jurídico</h1>
        </div>
        <div className="p-6 flex flex-col items-center justify-center min-h-[60vh]">
          <AlertTriangle className="h-16 w-16 text-amber-500 mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2 text-center">Conta Inativa</h2>
          <p className="text-muted-foreground text-center">Sua conta está inativa. Entre em contato com o sindicato.</p>
          <Button 
            className="mt-6 bg-emerald-600 hover:bg-emerald-700"
            onClick={() => navigate("/app/home")}
          >
            Voltar ao início
          </Button>
        </div>
      </div>
    );
  }

  if (isDependent) {
    return (
      <div className="min-h-screen bg-background">
        <div className="bg-emerald-600 text-white px-4 py-4 flex items-center gap-4">
          <button onClick={() => navigate("/app/home")} className="p-1">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-lg font-semibold flex-1 text-center pr-8">Agendamento Jurídico</h1>
        </div>
        <div className="p-6 flex flex-col items-center justify-center min-h-[60vh]">
          <User className="h-16 w-16 text-amber-500 mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2 text-center">Acesso Restrito</h2>
          <p className="text-muted-foreground text-center">
            O agendamento jurídico está disponível apenas para titulares.
          </p>
          <p className="text-sm text-muted-foreground text-center mt-2">
            Se você é titular, faça login com suas credenciais.
          </p>
          <Button 
            className="mt-6 bg-emerald-600 hover:bg-emerald-700"
            onClick={() => navigate("/app/home")}
          >
            Voltar ao início
          </Button>
        </div>
      </div>
    );
  }

  if (monthlyLimitReached) {
    return (
      <div className="min-h-screen bg-background">
        <div className="bg-emerald-600 text-white px-4 py-4 flex items-center gap-4">
          <button onClick={() => navigate("/app/home")} className="p-1">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-lg font-semibold flex-1 text-center pr-8">Agendamento Jurídico</h1>
        </div>
        <div className="p-6 flex flex-col items-center justify-center min-h-[60vh]">
          <Calendar className="h-16 w-16 text-amber-500 mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2 text-center">Limite Mensal Atingido</h2>
          <p className="text-muted-foreground text-center">
            Você já possui um agendamento jurídico neste mês.
          </p>
          <p className="text-sm text-muted-foreground text-center mt-2">
            O limite é de 1 atendimento por mês.
          </p>
          <Button 
            className="mt-6 bg-emerald-600 hover:bg-emerald-700"
            onClick={() => navigate("/app/agendamentos-juridicos")}
          >
            Ver meus agendamentos
          </Button>
        </div>
      </div>
    );
  }

  // Card expired - show payslip upload screen
  if (cardExpired) {
    // If payslip was just submitted successfully
    if (payslipSubmitted) {
      return (
        <div className="min-h-screen bg-background">
          <div className="bg-emerald-600 text-white px-4 py-4 flex items-center gap-4">
            <button onClick={() => navigate("/app/home")} className="p-1">
              <ArrowLeft className="h-6 w-6" />
            </button>
            <h1 className="text-lg font-semibold flex-1 text-center pr-8">Agendamento Jurídico</h1>
          </div>
          <div className="p-6 flex flex-col items-center justify-center min-h-[60vh]">
            <CheckCircle2 className="h-16 w-16 text-emerald-500 mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2 text-center">Contracheque Enviado!</h2>
            <p className="text-muted-foreground text-center">
              Seu contracheque foi enviado para análise.
            </p>
            <p className="text-sm text-muted-foreground text-center mt-2">
              Você será notificado quando sua carteira for renovada.
            </p>
            <Button 
              className="mt-6 bg-emerald-600 hover:bg-emerald-700"
              onClick={() => navigate("/app/home")}
            >
              Voltar ao início
            </Button>
          </div>
        </div>
      );
    }

    // If there's already a pending payslip request
    if (hasPendingPayslip) {
      return (
        <div className="min-h-screen bg-background">
          <div className="bg-emerald-600 text-white px-4 py-4 flex items-center gap-4">
            <button onClick={() => navigate("/app/home")} className="p-1">
              <ArrowLeft className="h-6 w-6" />
            </button>
            <h1 className="text-lg font-semibold flex-1 text-center pr-8">Agendamento Jurídico</h1>
          </div>
          <div className="p-6 flex flex-col items-center justify-center min-h-[60vh]">
            <Clock className="h-16 w-16 text-amber-500 mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2 text-center">Aguardando Análise</h2>
            <p className="text-muted-foreground text-center">
              Você já enviou seu contracheque e ele está em análise.
            </p>
            <p className="text-sm text-muted-foreground text-center mt-2">
              Aguarde a renovação da sua carteira para agendar.
            </p>
            <Button 
              className="mt-6 bg-emerald-600 hover:bg-emerald-700"
              onClick={() => navigate("/app/home")}
            >
              Voltar ao início
            </Button>
          </div>
        </div>
      );
    }

    // Show upload form for payslip
    return (
      <div className="min-h-screen bg-background">
        <div className="bg-emerald-600 text-white px-4 py-4 flex items-center gap-4">
          <button onClick={() => navigate("/app/home")} className="p-1">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-lg font-semibold flex-1 text-center pr-8">Agendamento Jurídico</h1>
        </div>
        <div className="p-6">
          <div className="flex flex-col items-center mb-6">
            <CreditCard className="h-16 w-16 text-amber-500 mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2 text-center">Carteira Vencida</h2>
            <p className="text-muted-foreground text-center">
              Sua carteira venceu em {cardInfo?.expires_at ? format(parseISO(cardInfo.expires_at), "dd/MM/yyyy", { locale: ptBR }) : "data não informada"}.
            </p>
          </div>

          <Card className="border-amber-200 bg-amber-50 mb-6">
            <CardContent className="p-4">
              <p className="text-sm text-amber-800">
                Para renovar sua carteira e acessar os serviços, envie seu contracheque mais recente para análise.
              </p>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Label htmlFor="payslip-upload" className="text-foreground font-medium">
              Enviar Contracheque
            </Label>
            
            {!payslipFile ? (
              <div 
                className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-emerald-400 transition-colors"
                onClick={() => document.getElementById('payslip-upload')?.click()}
              >
                <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground mb-1">
                  Toque para selecionar o arquivo
                </p>
                <p className="text-xs text-muted-foreground">
                  PDF, JPG ou PNG (máx. 10MB)
                </p>
                <Input
                  id="payslip-upload"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (file.size > 10 * 1024 * 1024) {
                        toast({
                          title: "Arquivo muito grande",
                          description: "O arquivo deve ter no máximo 10MB.",
                          variant: "destructive",
                        });
                        return;
                      }
                      setPayslipFile(file);
                    }
                  }}
                />
              </div>
            ) : (
              <Card className="border-emerald-200 bg-emerald-50">
                <CardContent className="p-4 flex items-center gap-3">
                  <FileText className="h-10 w-10 text-emerald-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{payslipFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(payslipFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="flex-shrink-0"
                    onClick={() => setPayslipFile(null)}
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </CardContent>
              </Card>
            )}

            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700"
              disabled={!payslipFile || uploadingPayslip}
              onClick={handlePayslipUpload}
            >
              {uploadingPayslip ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Enviar Contracheque
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (professionals.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <div className="bg-emerald-600 text-white px-4 py-4 flex items-center gap-4">
          <button onClick={() => navigate("/app/home")} className="p-1">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-lg font-semibold flex-1 text-center pr-8">Agendamento Jurídico</h1>
        </div>
        <div className="p-6 flex flex-col items-center justify-center min-h-[60vh]">
          <Scale className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2 text-center">Serviço Indisponível</h2>
          <p className="text-muted-foreground text-center">O serviço de agendamento jurídico ainda não está disponível.</p>
          <Button 
            className="mt-6 bg-emerald-600 hover:bg-emerald-700"
            onClick={() => navigate("/app/home")}
          >
            Voltar ao início
          </Button>
        </div>
      </div>
    );
  }

  const selectedProfessional = professionals.find(p => p.id === selectedProfessionalId);
  const selectedService = serviceTypes.find(s => s.id === selectedServiceTypeId);
  const availableTimeSlots = availableSlots.filter(s => s.available);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-emerald-600 text-white px-4 py-4 flex items-center gap-4">
        <button onClick={() => step > 1 ? setStep(step - 1) : navigate("/app/home")} className="p-1">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <div className="flex-1 text-center pr-8">
          <h1 className="text-lg font-semibold">Agendamento Jurídico</h1>
        </div>
      </div>

      {/* Progress */}
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
          {/* Step 1: Professional Selection */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-1">Escolha o profissional</h2>
                <p className="text-sm text-muted-foreground">Selecione o advogado para seu atendimento</p>
              </div>
              
              <div className="space-y-3">
                {professionals.map((prof) => (
                  <Card 
                    key={prof.id}
                    className={`cursor-pointer transition-all ${
                      selectedProfessionalId === prof.id 
                        ? "border-emerald-600 bg-emerald-50 ring-2 ring-emerald-600" 
                        : "hover:border-emerald-300"
                    }`}
                    onClick={() => {
                      setSelectedProfessionalId(prof.id);
                      setSelectedDate(undefined);
                      setSelectedTime("");
                      setAvailableSlots([]);
                    }}
                  >
                    <CardContent className="p-4 flex items-center gap-4">
                      <Avatar className="h-14 w-14 border-2 border-border">
                        <AvatarImage src={prof.avatar_url || undefined} alt={prof.name} />
                        <AvatarFallback className="bg-emerald-100 text-emerald-700 font-semibold">
                          {getInitials(prof.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground truncate">{prof.name}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {prof.function || "Advogado(a)"}
                        </p>
                      </div>
                      {selectedProfessionalId === prof.id && (
                        <CheckCircle2 className="h-6 w-6 text-emerald-600 flex-shrink-0" />
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Button 
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                disabled={!selectedProfessionalId}
                onClick={() => setStep(2)}
              >
                Continuar
              </Button>
            </div>
          )}

          {/* Step 2: Service Type Selection (if multiple) */}
          {step === 2 && (
            <div className="space-y-6">
              {serviceTypes.length > 1 ? (
                <>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground mb-1">Tipo de atendimento</h2>
                    <p className="text-sm text-muted-foreground">Selecione o serviço desejado</p>
                  </div>
                  
                  <div className="space-y-3">
                    {serviceTypes.map((service) => (
                      <Card 
                        key={service.id}
                        className={`cursor-pointer transition-all ${
                          selectedServiceTypeId === service.id 
                            ? "border-emerald-600 bg-emerald-50 ring-2 ring-emerald-600" 
                            : "hover:border-emerald-300"
                        }`}
                        onClick={() => setSelectedServiceTypeId(service.id)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <p className="font-semibold text-foreground">{service.name}</p>
                              {service.description && (
                                <p className="text-sm text-muted-foreground mt-1">{service.description}</p>
                              )}
                              <Badge variant="secondary" className="mt-2">
                                <Clock className="h-3 w-3 mr-1" />
                                {service.duration_minutes} min
                              </Badge>
                            </div>
                            {selectedServiceTypeId === service.id && (
                              <CheckCircle2 className="h-6 w-6 text-emerald-600 flex-shrink-0" />
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-4">
                  <p className="text-muted-foreground">Carregando opções...</p>
                </div>
              )}

              <Button 
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                disabled={serviceTypes.length > 1 && !selectedServiceTypeId}
                onClick={() => {
                  if (serviceTypes.length === 1) {
                    setSelectedServiceTypeId(serviceTypes[0].id);
                  }
                  setStep(3);
                }}
              >
                Continuar
              </Button>
            </div>
          )}

          {/* Step 3: Date and Time Selection */}
          {step === 3 && (
            <div className="space-y-6">
              {/* Professional Summary */}
              {selectedProfessional && (
                <Card className="bg-emerald-50 border-emerald-200">
                  <CardContent className="p-3 flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={selectedProfessional.avatar_url || undefined} />
                      <AvatarFallback className="bg-emerald-600 text-white">
                        {getInitials(selectedProfessional.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{selectedProfessional.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {selectedProfessional.function || "Advogado(a)"}
                        {selectedService && ` • ${selectedService.name}`}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Date Selection */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <CalendarDays className="h-5 w-5 text-emerald-600" />
                  <h2 className="text-lg font-semibold text-foreground">Escolha a data</h2>
                </div>
                
                {availableDates.length > 0 ? (
                  <ScrollArea className="w-full">
                    <div className="flex gap-2 pb-2">
                      {availableDates.map((date) => {
                        const isSelected = selectedDate && format(selectedDate, "yyyy-MM-dd") === format(date, "yyyy-MM-dd");
                        return (
                          <Card
                            key={format(date, "yyyy-MM-dd")}
                            className={`cursor-pointer flex-shrink-0 min-w-[80px] transition-all ${
                              isSelected 
                                ? "border-emerald-600 bg-emerald-50 ring-2 ring-emerald-600" 
                                : "hover:border-emerald-300"
                            }`}
                            onClick={() => {
                              setSelectedDate(date);
                              setSelectedTime("");
                            }}
                          >
                            <CardContent className="p-3 text-center">
                              <p className={`text-xs font-medium uppercase ${isSelected ? "text-emerald-600" : "text-muted-foreground"}`}>
                                {format(date, "EEE", { locale: ptBR })}
                              </p>
                              <p className={`text-xl font-bold ${isSelected ? "text-emerald-700" : "text-foreground"}`}>
                                {format(date, "dd")}
                              </p>
                              <p className={`text-xs ${isSelected ? "text-emerald-600" : "text-muted-foreground"}`}>
                                {format(date, "MMM", { locale: ptBR })}
                              </p>
                              {isSelected && (
                                <Check className="h-4 w-4 text-emerald-600 mx-auto mt-1" />
                              )}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="text-center py-6 bg-muted/50 rounded-lg">
                    <CalendarDays className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground text-sm">Nenhuma data disponível para este profissional.</p>
                  </div>
                )}
              </div>

              {/* Time Selection */}
              {selectedDate && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="h-5 w-5 text-emerald-600" />
                    <h2 className="text-lg font-semibold text-foreground">Escolha o horário</h2>
                  </div>
                  
                  <p className="text-sm text-muted-foreground mb-3">
                    {format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                  </p>

                  {availableTimeSlots.length > 0 ? (
                    <div className="grid grid-cols-4 gap-2">
                      {availableTimeSlots.map((slot) => {
                        const isSelected = selectedTime === slot.time;
                        return (
                          <Card
                            key={slot.time}
                            className={`cursor-pointer transition-all ${
                              isSelected 
                                ? "border-emerald-600 bg-emerald-600 text-white" 
                                : "hover:border-emerald-300"
                            }`}
                            onClick={() => setSelectedTime(slot.time)}
                          >
                            <CardContent className="p-3 text-center">
                              <p className={`text-sm font-semibold ${isSelected ? "text-white" : "text-foreground"}`}>
                                {slot.time}
                              </p>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-6 bg-muted/50 rounded-lg">
                      <Clock className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                      <p className="text-muted-foreground text-sm">Nenhum horário disponível para esta data.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Submit Button */}
              <Button 
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                disabled={!selectedDate || !selectedTime || submitting}
                onClick={handleSubmit}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Agendando...
                  </>
                ) : (
                  "Confirmar Agendamento"
                )}
              </Button>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
