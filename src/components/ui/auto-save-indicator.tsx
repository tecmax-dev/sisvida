import { Cloud, Check, AlertCircle } from "lucide-react";
import type { AutoSaveStatus } from "@/hooks/useAutoSave";

interface AutoSaveIndicatorProps {
  status: AutoSaveStatus;
}

export function AutoSaveIndicator({ status }: AutoSaveIndicatorProps) {
  if (status === 'idle') return null;

  return (
    <div className="flex items-center gap-2 text-sm">
      {status === 'saving' && (
        <>
          <Cloud className="h-4 w-4 animate-pulse text-muted-foreground" />
          <span className="text-muted-foreground">Salvando...</span>
        </>
      )}
      {status === 'saved' && (
        <>
          <Check className="h-4 w-4 text-green-600" />
          <span className="text-green-600">Salvo</span>
        </>
      )}
      {status === 'error' && (
        <>
          <AlertCircle className="h-4 w-4 text-destructive" />
          <span className="text-destructive">Erro ao salvar</span>
        </>
      )}
    </div>
  );
}
