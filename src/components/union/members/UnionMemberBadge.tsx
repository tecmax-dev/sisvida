import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface UnionMemberBadgeProps {
  status?: string | null;
  showLabel?: boolean;
  size?: "sm" | "md";
  className?: string;
}

const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  ativo: { 
    label: "Ativo", 
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/20 border-emerald-500/30" 
  },
  pendente: { 
    label: "Pendente", 
    color: "text-amber-400",
    bgColor: "bg-amber-500/20 border-amber-500/30" 
  },
  inativo: { 
    label: "Inativo", 
    color: "text-slate-400",
    bgColor: "bg-slate-500/20 border-slate-500/30" 
  },
  suspenso: { 
    label: "Suspenso", 
    color: "text-red-400",
    bgColor: "bg-red-500/20 border-red-500/30" 
  },
};

export function UnionMemberBadge({ 
  status, 
  showLabel = false, 
  size = "md",
  className 
}: UnionMemberBadgeProps) {
  const config = statusConfig[status || "pendente"] || statusConfig.pendente;
  
  if (showLabel) {
    return (
      <Badge 
        variant="outline" 
        className={cn(config.bgColor, config.color, className)}
      >
        <Users className={cn("mr-1", size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5")} />
        {config.label}
      </Badge>
    );
  }

  return (
    <Badge 
      variant="outline" 
      className={cn(
        "px-1.5",
        config.bgColor, 
        config.color,
        size === "sm" && "text-xs py-0",
        className
      )}
    >
      <Users className={cn(size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5")} />
    </Badge>
  );
}

// Badge simples para indicar que um paciente é associado sindical
export function UnionMemberIndicator({ className }: { className?: string }) {
  return (
    <Badge 
      variant="outline" 
      className={cn(
        "bg-purple-500/20 text-purple-300 border-purple-500/30",
        className
      )}
    >
      <Users className="h-3 w-3 mr-1" />
      Associado Sindical
    </Badge>
  );
}
