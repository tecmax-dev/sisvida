import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, addDays, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
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
  Briefcase,
  Users,
  CalendarDays,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { HomologacaoProtocolReceipt } from "@/components/homologacao/HomologacaoProtocolReceipt";
import { EmployerAutocomplete } from "@/components/homologacao/EmployerAutocomplete";
import { EmployeeAutocomplete } from "@/components/homologacao/EmployeeAutocomplete";
import { cn } from "@/lib/utils";

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

// Collapsible Section Component
function CollapsibleSection({ 
  title, 
  icon: Icon, 
  color, 
  isOpen, 
  onToggle, 
  children,
  badge,
  completed 
}: { 
  title: string; 
  icon: React.ElementType; 
  color: 'blue' | 'green' | 'purple' | 'emerald';
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  badge?: string;
  completed?: boolean;
}) {
  const colorStyles = {
    blue: {
      header: "bg-blue-600",
      border: "border-blue-200",
      hoverBg: "hover:bg-blue-50",
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
      completedBg: "bg-blue-50",
    },
    green: {
      header: "bg-green-600",
      border: "border-green-200",
      hoverBg: "hover:bg-green-50",
      iconBg: "bg-green-100",
      iconColor: "text-green-600",
      completedBg: "bg-green-50",
    },
    purple: {
      header: "bg-purple-600",
      border: "border-purple-200",
      hoverBg: "hover:bg-purple-50",
      iconBg: "bg-purple-100",
      iconColor: "text-purple-600",
      completedBg: "bg-purple-50",
    },
    emerald: {
      header: "bg-emerald-600",
      border: "border-emerald-200",
      hoverBg: "hover:bg-emerald-50",
      iconBg: "bg-emerald-100",
      iconColor: "text-emerald-600",
      completedBg: "bg-emerald-50",
    },
  };

  const styles = colorStyles[color];

  return (
    <Card className={cn(
      "overflow-hidden transition-all duration-200",
      styles.border,
      completed && styles.completedBg
    )}>
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "w-full flex items-center justify-between p-4 text-left transition-colors",
          styles.hoverBg
        )}
      >
        <div className="flex items-center gap-3">
          <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", styles.iconBg)}>
            <Icon className={cn("w-5 h-5", styles.iconColor)} />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{title}</h3>
            {badge && (
              <p className="text-sm text-muted-foreground">{badge}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {completed && (
            <CheckCircle className="w-5 h-5 text-green-600" />
          )}
          {isOpen ? (
            <ChevronUp className="w-5 h-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-5 h-5 text-muted-foreground" />
          )}
        </div>
      </button>
      
      {isOpen && (
        <div className="px-4 pb-4 pt-2 border-t border-border/50">
          {children}
        </div>
      )}
    </Card>
  );
}

