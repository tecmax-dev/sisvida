import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GripVertical, ChevronUp, ChevronDown, Eye, EyeOff, ArrowLeftRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { WidgetColumn } from "@/hooks/useSettingsWidgets";

interface SettingsWidgetWrapperProps {
  id: string;
  title: string;
  description?: string;
  icon: ReactNode;
  children: ReactNode;
  isEditMode: boolean;
  isVisible: boolean;
  isFirst: boolean;
  isLast: boolean;
  currentColumn: WidgetColumn;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggleVisibility: () => void;
  onMoveToColumn: (column: WidgetColumn) => void;
}

export function SettingsWidgetWrapper({
  id,
  title,
  description,
  icon,
  children,
  isEditMode,
  isVisible,
  isFirst,
  isLast,
  currentColumn,
  onMoveUp,
  onMoveDown,
  onToggleVisibility,
  onMoveToColumn,
}: SettingsWidgetWrapperProps) {
  if (!isVisible && !isEditMode) {
    return null;
  }

  const targetColumn = currentColumn === "left" ? "right" : "left";

  return (
    <Card 
      className={cn(
        "transition-all duration-200",
        isEditMode && "border-dashed border-2 border-primary/30",
        !isVisible && "opacity-50"
      )}
    >
      <CardHeader className="relative pb-3">
        {isEditMode && (
          <div className="absolute -left-3 top-1/2 -translate-y-1/2 flex flex-col gap-0.5">
            <div className="bg-background rounded-lg p-0.5 flex flex-col gap-0.5 shadow-md border">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                disabled={isFirst}
                onClick={onMoveUp}
                title="Mover para cima"
              >
                <ChevronUp className="h-3 w-3" />
              </Button>
              <div className="flex items-center justify-center h-5">
                <GripVertical className="h-3 w-3 text-muted-foreground" />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                disabled={isLast}
                onClick={onMoveDown}
                title="Mover para baixo"
              >
                <ChevronDown className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}
        
        <div className={cn("flex items-center gap-3", isEditMode && "pl-6")}>
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
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => onMoveToColumn(targetColumn)}
                title={`Mover para ${targetColumn === "left" ? "esquerda" : "direita"}`}
              >
                <ArrowLeftRight className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
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
            </div>
          )}
        </div>
      </CardHeader>
      
      {(isVisible || isEditMode) && (
        <CardContent className={cn(isEditMode && "pl-10", !isVisible && "pointer-events-none")}>
          {children}
        </CardContent>
      )}
    </Card>
  );
}
