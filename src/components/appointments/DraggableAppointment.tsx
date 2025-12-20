import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { GripVertical } from "lucide-react";

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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative group/drag",
        canDrag && "cursor-grab",
        isDragging && "opacity-50 cursor-grabbing shadow-2xl"
      )}
    >
      {/* Drag handle indicator */}
      {canDrag && (
        <div 
          {...listeners} 
          {...attributes}
          className={cn(
            "absolute left-0 top-0 bottom-0 w-6 flex items-center justify-center",
            "opacity-0 group-hover/drag:opacity-100 transition-opacity",
            "cursor-grab active:cursor-grabbing z-10",
            "bg-gradient-to-r from-muted/80 to-transparent rounded-l-xl"
          )}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      {children}
    </div>
  );
}
