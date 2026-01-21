import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { PopupBase, PopupHeader, PopupTitle, PopupDescription } from "@/components/ui/popup-base";
import { format, subDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Shield, 
  Search, 
  FileText, 
  Eye, 
  Download,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Edit,
  Trash2,
  ArrowDownCircle
} from "lucide-react";

interface FinancialAuditPanelProps {
  clinicId: string;
}

const actionLabels: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  create: { label: "Criação", color: "bg-green-100 text-green-800", icon: CheckCircle },
  update: { label: "Atualização", color: "bg-blue-100 text-blue-800", icon: Edit },
  delete: { label: "Exclusão", color: "bg-red-100 text-red-800", icon: Trash2 },
  liquidate: { label: "Liquidação", color: "bg-emerald-100 text-emerald-800", icon: ArrowDownCircle },
  cancel: { label: "Cancelamento", color: "bg-orange-100 text-orange-800", icon: XCircle },
  reverse: { label: "Estorno", color: "bg-purple-100 text-purple-800", icon: AlertTriangle },
};

export function FinancialAuditPanel({ clinicId }: FinancialAuditPanelProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [entityFilter, setEntityFilter] = useState("all");
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  const { data: auditLogs, isLoading } = useQuery({
    queryKey: ["financial-audit-logs", clinicId, startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_audit_logs")
        .select("*")
        .eq("clinic_id", clinicId)
        .gte("created_at", startDate)
        .lte("created_at", endDate + "T23:59:59")
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;
      return data;
    },
  });

  const filteredLogs = auditLogs?.filter((log) => {
    const matchesSearch = 
      log.entity_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.notes?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesAction = actionFilter === "all" || log.action === actionFilter;
    const matchesEntity = entityFilter === "all" || log.entity_type === entityFilter;

    return matchesSearch && matchesAction && matchesEntity;
  });

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return "-";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDateTime = (date: string) => {
    return format(parseISO(date), "dd/MM/yyyy HH:mm", { locale: ptBR });
  };

  const openDetailDialog = (log: any) => {
    setSelectedLog(log);
    setDetailDialogOpen(true);
  };

  const closeDetailDialog = () => {
    setDetailDialogOpen(false);
    setSelectedLog(null);
  };

  // Calculate summary stats
  const stats = {
    total: filteredLogs?.length || 0,
    creates: filteredLogs?.filter(l => l.action === "create").length || 0,
    updates: filteredLogs?.filter(l => l.action === "update").length || 0,
    deletes: filteredLogs?.filter(l => l.action === "delete").length || 0,
    liquidations: filteredLogs?.filter(l => l.action === "liquidate").length || 0,
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Auditoria Financeira</CardTitle>
                <CardDescription>
                  Histórico completo de operações financeiras
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <Card className="bg-muted/50">
          <CardContent className="pt-4">
            <div className="text-center">
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total de Logs</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 dark:bg-green-900/20">
          <CardContent className="pt-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{stats.creates}</p>
              <p className="text-xs text-muted-foreground">Criações</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 dark:bg-blue-900/20">
          <CardContent className="pt-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{stats.updates}</p>
              <p className="text-xs text-muted-foreground">Atualizações</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-emerald-50 dark:bg-emerald-900/20">
          <CardContent className="pt-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-emerald-600">{stats.liquidations}</p>
              <p className="text-xs text-muted-foreground">Liquidações</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-red-50 dark:bg-red-900/20">
          <CardContent className="pt-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">{stats.deletes}</p>
              <p className="text-xs text-muted-foreground">Exclusões</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-[140px]"
              />
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-[140px]"
              />
            </div>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Ação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas ações</SelectItem>
                <SelectItem value="create">Criação</SelectItem>
                <SelectItem value="update">Atualização</SelectItem>
                <SelectItem value="liquidate">Liquidação</SelectItem>
                <SelectItem value="cancel">Cancelamento</SelectItem>
                <SelectItem value="delete">Exclusão</SelectItem>
              </SelectContent>
            </Select>
            <Select value={entityFilter} onValueChange={setEntityFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Entidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas entidades</SelectItem>
                <SelectItem value="financial_transactions">Transações</SelectItem>
                <SelectItem value="suppliers">Fornecedores</SelectItem>
                <SelectItem value="cash_registers">Portadores</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Entidade</TableHead>
                  <TableHead className="text-right">Valor Anterior</TableHead>
                  <TableHead className="text-right">Valor Atual</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead className="text-center">Detalhes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhum registro de auditoria encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs?.map((log) => {
                    const actionConfig = actionLabels[log.action] || { 
                      label: log.action, 
                      color: "bg-gray-100 text-gray-800",
                      icon: FileText 
                    };
                    const Icon = actionConfig.icon;

                    return (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap">
                          {formatDateTime(log.created_at)}
                        </TableCell>
                        <TableCell>
                          <Badge className={`${actionConfig.color} gap-1`}>
                            <Icon className="h-3 w-3" />
                            {actionConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="capitalize">
                            {log.entity_type?.replace(/_/g, " ")}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(log.amount_before)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(log.amount_after)}
                        </TableCell>
                        <TableCell>
                          {log.user_name || log.user_id?.slice(0, 8) + "..."}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDetailDialog(log)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Detail Popup */}
      <PopupBase 
        open={detailDialogOpen} 
        onClose={closeDetailDialog}
        maxWidth="2xl"
      >
        <PopupHeader>
          <PopupTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Detalhes da Auditoria
          </PopupTitle>
          <PopupDescription>
            Informações completas do registro de auditoria
          </PopupDescription>
        </PopupHeader>
        {selectedLog && (
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4 pr-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Data/Hora</p>
                  <p className="font-medium">{formatDateTime(selectedLog.created_at)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Ação</p>
                  <Badge className={actionLabels[selectedLog.action]?.color || ""}>
                    {actionLabels[selectedLog.action]?.label || selectedLog.action}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Entidade</p>
                  <p className="font-medium capitalize">{selectedLog.entity_type?.replace(/_/g, " ")}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">ID da Entidade</p>
                  <p className="font-mono text-sm">{selectedLog.entity_id}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Valor Anterior</p>
                  <p className="font-medium">{formatCurrency(selectedLog.amount_before)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Valor Atual</p>
                  <p className="font-medium">{formatCurrency(selectedLog.amount_after)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Usuário</p>
                  <p className="font-medium">{selectedLog.user_name || selectedLog.user_id}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">IP</p>
                  <p className="font-mono text-sm">{selectedLog.ip_address || "-"}</p>
                </div>
              </div>

              {selectedLog.notes && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Observações</p>
                  <p className="text-sm bg-muted p-2 rounded">{selectedLog.notes}</p>
                </div>
              )}

              {selectedLog.old_data && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Dados Anteriores</p>
                  <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40">
                    {JSON.stringify(selectedLog.old_data, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.new_data && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Dados Atuais</p>
                  <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40">
                    {JSON.stringify(selectedLog.new_data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </PopupBase>
    </div>
  );
}
