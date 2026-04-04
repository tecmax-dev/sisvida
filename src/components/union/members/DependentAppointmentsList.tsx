import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Calendar, Clock, User, FileText, Loader2, Users } from "lucide-react";
import { format, parseISO, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DependentAppointment {
  id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: string;
  type: string;
  notes: string | null;
  dependent_id: string | null;
  professional: { id: string; name: string } | null;
  procedure: { id: string; name: string } | null;
  dependent: { id: string; name: string } | null;
}

interface DependentAppointmentsListProps {
  patientId: string;
  clinicId: string;
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

export function DependentAppointmentsList({ patientId, clinicId }: DependentAppointmentsListProps) {
  const [appointments, setAppointments] = useState<DependentAppointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDependentAppointments();
  }, [patientId, clinicId]);

  const fetchDependentAppointments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("appointments")
        .select(`
          id, appointment_date, start_time, end_time, status, type, notes, dependent_id,
          professional:professionals(id, name),
          procedure:procedures(id, name),
          dependent:patient_dependents!appointments_dependent_id_fkey(id, name)
        `)
        .eq("patient_id", patientId)
        .eq("clinic_id", clinicId)
        .not("dependent_id", "is", null)
        .order("appointment_date", { ascending: false })
        .order("start_time", { ascending: false });

      if (error) throw error;
      setAppointments(data || []);
    } catch (error) {
      console.error("Error fetching dependent appointments:", error);
    } finally {
      setLoading(false);
    }
  };

  const today = startOfDay(new Date());

  const upcomingAppointments = useMemo(() =>
    appointments.filter((apt) => {
      const aptDate = parseISO(apt.appointment_date);
      return !isBefore(aptDate, today) && apt.status !== "cancelled" && apt.status !== "no_show";
    }), [appointments, today]
  );

  const pastAppointments = useMemo(() =>
    appointments.filter((apt) => {
      const aptDate = parseISO(apt.appointment_date);
      return isBefore(aptDate, today) || apt.status === "cancelled" || apt.status === "no_show";
    }), [appointments, today]
  );

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (appointments.length === 0) {
    return (
      <div className="text-center py-6 text-sm text-muted-foreground border rounded-lg border-dashed">
        <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
        Nenhum agendamento de dependente encontrado
      </div>
    );
  }

  const renderItem = (apt: DependentAppointment) => {
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
              {apt.dependent && (
                <Badge variant="outline" className="text-xs gap-1">
                  <Users className="h-3 w-3" />
                  {apt.dependent.name}
                </Badge>
              )}
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
    <div className="space-y-4 mt-6 pt-6 border-t">
      <h3 className="font-semibold text-base flex items-center gap-2">
        <Calendar className="h-5 w-5 text-primary" />
        Agendamentos dos Dependentes
      </h3>

      {/* Upcoming */}
      <div>
        <h4 className="font-medium text-sm text-muted-foreground mb-2 flex items-center gap-2">
          Próximos ({upcomingAppointments.length})
        </h4>
        {upcomingAppointments.length > 0 ? (
          <Accordion type="single" collapsible className="space-y-2">
            {upcomingAppointments.map(renderItem)}
          </Accordion>
        ) : (
          <p className="text-sm text-muted-foreground py-3 text-center border rounded-lg border-dashed">
            Nenhum agendamento futuro
          </p>
        )}
      </div>

      {/* Past */}
      <div>
        <h4 className="font-medium text-sm text-muted-foreground mb-2 flex items-center gap-2">
          Histórico ({pastAppointments.length})
        </h4>
        {pastAppointments.length > 0 ? (
          <Accordion type="single" collapsible className="space-y-2">
            {pastAppointments.map(renderItem)}
          </Accordion>
        ) : (
          <p className="text-sm text-muted-foreground py-3 text-center border rounded-lg border-dashed">
            Nenhum histórico
          </p>
        )}
      </div>
    </div>
  );
}
