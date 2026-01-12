import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Building2,
  Clock,
  UserCircle,
  MoreVertical,
  Pencil,
  Trash2,
  XCircle,
  CheckCircle2,
  AlertCircle,
  MessageCircle,
  Send,
  FileText,
} from "lucide-react";

interface HomologacaoAppointment {
  id: string;
  employee_name: string;
  employee_cpf?: string | null;
  company_name: string;
  company_cnpj?: string | null;
  company_phone: string;
  company_email?: string | null;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: string;
  notes?: string | null;
  protocol_number?: string | null;
  professional?: {
    id: string;
    name: string;
  } | null;
  service_type?: {
    id: string;
    name: string;
    duration_minutes: number;
  } | null;
}

interface HomologacaoAppointmentCardProps {
  appointment: HomologacaoAppointment;
  onEdit: () => void;
  onCancel: () => void;
  onComplete: () => void;
  onDelete: () => void;
  onSendReminder: () => void;
  onSendProtocol: () => void;
}

const statusConfig: Record<string, { icon: typeof Clock; color: string; bgColor: string; label: string }> = {
  scheduled: { icon: AlertCircle, color: "text-amber-600", bgColor: "bg-amber-100", label: "Agendado" },
  confirmed: { icon: CheckCircle2, color: "text-blue-600", bgColor: "bg-blue-100", label: "Confirmado" },
  attended: { icon: CheckCircle2, color: "text-green-600", bgColor: "bg-green-100", label: "Atendido" },
  completed: { icon: CheckCircle2, color: "text-green-600", bgColor: "bg-green-100", label: "Realizado" },
  cancelled: { icon: XCircle, color: "text-red-600", bgColor: "bg-red-100", label: "Cancelado" },
  deleted: { icon: Trash2, color: "text-gray-600", bgColor: "bg-gray-100", label: "Excluído" },
  no_show: { icon: XCircle, color: "text-orange-600", bgColor: "bg-orange-100", label: "Faltou" },
};

export function HomologacaoAppointmentCard({
  appointment,
  onEdit,
  onCancel,
  onComplete,
  onDelete,
  onSendReminder,
  onSendProtocol,
}: HomologacaoAppointmentCardProps) {
  const config = statusConfig[appointment.status] || statusConfig.scheduled;
  const StatusIcon = config.icon;
  const isActive = !["cancelled", "completed", "attended", "deleted"].includes(appointment.status);

  return (
    <div className="flex items-start justify-between gap-4 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold">{appointment.employee_name}</span>
          <Badge variant="outline" className={`${config.bgColor} ${config.color} border-0`}>
            <StatusIcon className="w-3 h-3 mr-1" />
            {config.label}
          </Badge>
          {appointment.protocol_number && (
            <Badge variant="secondary" className="text-xs">
              <FileText className="w-3 h-3 mr-1" />
              {appointment.protocol_number}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1">
            <Building2 className="w-3 h-3" />
            {appointment.company_name}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {appointment.start_time?.slice(0, 5)} - {appointment.end_time?.slice(0, 5)}
          </span>
          {appointment.professional && (
            <span className="flex items-center gap-1">
              <UserCircle className="w-3 h-3" />
              {appointment.professional.name}
            </span>
          )}
          {appointment.service_type && (
            <span className="text-xs bg-muted px-2 py-0.5 rounded">
              {appointment.service_type.name}
            </span>
          )}
        </div>
        {appointment.notes && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
            {appointment.notes}
          </p>
        )}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={onEdit}>
            <Pencil className="w-4 h-4 mr-2" />
            Editar
          </DropdownMenuItem>
          
          {isActive && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onSendReminder}>
                <MessageCircle className="w-4 h-4 mr-2" />
                Enviar Lembrete (WhatsApp)
              </DropdownMenuItem>
              {appointment.protocol_number && (
                <DropdownMenuItem onClick={onSendProtocol}>
                  <Send className="w-4 h-4 mr-2" />
                  Enviar Protocolo
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onComplete} className="text-green-600">
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Marcar como Atendido
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onCancel} className="text-orange-600">
                <XCircle className="w-4 h-4 mr-2" />
                Cancelar
              </DropdownMenuItem>
            </>
          )}
          
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onDelete} className="text-destructive">
            <Trash2 className="w-4 h-4 mr-2" />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
