import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfWeek, endOfWeek, addDays, isSameDay, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { 
  Calendar as CalendarIcon, 
  UserCircle, 
  Stethoscope, 
  Search,
  Plus,
  Building2,
  Clock,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  LayoutGrid,
  CalendarDays,
  RefreshCw,
} from "lucide-react";
import { NovoAgendamentoDialog } from "@/components/homologacao/NovoAgendamentoDialog";
import { HomologacaoAppointmentCard } from "@/components/homologacao/HomologacaoAppointmentCard";
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
  openWhatsAppChat, 
  formatReminderMessage, 
  formatProtocolMessage 
} from "@/lib/homologacaoUtils";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { RealtimeIndicator } from "@/components/ui/realtime-indicator";
import { useQuery } from "@tanstack/react-query";

type ViewMode = "day" | "week" | "month";

export default function HomologacaoAgendaPage() {
  const { currentClinic } = useAuth();
  const queryClient = useQueryClient();
  
  // State
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showCalendar, setShowCalendar] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [isNovoDialogOpen, setIsNovoDialogOpen] = useState(false);
  
  // Dialog states
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<HomologacaoAppointment | null>(null);

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

  // Fetch professionals for stats
  const { data: professionals } = useQuery({
    queryKey: ["homologacao-professionals", currentClinic?.id],
    queryFn: async () => {
      if (!currentClinic?.id) return [];
      const { data } = await supabase
        .from("homologacao_professionals")
        .select("*")
        .eq("clinic_id", currentClinic.id)
        .eq("is_active", true);
      return data || [];
    },
    enabled: !!currentClinic?.id,
  });

  // Fetch service types for stats
  const { data: serviceTypes } = useQuery({
    queryKey: ["homologacao-service-types", currentClinic?.id],
    queryFn: async () => {
      if (!currentClinic?.id) return [];
      const { data } = await supabase
        .from("homologacao_service_types")
        .select("*")
        .eq("clinic_id", currentClinic.id)
        .eq("is_active", true);
      return data || [];
    },
    enabled: !!currentClinic?.id,
  });

  // Week navigation
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Month navigation
  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(selectedDate);

  // Filter appointments by search
  const filteredAppointments = appointments?.filter(apt => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      apt.employee_name?.toLowerCase().includes(term) ||
      apt.company_name?.toLowerCase().includes(term) ||
      apt.protocol_number?.toLowerCase().includes(term)
    );
  });

  // Get appointments for a specific day
  const getAppointmentsForDay = useCallback((day: Date) => {
    return filteredAppointments?.filter(apt => {
      const aptDate = new Date(apt.appointment_date + "T12:00:00");
      return isSameDay(aptDate, day);
    }) || [];
  }, [filteredAppointments]);

  // Stats
  const todayAppointments = appointments?.filter(a => 
    a.appointment_date === format(new Date(), "yyyy-MM-dd")
  ).length || 0;

  const monthAppointments = appointments?.filter(a => {
    const date = new Date(a.appointment_date);
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  }).length || 0;

  // Navigation handlers
  const goToToday = () => setSelectedDate(new Date());

  const goPrevious = () => {
    if (viewMode === "day") {
      setSelectedDate(addDays(selectedDate, -1));
    } else if (viewMode === "week") {
      setSelectedDate(addDays(selectedDate, -7));
    } else {
      setSelectedDate(subMonths(selectedDate, 1));
    }
  };

  const goNext = () => {
    if (viewMode === "day") {
      setSelectedDate(addDays(selectedDate, 1));
    } else if (viewMode === "week") {
      setSelectedDate(addDays(selectedDate, 7));
    } else {
      setSelectedDate(addMonths(selectedDate, 1));
    }
  };

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

  const handleSendReminder = (apt: HomologacaoAppointment) => {
    const message = formatReminderMessage(apt);
    openWhatsAppChat(apt.company_phone, message);
    toast.success("WhatsApp aberto com a mensagem de lembrete");
  };

  const handleSendProtocol = (apt: HomologacaoAppointment) => {
    if (!apt.protocol_number) {
      toast.error("Este agendamento ainda não possui protocolo");
      return;
    }
    const message = formatProtocolMessage(apt);
    openWhatsAppChat(apt.company_phone, message);
    toast.success("WhatsApp aberto com o protocolo");
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

  // Render navigation label
  const getNavigationLabel = () => {
    if (viewMode === "day") {
      return format(selectedDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    } else if (viewMode === "week") {
      return `${format(weekStart, "dd MMM", { locale: ptBR })} - ${format(weekEnd, "dd MMM yyyy", { locale: ptBR })}`;
    } else {
      return format(selectedDate, "MMMM 'de' yyyy", { locale: ptBR });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Agenda de Homologação</h1>
          <p className="text-muted-foreground">Gestão de agendamentos de rescisão trabalhista</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={invalidate} title="Atualizar">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={() => setIsNovoDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Agendamento
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Agendamentos Hoje</CardTitle>
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayAppointments}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Profissionais</CardTitle>
            <UserCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{professionals?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tipos de Serviço</CardTitle>
            <Stethoscope className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{serviceTypes?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Este Mês</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{monthAppointments}</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="flex gap-6">
        {/* Calendar Sidebar */}
        {showCalendar && (
          <div className="hidden lg:block">
            <Card className="w-fit">
              <CardContent className="p-3">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  locale={ptBR}
                  className="rounded-md"
                />
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main View */}
        <div className="flex-1 space-y-4">
          {/* View Mode & Navigation */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={goPrevious}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="font-medium min-w-[200px] text-center capitalize">
                {getNavigationLabel()}
              </span>
              <Button variant="outline" size="icon" onClick={goNext}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={goToToday}>
                Hoje
              </Button>
            </div>
            
            <div className="flex items-center gap-2">
              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
                <TabsList className="h-9">
                  <TabsTrigger value="day" className="px-3">
                    <CalendarDays className="h-4 w-4" />
                  </TabsTrigger>
                  <TabsTrigger value="week" className="px-3">
                    <LayoutGrid className="h-4 w-4" />
                  </TabsTrigger>
                  <TabsTrigger value="month" className="px-3">
                    <CalendarIcon className="h-4 w-4" />
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              
              <div className="relative max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-48"
                />
              </div>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowCalendar(!showCalendar)}
                className="hidden lg:flex"
              >
                {showCalendar ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Week Grid */}
          {viewMode === "week" && (
            <div className="grid grid-cols-7 gap-2">
              {weekDays.map((day) => {
                const dayAppointments = getAppointmentsForDay(day);
                const isSelected = isSameDay(day, selectedDate);
                const isToday = isSameDay(day, new Date());

                return (
                  <Card 
                    key={day.toISOString()} 
                    className={`cursor-pointer transition-colors min-h-[120px] ${
                      isSelected ? 'ring-2 ring-primary' : ''
                    } ${isToday ? 'bg-primary/5' : ''}`}
                    onClick={() => setSelectedDate(day)}
                  >
                    <CardHeader className="p-2 pb-1">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-medium uppercase ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                          {format(day, "EEE", { locale: ptBR })}
                        </span>
                        <span className={`text-lg font-bold ${isToday ? 'text-primary' : ''}`}>
                          {format(day, "dd")}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="p-2 pt-0">
                      {dayAppointments.length > 0 ? (
                        <div className="space-y-1">
                          {dayAppointments.slice(0, 3).map((apt) => (
                            <div 
                              key={apt.id} 
                              className="text-xs bg-emerald-500/20 text-emerald-700 p-1 rounded truncate"
                              title={`${apt.start_time?.slice(0, 5)} - ${apt.employee_name}`}
                            >
                              {apt.start_time?.slice(0, 5)} {apt.employee_name?.split(' ')[0]}
                            </div>
                          ))}
                          {dayAppointments.length > 3 && (
                            <div className="text-xs text-muted-foreground text-center">
                              +{dayAppointments.length - 3} mais
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground text-center py-2">
                          -
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Day/Selected Appointments List */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg capitalize">
                {format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : getAppointmentsForDay(selectedDate).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <CalendarIcon className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Nenhum agendamento para este dia</p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => setIsNovoDialogOpen(true)}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Criar Agendamento
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {getAppointmentsForDay(selectedDate).map((apt) => (
                    <HomologacaoAppointmentCard
                      key={apt.id}
                      appointment={apt}
                      onEdit={() => handleEdit(apt)}
                      onCancel={() => handleCancel(apt)}
                      onComplete={() => handleComplete(apt)}
                      onDelete={() => handleDelete(apt)}
                      onSendReminder={() => handleSendReminder(apt)}
                      onSendProtocol={() => handleSendProtocol(apt)}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialogs */}
      <NovoAgendamentoDialog 
        open={isNovoDialogOpen} 
        onOpenChange={setIsNovoDialogOpen}
        onSuccess={() => {
          invalidate();
          toast.success("Agendamento criado com sucesso!");
        }}
      />

      <HomologacaoEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        appointment={selectedAppointment}
        onSave={handleSaveEdit}
        isSaving={isUpdating}
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
    </div>
  );
}
