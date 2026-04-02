import { useState, useMemo, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Link2, CheckCircle2, AlertTriangle, Hash, Building2, Info, ArrowRightLeft } from "lucide-react";
import { BankStatementTransaction, normalizeCheckNumber } from "@/hooks/useUnionReconciliation";

interface PendingExpense {
  id: string;
  description: string;
  amount: number;
  status: string;
  check_number: string | null;
  due_date: string;
  paid_date: string | null;
  cash_register_id?: string | null;
}

export interface PendingTransfer {
  id: string;
  amount: number;
  transfer_date: string;
  description: string | null;
  check_number: string | null;
  from_register_id: string;
  to_register_id: string;
  is_conciliated_from: boolean;
  is_conciliated_to: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  statementTransaction: BankStatementTransaction | null;
  pendingExpenses: PendingExpense[];
  pendingTransfers?: PendingTransfer[];
  onReconcile: (statementTxId: string, financialTxIds: string[], notes?: string) => void;
  isReconciling?: boolean;
  cashRegisterName?: string;
  cashRegisters?: { id: string; name: string }[];
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export function UnionManualReconcileDialog({
  open,
  onOpenChange,
  statementTransaction,
  pendingExpenses,
  pendingTransfers = [],
  onReconcile,
  isReconciling,
  cashRegisterName,
  cashRegisters = [],
}: Props) {
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [activeTab, setActiveTab] = useState<"expenses" | "transfers">("expenses");

  const statementCheckNorm = normalizeCheckNumber(statementTransaction?.check_number);
  const statementCashRegisterId = statementTransaction?.cash_register_id;

  // Filter expenses to only those belonging to the same cash register (portador)
  const carrierFilteredExpenses = useMemo(() => {
    if (!statementCashRegisterId) return pendingExpenses;
    return pendingExpenses.filter((e) => e.cash_register_id === statementCashRegisterId);
  }, [pendingExpenses, statementCashRegisterId]);

  // Filter transfers relevant to this cash register and statement type
  const relevantTransfers = useMemo(() => {
    if (!statementCashRegisterId || !statementTransaction) return [];
    return pendingTransfers.filter((tr) => {
      if (statementTransaction.transaction_type === "debit") {
        // Debit = outflow from this account
        return tr.from_register_id === statementCashRegisterId && !tr.is_conciliated_from;
      } else {
        // Credit = inflow to this account
        return tr.to_register_id === statementCashRegisterId && !tr.is_conciliated_to;
      }
    });
  }, [pendingTransfers, statementCashRegisterId, statementTransaction]);

  // Auto-select expenses matching the statement check number when dialog opens
  useEffect(() => {
    if (!open || !statementTransaction) return;

    if (statementCheckNorm) {
      // Check expenses
      const matchingExpenseIds = carrierFilteredExpenses
        .filter((e) => normalizeCheckNumber(e.check_number) === statementCheckNorm)
        .map((e) => e.id);
      
      // Check transfers
      const matchingTransferIds = relevantTransfers
        .filter((tr) => normalizeCheckNumber(tr.check_number) === statementCheckNorm)
        .map((tr) => {
          const side = statementTransaction.transaction_type === "debit" ? "from" : "to";
          return `transfer:${tr.id}:${side}`;
        });

      if (matchingTransferIds.length > 0 && matchingExpenseIds.length === 0) {
        setSelectedIds(matchingTransferIds);
        setActiveTab("transfers");
      } else {
        setSelectedIds(matchingExpenseIds);
        setActiveTab("expenses");
      }
      setSearch(statementTransaction.check_number || "");
    } else {
      setSelectedIds([]);
      setSearch("");
      setActiveTab("expenses");
    }
    setNotes("");
  }, [open, statementTransaction?.id]);

  // Filter expenses by search text
  const filteredExpenses = useMemo(() => {
    const s = search.toLowerCase();
    return carrierFilteredExpenses.filter(
      (e) =>
        e.description?.toLowerCase().includes(s) ||
        e.check_number?.includes(search)
    );
  }, [carrierFilteredExpenses, search]);

  // Filter transfers by search text
  const filteredTransfers = useMemo(() => {
    const s = search.toLowerCase();
    return relevantTransfers.filter(
      (tr) =>
        tr.description?.toLowerCase().includes(s) ||
        tr.check_number?.includes(search) ||
        String(tr.amount).includes(search)
    );
  }, [relevantTransfers, search]);

  // Sort expenses
  const sortedExpenses = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    return [...filteredExpenses].sort((a, b) => {
      const aDate = a.due_date ? new Date(a.due_date + "T12:00:00") : null;
      const bDate = b.due_date ? new Date(b.due_date + "T12:00:00") : null;
      const aCurrentMonth = aDate && aDate.getFullYear() === currentYear && aDate.getMonth() === currentMonth ? 0 : 1;
      const bCurrentMonth = bDate && bDate.getFullYear() === currentYear && bDate.getMonth() === currentMonth ? 0 : 1;
      if (aCurrentMonth !== bCurrentMonth) return aCurrentMonth - bCurrentMonth;

      if (statementCheckNorm) {
        const aMatch = normalizeCheckNumber(a.check_number) === statementCheckNorm ? 0 : 1;
        const bMatch = normalizeCheckNumber(b.check_number) === statementCheckNorm ? 0 : 1;
        if (aMatch !== bMatch) return aMatch - bMatch;
      }

      const aTime = aDate?.getTime() ?? 0;
      const bTime = bDate?.getTime() ?? 0;
      return aTime - bTime;
    });
  }, [filteredExpenses, statementCheckNorm]);

  // Calculate selected total (handles both expenses and transfers)
  const selectedTotal = useMemo(() => {
    let total = 0;
    for (const id of selectedIds) {
      if (id.startsWith("transfer:")) {
        const transferId = id.split(":")[1];
        const tr = relevantTransfers.find((t) => t.id === transferId);
        if (tr) total += tr.amount;
      } else {
        const exp = carrierFilteredExpenses.find((e) => e.id === id);
        if (exp) total += exp.amount;
      }
    }
    return total;
  }, [selectedIds, carrierFilteredExpenses, relevantTransfers]);

  const statementAmount = statementTransaction?.amount ?? 0;
  const difference = Math.abs(selectedTotal - statementAmount);
  const isExactMatch = difference < 0.01;
  const canConfirm = selectedIds.length > 0 && isExactMatch;

  const toggleItem = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleConfirm = () => {
    if (!statementTransaction || !canConfirm) return;
    onReconcile(statementTransaction.id, selectedIds, notes || undefined);
    setSelectedIds([]);
    setNotes("");
    setSearch("");
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setSelectedIds([]);
      setNotes("");
      setSearch("");
    }
    onOpenChange(v);
  };

  const getRegisterName = (registerId: string) => {
    return cashRegisters.find((cr) => cr.id === registerId)?.name || "—";
  };

  if (!statementTransaction) return null;

  const typeLabel = statementTransaction.transaction_type === "credit" ? "receita" : "despesa";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="!max-w-[95vw] sm:!max-w-lg w-full overflow-x-hidden overflow-y-auto max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            Vincular {statementTransaction.transaction_type === "credit" ? "Receita(s)" : "Despesa(s)"} / Transferência
          </DialogTitle>
        </DialogHeader>

        {/* Carrier context banner */}
        {cashRegisterName && (
          <div className="flex items-center gap-2 rounded-md bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-3 py-2 text-sm">
            <Building2 className="h-4 w-4 text-blue-600 shrink-0" />
            <span>
              Portador: <strong>{cashRegisterName}</strong>
            </span>
          </div>
        )}

        {/* Statement transaction info */}
        <div className="bg-muted/50 rounded-md p-3 text-sm min-w-0">
          <p className="font-medium truncate">{statementTransaction.description || "Sem descrição"}</p>
          <div className="flex flex-wrap items-center gap-2 mt-1 text-muted-foreground">
            <span className={statementTransaction.transaction_type === "credit" ? "text-emerald-600 font-medium" : "text-rose-600 font-medium"}>
              {statementTransaction.transaction_type === "credit" ? "+ " : "- "}{formatCurrency(statementAmount)}
            </span>
            <span className="text-xs">{statementTransaction.transaction_date}</span>
            {statementTransaction.check_number && (
              <Badge variant="outline" className="font-mono text-xs shrink-0">
                <Hash className="h-3 w-3 mr-1" />
                Cheque {statementTransaction.check_number}
              </Badge>
            )}
          </div>
        </div>

        {/* Running total indicator */}
        <div className={`rounded-md p-2.5 text-sm flex flex-wrap items-center justify-between gap-1 ${
          selectedIds.length === 0
            ? "bg-muted/30"
            : isExactMatch
            ? "bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800"
            : "bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800"
        }`}>
          <div className="flex items-center gap-2 min-w-0">
            {selectedIds.length > 0 && !isExactMatch && (
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            )}
            {isExactMatch && selectedIds.length > 0 && (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            )}
            <span className="truncate">
              {selectedIds.length} item(ns) selecionado(s)
            </span>
          </div>
          <div className="text-right shrink-0">
            <span className="font-medium">
              Soma: {formatCurrency(selectedTotal)}
            </span>
            {selectedIds.length > 0 && !isExactMatch && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Diferença: {formatCurrency(difference)}
              </p>
            )}
            {isExactMatch && selectedIds.length > 0 && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400">
                ✓ Valor exato
              </p>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por descrição, cheque ou valor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Tabs for Expenses/Incomes vs Transfers */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="w-full">
            <TabsTrigger value="expenses" className="flex-1">
              {statementTransaction.transaction_type === "credit" ? "Receitas" : "Despesas"} ({carrierFilteredExpenses.length})
            </TabsTrigger>
            <TabsTrigger value="transfers" className="flex-1">
              <ArrowRightLeft className="h-3.5 w-3.5 mr-1.5" />
              Transferências ({relevantTransfers.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="expenses" className="mt-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
              <Info className="h-3.5 w-3.5" />
              <span>{carrierFilteredExpenses.length} {typeLabel}(s) disponíveis neste portador</span>
            </div>
            <ScrollArea className="h-[250px] border rounded-md">
              {sortedExpenses.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-sm">
                  {carrierFilteredExpenses.length === 0
                    ? `Nenhuma ${typeLabel} pendente encontrada para este portador`
                    : `Nenhuma ${typeLabel} encontrada com os filtros aplicados`}
                </div>
              ) : (
                <div className="divide-y">
                  {sortedExpenses.map((exp) => {
                    const isSelected = selectedIds.includes(exp.id);
                    const isCheckMatch = statementCheckNorm && normalizeCheckNumber(exp.check_number) === statementCheckNorm;
                    return (
                      <button
                        key={exp.id}
                        type="button"
                        className={`w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors flex items-center justify-between gap-2 min-w-0 ${
                          isSelected ? "bg-primary/10 ring-1 ring-primary" : ""
                        } ${isCheckMatch && !isSelected ? "bg-emerald-50/50 dark:bg-emerald-900/10" : ""}`}
                        onClick={() => toggleItem(exp.id)}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{exp.description}</p>
                          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                            <span>{exp.due_date}</span>
                            {exp.check_number && (
                              <Badge
                                variant={isCheckMatch ? "default" : "outline"}
                                className={`font-mono text-xs shrink-0 ${isCheckMatch ? "bg-emerald-600 text-white" : ""}`}
                              >
                                <Hash className="h-2.5 w-2.5 mr-0.5" />
                                {exp.check_number}
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-xs shrink-0">
                              {exp.status === "paid" ? "Pago" : "Pendente"}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={`text-sm font-medium whitespace-nowrap ${statementTransaction.transaction_type === "credit" ? "text-emerald-600" : "text-rose-600"}`}>
                            {formatCurrency(exp.amount)}
                          </span>
                          {isSelected && (
                            <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="transfers" className="mt-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
              <Info className="h-3.5 w-3.5" />
              <span>{relevantTransfers.length} transferência(s) pendentes de conciliação</span>
            </div>
            <ScrollArea className="h-[250px] border rounded-md">
              {filteredTransfers.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-sm">
                  Nenhuma transferência pendente encontrada para este portador
                </div>
              ) : (
                <div className="divide-y">
                  {filteredTransfers.map((tr) => {
                    const side = statementTransaction.transaction_type === "debit" ? "from" : "to";
                    const transferItemId = `transfer:${tr.id}:${side}`;
                    const isSelected = selectedIds.includes(transferItemId);
                    const isCheckMatch = statementCheckNorm && normalizeCheckNumber(tr.check_number) === statementCheckNorm;
                    const fromName = getRegisterName(tr.from_register_id);
                    const toName = getRegisterName(tr.to_register_id);

                    return (
                      <button
                        key={tr.id}
                        type="button"
                        className={`w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors flex items-center justify-between gap-2 min-w-0 ${
                          isSelected ? "bg-primary/10 ring-1 ring-primary" : ""
                        } ${isCheckMatch && !isSelected ? "bg-emerald-50/50 dark:bg-emerald-900/10" : ""}`}
                        onClick={() => toggleItem(transferItemId)}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <ArrowRightLeft className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                            <p className="text-sm font-medium truncate">
                              {tr.description || `Transferência ${fromName} → ${toName}`}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                            <span>{tr.transfer_date}</span>
                            <Badge variant="outline" className="text-xs shrink-0 bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-300 dark:border-indigo-800">
                              <ArrowRightLeft className="h-2.5 w-2.5 mr-0.5" />
                              {fromName} → {toName}
                            </Badge>
                            {tr.check_number && (
                              <Badge
                                variant={isCheckMatch ? "default" : "outline"}
                                className={`font-mono text-xs shrink-0 ${isCheckMatch ? "bg-emerald-600 text-white" : ""}`}
                              >
                                <Hash className="h-2.5 w-2.5 mr-0.5" />
                                {tr.check_number}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-sm font-medium whitespace-nowrap text-indigo-600 dark:text-indigo-400">
                            {formatCurrency(tr.amount)}
                          </span>
                          {isSelected && (
                            <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <Textarea
          placeholder="Observações (opcional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)} className="w-full sm:w-auto">
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canConfirm || isReconciling}
            className="w-full sm:w-auto"
          >
            <Link2 className="h-4 w-4 mr-2 shrink-0" />
            <span className="truncate">
              {isReconciling ? "Vinculando..." : `Vincular ${selectedIds.length} item(ns)`}
            </span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
