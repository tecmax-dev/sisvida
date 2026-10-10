import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import MobileQueueCallCard from "@/components/mobile/MobileQueueCallCard";
import MobileQueuePanel from "@/components/mobile/MobileQueuePanel";
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
  const [loadError, setLoadError] = useState<string | null>(null);
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
    
    setLoading(true);
    setLoadError(null);

    try {
      // O contexto móvel pode ser restaurado do armazenamento local antes do JWT.
      // Aguarde a sessão autenticada para que o RLS não transforme a resposta em lista vazia.
      let session = (await supabase.auth.getSession()).data.session;
      if (!session) {
        const refreshed = await supabase.auth.refreshSession();
        session = refreshed.data.session;
      }

      if (!session) {
        setAppointments([]);
        setDependentAppointments([]);
        setLoadError("Sua sessão expirou. Entre novamente para visualizar os agendamentos.");
        return;
      }

      // A identidade vem da sessão autenticada no banco. Isso evita listas vazias
      // quando o armazenamento local do PWA ainda contém um patientId antigo.
      const fetchAllAppointments = () => supabase.rpc("get_my_mobile_appointments");

      let result = await fetchAllAppointments();

      // Tokens restaurados pelo PWA podem estar próximos da expiração. Atualize e repita
      // uma vez antes de concluir que o associado não possui agendamentos.
      if (result.error) {
        console.warn("[MobileAppointments] Primeira consulta falhou; renovando sessão", result.error);
        const refreshed = await supabase.auth.refreshSession();
        if (refreshed.data.session) {
          result = await fetchAllAppointments();
        }
      }

      if (result.error) {
        throw result.error;
      }

      const allRows = (result.data || []) as unknown as Appointment[];
      setAppointments(allRows.filter((appointment) => !appointment.dependent_id));
      setDependentAppointments(allRows.filter((appointment) => Boolean(appointment.dependent_id)));
    } catch (err) {
      console.error("[MobileAppointments] Erro ao carregar agendamentos:", err);
      setAppointments([]);
      setDependentAppointments([]);
      setLoadError("Não foi possível carregar seus agendamentos. Tente novamente.");
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

  const STATUS_CONFIG: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
    scheduled: { label: "Agendado", className: "bg-primary/10 text-primary", icon: <Calendar className="h-3 w-3" /> },
    confirmed: { label: "Confirmado", className: "bg-success/10 text-success", icon: <CheckCircle2 className="h-3 w-3" /> },
    arrived: { label: "Chegou", className: "bg-success/10 text-success", icon: <CheckCircle2 className="h-3 w-3" /> },
    attended: { label: "Atendido", className: "bg-muted text-foreground", icon: <CheckCircle2 className="h-3 w-3" /> },
    completed: { label: "Realizado", className: "bg-muted text-foreground", icon: <CheckCircle2 className="h-3 w-3" /> },
    cancelled: { label: "Cancelado", className: "bg-destructive/10 text-destructive", icon: <XCircle className="h-3 w-3" /> },
    no_show: { label: "Falta", className: "bg-warning/10 text-warning", icon: <AlertCircle className="h-3 w-3" /> },
    blocked: { label: "Bloqueado", className: "bg-muted text-muted-foreground", icon: <XCircle className="h-3 w-3" /> },
    in_progress: { label: "Em atendimento", className: "bg-primary/10 text-primary", icon: <Clock className="h-3 w-3" /> },
  };

  const getStatusBadge = (status: string) => {
    const config = STATUS_CONFIG[status] || { label: status, className: "bg-muted text-foreground", icon: null };
    return (
      <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${config.className}`}>
        {config.icon}
        {config.label}
      </span>
    );
  };

  // ===== Histórico: filtros e agrupamento ano > mês =====
  const [histYear, setHistYear] = useState("all");
  const [histProf, setHistProf] = useState("all");
  const [histStatus, setHistStatus] = useState("all");
  const [histPerson, setHistPerson] = useState("all");
  const [histSearch, setHistSearch] = useState("");

  const histYears = Array.from(new Set(historyAppointments.map(a => a.appointment_date.slice(0, 4)))).sort().reverse();
  const histProfs = Array.from(new Map(historyAppointments.filter(a => a.professional?.id).map(a => [a.professional.id, a.professional.name])).entries())
    .sort((x, y) => x[1].localeCompare(y[1]));
  const histPeople = Array.from(new Map(historyAppointments.map(a => [a.dependent?.id || "titular", a.dependent?.name || "Titular"])).entries());

  const filteredHistory = historyAppointments
    .filter(a => histYear === "all" || a.appointment_date.startsWith(histYear))
    .filter(a => histProf === "all" || a.professional?.id === histProf)
    .filter(a => histStatus === "all" || (histStatus === "done" ? ["completed", "attended"].includes(a.status) : a.status === histStatus))
    .filter(a => histPerson === "all" || (a.dependent?.id || "titular") === histPerson)
    .filter(a => {
      const q = histSearch.trim().toLowerCase();
      if (!q) return true;
      return [a.professional?.name, a.professional?.specialty, a.procedure?.name, a.dependent?.name].some(v => (v || "").toLowerCase().includes(q));
    })
    .sort((x, y) => (y.appointment_date + y.start_time).localeCompare(x.appointment_date + x.start_time));

  const groupedHistory = filteredHistory.reduce<Record<string, Record<string, Appointment[]>>>((acc, a) => {
    const y = a.appointment_date.slice(0, 4);
    const m = a.appointment_date.slice(5, 7);
    (acc[y] ||= {});
    (acc[y][m] ||= []).push(a);
    return acc;
  }, {});

  const histStats = {
    done: historyAppointments.filter(a => ["completed", "attended"].includes(a.status)).length,
    cancelled: historyAppointments.filter(a => a.status === "cancelled").length,
    noShow: historyAppointments.filter(a => a.status === "no_show").length,
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

  const typeLabel = (apt: Appointment) =>
    apt.procedure?.name || ({
      first_visit: "Consulta",
      return: "Retorno",
      exam: "Exame",
      procedure: "Procedimento",
      telemedicine: "Telemedicina",
    } as Record<string, string>)[apt.type] || apt.type;

  const renderAppointmentCard = (appointment: Appointment, showActions = true, compact = false) => {
    const d = parseDateOnlyToLocalNoon(appointment.appointment_date);
    const inactive = ["cancelled", "no_show"].includes(appointment.status);
    const today = isToday(d);
    const hasActions = showActions && (canConfirm(appointment) || canCancel(appointment) || canReschedule(appointment));

    return (
      <div
        key={appointment.id}
        className={`overflow-hidden rounded-2xl border bg-card shadow-sm transition ${inactive ? "border-border opacity-80" : today ? "border-mobile/40" : "border-border"}`}
      >
        <button
          type="button"
          onClick={() => { setSelectedAppointment(appointment); setShowDetails(true); }}
          className="flex w-full items-stretch gap-3 p-3.5 text-left"
          aria-label={`Ver detalhes do agendamento de ${format(d, "dd/MM/yyyy")}`}
        >
          <div className={`flex ${compact ? "w-12" : "w-14"} shrink-0 flex-col items-center justify-center rounded-xl ${inactive ? "bg-muted text-muted-foreground" : "bg-mobile text-mobile-foreground"}`}>
            <span className="text-[10px] font-semibold uppercase leading-none">{format(d, "EEE", { locale: ptBR }).replace(".", "")}</span>
            <span className={`${compact ? "text-lg" : "text-xl"} font-bold leading-tight`}>{format(d, "dd")}</span>
            {!compact && <span className="text-[10px] uppercase leading-none">{format(d, "MMM", { locale: ptBR }).replace(".", "")}</span>}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className={`truncate font-semibold text-foreground ${inactive ? "line-through decoration-muted-foreground/50" : ""}`}>
                {appointment.professional?.name || "Profissional não informado"}
              </p>
              {getStatusBadge(appointment.status)}
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {[appointment.professional?.specialty, typeLabel(appointment)].filter(Boolean).join(" · ")}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              <span className="inline-flex items-center gap-1 font-medium text-foreground">
                <Clock className="h-3.5 w-3.5 text-mobile" />
                {appointment.start_time.slice(0, 5)}–{appointment.end_time.slice(0, 5)}
              </span>
              <span className="inline-flex min-w-0 items-center gap-1 text-muted-foreground">
                <User className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{appointment.dependent?.name || "Titular"}</span>
              </span>
              {today && !inactive && <span className="rounded-full bg-mobile-soft px-2 py-0.5 font-semibold text-mobile">Hoje</span>}
            </div>
          </div>
        </button>

        {hasActions && (
          <div className="grid grid-flow-col auto-cols-fr gap-px border-t border-border bg-border">
            {canConfirm(appointment) && (
              <button
                className="flex items-center justify-center gap-1.5 bg-card py-2.5 text-xs font-semibold text-success disabled:opacity-50"
                onClick={() => handleConfirmAppointment(appointment)}
                disabled={confirming === appointment.id}
              >
                {confirming === appointment.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Confirmar
              </button>
            )}
            {canReschedule(appointment) && (
              <button
                className="flex items-center justify-center gap-1.5 bg-card py-2.5 text-xs font-semibold text-mobile disabled:opacity-50"
                onClick={() => handleReschedule(appointment)}
                disabled={checkingAvailability}
              >
                {checkingAvailability ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />}
                Remarcar
              </button>
            )}
            {canCancel(appointment) && (
              <button
                className="flex items-center justify-center gap-1.5 bg-card py-2.5 text-xs font-semibold text-destructive"
                onClick={() => { setSelectedAppointment(appointment); setShowCancelDialog(true); }}
              >
                <CalendarX className="h-4 w-4" />
                Cancelar
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderEmptyState = (type: "upcoming" | "history") => (
    <div className="flex flex-col items-center justify-center px-4 py-14 text-center">
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-mobile-soft">
        {type === "upcoming" ? <Calendar className="h-9 w-9 text-mobile" /> : <History className="h-9 w-9 text-mobile" />}
      </div>
      <h3 className="mb-1 text-base font-semibold text-foreground">
        {type === "upcoming" ? "Nenhum agendamento futuro" : "Nenhum atendimento encontrado"}
      </h3>
      <p className="text-sm text-muted-foreground">
        {type === "upcoming" ? "Que tal agendar sua próxima consulta?" : "Ajuste os filtros ou consulte outro período."}
      </p>
      {type === "upcoming" && (
        <Button onClick={() => navigate("/app/agendar")} className="mt-4 h-11 rounded-xl bg-mobile text-mobile-foreground hover:bg-mobile/90">
          <Plus className="mr-2 h-4 w-4" /> Novo agendamento
        </Button>
      )}
    </div>
  );

  const renderLoadError = () => (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <AlertCircle className="h-12 w-12 text-destructive mb-4" />
      <h3 className="text-lg font-semibold text-foreground mb-2">Agendamentos indisponíveis</h3>
      <p className="text-muted-foreground text-center text-sm">{loadError}</p>
      <Button
        variant="outline"
        className="mt-4"
        onClick={() => patientId && clinicId && loadAppointments(patientId, clinicId)}
      >
        Tentar novamente
      </Button>
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

  const nextApt = upcomingAppointments[0];
  const otherUpcoming = upcomingAppointments.slice(1);
  const selectCls = "h-10 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-mobile focus:ring-2 focus:ring-mobile/20";
  const activeFilters = [histYear, histProf, histStatus, histPerson].filter(v => v !== "all").length + (histSearch ? 1 : 0);

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col pb-28">
      {/* Cabeçalho */}
      <div className="sticky top-0 z-40 bg-mobile text-mobile-foreground shadow-sm" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="flex items-center gap-2 px-3 py-3">
          <button onClick={() => navigate("/app/home")} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-mobile-foreground/10" aria-label="Voltar">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-semibold leading-tight">Meus agendamentos</h1>
            <p className="text-xs opacity-80">Consultas suas e dos seus dependentes</p>
          </div>
          <button onClick={() => navigate("/app/filas")} className="rounded-full bg-mobile-foreground/15 px-3 py-1.5 text-xs font-semibold">
            Filas de espera
          </button>
        </div>

        {/* Abas */}
        <div className="px-4 pb-3">
          <div className="grid grid-cols-2 rounded-xl bg-mobile-foreground/15 p-1" role="tablist">
            {[
              { v: "upcoming", label: "Próximos", count: upcomingAppointments.length, icon: Calendar },
              { v: "history", label: "Histórico", count: historyAppointments.length, icon: History },
            ].map(t => (
              <button
                key={t.v}
                role="tab"
                aria-selected={activeTab === t.v}
                onClick={() => setActiveTab(t.v)}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition ${activeTab === t.v ? "bg-card text-mobile shadow-sm" : "opacity-85"}`}
              >
                <t.icon className="h-4 w-4" /> {t.label}
                <span className={`rounded-full px-1.5 text-[11px] ${activeTab === t.v ? "bg-mobile-soft" : "bg-mobile-foreground/20"}`}>{t.count}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <MobileQueueCallCard />
      <MobileQueuePanel clinicId={clinicId} />

      <div className="mx-auto w-full max-w-2xl px-4 pt-4">
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map(i => <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />)}
          </div>
        ) : loadError ? (
          renderLoadError()
        ) : activeTab === "upcoming" ? (
          upcomingAppointments.length === 0 ? renderEmptyState("upcoming") : (
            <div className="space-y-5">
              {nextApt && (
                <section>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Próximo atendimento</p>
                  {renderAppointmentCard(nextApt)}
                </section>
              )}
              {otherUpcoming.length > 0 && (
                <section>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Agendados ({otherUpcoming.length})</p>
                  <div className="space-y-3">{otherUpcoming.map(a => renderAppointmentCard(a))}</div>
                </section>
              )}
            </div>
          )
        ) : historyAppointments.length === 0 ? renderEmptyState("history") : (
          <div className="space-y-4">
            {/* Resumo */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Realizados", value: histStats.done, cls: "text-foreground", f: "done" },
                { label: "Cancelados", value: histStats.cancelled, cls: "text-destructive", f: "cancelled" },
                { label: "Faltas", value: histStats.noShow, cls: "text-warning", f: "no_show" },
              ].map(c => (
                <button
                  key={c.f}
                  onClick={() => setHistStatus(histStatus === c.f ? "all" : c.f)}
                  className={`rounded-2xl border bg-card p-3 text-center transition ${histStatus === c.f ? "border-mobile ring-2 ring-mobile/20" : "border-border"}`}
                >
                  <p className={`text-xl font-bold ${c.cls}`}>{c.value}</p>
                  <p className="text-[11px] text-muted-foreground">{c.label}</p>
                </button>
              ))}
            </div>

            {/* Filtros */}
            <div className="space-y-2 rounded-2xl border border-border bg-card p-3">
              <input
                value={histSearch}
                onChange={e => setHistSearch(e.target.value)}
                placeholder="Buscar profissional, especialidade ou paciente"
                aria-label="Buscar no histórico"
                className={selectCls}
              />
              <div className="grid grid-cols-2 gap-2">
                <select aria-label="Ano" value={histYear} onChange={e => setHistYear(e.target.value)} className={selectCls}>
                  <option value="all">Todos os anos</option>
                  {histYears.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <select aria-label="Situação" value={histStatus} onChange={e => setHistStatus(e.target.value)} className={selectCls}>
                  <option value="all">Todas as situações</option>
                  <option value="done">Realizados</option>
                  <option value="cancelled">Cancelados</option>
                  <option value="no_show">Faltas</option>
                </select>
                <select aria-label="Profissional" value={histProf} onChange={e => setHistProf(e.target.value)} className={selectCls}>
                  <option value="all">Todos os profissionais</option>
                  {histProfs.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                </select>
                <select aria-label="Paciente" value={histPerson} onChange={e => setHistPerson(e.target.value)} className={selectCls}>
                  <option value="all">Todos os pacientes</option>
                  {histPeople.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                </select>
              </div>
              {activeFilters > 0 && (
                <div className="flex items-center justify-between pt-1 text-xs">
                  <span className="text-muted-foreground">{filteredHistory.length} resultado{filteredHistory.length === 1 ? "" : "s"}</span>
                  <button
                    className="font-semibold text-mobile"
                    onClick={() => { setHistYear("all"); setHistProf("all"); setHistStatus("all"); setHistPerson("all"); setHistSearch(""); }}
                  >
                    Limpar filtros
                  </button>
                </div>
              )}
            </div>

            {/* Lista agrupada por ano e mês */}
            {filteredHistory.length === 0 ? renderEmptyState("history") : (
              Object.keys(groupedHistory).sort().reverse().map(year => (
                <section key={year} className="space-y-3">
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-bold text-foreground">{year}</h2>
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-xs text-muted-foreground">
                      {Object.values(groupedHistory[year]).reduce((n, l) => n + l.length, 0)} atendimento(s)
                    </span>
                  </div>
                  {Object.keys(groupedHistory[year]).sort().reverse().map(month => (
                    <div key={month} className="space-y-2">
                      <p className="sticky top-[118px] z-10 -mx-1 bg-muted/90 px-1 py-1 text-xs font-semibold uppercase tracking-wide text-mobile backdrop-blur">
                        {format(new Date(Number(year), Number(month) - 1, 15), "MMMM", { locale: ptBR })} · {groupedHistory[year][month].length}
                      </p>
                      {groupedHistory[year][month].map(a => renderAppointmentCard(a, false, true))}
                    </div>
                  ))}
                </section>
              ))
            )}
          </div>
        )}
      </div>

      {/* Botão Agendar (acima da barra inferior) */}
      <Button
        onClick={() => navigate("/app/agendar")}
        className="fixed right-4 z-40 h-12 rounded-full bg-mobile text-mobile-foreground px-5 shadow-lg hover:bg-mobile/90"
        style={{ bottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
      >
        <Plus className="mr-1.5 h-5 w-5" /> Agendar
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
                <div className="mt-3 p-3 bg-muted rounded-lg">
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
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
