import { cn } from "@/lib/utils";

interface RealtimeIndicatorProps {
  className?: string;
  showText?: boolean;
  text?: string;
}

export function RealtimeIndicator({ 
  className, 
  showText = true,
  text = "Atualizações em tempo real ativas"
}: RealtimeIndicatorProps) {
  return (
    <div className={cn("flex items-center gap-2 text-sm", className)}>
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
      </span>
      {showText && (
        <span className="text-muted-foreground">{text}</span>
      )}
    </div>
  );
}
