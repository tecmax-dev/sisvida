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
        "min-h-[40px] rounded-lg transition-all duration-300",
        // Estado padrão durante arraste - destaca zonas de drop
        isActive && !disabled && !isOccupied && [
          "border-2 border-dashed border-green-400/60 bg-green-50/40",
          "ring-1 ring-green-300/30 ring-offset-1"
        ],
        isActive && isOccupied && [
          "border-2 border-dashed border-red-300/60 bg-red-50/40",
        ],
        // Hover sobre slot disponível - feedback positivo
        isOver && !disabled && !isOccupied && [
          "bg-green-100 border-green-500 border-solid border-2",
          "scale-[1.02] shadow-md shadow-green-200/50",
          "ring-2 ring-green-400/50 ring-offset-1"
        ],
        // Hover sobre slot ocupado - feedback de erro
        isOver && isOccupied && [
          "bg-red-100 border-red-400 border-solid border-2",
          "cursor-not-allowed",
          "animate-pulse"
        ],
        disabled && "opacity-50",
        className
      )}
    >
      {showTime && (
        <span className={cn(
          "text-xs font-medium transition-colors",
          isOver && !isOccupied ? "text-green-700 font-semibold" : 
          isOver && isOccupied ? "text-red-600 font-semibold" : 
          isActive && !isOccupied ? "text-green-600" :
          "text-muted-foreground"
        )}>
          {time}
        </span>
      )}
      {children}
    </div>
  );
}
