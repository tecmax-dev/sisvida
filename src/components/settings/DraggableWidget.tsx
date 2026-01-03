import { ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GripVertical, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface DraggableWidgetProps {
  id: string;
  title: string;
  description?: string;
  icon: ReactNode;
  children: ReactNode;
  isEditMode: boolean;
  isVisible: boolean;
  onToggleVisibility: () => void;
}

export function DraggableWidget({
  id,
  title,
  description,
  icon,
  children,
  isEditMode,
  isVisible,
  onToggleVisibility,
}: DraggableWidgetProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id,
    disabled: !isEditMode,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  if (!isVisible && !isEditMode) {
    return null;
  }

  return (
    <Card 
      ref={setNodeRef}
      style={style}
      className={cn(
        "transition-all duration-200",
        isEditMode && "border-dashed border-2 border-primary/30",
        !isVisible && "opacity-50",
        isDragging && "opacity-70 shadow-lg ring-2 ring-primary z-50"
      )}
    >
      <CardHeader className="relative pb-3">
        <div className="flex items-center gap-3">
          {isEditMode && (
            <div
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing p-1 -ml-1 rounded hover:bg-muted touch-none"
            >
              <GripVertical className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base">{title}</CardTitle>
            {description && (
              <CardDescription className="text-xs">{description}</CardDescription>
            )}
          </div>
          
          {isEditMode && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onToggleVisibility}
              title={isVisible ? "Ocultar widget" : "Exibir widget"}
            >
              {isVisible ? (
                <Eye className="h-3.5 w-3.5 text-primary" />
              ) : (
                <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </Button>
          )}
        </div>
      </CardHeader>
      
      {(isVisible || isEditMode) && (
        <CardContent className={cn(!isVisible && "pointer-events-none")}>
          {children}
        </CardContent>
      )}
    </Card>
  );
}
