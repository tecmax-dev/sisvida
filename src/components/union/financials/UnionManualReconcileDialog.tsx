import { useState, useMemo } from "react";
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
import { Search, Link2, CheckCircle2, AlertTriangle } from "lucide-react";
import { BankStatementTransaction } from "@/hooks/useUnionReconciliation";

interface PendingExpense {
  id: string;
  description: string;
  amount: number;
  status: string;
  check_number: string | null;
  due_date: string;
  paid_date: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  statementTransaction: BankStatementTransaction | null;
  pendingExpenses: PendingExpense[];
  onReconcile: (statementTxId: string, financialTxIds: string[], notes?: string) => void;
  isReconciling?: boolean;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export function UnionManualReconcileDialog({
  open,
  onOpenChange,
  statementTransaction,
  pendingExpenses,
  onReconcile,
  isReconciling,
}: Props) {
  const [search, setSearch] = useState("");
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return pendingExpenses.filter(
      (e) =>
        e.description?.toLowerCase().includes(s) ||
        e.check_number?.includes(search)
    );
  }, [pendingExpenses, search]);

  const selectedTotal = useMemo(() => {
    return pendingExpenses
      .filter((e) => selectedExpenseIds.includes(e.id))
      .reduce((sum, e) => sum + e.amount, 0);
  }, [pendingExpenses, selectedExpenseIds]);

  const statementAmount = statementTransaction?.amount ?? 0;
  const difference = Math.abs(selectedTotal - statementAmount);
  const isExactMatch = difference < 0.01;
  const canConfirm = selectedExpenseIds.length > 0 && isExactMatch;

  const toggleExpense = (id: string) => {
    setSelectedExpenseIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleConfirm = () => {
    if (!statementTransaction || !canConfirm) return;
    onReconcile(statementTransaction.id, selectedExpenseIds, notes || undefined);
    setSelectedExpenseIds([]);
    setNotes("");
    setSearch("");
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setSelectedExpenseIds([]);
      setNotes("");
      setSearch("");
    }
    onOpenChange(v);
  };

  if (!statementTransaction) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Vincular Despesa(s)</DialogTitle>
        </DialogHeader>

        {/* Statement transaction info */}
        <div className="bg-muted/50 rounded-md p-3 text-sm mb-2">
          <p className="font-medium">{statementTransaction.description || "Sem descrição"}</p>
          <div className="flex items-center gap-3 mt-1 text-muted-foreground">
            <span className="text-rose-600 font-medium">
              - {formatCurrency(statementAmount)}
            </span>
            <span>{statementTransaction.transaction_date}</span>
            {statementTransaction.check_number && (
              <Badge variant="outline" className="font-mono text-xs">
                Cheque {statementTransaction.check_number}
              </Badge>
            )}
          </div>
        </div>

        {/* Running total indicator */}
        <div className={`rounded-md p-2.5 text-sm flex items-center justify-between ${
          selectedExpenseIds.length === 0
            ? "bg-muted/30"
            : isExactMatch
            ? "bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800"
            : "bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800"
        }`}>
          <div className="flex items-center gap-2">
            {selectedExpenseIds.length > 0 && !isExactMatch && (
              <AlertTriangle className="h-4 w-4 text-amber-600" />
            )}
            {isExactMatch && selectedExpenseIds.length > 0 && (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            )}
            <span>
              {selectedExpenseIds.length} despesa(s) selecionada(s)
            </span>
          </div>
          <div className="text-right">
            <span className="font-medium">
              Soma: {formatCurrency(selectedTotal)}
            </span>
            {selectedExpenseIds.length > 0 && !isExactMatch && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Diferença: {formatCurrency(difference)}
              </p>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar despesa por descrição ou cheque..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Expense list (multi-select) */}
        <ScrollArea className="h-[250px] border rounded-md">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground text-sm">
              Nenhuma despesa pendente encontrada
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((exp) => {
                const isSelected = selectedExpenseIds.includes(exp.id);
                return (
                  <button
                    key={exp.id}
                    type="button"
                    className={`w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors flex items-center justify-between ${
                      isSelected ? "bg-primary/10 ring-1 ring-primary" : ""
                    }`}
                    onClick={() => toggleExpense(exp.id)}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{exp.description}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span>{exp.due_date}</span>
                        {exp.check_number && <span>Cheque: {exp.check_number}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      <span className="text-sm font-medium text-rose-600 whitespace-nowrap">
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

        <Textarea
          placeholder="Observações (opcional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canConfirm || isReconciling}
          >
            <Link2 className="h-4 w-4 mr-2" />
            {isReconciling ? "Vinculando..." : `Vincular ${selectedExpenseIds.length} despesa(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
