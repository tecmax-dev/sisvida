import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface RefreshDataButtonProps {
  /** Query key prefixes to refetch (e.g. ["union-financial-transactions"]) */
  queryKeys: string[][] | string[];
  label?: string;
  size?: "sm" | "default" | "icon";
  variant?: "outline" | "ghost" | "secondary" | "default";
  className?: string;
  /** Optional extra async work (non react-query loaders) */
  onRefresh?: () => void | Promise<void>;
}

export function RefreshDataButton({
  queryKeys,
  label = "Atualizar",
  size = "sm",
  variant = "outline",
  className,
  onRefresh,
}: RefreshDataButtonProps) {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const normalized: string[][] = (queryKeys as any[]).map((k) =>
    Array.isArray(k) ? (k as string[]) : [k as string]
  );

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await Promise.all(
        normalized.map((key) => queryClient.refetchQueries({ queryKey: key, type: "active" }))
      );
      if (onRefresh) await onRefresh();
      setLastUpdate(new Date());
      toast.success("Dados atualizados");
    } catch (e: any) {
      toast.error("Não foi possível atualizar", { description: e?.message });
    } finally {
      setRefreshing(false);
    }
  };

  const tooltip = lastUpdate
    ? `Última atualização às ${lastUpdate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
    : "Recarregar dados do banco sem atualizar a página";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant={variant}
            size={size}
            onClick={handleRefresh}
            disabled={refreshing}
            className={cn(className)}
            aria-label="Atualizar dados"
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin", size !== "icon" && "mr-1.5")} />
            {size !== "icon" && (refreshing ? "Atualizando..." : label)}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
