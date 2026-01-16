import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, addDays, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { 
  Calendar, 
  Clock, 
  User, 
  Building2, 
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Employer {
  id: string;
  name: string;
  cnpj: string;
  trade_name?: string;
  phone?: string | null;
  email?: string | null;
}

interface Professional {
  id: string;
  name: string;
  slug: string;
  function?: string | null;
  avatar_url?: string | null;
  clinic_id: string;
}

interface Schedule {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  capacity: number;
}

interface Block {
  block_date: string;
  professional_id: string | null;
}

interface ServiceType {
  id: string;
  name: string;
  duration_minutes: number;
}

interface TimeSlot {
  time: string;
  available: boolean;
  capacity: number;
  booked: number;
}

interface PortalHomologacaoBookingProps {
  employer: Employer;
  clinicId: string;
  onBack: () => void;
  onSuccess?: () => void;
}

export function PortalHomologacaoBooking({ 
  employer, 
  clinicId, 
  onBack,
  onSuccess 
}: PortalHomologacaoBookingProps) {
  const [selectedProfessional, setSelectedProfessional] = useState<Professional | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [step, setStep] = useState<'professional' | 'datetime' | 'employee' | 'confirmation'>('professional');
  
  const [employeeData, setEmployeeData] = useState({
    employee_name: '',
    employee_cpf: '',
  });

  // Fetch professionals
  const { data: professionals, isLoading: loadingProfessionals } = useQuery({
    queryKey: ["portal-homologacao-professionals", clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("homologacao_professionals")
        .select("id, name, slug, function, avatar_url, clinic_id")
        .eq("clinic_id", clinicId)
        .eq("is_active", true)
        .eq("public_booking_enabled", true);
      
      if (error) throw error;
      return data as Professional[];
    },
  });

  // Fetch schedules for selected professional
  const { data: schedules } = useQuery({
    queryKey: ["portal-homologacao-schedules", selectedProfessional?.id],
    queryFn: async () => {
      if (!selectedProfessional?.id) return [];
      const { data, error } = await supabase
        .from("homologacao_schedules")
        .select("*")
        .eq("professional_id", selectedProfessional.id)
        .eq("is_active", true);
      
      if (error) throw error;
      return data as Schedule[];
    },
    enabled: !!selectedProfessional?.id,
  });

  // Fetch service types
  const { data: serviceTypes } = useQuery({
    queryKey: ["portal-homologacao-service-types", clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("homologacao_service_types")
        .select("id, name, duration_minutes")
        .eq("clinic_id", clinicId)
        .eq("is_active", true);
      
      if (error) throw error;
      return data as ServiceType[];
    },
  });

  // Auto-select first service
  useEffect(() => {
    if (serviceTypes && serviceTypes.length > 0 && !selectedService) {
      setSelectedService(serviceTypes[0].id);
    }
  }, [serviceTypes, selectedService]);

  // Fetch blocks for the clinic
  const { data: blocks } = useQuery({
    queryKey: ["portal-homologacao-blocks", clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("homologacao_blocks")
        .select("block_date, professional_id")
        .eq("clinic_id", clinicId);
      
      if (error) throw error;
      return data as Block[];
    },
  });

  // Fetch existing appointments
  const { data: appointments } = useQuery({
    queryKey: ["portal-homologacao-appointments", selectedProfessional?.id, selectedDate],
    queryFn: async () => {
      if (!selectedProfessional?.id || !selectedDate) return [];
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("homologacao_appointments")
        .select("start_time, end_time, status")
        .eq("professional_id", selectedProfessional.id)
        .eq("appointment_date", dateStr)
        .neq("status", "cancelled");
      
      if (error) throw error;
      return data;
    },
    enabled: !!selectedProfessional?.id && !!selectedDate,
  });

  // Create appointment mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!selectedProfessional || !selectedDate || !selectedTime || !selectedService) {
        throw new Error("Dados incompletos");
      }

      const service = serviceTypes?.find(s => s.id === selectedService);
      if (!service) throw new Error("Serviço não encontrado");

      const [hours, minutes] = selectedTime.split(':').map(Number);
      const endDate = new Date();
      endDate.setHours(hours, minutes + service.duration_minutes);
      const endTime = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;

      const appointmentData = {
        clinic_id: clinicId,
        professional_id: selectedProfessional.id,
        service_type_id: selectedService,
        appointment_date: format(selectedDate, "yyyy-MM-dd"),
        start_time: selectedTime,
        end_time: endTime,
        employee_name: employeeData.employee_name,
        employee_cpf: employeeData.employee_cpf || null,
        company_name: employer.name,
        company_cnpj: employer.cnpj || null,
        company_phone: employer.phone || null,
        company_email: employer.email || null,
        notes: `Agendado via Portal do Contador`,
        status: 'scheduled',
      };

      const { data, error } = await supabase
        .from("homologacao_appointments")
        .insert(appointmentData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success("Agendamento realizado com sucesso!");
      setStep('confirmation');
      
      // Trigger notifications
      supabase.functions.invoke("send-homologacao-notifications", {
        body: { appointment_id: data.id }
      }).catch(console.error);
    },
    onError: (error) => {
      toast.error("Erro ao criar agendamento: " + error.message);
    },
  });

  // Generate available time slots based on service duration
  const getAvailableSlotsForDate = (date: Date): TimeSlot[] => {
    if (!date || !schedules) return [];

    const dayOfWeek = date.getDay();
    const daySchedule = schedules.find((s) => s.day_of_week === dayOfWeek);

    if (!daySchedule) return [];

    const slots: TimeSlot[] = [];
    const [startHour, startMin] = daySchedule.start_time.split(":").map(Number);
    const [endHour, endMin] = daySchedule.end_time.split(":").map(Number);

    // Use service duration for interval
    const service = serviceTypes?.find((s) => s.id === selectedService);
    const interval = service?.duration_minutes || 30;

    let currentHour = startHour;
    let currentMin = startMin;

    while (
      currentHour < endHour ||
      (currentHour === endHour && currentMin < endMin)
    ) {
      const timeStr = `${String(currentHour).padStart(2, "0")}:${String(
        currentMin
      ).padStart(2, "0")}`;

      const bookedCount =
        appointments?.filter((apt) => apt.start_time?.slice(0, 5) === timeStr)
          .length || 0;

      slots.push({
        time: timeStr,
        available: bookedCount < daySchedule.capacity,
        capacity: daySchedule.capacity,
        booked: bookedCount,
      });

      currentMin += interval;
      if (currentMin >= 60) {
        currentHour += Math.floor(currentMin / 60);
        currentMin = currentMin % 60;
      }
    }

    return slots;
  };

  const getAvailableSlots = (): TimeSlot[] => {
    if (!selectedDate) return [];
    return getAvailableSlotsForDate(selectedDate);
  };

  // Check if a date is available (respects schedules, blocks, and past dates)
  const isDayAvailable = (date: Date): boolean => {
    if (!schedules || !selectedProfessional) return false;

    const dayOfWeek = date.getDay();
    const hasSchedule = schedules.some(s => s.day_of_week === dayOfWeek);
    if (!hasSchedule) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date < today) return false;

    // Check if date is blocked
    const dateStr = format(date, "yyyy-MM-dd");
    const isBlocked = blocks?.some(b => 
      b.block_date === dateStr && 
      (b.professional_id === null || b.professional_id === selectedProfessional.id)
    );
    if (isBlocked) return false;

    return true;
  };

  const calendarDays = () => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  };

  const handleSubmit = () => {
    if (!employeeData.employee_name.trim()) {
      toast.error("Nome do funcionário é obrigatório");
      return;
    }
    createMutation.mutate();
  };

  // Confirmation step
  if (step === 'confirmation') {
    return (
      <div className="space-y-6">
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-emerald-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-emerald-800 mb-2">
              Agendamento Confirmado!
            </h2>
            <p className="text-emerald-600 mb-4">
              O agendamento de homologação foi realizado com sucesso.
            </p>
            <div className="text-left bg-white rounded-lg p-4 space-y-2">
              <p><strong>Empresa:</strong> {employer.trade_name || employer.name}</p>
              <p><strong>Funcionário:</strong> {employeeData.employee_name}</p>
              <p><strong>Data:</strong> {selectedDate && format(selectedDate, "dd/MM/yyyy", { locale: ptBR })}</p>
              <p><strong>Horário:</strong> {selectedTime}</p>
              <p><strong>Profissional:</strong> {selectedProfessional?.name}</p>
            </div>
          </CardContent>
        </Card>
        <Button onClick={onBack} className="w-full">
          Voltar às Empresas
        </Button>
      </div>
    );
  }

  // Step 1: Select professional
  if (step === 'professional') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Voltar
          </Button>
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Agendar Homologação</h2>
            <p className="text-sm text-slate-500">{employer.trade_name || employer.name}</p>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-5 w-5 text-emerald-600" />
              Selecione o Profissional
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingProfessionals ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
              </div>
            ) : professionals?.length === 0 ? (
              <p className="text-center text-slate-500 py-8">
                Nenhum profissional disponível
              </p>
            ) : (
              <div className="space-y-2">
                {professionals?.map((prof) => (
                  <Card
                    key={prof.id}
                    className={cn(
                      "cursor-pointer transition-all",
                      selectedProfessional?.id === prof.id
                        ? "border-emerald-500 bg-emerald-50"
                        : "hover:border-emerald-300"
                    )}
                    onClick={() => setSelectedProfessional(prof)}
                  >
                    <CardContent className="p-3 flex items-center gap-3">
                      {prof.avatar_url ? (
                        <img src={prof.avatar_url} alt={prof.name} className="h-10 w-10 rounded-full object-cover" />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
                          <span className="text-sm font-semibold text-emerald-700">{prof.name.charAt(0)}</span>
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-slate-900">{prof.name}</p>
                        {prof.function && <p className="text-xs text-slate-500">{prof.function}</p>}
                      </div>
                      {selectedProfessional?.id === prof.id && (
                        <CheckCircle className="h-5 w-5 text-emerald-600 ml-auto" />
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Button 
          onClick={() => setStep('datetime')} 
          disabled={!selectedProfessional}
          className="w-full bg-emerald-600 hover:bg-emerald-700"
        >
          Continuar
        </Button>
      </div>
    );
  }

  // Step 2: Select date/time
  if (step === 'datetime') {
    const availableSlots = getAvailableSlots();
    const days = calendarDays();
    const firstDayOffset = days[0]?.getDay() || 0;

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setStep('professional')}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Voltar
          </Button>
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Selecione Data e Horário</h2>
            <p className="text-sm text-slate-500">{selectedProfessional?.name}</p>
          </div>
        </div>

        {/* Calendar Card - Updated */}
        <Card className="shadow-sm">
          <CardContent className="p-4 space-y-4">
            {/* Month Navigation */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-slate-600" />
                <span className="font-medium text-slate-900 capitalize">
                  {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
                </span>
              </div>
              <div className="flex gap-1">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8"
                  onClick={() => setCurrentMonth(prev => addDays(startOfMonth(prev), -1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8"
                  onClick={() => setCurrentMonth(prev => addDays(endOfMonth(prev), 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Day Headers */}
            <div className="grid grid-cols-7 mb-2">
              {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(d => (
                <div key={d} className="text-center text-sm font-medium text-slate-500 py-2">
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-y-1">
              {Array(firstDayOffset).fill(null).map((_, i) => (
                <div key={`empty-${i}`} className="h-10" />
              ))}
              {days.map((day) => {
                const isAvailable = isDayAvailable(day);
                const isSelected = selectedDate && day.toDateString() === selectedDate.toDateString();
                const isToday = day.toDateString() === new Date().toDateString();
                
                return (
                  <div key={day.toISOString()} className="flex justify-center">
                    <button
                      disabled={!isAvailable}
                      onClick={() => {
                        setSelectedDate(day);
                        setSelectedTime(null);
                      }}
                      className={cn(
                        "h-10 w-10 rounded-full flex items-center justify-center text-sm transition-colors",
                        isSelected 
                          ? "bg-emerald-600 text-white font-semibold" 
                          : isAvailable
                            ? "hover:bg-slate-100 text-slate-900 font-medium"
                            : "text-slate-300 cursor-not-allowed",
                        isToday && !isSelected && "text-emerald-600 font-bold"
                      )}
                    >
                      {format(day, "d")}
                    </button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Time Slots Card - Updated */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-5 w-5 text-slate-600" />
              <span className="font-medium text-slate-900">Dias e Horários Disponíveis</span>
            </div>

            {!selectedDate ? (
              <div className="space-y-3">
                <p className="text-center text-slate-500 text-sm">
                  Selecione um dia abaixo (já com horários disponíveis)
                </p>

                {(() => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const end = addDays(today, 30);
                  const upcomingDays = eachDayOfInterval({ start: today, end });

                  const dayCards = upcomingDays
                    .filter((d) => isDayAvailable(d))
                    .map((d) => {
                      const slots = getAvailableSlotsForDate(d).filter((s) => s.available);
                      return {
                        date: d,
                        slots,
                      };
                    })
                    .filter((x) => x.slots.length > 0)
                    .slice(0, 10);

                  if (dayCards.length === 0) {
                    return (
                      <p className="text-center text-slate-500 py-4 text-sm">
                        Nenhum dia com horários disponíveis nos próximos 30 dias.
                      </p>
                    );
                  }

                  return (
                    <div className="grid gap-2">
                      {dayCards.map(({ date, slots }) => (
                        <button
                          key={date.toISOString()}
                          onClick={() => {
                            setSelectedDate(date);
                            setSelectedTime(null);
                          }}
                          className="w-full text-left rounded-xl border border-slate-200 bg-white hover:border-emerald-400 hover:bg-emerald-50 transition-colors p-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="font-semibold text-slate-900">
                                {format(date, "EEEE", { locale: ptBR })}
                              </p>
                              <p className="text-sm text-slate-600">
                                {format(date, "dd/MM/yyyy", { locale: ptBR })}
                              </p>
                            </div>
                            <Badge variant="secondary">
                              {slots.length} horário{slots.length === 1 ? "" : "s"}
                            </Badge>
                          </div>

                          <div className="mt-2 flex flex-wrap gap-2">
                            {slots.slice(0, 6).map((s) => (
                              <span
                                key={s.time}
                                className="text-xs font-semibold px-2 py-1 rounded-md bg-slate-100 text-slate-700"
                              >
                                {s.time}
                              </span>
                            ))}
                            {slots.length > 6 && (
                              <span className="text-xs text-slate-500 px-2 py-1">
                                +{slots.length - 6}
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </div>
            ) : availableSlots.length === 0 ? (
              <p className="text-center text-slate-500 py-4 text-sm">
                Nenhum horário disponível para esta data
              </p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                {availableSlots.filter((s) => s.available).map((slot) => (
                  <button
                    key={slot.time}
                    onClick={() => setSelectedTime(slot.time)}
                    className={cn(
                      "py-3 px-4 rounded-xl border-2 text-sm font-semibold transition-all shadow-sm",
                      selectedTime === slot.time
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-emerald-200 shadow-md"
                        : "bg-white text-slate-700 border-slate-200 hover:border-emerald-400 hover:bg-emerald-50 hover:shadow-md"
                    )}
                  >
                    {slot.time}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Button 
          onClick={() => setStep('employee')} 
          disabled={!selectedDate || !selectedTime}
          className="w-full bg-emerald-600 hover:bg-emerald-700"
        >
          Continuar
        </Button>
      </div>
    );
  }

  // Step 3: Employee data
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => setStep('datetime')}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Voltar
        </Button>
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Dados do Funcionário</h2>
          <p className="text-sm text-slate-500">
            {selectedDate && format(selectedDate, "dd/MM/yyyy")} às {selectedTime}
          </p>
        </div>
      </div>

      {/* Summary */}
      <Card className="bg-slate-50">
        <CardContent className="pt-4 space-y-1 text-sm">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-slate-400" />
            <span className="font-medium">{employer.trade_name || employer.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-slate-400" />
            <span>{selectedProfessional?.name}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Funcionário a ser homologado</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="employee_name">Nome Completo *</Label>
            <Input
              id="employee_name"
              placeholder="Nome do funcionário"
              value={employeeData.employee_name}
              onChange={(e) => setEmployeeData(prev => ({ ...prev, employee_name: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="employee_cpf">CPF</Label>
            <Input
              id="employee_cpf"
              placeholder="000.000.000-00"
              value={employeeData.employee_cpf}
              onChange={(e) => setEmployeeData(prev => ({ ...prev, employee_cpf: e.target.value }))}
            />
          </div>
        </CardContent>
      </Card>

      <Button 
        onClick={handleSubmit} 
        disabled={createMutation.isPending || !employeeData.employee_name.trim()}
        className="w-full bg-emerald-600 hover:bg-emerald-700"
      >
        {createMutation.isPending ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Agendando...
          </>
        ) : (
          "Confirmar Agendamento"
        )}
      </Button>
    </div>
  );
}
