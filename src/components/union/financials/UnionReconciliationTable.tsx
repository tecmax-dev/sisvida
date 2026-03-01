import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CheckCircle2,
  AlertCircle,
  XCircle,
  MoreHorizontal,
  Link2,
  Unlink,
  Eye,
  Search,
  CheckCheck,
  FileText,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BankStatementTransaction } from "@/hooks/useUnionReconciliation";

interface UnionReconciliationTableProps {
  transactions: BankStatementTransaction[];
  onManualReconcile: (statementTxId: string) => void;
  onUndoReconciliation: (statementTxIds: string[]) => void;
  onViewDetails: (tx: BankStatementTransaction) => void;
  onMarkVerified?: (statementTxId: string) => void;
  onGenerateEntry?: (tx: BankStatementTransaction) => void;
  onBatchGenerateEntry?: (txs: BankStatementTransaction[]) => void;
  isUndoing?: boolean;
}

export function UnionReconciliationTable({
  transactions,
  onManualReconcile,
  onUndoReconciliation,
  onViewDetails,
  onMarkVerified,
  onGenerateEntry,
  onBatchGenerateEntry,
  isUndoing,
}: UnionReconciliationTableProps) {
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  const getStatusBadge = (status: BankStatementTransaction["reconciliation_status"]) => {
    switch (status) {
      case "auto_reconciled":
        return (
          <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Auto Conciliado
          </Badge>
        );
      case "manual_reconciled":
        return (
          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Conciliado Manual
          </Badge>
        );
      case "pending_review":
        return (
          <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
            <AlertCircle className="h-3 w-3 mr-1" />
            Pendente Revisão
          </Badge>
        );
      case "not_identified":
        return (
          <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200">
            <XCircle className="h-3 w-3 mr-1" />
            Não Identificado
          </Badge>
        );
      case "ignored":
        return (
          <Badge variant="secondary">
            Ignorado
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredTransactions = transactions.filter((tx) => {
    const searchLower = search.toLowerCase();
    return (
      tx.description?.toLowerCase().includes(searchLower) ||
      tx.check_number?.includes(search) ||
      tx.document_number?.includes(search)
    );
  });

  const isSelectableForGenerate = (tx: BankStatementTransaction) =>
    !tx.matched_transaction_id &&
    tx.reconciliation_status !== "auto_reconciled" &&
    tx.reconciliation_status !== "manual_reconciled" &&
    tx.reconciliation_status !== "ignored" &&
    !(tx as any).generated_transaction_id;

  const isReconciled = (tx: BankStatementTransaction) =>
    tx.reconciliation_status === "auto_reconciled" ||
    tx.reconciliation_status === "manual_reconciled";

  const canGenerateEntry = (tx: BankStatementTransaction) =>
    isSelectableForGenerate(tx);

  const stats = {
    total: transactions.length,
    autoReconciled: transactions.filter((t) => t.reconciliation_status === "auto_reconciled").length,
    manualReconciled: transactions.filter((t) => t.reconciliation_status === "manual_reconciled").length,
    pendingReview: transactions.filter((t) => t.reconciliation_status === "pending_review").length,
    notIdentified: transactions.filter((t) => t.reconciliation_status === "not_identified").length,
  };

  const allSelectable = useMemo(() => {
    return filteredTransactions.filter(
      (tx) => isSelectableForGenerate(tx) || isReconciled(tx)
    );
  }, [filteredTransactions]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === allSelectable.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allSelectable.map((t) => t.id)));
    }
  };

  const selectedTransactions = useMemo(
    () => transactions.filter((t) => selectedIds.has(t.id)),
    [transactions, selectedIds]
  );

  const selectedForGenerate = useMemo(
    () => selectedTransactions.filter(isSelectableForGenerate),
    [selectedTransactions]
  );

  const selectedForUndo = useMemo(
    () => selectedTransactions.filter(isReconciled),
    [selectedTransactions]
  );

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="flex flex-wrap gap-3 text-sm">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-md">
          <span className="text-muted-foreground">Total:</span>
          <span className="font-medium">{stats.total}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-md">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span className="text-emerald-700 dark:text-emerald-300">
            {stats.autoReconciled + stats.manualReconciled} Conciliados
          </span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 rounded-md">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <span className="text-amber-700 dark:text-amber-300">
            {stats.pendingReview} Pendentes
          </span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 dark:bg-rose-900/20 rounded-md">
          <XCircle className="h-4 w-4 text-rose-600" />
          <span className="text-rose-700 dark:text-rose-300">
            {stats.notIdentified} Não Identificados
          </span>
        </div>
      </div>

      {/* Search + Batch Actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por descrição, cheque..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {selectedForGenerate.length > 0 && onBatchGenerateEntry && (
          <Button
            size="sm"
            onClick={() => onBatchGenerateEntry(selectedForGenerate)}
          >
            <FileText className="h-4 w-4 mr-2" />
            Gerar {selectedForGenerate.length} Lançamento(s)
          </Button>
        )}
        {selectedForUndo.length > 0 && (
          <Button
            size="sm"
            variant="destructive"
            onClick={() => {
              onUndoReconciliation(selectedForUndo.map((t) => t.id));
              setSelectedIds(new Set());
            }}
            disabled={isUndoing}
          >
            <Unlink className="h-4 w-4 mr-2" />
            Desfazer {selectedForUndo.length} Conciliação(ões)
          </Button>
        )}
      </div>

      {/* Table */}
      <ScrollArea className="h-[400px] border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              {onBatchGenerateEntry && (
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelectable.length > 0 && selectedIds.size === allSelectable.length}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Selecionar todos"
                  />
                </TableHead>
              )}
              <TableHead>Data</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Nº Cheque</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Vinculado a</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTransactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={onBatchGenerateEntry ? 8 : 7} className="text-center py-8 text-muted-foreground">
                  Nenhuma transação encontrada
                </TableCell>
              </TableRow>
            ) : (
              filteredTransactions.map((tx) => (
                <TableRow
                  key={tx.id}
                  className={
                    tx.reconciliation_status === "auto_reconciled" ||
                    tx.reconciliation_status === "manual_reconciled"
                      ? "bg-emerald-50/50 dark:bg-emerald-900/10"
                      : tx.reconciliation_status === "pending_review"
                      ? "bg-amber-50/50 dark:bg-amber-900/10"
                      : tx.reconciliation_status === "not_identified"
                      ? "bg-rose-50/50 dark:bg-rose-900/10"
                      : ""
                  }
                >
                  {onBatchGenerateEntry && (
                    <TableCell>
                      {(isSelectableForGenerate(tx) || isReconciled(tx)) ? (
                        <Checkbox
                          checked={selectedIds.has(tx.id)}
                          onCheckedChange={() => toggleSelect(tx.id)}
                          aria-label="Selecionar"
                        />
                      ) : null}
                    </TableCell>
                  )}
                  <TableCell>
                    {format(parseISO(tx.transaction_date), "dd/MM/yyyy", { locale: ptBR })}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate font-medium">
                    {tx.description || "—"}
                  </TableCell>
                  <TableCell>
                    {tx.check_number ? (
                      <Badge variant="outline" className="font-mono">
                        {tx.check_number}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>{getStatusBadge(tx.reconciliation_status)}</TableCell>
                  <TableCell>
                    {tx.matched_transaction ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-1 text-sm">
                              <Link2 className="h-3 w-3 text-emerald-600" />
                              <span className="max-w-[150px] truncate">
                                {tx.matched_transaction.description}
                              </span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{tx.matched_transaction.description}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatCurrency(tx.matched_transaction.amount)}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (tx as any).generated_transaction_id ? (
                      <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-900/20">
                        <FileText className="h-3 w-3 mr-1" />
                        Lançamento Gerado
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell
                    className={`text-right font-medium ${
                      tx.transaction_type === "credit" ? "text-emerald-600" : "text-rose-600"
                    }`}
                  >
                    {tx.transaction_type === "debit" ? "- " : "+ "}
                    {formatCurrency(tx.amount)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onViewDetails(tx)}>
                          <Eye className="h-4 w-4 mr-2" />
                          Ver Detalhes
                        </DropdownMenuItem>
                        {canGenerateEntry(tx) && onGenerateEntry && (
                          <DropdownMenuItem onClick={() => onGenerateEntry(tx)}>
                            <FileText className="h-4 w-4 mr-2" />
                            Gerar Lançamento
                          </DropdownMenuItem>
                        )}
                        {!tx.matched_transaction_id &&
                          tx.reconciliation_status !== "ignored" &&
                          tx.reconciliation_status !== "manual_reconciled" && (
                            <DropdownMenuItem onClick={() => onManualReconcile(tx.id)}>
                              <Link2 className="h-4 w-4 mr-2" />
                              {tx.transaction_type === "credit" ? "Vincular Receita" : "Vincular Despesa"}
                            </DropdownMenuItem>
                          )}
                        {!tx.matched_transaction_id &&
                          tx.reconciliation_status !== "ignored" &&
                          tx.reconciliation_status !== "auto_reconciled" &&
                          tx.reconciliation_status !== "manual_reconciled" &&
                          onMarkVerified && (
                            <DropdownMenuItem onClick={() => onMarkVerified(tx.id)}>
                              <CheckCheck className="h-4 w-4 mr-2" />
                              Marcar como Conferida
                            </DropdownMenuItem>
                          )}
                        {isReconciled(tx) && (
                          <DropdownMenuItem
                            onClick={() => onUndoReconciliation([tx.id])}
                            className="text-rose-600"
                            disabled={isUndoing}
                          >
                            <Unlink className="h-4 w-4 mr-2" />
                            Desfazer Conciliação
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  );
}
