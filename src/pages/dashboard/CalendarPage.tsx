import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCenter, pointerWithin } from "@dnd-kit/core";
import { sendWhatsAppMessage, formatAppointmentConfirmation, formatAppointmentReminder } from "@/lib/whatsapp";
import { ToastAction } from "@/components/ui/toast";
import { AppointmentPanel } from "@/components/appointments/AppointmentPanel";
import { DraggableAppointment } from "@/components/appointments/DraggableAppointment";
import { DroppableTimeSlot } from "@/components/appointments/DroppableTimeSlot";
import { DragOverlayContent } from "@/components/appointments/DragOverlayContent";
import { DragInstructions } from "@/components/appointments/DragInstructions";
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
  Filter,
  CalendarDays,
  LayoutGrid,
  Check,
  Search,
  Send,
  UserCheck,
  Stethoscope,
  Play,
  GripVertical,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { handleScheduleValidationError } from "@/lib/scheduleValidation";

const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const weekDaysFull = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

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
  scheduled: { icon: AlertCircle, color: "text-warning", bgColor: "bg-warning/10", label: "Agendado" },
  confirmed: { icon: CheckCircle2, color: "text-success", bgColor: "bg-success/10", label: "Confirmado" },
  in_progress: { icon: Clock, color: "text-info", bgColor: "bg-info/10", label: "Em atendimento" },
  completed: { icon: CheckCircle2, color: "text-muted-foreground", bgColor: "bg-muted", label: "Concluído" },
  cancelled: { icon: XCircle, color: "text-destructive", bgColor: "bg-destructive/10", label: "Cancelado" },
  no_show: { icon: XCircle, color: "text-destructive", bgColor: "bg-destructive/10", label: "Não compareceu" },
};

type ViewMode = "day" | "week" | "month";

interface Patient {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  birth_date?: string | null;
}

interface Professional {
  id: string;
  name: string;
  specialty: string | null;
}

interface Appointment {
  id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  type: string;
  status: string;
  notes: string | null;
  patient_id: string;
  professional_id: string;
  started_at: string | null;
  completed_at: string | null;
  duration_minutes: number | null;
  confirmation_token: string | null;
  procedure_id: string | null;
  procedure?: { id: string; name: string; price: number } | null;
  patient: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    birth_date: string | null;
  };
  professional: {
    id: string;
    name: string;
  };
}

