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
import { Search, Link2, CheckCircle2 } from "lucide-react";
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
  onReconcile: (statementTxId: string, financialTxId: string, notes?: string) => void;
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
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return pendingExpenses.filter(
      (e) =>
        e.description?.toLowerCase().includes(s) ||
        e.check_number?.includes(search)
    );
  }, [pendingExpenses, search]);

  const handleConfirm = () => {
    if (!statementTransaction || !selectedExpenseId) return;
    onReconcile(statementTransaction.id, selectedExpenseId, notes || undefined);
    setSelectedExpenseId(null);
    setNotes("");
    setSearch("");
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setSelectedExpenseId(null);
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
          <DialogTitle>Vincular Despesa</DialogTitle>
        </DialogHeader>

        <div className="bg-muted/50 rounded-md p-3 text-sm mb-2">
          <p className="font-medium">{statementTransaction.description || "Sem descrição"}</p>
          <div className="flex items-center gap-3 mt-1 text-muted-foreground">
            <span className="text-rose-600 font-medium">
              - {formatCurrency(statementTransaction.amount)}
            </span>
            <span>{statementTransaction.transaction_date}</span>
            {statementTransaction.check_number && (
              <Badge variant="outline" className="font-mono text-xs">
                Cheque {statementTransaction.check_number}
              </Badge>
            )}
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar despesa por descrição ou cheque..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <ScrollArea className="h-[250px] border rounded-md">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground text-sm">
              Nenhuma despesa pendente encontrada
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((exp) => (
                <button
                  key={exp.id}
                  type="button"
                  className={`w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors flex items-center justify-between ${
                    selectedExpenseId === exp.id ? "bg-primary/10 ring-1 ring-primary" : ""
                  }`}
                  onClick={() => setSelectedExpenseId(exp.id)}
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
                    {selectedExpenseId === exp.id && (
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                    )}
                  </div>
                </button>
              ))}
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
            disabled={!selectedExpenseId || isReconciling}
          >
            <Link2 className="h-4 w-4 mr-2" />
            {isReconciling ? "Vinculando..." : "Vincular"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
