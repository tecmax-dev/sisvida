import { cn } from "@/lib/utils";
import { Clock, User, GripVertical, CalendarClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Appointment {
  id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  type: string;
  status: string;
  patient: {
    id: string;
    name: string;
  };
  professional: {
    id: string;
    name: string;
  };
}

interface DragOverlayContentProps {
  appointment: Appointment;
}

const typeLabels: Record<string, string> = {
  first_visit: "Primeira Consulta",
  return: "Retorno",
  exam: "Exame",
  procedure: "Procedimento",
};

export function DragOverlayContent({ appointment }: DragOverlayContentProps) {
  const formattedDate = new Date(appointment.appointment_date + 'T12:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
  });

  return (
    <div className={cn(
      "p-4 rounded-xl border-2 border-primary bg-card shadow-2xl",
      "min-w-[280px] max-w-[320px] cursor-grabbing",
      "rotate-2 animate-pulse-subtle"
    )}>
      {/* Drag indicator */}
      <div className="absolute -left-1 top-1/2 -translate-y-1/2 flex flex-col gap-0.5">
        <GripVertical className="h-5 w-5 text-primary" />
      </div>
      
      <div className="flex items-start gap-3">
        {/* Time badge */}
        <div className="shrink-0 text-center py-2 px-3 rounded-lg bg-primary/10 border border-primary/20">
          <span className="text-sm font-bold text-primary block">
            {appointment.start_time.slice(0, 5)}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {formattedDate}
          </span>
        </div>
        
        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground truncate">
            {appointment.patient?.name || "Paciente"}
          </p>
          <div className="flex flex-col gap-1 mt-1.5">
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-3 w-3 shrink-0" />
              <span className="truncate">{typeLabels[appointment.type] || appointment.type}</span>
            </span>
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <User className="h-3 w-3 shrink-0" />
              <span className="truncate">{appointment.professional?.name || "Profissional"}</span>
            </span>
          </div>
        </div>
      </div>
      
      {/* Drop instruction */}
      <div className="mt-3 pt-3 border-t border-border/50">
        <Badge variant="secondary" className="w-full justify-center gap-1.5 py-1.5 bg-primary/5 hover:bg-primary/5">
          <CalendarClock className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium text-primary">
            Solte para reagendar
          </span>
        </Badge>
      </div>
    </div>
  );
}
