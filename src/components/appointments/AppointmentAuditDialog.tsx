import { useState, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Loader2, Calendar, Clock, User, MessageSquare, Bell, CheckCircle2, XCircle, FileText, Stethoscope, Send, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface AuditEvent {
  id: string;
  timestamp: Date;
  type: 'creation' | 'status_change' | 'message' | 'reminder' | 'attendance' | 'update' | 'confirmation';
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

interface AppointmentAuditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointmentId: string | null;
  patientName: string;
  patientPhone?: string;
}

const statusLabels: Record<string, string> = {
  scheduled: "Agendado",
  confirmed: "Confirmado",
  arrived: "Chegou",
  in_progress: "Em Atendimento",
  completed: "Concluído",
  cancelled: "Cancelado",
  no_show: "Faltou",
};

export function AppointmentAuditDialog({
  open,
  onOpenChange,
  appointmentId,
  patientName,
  patientPhone,
}: AppointmentAuditDialogProps) {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [appointmentDetails, setAppointmentDetails] = useState<any>(null);

  useEffect(() => {
    if (open && appointmentId) {
      loadAuditData();
    }
  }, [open, appointmentId]);

  const loadAuditData = async () => {
    if (!appointmentId) return;
    
    setLoading(true);
    const auditEvents: AuditEvent[] = [];

    try {
      // 1. Buscar detalhes do agendamento
      const { data: appointment, error: appError } = await supabase
        .from('appointments')
        .select(`
          *,
          professional:professionals(name),
          procedure:procedures(name),
          patient:patients(name, phone)
        `)
        .eq('id', appointmentId)
        .single();

      if (appError) throw appError;
      setAppointmentDetails(appointment);

      // Evento de criação
      // Usar parseISO para datas no formato YYYY-MM-DD para evitar timezone shift
      const appointmentDateParsed = parseISO(appointment.appointment_date);
      
      auditEvents.push({
        id: `creation-${appointment.id}`,
        timestamp: new Date(appointment.created_at),
        type: 'creation',
        title: 'Agendamento Criado',
        description: `Consulta agendada para ${format(appointmentDateParsed, "dd/MM/yyyy", { locale: ptBR })} às ${appointment.start_time?.substring(0, 5)} com ${appointment.professional?.name || 'Profissional'}`,
        icon: <Calendar className="h-4 w-4" />,
        color: 'bg-blue-500',
      });

      // Evento de confirmação
      if (appointment.confirmed_at) {
        auditEvents.push({
          id: `confirmed-${appointment.id}`,
          timestamp: new Date(appointment.confirmed_at),
          type: 'confirmation',
          title: 'Agendamento Confirmado',
          description: 'Paciente confirmou presença',
          icon: <CheckCircle2 className="h-4 w-4" />,
          color: 'bg-green-500',
        });
      }

      // Evento de início de atendimento
      if (appointment.started_at) {
        auditEvents.push({
          id: `started-${appointment.id}`,
          timestamp: new Date(appointment.started_at),
          type: 'attendance',
          title: 'Atendimento Iniciado',
          description: `Atendimento iniciado por ${appointment.professional?.name || 'Profissional'}`,
          icon: <Stethoscope className="h-4 w-4" />,
          color: 'bg-purple-500',
        });
      }

      // Evento de conclusão
      if (appointment.completed_at) {
        auditEvents.push({
          id: `completed-${appointment.id}`,
          timestamp: new Date(appointment.completed_at),
          type: 'status_change',
          title: 'Atendimento Concluído',
          description: 'Consulta finalizada com sucesso',
          icon: <CheckCircle2 className="h-4 w-4" />,
          color: 'bg-emerald-500',
        });
      }

      // Evento de cancelamento
      if (appointment.cancelled_at) {
        auditEvents.push({
          id: `cancelled-${appointment.id}`,
          timestamp: new Date(appointment.cancelled_at),
          type: 'status_change',
          title: 'Agendamento Cancelado',
          description: appointment.cancellation_reason || 'Sem motivo informado',
          icon: <XCircle className="h-4 w-4" />,
          color: 'bg-red-500',
        });
      }

      // Evento de lembrete enviado
      if (appointment.reminder_sent) {
        auditEvents.push({
          id: `reminder-${appointment.id}`,
          timestamp: new Date(appointment.updated_at), // Aproximação
          type: 'reminder',
          title: 'Lembrete Enviado',
          description: 'Lembrete automático enviado via WhatsApp',
          icon: <Bell className="h-4 w-4" />,
          color: 'bg-amber-500',
        });
      }

      // 2. Buscar mensagens enviadas (message_logs) usando o telefone do paciente
      const phoneToSearch = patientPhone || appointment.patient?.phone;
      if (phoneToSearch) {
        const cleanPhone = phoneToSearch.replace(/\D/g, '');
        
        const { data: messages } = await supabase
          .from('message_logs')
          .select('*')
          .eq('clinic_id', appointment.clinic_id)
          .or(`phone.ilike.%${cleanPhone.slice(-8)}%`)
          .order('sent_at', { ascending: false })
          .limit(20);

        if (messages) {
          messages.forEach((msg: any) => {
            const msgDate = new Date(msg.sent_at);
            const appointmentDate = new Date(appointment.appointment_date);
            
            // Filtrar mensagens próximas à data do agendamento (7 dias antes/depois)
            const diffDays = Math.abs((msgDate.getTime() - appointmentDate.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays <= 7) {
              const typeLabel = getMessageTypeLabel(msg.message_type);
              auditEvents.push({
                id: `msg-${msg.id}`,
                timestamp: new Date(msg.sent_at),
                type: 'message',
                title: `WhatsApp: ${typeLabel}`,
                description: `Mensagem enviada para ${msg.phone}`,
                icon: <Send className="h-4 w-4" />,
                color: 'bg-teal-500',
              });
            }
          });
        }
      }

      // 3. Verificar registros médicos relacionados
      const { data: medicalRecords } = await supabase
        .from('medical_records')
        .select('id, record_type, created_at')
        .eq('appointment_id', appointmentId)
        .order('created_at', { ascending: false });

      if (medicalRecords) {
        medicalRecords.forEach((record: any) => {
          const recordTypeLabel = getRecordTypeLabel(record.record_type);
          auditEvents.push({
            id: `record-${record.id}`,
            timestamp: new Date(record.created_at),
            type: 'update',
            title: `Registro: ${recordTypeLabel}`,
            description: 'Registro médico adicionado ao prontuário',
            icon: <FileText className="h-4 w-4" />,
            color: 'bg-indigo-500',
          });
        });
      }

      // Ordenar eventos por data (mais recente primeiro)
      auditEvents.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      
      setEvents(auditEvents);
    } catch (error) {
      console.error('Erro ao carregar auditoria:', error);
    } finally {
      setLoading(false);
    }
  };

  const getMessageTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      reminder: 'Lembrete',
      confirmation: 'Confirmação',
      birthday: 'Aniversário',
      campaign: 'Campanha',
      automation: 'Automação',
      manual: 'Manual',
    };
    return labels[type] || type;
  };

  const getRecordTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      anamnesis: 'Anamnese',
      evolution: 'Evolução',
      prescription: 'Prescrição',
      exam_request: 'Solicitação de Exame',
      certificate: 'Atestado',
      report: 'Laudo',
    };
    return labels[type] || type;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Auditoria do Agendamento
          </DialogTitle>
        </DialogHeader>

        {/* Resumo do agendamento */}
        {appointmentDetails && (
          <div className="p-3 rounded-lg bg-muted/50 space-y-1">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{patientName}</span>
              <Badge variant="outline" className="text-xs">
                {statusLabels[appointmentDetails.status] || appointmentDetails.status}
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(parseISO(appointmentDetails.appointment_date), "dd/MM/yyyy", { locale: ptBR })}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {appointmentDetails.start_time?.substring(0, 5)}
              </span>
            </div>
          </div>
        )}

        <Separator />

        {/* Timeline de eventos */}
        <ScrollArea className="h-[400px] pr-4">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : events.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <History className="h-8 w-8 mb-2 opacity-50" />
              <p>Nenhum registro de auditoria encontrado</p>
            </div>
          ) : (
            <div className="relative space-y-4 ml-3">
              {/* Linha vertical da timeline */}
              <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-border" />
              
              {events.map((event, index) => (
                <div key={event.id} className="relative flex gap-4">
                  {/* Marcador */}
                  <div className={cn(
                    "relative z-10 flex h-5 w-5 items-center justify-center rounded-full text-white",
                    event.color
                  )}>
                    {event.icon}
                  </div>
                  
                  {/* Conteúdo */}
                  <div className="flex-1 pb-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-sm">{event.title}</p>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(event.timestamp, "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {event.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
