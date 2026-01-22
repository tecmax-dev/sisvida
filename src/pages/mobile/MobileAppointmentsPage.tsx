import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
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
import { ptBR } from "date-fns/locale";

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

export default function MobileAppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [dependentAppointments, setDependentAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("upcoming");
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    loadAppointments();
  }, []);

  const loadAppointments = async () => {
    try {
      const patientId = localStorage.getItem('mobile_patient_id');
      const clinicId = localStorage.getItem('mobile_clinic_id');

      if (!patientId || !clinicId) {
        navigate("/app/login");
        return;
      }

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
    const date = parseISO(apt.appointment_date);
    return (isFuture(date) || isToday(date)) && 
           !['cancelled', 'no_show', 'attended', 'completed'].includes(apt.status);
  }).sort((a, b) => new Date(a.appointment_date).getTime() - new Date(b.appointment_date).getTime());

  const historyAppointments = allAppointments.filter(apt => {
    const date = parseISO(apt.appointment_date);
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

  const canCancel = (appointment: Appointment) => {
    const date = parseISO(appointment.appointment_date);
    // Can cancel if it's a future appointment and status allows
    return isFuture(date) && ['scheduled', 'confirmed'].includes(appointment.status);
  };

  const canReschedule = (appointment: Appointment) => {
    const date = parseISO(appointment.appointment_date);
    // Can reschedule if it's at least 24h before
    const minDate = addDays(new Date(), 1);
    return date >= minDate && ['scheduled', 'confirmed'].includes(appointment.status);
  };

  const handleCancelAppointment = async () => {
    if (!selectedAppointment) return;
    
    setCancelling(true);
    try {
      const { error } = await supabase
        .from("appointments")
        .update({ 
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
          cancellation_reason: "Cancelado pelo paciente via app"
        })
        .eq("id", selectedAppointment.id);

      if (error) throw error;

      toast({
        title: "Agendamento cancelado",
        description: "Seu agendamento foi cancelado com sucesso.",
      });

      setShowCancelDialog(false);
      setSelectedAppointment(null);
      loadAppointments();
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

  const handleReschedule = () => {
    if (!selectedAppointment) return;
    // Navigate to booking page with reschedule info
    navigate("/app/agendar", { 
      state: { 
        rescheduleFrom: selectedAppointment.id,
        professionalId: selectedAppointment.professional.id,
        procedureId: selectedAppointment.procedure?.id,
      } 
    });
  };

  const renderAppointmentCard = (appointment: Appointment, showActions = true) => {
    const appointmentDate = parseISO(appointment.appointment_date);
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
            <div className="flex items-center gap-2">
              {getStatusBadge(appointment.status)}
              {showActions && (canCancel(appointment) || canReschedule(appointment)) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => {
                      setSelectedAppointment(appointment);
                      setShowDetails(true);
                    }}>
                      <Eye className="h-4 w-4 mr-2" />
                      Ver detalhes
                    </DropdownMenuItem>
                    {canReschedule(appointment) && (
                      <DropdownMenuItem onClick={() => {
                        setSelectedAppointment(appointment);
                        handleReschedule();
                      }}>
                        <CalendarClock className="h-4 w-4 mr-2" />
                        Remarcar
                      </DropdownMenuItem>
                    )}
                    {canCancel(appointment) && (
                      <DropdownMenuItem
                        className="text-red-600"
                        onClick={() => {
                          setSelectedAppointment(appointment);
                          setShowCancelDialog(true);
                        }}
                      >
                        <CalendarX className="h-4 w-4 mr-2" />
                        Cancelar
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
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
                {appointment.professional.name}
                {appointment.professional.specialty && ` • ${appointment.professional.specialty}`}
              </span>
            </div>
          </div>

          {/* Quick actions for upcoming appointments */}
          {isUpcoming && ['scheduled'].includes(appointment.status) && (
            <div className="mt-3 pt-3 border-t">
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Aguardando confirmação
              </p>
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
                  {format(parseISO(selectedAppointment.appointment_date), "dd/MM/yyyy", { locale: ptBR })} às {selectedAppointment.start_time.slice(0, 5)}
                </p>
              </div>

              <div>
                <span className="text-sm text-muted-foreground">Profissional</span>
                <p className="font-medium">
                  {selectedAppointment.professional.name}
                  {selectedAppointment.professional.specialty && (
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
            {selectedAppointment && canReschedule(selectedAppointment) && (
              <Button variant="outline" onClick={handleReschedule}>
                <CalendarClock className="h-4 w-4 mr-2" />
                Remarcar
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
                    {format(parseISO(selectedAppointment.appointment_date), "dd/MM/yyyy")} às {selectedAppointment.start_time.slice(0, 5)}
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
