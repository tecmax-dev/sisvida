import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar } from "@/components/ui/calendar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  ArrowLeft, 
  Loader2, 
  Calendar as CalendarIcon,
  Clock,
  User,
  AlertTriangle,
  Check,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, parseISO, addMinutes, isBefore, startOfDay, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Professional {
  id: string;
  name: string;
  specialty: string | null;
  appointment_duration: number;
}

interface Dependent {
  id: string;
  name: string;
}

interface TimeSlot {
  time: string;
  available: boolean;
}

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
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedProfessionalId && selectedDate) {
      loadAvailableSlots();
    }
  }, [selectedProfessionalId, selectedDate]);

  const loadInitialData = async () => {
    try {
      const patientId = sessionStorage.getItem('mobile_patient_id');
      const clinicId = sessionStorage.getItem('mobile_clinic_id');

      if (!patientId || !clinicId) {
        navigate("/app/login");
        return;
      }

      // Check if patient is blocked
      const { data: patientData, error: patientError } = await supabase
        .from("patients")
        .select("no_show_blocked_until, is_active")
        .eq("id", patientId)
        .single();

      if (patientData?.no_show_blocked_until) {
        const blockedUntil = parseISO(patientData.no_show_blocked_until);
        if (isBefore(new Date(), blockedUntil)) {
          setBlockedMessage(`Você está bloqueado para agendamentos até ${format(blockedUntil, "dd/MM/yyyy", { locale: ptBR })}`);
        }
      }

      if (!patientData?.is_active) {
        setBlockedMessage("Sua conta está inativa. Entre em contato com o sindicato.");
      }

      // Load professionals
      const { data: professionalsData } = await supabase
        .from("professionals")
        .select("id, name, specialty, appointment_duration")
        .eq("clinic_id", clinicId)
        .eq("is_active", true)
        .order("name");

      setProfessionals(professionalsData || []);

      // Load dependents
      const { data: dependentsData } = await supabase
        .from("patient_dependents")
        .select("id, name")
        .eq("patient_id", patientId)
        .eq("is_active", true)
        .order("name");

      setDependents(dependentsData || []);
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableSlots = async () => {
    if (!selectedProfessionalId || !selectedDate) return;

    try {
      const clinicId = sessionStorage.getItem('mobile_clinic_id');
      const professional = professionals.find(p => p.id === selectedProfessionalId);
      const duration = professional?.appointment_duration || 30;
      const dateStr = format(selectedDate, "yyyy-MM-dd");

      // Get existing appointments for this day
      const { data: existingAppointments } = await supabase
        .from("appointments")
        .select("start_time, end_time, status")
        .eq("professional_id", selectedProfessionalId)
        .eq("appointment_date", dateStr)
        .not("status", "in", '("cancelled","no_show")');

      // Generate time slots from 08:00 to 18:00
      const slots: TimeSlot[] = [];
      const now = new Date();

      // Simple slot generation
      for (let hour = 8; hour < 18; hour++) {
        for (let min = 0; min < 60; min += duration) {
          const timeStr = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;

          // Check if slot is in the past for today
          if (isSameDay(selectedDate, now)) {
            const slotDateTime = new Date(selectedDate);
            const [h, m] = timeStr.split(":").map(Number);
            slotDateTime.setHours(h, m);
            if (isBefore(slotDateTime, now)) continue;
          }

          // Check if slot conflicts with existing appointments
          const isOccupied = existingAppointments?.some(apt => {
            const aptStart = (apt.start_time as string).slice(0, 5);
            const aptEnd = (apt.end_time as string).slice(0, 5);
            return timeStr >= aptStart && timeStr < aptEnd;
          });

          slots.push({ time: timeStr, available: !isOccupied });
        }
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
      const patientId = sessionStorage.getItem('mobile_patient_id');
      const clinicId = sessionStorage.getItem('mobile_clinic_id');
      const professional = professionals.find(p => p.id === selectedProfessionalId);
      const duration = professional?.appointment_duration || 30;

      const [hours, minutes] = selectedTime.split(":").map(Number);
      const endTime = format(addMinutes(new Date(2000, 0, 1, hours, minutes), duration), "HH:mm");

      const appointmentData = {
        clinic_id: clinicId,
        patient_id: patientId,
        professional_id: selectedProfessionalId,
        dependent_id: patientType === "dependent" && selectedDependentId ? selectedDependentId : null,
        appointment_date: format(selectedDate, "yyyy-MM-dd"),
        start_time: selectedTime,
        end_time: endTime,
        status: "scheduled" as const,
        type: "primeira_consulta" as const,
        duration_minutes: duration,
      };

      const { error } = await supabase
        .from("appointments")
        .insert(appointmentData);

      if (error) {
        throw error;
      }

      toast({
        title: "Agendamento realizado!",
        description: `Consulta agendada para ${format(selectedDate, "dd/MM/yyyy", { locale: ptBR })} às ${selectedTime}.`,
      });

      navigate("/app/agendamentos");
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
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
        <h1 className="text-lg font-semibold flex-1 text-center pr-8">Agendar Consulta</h1>
      </div>

      {/* Progress */}
      <div className="px-4 py-3 flex items-center gap-2">
        {[1, 2, 3, 4].map((s) => (
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
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-foreground">Para quem é a consulta?</h2>
              
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
                      {dependents.map((dep) => (
                        <SelectItem key={dep.id} value={dep.id}>
                          {dep.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                  setStep(2);
                }}
              >
                Continuar
              </Button>
            </div>
          )}

          {/* Step 2: Professional */}
          {step === 2 && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-foreground">Escolha o profissional</h2>
              
              <div className="space-y-3">
                {professionals.map((prof) => (
                  <Card 
                    key={prof.id}
                    className={`cursor-pointer transition-colors ${selectedProfessionalId === prof.id ? "border-emerald-600 bg-emerald-50" : ""}`}
                    onClick={() => setSelectedProfessionalId(prof.id)}
                  >
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                        <User className="h-6 w-6 text-emerald-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-foreground">{prof.name}</p>
                        {prof.specialty && (
                          <p className="text-sm text-muted-foreground">{prof.specialty}</p>
                        )}
                      </div>
                      {selectedProfessionalId === prof.id && (
                        <Check className="h-5 w-5 text-emerald-600" />
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Button 
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                disabled={!selectedProfessionalId}
                onClick={() => setStep(3)}
              >
                Continuar
              </Button>
            </div>
          )}

          {/* Step 3: Date */}
          {step === 3 && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-foreground">Escolha a data</h2>
              
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                locale={ptBR}
                disabled={(date) => isBefore(startOfDay(date), startOfDay(new Date()))}
                className="rounded-md border mx-auto"
              />

              <Button 
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                disabled={!selectedDate}
                onClick={() => setStep(4)}
              >
                Continuar
              </Button>
            </div>
          )}

          {/* Step 4: Time */}
          {step === 4 && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-foreground">Escolha o horário</h2>
              
              <p className="text-sm text-muted-foreground">
                {selectedDate && format(selectedDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </p>

              {availableSlots.filter(s => s.available).length > 0 ? (
                <div className="grid grid-cols-4 gap-2">
                  {availableSlots.filter(s => s.available).map((slot) => (
                    <Button
                      key={slot.time}
                      variant={selectedTime === slot.time ? "default" : "outline"}
                      className={selectedTime === slot.time ? "bg-emerald-600 hover:bg-emerald-700" : ""}
                      onClick={() => setSelectedTime(slot.time)}
                    >
                      {slot.time}
                    </Button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">Nenhum horário disponível para esta data.</p>
                </div>
              )}

              <Button 
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                disabled={!selectedTime || submitting}
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
