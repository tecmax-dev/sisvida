import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  XCircle,
  Clock,
  FileWarning
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface LytexSyncStatusIndicatorProps {
  clinicId: string;
  onSyncClick?: () => void;
  syncing?: boolean;
}

export function LytexSyncStatusIndicator({ 
  clinicId, 
  onSyncClick, 
  syncing = false 
}: LytexSyncStatusIndicatorProps) {
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [outdatedCount, setOutdatedCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (clinicId) {
      fetchSyncStatus();
    }
  }, [clinicId]);

  const fetchSyncStatus = async () => {
    setLoading(true);
    try {
      // Buscar última sincronização bem-sucedida
      const { data: syncLog } = await supabase
        .from("lytex_sync_logs")
        .select("completed_at")
        .eq("clinic_id", clinicId)
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (syncLog?.completed_at) {
        setLastSync(new Date(syncLog.completed_at));
      }

      // Contar boletos pendentes de atualização
      const { count } = await supabase
        .from("employer_contributions")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", clinicId)
        .in("status", ["pending", "overdue", "processing"])
        .not("lytex_invoice_id", "is", null);

      setOutdatedCount(count || 0);
    } catch (error) {
      console.error("Erro ao buscar status de sincronização:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusConfig = () => {
    if (!lastSync) {
      return {
        icon: XCircle,
        color: "text-destructive",
        bgColor: "bg-destructive/10",
        label: "Nunca sincronizado"
      };
    }

    const hoursSinceSync = (Date.now() - lastSync.getTime()) / (1000 * 60 * 60);

    if (hoursSinceSync < 24) {
      return {
        icon: CheckCircle2,
        color: "text-green-600",
        bgColor: "bg-green-500/10",
        label: "Atualizado"
      };
    } else if (hoursSinceSync < 48) {
      return {
        icon: AlertCircle,
        color: "text-yellow-600",
        bgColor: "bg-yellow-500/10",
        label: "Desatualizado"
      };
    } else {
      return {
        icon: XCircle,
        color: "text-destructive",
        bgColor: "bg-destructive/10",
        label: "Muito desatualizado"
      };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground animate-pulse">
        <Clock className="h-4 w-4" />
        <span>Carregando status...</span>
      </div>
    );
  }

  const statusConfig = getStatusConfig();
  const StatusIcon = statusConfig.icon;

  return (
    <div className={`flex flex-wrap items-center gap-3 px-3 py-2 rounded-lg ${statusConfig.bgColor} border border-border/50`}>
      <div className="flex items-center gap-2">
        <StatusIcon className={`h-4 w-4 ${statusConfig.color}`} />
        <span className="text-sm font-medium text-foreground">
          Lytex:
        </span>
        {lastSync ? (
          <span className="text-sm text-muted-foreground">
            Última sync {formatDistanceToNow(lastSync, { addSuffix: true, locale: ptBR })}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">
            Nunca sincronizado
          </span>
        )}
      </div>

      {outdatedCount > 0 && (
        <Badge variant="secondary" className="gap-1">
          <FileWarning className="h-3 w-3" />
          {outdatedCount} {outdatedCount === 1 ? 'boleto pendente' : 'boletos pendentes'}
        </Badge>
      )}

      {onSyncClick && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onSyncClick}
          disabled={syncing}
          className="h-7 px-2"
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Sincronizando...' : 'Sincronizar'}
        </Button>
      )}
    </div>
  );
}
