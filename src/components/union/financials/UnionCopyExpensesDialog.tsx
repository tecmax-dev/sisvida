import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, Copy, Search, Calendar, Hash } from "lucide-react";

interface UnionCopyExpensesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clinicId: string;
}

export function UnionCopyExpensesDialog({
  open,
  onOpenChange,
  clinicId,
}: UnionCopyExpensesDialogProps) {
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [newDueDate, setNewDueDate] = useState("");
  const [newCheckNumber, setNewCheckNumber] = useState("");
  const [search, setSearch] = useState("");

  const { data: expenses, isLoading } = useQuery({
    queryKey: ["union-copy-expenses", clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("union_financial_transactions")
        .select(`
          *,
          category:union_financial_categories(id, name, color),
          supplier:union_suppliers(id, name),
          cash_register:union_cash_registers(id, name)
        `)
        .eq("clinic_id", clinicId)
        .eq("type", "expense")
        .order("due_date", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
    enabled: open && !!clinicId,
  });

  const filteredExpenses = useMemo(() => {
    if (!expenses) return [];
    if (!search) return expenses;
    const s = search.toLowerCase();
    return expenses.filter(
      (e) =>
        e.description.toLowerCase().includes(s) ||
        e.supplier?.name?.toLowerCase().includes(s) ||
        e.check_number?.toLowerCase().includes(s)
    );
  }, [expenses, search]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredExpenses.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredExpenses.map((e) => e.id));
    }
  };

  const copyMutation = useMutation({
    mutationFn: async () => {
      if (!newDueDate) throw new Error("Informe a nova data de vencimento.");
      if (selectedIds.length === 0) throw new Error("Selecione ao menos uma despesa.");

      const selected = expenses?.filter((e) => selectedIds.includes(e.id)) || [];

      const newRecords = selected.map((e) => ({
        clinic_id: e.clinic_id,
        type: e.type,
        description: e.description,
        amount: e.amount,
        net_value: e.net_value,
        discount_value: e.discount_value,
        interest_value: e.interest_value,
        due_date: newDueDate,
        category_id: e.category_id,
        supplier_id: e.supplier_id,
        cash_register_id: e.cash_register_id,
        cost_center_id: e.cost_center_id,
        payment_method: e.payment_method,
        check_number: newCheckNumber || e.check_number,
        document_number: e.document_number,
        notes: e.notes,
        status: "pending" as const,
        created_by: e.created_by,
      }));

      const { error } = await supabase
        .from("union_financial_transactions")
        .insert(newRecords);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["union-financial-transactions"] });
      toast.success(`${selectedIds.length} despesa(s) copiada(s) com sucesso!`);
      handleClose();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao copiar despesas");
    },
  });

  const handleClose = () => {
    setSelectedIds([]);
    setNewDueDate("");
    setNewCheckNumber("");
    setSearch("");
    onOpenChange(false);
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            Copiar Despesas
          </DialogTitle>
          <DialogDescription>
            Selecione as despesas que deseja copiar. Todos os dados serão duplicados com a nova data de vencimento e número de cheque informados.
          </DialogDescription>
        </DialogHeader>

        {/* New date & check number */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-sm">
              <Calendar className="h-3.5 w-3.5" />
              Nova Data de Vencimento *
            </Label>
            <Input
              type="date"
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-sm">
              <Hash className="h-3.5 w-3.5" />
              Novo Nº do Cheque (opcional)
            </Label>
            <Input
              placeholder="Ex: 1300"
              value={newCheckNumber}
              onChange={(e) => setNewCheckNumber(e.target.value)}
            />
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar despesas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>

        {/* Select all */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={filteredExpenses.length > 0 && selectedIds.length === filteredExpenses.length}
              onCheckedChange={toggleSelectAll}
            />
            <span className="text-muted-foreground">Selecionar todas</span>
          </div>
          <Badge variant="secondary">
            {selectedIds.length} selecionada(s)
          </Badge>
        </div>

        {/* List */}
        <ScrollArea className="flex-1 min-h-0 max-h-[350px] border rounded-md">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredExpenses.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Nenhuma despesa encontrada
            </div>
          ) : (
            <div className="divide-y">
              {filteredExpenses.map((expense) => (
                <label
                  key={expense.id}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer transition-colors"
                >
                  <Checkbox
                    checked={selectedIds.includes(expense.id)}
                    onCheckedChange={() => toggleSelect(expense.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{expense.description}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {expense.supplier?.name && (
                        <span>{expense.supplier.name}</span>
                      )}
                      {expense.category?.name && (
                        <>
                          <span>•</span>
                          <span>{expense.category.name}</span>
                        </>
                      )}
                      {expense.check_number && (
                        <>
                          <span>•</span>
                          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                            CH:{expense.check_number}
                          </Badge>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">
                      {formatCurrency(Number(expense.net_value || expense.amount))}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {expense.due_date
                        ? format(parseISO(expense.due_date), "dd/MM/yyyy", { locale: ptBR })
                        : "—"}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => copyMutation.mutate()}
            disabled={copyMutation.isPending || selectedIds.length === 0 || !newDueDate}
          >
            {copyMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Copy className="h-4 w-4 mr-1.5" />
            Copiar {selectedIds.length} Despesa(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
