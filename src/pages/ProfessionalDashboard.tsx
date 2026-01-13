import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/layout/Logo";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { AppointmentPanel } from "@/components/appointments/AppointmentPanel";
import { 
  Loader2, 
  LogOut, 
  Play, 
  CheckCircle2, 
  Clock, 
  User,
  Phone,
  Calendar,
  Stethoscope,
  AlertCircle,
  XCircle,
  RefreshCw,
  UserCheck,
  CalendarPlus,
  Ban,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toDateKey } from "@/lib/dateKey";

interface TimeSlot {
  time: string;
  type: 'free' | 'booked';
  appointment?: Appointment;
}

interface ProfessionalSchedule {
  [key: string]: {
    enabled: boolean;
    slots: { start: string; end: string }[];
  };
}

interface Professional {
  id: string;
  name: string;
  specialty: string | null;
  clinic_id: string;
  schedule: any | null;
  appointment_duration: number | null;
  clinic: {
    name: string;
    logo_url: string | null;
  };
}

interface Appointment {
  id: string;
  patient_id: string;
  dependent_id: string | null;
  appointment_date: string;
  start_time: string;
  end_time: string;
  type: string;
  status: string;
  notes: string | null;
  started_at: string | null;
  completed_at: string | null;
  duration_minutes: number | null;
  procedure_id: string | null;
  procedure?: { id: string; name: string; price: number } | null;
  patient: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    birth_date: string | null;
  };
  dependent?: { id: string; name: string } | null;
}

const getDisplayName = (apt: Appointment) => {
  if (apt.dependent_id && apt.dependent?.name) {
    return apt.dependent.name;
  }
  return apt.patient.name;
};

const statusConfig: Record<string, { icon: any; color: string; bgColor: string; label: string }> = {
  scheduled: { icon: AlertCircle, color: "text-amber-600", bgColor: "bg-amber-100", label: "A confirmar" },
  confirmed: { icon: CheckCircle2, color: "text-blue-600", bgColor: "bg-blue-100", label: "Confirmado" },
  arrived: { icon: UserCheck, color: "text-green-600", bgColor: "bg-green-100", label: "Chegou" },
  in_progress: { icon: Play, color: "text-purple-600", bgColor: "bg-purple-100", label: "Em atendimento" },
  completed: { icon: CheckCircle2, color: "text-gray-500", bgColor: "bg-gray-100", label: "Concluído" },
  cancelled: { icon: XCircle, color: "text-red-600", bgColor: "bg-red-100", label: "Cancelado" },
  no_show: { icon: XCircle, color: "text-orange-600", bgColor: "bg-orange-100", label: "Faltou" },
  blocked: { icon: Ban, color: "text-slate-600", bgColor: "bg-slate-200", label: "Bloqueado" },
};

const typeLabels: Record<string, string> = {
  first_visit: "Primeira Consulta",
  return: "Retorno",
  exam: "Exame",
  procedure: "Procedimento",
};

