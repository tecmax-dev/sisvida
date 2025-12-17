import { useState, useEffect } from "react";
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus,
  Clock,
  User,
  Loader2,
  Calendar as CalendarIcon,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Pencil,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const monthNames = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const appointmentTypes = [
  { value: "first_visit", label: "Primeira Consulta" },
  { value: "return", label: "Retorno" },
  { value: "exam", label: "Exame" },
  { value: "procedure", label: "Procedimento" },
];

const timeSlots = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
  "11:00", "11:30", "12:00", "12:30", "13:00", "13:30",
  "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
  "17:00", "17:30", "18:00"
];

const statusConfig = {
  scheduled: { icon: AlertCircle, color: "text-warning", label: "Agendado" },
  confirmed: { icon: CheckCircle2, color: "text-success", label: "Confirmado" },
  completed: { icon: CheckCircle2, color: "text-info", label: "Concluído" },
  cancelled: { icon: XCircle, color: "text-destructive", label: "Cancelado" },
  no_show: { icon: XCircle, color: "text-destructive", label: "Não compareceu" },
};

interface Patient {
  id: string;
  name: string;
  phone: string;
}

interface Professional {
  id: string;
  name: string;
  specialty: string | null;
}

interface Appointment {
  id: string;
  start_time: string;
  end_time: string;
  type: string;
  status: string;
  notes: string | null;
  patient_id: string;
  professional_id: string;
  patient: {
    name: string;
  };
  professional: {
    name: string;
  };
}

