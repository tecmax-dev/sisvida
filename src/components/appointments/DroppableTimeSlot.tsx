import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";

interface DroppableTimeSlotProps {
  date: string;
  time: string;
  children?: React.ReactNode;
  className?: string;
  showTime?: boolean;
  disabled?: boolean;
}

export function DroppableTimeSlot({ 
  date, 
  time, 
  children, 
  className,
  showTime = true,
  disabled = false,
}: DroppableTimeSlotProps) {
  const { isOver, setNodeRef, active } = useDroppable({
    id: `${date}_${time}`,
    data: { date, time },
    disabled,
  });

  const isActive = active !== null;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-[40px] rounded-lg transition-all duration-200",
        isActive && !disabled && "border-2 border-dashed border-primary/30",
        isOver && !disabled && "bg-primary/10 border-primary border-solid scale-[1.02]",
        disabled && "opacity-50",
        className
      )}
    >
      {showTime && (
        <span className={cn(
          "text-xs font-medium",
          isOver ? "text-primary" : "text-muted-foreground"
        )}>
          {time}
        </span>
      )}
      {children}
    </div>
  );
}
