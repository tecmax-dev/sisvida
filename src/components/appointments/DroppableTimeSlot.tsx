import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";

interface DroppableTimeSlotProps {
  date: string;
  time: string;
  children?: React.ReactNode;
  className?: string;
  showTime?: boolean;
  disabled?: boolean;
  isOccupied?: boolean;
}

export function DroppableTimeSlot({ 
  date, 
  time, 
  children, 
  className,
  showTime = true,
  disabled = false,
  isOccupied = false,
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
        // Estado padrão durante arraste
        isActive && !disabled && !isOccupied && "border-2 border-dashed border-green-400/50 bg-green-50/30",
        isActive && isOccupied && "border-2 border-dashed border-red-300/50 bg-red-50/30",
        // Hover sobre slot disponível
        isOver && !disabled && !isOccupied && "bg-green-100 border-green-500 border-solid scale-[1.02]",
        // Hover sobre slot ocupado
        isOver && isOccupied && "bg-red-100 border-red-400 border-solid cursor-not-allowed",
        disabled && "opacity-50",
        className
      )}
    >
      {showTime && (
        <span className={cn(
          "text-xs font-medium",
          isOver && !isOccupied ? "text-green-700" : isOver && isOccupied ? "text-red-600" : "text-muted-foreground"
        )}>
          {time}
        </span>
      )}
      {children}
    </div>
  );
}
