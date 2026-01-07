import { useEffect, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { Loader2, Users, Receipt, CheckCircle, RefreshCw, Hash } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface SyncProgress {
  phase: string;
  clientsProcessed: number;
  invoicesProcessed: number;
  totalClients?: number;
  totalInvoices?: number;
}

export type LytexActionType = "import" | "sync" | "fix_types" | "extract_registrations";

interface LytexSyncProgressProps {
  syncLogId: string | null;
  isActive: boolean;
  actionType?: LytexActionType;
}

const ACTION_CONFIG = {
  import: {
    title: "Importando da Lytex",
    icon: Receipt,
  },
  sync: {
    title: "Sincronizando Status",
    icon: RefreshCw,
  },
  fix_types: {
    title: "Corrigindo Tipos",
    icon: RefreshCw,
  },
  extract_registrations: {
    title: "Extraindo Matrículas",
    icon: Hash,
  },
};

export function LytexSyncProgress({ syncLogId, isActive, actionType = "import" }: LytexSyncProgressProps) {
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [status, setStatus] = useState<string>("running");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!isActive) {
      setElapsedSeconds(0);
      setProgress(null);
      return;
    }

    // Timer para mostrar tempo decorrido
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [isActive]);

  useEffect(() => {
    if (!syncLogId || !isActive) return;

    // Polling para atualizar progresso
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("lytex_sync_logs")
        .select("status, details")
        .eq("id", syncLogId)
        .single();

      if (data) {
        setStatus(data.status || "running");
        const details = data.details as { progress?: SyncProgress } | null;
        if (details?.progress) {
          setProgress(details.progress);
        }
        
        // Parar polling quando completar
        if (data.status === "completed" || data.status === "failed") {
          clearInterval(interval);
        }
      }
    }, 800);

    return () => clearInterval(interval);
  }, [syncLogId, isActive]);

  if (!isActive) return null;

  const config = ACTION_CONFIG[actionType];
  const ActionIcon = config.icon;

  const getPhaseInfo = () => {
    // Se não temos syncLogId, mostrar progresso genérico baseado no tempo
    if (!syncLogId) {
      const baseProgress = Math.min(elapsedSeconds * 3, 90);
      return { 
        label: `${config.title}...`, 
        icon: ActionIcon, 
        progress: baseProgress 
      };
    }

    switch (progress?.phase) {
      case "starting":
        return { label: "Iniciando...", icon: Loader2, progress: 5 };
      case "clients":
        return { 
          label: `Processando empresas: ${progress.clientsProcessed} processadas`, 
          icon: Users, 
          progress: 20 + Math.min((progress.clientsProcessed / 100) * 30, 30)
        };
      case "invoices_preparing":
        return { label: "Preparando faturas...", icon: Receipt, progress: 50 };
      case "invoices":
        return { 
          label: `Processando faturas: ${progress.invoicesProcessed} processadas`, 
          icon: Receipt, 
          progress: 55 + Math.min((progress.invoicesProcessed / 500) * 40, 40)
        };
      case "finishing":
        return { label: "Finalizando...", icon: CheckCircle, progress: 95 };
      default:
        return { label: `${config.title}...`, icon: Loader2, progress: 10 };
    }
  };

  const phaseInfo = getPhaseInfo();
  const PhaseIcon = phaseInfo.icon;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-card border rounded-lg shadow-lg p-6 max-w-md w-full mx-4 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-full">
            <PhaseIcon className="h-6 w-6 text-primary animate-spin" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">{config.title}</h3>
            <p className="text-sm text-muted-foreground">{phaseInfo.label}</p>
          </div>
        </div>
        
        <Progress value={phaseInfo.progress} className="h-2" />
        
        <div className="flex justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            <span>{progress?.clientsProcessed || 0} empresas</span>
          </div>
          <div className="flex items-center gap-1">
            <Receipt className="h-4 w-4" />
            <span>{progress?.invoicesProcessed || 0} faturas</span>
          </div>
        </div>
        
        <p className="text-xs text-center text-muted-foreground">
          Por favor, aguarde. Não feche esta página. ({formatTime(elapsedSeconds)})
        </p>
      </div>
    </div>
  );
}