export default function CalendarPage() {
  const { currentClinic, user } = useAuth();
  const { toast } = useToast();
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Edit state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  
  // Cancel state
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancellingAppointment, setCancellingAppointment] = useState<Appointment | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  
  // Form state
  const [formPatient, setFormPatient] = useState("");
  const [formProfessional, setFormProfessional] = useState("");
  const [formTime, setFormTime] = useState("");
  const [formType, setFormType] = useState("first_visit");
  const [formNotes, setFormNotes] = useState("");

  useEffect(() => {
    if (currentClinic) {
      fetchData();
    }
  }, [currentClinic]);

  useEffect(() => {
    if (currentClinic) {
      fetchAppointments();
    }
  }, [currentClinic, selectedDate]);

  const fetchData = async () => {
    if (!currentClinic) return;
    
    try {
      const { data: patientsData } = await supabase
        .from('patients')
        .select('id, name, phone')
        .eq('clinic_id', currentClinic.id)
        .order('name');
      
      if (patientsData) setPatients(patientsData);

      const { data: professionalsData } = await supabase
        .from('professionals')
        .select('id, name, specialty')
        .eq('clinic_id', currentClinic.id)
        .eq('is_active', true)
        .order('name');
      
      if (professionalsData) setProfessionals(professionalsData);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  const fetchAppointments = async () => {
    if (!currentClinic) return;
    
    setLoading(true);
    
    try {
      const dateStr = selectedDate.toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          id,
          start_time,
          end_time,
          type,
          status,
          notes,
          patient_id,
          professional_id,
          patient:patients (name),
          professional:professionals (name)
        `)
        .eq('clinic_id', currentClinic.id)
        .eq('appointment_date', dateStr)
        .order('start_time');

      if (error) throw error;
      setAppointments(data as unknown as Appointment[]);
    } catch (error) {
      console.error("Error fetching appointments:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formPatient || !formProfessional || !formTime) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    if (!currentClinic || !user) return;

    setSaving(true);

    try {
      const dateStr = selectedDate.toISOString().split('T')[0];
      const [hours, minutes] = formTime.split(':');
      const endHours = parseInt(hours) + (parseInt(minutes) + 30 >= 60 ? 1 : 0);
      const endMinutes = (parseInt(minutes) + 30) % 60;
      const endTime = `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;

      const { error } = await supabase
        .from('appointments')
        .insert({
          clinic_id: currentClinic.id,
          patient_id: formPatient,
          professional_id: formProfessional,
          appointment_date: dateStr,
          start_time: formTime,
          end_time: endTime,
          type: formType as "first_visit" | "return" | "exam" | "procedure",
          status: "scheduled" as const,
          notes: formNotes.trim() || null,
          created_by: user.id,
        });

      if (error) throw error;

      toast({
        title: "Agendamento criado",
        description: "A consulta foi agendada com sucesso.",
      });

      setDialogOpen(false);
      resetForm();
      fetchAppointments();
    } catch (error: any) {
      toast({
        title: "Erro ao agendar",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEditAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formPatient || !formProfessional || !formTime || !editingAppointment) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    try {
      const [hours, minutes] = formTime.split(':');
      const endHours = parseInt(hours) + (parseInt(minutes) + 30 >= 60 ? 1 : 0);
      const endMinutes = (parseInt(minutes) + 30) % 60;
      const endTime = `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;

      const { error } = await supabase
        .from('appointments')
        .update({
          patient_id: formPatient,
          professional_id: formProfessional,
          start_time: formTime,
          end_time: endTime,
          type: formType as "first_visit" | "return" | "exam" | "procedure",
          notes: formNotes.trim() || null,
        })
        .eq('id', editingAppointment.id);

      if (error) throw error;

      toast({
        title: "Agendamento atualizado",
        description: "As alterações foram salvas com sucesso.",
      });

      setEditDialogOpen(false);
      setEditingAppointment(null);
      resetForm();
      fetchAppointments();
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCancelAppointment = async () => {
    if (!cancellingAppointment) return;

    setSaving(true);

    try {
      const { error } = await supabase
        .from('appointments')
        .update({
          status: "cancelled" as const,
          cancellation_reason: cancelReason.trim() || null,
          cancelled_at: new Date().toISOString(),
        })
        .eq('id', cancellingAppointment.id);

      if (error) throw error;

      toast({
        title: "Agendamento cancelado",
        description: "A consulta foi cancelada com sucesso.",
      });

      setCancelDialogOpen(false);
      setCancellingAppointment(null);
      setCancelReason("");
      fetchAppointments();
    } catch (error: any) {
      toast({
        title: "Erro ao cancelar",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const openEditDialog = (appointment: Appointment) => {
    setEditingAppointment(appointment);
    setFormPatient(appointment.patient_id);
    setFormProfessional(appointment.professional_id);
    setFormTime(appointment.start_time.slice(0, 5));
    setFormType(appointment.type);
    setFormNotes(appointment.notes || "");
    setEditDialogOpen(true);
  };

  const openCancelDialog = (appointment: Appointment) => {
    setCancellingAppointment(appointment);
    setCancelReason("");
    setCancelDialogOpen(true);
  };

  const resetForm = () => {
    setFormPatient("");
    setFormProfessional("");
    setFormTime("");
    setFormType("first_visit");
    setFormNotes("");
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();
    
    const days = [];
    
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDay - 1; i >= 0; i--) {
      days.push({ day: prevMonthLastDay - i, isCurrentMonth: false });
    }
    
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ day: i, isCurrentMonth: true });
    }
    
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push({ day: i, isCurrentMonth: false });
    }
    
    return days;
  };

  const navigateMonth = (direction: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + direction, 1));
  };

  const isToday = (day: number, isCurrentMonth: boolean) => {
    const today = new Date();
    return (
      isCurrentMonth &&
      day === today.getDate() &&
      currentDate.getMonth() === today.getMonth() &&
      currentDate.getFullYear() === today.getFullYear()
    );
  };

  const isSelected = (day: number, isCurrentMonth: boolean) => {
    return (
      isCurrentMonth &&
      day === selectedDate.getDate() &&
      currentDate.getMonth() === selectedDate.getMonth() &&
      currentDate.getFullYear() === selectedDate.getFullYear()
    );
  };

  const handleDayClick = (day: number, isCurrentMonth: boolean) => {
    if (isCurrentMonth) {
      setSelectedDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), day));
    }
  };

  const typeLabels: Record<string, string> = {
    first_visit: "Primeira Consulta",
    return: "Retorno",
    exam: "Exame",
    procedure: "Procedimento",
  };

  const AppointmentFormFields = () => (
    <>
      <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10">
        <CalendarIcon className="h-5 w-5 text-primary" />
        <span className="font-medium text-foreground">
          {selectedDate.toLocaleDateString("pt-BR", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </span>
      </div>

      <div className="space-y-2">
        <Label>Paciente *</Label>
        <Select value={formPatient} onValueChange={setFormPatient}>
          <SelectTrigger className="bg-background">
            <SelectValue placeholder="Selecione o paciente" />
          </SelectTrigger>
          <SelectContent className="bg-popover border border-border shadow-lg z-50">
            {patients.length > 0 ? (
              patients.map((patient) => (
                <SelectItem key={patient.id} value={patient.id}>
                  {patient.name}
                </SelectItem>
              ))
            ) : (
              <div className="p-2 text-sm text-muted-foreground text-center">
                Nenhum paciente cadastrado
              </div>
            )}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Profissional *</Label>
        <Select value={formProfessional} onValueChange={setFormProfessional}>
          <SelectTrigger className="bg-background">
            <SelectValue placeholder="Selecione o profissional" />
          </SelectTrigger>
          <SelectContent className="bg-popover border border-border shadow-lg z-50">
            {professionals.length > 0 ? (
              professionals.map((prof) => (
                <SelectItem key={prof.id} value={prof.id}>
                  {prof.name} {prof.specialty && `- ${prof.specialty}`}
                </SelectItem>
              ))
            ) : (
              <div className="p-2 text-sm text-muted-foreground text-center">
                Nenhum profissional cadastrado
              </div>
            )}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Horário *</Label>
        <Select value={formTime} onValueChange={setFormTime}>
          <SelectTrigger className="bg-background">
            <SelectValue placeholder="Selecione o horário" />
          </SelectTrigger>
          <SelectContent className="bg-popover border border-border shadow-lg z-50 max-h-60">
            {timeSlots.map((time) => (
              <SelectItem key={time} value={time}>
                {time}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Tipo de Consulta</Label>
        <Select value={formType} onValueChange={setFormType}>
          <SelectTrigger className="bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-popover border border-border shadow-lg z-50">
            {appointmentTypes.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Observações</Label>
        <Input
          value={formNotes}
          onChange={(e) => setFormNotes(e.target.value)}
          placeholder="Anotações sobre o agendamento (opcional)"
        />
      </div>
    </>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Agenda</h1>
          <p className="text-muted-foreground">
            Gerencie os agendamentos da clínica
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button variant="hero">
              <Plus className="h-4 w-4 mr-2" />
              Novo Agendamento
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Novo Agendamento</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateAppointment} className="space-y-4">
              <AppointmentFormFields />
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Agendar
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={(open) => {
        setEditDialogOpen(open);
        if (!open) {
          setEditingAppointment(null);
          resetForm();
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Agendamento</DialogTitle>
            <DialogDescription>
              Altere as informações do agendamento
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditAppointment} className="space-y-4">
            <AppointmentFormFields />
            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Alterações
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Agendamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar este agendamento? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="cancel-reason">Motivo do cancelamento (opcional)</Label>
            <Textarea
              id="cancel-reason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Informe o motivo do cancelamento..."
              className="mt-2"
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setCancellingAppointment(null);
              setCancelReason("");
            }}>
              Voltar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelAppointment}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={saving}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar Cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
              </CardTitle>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => navigateMonth(-1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => navigateMonth(1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-7 gap-1 text-center text-xs mb-2">
              {weekDays.map((day) => (
                <div key={day} className="py-2 text-muted-foreground font-medium">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {getDaysInMonth(currentDate).map((item, i) => (
                <button
                  key={i}
                  onClick={() => handleDayClick(item.day, item.isCurrentMonth)}
                  className={cn(
                    "aspect-square flex items-center justify-center text-sm rounded-lg transition-colors",
                    item.isCurrentMonth
                      ? "text-foreground hover:bg-muted"
                      : "text-muted-foreground/40",
                    isToday(item.day, item.isCurrentMonth) &&
                      "bg-primary/10 text-primary font-semibold",
                    isSelected(item.day, item.isCurrentMonth) &&
                      "bg-primary text-primary-foreground font-semibold"
                  )}
                >
                  {item.day}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Appointments List */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">
              Agendamentos - {selectedDate.toLocaleDateString("pt-BR", { 
                weekday: "long",
                day: "numeric",
                month: "long"
              })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                Carregando agendamentos...
              </div>
            ) : appointments.length > 0 ? (
              <div className="space-y-3">
                {appointments.map((appointment) => {
                  const status = statusConfig[appointment.status as keyof typeof statusConfig] || statusConfig.scheduled;
                  const StatusIcon = status.icon;
                  const isCancelled = appointment.status === "cancelled";
                  const isCompleted = appointment.status === "completed";
                  const canModify = !isCancelled && !isCompleted;
                  
                  return (
                    <div
                      key={appointment.id}
                      className={cn(
                        "flex items-center gap-4 p-4 rounded-xl border border-border hover:border-primary/30 hover:bg-muted/50 transition-all group",
                        isCancelled && "opacity-60"
                      )}
                    >
                      <div className="w-20 text-center py-2 rounded-lg bg-primary/10">
                        <span className="text-sm font-semibold text-primary">
                          {appointment.start_time.slice(0, 5)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground">
                          {appointment.patient?.name || "Paciente"}
                        </p>
                        <div className="flex items-center gap-4 mt-1">
                          <span className="text-sm text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {typeLabels[appointment.type] || appointment.type}
                          </span>
                          <span className="text-sm text-muted-foreground flex items-center gap-1">
                            <User className="h-3.5 w-3.5" />
                            {appointment.professional?.name || "Profissional"}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusIcon className={`h-4 w-4 ${status.color}`} />
                        <span className={`text-sm ${status.color}`}>
                          {status.label}
                        </span>
                      </div>
                      {canModify && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditDialog(appointment)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => openCancelDialog(appointment)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <CalendarIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="mb-4">Nenhum agendamento para este dia</p>
                <Button variant="outline" onClick={() => setDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar agendamento
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}