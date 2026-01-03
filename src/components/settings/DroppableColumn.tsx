import { ReactNode } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { cn } from "@/lib/utils";

interface DroppableColumnProps {
  id: string;
  label: string;
  widgetIds: string[];
  children: ReactNode;
  isEditMode: boolean;
}

export function DroppableColumn({
  id,
  label,
  widgetIds,
  children,
  isEditMode,
}: DroppableColumnProps) {
  const { isOver, setNodeRef } = useDroppable({
    id,
  });

  return (
    <div 
      ref={setNodeRef}
      className={cn(
        "space-y-4 min-h-[200px] rounded-lg transition-all duration-200",
        isEditMode && "p-3 border-2 border-dashed border-muted-foreground/20",
        isOver && isEditMode && "border-primary/50 bg-primary/5"
      )}
    >
      {isEditMode && (
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">
          {label}
        </div>
      )}
      <SortableContext items={widgetIds} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </div>
  );
}
