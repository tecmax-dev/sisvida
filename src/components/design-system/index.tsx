import { ReactNode, useState, type ComponentType } from "react";
import { AlertTriangle, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export { PageHeader } from "@/components/layout/PageHeader";
export { EmptyState, PageLoading as LoadingState } from "@/components/ui/page-state";

type Tone = "default" | "primary" | "success" | "warning" | "destructive";
const toneText: Record<Tone, string> = {
  default: "text-muted-foreground",
  primary: "text-primary",
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
};

/** Indicador compacto (~68px) com número destacado. */
export function StatCard({ label, value, icon: Icon, tone = "default", hint, onClick }: {
  label: string; value: ReactNode; icon?: ComponentType<{ className?: string }>; tone?: Tone; hint?: string; onClick?: () => void;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={cn("flex w-full items-center justify-between rounded-lg border bg-card px-4 py-3 text-left shadow-sm", onClick && "transition-colors hover:border-primary/30")}
    >
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-xl font-semibold leading-tight tabular-nums text-foreground">{value}</p>
        {hint && <p className="truncate text-[11px] text-muted-foreground">{hint}</p>}
      </div>
      {Icon && (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
          <Icon className={cn("h-4 w-4", toneText[tone])} />
        </span>
      )}
    </Comp>
  );
}

/** Barra única de pesquisa + filtros (~48px). */
export function FilterToolbar({ search, children, className }: { search?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2 rounded-lg border bg-card p-2 lg:flex-row lg:items-center", className)}>
      {search && <div className="relative w-full flex-1">{search}</div>}
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

const statusStyles: Record<Tone, string> = {
  default: "bg-muted text-muted-foreground",
  primary: "bg-primary-soft text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  destructive: "bg-destructive/10 text-destructive",
};

/** Status discreto com ponto colorido. */
export function StatusBadge({ tone = "default", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={cn("inline-flex h-5 items-center gap-1.5 rounded-full px-2 text-[11px] font-medium", statusStyles[tone])}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {children}
    </span>
  );
}

/** Faixa de alertas recolhível. */
export function AlertBar({ title, count, children, defaultOpen = false }: { title: string; count?: number; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex h-10 w-full items-center justify-between px-3 text-[13px] text-muted-foreground hover:text-foreground"
      >
        <span className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-warning" />
          {title}
          {typeof count === "number" && count > 0 && <StatusBadge tone="warning">{count}</StatusBadge>}
        </span>
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="border-t p-2">{children}</div>}
    </div>
  );
}