export default function ProfessionalDashboard() {
  const [professional, setProfessional] = useState<Professional | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Appointment Panel state
  const [appointmentPanelOpen, setAppointmentPanelOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signOut } = useAuth();

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    checkAuthAndLoadData();
  }, []);

  const checkAuthAndLoadData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      navigate("/profissional");
      return;
    }

    // PRIMEIRO: tentar por user_id (caminho normal)
    let { data: prof } = await supabase
      .from('professionals')
      .select(`
        id, 
        name, 
        specialty, 
        clinic_id,
        schedule,
        appointment_duration,
        email,
        user_id,
        clinic:clinics (name, logo_url)
      `)
      .eq('user_id', session.user.id)
      .eq('is_active', true)
      .maybeSingle();

    // FALLBACK: se não encontrou por user_id, tentar por email
    if (!prof && session.user.email) {
      console.warn('[Dashboard] Profissional não encontrado por user_id, tentando por email...');
      const { data: profByEmail } = await supabase
        .from('professionals')
        .select(`
          id, 
          name, 
          specialty, 
          clinic_id,
          schedule,
          appointment_duration,
          email,
          user_id,
          clinic:clinics (name, logo_url)
        `)
        .eq('email', session.user.email.toLowerCase())
        .eq('is_active', true)
        .maybeSingle();

      if (profByEmail) {
        prof = profByEmail;
        console.warn('[Dashboard] Profissional encontrado por email:', prof.name);
        
        // Auto-vincular user_id se estiver NULL
        if (!profByEmail.user_id) {
          const { error: updateError } = await supabase
            .from('professionals')
            .update({ user_id: session.user.id })
            .eq('id', profByEmail.id)
            .is('user_id', null);
          
          if (!updateError) {
            console.log('[Dashboard] user_id auto-vinculado com sucesso');
          } else {
            console.warn('[Dashboard] Não foi possível auto-vincular user_id:', updateError.message);
          }
        }
      }
    }

    if (!prof) {
      toast({
        title: "Acesso negado",
        description: "Sua conta não está vinculada a um profissional.",
        variant: "destructive",
      });
      await signOut();
      navigate("/profissional");
      return;
    }

    setProfessional({
      id: prof.id,
      name: prof.name,
      specialty: prof.specialty,
      clinic_id: prof.clinic_id,
      schedule: prof.schedule,
      appointment_duration: prof.appointment_duration,
      clinic: prof.clinic as { name: string; logo_url: string | null }
    });
    
    await loadAppointments(prof.id, prof.clinic_id);
    setLoading(false);
  };

  const loadAppointments = async (professionalId: string, clinicId: string) => {
    const { data, error } = await supabase
      .from('appointments')
      .select(`
        id,
        patient_id,
        dependent_id,
        appointment_date,
        start_time,
        end_time,
        type,
        status,
        notes,
        started_at,
        completed_at,
        duration_minutes,
        procedure_id,
        procedure:procedures (id, name, price),
        patient:patients (id, name, phone, email, birth_date),
        dependent:patient_dependents!appointments_dependent_id_fkey (id, name)
      `)
      .eq('professional_id', professionalId)
      .eq('clinic_id', clinicId)
      .eq('appointment_date', today)
      .in('status', ['scheduled', 'confirmed', 'in_progress', 'completed', 'arrived'])
      .order('start_time', { ascending: true });

    if (!error && data) {
      // Map appointments
      let mappedAppointments = data.map(apt => ({
        ...apt,
        dependent_id: apt.dependent_id || null,
        procedure_id: apt.procedure_id || null,
        procedure: apt.procedure as { id: string; name: string; price: number } | null,
        patient: apt.patient as { id: string; name: string; phone: string; email: string | null; birth_date: string | null },
        dependent: apt.dependent as { id: string; name: string } | null
      }));

      // Fallback: buscar dependentes faltantes se dependent_id existe mas dependent veio null
      const missingDependentIds = mappedAppointments
        .filter(apt => apt.dependent_id && !apt.dependent)
        .map(apt => apt.dependent_id as string);

      if (missingDependentIds.length > 0) {
        console.warn('[ProfessionalDashboard] Fallback: buscando dependentes faltantes', missingDependentIds);
        const uniqueIds = [...new Set(missingDependentIds)];
        const { data: dependents } = await supabase
          .from('patient_dependents')
          .select('id, name')
          .in('id', uniqueIds);

        if (dependents && dependents.length > 0) {
          const depMap = new Map(dependents.map(d => [d.id, d]));
          mappedAppointments = mappedAppointments.map(apt => {
            if (apt.dependent_id && !apt.dependent) {
              const dep = depMap.get(apt.dependent_id);
              if (dep) {
                return { ...apt, dependent: dep };
              }
            }
            return apt;
          });
        }
      }

      setAppointments(mappedAppointments);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/profissional");
  };

  const handleRefresh = async () => {
    if (!professional) return;
    setLoading(true);
    await loadAppointments(professional.id, professional.clinic_id);
    setLoading(false);
  };

  const openAppointmentPanel = (appointment: Appointment) => {
    // Navigate to the new appointment page
    navigate(`/profissional/atendimento/${appointment.id}`);
  };

  const handleAppointmentUpdate = async () => {
    if (!professional) return;
    await loadAppointments(professional.id, professional.clinic_id);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!professional) {
    return null;
  }

  const pendingAppointments = appointments.filter(a => ['scheduled', 'confirmed', 'arrived'].includes(a.status));
  const inProgressAppointment = appointments.find(a => a.status === 'in_progress');
  const completedAppointments = appointments.filter(a => a.status === 'completed');

  // Calculate free time slots based on professional schedule
  const timeSlots = useMemo(() => {
    if (!professional?.schedule) return [];

    const today = new Date();
    const dayOfWeek = today.getDay();
    const dayMap: Record<number, string> = {
      0: 'sunday', 1: 'monday', 2: 'tuesday', 3: 'wednesday',
      4: 'thursday', 5: 'friday', 6: 'saturday'
    };
    const dayKey = dayMap[dayOfWeek];
    const schedule = professional.schedule;
    const daySchedule = schedule[dayKey];
    const blocks = schedule?._blocks as Array<{ days: string[]; start_time: string; end_time: string; duration?: number; start_date?: string; end_date?: string }> | undefined;
    
    const defaultDuration = professional.appointment_duration || 30;
    const dateStr = toDateKey(today);
    
    const allTimeSlots: string[] = [];
    
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
    
    // Remover duplicatas e ordenar
    const uniqueSlots = Array.from(new Set(allTimeSlots)).sort();
    
    // Processar slots
    const slots: TimeSlot[] = [];
    
    for (const timeStr of uniqueSlots) {
      const [h, m] = timeStr.split(':').map(Number);
      const slotMinutes = h * 60 + m;
      
      // Check if this slot has an appointment
      const appointment = appointments.find(apt => {
        const aptStart = apt.start_time.substring(0, 5);
        const aptEnd = apt.end_time.substring(0, 5);
        const [aptStartH, aptStartM] = aptStart.split(':').map(Number);
        const [aptEndH, aptEndM] = aptEnd.split(':').map(Number);
        const aptStartMinutes = aptStartH * 60 + aptStartM;
        const aptEndMinutes = aptEndH * 60 + aptEndM;
        
        return slotMinutes >= aptStartMinutes && slotMinutes < aptEndMinutes;
      });

      if (appointment) {
        // Mostrar todos os slots dentro do agendamento.
        // Para evitar repetir o card completo em cada intervalo, anexamos o appointment apenas no horário inicial.
        const aptStart = appointment.start_time.substring(0, 5);
        slots.push({
          time: timeStr,
          type: 'booked',
          appointment: timeStr === aptStart ? appointment : undefined,
        });
      } else {
        slots.push({ time: timeStr, type: 'free' });
      }
    }

    return slots;
  }, [professional, appointments]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {professional.clinic.logo_url ? (
                <img 
                  src={professional.clinic.logo_url} 
                  alt={professional.clinic.name} 
                  className="h-10 w-auto" 
                />
              ) : (
                <Logo />
              )}
              <div className="hidden sm:block">
                <p className="text-sm text-muted-foreground">{professional.clinic.name}</p>
                <p className="font-medium text-foreground">{professional.name}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground hidden sm:inline">
                v{new Date().toISOString().slice(0, 10)}
              </span>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={async () => {
                  // Aguardar limpeza do PWA antes de recarregar
                  const success = await (window as any).forceUpdatePWA?.();
                  if (success !== false) {
                    // Só recarrega se a limpeza foi bem sucedida e por ação explícita
                    window.location.reload();
                  }
                }}
                title="Atualizar app"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Sair</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* Welcome & Stats */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Stethoscope className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Olá, {professional.name.split(' ')[0]}!
              </h1>
              <p className="text-muted-foreground">
                {new Date().toLocaleDateString('pt-BR', { 
                  weekday: 'long', 
                  day: 'numeric', 
                  month: 'long' 
                })}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-3xl font-bold text-warning">{pendingAppointments.length}</p>
                <p className="text-sm text-muted-foreground">Aguardando</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-3xl font-bold text-info">{inProgressAppointment ? 1 : 0}</p>
                <p className="text-sm text-muted-foreground">Em atendimento</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-3xl font-bold text-success">{completedAppointments.length}</p>
                <p className="text-sm text-muted-foreground">Concluídos</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Current Appointment */}
        {inProgressAppointment && (
          <Card className="mb-6 border-info">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Badge className="bg-info text-info-foreground">
                  <Play className="h-3 w-3 mr-1" />
                  Em atendimento
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <p className="text-xl font-semibold text-foreground">
                    {getDisplayName(inProgressAppointment)}
                    {inProgressAppointment.dependent_id && (
                      <Badge variant="outline" className="ml-2 text-xs">Dependente</Badge>
                    )}
                  </p>
                  <div className="flex flex-wrap gap-3 mt-2 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {inProgressAppointment.start_time.substring(0, 5)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Phone className="h-4 w-4" />
                      {inProgressAppointment.patient.phone}
                    </span>
                  </div>
                  <Badge variant="outline" className="mt-2">
                    {typeLabels[inProgressAppointment.type] || inProgressAppointment.type}
                  </Badge>
                </div>
                
                <Button 
                  size="lg"
                  onClick={() => openAppointmentPanel(inProgressAppointment)}
                  className="bg-info hover:bg-info/90"
                >
                  <Stethoscope className="h-4 w-4 mr-2" />
                  Continuar Atendimento
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Day Schedule with Free Slots */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Agenda do dia
          </h2>
          
          {timeSlots.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">
                  Nenhum horário configurado para hoje
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {timeSlots.map((slot, index) => {
                if (slot.type === 'booked' && slot.appointment) {
                  const appointment = slot.appointment;
                  const status = statusConfig[appointment.status];
                  const StatusIcon = status?.icon || AlertCircle;
                  const isCompleted = appointment.status === 'completed';
                  const isInProgress = appointment.status === 'in_progress';
                  
                  return (
                    <Card 
                      key={`${slot.time}-${index}`} 
                      className={cn(
                        "overflow-hidden transition-all",
                        isInProgress && "border-info ring-2 ring-info/20",
                        isCompleted && "opacity-60"
                      )}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-16 text-center py-1.5 rounded-md font-medium text-sm",
                            isInProgress ? "bg-info text-info-foreground" :
                            isCompleted ? "bg-muted text-muted-foreground" :
                            "bg-primary/10 text-primary"
                          )}>
                            {slot.time}
                          </div>
                          
                          <div className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                            status?.bgColor
                          )}>
                            <StatusIcon className={cn("h-5 w-5", status?.color)} />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-foreground truncate">
                              {getDisplayName(appointment).toUpperCase()}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              {appointment.dependent_id && (
                                <Badge variant="secondary" className="text-xs">Dependente</Badge>
                              )}
                              <Badge variant="outline" className="text-xs">
                                {typeLabels[appointment.type] || appointment.type}
                              </Badge>
                              <Badge className={cn("text-xs", status?.bgColor, status?.color)}>
                                {status?.label}
                              </Badge>
                            </div>
                          </div>
                          
                          {!isCompleted && (
                            <Button 
                              size="sm"
                              variant={isInProgress ? "default" : "outline"}
                              onClick={() => openAppointmentPanel(appointment)}
                              disabled={!!inProgressAppointment && !isInProgress}
                              className={cn(
                                "flex-shrink-0",
                                isInProgress && "bg-info hover:bg-info/90"
                              )}
                            >
                              {isInProgress ? (
                                <>
                                  <Stethoscope className="h-4 w-4 mr-1" />
                                  Continuar
                                </>
                              ) : (
                                <>
                                  <Play className="h-4 w-4 mr-1" />
                                  Iniciar
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                }

                // Slot ocupado (continuação do agendamento)
                if (slot.type === 'booked') {
                  return (
                    <Card 
                      key={`${slot.time}-${index}`} 
                      className="overflow-hidden bg-muted/20 border-muted"
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center gap-4">
                          <div className="w-16 text-center py-1.5 rounded-md font-medium text-sm bg-muted text-muted-foreground">
                            {slot.time}
                          </div>
                          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-muted">
                            <Clock className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm text-muted-foreground italic">Ocupado</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                }
                
                // Free slot
                return (
                  <Card 
                    key={`${slot.time}-${index}`} 
                    className="overflow-hidden border-dashed border-muted-foreground/30 bg-muted/30"
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center gap-4">
                        <div className="w-16 text-center py-1.5 rounded-md font-medium text-sm bg-success/10 text-success">
                          {slot.time}
                        </div>
                        
                        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-success/10">
                          <CalendarPlus className="h-5 w-5 text-success" />
                        </div>
                        
                        <div className="flex-1">
                          <p className="text-sm text-muted-foreground italic">
                            Horário disponível
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Summary Stats */}
        <div className="mt-6 p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Total: <strong className="text-foreground">{appointments.length}</strong> agendamentos
            </span>
            <span className="text-muted-foreground">
              Livres: <strong className="text-success">{timeSlots.filter(s => s.type === 'free').length}</strong> horários
            </span>
          </div>
        </div>
      </main>

      {/* Appointment Panel */}
      {selectedAppointment && professional && (
        <AppointmentPanel
          isOpen={appointmentPanelOpen}
          appointment={selectedAppointment}
          professionalId={professional.id}
          clinicId={professional.clinic_id}
          onClose={() => {
            setAppointmentPanelOpen(false);
            setSelectedAppointment(null);
          }}
          onUpdate={handleAppointmentUpdate}
        />
      )}
    </div>
  );
}
