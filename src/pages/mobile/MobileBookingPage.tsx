import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
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

interface Professional {
  id: string;
  name: string;
  specialty: string | null;
  appointment_duration: number;
  schedule: ProfessionalSchedule | null;
  avatar_url: string | null;
}

interface Dependent {
  id: string;
  name: string;
  birth_date: string | null;
}

// Age limit for dependents (in years)
const DEPENDENT_MAX_AGE = 21;

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
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);
  const [cardExpired, setCardExpired] = useState(false);
  const [cardExpiryDate, setCardExpiryDate] = useState<string | null>(null);
  const [noActiveCard, setNoActiveCard] = useState(false);
  const [bookingMonthsAhead, setBookingMonthsAhead] = useState(1);
  
  // useRef para clinicId - evita race condition e garante valor consistente no submit
  const clinicIdRef = useRef<string | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // IMPORTANTE: Apenas patientId vem do auth. clinicId é resolvido via RPC.
  const { patientId, initialized } = useMobileAuth();

  useEffect(() => {
    if (initialized && patientId) {
      loadProfessionals();
    }
  }, [initialized, patientId]);

  useEffect(() => {
    if (selectedProfessionalId && selectedDate) {
      loadAvailableSlots();
    }
  }, [selectedProfessionalId, selectedDate]);

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

      // Setar profissionais
      setProfessionals(data.professionals || []);

      // Setar dependentes
      setDependents(data.dependents || []);

      // Setar configuração de meses
      if (data.bookingMonthsAhead) {
        setBookingMonthsAhead(data.bookingMonthsAhead);
      }

      // Setar mensagem de bloqueio (se houver)
      if (data.blockedMessage) {
        setBlockedMessage(data.blockedMessage);
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
    
    // Check if this date is within any active block and the day is enabled
    return blocks.some(block => {
      // Check if day of week matches
      if (!block.days.includes(dayName)) return false;
      
      // Check date range if specified
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

      // Get existing appointments for this day
      const { data: existingAppointments } = await supabase
        .from("appointments")
        .select("start_time, end_time, status")
        .eq("professional_id", selectedProfessionalId)
        .eq("appointment_date", dateStr)
        .not("status", "in", '("cancelled","no_show")');

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
          
          // Check if slot is in the past for today
          if (isSameDay(selectedDate, now)) {
            const slotDateTime = new Date(selectedDate);
            slotDateTime.setHours(hours, mins);
            if (isBefore(slotDateTime, now)) continue;
          }
          
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

    setSubmitting(true);

    try {
      const professional = professionals.find(p => p.id === selectedProfessionalId);
      
      // Get the duration from the applicable block for this date
      const applicableBlocks = getBlocksForDate(selectedDate, professional?.schedule || null);
      const blockDuration = applicableBlocks[0]?.duration || professional?.appointment_duration || 30;

      const [hours, minutes] = selectedTime.split(":").map(Number);
      const endTime = format(addMinutes(new Date(2000, 0, 1, hours, minutes), blockDuration), "HH:mm");

      const appointmentData = {
        clinic_id: clinicIdRef.current,
        patient_id: patientId,
        professional_id: selectedProfessionalId,
        dependent_id: patientType === "dependent" && selectedDependentId ? selectedDependentId : null,
        appointment_date: format(selectedDate, "yyyy-MM-dd"),
        start_time: selectedTime,
        end_time: endTime,
        status: "scheduled" as const,
        type: "first_visit" as const,
        duration_minutes: blockDuration,
      };

      const { error } = await supabase
        .from("appointments")
        .insert([appointmentData]);

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
        <h1 className="text-lg font-semibold flex-1 text-center pr-8">Agendar Consulta</h1>
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
                      {dependents.map((dep) => {
                        const age = dep.birth_date ? calculateAge(dep.birth_date) : null;
                        const isOverAge = age !== null && age > DEPENDENT_MAX_AGE;
                        
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
                  
                  {/* Show warning if selected dependent is over age limit */}
                  {selectedDependentId && (() => {
                    const selectedDep = dependents.find(d => d.id === selectedDependentId);
                    if (selectedDep?.birth_date) {
                      const age = calculateAge(selectedDep.birth_date);
                      if (age > DEPENDENT_MAX_AGE) {
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
                      if (age > DEPENDENT_MAX_AGE) {
                        toast({
                          title: "Limite de idade excedido",
                          description: `Dependentes acima de ${DEPENDENT_MAX_AGE} anos não podem agendar consultas.`,
                          variant: "destructive",
                        });
                        return;
                      }
                    }
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
                    onClick={() => {
                      setSelectedProfessionalId(prof.id);
                      // Reset date and time when changing professional
                      setSelectedDate(undefined);
                      setSelectedTime("");
                      setAvailableSlots([]);
                    }}
                  >
                    <CardContent className="p-4 flex items-center gap-4">
                      {prof.avatar_url ? (
                        <img 
                          src={prof.avatar_url} 
                          alt={prof.name}
                          className="w-12 h-12 rounded-full object-cover border border-border"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                          <User className="h-6 w-6 text-emerald-600" />
                        </div>
                      )}
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
              professionals={professionals}
              selectedProfessionalId={selectedProfessionalId}
              isDateEnabled={isDateEnabled}
              submitting={submitting}
              onSubmit={handleSubmit}
              bookingMonthsAhead={bookingMonthsAhead}
            />
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
