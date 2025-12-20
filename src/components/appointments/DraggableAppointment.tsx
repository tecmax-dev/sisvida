import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { GripVertical } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
  duration_minutes: number | null;
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

interface DraggableAppointmentProps {
  appointment: Appointment;
  children: React.ReactNode;
  disabled?: boolean;
}

export function DraggableAppointment({ 
  appointment, 
  children, 
  disabled = false 
}: DraggableAppointmentProps) {
  // Only allow dragging for active appointments
  const canDrag = !disabled && 
    appointment.status !== "cancelled" && 
    appointment.status !== "completed" && 
    appointment.status !== "no_show" &&
    appointment.status !== "in_progress";

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: appointment.id,
    data: { 
      appointment, 
      type: "appointment",
      originalDate: appointment.appointment_date,
      originalTime: appointment.start_time.slice(0, 5),
    },
    disabled: !canDrag,
  });

  const style = transform ? {
    transform: CSS.Translate.toString(transform),
    zIndex: isDragging ? 1000 : undefined,
  } : undefined;

  if (!canDrag) {
    return <div>{children}</div>;
  }

  return (
    <TooltipProvider>
      <Tooltip delayDuration={500}>
        <TooltipTrigger asChild>
          <div
            ref={setNodeRef}
            style={style}
            className={cn(
              "relative group/drag",
              canDrag && "cursor-grab",
              isDragging && "opacity-40 cursor-grabbing scale-105 z-50"
            )}
          >
            {/* Drag handle - always visible on mobile, hover on desktop */}
            <div 
              {...listeners} 
              {...attributes}
              className={cn(
                "absolute left-0 top-0 bottom-0 w-8 flex items-center justify-center",
                "md:opacity-0 md:group-hover/drag:opacity-100 transition-all duration-200",
                "cursor-grab active:cursor-grabbing z-10",
                "bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-l-xl",
                "hover:from-primary/20 hover:via-primary/10"
              )}
            >
              <div className="flex flex-col gap-0.5">
                <GripVertical className="h-4 w-4 text-primary/70" />
              </div>
            </div>
            
            {/* Visual indicator for draggable - subtle left border */}
            <div className={cn(
              "absolute left-0 top-1/4 bottom-1/4 w-0.5 rounded-full",
              "bg-primary/30 group-hover/drag:bg-primary/60 transition-colors"
            )} />
            
            {children}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="bg-popover">
          <p className="text-xs">
            <span className="font-medium">Arraste</span> para reagendar
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
