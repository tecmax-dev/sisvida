import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface TutorialCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  color?: "blue" | "green" | "amber" | "rose" | "violet" | "emerald";
  className?: string;
}

const colorStyles = {
  blue: "bg-blue-500/10 border-blue-500/20 text-blue-600",
  green: "bg-green-500/10 border-green-500/20 text-green-600",
  amber: "bg-amber-500/10 border-amber-500/20 text-amber-600",
  rose: "bg-rose-500/10 border-rose-500/20 text-rose-600",
  violet: "bg-violet-500/10 border-violet-500/20 text-violet-600",
  emerald: "bg-emerald-500/10 border-emerald-500/20 text-emerald-600",
};

export function TutorialCard({ icon: Icon, title, description, color = "blue", className }: TutorialCardProps) {
  return (
    <div className={cn(
      "p-4 rounded-xl border transition-all hover:shadow-md",
      colorStyles[color],
      className
    )}>
      <Icon className="h-6 w-6 mb-3" />
      <h4 className="font-semibold text-foreground mb-1">{title}</h4>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

interface TutorialTipProps {
  type?: "tip" | "warning" | "info";
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function TutorialTip({ type = "tip", title, children, className }: TutorialTipProps) {
  const styles = {
    tip: "bg-primary/5 border-primary/20 text-primary",
    warning: "bg-amber-500/10 border-amber-500/20 text-amber-600",
    info: "bg-blue-500/10 border-blue-500/20 text-blue-600",
  };

  const defaultTitles = {
    tip: "💡 Dica",
    warning: "⚠️ Atenção",
    info: "ℹ️ Informação",
  };

  return (
    <div className={cn(
      "p-4 rounded-xl border my-4",
      styles[type],
      className
    )}>
      <p className="font-semibold mb-1">{title || defaultTitles[type]}</p>
      <div className="text-muted-foreground text-sm">{children}</div>
    </div>
  );
}
