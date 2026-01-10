import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfWeek, endOfWeek, addDays, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { 
  Calendar as CalendarIcon, 
  UserCircle, 
  Stethoscope, 
  Search,
  Plus,
  Building2,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff
} from "lucide-react";
import { NovoAgendamentoDialog } from "@/components/homologacao/NovoAgendamentoDialog";

export default function HomologacaoAgendaPage() {
  const { currentClinic } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showCalendar, setShowCalendar] = useState(true);
  const [isNovoDialogOpen, setIsNovoDialogOpen] = useState(false);

  // Week navigation
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Fetch appointments
  const { data: appointments, isLoading } = useQuery({
    queryKey: ["homologacao-appointments", currentClinic?.id],
    queryFn: async () => {
      if (!currentClinic?.id) return [];
      const { data, error } = await supabase
        .from("homologacao_appointments")
        .select(`
          *,
          professional:homologacao_professionals(*),
          service_type:homologacao_service_types(*)
        `)
        .eq("clinic_id", currentClinic.id)
        .order("appointment_date", { ascending: true })
        .order("start_time", { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentClinic?.id,
  });

  // Fetch professionals for stats
  const { data: professionals } = useQuery({
    queryKey: ["homologacao-professionals", currentClinic?.id],
    queryFn: async () => {
      if (!currentClinic?.id) return [];
      const { data, error } = await supabase
        .from("homologacao_professionals")
        .select("*")
        .eq("clinic_id", currentClinic.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentClinic?.id,
  });

  // Fetch service types for stats
  const { data: serviceTypes } = useQuery({
    queryKey: ["homologacao-service-types", currentClinic?.id],
    queryFn: async () => {
      if (!currentClinic?.id) return [];
      const { data, error } = await supabase
        .from("homologacao_service_types")
        .select("*")
        .eq("clinic_id", currentClinic.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentClinic?.id,
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "scheduled":
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30"><Clock className="w-3 h-3 mr-1" />Agendado</Badge>;
      case "confirmed":
        return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30"><CheckCircle2 className="w-3 h-3 mr-1" />Confirmado</Badge>;
      case "completed":
        return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30"><CheckCircle2 className="w-3 h-3 mr-1" />Realizado</Badge>;
      case "cancelled":
        return <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30"><XCircle className="w-3 h-3 mr-1" />Cancelado</Badge>;
      case "no_show":
        return <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30"><AlertCircle className="w-3 h-3 mr-1" />Faltou</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // Filter appointments by search and selected date
  const filteredAppointments = appointments?.filter(apt => {
    const matchesSearch = !searchTerm || 
      apt.employee_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      apt.company_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const aptDate = new Date(apt.appointment_date + "T12:00:00");
    const matchesDate = isSameDay(aptDate, selectedDate);
    
    return matchesSearch && matchesDate;
  });

  // Get appointments for week view
  const getAppointmentsForDay = (day: Date) => {
    return appointments?.filter(apt => {
      const aptDate = new Date(apt.appointment_date + "T12:00:00");
      return isSameDay(aptDate, day);
    }) || [];
  };

  const todayAppointments = appointments?.filter(a => 
    a.appointment_date === format(new Date(), "yyyy-MM-dd")
  ).length || 0;

  const monthAppointments = appointments?.filter(a => {
    const date = new Date(a.appointment_date);
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  }).length || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Agenda de Homologação</h1>
          <p className="text-muted-foreground">Gestão de agendamentos de rescisão trabalhista</p>
        </div>
        <Button onClick={() => setIsNovoDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Agendamento
        </Button>
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

        {/* Week View */}
        <div className="flex-1 space-y-4">
          {/* Week Navigation */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setSelectedDate(addDays(selectedDate, -7))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="font-medium">
                {format(weekStart, "dd MMM", { locale: ptBR })} - {format(weekEnd, "dd MMM yyyy", { locale: ptBR })}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setSelectedDate(addDays(selectedDate, 7))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedDate(new Date())}
              >
                Hoje
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
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

          {/* Selected Day Appointments */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">
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
              ) : filteredAppointments?.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <CalendarIcon className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Nenhum agendamento para este dia</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredAppointments?.map((apt) => (
                    <div 
                      key={apt.id} 
                      className="flex items-start justify-between gap-4 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{apt.employee_name}</span>
                          {getStatusBadge(apt.status)}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Building2 className="w-3 h-3" />
                            {apt.company_name}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {apt.start_time?.slice(0, 5)}
                          </span>
                          {apt.professional && (
                            <span className="flex items-center gap-1">
                              <UserCircle className="w-3 h-3" />
                              {apt.professional.name}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button variant="outline" size="sm">Editar</Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialog de Novo Agendamento */}
      <NovoAgendamentoDialog 
        open={isNovoDialogOpen} 
        onOpenChange={setIsNovoDialogOpen}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["homologacao-appointments"] });
          toast.success("Agendamento criado com sucesso!");
        }}
      />
    </div>
  );
}
