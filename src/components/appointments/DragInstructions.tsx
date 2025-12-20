import { CalendarClock, ArrowRight, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface DragInstructionsProps {
  isVisible: boolean;
  patientName?: string;
}

export function DragInstructions({ isVisible, patientName }: DragInstructionsProps) {
  if (!isVisible) return null;

  return (
    <div className={cn(
      "fixed bottom-6 left-1/2 -translate-x-1/2 z-50",
      "animate-fade-in"
    )}>
      <div className={cn(
        "flex items-center gap-3 px-5 py-3",
        "bg-popover/95 backdrop-blur-sm border-2 border-primary/20 rounded-xl",
        "shadow-xl shadow-primary/10"
      )}>
        <div className="flex items-center gap-2 text-primary">
          <CalendarClock className="h-5 w-5" />
        </div>
        
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-medium text-foreground">
            Reagendando {patientName ? <span className="text-primary">{patientName}</span> : "agendamento"}
          </p>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            Solte em um 
            <span className="inline-flex items-center gap-1 font-medium text-green-600">
              <Calendar className="h-3 w-3" />
              horário
            </span>
            ou
            <span className="inline-flex items-center gap-1 font-medium text-green-600">
              data
            </span>
            disponível
          </p>
        </div>
        
        <div className="flex gap-1.5 ml-2">
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-green-100 text-green-700 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            Disponível
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-red-100 text-red-700 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            Ocupado
          </span>
        </div>
      </div>
    </div>
  );
}
