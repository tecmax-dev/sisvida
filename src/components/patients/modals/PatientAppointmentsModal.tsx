import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Calendar, Clock, User, FileText, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { format, parseISO, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2 } from "lucide-react";

interface Appointment {
  id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: string;
  type: string;
  notes: string | null;
  professional: {
    id: string;
    name: string;
  } | null;
  procedure: {
    id: string;
    name: string;
  } | null;
}

interface PatientAppointmentsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  patientName: string;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  scheduled: { label: "Agendado", variant: "default" },
  confirmed: { label: "Confirmado", variant: "secondary" },
  in_progress: { label: "Em Atendimento", variant: "default" },
  completed: { label: "Concluído", variant: "outline" },
  cancelled: { label: "Cancelado", variant: "destructive" },
  no_show: { label: "Não Compareceu", variant: "destructive" },
};

const typeLabels: Record<string, string> = {
  first_visit: "Primeira Consulta",
  follow_up: "Retorno",
  procedure: "Procedimento",
  emergency: "Emergência",
  telemedicine: "Telemedicina",
};

export function PatientAppointmentsModal({
  open,
  onOpenChange,
  patientId,
  patientName,
}: PatientAppointmentsModalProps) {
  const { currentClinic } = useAuth();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open && patientId && currentClinic?.id) {
      fetchAppointments();
    }
  }, [open, patientId, currentClinic?.id]);

  const fetchAppointments = async () => {
    if (!currentClinic?.id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("appointments")
        .select(`
          id,
          appointment_date,
          start_time,
          end_time,
          status,
          type,
          notes,
          professional:professionals(id, name),
          procedure:procedures(id, name)
        `)
        .eq("patient_id", patientId)
        .eq("clinic_id", currentClinic.id)
        .order("appointment_date", { ascending: false })
        .order("start_time", { ascending: false });

      if (error) throw error;
      setAppointments(data || []);
    } catch (error) {
      console.error("Error fetching appointments:", error);
    } finally {
      setLoading(false);
    }
  };

  const today = startOfDay(new Date());
  
  const upcomingAppointments = appointments.filter((apt) => {
    const aptDate = parseISO(apt.appointment_date);
    return !isBefore(aptDate, today) && apt.status !== "cancelled" && apt.status !== "no_show";
  });

  const pastAppointments = appointments.filter((apt) => {
    const aptDate = parseISO(apt.appointment_date);
    return isBefore(aptDate, today) || apt.status === "cancelled" || apt.status === "no_show";
  });

  const handleNewAppointment = () => {
    onOpenChange(false);
    navigate(`/dashboard/calendar?patient=${patientId}`);
  };

  const renderAppointmentItem = (apt: Appointment) => {
    const status = statusConfig[apt.status] || { label: apt.status, variant: "outline" as const };
    const typeLabel = typeLabels[apt.type] || apt.type;

    return (
      <AccordionItem key={apt.id} value={apt.id} className="border rounded-lg px-4 mb-2">
        <AccordionTrigger className="hover:no-underline py-3">
          <div className="flex flex-col items-start gap-1 text-left w-full">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              {format(parseISO(apt.appointment_date), "dd/MM/yyyy", { locale: ptBR })}
              <Clock className="h-4 w-4 text-muted-foreground ml-2" />
              {apt.start_time.slice(0, 5)}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={status.variant}>{status.label}</Badge>
              <span className="text-xs text-muted-foreground">{typeLabel}</span>
              {apt.professional && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {apt.professional.name}
                </span>
              )}
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent className="pt-2 pb-4">
          <div className="space-y-2 text-sm">
            {apt.procedure && (
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Procedimento:</span>
                <span>{apt.procedure.name}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Horário:</span>
              <span>{apt.start_time.slice(0, 5)} - {apt.end_time.slice(0, 5)}</span>
            </div>
            {apt.notes && (
              <div className="mt-2">
                <span className="font-medium">Observações:</span>
                <p className="text-muted-foreground mt-1">{apt.notes}</p>
              </div>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={true}>
      <DialogContent 
        className="max-w-2xl max-h-[85vh]"
        onPointerDownOutside={(e) => {
          if (!document.hasFocus()) e.preventDefault();
        }}
        onInteractOutside={(e) => {
          if (!document.hasFocus()) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Agendamentos - {patientName}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-6">
              {/* Upcoming Appointments */}
              <div>
                <h3 className="font-semibold text-sm text-muted-foreground mb-3 flex items-center gap-2">
                  Próximos Agendamentos ({upcomingAppointments.length})
                </h3>
                {upcomingAppointments.length > 0 ? (
                  <Accordion type="single" collapsible className="space-y-2">
                    {upcomingAppointments.map(renderAppointmentItem)}
                  </Accordion>
                ) : (
                  <p className="text-sm text-muted-foreground py-4 text-center border rounded-lg">
                    Nenhum agendamento futuro
                  </p>
                )}
              </div>

              {/* Past Appointments */}
              <div>
                <h3 className="font-semibold text-sm text-muted-foreground mb-3 flex items-center gap-2">
                  Histórico ({pastAppointments.length})
                </h3>
                {pastAppointments.length > 0 ? (
                  <Accordion type="single" collapsible className="space-y-2">
                    {pastAppointments.map(renderAppointmentItem)}
                  </Accordion>
                ) : (
                  <p className="text-sm text-muted-foreground py-4 text-center border rounded-lg">
                    Nenhum histórico de agendamentos
                  </p>
                )}
              </div>
            </div>
          </ScrollArea>
        )}

        <div className="flex justify-end pt-4 border-t">
          <Button onClick={handleNewAppointment} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Agendamento
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
