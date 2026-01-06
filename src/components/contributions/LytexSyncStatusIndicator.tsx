import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  XCircle,
  Clock,
  FileWarning,
  History,
  Building2,
  FileText
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface LytexSyncStatusIndicatorProps {
  clinicId: string;
  onSyncClick?: () => void;
  syncing?: boolean;
}

interface SyncLogEntry {
  id: string;
  sync_type: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  clients_imported: number;
  clients_updated: number;
  invoices_imported: number;
  invoices_updated: number;
  error_message: string | null;
  details: unknown;
}

export function LytexSyncStatusIndicator({ 
  clinicId, 
  onSyncClick, 
  syncing = false 
}: LytexSyncStatusIndicatorProps) {
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [outdatedCount, setOutdatedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [syncHistory, setSyncHistory] = useState<SyncLogEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (clinicId) {
      fetchSyncStatus();
    }
  }, [clinicId]);

  const fetchSyncHistory = async () => {
    setLoadingHistory(true);
    try {
      const { data } = await supabase
        .from("lytex_sync_logs")
        .select("*")
        .eq("clinic_id", clinicId)
        .order("started_at", { ascending: false })
        .limit(20);

      setSyncHistory((data as SyncLogEntry[]) || []);
    } catch (error) {
      console.error("Erro ao buscar histórico:", error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleOpenHistory = () => {
    setHistoryOpen(true);
    fetchSyncHistory();
  };

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

  const getSyncTypeLabel = (type: string) => {
    switch (type) {
      case "sync_all_pending": return "Atualização de Status";
      case "import_from_lytex": return "Importação Completa";
      case "extract_registrations": return "Extração de Matrículas";
      default: return type;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="default" className="bg-green-600">Concluído</Badge>;
      case "failed":
        return <Badge variant="destructive">Falhou</Badge>;
      case "running":
        return <Badge variant="secondary">Em andamento</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <>
      <div className={`flex flex-wrap items-center gap-3 px-3 py-2 rounded-lg ${statusConfig.bgColor} border border-border/50`}>
        <button 
          onClick={handleOpenHistory}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer"
        >
          <StatusIcon className={`h-4 w-4 ${statusConfig.color}`} />
          <span className="text-sm font-medium text-foreground">
            Lytex:
          </span>
          {lastSync ? (
            <span className="text-sm text-muted-foreground underline-offset-2 hover:underline">
              Última sync {formatDistanceToNow(lastSync, { addSuffix: true, locale: ptBR })}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">
              Nunca sincronizado
            </span>
          )}
          <History className="h-3.5 w-3.5 text-muted-foreground" />
        </button>

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

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Histórico de Sincronizações Lytex
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="h-[60vh]">
            {loadingHistory ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : syncHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <History className="h-12 w-12 mb-2 opacity-50" />
                <p>Nenhuma sincronização realizada</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Building2 className="h-3.5 w-3.5" />
                        Empresas
                      </div>
                    </TableHead>
                    <TableHead className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <FileText className="h-3.5 w-3.5" />
                        Faturas
                      </div>
                    </TableHead>
                    <TableHead>Erros</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {syncHistory.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {format(new Date(log.started_at), "dd/MM/yyyy")}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(log.started_at), "HH:mm:ss")}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {getSyncTypeLabel(log.sync_type)}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(log.status)}
                      </TableCell>
                      <TableCell className="text-center">
                        {(log.clients_imported > 0 || log.clients_updated > 0) ? (
                          <div className="flex flex-col text-sm">
                            {log.clients_imported > 0 && (
                              <span className="text-green-600">+{log.clients_imported} novos</span>
                            )}
                            {log.clients_updated > 0 && (
                              <span className="text-blue-600">{log.clients_updated} atualizados</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {(log.invoices_imported > 0 || log.invoices_updated > 0) ? (
                          <div className="flex flex-col text-sm">
                            {log.invoices_imported > 0 && (
                              <span className="text-green-600">+{log.invoices_imported} novas</span>
                            )}
                            {log.invoices_updated > 0 && (
                              <span className="text-blue-600">{log.invoices_updated} atualizadas</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {log.error_message ? (
                          <Badge variant="destructive" className="gap-1">
                            <XCircle className="h-3 w-3" />
                            Erro
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
