import { ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface PageAction {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  onClick: () => void;
}

interface Props {
  title: string;
  description?: ReactNode;
  /** Ação principal (botão cheio à direita). */
  primary?: ReactNode;
  /** Ações secundárias, reunidas em "Mais ações". */
  moreActions?: PageAction[];
  meta?: ReactNode;
  className?: string;
}

/** Cabeçalho de página padrão: título enxuto, sem cartão, ações à direita. */
export function PageHeader({ title, description, primary, moreActions, meta, className }: Props) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        <h1 className="text-[22px] font-semibold leading-tight tracking-tight text-foreground">{title}</h1>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        {meta && <div className="mt-1">{meta}</div>}
      </div>
      {(primary || (moreActions && moreActions.length > 0)) && (
        <div className="flex shrink-0 items-center gap-2">
          {moreActions && moreActions.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-1.5">
                  <MoreHorizontal className="h-4 w-4" />
                  Mais ações
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[200px]">
                {moreActions.map((a) => (
                  <DropdownMenuItem key={a.label} onClick={a.onClick}>
                    {a.icon && <a.icon className="mr-2 h-4 w-4" />}
                    {a.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {primary}
        </div>
      )}
    </div>
  );
}
