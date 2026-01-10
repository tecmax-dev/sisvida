import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, addDays, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Phone, 
  User, 
  Building2, 
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Mail,
  Briefcase
} from "lucide-react";
import { HomologacaoProtocolReceipt } from "@/components/homologacao/HomologacaoProtocolReceipt";

interface Professional {
  id: string;
  name: string;
  function: string | null;
  avatar_url: string | null;
  phone: string | null;
  email: string | null;
  description: string | null;
  address: string | null;
  city: string | null;
  state_code: string | null;
  latitude: number | null;
  longitude: number | null;
  clinic_id: string;
  public_booking_enabled: boolean;
}

interface Schedule {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  capacity: number;
}

interface ServiceType {
  id: string;
  name: string;
  duration_minutes: number;
  description: string | null;
}

interface TimeSlot {
  time: string;
  available: boolean;
  capacity: number;
  booked: number;
}

interface FormData {
  employee_name: string;
  employee_cpf: string;
  company_name: string;
  company_cnpj: string;
  company_phone: string;
  company_email: string;
  company_contact_name: string;
  notes: string;
}

export default function HomologacaoPublicBooking() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [step, setStep] = useState<'date' | 'time' | 'form' | 'confirmation'>('date');
  const [createdAppointment, setCreatedAppointment] = useState<any>(null);
  const [formData, setFormData] = useState<FormData>({
    employee_name: '',
    employee_cpf: '',
    company_name: '',
    company_cnpj: '',
    company_phone: '',
    company_email: '',
    company_contact_name: '',
    notes: '',
  });

  // Fetch professional by slug
  const { data: professional, isLoading: loadingProfessional } = useQuery({
    queryKey: ["homologacao-professional-public", slug],
    queryFn: async () => {
      if (!slug) return null;
      const { data, error } = await supabase
        .from("homologacao_professionals")
        .select("*")
        .eq("slug", slug)
        .eq("is_active", true)
        .single();
      
      if (error) throw error;
      return data as Professional;
    },
    enabled: !!slug,
  });

  // Fetch clinic info
  const { data: clinic } = useQuery({
    queryKey: ["clinic-public", professional?.clinic_id],
    queryFn: async () => {
      if (!professional?.clinic_id) return null;
      const { data, error } = await supabase
        .from("clinics")
        .select("name, phone, address, city, state_code")
        .eq("id", professional.clinic_id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!professional?.clinic_id,
  });

  // Fetch schedules
  const { data: schedules } = useQuery({
    queryKey: ["homologacao-schedules-public", professional?.id],
    queryFn: async () => {
      if (!professional?.id) return [];
      const { data, error } = await supabase
        .from("homologacao_schedules")
        .select("*")
        .eq("professional_id", professional.id)
        .eq("is_active", true);
      
      if (error) throw error;
      return data as Schedule[];
    },
    enabled: !!professional?.id,
  });

  // Fetch service types
  const { data: serviceTypes } = useQuery({
    queryKey: ["homologacao-service-types-public", professional?.clinic_id],
    queryFn: async () => {
      if (!professional?.clinic_id) return [];
      const { data, error } = await supabase
        .from("homologacao_service_types")
        .select("*")
        .eq("clinic_id", professional.clinic_id)
        .eq("is_active", true);
      
      if (error) throw error;
      return data as ServiceType[];
    },
    enabled: !!professional?.clinic_id,
  });

  // Fetch existing appointments for selected date
  const { data: appointments } = useQuery({
    queryKey: ["homologacao-appointments-public", professional?.id, selectedDate],
    queryFn: async () => {
      if (!professional?.id || !selectedDate) return [];
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("homologacao_appointments")
        .select("start_time, end_time")
        .eq("professional_id", professional.id)
        .eq("appointment_date", dateStr)
        .not("status", "in", "(cancelled)");
      
      if (error) throw error;
      return data;
    },
    enabled: !!professional?.id && !!selectedDate,
  });

  // Fetch blocks
  const { data: blocks } = useQuery({
    queryKey: ["homologacao-blocks-public", professional?.clinic_id],
    queryFn: async () => {
      if (!professional?.clinic_id) return [];
      const { data, error } = await supabase
        .from("homologacao_blocks")
        .select("block_date, professional_id")
        .eq("clinic_id", professional.clinic_id);
      
      if (error) throw error;
      return data;
    },
    enabled: !!professional?.clinic_id,
  });

  // Create appointment mutation
  const createAppointmentMutation = useMutation({
    mutationFn: async () => {
      if (!professional || !selectedDate || !selectedTime || !selectedService) {
        throw new Error("Dados incompletos");
      }

      const service = serviceTypes?.find(s => s.id === selectedService);
      if (!service) throw new Error("Serviço não encontrado");

      // Calculate end time
      const [hours, minutes] = selectedTime.split(':').map(Number);
      const endDate = new Date();
      endDate.setHours(hours, minutes + service.duration_minutes);
      const endTime = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;

      // Generate protocol
      const { data: protocolData, error: protocolError } = await supabase.rpc(
        'generate_homologacao_protocol',
        { p_clinic_id: professional.clinic_id }
      );

      if (protocolError) {
        console.error("Protocol generation error:", protocolError);
      }

      const appointmentData = {
        clinic_id: professional.clinic_id,
        professional_id: professional.id,
        service_type_id: selectedService,
        appointment_date: format(selectedDate, "yyyy-MM-dd"),
        start_time: selectedTime,
        end_time: endTime,
        employee_name: formData.employee_name,
        employee_cpf: formData.employee_cpf || null,
        company_name: formData.company_name,
        company_cnpj: formData.company_cnpj || null,
        company_phone: formData.company_phone,
        company_email: formData.company_email || null,
        company_contact_name: formData.company_contact_name || null,
        notes: formData.notes || null,
        status: 'scheduled',
        protocol_number: protocolData || null,
      };

      const { data, error } = await supabase
        .from("homologacao_appointments")
        .insert(appointmentData)
        .select(`
          *,
          professional:homologacao_professionals(*),
          service_type:homologacao_service_types(*)
        `)
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setCreatedAppointment(data);
      setStep('confirmation');
      toast.success("Agendamento realizado com sucesso!");
    },
    onError: (error) => {
      console.error("Error creating appointment:", error);
      toast.error("Erro ao criar agendamento: " + error.message);
    },
  });

  // Generate available time slots
  const getAvailableSlots = (): TimeSlot[] => {
    if (!selectedDate || !schedules) return [];

    const dayOfWeek = selectedDate.getDay();
    const daySchedule = schedules.find(s => s.day_of_week === dayOfWeek);
    
    if (!daySchedule) return [];

    const slots: TimeSlot[] = [];
    const [startHour, startMin] = daySchedule.start_time.split(':').map(Number);
    const [endHour, endMin] = daySchedule.end_time.split(':').map(Number);
    
    const service = serviceTypes?.find(s => s.id === selectedService);
    const interval = service?.duration_minutes || 30;

    let currentHour = startHour;
    let currentMin = startMin;

    while (currentHour < endHour || (currentHour === endHour && currentMin < endMin)) {
      const timeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`;
      
      // Check if slot is already booked
      const bookedCount = appointments?.filter(apt => 
        apt.start_time?.slice(0, 5) === timeStr
      ).length || 0;

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

  // Check if date is available
  const isDateAvailable = (date: Date): boolean => {
    if (!schedules || !professional) return false;

    // Check if weekend
    const dayOfWeek = date.getDay();
    const hasSchedule = schedules.some(s => s.day_of_week === dayOfWeek);
    if (!hasSchedule) return false;

    // Check if date is in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date < today) return false;

    // Check for blocks
    const dateStr = format(date, "yyyy-MM-dd");
    const isBlocked = blocks?.some(b => 
      b.block_date === dateStr && 
      (b.professional_id === null || b.professional_id === professional.id)
    );
    if (isBlocked) return false;

    return true;
  };

  // Generate calendar days
  const calendarDays = () => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  };

  // Handle form submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.employee_name.trim()) {
      toast.error("Nome do funcionário é obrigatório");
      return;
    }
    if (!formData.company_name.trim()) {
      toast.error("Nome da empresa é obrigatório");
      return;
    }
    if (!formData.company_phone.trim()) {
      toast.error("Telefone da empresa é obrigatório");
      return;
    }

    createAppointmentMutation.mutate();
  };

  if (loadingProfessional) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-white p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!professional || !professional.public_booking_enabled) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-white flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
              <User className="w-8 h-8 text-red-500" />
            </div>
            <h1 className="text-xl font-bold mb-2">Profissional não encontrado</h1>
            <p className="text-muted-foreground">
              Este link de agendamento não está disponível ou o profissional não está mais ativo.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Confirmation step
  if (step === 'confirmation' && createdAppointment) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-white p-4">
        <div className="max-w-2xl mx-auto">
          <HomologacaoProtocolReceipt
            appointment={createdAppointment}
            professional={professional}
            clinic={clinic}
          />
        </div>
      </div>
    );
  }

  const availableSlots = getAvailableSlots();

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-white">
      {/* Header with professional info */}
      <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center overflow-hidden shrink-0">
              {professional.avatar_url ? (
                <img 
                  src={professional.avatar_url} 
                  alt={professional.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-10 h-10 text-white" />
              )}
            </div>
            
            {/* Info */}
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold truncate">{professional.name}</h1>
              <p className="text-emerald-100">{professional.function || "Advogado"}</p>
              {professional.description && (
                <p className="mt-2 text-sm text-emerald-100 line-clamp-2">{professional.description}</p>
              )}
              
              <div className="flex flex-wrap gap-4 mt-3 text-sm">
                {professional.phone && (
                  <a href={`tel:${professional.phone}`} className="flex items-center gap-1 hover:underline">
                    <Phone className="w-4 h-4" />
                    {professional.phone}
                  </a>
                )}
                {professional.email && (
                  <a href={`mailto:${professional.email}`} className="flex items-center gap-1 hover:underline">
                    <Mail className="w-4 h-4" />
                    {professional.email}
                  </a>
                )}
              </div>
            </div>
          </div>
          
          {/* Address */}
          {(professional.address || clinic?.address) && (
            <div className="mt-4 flex items-start gap-2 text-sm text-emerald-100">
              <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                {professional.address || clinic?.address}
                {(professional.city || clinic?.city) && `, ${professional.city || clinic?.city}`}
                {(professional.state_code || clinic?.state_code) && ` - ${professional.state_code || clinic?.state_code}`}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 py-4">
          <Badge variant={step === 'date' ? 'default' : 'secondary'} className="px-4">
            1. Data
          </Badge>
          <div className="w-8 h-0.5 bg-muted" />
          <Badge variant={step === 'time' ? 'default' : 'secondary'} className="px-4">
            2. Horário
          </Badge>
          <div className="w-8 h-0.5 bg-muted" />
          <Badge variant={step === 'form' ? 'default' : 'secondary'} className="px-4">
            3. Dados
          </Badge>
        </div>

        {/* Service selection */}
        {!selectedService && (
          <Card>
            <CardHeader>
              <CardTitle>Selecione o Serviço</CardTitle>
              <CardDescription>Escolha o tipo de atendimento que você precisa</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2">
                {serviceTypes?.map((service) => (
                  <Card 
                    key={service.id}
                    className="cursor-pointer hover:border-emerald-500 hover:shadow-md transition-all"
                    onClick={() => setSelectedService(service.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                          <Briefcase className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                          <h3 className="font-medium">{service.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            Duração: {service.duration_minutes} minutos
                          </p>
                          {service.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {service.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Date selection */}
        {selectedService && step === 'date' && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Selecione a Data</CardTitle>
                  <CardDescription>Escolha uma data disponível para o atendimento</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCurrentMonth(addDays(currentMonth, -30))}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="min-w-[140px] text-center font-medium">
                    {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCurrentMonth(addDays(currentMonth, 30))}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                  <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {/* Empty cells for first week offset */}
                {Array.from({ length: startOfMonth(currentMonth).getDay() }).map((_, i) => (
                  <div key={`empty-${i}`} className="aspect-square" />
                ))}
                
                {calendarDays().map((day) => {
                  const available = isDateAvailable(day);
                  const isSelected = selectedDate && isSameDay(day, selectedDate);
                  const isToday = isSameDay(day, new Date());
                  
                  return (
                    <button
                      key={day.toISOString()}
                      disabled={!available}
                      onClick={() => {
                        setSelectedDate(day);
                        setSelectedTime(null);
                        setStep('time');
                      }}
                      className={`
                        aspect-square rounded-lg flex items-center justify-center text-sm font-medium
                        transition-all
                        ${isSelected 
                          ? 'bg-emerald-600 text-white ring-2 ring-emerald-600 ring-offset-2' 
                          : available 
                            ? 'hover:bg-emerald-50 hover:text-emerald-600 cursor-pointer' 
                            : 'text-muted-foreground/40 cursor-not-allowed'
                        }
                        ${isToday && !isSelected ? 'ring-1 ring-emerald-300' : ''}
                      `}
                    >
                      {format(day, 'd')}
                    </button>
                  );
                })}
              </div>
              
              <div className="flex items-center gap-4 mt-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-emerald-600" />
                  <span>Disponível</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-muted" />
                  <span>Indisponível</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Time selection */}
        {selectedService && step === 'time' && selectedDate && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Selecione o Horário</CardTitle>
                  <CardDescription>
                    {format(selectedDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </CardDescription>
                </div>
                <Button variant="outline" onClick={() => setStep('date')}>
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Voltar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {availableSlots.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum horário disponível para esta data
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                  {availableSlots.map((slot) => (
                    <Button
                      key={slot.time}
                      variant={selectedTime === slot.time ? 'default' : 'outline'}
                      disabled={!slot.available}
                      onClick={() => {
                        setSelectedTime(slot.time);
                        setStep('form');
                      }}
                      className={`
                        ${selectedTime === slot.time ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                        ${!slot.available ? 'opacity-50' : ''}
                      `}
                    >
                      <Clock className="w-4 h-4 mr-1" />
                      {slot.time}
                    </Button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Form */}
        {selectedService && step === 'form' && selectedDate && selectedTime && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Dados do Agendamento</CardTitle>
                  <CardDescription>
                    {format(selectedDate, "dd/MM/yyyy", { locale: ptBR })} às {selectedTime}
                  </CardDescription>
                </div>
                <Button variant="outline" onClick={() => setStep('time')}>
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Voltar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Employee data */}
                <div className="space-y-4">
                  <h3 className="font-medium flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Dados do Funcionário
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="employee_name">Nome Completo *</Label>
                      <Input
                        id="employee_name"
                        value={formData.employee_name}
                        onChange={(e) => setFormData({ ...formData, employee_name: e.target.value })}
                        placeholder="Nome do funcionário"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="employee_cpf">CPF</Label>
                      <Input
                        id="employee_cpf"
                        value={formData.employee_cpf}
                        onChange={(e) => setFormData({ ...formData, employee_cpf: e.target.value })}
                        placeholder="000.000.000-00"
                      />
                    </div>
                  </div>
                </div>

                {/* Company data */}
                <div className="space-y-4">
                  <h3 className="font-medium flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    Dados da Empresa
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="company_name">Razão Social *</Label>
                      <Input
                        id="company_name"
                        value={formData.company_name}
                        onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                        placeholder="Nome da empresa"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company_cnpj">CNPJ</Label>
                      <Input
                        id="company_cnpj"
                        value={formData.company_cnpj}
                        onChange={(e) => setFormData({ ...formData, company_cnpj: e.target.value })}
                        placeholder="00.000.000/0001-00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company_phone">Telefone *</Label>
                      <Input
                        id="company_phone"
                        value={formData.company_phone}
                        onChange={(e) => setFormData({ ...formData, company_phone: e.target.value })}
                        placeholder="(00) 00000-0000"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company_email">E-mail</Label>
                      <Input
                        id="company_email"
                        type="email"
                        value={formData.company_email}
                        onChange={(e) => setFormData({ ...formData, company_email: e.target.value })}
                        placeholder="contato@empresa.com"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="company_contact_name">Nome do Contato</Label>
                      <Input
                        id="company_contact_name"
                        value={formData.company_contact_name}
                        onChange={(e) => setFormData({ ...formData, company_contact_name: e.target.value })}
                        placeholder="Nome da pessoa de contato"
                      />
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <Label htmlFor="notes">Observações</Label>
                  <Input
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Alguma observação adicional?"
                  />
                </div>

                {/* Summary */}
                <div className="bg-emerald-50 rounded-lg p-4 space-y-2">
                  <h3 className="font-medium text-emerald-800">Resumo do Agendamento</h3>
                  <div className="grid gap-1 text-sm text-emerald-700">
                    <p><strong>Profissional:</strong> {professional.name}</p>
                    <p><strong>Serviço:</strong> {serviceTypes?.find(s => s.id === selectedService)?.name}</p>
                    <p><strong>Data:</strong> {format(selectedDate, "dd/MM/yyyy", { locale: ptBR })}</p>
                    <p><strong>Horário:</strong> {selectedTime}</p>
                  </div>
                </div>

                <Button 
                  type="submit" 
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                  disabled={createAppointmentMutation.isPending}
                >
                  {createAppointmentMutation.isPending ? (
                    "Confirmando..."
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Confirmar Agendamento
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Map (if coordinates available) */}
        {(professional.latitude && professional.longitude) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Localização</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                <iframe
                  src={`https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&q=${professional.latitude},${professional.longitude}&zoom=15`}
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}