export default function CalendarPage() {
  const { currentClinic, user } = useAuth();
  const { isProfessionalOnly } = usePermissions();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  
  // Filters and Search
  const [filterProfessional, setFilterProfessional] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  
  // WhatsApp state
  const [sendingWhatsApp, setSendingWhatsApp] = useState<string | null>(null);
  
  // Edit state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  
  // Cancel state
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancellingAppointment, setCancellingAppointment] = useState<Appointment | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  
  // Reschedule state (for drag-drop simulation)
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
  const [reschedulingAppointment, setReschedulingAppointment] = useState<Appointment | null>(null);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  
  // Appointment Panel state
  const [appointmentPanelOpen, setAppointmentPanelOpen] = useState(false);
  const [selectedAppointmentForPanel, setSelectedAppointmentForPanel] = useState<Appointment | null>(null);
  
  // Drag and Drop state
  const [activeAppointment, setActiveAppointment] = useState<Appointment | null>(null);
  
  // Form state
  const [formPatient, setFormPatient] = useState("");
  const [formProfessional, setFormProfessional] = useState("");
  const [formTime, setFormTime] = useState("");
  const [formType, setFormType] = useState("first_visit");
  const [formNotes, setFormNotes] = useState("");
  
  // Professional user state
  const [loggedInProfessionalId, setLoggedInProfessionalId] = useState<string | null>(null);

  useEffect(() => {
    if (currentClinic) {
      fetchData();
    }
  }, [currentClinic]);

  // Fetch logged-in professional's ID if user is a professional
  useEffect(() => {
    const fetchLoggedInProfessional = async () => {
      if (!isProfessionalOnly || !user?.id || !currentClinic?.id) return;
      
      const { data } = await supabase
        .from('professionals')
        .select('id')
        .eq('user_id', user.id)
        .eq('clinic_id', currentClinic.id)
        .maybeSingle();
      
      if (data) {
        setLoggedInProfessionalId(data.id);
        setFormProfessional(data.id);
      }
    };

    fetchLoggedInProfessional();
  }, [isProfessionalOnly, user?.id, currentClinic?.id]);

  useEffect(() => {
    if (currentClinic) {
      fetchAppointments();
    }
  }, [currentClinic, selectedDate, viewMode]);

  const fetchData = async () => {
    if (!currentClinic) return;
    
    try {
      const { data: patientsData } = await supabase
        .from('patients')
        .select('id, name, phone, email, birth_date')
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

  const getDateRange = () => {
    if (viewMode === "day") {
      const dateStr = selectedDate.toISOString().split('T')[0];
      return { startDate: dateStr, endDate: dateStr };
    } else if (viewMode === "week") {
      const start = new Date(selectedDate);
      start.setDate(start.getDate() - start.getDay());
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return { 
        startDate: start.toISOString().split('T')[0], 
        endDate: end.toISOString().split('T')[0] 
      };
    } else {
      const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      return { 
        startDate: start.toISOString().split('T')[0], 
        endDate: end.toISOString().split('T')[0] 
      };
    }
  };

  const fetchAppointments = async () => {
    if (!currentClinic) return;
    
    setLoading(true);
    
    try {
      const { startDate, endDate } = getDateRange();
      
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          id,
          appointment_date,
          start_time,
          end_time,
          type,
          status,
          notes,
          patient_id,
          professional_id,
          started_at,
          completed_at,
          duration_minutes,
          confirmation_token,
          procedure_id,
          procedure:procedures (id, name, price),
          patient:patients (id, name, phone, email, birth_date),
          professional:professionals (id, name)
        `)
        .eq('clinic_id', currentClinic.id)
        .gte('appointment_date', startDate)
        .lte('appointment_date', endDate)
        .order('appointment_date')
        .order('start_time');

      if (error) throw error;
      setAppointments(data as unknown as Appointment[]);
    } catch (error) {
      console.error("Error fetching appointments:", error);
    } finally {
      setLoading(false);
    }
  };

  // Filter and search appointments
  const filteredAppointments = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return appointments.filter(apt => {
      if (filterProfessional !== "all" && apt.professional_id !== filterProfessional) return false;
      if (filterType !== "all" && apt.type !== filterType) return false;
      if (query) {
        const patientName = apt.patient?.name?.toLowerCase() || "";
        const patient = patients.find(p => p.id === apt.patient_id);
        const patientPhone = patient?.phone?.toLowerCase() || "";
        if (!patientName.includes(query) && !patientPhone.includes(query)) return false;
      }
      return true;
    });
  }, [appointments, filterProfessional, filterType, searchQuery, patients]);

  // Status priority for sorting (active appointments first)
  const statusPriority: Record<string, number> = {
    'in_progress': 1,   // Em atendimento - máxima prioridade
    'scheduled': 2,     // Agendado
    'confirmed': 3,     // Confirmado
    'cancelled': 4,     // Cancelado - baixa prioridade
    'completed': 5,     // Concluído - baixa prioridade
    'no_show': 6,       // Não compareceu - baixa prioridade
  };

  // Get appointments for a specific date (sorted by status priority then by time)
  const getAppointmentsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return filteredAppointments
      .filter(apt => apt.appointment_date === dateStr)
      .sort((a, b) => {
        // First: sort by status priority
        const priorityA = statusPriority[a.status] || 99;
        const priorityB = statusPriority[b.status] || 99;
        
        if (priorityA !== priorityB) {
          return priorityA - priorityB;
        }
        
        // Second: sort by time (within same priority group)
        return a.start_time.localeCompare(b.start_time);
      });
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
      const { isScheduleError, message } = handleScheduleValidationError(error);
      toast({
        title: isScheduleError ? "Horário indisponível" : "Erro ao agendar",
        description: message,
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
      const { isScheduleError, message } = handleScheduleValidationError(error);
      toast({
        title: isScheduleError ? "Horário indisponível" : "Erro ao atualizar",
        description: message,
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

  const handleUpdateStatus = async (appointment: Appointment, newStatus: string) => {
    try {
      const updateData: Record<string, any> = {
        status: newStatus as "scheduled" | "confirmed" | "completed" | "cancelled" | "no_show",
      };

      if (newStatus === "confirmed") {
        updateData.confirmed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('appointments')
        .update(updateData)
        .eq('id', appointment.id);

      if (error) throw error;

      // Send WhatsApp confirmation when status is confirmed
      if (newStatus === "confirmed" && currentClinic) {
        const patient = patients.find(p => p.id === appointment.patient_id);
        const professional = professionals.find(p => p.id === appointment.professional_id);
        
        if (patient?.phone) {
          const formattedDate = new Date(appointment.appointment_date + 'T12:00:00').toLocaleDateString('pt-BR');
          const message = formatAppointmentConfirmation(
            patient.name,
            currentClinic.name,
            formattedDate,
            appointment.start_time,
            professional?.name
          );
          
          sendWhatsAppMessage({
            phone: patient.phone,
            message,
            clinicId: currentClinic.id,
            type: 'confirmation',
          }).then(result => {
            if (!result.success) {
              const isNotConnected = result.error?.includes("não está conectado") || 
                                     result.error?.includes("não configurado");
              toast({
                title: isNotConnected ? "WhatsApp não conectado" : "Erro ao enviar confirmação",
                description: isNotConnected 
                  ? "Configure o WhatsApp nas Configurações → Integração WhatsApp" 
                  : result.error,
                variant: "destructive",
                action: isNotConnected ? (
                  <ToastAction altText="Configurar" onClick={() => navigate("/dashboard/settings")}>
                    Configurar
                  </ToastAction>
                ) : undefined,
              });
            }
          }).catch(err => {
            console.error('Error sending WhatsApp confirmation:', err);
          });
        }
      }

      toast({
        title: "Status atualizado",
        description: `Agendamento marcado como ${statusConfig[newStatus as keyof typeof statusConfig]?.label || newStatus}.`,
      });

      fetchAppointments();
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar status",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleReschedule = async () => {
    if (!reschedulingAppointment || !newDate || !newTime) return;

    setSaving(true);

    try {
      const [hours, minutes] = newTime.split(':');
      const endHours = parseInt(hours) + (parseInt(minutes) + 30 >= 60 ? 1 : 0);
      const endMinutes = (parseInt(minutes) + 30) % 60;
      const endTime = `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;

      const { error } = await supabase
        .from('appointments')
        .update({
          appointment_date: newDate,
          start_time: newTime,
          end_time: endTime,
        })
        .eq('id', reschedulingAppointment.id);

      if (error) throw error;

      toast({
        title: "Agendamento reagendado",
        description: "A consulta foi reagendada com sucesso.",
      });

      setRescheduleDialogOpen(false);
      setReschedulingAppointment(null);
      setNewDate("");
      setNewTime("");
      fetchAppointments();
    } catch (error: any) {
      const { isScheduleError, message } = handleScheduleValidationError(error);
      toast({
        title: isScheduleError ? "Horário indisponível" : "Erro ao reagendar",
        description: message,
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

  const openRescheduleDialog = (appointment: Appointment) => {
    setReschedulingAppointment(appointment);
    setNewDate(appointment.appointment_date);
    setNewTime(appointment.start_time.slice(0, 5));
    setRescheduleDialogOpen(true);
  };

  const resetForm = () => {
    setFormPatient("");
    // Keep professional selection for logged-in professionals
    if (!loggedInProfessionalId) {
      setFormProfessional("");
    }
    setFormTime("");
    setFormType("first_visit");
    setFormNotes("");
  };

  const openAppointmentPanel = (appointment: Appointment) => {
    setSelectedAppointmentForPanel(appointment);
    setAppointmentPanelOpen(true);
  };

  // Drag and Drop handlers
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const appointment = active.data.current?.appointment;
    if (appointment) {
      setActiveAppointment(appointment);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveAppointment(null);

    if (!over) return;

    const appointment = active.data.current?.appointment as Appointment;
    if (!appointment) return;

    // Parse the drop target ID (format: "date_time")
    const overId = over.id as string;
    const [newDate, newTime] = overId.split('_');

    if (!newDate || !newTime) return;

    // Check if the appointment was dropped in its original position
    const originalDate = active.data.current?.originalDate;
    const originalTime = active.data.current?.originalTime;
    
    if (newDate === originalDate && newTime === originalTime) {
      return; // No change needed
    }

    // Check if the target slot is occupied
    const targetDateObj = new Date(newDate + 'T12:00:00');
    const targetAppointments = getAppointmentsForDate(targetDateObj);
    const isOccupied = targetAppointments.some(
      apt => apt.start_time.slice(0, 5) === newTime && apt.status !== 'cancelled' && apt.id !== appointment.id
    );

    if (isOccupied) {
      toast({
        title: "Horário ocupado",
        description: "Este horário já possui um agendamento. Escolha outro horário.",
        variant: "destructive",
      });
      return;
    }

    // Calculate end time based on duration (default 30 minutes)
    const duration = appointment.duration_minutes || 30;
    const [hours, minutes] = newTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + duration;
    const endHours = Math.floor(totalMinutes / 60);
    const endMinutes = totalMinutes % 60;
    const endTime = `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;

    // Store original values for undo
    const originalAppointmentDate = appointment.appointment_date;
    const originalStartTime = appointment.start_time;
    const originalEndTime = appointment.end_time;

    // Update in database
    try {
      const { error } = await supabase
        .from('appointments')
        .update({
          appointment_date: newDate,
          start_time: newTime,
          end_time: endTime,
        })
        .eq('id', appointment.id);

      if (error) throw error;

      const formattedOldDate = new Date(originalAppointmentDate + 'T12:00:00').toLocaleDateString('pt-BR');
      const formattedNewDate = new Date(newDate + 'T12:00:00').toLocaleDateString('pt-BR');

      toast({
        title: "✓ Agendamento reagendado",
        description: `${appointment.patient?.name || 'Paciente'}: ${formattedOldDate} ${originalStartTime.slice(0, 5)} → ${formattedNewDate} ${newTime}`,
        action: (
          <ToastAction 
            altText="Desfazer" 
            onClick={async () => {
              try {
                await supabase
                  .from('appointments')
                  .update({
                    appointment_date: originalAppointmentDate,
                    start_time: originalStartTime,
                    end_time: originalEndTime,
                  })
                  .eq('id', appointment.id);
                
                toast({
                  title: "Reagendamento desfeito",
                  description: `Voltou para ${formattedOldDate} às ${originalStartTime.slice(0, 5)}`,
                });
                
                fetchAppointments();
              } catch (undoError) {
                toast({
                  title: "Erro ao desfazer",
                  description: "Não foi possível desfazer o reagendamento.",
                  variant: "destructive",
                });
              }
            }}
          >
            Desfazer
          </ToastAction>
        ),
      });

      fetchAppointments();
    } catch (error: any) {
      const { isScheduleError, message } = handleScheduleValidationError(error);
      toast({
        title: isScheduleError ? "Horário indisponível" : "Erro ao reagendar",
        description: message,
        variant: "destructive",
      });
    }
  };

  const handleDragCancel = () => {
    setActiveAppointment(null);
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
      days.push({ day: prevMonthLastDay - i, isCurrentMonth: false, date: new Date(year, month - 1, prevMonthLastDay - i) });
    }
    
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ day: i, isCurrentMonth: true, date: new Date(year, month, i) });
    }
    
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push({ day: i, isCurrentMonth: false, date: new Date(year, month + 1, i) });
    }
    
    return days;
  };

  const getWeekDays = () => {
    const start = new Date(selectedDate);
    start.setDate(start.getDate() - start.getDay());
    const days = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const navigateMonth = (direction: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + direction, 1));
  };

  const navigateWeek = (direction: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + (direction * 7));
    setSelectedDate(newDate);
    setCurrentDate(newDate);
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const isSelected = (date: Date) => {
    return (
      date.getDate() === selectedDate.getDate() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getFullYear() === selectedDate.getFullYear()
    );
  };

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    if (viewMode === "month") {
      setViewMode("day");
    }
  };

  const typeLabels: Record<string, string> = {
    first_visit: "Primeira Consulta",
    return: "Retorno",
    exam: "Exame",
    procedure: "Procedimento",
  };

  const hasActiveFilters = filterProfessional !== "all" || filterType !== "all" || searchQuery.trim() !== "";

  const handleSendWhatsAppReminder = async (appointment: Appointment) => {
    const patient = patients.find(p => p.id === appointment.patient_id);
    if (!patient?.phone) {
      toast({
        title: "Erro",
        description: "Paciente não possui telefone cadastrado.",
        variant: "destructive",
      });
      return;
    }

    setSendingWhatsApp(appointment.id);

    try {
      const appointmentDate = new Date(appointment.appointment_date + 'T12:00:00');
      const formattedDate = appointmentDate.toLocaleDateString('pt-BR', { 
        weekday: 'long', 
        day: 'numeric', 
        month: 'long' 
      });
      
      // Build confirmation link
      const baseUrl = window.location.origin;
      const confirmationLink = appointment.confirmation_token 
        ? `${baseUrl}/consulta/${appointment.confirmation_token}`
        : undefined;
      
      const message = formatAppointmentReminder(
        patient.name,
        currentClinic?.name || 'Clínica',
        formattedDate,
        appointment.start_time.slice(0, 5),
        appointment.professional?.name || 'Profissional',
        confirmationLink
      );

      const { data, error } = await supabase.functions.invoke('send-whatsapp', {
        body: { phone: patient.phone, message, clinicId: currentClinic?.id },
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Lembrete enviado",
          description: `Mensagem enviada para ${patient.name}.`,
        });
      } else {
        throw new Error(data?.error || 'Erro ao enviar mensagem');
      }
    } catch (error: any) {
      const errorMessage = error.message || "";
      const isNotConnected = errorMessage.includes("não está conectado") || 
                             errorMessage.includes("não configurado") ||
                             errorMessage.includes("Edge Function returned a non-2xx");
      
      toast({
        title: isNotConnected ? "WhatsApp não conectado" : "Erro ao enviar WhatsApp",
        description: isNotConnected 
          ? "Configure e conecte o WhatsApp nas Configurações → Integração WhatsApp" 
          : (errorMessage || "Tente novamente."),
        variant: "destructive",
        action: isNotConnected ? (
          <ToastAction altText="Ir para configurações" onClick={() => navigate("/dashboard/settings")}>
            Configurar
          </ToastAction>
        ) : undefined,
      });
    } finally {
      setSendingWhatsApp(null);
    }
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
        <Select 
          value={formProfessional} 
          onValueChange={setFormProfessional}
          disabled={!!loggedInProfessionalId}
        >
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
        {loggedInProfessionalId && (
          <p className="text-xs text-muted-foreground">
            Seu perfil de profissional está selecionado automaticamente
          </p>
        )}
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

  const AppointmentCard = ({ appointment }: { appointment: Appointment }) => {
    const status = statusConfig[appointment.status as keyof typeof statusConfig] || statusConfig.scheduled;
    const StatusIcon = status.icon;
    const isCancelled = appointment.status === "cancelled";
    const isCompleted = appointment.status === "completed";
    const isInProgress = appointment.status === "in_progress";
    const canModify = !isCancelled && !isCompleted;
    const canAttend = appointment.status === "scheduled" || appointment.status === "confirmed" || isInProgress;
    
    return (
      <div
        className={cn(
          "flex items-center gap-4 p-4 rounded-xl border border-border hover:border-primary/30 hover:bg-muted/50 transition-all group",
          isCancelled && "opacity-60",
          isInProgress && "border-info bg-info/5"
        )}
      >
        <div className={cn(
          "w-20 text-center py-2 rounded-lg",
          isInProgress ? "bg-info/20" : "bg-primary/10"
        )}>
          <span className={cn(
            "text-sm font-semibold",
            isInProgress ? "text-info" : "text-primary"
          )}>
            {appointment.start_time.slice(0, 5)}
          </span>
          {isInProgress && (
            <div className="text-xs text-info mt-0.5 flex items-center justify-center gap-1">
              <Play className="h-3 w-3" />
              Em atend.
            </div>
          )}
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
        
        {/* Attend button */}
        {canAttend && (
          <Button
            variant={isInProgress ? "default" : "outline"}
            size="sm"
            onClick={() => openAppointmentPanel(appointment)}
            className={cn(
              "gap-1.5",
              isInProgress && "bg-info hover:bg-info/90"
            )}
          >
            <Stethoscope className="h-4 w-4" />
            {isInProgress ? "Continuar" : "Atender"}
          </Button>
        )}
        
        {/* Status dropdown */}
        {canModify ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className={cn("gap-2", status.color)}>
                <StatusIcon className="h-4 w-4" />
                {status.label}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover">
              <DropdownMenuItem onClick={() => handleUpdateStatus(appointment, "confirmed")}>
                <CheckCircle2 className="h-4 w-4 mr-2 text-success" />
                Confirmar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleUpdateStatus(appointment, "completed")}>
                <Check className="h-4 w-4 mr-2 text-info" />
                Concluir
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleUpdateStatus(appointment, "no_show")}>
                <XCircle className="h-4 w-4 mr-2 text-destructive" />
                Não compareceu
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="flex items-center gap-2">
            <StatusIcon className={`h-4 w-4 ${status.color}`} />
            <span className={`text-sm ${status.color}`}>
              {status.label}
            </span>
          </div>
        )}
        
        {/* Actions */}
        {canModify && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-success hover:text-success"
              onClick={() => handleSendWhatsAppReminder(appointment)}
              disabled={sendingWhatsApp === appointment.id}
              title="Enviar lembrete WhatsApp"
            >
              {sendingWhatsApp === appointment.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => openRescheduleDialog(appointment)}
              title="Reagendar"
            >
              <CalendarDays className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => openEditDialog(appointment)}
              title="Editar"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => openCancelDialog(appointment)}
              title="Cancelar"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    );
  };

  const WeekView = () => {
    const weekDaysData = getWeekDays();

    return (
      <div className="grid grid-cols-7 gap-2">
        {weekDaysData.map((date, i) => {
          const dayAppointments = getAppointmentsForDate(date);
          const isTodayDate = isToday(date);
          const isSelectedDate = isSelected(date);
          const dateStr = date.toISOString().split('T')[0];

          return (
            <div key={i} className="min-h-[300px]">
              <button
                onClick={() => handleDayClick(date)}
                className={cn(
                  "w-full p-2 rounded-lg text-center mb-2 transition-colors",
                  isTodayDate && "bg-primary/10",
                  isSelectedDate && "bg-primary text-primary-foreground"
                )}
              >
                <div className="text-xs text-muted-foreground">{weekDaysFull[i]}</div>
                <div className="text-lg font-semibold">{date.getDate()}</div>
              </button>
              
              {/* Droppable zone for the entire day */}
              <DroppableTimeSlot 
                date={dateStr} 
                time="08:00" 
                showTime={false}
                isOccupied={dayAppointments.length >= 8}
                className="space-y-1 min-h-[200px] p-1"
              >
                {dayAppointments.slice(0, 4).map((apt) => {
                  const status = statusConfig[apt.status as keyof typeof statusConfig] || statusConfig.scheduled;
                  const canDrag = apt.status !== "cancelled" && apt.status !== "completed" && apt.status !== "no_show" && apt.status !== "in_progress";
                  
                  return (
                    <DraggableAppointment key={apt.id} appointment={apt}>
                      <div
                        onClick={() => canDrag ? openRescheduleDialog(apt) : undefined}
                        className={cn(
                          "p-2 rounded-lg text-xs transition-opacity",
                          canDrag && "cursor-pointer hover:opacity-80",
                          status.bgColor,
                          apt.status === "cancelled" && "opacity-50"
                        )}
                      >
                        <div className="font-medium truncate">{apt.start_time.slice(0, 5)}</div>
                        <div className="truncate text-muted-foreground">{apt.patient?.name}</div>
                      </div>
                    </DraggableAppointment>
                  );
                })}
                {dayAppointments.length > 4 && (
                  <div className="text-xs text-center text-muted-foreground">
                    +{dayAppointments.length - 4} mais
                  </div>
                )}
              </DroppableTimeSlot>
            </div>
          );
        })}
      </div>
    );
  };

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
            const dateStr = item.date.toISOString().split('T')[0];
            const isOccupied = dayAppointments.filter(a => a.status !== 'cancelled').length >= 10;
            
            return (
              <DroppableTimeSlot
                key={i}
                date={dateStr}
                time="08:00"
                showTime={false}
                isOccupied={isOccupied}
                disabled={!item.isCurrentMonth}
                className="p-0"
              >
                <button
                  onClick={() => handleDayClick(item.date)}
                  className={cn(
                    "w-full aspect-square p-1 flex flex-col items-center justify-start text-sm rounded-lg transition-colors relative",
                    item.isCurrentMonth
                      ? "text-foreground hover:bg-muted"
                      : "text-muted-foreground/40",
                    isTodayDate && "bg-primary/10 text-primary font-semibold"
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
                            apt.status === "confirmed" ? "bg-success" :
                            apt.status === "completed" ? "bg-info" : "bg-warning"
                          )}
                        />
                      ))}
                      {dayAppointments.length > 3 && (
                        <span className="text-[8px] text-muted-foreground">+{dayAppointments.length - 3}</span>
                      )}
                    </div>
                  )}
                </button>
              </DroppableTimeSlot>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <DndContext
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
      collisionDetection={pointerWithin}
    >
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Agenda</h1>
          <p className="text-muted-foreground">
            Gerencie os agendamentos da clínica
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
            <TabsList>
              <TabsTrigger value="day" className="gap-1">
                <CalendarIcon className="h-4 w-4" />
                Dia
              </TabsTrigger>
              <TabsTrigger value="week" className="gap-1">
                <CalendarDays className="h-4 w-4" />
                Semana
              </TabsTrigger>
              <TabsTrigger value="month" className="gap-1">
                <LayoutGrid className="h-4 w-4" />
                Mês
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar paciente por nome ou telefone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-64"
            />
          </div>

          {/* Filters */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" className="relative">
                <Filter className="h-4 w-4" />
                {hasActiveFilters && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full" />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72" align="end">
              <div className="space-y-4">
                <h4 className="font-medium">Filtros</h4>
                <div className="space-y-2">
                  <Label>Profissional</Label>
                  <Select value={filterProfessional} onValueChange={setFilterProfessional}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {professionals.map((prof) => (
                        <SelectItem key={prof.id} value={prof.id}>
                          {prof.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tipo de Consulta</Label>
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {appointmentTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      setFilterProfessional("all");
                      setFilterType("all");
                      setSearchQuery("");
                    }}
                  >
                    Limpar filtros
                  </Button>
                )}
              </div>
            </PopoverContent>
          </Popover>

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
      </div>

      {/* Active Filters */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Filtros ativos:</span>
          {searchQuery.trim() && (
            <Badge variant="secondary" className="gap-1">
              <Search className="h-3 w-3" />
              "{searchQuery}"
              <button onClick={() => setSearchQuery("")} className="ml-1 hover:text-foreground">×</button>
            </Badge>
          )}
          {filterProfessional !== "all" && (
            <Badge variant="secondary" className="gap-1">
              <UserCheck className="h-3 w-3" />
              {professionals.find(p => p.id === filterProfessional)?.name}
              <button onClick={() => setFilterProfessional("all")} className="ml-1 hover:text-foreground">×</button>
            </Badge>
          )}
          {filterType !== "all" && (
            <Badge variant="secondary" className="gap-1">
              {typeLabels[filterType]}
              <button onClick={() => setFilterType("all")} className="ml-1 hover:text-foreground">×</button>
            </Badge>
          )}
        </div>
      )}

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

      {/* Reschedule Dialog */}
      <Dialog open={rescheduleDialogOpen} onOpenChange={(open) => {
        setRescheduleDialogOpen(open);
        if (!open) {
          setReschedulingAppointment(null);
          setNewDate("");
          setNewTime("");
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reagendar Consulta</DialogTitle>
            <DialogDescription>
              Selecione a nova data e horário para a consulta
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {reschedulingAppointment && (
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="font-medium">{reschedulingAppointment.patient?.name}</p>
                <p className="text-sm text-muted-foreground">
                  {typeLabels[reschedulingAppointment.type]} com {reschedulingAppointment.professional?.name}
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Nova Data</Label>
              <Input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Novo Horário</Label>
              <Select value={newTime} onValueChange={setNewTime}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o horário" />
                </SelectTrigger>
                <SelectContent>
                  {timeSlots.map((time) => (
                    <SelectItem key={time} value={time}>
                      {time}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRescheduleDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button onClick={handleReschedule} disabled={saving || !newDate || !newTime}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Reagendar
              </Button>
            </div>
          </div>
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

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Mini Calendar (only in day view) */}
        {viewMode === "day" && (
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
                {getDaysInMonth(currentDate).map((item, i) => {
                  const dateStr = item.date.toISOString().split('T')[0];
                  return (
                    <DroppableTimeSlot
                      key={i}
                      date={dateStr}
                      time="08:00"
                      showTime={false}
                      className="p-0"
                    >
                      <button
                        onClick={() => handleDayClick(item.date)}
                        className={cn(
                          "w-full aspect-square flex items-center justify-center text-sm rounded-lg transition-colors",
                          item.isCurrentMonth
                            ? "text-foreground hover:bg-muted"
                            : "text-muted-foreground/40",
                          isToday(item.date) &&
                            "bg-primary/10 text-primary font-semibold",
                          isSelected(item.date) &&
                            "bg-primary text-primary-foreground font-semibold"
                        )}
                      >
                        {item.day}
                      </button>
                    </DroppableTimeSlot>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Appointments List / Week View / Month View */}
        <Card className={viewMode === "day" ? "lg:col-span-2" : "lg:col-span-3"}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                {viewMode === "day" && `Agendamentos - ${selectedDate.toLocaleDateString("pt-BR", { 
                  weekday: "long",
                  day: "numeric",
                  month: "long"
                })}`}
                {viewMode === "week" && `Semana de ${getWeekDays()[0].toLocaleDateString("pt-BR", { day: "numeric", month: "short" })} - ${getWeekDays()[6].toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}`}
                {viewMode === "month" && `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`}
              </CardTitle>
              {(viewMode === "week" || viewMode === "month") && (
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => viewMode === "week" ? navigateWeek(-1) : navigateMonth(-1)}
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
                    onClick={() => viewMode === "week" ? navigateWeek(1) : navigateMonth(1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                Carregando agendamentos...
              </div>
            ) : viewMode === "day" ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Time slots for dropping */}
                <div className="lg:col-span-1 space-y-1 p-2 rounded-lg border border-dashed border-border/50 bg-muted/20">
                  <p className="text-xs text-muted-foreground font-medium mb-2 text-center">
                    Arraste para reagendar
                  </p>
                  <div className="grid grid-cols-3 gap-1">
                    {timeSlots.map((time) => {
                      const dateStr = selectedDate.toISOString().split('T')[0];
                      const hasAppointment = getAppointmentsForDate(selectedDate).some(
                        apt => apt.start_time.slice(0, 5) === time && apt.status !== 'cancelled'
                      );
                      return (
                        <DroppableTimeSlot
                          key={time}
                          date={dateStr}
                          time={time}
                          disabled={hasAppointment}
                          isOccupied={hasAppointment}
                          className={cn(
                            "p-2 text-center rounded-md border border-transparent",
                            hasAppointment 
                              ? "bg-muted/50 text-muted-foreground/50" 
                              : "bg-background hover:border-primary/20"
                          )}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Appointments list */}
                <div className="lg:col-span-2">
                  {getAppointmentsForDate(selectedDate).length > 0 ? (
                    <div className="space-y-3">
                      {getAppointmentsForDate(selectedDate).map((appointment) => (
                        <DraggableAppointment key={appointment.id} appointment={appointment}>
                          <AppointmentCard appointment={appointment} />
                        </DraggableAppointment>
                      ))}
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
                </div>
              </div>
            ) : viewMode === "week" ? (
              <WeekView />
            ) : (
              <MonthView />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Appointment Panel */}
      {selectedAppointmentForPanel && currentClinic && (
        <AppointmentPanel
          isOpen={appointmentPanelOpen}
          appointment={{
            ...selectedAppointmentForPanel,
            patient: selectedAppointmentForPanel.patient as {
              id: string;
              name: string;
              phone: string;
              email: string | null;
              birth_date: string | null;
            }
          }}
          professionalId={selectedAppointmentForPanel.professional_id}
          clinicId={currentClinic.id}
          onClose={() => {
            setAppointmentPanelOpen(false);
            setSelectedAppointmentForPanel(null);
          }}
          onUpdate={fetchAppointments}
        />
      )}

      {/* Drag Instructions */}
      <DragInstructions 
        isVisible={!!activeAppointment} 
        patientName={activeAppointment?.patient?.name}
      />

      {/* Drag Overlay */}
      <DragOverlay>
        {activeAppointment && (
          <DragOverlayContent appointment={activeAppointment} />
        )}
      </DragOverlay>
    </div>
    </DndContext>
  );
}
