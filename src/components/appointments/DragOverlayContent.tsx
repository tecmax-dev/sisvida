import { cn } from "@/lib/utils";
import { Clock, User, Calendar } from "lucide-react";

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
  return (
    <div className={cn(
      "p-4 rounded-xl border-2 border-primary bg-card shadow-2xl",
      "min-w-[280px] cursor-grabbing"
    )}>
      <div className="flex items-center gap-3">
        <div className="w-16 text-center py-2 rounded-lg bg-primary/10">
          <span className="text-sm font-semibold text-primary">
            {appointment.start_time.slice(0, 5)}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground truncate">
            {appointment.patient?.name || "Paciente"}
          </p>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {typeLabels[appointment.type] || appointment.type}
            </span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <User className="h-3 w-3" />
              {appointment.professional?.name || "Profissional"}
            </span>
          </div>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-border/50 flex items-center gap-2 text-xs text-primary">
        <Calendar className="h-3.5 w-3.5" />
        <span>Solte para reagendar</span>
      </div>
    </div>
  );
}
