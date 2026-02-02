import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Clock, 
  RefreshCw,
  FileText,
  Download,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface ConciliationLog {
  id: string;
  lytex_invoice_id: string;
  lytex_transaction_id: string | null;
  contribution_id: string | null;
  previous_status: string | null;
  new_status: string | null;
  lytex_paid_at: string | null;
  lytex_paid_value: number | null;
  lytex_payment_method: string | null;
  lytex_fee_amount: number | null;
  lytex_net_value: number | null;
  conciliation_result: string;
  conciliation_reason: string | null;
  created_at: string;
}

interface SyncLog {
  id: string;
  sync_type: string;
  sync_mode: string | null;
  status: string;
  started_at: string;
  completed_at: string | null;
  invoices_conciliated: number | null;
  invoices_already_conciliated: number | null;
  invoices_ignored: number | null;
  error_message: string | null;
  details: any;
}

interface LytexConciliationHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clinicId: string;
}

export function LytexConciliationHistoryDialog({
  open,
  onOpenChange,
  clinicId,
}: LytexConciliationHistoryDialogProps) {
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [conciliationLogs, setConciliationLogs] = useState<ConciliationLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  useEffect(() => {
    if (open && clinicId) {
      fetchLogs();
    }
  }, [open, clinicId]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      // Buscar logs de sincronização (últimos 50)
      const { data: syncData, error: syncError } = await supabase
        .from("lytex_sync_logs")
        .select("*")
        .eq("clinic_id", clinicId)
        .order("started_at", { ascending: false })
        .limit(50);

      if (syncError) {
        console.error("Erro ao buscar logs de sync:", syncError);
      } else {
        setSyncLogs((syncData as SyncLog[]) || []);
      }

      // Buscar logs de conciliação (últimos 100)
      const { data: concData, error: concError } = await supabase
        .from("lytex_conciliation_logs")
        .select("*")
        .eq("clinic_id", clinicId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (concError) {
        console.error("Erro ao buscar logs de conciliação:", concError);
      } else {
        setConciliationLogs((concData as ConciliationLog[]) || []);
      }
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (cents: number | null) => {
    if (cents === null || cents === undefined) return "-";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(cents / 100);
  };

  const formatDateTime = (date: string | null) => {
    if (!date) return "-";
    return format(new Date(date), "dd/MM/yyyy HH:mm", { locale: ptBR });
  };

  const getSyncTypeLabel = (type: string) => {
    switch (type) {
      case "fetch_paid_invoices":
        return "Busca de Pagamentos";
      case "sync_all_pending":
        return "Atualização de Status";
      case "import_from_lytex":
        return "Importação Completa";
      case "fix_contribution_types":
        return "Correção de Tipos";
      default:
        return type;
    }
  };

  const getSyncModeLabel = (mode: string | null) => {
    switch (mode) {
      case "automatic":
        return <Badge variant="outline" className="text-blue-600 border-blue-600"><Clock className="h-3 w-3 mr-1" />Automático</Badge>;
      case "manual":
        return <Badge variant="outline" className="text-gray-600 border-gray-600">Manual</Badge>;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" />Concluído</Badge>;
      case "running":
        return <Badge className="bg-blue-500"><RefreshCw className="h-3 w-3 mr-1 animate-spin" />Em Execução</Badge>;
      case "failed":
        return <Badge className="bg-red-500"><XCircle className="h-3 w-3 mr-1" />Falhou</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getResultBadge = (result: string) => {
    switch (result) {
      case "conciliated":
        return <Badge className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" />Conciliado</Badge>;
      case "already_conciliated":
        return <Badge className="bg-blue-500"><CheckCircle2 className="h-3 w-3 mr-1" />Já Conciliado</Badge>;
      case "ignored":
        return <Badge variant="secondary"><AlertCircle className="h-3 w-3 mr-1" />Ignorado</Badge>;
      case "error":
        return <Badge className="bg-red-500"><XCircle className="h-3 w-3 mr-1" />Erro</Badge>;
      default:
        return <Badge variant="secondary">{result}</Badge>;
    }
  };

  const getPaymentMethodLabel = (method: string | null | undefined) => {
    if (!method) return "-";
    switch (method.toLowerCase()) {
      case "boleto":
      case "bank_slip":
        return "Boleto";
      case "pix":
        return "PIX";
      case "credit_card":
      case "credit":
        return "Cartão";
      case "transfer":
        return "Transferência";
      default:
        return method;
    }
  };

  const getConciliationLogsForSync = (syncLogId: string) => {
    return conciliationLogs.filter((log) => log.id === syncLogId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Histórico de Sincronização e Conciliação Lytex
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[70vh] pr-4">
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : syncLogs.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma sincronização realizada ainda</p>
            </div>
          ) : (
            <div className="space-y-4">
              {syncLogs.map((log) => (
                <Collapsible
                  key={log.id}
                  open={expandedLogId === log.id}
                  onOpenChange={() =>
                    setExpandedLogId(expandedLogId === log.id ? null : log.id)
                  }
                >
                  <div className="border rounded-lg overflow-hidden">
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center justify-between p-4 hover:bg-muted/50 cursor-pointer">
                        <div className="flex items-center gap-4">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {getSyncTypeLabel(log.sync_type)}
                              </span>
                              {getSyncModeLabel(log.sync_mode)}
                            </div>
                            <span className="text-sm text-muted-foreground">
                              {formatDateTime(log.started_at)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          {log.sync_type === "fetch_paid_invoices" && (
                            <div className="flex gap-2 text-sm">
                              {log.invoices_conciliated !== null && log.invoices_conciliated > 0 && (
                                <Badge className="bg-green-500">
                                  {log.invoices_conciliated} conciliados
                                </Badge>
                              )}
                              {log.invoices_already_conciliated !== null && log.invoices_already_conciliated > 0 && (
                                <Badge variant="outline" className="text-blue-600 border-blue-600">
                                  {log.invoices_already_conciliated} já pagos
                                </Badge>
                              )}
                              {log.invoices_ignored !== null && log.invoices_ignored > 0 && (
                                <Badge variant="secondary">
                                  {log.invoices_ignored} ignorados
                                </Badge>
                              )}
                            </div>
                          )}
                          {getStatusBadge(log.status)}
                          {expandedLogId === log.id ? (
                            <ChevronDown className="h-5 w-5" />
                          ) : (
                            <ChevronRight className="h-5 w-5" />
                          )}
                        </div>
                      </div>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <Separator />
                      <div className="p-4 bg-muted/30">
                        {log.error_message && (
                          <div className="text-red-600 text-sm mb-4 p-2 bg-red-50 rounded">
                            <strong>Erro:</strong> {log.error_message}
                          </div>
                        )}

                        {log.details?.items && log.details.items.length > 0 ? (
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Empresa</TableHead>
                                  <TableHead>Competência</TableHead>
                                  <TableHead>Vencimento</TableHead>
                                  <TableHead>Resultado</TableHead>
                                  <TableHead className="text-right">Valor Original</TableHead>
                                  <TableHead className="text-right">Valor Pago</TableHead>
                                  <TableHead className="text-right">Taxa</TableHead>
                                  <TableHead className="text-right">Valor Líquido</TableHead>
                                  <TableHead>Forma Pgto</TableHead>
                                  <TableHead>Data Pagamento</TableHead>
                                  <TableHead>Motivo</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {log.details.items.slice(0, 50).map((item: any, idx: number) => (
                                  <TableRow key={idx} className={item.result === "conciliated" ? "bg-green-50/50" : ""}>
                                    <TableCell className="font-medium">
                                      {item.employerName || "-"}
                                    </TableCell>
                                    <TableCell>{item.competence || "-"}</TableCell>
                                    <TableCell>
                                      {item.dueDate ? format(new Date(item.dueDate), "dd/MM/yyyy", { locale: ptBR }) : "-"}
                                    </TableCell>
                                    <TableCell>{getResultBadge(item.result)}</TableCell>
                                    <TableCell className="text-right">
                                      {item.originalValue ? formatCurrency(item.originalValue) : "-"}
                                    </TableCell>
                                    <TableCell className="text-right font-medium text-green-700">
                                      {item.paidValue ? formatCurrency(item.paidValue) : "-"}
                                    </TableCell>
                                    <TableCell className="text-right text-orange-600">
                                      {item.feeAmount ? formatCurrency(item.feeAmount) : "-"}
                                    </TableCell>
                                    <TableCell className="text-right font-medium">
                                      {item.netValue ? formatCurrency(item.netValue) : "-"}
                                    </TableCell>
                                    <TableCell>
                                      {getPaymentMethodLabel(item.paymentMethod)}
                                    </TableCell>
                                    <TableCell>
                                      {item.paidAt ? formatDateTime(item.paidAt) : "-"}
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate" title={item.reason}>
                                      {item.reason || "-"}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                            {log.details.items.length > 50 && (
                              <p className="text-sm text-muted-foreground text-center mt-2">
                                Exibindo 50 de {log.details.items.length} itens
                              </p>
                            )}
                            
                            {/* Resumo dos valores */}
                            {log.sync_type === "fetch_paid_invoices" && log.details.items.some((item: any) => item.result === "conciliated") && (
                              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                                <h4 className="font-medium text-green-800 mb-2">Resumo dos Boletos Conciliados</h4>
                                <div className="grid grid-cols-4 gap-4 text-sm">
                                  <div>
                                    <span className="text-muted-foreground">Total Pago:</span>
                                    <p className="font-bold text-green-700">
                                      {formatCurrency(
                                        log.details.items
                                          .filter((item: any) => item.result === "conciliated")
                                          .reduce((sum: number, item: any) => sum + (item.paidValue || 0), 0)
                                      )}
                                    </p>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Total Taxas:</span>
                                    <p className="font-bold text-orange-600">
                                      {formatCurrency(
                                        log.details.items
                                          .filter((item: any) => item.result === "conciliated")
                                          .reduce((sum: number, item: any) => sum + (item.feeAmount || 0), 0)
                                      )}
                                    </p>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Total Líquido:</span>
                                    <p className="font-bold text-primary">
                                      {formatCurrency(
                                        log.details.items
                                          .filter((item: any) => item.result === "conciliated")
                                          .reduce((sum: number, item: any) => sum + (item.netValue || 0), 0)
                                      )}
                                    </p>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Qtd Boletos:</span>
                                    <p className="font-bold">
                                      {log.details.items.filter((item: any) => item.result === "conciliated").length}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            Sem detalhes disponíveis
                          </p>
                        )}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="flex justify-between items-center pt-4 border-t">
          <Button variant="outline" size="sm" onClick={fetchLogs}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
