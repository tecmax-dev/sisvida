import { useState, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { format, startOfWeek, addDays, isSameDay, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { 
  Calendar as CalendarIcon, 
  UserCircle, 
  Search,
  Plus,
  Clock,
  ChevronLeft,
  ChevronRight,
  User,
  CalendarCheck,
  CalendarClock,
  ClipboardCheck,
  UserX,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Send,
  Loader2,
  Bell,
} from "lucide-react";
import { NovoAgendamentoDialog } from "@/components/homologacao/NovoAgendamentoDialog";
import { HomologacaoEditDialog } from "@/components/homologacao/HomologacaoEditDialog";
import { 
  ConfirmDeleteDialog, 
  ConfirmCancelDialog, 
  ConfirmCompleteDialog 
} from "@/components/homologacao/HomologacaoConfirmDialogs";
import { 
  useHomologacaoAppointments, 
  HomologacaoAppointment 
} from "@/hooks/useHomologacaoAppointments";
import { 
  formatReminderMessage, 
  formatProtocolMessage,
  logHomologacaoNotification,
  sendWhatsAppViaEvolution,
} from "@/lib/homologacaoUtils";
import { HomologacaoSendNotificationDialog } from "@/components/homologacao/HomologacaoSendNotificationDialog";
import { HomologacaoNotificationHistory } from "@/components/homologacao/HomologacaoNotificationHistory";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { RealtimeIndicator } from "@/components/ui/realtime-indicator";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Pencil, Trash2, MessageCircle, FileText, Mail, History } from "lucide-react";
import { 
  useHomologacaoProfessionalsWithSchedules,
  filterProfessionalsByDayOfWeek,
  getProfessionalScheduleForDay,
} from "@/hooks/useHomologacaoProfessionalsWithSchedules";

type ViewMode = "day" | "week" | "month";

const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const monthNames = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const statusConfig: Record<string, { icon: typeof AlertCircle; color: string; bgColor: string; label: string }> = {
  scheduled: { icon: AlertCircle, color: "text-amber-600", bgColor: "bg-amber-100", label: "Agendado" },
  confirmed: { icon: CheckCircle2, color: "text-blue-600", bgColor: "bg-blue-100", label: "Confirmado" },
  attended: { icon: CheckCircle2, color: "text-green-600", bgColor: "bg-green-100", label: "Atendido" },
  completed: { icon: CheckCircle2, color: "text-green-600", bgColor: "bg-green-100", label: "Realizado" },
  cancelled: { icon: XCircle, color: "text-red-600", bgColor: "bg-red-100", label: "Cancelado" },
  deleted: { icon: Trash2, color: "text-gray-600", bgColor: "bg-gray-100", label: "Excluído" },
  no_show: { icon: XCircle, color: "text-orange-600", bgColor: "bg-orange-100", label: "Faltou" },
};

const toDateKey = (date: Date): string => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export default function HomologacaoAgendaPage() {
  const { currentClinic } = useAuth();
  const queryClient = useQueryClient();
  
  // State
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [isNovoDialogOpen, setIsNovoDialogOpen] = useState(false);
  const [sendingBulkReminder, setSendingBulkReminder] = useState<string | null>(null);
  
  // Dialog states
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<HomologacaoAppointment | null>(null);
  
  // Notification dialog states
  const [notificationDialogOpen, setNotificationDialogOpen] = useState(false);
  const [notificationType, setNotificationType] = useState<"reminder" | "protocol">("reminder");
  const [historyOpen, setHistoryOpen] = useState(false);

  // Data hooks
  const {
    appointments,
    isLoading,
    isUpdating,
    invalidate,
    updateAppointment,
    cancelAppointment,
    completeAppointment,
    deleteAppointment,
  } = useHomologacaoAppointments();

  // Realtime subscription
  useRealtimeSubscription({
    table: "homologacao_appointments",
    filter: currentClinic ? { column: "clinic_id", value: currentClinic.id } : undefined,
    onInsert: () => invalidate(),
    onUpdate: () => invalidate(),
    onDelete: () => invalidate(),
    enabled: !!currentClinic,
  });

  // Fetch professionals with schedules
  const { data: allProfessionals = [] } = useHomologacaoProfessionalsWithSchedules({
    clinicId: currentClinic?.id,
    enabled: !!currentClinic?.id,
  });

  // Filter professionals for the selected day (used in DayView)
  const professionalsForSelectedDay = useMemo(() => {
    const dayOfWeek = selectedDate.getDay();
    return filterProfessionalsByDayOfWeek(allProfessionals, dayOfWeek);
  }, [allProfessionals, selectedDate]);

  // Filter appointments by search
  const filteredAppointments = useMemo(() => {
    if (!appointments) return [];
    if (!searchTerm.trim()) return appointments;
    const term = searchTerm.toLowerCase();
    return appointments.filter(apt => 
      apt.employee_name?.toLowerCase().includes(term) ||
      apt.company_name?.toLowerCase().includes(term) ||
      apt.protocol_number?.toLowerCase().includes(term)
    );
  }, [appointments, searchTerm]);

  // Get appointments for a specific date
  const getAppointmentsForDate = useCallback((date: Date) => {
    const dateStr = toDateKey(date);
    return filteredAppointments.filter(apt => apt.appointment_date === dateStr)
      .sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));
  }, [filteredAppointments]);

  // Week navigation
  const getWeekDays = useCallback(() => {
    const start = startOfWeek(selectedDate, { weekStartsOn: 0 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [selectedDate]);

  // Month navigation
  const getDaysInMonth = useCallback((date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const startDayOfWeek = firstDayOfMonth.getDay();
    
    const days = [];
    
    // Previous month days
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const prevDate = new Date(year, month, -i);
      days.push({ date: prevDate, day: prevDate.getDate(), isCurrentMonth: false });
    }
    
    // Current month days
    for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
      days.push({ date: new Date(year, month, i), day: i, isCurrentMonth: true });
    }
    
    // Next month days
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const nextDate = new Date(year, month + 1, i);
      days.push({ date: nextDate, day: i, isCurrentMonth: false });
    }
    
    return days;
  }, []);

  // Stats
  const stats = useMemo(() => {
    const dayAppointments = getAppointmentsForDate(selectedDate);
    return {
      total: dayAppointments.length,
      pending: dayAppointments.filter(a => a.status === 'scheduled').length,
      confirmed: dayAppointments.filter(a => a.status === 'confirmed').length,
      attended: dayAppointments.filter(a => a.status === 'attended' || a.status === 'completed').length,
      cancelled: dayAppointments.filter(a => a.status === 'cancelled' || a.status === 'no_show').length,
    };
  }, [getAppointmentsForDate, selectedDate]);

  // Navigation handlers
  const navigateDay = (direction: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + direction);
    setSelectedDate(newDate);
  };

  const navigateWeek = (direction: number) => {
    const newDate = addDays(selectedDate, direction * 7);
    setSelectedDate(newDate);
  };

  const navigateMonth = (direction: number) => {
    const newDate = direction > 0 ? addMonths(currentDate, 1) : subMonths(currentDate, 1);
    setCurrentDate(newDate);
    setSelectedDate(newDate);
  };

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    if (viewMode === "month" || viewMode === "week") {
      setViewMode("day");
    }
  };

  const isToday = (date: Date) => isSameDay(date, new Date());
  const isSelected = (date: Date) => isSameDay(date, selectedDate);

  // Action handlers
  const handleEdit = (apt: HomologacaoAppointment) => {
    setSelectedAppointment(apt);
    setEditDialogOpen(true);
  };

  const handleCancel = (apt: HomologacaoAppointment) => {
    setSelectedAppointment(apt);
    setCancelDialogOpen(true);
  };

  const handleComplete = (apt: HomologacaoAppointment) => {
    setSelectedAppointment(apt);
    setCompleteDialogOpen(true);
  };

  const handleDelete = (apt: HomologacaoAppointment) => {
    setSelectedAppointment(apt);
    setDeleteDialogOpen(true);
  };

  // Opens the integrated notification dialog
  const handleOpenNotificationDialog = (apt: HomologacaoAppointment, type: "reminder" | "protocol") => {
    setSelectedAppointment(apt);
    setNotificationType(type);
    setNotificationDialogOpen(true);
  };

  // Opens the notification history
  const handleOpenHistory = (apt: HomologacaoAppointment) => {
    setSelectedAppointment(apt);
    setHistoryOpen(true);
  };

  // Quick WhatsApp send via Evolution API
  const handleSendReminder = async (apt: HomologacaoAppointment) => {
    if (!currentClinic?.id) {
      toast.error("Clínica não encontrada");
      return;
    }
    
    const message = formatReminderMessage(apt);
    const result = await sendWhatsAppViaEvolution(currentClinic.id, apt.company_phone, message);
    
    await logHomologacaoNotification(
      apt.id,
      currentClinic.id,
      "whatsapp",
      result.success ? "sent" : "failed",
      apt.company_phone,
      undefined,
      message,
      result.error,
      false
    );
    
    if (result.success) {
      toast.success("Lembrete enviado via WhatsApp");
    } else {
      toast.error(result.error || "Erro ao enviar lembrete");
    }
  };

  const handleSendProtocol = async (apt: HomologacaoAppointment) => {
    if (!apt.protocol_number) {
      toast.error("Este agendamento ainda não possui protocolo");
      return;
    }
    if (!currentClinic?.id) {
      toast.error("Clínica não encontrada");
      return;
    }
    
    const message = formatProtocolMessage(apt);
    const result = await sendWhatsAppViaEvolution(currentClinic.id, apt.company_phone, message);
    
    await logHomologacaoNotification(
      apt.id,
      currentClinic.id,
      "whatsapp",
      result.success ? "sent" : "failed",
      apt.company_phone,
      undefined,
      message,
      result.error,
      true
    );
    
    if (result.success) {
      toast.success("Protocolo enviado via WhatsApp");
    } else {
      toast.error(result.error || "Erro ao enviar protocolo");
    }
  };

  const handleBulkReminder = async (professionalId: string, appointments: HomologacaoAppointment[]) => {
    if (!currentClinic?.id) {
      toast.error("Clínica não encontrada");
      return;
    }
    
    const eligibleAppointments = appointments.filter(apt => 
      apt.status === 'scheduled' || apt.status === 'confirmed'
    );

    if (eligibleAppointments.length === 0) {
      toast.error("Nenhum agendamento elegível para lembrete");
      return;
    }

    setSendingBulkReminder(professionalId);
    let successCount = 0;
    let errorCount = 0;

    for (const apt of eligibleAppointments) {
      const message = formatReminderMessage(apt);
      const result = await sendWhatsAppViaEvolution(currentClinic.id, apt.company_phone, message);
      
      if (result.success) {
        successCount++;
      } else {
        errorCount++;
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setSendingBulkReminder(null);
    
    if (errorCount > 0) {
      toast.warning(`${successCount} lembrete(s) enviado(s), ${errorCount} falha(s)`);
    } else {
      toast.success(`${successCount} lembrete(s) enviado(s) com sucesso`);
    }
  };

  const handleSaveEdit = async (data: Partial<HomologacaoAppointment>) => {
    if (data.id) {
      const success = await updateAppointment(data.id, data);
      if (success) {
        setEditDialogOpen(false);
        toast.success("Agendamento atualizado com sucesso");
      }
    }
  };

  const handleConfirmCancel = async (reason: string) => {
    if (selectedAppointment) {
      const success = await cancelAppointment(selectedAppointment.id, reason);
      if (success) {
        setCancelDialogOpen(false);
        toast.success("Agendamento cancelado");
      }
    }
  };

  const handleConfirmComplete = async () => {
    if (selectedAppointment) {
      const success = await completeAppointment(selectedAppointment.id);
      if (success) {
        setCompleteDialogOpen(false);
      }
    }
  };

  const handleConfirmDelete = async () => {
    if (selectedAppointment) {
      const success = await deleteAppointment(selectedAppointment.id);
      if (success) {
        setDeleteDialogOpen(false);
      }
    }
  };

  // Appointment Card Component
  const AppointmentCard = ({ apt }: { apt: HomologacaoAppointment }) => {
    const config = statusConfig[apt.status] || statusConfig.scheduled;
    const StatusIcon = config.icon;
    const isActive = !["cancelled", "completed", "attended", "deleted"].includes(apt.status);

    return (
      <div className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 transition-colors group">
        <div className={cn(
          "w-14 text-center py-1 rounded text-xs font-medium",
          isActive ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"
        )}>
          {apt.start_time?.slice(0, 5)}
        </div>
        
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <StatusIcon className={cn("h-4 w-4 flex-shrink-0", config.color)} />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm truncate">{apt.employee_name}</p>
            <p className="text-xs text-muted-foreground truncate">{apt.company_name}</p>
          </div>
          
          {apt.protocol_number && (
            <Badge variant="secondary" className="text-[10px] shrink-0">
              <FileText className="w-3 h-3 mr-1" />
              {apt.protocol_number}
            </Badge>
          )}
        </div>
        
        {/* Quick action buttons - visible on hover */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {isActive && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50"
                onClick={() => handleOpenNotificationDialog(apt, "reminder")}
                title="Enviar Lembrete (Email + WhatsApp)"
              >
                <Bell className="h-4 w-4" />
              </Button>
              {apt.protocol_number && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                  onClick={() => handleOpenNotificationDialog(apt, "protocol")}
                  title="Enviar Protocolo (Email + WhatsApp)"
                >
                  <Send className="h-4 w-4" />
                </Button>
              )}
            </>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => handleOpenHistory(apt)}
            title="Histórico de Envios"
          >
            <History className="h-4 w-4" />
          </Button>
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => handleEdit(apt)}>
              <Pencil className="w-4 h-4 mr-2" />
              Editar
            </DropdownMenuItem>
            
            {isActive && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleOpenNotificationDialog(apt, "reminder")}>
                  <Bell className="w-4 h-4 mr-2 text-green-600" />
                  Enviar Lembrete (Integrado)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSendReminder(apt)}>
                  <MessageCircle className="w-4 h-4 mr-2 text-green-500" />
                  WhatsApp Rápido
                </DropdownMenuItem>
                {apt.protocol_number && (
                  <>
                    <DropdownMenuItem onClick={() => handleOpenNotificationDialog(apt, "protocol")}>
                      <Send className="w-4 h-4 mr-2 text-blue-600" />
                      Enviar Protocolo (Integrado)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleSendProtocol(apt)}>
                      <FileText className="w-4 h-4 mr-2 text-blue-500" />
                      Protocolo WhatsApp Rápido
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleOpenHistory(apt)}>
                  <History className="w-4 h-4 mr-2" />
                  Ver Histórico de Envios
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleComplete(apt)} className="text-green-600">
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Marcar Atendido
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleCancel(apt)} className="text-orange-600">
                  <XCircle className="w-4 h-4 mr-2" />
                  Cancelar
                </DropdownMenuItem>
              </>
            )}
            
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleDelete(apt)} className="text-destructive">
              <Trash2 className="w-4 h-4 mr-2" />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

  // Free slot component
  const FreeSlot = ({ time, professionalId }: { time: string; professionalId: string }) => (
    <div className="flex items-center gap-3 px-3 py-2 bg-success/5 border-l-2 border-success/40">
      <div className="w-14 text-center py-1 rounded text-xs font-medium bg-success/10 text-success">
        {time}
      </div>
      <div className="flex-1 text-sm text-muted-foreground italic">
        Horário disponível
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs text-success hover:text-success hover:bg-success/10"
        onClick={() => setIsNovoDialogOpen(true)}
      >
        <Plus className="h-3 w-3 mr-1" />
        Agendar
      </Button>
    </div>
  );

  // Week View Component
  const WeekView = () => {
    const weekDaysData = getWeekDays();

    return (
      <div className="overflow-x-auto">
        <div className="min-w-[900px]">
          <div className="grid grid-cols-8 gap-px bg-border/50 rounded-t-lg overflow-hidden">
            <div className="bg-muted/30 p-3 text-center">
              <span className="text-xs font-medium text-muted-foreground">Horário</span>
            </div>
            
            {weekDaysData.map((date, i) => {
              const isTodayDate = isToday(date);
              return (
                <button
                  key={i}
                  onClick={() => handleDayClick(date)}
                  className={cn(
                    "p-2 text-center transition-colors",
                    isTodayDate ? "bg-primary/10" : "bg-card hover:bg-muted/50"
                  )}
                >
                  <div className="text-xs font-medium text-muted-foreground">
                    {weekDays[date.getDay()]}
                  </div>
                  <div className={cn(
                    "text-lg font-bold",
                    isTodayDate && "text-primary"
                  )}>
                    {date.getDate()}/{monthNames[date.getMonth()].slice(0, 3)}
                  </div>
                </button>
              );
            })}
          </div>
          
          <div className="border border-t-0 border-border/50 rounded-b-lg overflow-hidden">
            {["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"].map((time, timeIndex) => (
              <div 
                key={time} 
                className={cn(
                  "grid grid-cols-8 gap-px min-h-[60px]",
                  timeIndex % 2 === 0 ? "bg-muted/10" : "bg-card"
                )}
              >
                <div className="p-2 flex items-start justify-center border-r border-border/30">
                  <span className="text-sm font-medium text-muted-foreground">{time}</span>
                </div>
                
                {weekDaysData.map((date, dayIndex) => {
                  const dateStr = toDateKey(date);
                  const slotAppointments = filteredAppointments.filter(apt => {
                    if (apt.appointment_date !== dateStr) return false;
                    const aptStart = apt.start_time?.slice(0, 5) || "";
                    return aptStart === time;
                  });

                  return (
                    <div
                      key={`${dateStr}-${time}`}
                      className="p-1 border-r border-border/20 relative min-h-[60px]"
                    >
                      <div className="space-y-1">
                        {slotAppointments.map((apt) => {
                          const config = statusConfig[apt.status] || statusConfig.scheduled;
                          return (
                            <div
                              key={apt.id}
                              onClick={() => handleEdit(apt)}
                              className={cn(
                                "rounded-md p-1.5 cursor-pointer transition-all hover:shadow-md text-xs",
                                "bg-emerald-500/20 border-l-2 border-emerald-500",
                                apt.status === "cancelled" && "opacity-50 bg-red-500/20 border-red-500",
                                apt.status === "attended" && "bg-green-500/20 border-green-500"
                              )}
                            >
                              <div className="font-medium truncate text-foreground">
                                {apt.employee_name?.split(' ')[0]}
                              </div>
                              <div className="text-muted-foreground truncate">
                                {apt.company_name?.split(' ')[0]}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // Month View Component
  const MonthView = () => {
    const days = getDaysInMonth(currentDate);

    return (
      <div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs mb-2">
          {weekDays.map((day) => (
            <div key={day} className="py-2 text-muted-foreground font-medium">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((item, i) => {
            const dayAppointments = getAppointmentsForDate(item.date);
            const isTodayDate = isToday(item.date);
            const isSelectedDate = isSelected(item.date);
            
            return (
              <button
                key={i}
                onClick={() => handleDayClick(item.date)}
                className={cn(
                  "w-full aspect-square p-1 flex flex-col items-center justify-start text-sm rounded-lg transition-colors",
                  item.isCurrentMonth ? "text-foreground hover:bg-muted" : "text-muted-foreground/40",
                  isTodayDate && "bg-primary/10 text-primary font-semibold",
                  isSelectedDate && item.isCurrentMonth && "ring-2 ring-primary"
                )}
              >
                <span>{item.day}</span>
                {dayAppointments.length > 0 && (
                  <div className="flex gap-0.5 mt-1">
                    {dayAppointments.slice(0, 3).map((apt, j) => (
                      <div
                        key={j}
                        className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          apt.status === "cancelled" ? "bg-destructive" :
                          apt.status === "attended" ? "bg-success" : "bg-primary"
                        )}
                      />
                    ))}
                    {dayAppointments.length > 3 && (
                      <span className="text-[8px] text-muted-foreground">+{dayAppointments.length - 3}</span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // Day View - Grouped by Professional
  const DayView = () => {
    const dayAppointments = getAppointmentsForDate(selectedDate);
    
    // Group by professional - use only professionals that work on this day
    const groupedByProfessional = useMemo(() => {
      const groups: Record<string, { professional: any; appointments: HomologacaoAppointment[] }> = {};
      
      // First add only professionals that work on the selected day
      professionalsForSelectedDay.forEach(prof => {
        groups[prof.id] = {
          professional: prof,
          appointments: [],
        };
      });
      
      // Then add appointments to their professionals
      dayAppointments.forEach(apt => {
        if (apt.professional_id && groups[apt.professional_id]) {
          groups[apt.professional_id].appointments.push(apt);
        } else if (apt.professional_id) {
          // Professional not in list (might have appointment on a day they don't work), create temporary entry
          groups[apt.professional_id] = {
            professional: apt.professional || { id: apt.professional_id, name: "Profissional" },
            appointments: [apt],
          };
        }
      });
      
      // Filter to only show professionals with appointments or all available if no appointments
      const entries = Object.values(groups);
      const withAppointments = entries.filter(g => g.appointments.length > 0);
      
      return withAppointments.length > 0 ? withAppointments : entries;
    }, [dayAppointments, professionalsForSelectedDay]);

    if (isLoading) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          Carregando agendamentos...
        </div>
      );
    }

    if (professionalsForSelectedDay.length === 0 && dayAppointments.length === 0) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          <CalendarIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
          <p className="mb-4">Nenhum profissional ou agendamento cadastrado</p>
          <Button variant="outline" onClick={() => setIsNovoDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar agendamento
          </Button>
        </div>
      );
    }

    return (
      <div className={cn(
        "grid gap-6",
        groupedByProfessional.length === 1 ? "grid-cols-1" :
        groupedByProfessional.length === 2 ? "grid-cols-1 lg:grid-cols-2" :
        "grid-cols-1 lg:grid-cols-2 xl:grid-cols-3"
      )}>
        {groupedByProfessional.map((group) => {
          const activeAppointments = group.appointments.filter(a => a.status !== 'cancelled');
          const totalAppointments = group.appointments.length;
          
          return (
            <div key={group.professional.id} className="border rounded-lg overflow-hidden">
              {/* Professional Header */}
              <div className="flex items-center gap-3 p-3 bg-muted/30 border-b">
                <Avatar className="h-10 w-10 border-2 border-primary/20">
                  <AvatarImage src={group.professional.avatar_url} />
                  <AvatarFallback>
                    <User className="h-5 w-5 text-primary" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground truncate">{group.professional.name}</h3>
                  {group.professional.specialty && (
                    <p className="text-xs text-primary truncate">{group.professional.specialty}</p>
                  )}
                </div>
                <div className="text-right text-xs text-muted-foreground shrink-0">
                  <span className="font-medium text-primary">{activeAppointments.length} agendamento(s)</span>
                  <br />
                  <span>Total {totalAppointments}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs gap-1"
                  disabled={sendingBulkReminder === group.professional.id || activeAppointments.length === 0}
                  onClick={() => handleBulkReminder(group.professional.id, group.appointments)}
                  title="Enviar lembrete via WhatsApp para todos"
                >
                  {sendingBulkReminder === group.professional.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 text-success" />
                  )}
                  <span className="hidden sm:inline">Lembrar todos</span>
                </Button>
              </div>
              
              {/* Appointments List */}
              <div className="divide-y divide-border/30">
                {group.appointments.length > 0 ? (
                  group.appointments
                    .sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""))
                    .map((apt) => (
                      <AppointmentCard key={apt.id} apt={apt} />
                    ))
                ) : (
                  <div className="p-6 text-center text-muted-foreground">
                    <p className="text-sm">Nenhum agendamento</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <CalendarIcon className="h-6 w-6 text-primary" />
            Agenda de Homologação
          </h1>
          <p className="text-muted-foreground">
            Gestão de agendamentos de rescisão trabalhista
          </p>
          <RealtimeIndicator className="mt-1" />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* View Mode Toggle */}
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
            <TabsList>
              <TabsTrigger value="day">Dia</TabsTrigger>
              <TabsTrigger value="week">Semana</TabsTrigger>
              <TabsTrigger value="month">Mês</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 w-48"
            />
          </div>

          <Button variant="hero" onClick={() => setIsNovoDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Agendamento
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card className="border-l-4 border-l-primary bg-primary/5">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">Total</span>
            </div>
            <p className="text-xl font-bold text-foreground mt-1">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500 bg-amber-500/5">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              <span className="text-xs font-medium text-muted-foreground">Pendentes</span>
            </div>
            <p className="text-xl font-bold text-amber-600 mt-1">{stats.pending}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500 bg-blue-500/5">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-blue-500" />
              <span className="text-xs font-medium text-muted-foreground">Confirmados</span>
            </div>
            <p className="text-xl font-bold text-blue-600 mt-1">{stats.confirmed}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500 bg-emerald-500/5">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-emerald-500" />
              <span className="text-xs font-medium text-muted-foreground">Concluídos</span>
            </div>
            <p className="text-xl font-bold text-emerald-600 mt-1">{stats.attended}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-rose-500 bg-rose-500/5">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <UserX className="h-4 w-4 text-rose-500" />
              <span className="text-xs font-medium text-muted-foreground">Faltas/Canc.</span>
            </div>
            <p className="text-xl font-bold text-rose-600 mt-1">{stats.cancelled}</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card className="flex-1">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => viewMode === "day" ? navigateDay(-1) : viewMode === "week" ? navigateWeek(-1) : navigateMonth(-1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedDate(new Date());
                    setCurrentDate(new Date());
                  }}
                >
                  Hoje
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => viewMode === "day" ? navigateDay(1) : viewMode === "week" ? navigateWeek(1) : navigateMonth(1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <CardTitle className="text-base font-medium capitalize">
                {viewMode === "day" && format(selectedDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                {viewMode === "week" && `${format(getWeekDays()[0], "dd MMM", { locale: ptBR })} - ${format(getWeekDays()[6], "dd MMM yyyy", { locale: ptBR })}`}
                {viewMode === "month" && format(currentDate, "MMMM 'de' yyyy", { locale: ptBR })}
              </CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {viewMode === "day" ? (
            <DayView />
          ) : viewMode === "week" ? (
            <WeekView />
          ) : (
            <MonthView />
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <NovoAgendamentoDialog 
        open={isNovoDialogOpen} 
        onOpenChange={setIsNovoDialogOpen}
        onSuccess={invalidate}
      />

      <HomologacaoEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        appointment={selectedAppointment}
        onSave={handleSaveEdit}
      />

      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
        appointmentName={selectedAppointment?.employee_name}
      />

      <ConfirmCancelDialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        onConfirm={handleConfirmCancel}
        appointmentName={selectedAppointment?.employee_name}
      />

      <ConfirmCompleteDialog
        open={completeDialogOpen}
        onOpenChange={setCompleteDialogOpen}
        onConfirm={handleConfirmComplete}
        appointmentName={selectedAppointment?.employee_name}
      />

      {/* Notification Dialog - Integrated sending */}
      <HomologacaoSendNotificationDialog
        open={notificationDialogOpen}
        onOpenChange={setNotificationDialogOpen}
        appointment={selectedAppointment}
        type={notificationType}
      />

      {/* Notification History */}
      <HomologacaoNotificationHistory
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        appointmentId={selectedAppointment?.id || null}
        appointmentInfo={selectedAppointment ? {
          employee_name: selectedAppointment.employee_name,
          company_name: selectedAppointment.company_name,
          protocol_number: selectedAppointment.protocol_number,
        } : undefined}
      />
    </div>
  );
}
