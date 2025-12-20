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
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Logo } from "@/components/layout/Logo";

const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const monthNames = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const timeSlots = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
  "11:00", "11:30", "12:00", "12:30", "13:00", "13:30",
  "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
  "17:00", "17:30", "18:00"
];

const appointmentTypes = [
  { value: "first_visit", label: "Primeira Consulta" },
  { value: "return", label: "Retorno" },
  { value: "exam", label: "Exame" },
  { value: "procedure", label: "Procedimento" },
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
}

interface Professional {
  id: string;
  name: string;
  specialty: string | null;
  appointment_duration: number | null;
  schedule: Record<string, { enabled: boolean; slots: { start: string; end: string }[] }> | null;
  avatar_url: string | null;
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

export default function PublicBooking() {
  const { clinicSlug } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [insurancePlans, setInsurancePlans] = useState<InsurancePlan[]>([]);
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [existingAppointments, setExistingAppointments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  
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
      // Fetch clinic by slug (public access)
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

      // Fetch professionals with schedules
      const { data: professionalsData } = await supabase
        .from('professionals')
        .select('id, name, specialty, appointment_duration, schedule, avatar_url')
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
    } catch (error) {
      console.error('Error fetching clinic data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchExistingAppointments = async () => {
    if (!clinic || !selectedProfessional || !selectedDate) return;

    const dateStr = selectedDate.toISOString().split('T')[0];
    
    const { data } = await supabase
      .from('appointments')
      .select('start_time')
      .eq('clinic_id', clinic.id)
      .eq('professional_id', selectedProfessional)
      .eq('appointment_date', dateStr)
      .in('status', ['scheduled', 'confirmed']);

    setExistingAppointments(data?.map(a => a.start_time.substring(0, 5)) || []);
  };

  // Get appointment duration (from procedure or professional)
  const appointmentDuration = useMemo(() => {
    if (selectedProcedure) {
      const procedure = procedures.find(p => p.id === selectedProcedure);
      if (procedure?.duration_minutes) return procedure.duration_minutes;
    }
    const professional = professionals.find(p => p.id === selectedProfessional);
    return professional?.appointment_duration || 30;
  }, [selectedProcedure, selectedProfessional, procedures, professionals]);

  // Get available time slots based on professional schedule and existing appointments
  const availableTimeSlots = useMemo(() => {
    if (!selectedDate || !selectedProfessional) return [];
    
    const professional = professionals.find(p => p.id === selectedProfessional);
    if (!professional) return [];
    
    // Get day of week
    const dayIndex = selectedDate.getDay();
    const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayKey = dayKeys[dayIndex];
    
    // Check if professional has schedule configured
    const schedule = professional.schedule;
    if (!schedule || !schedule[dayKey] || !schedule[dayKey].enabled) {
      return [];
    }
    
    // Generate time slots from professional's schedule
    const daySchedule = schedule[dayKey];
    const duration = appointmentDuration;
    const slots: string[] = [];
    
    daySchedule.slots.forEach(slot => {
      const [startHour, startMin] = slot.start.split(':').map(Number);
      const [endHour, endMin] = slot.end.split(':').map(Number);
      
      let current = startHour * 60 + startMin;
      const end = endHour * 60 + endMin;
      
      while (current + duration <= end) {
        const hour = Math.floor(current / 60);
        const min = current % 60;
        slots.push(`${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`);
        current += duration;
      }
    });
    
    // Filter out existing appointments
    return slots.filter(slot => !existingAppointments.includes(slot));
  }, [selectedDate, selectedProfessional, professionals, existingAppointments, appointmentDuration]);

  // Check if day has availability based on professional schedule
  const isDayAvailable = (date: Date) => {
    if (!selectedProfessional) return true; // If no professional selected, show all days
    
    const professional = professionals.find(p => p.id === selectedProfessional);
    if (!professional?.schedule) return true; // No schedule = use default
    
    const dayIndex = date.getDay();
    const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayKey = dayKeys[dayIndex];
    
    return professional.schedule[dayKey]?.enabled || false;
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

  const isDateDisabled = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date < today) return true;
    if (!isDayAvailable(date)) return true;
    return false;
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };

  const handleSubmit = async () => {
    if (!clinic || !selectedDate || !selectedProfessional || !selectedTime || !patientName || !patientPhone) {
      toast({
        title: "Preencha todos os campos",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const dateStr = selectedDate.toISOString().split('T')[0];
      
      // Calculate end time using procedure duration or professional duration
      const [hours, minutes] = selectedTime.split(':').map(Number);
      const endDate = new Date();
      endDate.setHours(hours, minutes + appointmentDuration, 0, 0);
      const endTime = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;

      // Create or find patient
      const phoneClean = patientPhone.replace(/\D/g, '');
      
      let { data: existingPatient } = await supabase
        .from('patients')
        .select('id')
        .eq('clinic_id', clinic.id)
        .eq('phone', phoneClean)
        .single();

      let patientId: string;

      if (existingPatient) {
        patientId = existingPatient.id;
      } else {
        const { data: newPatient, error: patientError } = await supabase
          .from('patients')
          .insert({
            clinic_id: clinic.id,
            name: patientName.trim(),
            phone: phoneClean,
            email: patientEmail || null,
            insurance_plan_id: selectedInsurance || null,
          })
          .select('id')
          .single();

        if (patientError) throw patientError;
        patientId = newPatient.id;
      }

      // Create appointment with procedure_id if selected
      const { error: appointmentError } = await supabase
        .from('appointments')
        .insert([{
          clinic_id: clinic.id,
          patient_id: patientId,
          professional_id: selectedProfessional,
          procedure_id: selectedProcedure || null,
          appointment_date: dateStr,
          start_time: selectedTime,
          end_time: endTime,
          duration_minutes: appointmentDuration,
          type: selectedType as "first_visit" | "return" | "exam" | "procedure",
          status: 'scheduled' as const,
        }]);

      if (appointmentError) throw appointmentError;

      setSuccess(true);
      toast({
        title: "Agendamento realizado!",
        description: "Você receberá uma confirmação em breve.",
      });
    } catch (error: any) {
      console.error('Error creating appointment:', error);
      
      // Check for schedule validation errors
      const errorMessage = error?.message || "";
      let title = "Erro ao agendar";
      let description = error.message || "Tente novamente";
      
      if (errorMessage.includes("HORARIO_INVALIDO")) {
        title = "Horário indisponível";
        const match = errorMessage.match(/HORARIO_INVALIDO:\s*(.+)/);
        description = match ? match[1].trim() : "O profissional não atende neste horário.";
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!clinic) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
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
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">Agendamento Confirmado!</h2>
            <p className="text-muted-foreground mb-4">
              Sua consulta foi agendada para {selectedDate?.toLocaleDateString('pt-BR')} às {selectedTime}
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              Você receberá um lembrete via WhatsApp antes da consulta.
            </p>
            <Button onClick={() => window.location.reload()}>
              Agendar nova consulta
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            {clinic.logo_url ? (
              <img src={clinic.logo_url} alt={clinic.name} className="h-12 w-auto" />
            ) : (
              <Logo />
            )}
            <div>
              <h1 className="text-xl font-semibold text-foreground">{clinic.name}</h1>
              <p className="text-sm text-muted-foreground">Agendamento Online</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Progress */}
          <div className="flex items-center justify-center mb-8 gap-2">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                  step >= s ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                )}>
                  {s}
                </div>
                {s < 3 && (
                  <div className={cn(
                    "w-12 h-1 mx-1 rounded",
                    step > s ? "bg-primary" : "bg-secondary"
                  )} />
                )}
              </div>
            ))}
          </div>

          {/* Step 1: Select Professional and Date */}
          {step === 1 && (
            <div className="grid lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Selecione o Profissional
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {professionals.map((prof) => (
                    <div
                      key={prof.id}
                      onClick={() => setSelectedProfessional(prof.id)}
                      className={cn(
                        "p-4 rounded-lg border cursor-pointer transition-colors",
                        selectedProfessional === prof.id 
                          ? "border-primary bg-primary/5" 
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        {prof.avatar_url ? (
                          <img 
                            src={prof.avatar_url} 
                            alt={prof.name}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-6 w-6 text-primary/60" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-foreground">{prof.name}</p>
                          {prof.specialty && (
                            <p className="text-sm text-muted-foreground">{prof.specialty}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Selecione a Data
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between mb-4">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <h3 className="font-medium text-foreground">
                      {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                    </h3>
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
                      <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                        {day}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-1">
                    {getDaysInMonth(currentMonth).map((day, index) => (
                      <div key={index} className="aspect-square">
                        {day && (
                          <button
                            disabled={isDateDisabled(day)}
                            onClick={() => setSelectedDate(day)}
                            className={cn(
                              "w-full h-full rounded-lg text-sm transition-colors",
                              isDateDisabled(day)
                                ? "text-muted-foreground/50 cursor-not-allowed"
                                : selectedDate?.toDateString() === day.toDateString()
                                ? "bg-primary text-primary-foreground"
                                : "hover:bg-secondary text-foreground"
                            )}
                          >
                            {day.getDate()}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div className="lg:col-span-2 flex justify-end">
                <Button 
                  onClick={() => setStep(2)} 
                  disabled={!selectedProfessional || !selectedDate}
                >
                  Continuar
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Select Procedure and Time */}
          {step === 2 && (
            <div className="space-y-6">
              {/* Procedure Selection */}
              {procedures.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Stethoscope className="h-5 w-5" />
                      Selecione o Procedimento
                    </CardTitle>
                    <CardDescription>
                      Escolha o tipo de atendimento desejado
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {procedures.map((proc) => (
                        <div
                          key={proc.id}
                          onClick={() => {
                            setSelectedProcedure(proc.id);
                            setSelectedTime(""); // Reset time when procedure changes
                          }}
                          className={cn(
                            "p-4 rounded-lg border cursor-pointer transition-colors",
                            selectedProcedure === proc.id 
                              ? "border-primary bg-primary/5" 
                              : "border-border hover:border-primary/50"
                          )}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                {proc.color && (
                                  <div 
                                    className="w-3 h-3 rounded-full" 
                                    style={{ backgroundColor: proc.color }}
                                  />
                                )}
                                <p className="font-medium text-foreground">{proc.name}</p>
                              </div>
                              {proc.description && (
                                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                  {proc.description}
                                </p>
                              )}
                              <div className="flex items-center gap-3 mt-2 text-sm">
                                {proc.duration_minutes && (
                                  <span className="text-muted-foreground flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {proc.duration_minutes} min
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-foreground">
                                {proc.price > 0 
                                  ? `R$ ${proc.price.toFixed(2).replace('.', ',')}`
                                  : 'Grátis'
                                }
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Time Selection */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Selecione o Horário
                  </CardTitle>
                  <CardDescription>
                    {selectedDate?.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                    {selectedProcedure && procedures.find(p => p.id === selectedProcedure)?.duration_minutes && (
                      <span className="ml-2">
                        • Duração: {procedures.find(p => p.id === selectedProcedure)?.duration_minutes} min
                      </span>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {timeSlots.map((slot) => {
                      const isAvailable = availableTimeSlots.includes(slot);
                      return (
                        <Button
                          key={slot}
                          variant={selectedTime === slot ? "default" : "outline"}
                          size="sm"
                          disabled={!isAvailable}
                          onClick={() => setSelectedTime(slot)}
                          className={cn(!isAvailable && "opacity-50")}
                        >
                          {slot}
                        </Button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Appointment Type (shown only if no procedures) */}
              {procedures.length === 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Tipo de Consulta</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-3">
                      {appointmentTypes.map((type) => (
                        <div
                          key={type.value}
                          onClick={() => setSelectedType(type.value)}
                          className={cn(
                            "p-4 rounded-lg border cursor-pointer transition-colors text-center",
                            selectedType === type.value 
                              ? "border-primary bg-primary/5" 
                              : "border-border hover:border-primary/50"
                          )}
                        >
                          <p className="font-medium text-foreground">{type.label}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(1)}>
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Voltar
                </Button>
                <Button 
                  onClick={() => setStep(3)} 
                  disabled={!selectedTime || (procedures.length > 0 && !selectedProcedure)}
                >
                  Continuar
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Patient Info */}
          {step === 3 && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Seus Dados</CardTitle>
                  <CardDescription>Preencha suas informações para confirmar o agendamento</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nome completo *</Label>
                      <Input
                        id="name"
                        value={patientName}
                        onChange={(e) => setPatientName(e.target.value)}
                        placeholder="Seu nome"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Telefone (WhatsApp) *</Label>
                      <Input
                        id="phone"
                        value={patientPhone}
                        onChange={(e) => setPatientPhone(formatPhone(e.target.value))}
                        placeholder="(00) 00000-0000"
                        maxLength={15}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">E-mail</Label>
                      <Input
                        id="email"
                        type="email"
                        value={patientEmail}
                        onChange={(e) => setPatientEmail(e.target.value)}
                        placeholder="seu@email.com"
                      />
                    </div>
                    {insurancePlans.length > 0 && (
                      <div className="space-y-2">
                        <Label>Convênio</Label>
                        <Select value={selectedInsurance} onValueChange={setSelectedInsurance}>
                          <SelectTrigger>
                            <SelectValue placeholder="Particular" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Particular</SelectItem>
                            {insurancePlans.map((plan) => (
                              <SelectItem key={plan.id} value={plan.id}>
                                {plan.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>Resumo do Agendamento</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Profissional:</span>
                      <span className="font-medium text-foreground">
                        {professionals.find(p => p.id === selectedProfessional)?.name}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Data:</span>
                      <span className="font-medium text-foreground">
                        {selectedDate?.toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Horário:</span>
                      <span className="font-medium text-foreground">{selectedTime}</span>
                    </div>
                    {selectedProcedure ? (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Procedimento:</span>
                          <span className="font-medium text-foreground">
                            {procedures.find(p => p.id === selectedProcedure)?.name}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Duração:</span>
                          <span className="font-medium text-foreground">
                            {procedures.find(p => p.id === selectedProcedure)?.duration_minutes || appointmentDuration} min
                          </span>
                        </div>
                        <div className="flex justify-between border-t border-border pt-2 mt-2">
                          <span className="text-muted-foreground font-medium">Valor:</span>
                          <span className="font-semibold text-foreground">
                            {(() => {
                              const price = procedures.find(p => p.id === selectedProcedure)?.price || 0;
                              return price > 0 
                                ? `R$ ${price.toFixed(2).replace('.', ',')}` 
                                : 'Grátis';
                            })()}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Tipo:</span>
                        <span className="font-medium text-foreground">
                          {appointmentTypes.find(t => t.value === selectedType)?.label}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(2)}>
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Voltar
                </Button>
                <Button 
                  onClick={handleSubmit} 
                  disabled={submitting || !patientName || !patientPhone}
                >
                  {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Confirmar Agendamento
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6 mt-12">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm text-muted-foreground">
            Powered by Eclini • Tecmax Tecnologia
          </p>
        </div>
      </footer>
    </div>
  );
}
