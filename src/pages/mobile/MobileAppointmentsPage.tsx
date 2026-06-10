import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { eachDayOfInterval, endOfMonth, getDay, isSameDay, isBefore as isBeforeDate } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { 
  ArrowLeft, 
  Plus, 
  Calendar, 
  Clock, 
  User,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  MoreVertical,
  CalendarX,
  CalendarClock,
  History,
  Eye,
  MapPin,
  FileText,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format, parseISO, isPast, isToday, isFuture, addDays } from "date-fns";
import { parseDateOnlyToLocalNoon } from "@/lib/date";
import { ptBR } from "date-fns/locale";
import { useMobileAuth } from "@/contexts/MobileAuthContext";

interface Appointment {
  id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: string;
  type: string;
  notes: string | null;
  dependent_id: string | null;
  professional: {
    id: string;
    name: string;
    specialty: string | null;
  };
  procedure: {
    id: string;
    name: string;
  } | null;
  dependent?: {
    id: string;
    name: string;
  } | null;
}

// ErrorBoundary específico para debugging
class AppointmentsErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[AppointmentsErrorBoundary] Erro capturado:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
          <div className="text-center max-w-md">
            <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-foreground mb-2">
              Erro na página de agendamentos
            </h2>
            <details className="text-left mb-6 rounded-md border bg-card p-4">
              <summary className="cursor-pointer text-sm font-medium text-foreground mb-2">
                Ver detalhes do erro
              </summary>
              <pre className="mt-2 text-xs text-muted-foreground overflow-auto max-h-64">
                {this.state.error?.message}
                {'\n\n'}
                {this.state.error?.stack}
              </pre>
            </details>
            <Button 
              onClick={() => window.location.href = "/app/home"}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Voltar ao início
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function MobileAppointmentsPageContent() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [dependentAppointments, setDependentAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("upcoming");
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Usar contexto de autenticação (dados já disponíveis via bootstrap imperativo)
  const { patientId, clinicId, initialized, loading: authLoading, isLoggedIn } = useMobileAuth();

  // Debug logs
  useEffect(() => {
    console.log('[MobileAppointments] Estado do auth:', {
      initialized,
      authLoading,
      isLoggedIn,
      patientId,
      clinicId,
    });
  }, [initialized, authLoading, isLoggedIn, patientId, clinicId]);

  useEffect(() => {
    // Aguardar contexto de auth inicializar
    if (!initialized) return;
    
    if (patientId && clinicId) {
      loadAppointments(patientId, clinicId);
    } else {
      setLoading(false);
    }
  }, [patientId, clinicId, initialized]);

  const loadAppointments = async (patientId: string, clinicId: string) => {
    // Garantir que temos IDs válidos antes de fazer query
    if (!patientId || !clinicId) {
      console.warn("[MobileAppointments] IDs inválidos, abortando query");
      setLoading(false);
      return;
    }
    
    try {
      // Fetch all appointments (titular)
      const { data: myAppointments, error: myError } = await supabase
        .from("appointments")
        .select(`
          id, appointment_date, start_time, end_time, status, type, notes, dependent_id,
          professional:professionals(id, name, specialty),
          procedure:procedures(id, name)
        `)
        .eq("patient_id", patientId)
        .eq("clinic_id", clinicId)
        .is("dependent_id", null)
        .order("appointment_date", { ascending: false })
        .order("start_time", { ascending: false });

      if (myError) {
        console.error("Error fetching appointments:", myError);
      } else {
        setAppointments(myAppointments as unknown as Appointment[]);
      }

      // Fetch dependent appointments
      const { data: depAppointments, error: depError } = await supabase
        .from("appointments")
        .select(`
          id, appointment_date, start_time, end_time, status, type, notes, dependent_id,
          professional:professionals(id, name, specialty),
          procedure:procedures(id, name),
          dependent:patient_dependents!appointments_dependent_id_fkey(id, name)
        `)
        .eq("patient_id", patientId)
        .eq("clinic_id", clinicId)
        .not("dependent_id", "is", null)
        .order("appointment_date", { ascending: false })
        .order("start_time", { ascending: false });

      if (depError) {
        console.error("Error fetching dependent appointments:", depError);
      } else {
        setDependentAppointments(depAppointments as unknown as Appointment[]);
      }
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Filter appointments by type
  const allAppointments = [...appointments, ...dependentAppointments];
  
  const upcomingAppointments = allAppointments.filter(apt => {
    const date = parseDateOnlyToLocalNoon(apt.appointment_date);
    return (isFuture(date) || isToday(date)) && 
           !['cancelled', 'no_show', 'attended', 'completed'].includes(apt.status);
  }).sort((a, b) => parseDateOnlyToLocalNoon(a.appointment_date).getTime() - parseDateOnlyToLocalNoon(b.appointment_date).getTime());

  const historyAppointments = allAppointments.filter(apt => {
    const date = parseDateOnlyToLocalNoon(apt.appointment_date);
    return isPast(date) || ['cancelled', 'no_show', 'attended', 'completed'].includes(apt.status);
  });

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
      scheduled: { label: "Agendado", className: "bg-blue-100 text-blue-800", icon: <Calendar className="h-3 w-3" /> },
      confirmed: { label: "Confirmado", className: "bg-emerald-100 text-emerald-800", icon: <CheckCircle2 className="h-3 w-3" /> },
      attended: { label: "Atendido", className: "bg-gray-100 text-gray-800", icon: <CheckCircle2 className="h-3 w-3" /> },
      completed: { label: "Concluído", className: "bg-gray-100 text-gray-800", icon: <CheckCircle2 className="h-3 w-3" /> },
      cancelled: { label: "Cancelado", className: "bg-red-100 text-red-800", icon: <XCircle className="h-3 w-3" /> },
      no_show: { label: "Falta", className: "bg-orange-100 text-orange-800", icon: <AlertCircle className="h-3 w-3" /> },
      blocked: { label: "Bloqueado", className: "bg-slate-100 text-slate-800", icon: <XCircle className="h-3 w-3" /> },
      in_progress: { label: "Em atendimento", className: "bg-purple-100 text-purple-800", icon: <Clock className="h-3 w-3" /> },
    };

    const config = statusConfig[status] || { label: status, className: "bg-gray-100 text-gray-800", icon: null };
    
    return (
      <Badge className={`flex items-center gap-1 text-xs ${config.className}`}>
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  const canConfirm = (appointment: Appointment) => {
    const date = parseDateOnlyToLocalNoon(appointment.appointment_date);
    return (isFuture(date) || isToday(date)) && appointment.status === 'scheduled';
  };

  const canCancel = (appointment: Appointment) => {
    const date = parseDateOnlyToLocalNoon(appointment.appointment_date);
    return (isFuture(date) || isToday(date)) && ['scheduled', 'confirmed', 'arrived'].includes(appointment.status);
  };

  const canReschedule = (appointment: Appointment) => {
    const date = parseDateOnlyToLocalNoon(appointment.appointment_date);
    return (isFuture(date) || isToday(date)) && ['scheduled', 'confirmed', 'arrived'].includes(appointment.status);
  };

  const [checkingAvailability, setCheckingAvailability] = useState(false);

  const checkProfessionalAvailability = async (professionalId: string): Promise<boolean> => {
    try {
      const { data: prof } = await supabase
        .from("professionals")
        .select("schedule, appointment_duration")
        .eq("id", professionalId)
        .single();

      if (!prof?.schedule) return false;

      const schedule = prof.schedule as any;
      const blocks = schedule._blocks;
      if (!blocks || blocks.length === 0) return false;

      const dayMap: Record<number, string> = {
        0: 'sunday', 1: 'monday', 2: 'tuesday', 3: 'wednesday',
        4: 'thursday', 5: 'friday', 6: 'saturday'
      };

      const now = new Date();
      const monthEnd = endOfMonth(now);
      const remainingDays = eachDayOfInterval({ start: addDays(now, 1), end: monthEnd });

      const startStr = format(addDays(now, 1), "yyyy-MM-dd");
      const endStr = format(monthEnd, "yyyy-MM-dd");

      const { data: existingApts } = await supabase
        .from("appointments")
        .select("appointment_date, start_time, end_time")
        .eq("professional_id", professionalId)
        .gte("appointment_date", startStr)
        .lte("appointment_date", endStr)
        .not("status", "in", '("cancelled","no_show")');

      for (const day of remainingDays) {
        const dayName = dayMap[getDay(day)];
        const dateStr = format(day, "yyyy-MM-dd");

        const applicableBlocks = blocks.filter((block: any) => {
          if (!block.days.includes(dayName)) return false;
          if (block.start_date && block.end_date) {
            return dateStr >= block.start_date && dateStr <= block.end_date;
          }
          return true;
        });

        if (applicableBlocks.length === 0) continue;

        const dayApts = existingApts?.filter(a => a.appointment_date === dateStr) || [];

        for (const block of applicableBlocks) {
          const duration = block.duration || prof.appointment_duration || 30;
          const [sh, sm] = block.start_time.split(":").map(Number);
          const [eh, em] = block.end_time.split(":").map(Number);
          const startMin = sh * 60 + sm;
          const endMin = eh * 60 + em;

          for (let cur = startMin; cur + duration <= endMin; cur += duration) {
            const timeStr = `${Math.floor(cur / 60).toString().padStart(2, '0')}:${(cur % 60).toString().padStart(2, '0')}`;
            const slotEndMin = cur + duration;
            const slotEndStr = `${Math.floor(slotEndMin / 60).toString().padStart(2, '0')}:${(slotEndMin % 60).toString().padStart(2, '0')}`;

            if (isSameDay(day, now)) {
              const slotDate = new Date(day);
              slotDate.setHours(Math.floor(cur / 60), cur % 60);
              if (isBeforeDate(slotDate, now)) continue;
            }

            const isOccupied = dayApts.some(apt => {
              const aptStart = (apt.start_time as string).slice(0, 5);
              const aptEnd = (apt.end_time as string).slice(0, 5);
              return timeStr < aptEnd && slotEndStr > aptStart;
            });

            if (!isOccupied) return true;
          }
        }
      }

      return false;
    } catch (err) {
      console.error("Error checking availability:", err);
      return false;
    }
  };

  const callAppointmentAction = async (appointmentId: string, action: "confirm" | "cancel" | "reschedule_notify") => {
    const response = await supabase.functions.invoke("mobile-appointment-action", {
      body: { appointmentId, patientId, action },
    });
    return response;
  };

  const handleConfirmAppointment = async (appointment: Appointment) => {
    setConfirming(appointment.id);
    try {
      const { data, error } = await callAppointmentAction(appointment.id, "confirm");
      if (error) throw error;

      toast({
        title: "Consulta confirmada!",
        description: data?.whatsappSent 
          ? "Confirmação enviada por WhatsApp." 
          : "Consulta confirmada com sucesso.",
      });

      if (patientId && clinicId) loadAppointments(patientId, clinicId);
    } catch (error) {
      console.error("Error confirming:", error);
      toast({ title: "Erro ao confirmar", description: "Tente novamente.", variant: "destructive" });
    } finally {
      setConfirming(null);
    }
  };

  const handleCancelAppointment = async () => {
    if (!selectedAppointment) return;
    
    setCancelling(true);
    try {
      const { data, error } = await callAppointmentAction(selectedAppointment.id, "cancel");
      if (error) throw error;

      toast({
        title: "Agendamento cancelado",
        description: data?.whatsappSent 
          ? "Cancelamento enviado por WhatsApp." 
          : "Seu agendamento foi cancelado com sucesso.",
      });

      setShowCancelDialog(false);
      setSelectedAppointment(null);
      if (patientId && clinicId) loadAppointments(patientId, clinicId);
    } catch (error) {
      console.error("Error cancelling appointment:", error);
      toast({
        title: "Erro ao cancelar",
        description: "Não foi possível cancelar o agendamento. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setCancelling(false);
    }
  };

  const handleReschedule = async (appointment?: Appointment) => {
    const apt = appointment || selectedAppointment;
    if (!apt) return;

    setCheckingAvailability(true);
    try {
      const hasSlots = await checkProfessionalAvailability(apt.professional.id);
      
      if (!hasSlots) {
        toast({
          title: "Sem vagas disponíveis",
          description: `Não há horários disponíveis para ${apt.professional.name} neste mês. Tente novamente no próximo mês.`,
          variant: "destructive",
        });
        return;
      }

      navigate("/app/agendar", { 
        state: { 
          rescheduleFrom: apt.id,
          professionalId: apt.professional?.id,
          procedureId: apt.procedure?.id,
          dependentId: apt.dependent_id,
        } 
      });
    } finally {
      setCheckingAvailability(false);
    }
  };

  const renderAppointmentCard = (appointment: Appointment, showActions = true) => {
    const appointmentDate = parseDateOnlyToLocalNoon(appointment.appointment_date);
    const isUpcoming = isFuture(appointmentDate) || isToday(appointmentDate);
    const isPastAppointment = isPast(appointmentDate);
    
    return (
      <Card 
        key={appointment.id} 
        className={`mb-3 border-l-4 ${
          isUpcoming && !['cancelled', 'no_show'].includes(appointment.status)
            ? 'border-l-emerald-500' 
            : 'border-l-gray-300'
        }`}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <h3 className="font-medium text-foreground">
                {appointment.procedure?.name || {
                  first_visit: "Primeira Consulta",
                  return: "Retorno",
                  exam: "Exame",
                  procedure: "Procedimento",
                  telemedicine: "Telemedicina"
                }[appointment.type] || appointment.type}
              </h3>
              {appointment.dependent && (
                <p className="text-sm text-purple-600 font-medium">
                  👤 {appointment.dependent.name}
                </p>
              )}
            </div>
            {getStatusBadge(appointment.status)}
          </div>
          
          <div className="space-y-1 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>
                {format(appointmentDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>{appointment.start_time.slice(0, 5)} - {appointment.end_time.slice(0, 5)}</span>
            </div>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span>
                {appointment.professional?.name || "Profissional não informado"}
                {appointment.professional?.specialty && ` • ${appointment.professional.specialty}`}
              </span>
            </div>
          </div>

          {/* Ações visíveis diretamente no card */}
          {showActions && (canConfirm(appointment) || canCancel(appointment) || canReschedule(appointment)) && (
            <div className="mt-3 pt-3 border-t flex flex-wrap items-center gap-2">
              {canConfirm(appointment) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 min-w-[90px] text-blue-700 border-blue-300 hover:bg-blue-50"
                  onClick={() => handleConfirmAppointment(appointment)}
                  disabled={confirming === appointment.id}
                >
                  {confirming === appointment.id ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                  Confirmar
                </Button>
              )}
              {canReschedule(appointment) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 min-w-[90px] text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                  onClick={() => handleReschedule(appointment)}
                  disabled={checkingAvailability}
                >
                  {checkingAvailability ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CalendarClock className="h-4 w-4 mr-1" />}
                  Reagendar
                </Button>
              )}
              {canCancel(appointment) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 min-w-[90px] text-red-600 border-red-300 hover:bg-red-50"
                  onClick={() => {
                    setSelectedAppointment(appointment);
                    setShowCancelDialog(true);
                  }}
                >
                  <CalendarX className="h-4 w-4 mr-1" />
                  Cancelar
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderEmptyState = (type: "upcoming" | "history") => (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
        {type === "upcoming" ? (
          <Calendar className="h-12 w-12 text-gray-400" />
        ) : (
          <History className="h-12 w-12 text-gray-400" />
        )}
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">
        {type === "upcoming" ? "Nenhum agendamento futuro" : "Nenhum histórico"}
      </h3>
      <p className="text-muted-foreground text-center text-sm">
        {type === "upcoming" 
          ? "Você não possui agendamentos futuros. Agende agora!"
          : "Você ainda não possui histórico de atendimentos."
        }
      </p>
      {type === "upcoming" && (
        <Button 
          onClick={() => navigate("/app/agendar")}
          className="mt-4 bg-emerald-600 hover:bg-emerald-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo agendamento
        </Button>
      )}
    </div>
  );

  // Aguardar inicialização do contexto de auth
  if (!initialized || authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  // Se não está logado após inicialização, mostrar tela vazia (não redirecionar!)
  // O bootstrap imperativo já decidiu a rota inicial - não devemos forçar navegação aqui
  if (!patientId) {
    console.warn("[MobileAppointments] Sem patientId após inicialização - exibindo estado vazio");
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="text-center max-w-md">
          <AlertCircle className="h-16 w-16 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">
            Dados não disponíveis
          </h2>
          <p className="text-muted-foreground mb-6">
            Não foi possível carregar seus agendamentos. Volte à tela inicial.
          </p>
          <Button 
            onClick={() => navigate("/app/home")}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            Voltar ao início
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col pb-20">
      {/* Header */}
      <div className="bg-emerald-600 text-white px-4 py-4 sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/app/home")} className="p-1">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-lg font-semibold flex-1">Agendamentos</h1>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="px-4 -mt-2">
        <div className="grid grid-cols-2 gap-3">
          <Card className="border shadow-sm">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-emerald-600">{upcomingAppointments.length}</p>
              <p className="text-xs text-muted-foreground">Próximos</p>
            </CardContent>
          </Card>
          <Card className="border shadow-sm">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-gray-600">{historyAppointments.length}</p>
              <p className="text-xs text-muted-foreground">Histórico</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mt-4">
        <TabsList className="w-full rounded-none border-b h-12 bg-background p-0 mx-4" style={{ width: 'calc(100% - 32px)' }}>
          <TabsTrigger 
            value="upcoming" 
            className="flex-1 h-full rounded-none data-[state=active]:border-b-2 data-[state=active]:border-emerald-600 data-[state=active]:text-emerald-600"
          >
            <Calendar className="h-4 w-4 mr-2" />
            Próximos
          </TabsTrigger>
          <TabsTrigger 
            value="history" 
            className="flex-1 h-full rounded-none data-[state=active]:border-b-2 data-[state=active]:border-emerald-600 data-[state=active]:text-emerald-600"
          >
            <History className="h-4 w-4 mr-2" />
            Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="mt-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            </div>
          ) : upcomingAppointments.length > 0 ? (
            <ScrollArea className="h-[calc(100vh-280px)]">
              <div className="p-4">
                {upcomingAppointments.map(apt => renderAppointmentCard(apt))}
              </div>
            </ScrollArea>
          ) : (
            renderEmptyState("upcoming")
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            </div>
          ) : historyAppointments.length > 0 ? (
            <ScrollArea className="h-[calc(100vh-280px)]">
              <div className="p-4">
                {historyAppointments.map(apt => renderAppointmentCard(apt, false))}
              </div>
            </ScrollArea>
          ) : (
            renderEmptyState("history")
          )}
        </TabsContent>
      </Tabs>

      {/* Floating Action Button */}
      <Button
        onClick={() => navigate("/app/agendar")}
        className="fixed bottom-6 right-6 h-14 rounded-full bg-emerald-600 hover:bg-emerald-700 shadow-lg flex items-center gap-2 px-6 z-50"
      >
        <Plus className="h-5 w-5" />
        Agendar
      </Button>

      {/* Appointment Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Detalhes do Agendamento</DialogTitle>
          </DialogHeader>
          {selectedAppointment && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                {getStatusBadge(selectedAppointment.status)}
              </div>
              
              <div>
                <span className="text-sm text-muted-foreground">Procedimento</span>
                <p className="font-medium">{selectedAppointment.procedure?.name || selectedAppointment.type}</p>
              </div>

              {selectedAppointment.dependent && (
                <div>
                  <span className="text-sm text-muted-foreground">Dependente</span>
                  <p className="font-medium">{selectedAppointment.dependent.name}</p>
                </div>
              )}

              <div>
                <span className="text-sm text-muted-foreground">Data e Horário</span>
                <p className="font-medium">
                  {format(parseDateOnlyToLocalNoon(selectedAppointment.appointment_date), "dd/MM/yyyy", { locale: ptBR })} às {selectedAppointment.start_time.slice(0, 5)}
                </p>
              </div>

              <div>
                <span className="text-sm text-muted-foreground">Profissional</span>
                <p className="font-medium">
                  {selectedAppointment.professional?.name || "Profissional não informado"}
                  {selectedAppointment.professional?.specialty && (
                    <span className="text-muted-foreground"> • {selectedAppointment.professional.specialty}</span>
                  )}
                </p>
              </div>

              {selectedAppointment.notes && (
                <div>
                  <span className="text-sm text-muted-foreground">Observações</span>
                  <p className="text-sm">{selectedAppointment.notes}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="flex gap-2">
            {selectedAppointment && canConfirm(selectedAppointment) && (
              <Button variant="outline" onClick={() => { handleConfirmAppointment(selectedAppointment); setShowDetails(false); }} disabled={confirming === selectedAppointment.id}>
                {confirming === selectedAppointment.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Confirmar
              </Button>
            )}
            {selectedAppointment && canReschedule(selectedAppointment) && (
              <Button variant="outline" onClick={() => handleReschedule()} disabled={checkingAvailability}>
                {checkingAvailability ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CalendarClock className="h-4 w-4 mr-2" />}
                {checkingAvailability ? "Verificando vagas..." : "Reagendar"}
              </Button>
            )}
            {selectedAppointment && canCancel(selectedAppointment) && (
              <Button 
                variant="destructive" 
                onClick={() => {
                  setShowDetails(false);
                  setShowCancelDialog(true);
                }}
              >
                <CalendarX className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Agendamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar este agendamento? Esta ação não pode ser desfeita.
              {selectedAppointment && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                  <p className="font-medium">{selectedAppointment.procedure?.name || selectedAppointment.type}</p>
                  <p className="text-sm">
                    {format(parseDateOnlyToLocalNoon(selectedAppointment.appointment_date), "dd/MM/yyyy")} às {selectedAppointment.start_time.slice(0, 5)}
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelAppointment}
              disabled={cancelling}
              className="bg-red-600 hover:bg-red-700"
            >
              {cancelling ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirmar cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Exportar com ErrorBoundary
export default function MobileAppointmentsPage() {
  return (
    <AppointmentsErrorBoundary>
      <MobileAppointmentsPageContent />
    </AppointmentsErrorBoundary>
  );
}
