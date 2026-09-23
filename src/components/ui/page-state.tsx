import type { ComponentType } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageLoadingProps {
  label?: string;
  className?: string;
}

export function PageLoading({ label = "Carregando conteúdo...", className }: PageLoadingProps) {
  return (
    <div
      className={cn("flex min-h-56 flex-col items-center justify-center gap-3", className)}
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-7 w-7 animate-spin text-primary" aria-hidden="true" />
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
    </div>
  );
}

interface EmptyStateProps {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, className }: EmptyStateProps) {
  return (
    <div className={cn("flex min-h-44 flex-col items-center justify-center px-4 py-8 text-center", className)}>
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <p className="font-semibold text-foreground">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}