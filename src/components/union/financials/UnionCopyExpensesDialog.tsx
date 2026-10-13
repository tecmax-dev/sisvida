import { useMemo, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, Copy, Calendar, Hash, Printer } from "lucide-react";

interface UnionCopyExpensesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clinicId: string;
}

export function UnionCopyExpensesDialog({ open, onOpenChange, clinicId }: UnionCopyExpensesDialogProps) {
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [newDueDate, setNewDueDate] = useState("");
  const [newCheckNumber, setNewCheckNumber] = useState("");
  const [checkNumber, setCheckNumber] = useState("");

  const { data: expenses, isLoading, isError } = useQuery({
    queryKey: ["union-copy-expenses", clinicId],
    queryFn: async () => {
      const PAGE_SIZE = 1000;
      let allData: any[] = [];
      let from = 0;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from("union_financial_transactions")
          .select(`*, category:union_financial_categories(id, name, color), supplier:union_suppliers(id, name), cash_register:union_cash_registers(id, name)`)
          .eq("clinic_id", clinicId)
          .eq("type", "expense")
          .order("due_date", { ascending: false })
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        allData = allData.concat(data || []);
        hasMore = (data?.length || 0) === PAGE_SIZE;
        from += PAGE_SIZE;
      }
      return allData;
    },
    enabled: open && !!clinicId,
  });

  const filteredExpenses = useMemo(() => {
    if (!expenses || !checkNumber.trim()) return [];
    const value = checkNumber.trim().toLowerCase();
    return expenses.filter((expense) => String(expense.check_number ?? "").toLowerCase().includes(value));
  }, [expenses, checkNumber]);

  const selectedExpenses = useMemo(
    () => filteredExpenses.filter((expense) => selectedIds.includes(expense.id)),
    [filteredExpenses, selectedIds]
  );

  const formatCurrency = (value: number | null) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value ?? 0));

  const totalValue = filteredExpenses.reduce((total, expense) => total + Number(expense.amount ?? expense.net_value ?? 0), 0);
  const selectedTotal = selectedExpenses.reduce((total, expense) => total + Number(expense.amount ?? expense.net_value ?? 0), 0);

  const toggleSelect = (id: string) => {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const toggleSelectAll = () => {
    const filteredIds = filteredExpenses.map((expense) => expense.id);
    const allFilteredSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedIds.includes(id));
    setSelectedIds(allFilteredSelected ? selectedIds.filter((id) => !filteredIds.includes(id)) : Array.from(new Set([...selectedIds, ...filteredIds])));
  };

  const handleClose = () => {
    setSelectedIds([]);
    setNewDueDate("");
    setNewCheckNumber("");
    setCheckNumber("");
    onOpenChange(false);
  };

  const copyMutation = useMutation({
    mutationFn: async () => {
      if (!newDueDate) throw new Error("Informe a nova data de vencimento.");
      if (!checkNumber.trim()) throw new Error("Informe o número do cheque.");
      if (!selectedIds.length) throw new Error("Selecione ao menos uma despesa.");
      const records = selectedExpenses.map((expense) => ({
        clinic_id: expense.clinic_id,
        type: expense.type,
        description: expense.description,
        amount: expense.amount,
        net_value: expense.net_value,
        discount_value: expense.discount_value,
        interest_value: expense.interest_value,
        due_date: newDueDate,
        category_id: expense.category_id,
        supplier_id: expense.supplier_id,
        cash_register_id: expense.cash_register_id,
        cost_center_id: expense.cost_center_id,
        payment_method: expense.payment_method,
        check_number: newCheckNumber || expense.check_number,
        document_number: expense.document_number,
        notes: expense.notes,
        status: "pending" as const,
        created_by: expense.created_by,
      }));
      const { error } = await supabase.from("union_financial_transactions").insert(records);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["union-financial-transactions"] });
      toast.success(`${selectedExpenses.length} despesa(s) copiada(s) com sucesso!`);
      handleClose();
    },
    onError: (error: Error) => toast.error(error.message || "Erro ao copiar despesas"),
  });

  const printReceipt = () => {
    if (!checkNumber.trim() || !selectedExpenses.length) return;
    const rows = selectedExpenses.map((expense) => `<tr><td>${expense.description ?? "-"}</td><td>${expense.category?.name ?? "-"}</td><td>${expense.supplier?.name ?? "-"}</td><td>${formatCurrency(expense.amount ?? expense.net_value)}</td></tr>`).join("");
    const date = newDueDate ? format(parseISO(newDueDate), "dd/MM/yyyy", { locale: ptBR }) : format(new Date(), "dd/MM/yyyy", { locale: ptBR });
    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) { toast.error("Permita pop-ups para imprimir o comprovante."); return; }
    printWindow.document.write(`<html><head><title>Comprovante - Cheque ${checkNumber}</title><style>body{font-family:Arial,sans-serif;color:#222;padding:32px}h1{font-size:22px}table{width:100%;border-collapse:collapse;margin-top:24px}th,td{border-bottom:1px solid #ddd;padding:10px;text-align:left}th{font-size:12px;text-transform:uppercase}tfoot td{font-weight:bold}</style></head><body><h1>Comprovante de despesas</h1><p><strong>Cheque:</strong> ${checkNumber}</p><p><strong>Data:</strong> ${date}</p><table><thead><tr><th>Despesa</th><th>Categoria</th><th>Fornecedor</th><th>Valor</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td colspan="3">Total (${selectedExpenses.length} despesa(s))</td><td>${formatCurrency(selectedTotal)}</td></tr></tfoot></table></body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <Dialog open={open} onOpenChange={(value) => value ? onOpenChange(true) : handleClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Copy className="h-5 w-5" />Cópia de Cheque</DialogTitle>
          <DialogDescription>Busque um cheque pelo número e imprima o comprovante com as despesas lançadas.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-2">
          <div className="space-y-1.5"><Label className="flex items-center gap-1.5"><Hash className="h-3.5 w-3.5" />Número do cheque *</Label><Input autoFocus placeholder="Ex.: 1300" value={checkNumber} onChange={(event) => { setCheckNumber(event.target.value); setSelectedIds([]); }} /></div>
          <div className="space-y-1.5"><Label className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />Nova data *</Label><Input type="date" value={newDueDate} onChange={(event) => setNewDueDate(event.target.value)} /></div>
          <div className="space-y-1.5"><Label>Novo cheque (opcional)</Label><Input placeholder="Manter o original" value={newCheckNumber} onChange={(event) => setNewCheckNumber(event.target.value)} /></div>
        </div>

        <div className="flex items-center justify-between gap-3 text-sm"><span className="text-muted-foreground">{checkNumber ? `Cheque pesquisado: ${checkNumber}` : "Informe um número para buscar"}</span><Badge variant="secondary">{selectedExpenses.length} selecionada(s) · {filteredExpenses.length} despesa(s) · {formatCurrency(totalValue)}</Badge></div>

        <div className="flex items-center justify-between border-y py-2 text-sm"><label className="flex items-center gap-2"><Checkbox checked={filteredExpenses.length > 0 && filteredExpenses.every((expense) => selectedIds.includes(expense.id))} onCheckedChange={toggleSelectAll} disabled={!filteredExpenses.length} />Selecionar todas</label><span className="text-muted-foreground">Total selecionado: {formatCurrency(selectedTotal)}</span></div>

        <div className="min-h-0 max-h-[min(42vh,420px)] overflow-y-scroll overscroll-contain rounded-md border">
          <div className="p-2 space-y-2">
            {isLoading && <div className="flex items-center justify-center gap-2 p-8 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Buscando despesas...</div>}
            {isError && <div className="p-8 text-center text-destructive">Não foi possível carregar as despesas.</div>}
            {!isLoading && !isError && !checkNumber && <div className="p-8 text-center text-muted-foreground">Digite o número do cheque para iniciar a busca.</div>}
            {!isLoading && !isError && checkNumber && !filteredExpenses.length && <div className="p-8 text-center text-muted-foreground">Nenhuma despesa encontrada para este cheque.</div>}
            {filteredExpenses.map((expense) => <label key={expense.id} className="flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors hover:bg-muted"><Checkbox checked={selectedIds.includes(expense.id)} onCheckedChange={() => toggleSelect(expense.id)} /><span className="min-w-0 flex-1"><span className="block font-medium">{expense.description || "Despesa sem descrição"}</span><span className="block text-sm text-muted-foreground">{expense.category?.name ?? "Sem categoria"} · {expense.supplier?.name ?? "Sem fornecedor"}</span></span><span className="whitespace-nowrap font-medium">{formatCurrency(expense.amount ?? expense.net_value)}</span></label>)}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0"><Button variant="outline" onClick={handleClose}>Cancelar</Button><Button variant="outline" onClick={printReceipt} disabled={!checkNumber.trim() || !selectedExpenses.length}><Printer className="mr-1.5 h-4 w-4" />Imprimir comprovante</Button><Button onClick={() => copyMutation.mutate()} disabled={copyMutation.isPending || !checkNumber.trim() || !selectedIds.length || !newDueDate}>{copyMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}<Copy className="mr-1.5 h-4 w-4" />Copiar {selectedExpenses.length} despesa(s)</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