export default function HomologacaoPublicBooking() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [step, setStep] = useState<'form' | 'datetime' | 'confirmation'>('form');
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
  
  // Collapsible sections state
  const [openSections, setOpenSections] = useState({
    employer: true,
    employee: false,
    professional: false,
    datetime: false,
  });

  // Track completed sections
  const isEmployerComplete = formData.company_name && formData.company_cnpj && formData.company_phone;
  const isEmployeeComplete = formData.employee_name && formData.employee_cpf;
  
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
        .select("name, phone, address, city, state_code, logo_url")
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

  // Auto-select first service
  useEffect(() => {
    if (serviceTypes && serviceTypes.length > 0 && !selectedService) {
      setSelectedService(serviceTypes[0].id);
    }
  }, [serviceTypes, selectedService]);

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

      const [hours, minutes] = selectedTime.split(':').map(Number);
      const endDate = new Date();
      endDate.setHours(hours, minutes + service.duration_minutes);
      const endTime = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;

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
      
      // Trigger WhatsApp notifications (fire-and-forget)
      supabase.functions.invoke("send-homologacao-notifications", {
        body: { appointment_id: data.id }
      }).then(result => {
        if (result.error) {
          console.error("Notification error:", result.error);
        } else {
          console.log("Notifications sent:", result.data);
        }
      }).catch(err => {
        console.error("Failed to send notifications:", err);
      });
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

    const dayOfWeek = date.getDay();
    const hasSchedule = schedules.some(s => s.day_of_week === dayOfWeek);
    if (!hasSchedule) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date < today) return false;

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

  // Handle employer selection from autocomplete
  const handleEmployerSelect = (employer: { 
    id: string; 
    name: string; 
    cnpj: string | null; 
    trade_name: string | null; 
    phone: string | null; 
    email: string | null; 
  }) => {
    setFormData(prev => ({
      ...prev,
      company_name: employer.name,
      company_cnpj: employer.cnpj || prev.company_cnpj,
      company_phone: employer.phone || prev.company_phone,
      company_email: employer.email || prev.company_email,
    }));
    toast.success("Dados da empresa preenchidos!");
    
    // Auto-expand employee section
    setOpenSections(prev => ({
      ...prev,
      employer: false,
      employee: true,
    }));
  };

  // Handle employee selection from autocomplete
  const handleEmployeeSelect = (employee: {
    id: string;
    name: string;
    cpf: string | null;
    phone: string | null;
    email: string | null;
  }) => {
    setFormData(prev => ({
      ...prev,
      employee_name: employee.name,
      employee_cpf: employee.cpf || prev.employee_cpf,
    }));
    
    toast.success("Dados do funcionário preenchidos!");
    
    // Auto-expand professional section
    setOpenSections(prev => ({
      ...prev,
      employee: false,
      professional: true,
    }));
  };

  // Handle form submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.employee_name.trim()) {
      toast.error("Nome do funcionário é obrigatório");
      setOpenSections(prev => ({ ...prev, employee: true }));
      return;
    }
    if (!formData.company_name.trim()) {
      toast.error("Nome da empresa é obrigatório");
      setOpenSections(prev => ({ ...prev, employer: true }));
      return;
    }
    if (!formData.company_phone.trim()) {
      toast.error("Telefone da empresa é obrigatório");
      setOpenSections(prev => ({ ...prev, employer: true }));
      return;
    }
    if (!selectedDate || !selectedTime) {
      toast.error("Selecione data e horário");
      setOpenSections(prev => ({ ...prev, datetime: true }));
      return;
    }

    createAppointmentMutation.mutate();
  };

  if (loadingProfessional) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 p-4">
        <div className="max-w-2xl mx-auto space-y-6">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (!professional || !professional.public_booking_enabled) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-destructive/10 rounded-full flex items-center justify-center">
              <User className="w-8 h-8 text-destructive" />
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 p-4">
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 text-white py-8">
        <div className="max-w-2xl mx-auto px-4 text-center">
          {clinic?.logo_url ? (
            <img 
              src={clinic.logo_url} 
              alt={clinic.name || "Logo"}
              className="h-16 mx-auto mb-4 object-contain"
            />
          ) : (
            <div className="w-16 h-16 mx-auto mb-4 bg-white/20 rounded-full flex items-center justify-center">
              <Building2 className="w-8 h-8 text-white" />
            </div>
          )}
          <h1 className="text-2xl font-bold mb-2">Agendar Homologação</h1>
          <p className="text-blue-100">
            Realize o agendamento da sua homologação trabalhista de forma rápida e segura
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 -mt-4 space-y-4">
        <form onSubmit={handleSubmit}>
          {/* Card 1: Dados do Empregador */}
          <div className="mb-4">
            <CollapsibleSection
              title="Dados do Empregador"
              icon={Building2}
              color="blue"
              isOpen={openSections.employer}
              onToggle={() => setOpenSections(prev => ({ ...prev, employer: !prev.employer }))}
              completed={!!isEmployerComplete}
              badge={isEmployerComplete ? formData.company_name : "Preencha os dados da empresa"}
            >
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Buscar por CNPJ ou Nome</Label>
                  <EmployerAutocomplete
                    clinicId={professional.clinic_id}
                    value={formData.company_cnpj}
                    onChange={(value) => setFormData(prev => ({ ...prev, company_cnpj: value }))}
                    onSelect={handleEmployerSelect}
                    placeholder="Digite o CNPJ ou nome da empresa"
                  />
                </div>
                
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
                    <Label htmlFor="company_contact_name">Nome do Preposto</Label>
                    <Input
                      id="company_contact_name"
                      value={formData.company_contact_name}
                      onChange={(e) => setFormData({ ...formData, company_contact_name: e.target.value })}
                      placeholder="Nome do responsável"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company_phone">WhatsApp da Empresa *</Label>
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
                </div>
                
                <Button
                  type="button"
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  onClick={() => setOpenSections(prev => ({ ...prev, employer: false, employee: true }))}
                  disabled={!formData.company_name || !formData.company_phone}
                >
                  Continuar
                  <ChevronDown className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CollapsibleSection>
          </div>

          {/* Card 2: Dados do Trabalhador */}
          <div className="mb-4">
            <CollapsibleSection
              title="Dados do Trabalhador"
              icon={User}
              color="green"
              isOpen={openSections.employee}
              onToggle={() => setOpenSections(prev => ({ ...prev, employee: !prev.employee }))}
              completed={!!isEmployeeComplete}
              badge={isEmployeeComplete ? formData.employee_name : "Preencha os dados do funcionário"}
            >
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Buscar por CPF ou Nome</Label>
                  <EmployeeAutocomplete
                    clinicId={professional.clinic_id}
                    value={formData.employee_cpf}
                    onChange={(value) => setFormData(prev => ({ ...prev, employee_cpf: value }))}
                    onSelect={handleEmployeeSelect}
                    placeholder="Digite o CPF ou nome do funcionário"
                  />
                </div>
                
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="employee_name">Nome Completo *</Label>
                    <Input
                      id="employee_name"
                      value={formData.employee_name}
                      onChange={(e) => setFormData({ ...formData, employee_name: e.target.value })}
                      placeholder="Nome do funcionário"
                      required
                    />
                  </div>
                </div>
                
                <Button
                  type="button"
                  className="w-full bg-green-600 hover:bg-green-700"
                  onClick={() => setOpenSections(prev => ({ ...prev, employee: false, professional: true }))}
                  disabled={!formData.employee_name}
                >
                  Continuar
                  <ChevronDown className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CollapsibleSection>
          </div>

          {/* Card 3: Escolha o Profissional */}
          <div className="mb-4">
            <CollapsibleSection
              title="Escolha o Profissional"
              icon={Users}
              color="purple"
              isOpen={openSections.professional}
              onToggle={() => setOpenSections(prev => ({ ...prev, professional: !prev.professional }))}
              completed={true}
              badge={professional.name}
            >
              <div className="space-y-4">
                <Card className="border-purple-200 bg-purple-50/50">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-full bg-purple-100 flex items-center justify-center overflow-hidden shrink-0">
                        {professional.avatar_url ? (
                          <img 
                            src={professional.avatar_url} 
                            alt={professional.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="w-7 h-7 text-purple-600" />
                        )}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-foreground">{professional.name}</h4>
                        <p className="text-sm text-muted-foreground">{professional.function || "Agente Homologador"}</p>
                        <Badge className="mt-1 bg-green-100 text-green-700 border-0">
                          <span className="w-2 h-2 rounded-full bg-green-500 mr-1" />
                          Disponível
                        </Badge>
                      </div>
                    </div>
                    
                    {(professional.address || clinic?.address) && (
                      <div className="mt-3 flex items-start gap-2 text-sm text-muted-foreground">
                        <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-purple-500" />
                        <span>
                          {professional.address || clinic?.address}
                          {(professional.city || clinic?.city) && `, ${professional.city || clinic?.city}`}
                          {(professional.state_code || clinic?.state_code) && ` - ${professional.state_code || clinic?.state_code}`}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
                
                <Button
                  type="button"
                  className="w-full bg-purple-600 hover:bg-purple-700"
                  onClick={() => setOpenSections(prev => ({ ...prev, professional: false, datetime: true }))}
                >
                  Continuar
                  <ChevronDown className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CollapsibleSection>
          </div>

          {/* Card 4: Escolha Data e Horário */}
          <div className="mb-4">
            <CollapsibleSection
              title="Escolha Data e Horário"
              icon={CalendarDays}
              color="emerald"
              isOpen={openSections.datetime}
              onToggle={() => setOpenSections(prev => ({ ...prev, datetime: !prev.datetime }))}
              completed={!!(selectedDate && selectedTime)}
              badge={selectedDate && selectedTime 
                ? `${format(selectedDate, "dd/MM/yyyy")} às ${selectedTime}`
                : "Selecione data e horário"
              }
            >
              <div className="space-y-4">
                {/* Calendar */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setCurrentMonth(addDays(currentMonth, -30))}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="font-medium">
                      {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setCurrentMonth(addDays(currentMonth, 30))}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-7 gap-1 mb-2">
                    {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                      <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                        {day}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
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
                          type="button"
                          disabled={!available}
                          onClick={() => {
                            setSelectedDate(day);
                            setSelectedTime(null);
                          }}
                          className={cn(
                            "aspect-square rounded-lg flex items-center justify-center text-sm font-medium transition-all",
                            isSelected 
                              ? "bg-emerald-600 text-white ring-2 ring-emerald-600 ring-offset-2" 
                              : available 
                                ? "hover:bg-emerald-50 hover:text-emerald-600 cursor-pointer" 
                                : "text-muted-foreground/40 cursor-not-allowed",
                            isToday && !isSelected && "ring-1 ring-emerald-300"
                          )}
                        >
                          {format(day, 'd')}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Time slots */}
                {selectedDate && (
                  <div>
                    <Label className="mb-2 block">Horários disponíveis</Label>
                    {availableSlots.length === 0 ? (
                      <div className="text-center py-4 text-muted-foreground text-sm">
                        Nenhum horário disponível para esta data
                      </div>
                    ) : (
                      <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                        {availableSlots.map((slot) => (
                          <Button
                            key={slot.time}
                            type="button"
                            variant={selectedTime === slot.time ? 'default' : 'outline'}
                            disabled={!slot.available}
                            onClick={() => setSelectedTime(slot.time)}
                            size="sm"
                            className={cn(
                              selectedTime === slot.time && "bg-emerald-600 hover:bg-emerald-700",
                              !slot.available && "opacity-50"
                            )}
                          >
                            <Clock className="w-3 h-3 mr-1" />
                            {slot.time}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                
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
              </div>
            </CollapsibleSection>
          </div>

          {/* Summary and Submit */}
          {selectedDate && selectedTime && (
            <Card className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-0">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-purple-100 text-sm">Agendamento para</p>
                    <p className="font-semibold">
                      {format(selectedDate, "dd/MM/yyyy")} às {selectedTime}
                    </p>
                  </div>
                  <CalendarDays className="w-8 h-8 text-purple-200" />
                </div>
                
                <Button
                  type="submit"
                  disabled={createAppointmentMutation.isPending}
                  className="w-full bg-white text-purple-700 hover:bg-purple-50 font-semibold"
                >
                  {createAppointmentMutation.isPending ? (
                    <>Agendando...</>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5 mr-2" />
                      Confirmar Agendamento
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}
        </form>
      </div>
    </div>
  );
}
