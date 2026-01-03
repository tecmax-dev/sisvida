import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GripVertical, ChevronUp, ChevronDown, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

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
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggleVisibility: () => void;
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
  onMoveUp,
  onMoveDown,
  onToggleVisibility,
}: SettingsWidgetWrapperProps) {
  if (!isVisible && !isEditMode) {
    return null;
  }

  return (
    <Card 
      className={cn(
        "transition-all duration-200",
        isEditMode && "border-dashed border-2",
        !isVisible && "opacity-50"
      )}
    >
      <CardHeader className="relative">
        {isEditMode && (
          <div className="absolute -left-2 top-1/2 -translate-y-1/2 flex flex-col gap-1">
            <div className="bg-muted/80 backdrop-blur-sm rounded-lg p-1 flex flex-col gap-1 shadow-md border">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={isFirst}
                onClick={onMoveUp}
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
              <div className="flex items-center justify-center h-6">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={isLast}
                onClick={onMoveDown}
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
        
        <div className={cn("flex items-center gap-3", isEditMode && "pl-8")}>
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            {icon}
          </div>
          <div className="flex-1">
            <CardTitle className="text-lg">{title}</CardTitle>
            {description && (
              <CardDescription>{description}</CardDescription>
            )}
          </div>
          
          {isEditMode && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onToggleVisibility}
            >
              {isVisible ? (
                <Eye className="h-4 w-4 text-primary" />
              ) : (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          )}
        </div>
      </CardHeader>
      
      {(isVisible || isEditMode) && (
        <CardContent className={cn(isEditMode && "pl-12", !isVisible && "pointer-events-none")}>
          {children}
        </CardContent>
      )}
    </Card>
  );
}
