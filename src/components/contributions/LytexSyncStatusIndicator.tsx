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
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  XCircle,
  Clock,
  FileWarning,
  History,
  Building2,
  FileText,
  Eye,
  Printer,
  Search,
  ChevronLeft
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface LytexSyncStatusIndicatorProps {
  clinicId: string;
  onSyncClick?: () => void;
  syncing?: boolean;
}

interface ClientDetail {
  cnpj: string;
  name: string;
  action: "imported" | "updated";
}

interface InvoiceDetail {
  employerName: string;
  competence: string;
  value: number;
  status: string;
  action: string;
}

interface SyncDetails {
  errors?: string[];
  clients?: ClientDetail[];
  invoices?: InvoiceDetail[];
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
  details: SyncDetails | null;
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
  const [selectedLog, setSelectedLog] = useState<SyncLogEntry | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

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
    setSelectedLog(null);
    fetchSyncHistory();
  };

  const fetchSyncStatus = async () => {
    setLoading(true);
    try {
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

  const getInvoiceStatusLabel = (status: string) => {
    switch (status) {
      case "paid": return "Pago";
      case "pending": return "Pendente";
      case "overdue": return "Vencido";
      case "cancelled": return "Cancelado";
      default: return status;
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value / 100);
  };

  const handlePrintDetails = () => {
    if (!selectedLog) return;

    const details = selectedLog.details;
    const clients = details?.clients || [];
    const invoices = details?.invoices || [];

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const importedClients = clients.filter(c => c.action === "imported");
    const updatedClients = clients.filter(c => c.action === "updated");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Relatório de Sincronização Lytex</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; font-size: 12px; }
          h1 { font-size: 18px; margin-bottom: 10px; }
          h2 { font-size: 14px; margin-top: 20px; margin-bottom: 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
          .header { margin-bottom: 20px; }
          .info { margin: 4px 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
          th { background-color: #f5f5f5; font-weight: bold; }
          .summary { display: flex; gap: 20px; margin: 16px 0; }
          .summary-item { padding: 8px 16px; background: #f5f5f5; border-radius: 4px; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Relatório de Sincronização Lytex</h1>
          <div class="info"><strong>Data:</strong> ${format(new Date(selectedLog.started_at), "dd/MM/yyyy HH:mm:ss")}</div>
          <div class="info"><strong>Tipo:</strong> ${getSyncTypeLabel(selectedLog.sync_type)}</div>
          <div class="info"><strong>Status:</strong> ${selectedLog.status === "completed" ? "Concluído" : selectedLog.status === "failed" ? "Falhou" : selectedLog.status}</div>
        </div>

        <div class="summary">
          <div class="summary-item"><strong>${selectedLog.clients_imported}</strong> empresas importadas</div>
          <div class="summary-item"><strong>${selectedLog.clients_updated}</strong> empresas atualizadas</div>
          <div class="summary-item"><strong>${selectedLog.invoices_imported}</strong> faturas importadas</div>
          <div class="summary-item"><strong>${selectedLog.invoices_updated}</strong> faturas atualizadas</div>
        </div>

        ${clients.length > 0 ? `
          <h2>Empresas Processadas (${clients.length})</h2>
          <table>
            <thead>
              <tr>
                <th>Empresa</th>
                <th>CNPJ</th>
                <th class="text-center">Ação</th>
              </tr>
            </thead>
            <tbody>
              ${clients.map(c => `
                <tr>
                  <td>${c.name}</td>
                  <td>${c.cnpj}</td>
                  <td class="text-center">${c.action === "imported" ? "Importado" : "Atualizado"}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        ` : ""}

        ${invoices.length > 0 ? `
          <h2>Faturas Processadas (${invoices.length})</h2>
          <table>
            <thead>
              <tr>
                <th>Empresa</th>
                <th class="text-center">Competência</th>
                <th class="text-right">Valor</th>
                <th class="text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              ${invoices.map(inv => `
                <tr>
                  <td>${inv.employerName}</td>
                  <td class="text-center">${inv.competence}</td>
                  <td class="text-right">${formatCurrency(inv.value)}</td>
                  <td class="text-center">${getInvoiceStatusLabel(inv.status)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        ` : ""}

        ${details?.errors && details.errors.length > 0 ? `
          <h2>Erros (${details.errors.length})</h2>
          <ul>
            ${details.errors.map(e => `<li>${e}</li>`).join("")}
          </ul>
        ` : ""}
      </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.print();
  };

  const hasDetails = (log: SyncLogEntry) => {
    const details = log.details;
    if (!details) return false;
    return (details.clients && details.clients.length > 0) || 
           (details.invoices && details.invoices.length > 0) ||
           (details.errors && details.errors.length > 0);
  };

  const filteredClients = selectedLog?.details?.clients?.filter(c => {
    const searchLower = searchTerm.toLowerCase();
    const searchClean = searchTerm.replace(/\D/g, "");
    const cnpjClean = c.cnpj?.replace(/\D/g, "") || "";
    const cnpjNoLeadingZeros = cnpjClean.replace(/^0+/, "");
    const searchNoLeadingZeros = searchClean.replace(/^0+/, "");
    
    return (
      c.name.toLowerCase().includes(searchLower) ||
      (searchClean.length >= 2 && cnpjClean.includes(searchClean)) ||
      (searchNoLeadingZeros.length >= 2 && cnpjNoLeadingZeros.includes(searchNoLeadingZeros))
    );
  }) || [];

  const filteredInvoices = selectedLog?.details?.invoices?.filter(inv =>
    inv.employerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inv.competence.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

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
        <DialogContent className="max-w-5xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedLog ? (
                <>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => { setSelectedLog(null); setSearchTerm(""); }}
                    className="h-8 px-2 mr-2"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Voltar
                  </Button>
                  <span>Detalhes da Sincronização</span>
                </>
              ) : (
                <>
                  <History className="h-5 w-5" />
                  Histórico de Sincronizações Lytex
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="h-[65vh]">
            {selectedLog ? (
              <div className="space-y-4">
                {/* Header com informações gerais */}
                <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-muted/50 rounded-lg">
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">Data/Hora</div>
                    <div className="font-medium">
                      {format(new Date(selectedLog.started_at), "dd/MM/yyyy 'às' HH:mm:ss")}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">Tipo</div>
                    <div className="font-medium">{getSyncTypeLabel(selectedLog.sync_type)}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">Status</div>
                    <div>{getStatusBadge(selectedLog.status)}</div>
                  </div>
                  <Button variant="outline" size="sm" onClick={handlePrintDetails}>
                    <Printer className="h-4 w-4 mr-2" />
                    Imprimir
                  </Button>
                </div>

                {/* Cards de resumo */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 bg-green-500/10 rounded-lg text-center">
                    <div className="text-2xl font-bold text-green-600">{selectedLog.clients_imported}</div>
                    <div className="text-xs text-muted-foreground">Empresas Importadas</div>
                  </div>
                  <div className="p-3 bg-blue-500/10 rounded-lg text-center">
                    <div className="text-2xl font-bold text-blue-600">{selectedLog.clients_updated}</div>
                    <div className="text-xs text-muted-foreground">Empresas Atualizadas</div>
                  </div>
                  <div className="p-3 bg-green-500/10 rounded-lg text-center">
                    <div className="text-2xl font-bold text-green-600">{selectedLog.invoices_imported}</div>
                    <div className="text-xs text-muted-foreground">Faturas Importadas</div>
                  </div>
                  <div className="p-3 bg-blue-500/10 rounded-lg text-center">
                    <div className="text-2xl font-bold text-blue-600">{selectedLog.invoices_updated}</div>
                    <div className="text-xs text-muted-foreground">Faturas Atualizadas</div>
                  </div>
                </div>

                {/* Busca */}
                {hasDetails(selectedLog) && (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por empresa, CNPJ ou competência..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                )}

                {/* Empresas processadas */}
                {filteredClients.length > 0 && (
                  <div>
                    <h3 className="flex items-center gap-2 font-medium mb-2">
                      <Building2 className="h-4 w-4" />
                      Empresas Processadas ({filteredClients.length})
                    </h3>
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Empresa</TableHead>
                            <TableHead>CNPJ</TableHead>
                            <TableHead className="text-center w-28">Ação</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredClients.slice(0, 100).map((client, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="font-medium">{client.name}</TableCell>
                              <TableCell className="text-muted-foreground">{client.cnpj}</TableCell>
                              <TableCell className="text-center">
                                <Badge variant={client.action === "imported" ? "default" : "secondary"}>
                                  {client.action === "imported" ? "Importado" : "Atualizado"}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {filteredClients.length > 100 && (
                        <div className="p-2 text-center text-sm text-muted-foreground bg-muted/50">
                          Mostrando 100 de {filteredClients.length} empresas. Use a busca para filtrar.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Faturas processadas */}
                {filteredInvoices.length > 0 && (
                  <div>
                    <h3 className="flex items-center gap-2 font-medium mb-2">
                      <FileText className="h-4 w-4" />
                      Faturas Processadas ({filteredInvoices.length})
                    </h3>
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Empresa</TableHead>
                            <TableHead className="text-center w-28">Competência</TableHead>
                            <TableHead className="text-right w-28">Valor</TableHead>
                            <TableHead className="text-center w-28">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredInvoices.slice(0, 100).map((invoice, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="font-medium">{invoice.employerName}</TableCell>
                              <TableCell className="text-center">{invoice.competence}</TableCell>
                              <TableCell className="text-right">{formatCurrency(invoice.value)}</TableCell>
                              <TableCell className="text-center">
                                <Badge variant={invoice.status === "paid" ? "default" : invoice.status === "overdue" ? "destructive" : "secondary"}>
                                  {getInvoiceStatusLabel(invoice.status)}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {filteredInvoices.length > 100 && (
                        <div className="p-2 text-center text-sm text-muted-foreground bg-muted/50">
                          Mostrando 100 de {filteredInvoices.length} faturas. Use a busca para filtrar.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Erros */}
                {selectedLog.details?.errors && selectedLog.details.errors.length > 0 && (
                  <div>
                    <h3 className="flex items-center gap-2 font-medium mb-2 text-destructive">
                      <XCircle className="h-4 w-4" />
                      Erros ({selectedLog.details.errors.length})
                    </h3>
                    <div className="border border-destructive/20 rounded-lg p-3 bg-destructive/5 space-y-1">
                      {selectedLog.details.errors.map((error, idx) => (
                        <div key={idx} className="text-sm text-destructive">• {error}</div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Mensagem se não houver detalhes */}
                {!hasDetails(selectedLog) && (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mb-2 opacity-50" />
                    <p>Detalhes não disponíveis para esta sincronização</p>
                    <p className="text-xs mt-1">Sincronizações antigas não possuem dados detalhados</p>
                  </div>
                )}
              </div>
            ) : loadingHistory ? (
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
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {syncHistory.map((log) => (
                    <TableRow key={log.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedLog(log)}>
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
                      <TableCell>
                        <Button variant="ghost" size="sm" className="h-7 px-2">
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          Ver
                        </Button>
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
