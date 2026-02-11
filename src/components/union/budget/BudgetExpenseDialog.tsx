import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { expenseTypeLabels, expenseNatureLabels, monthNames } from "@/types/unionBudget";
import type { BudgetExpense, ExpenseType, ExpenseNature } from "@/types/unionBudget";

interface BudgetExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense?: BudgetExpense;
  onSave: (data: Partial<BudgetExpense>) => void;
  isSaving?: boolean;
}

const defaultMonths = {
  month_01: 0, month_02: 0, month_03: 0, month_04: 0,
  month_05: 0, month_06: 0, month_07: 0, month_08: 0,
  month_09: 0, month_10: 0, month_11: 0, month_12: 0,
};

export function BudgetExpenseDialog({ open, onOpenChange, expense, onSave, isSaving }: BudgetExpenseDialogProps) {
  const isEditing = !!expense;

  const [form, setForm] = useState({
    description: "",
    expense_type: "fixed" as ExpenseType,
    expense_nature: "essential" as ExpenseNature,
    is_recurring: true,
    premise_description: "",
    ...defaultMonths,
  });

  useEffect(() => {
    if (expense) {
      setForm({
        description: expense.description || "",
        expense_type: expense.expense_type,
        expense_nature: (expense.expense_nature || "essential") as ExpenseNature,
        is_recurring: expense.is_recurring,
        premise_description: expense.premise_description || "",
        month_01: expense.month_01 || 0,
        month_02: expense.month_02 || 0,
        month_03: expense.month_03 || 0,
        month_04: expense.month_04 || 0,
        month_05: expense.month_05 || 0,
        month_06: expense.month_06 || 0,
        month_07: expense.month_07 || 0,
        month_08: expense.month_08 || 0,
        month_09: expense.month_09 || 0,
        month_10: expense.month_10 || 0,
        month_11: expense.month_11 || 0,
        month_12: expense.month_12 || 0,
      });
    } else {
      setForm({ description: "", expense_type: "fixed", expense_nature: "essential", is_recurring: true, premise_description: "", ...defaultMonths });
    }
  }, [expense, open]);

  const totalAmount = Object.entries(form)
    .filter(([k]) => k.startsWith("month_"))
    .reduce((sum, [, v]) => sum + Number(v || 0), 0);

  const handleDistributeEvenly = () => {
    const val = prompt("Valor mensal uniforme:");
    if (val === null) return;
    const num = parseFloat(val.replace(",", "."));
    if (isNaN(num)) return;
    const months: Record<string, number> = {};
    for (let i = 1; i <= 12; i++) months[`month_${i.toString().padStart(2, "0")}`] = num;
    setForm(prev => ({ ...prev, ...months }));
  };

  const handleSubmit = () => {
    if (!form.description.trim()) {
      toast.error("Descrição é obrigatória");
      return;
    }

    const data: Partial<BudgetExpense> = {
      description: form.description.trim(),
      expense_type: form.expense_type,
      expense_nature: form.expense_nature,
      is_recurring: form.is_recurring,
      premise_description: form.premise_description.trim() || undefined,
      month_01: Number(form.month_01), month_02: Number(form.month_02),
      month_03: Number(form.month_03), month_04: Number(form.month_04),
      month_05: Number(form.month_05), month_06: Number(form.month_06),
      month_07: Number(form.month_07), month_08: Number(form.month_08),
      month_09: Number(form.month_09), month_10: Number(form.month_10),
      month_11: Number(form.month_11), month_12: Number(form.month_12),
      total_amount: totalAmount,
      is_locked: false,
    };

    if (isEditing && expense) {
      onSave({ ...data, id: expense.id } as any);
    } else {
      onSave(data);
    }
    onOpenChange(false);
  };

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Despesa" : "Nova Despesa"}</DialogTitle>
          <DialogDescription>Preencha os dados da despesa orçamentária</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Descrição *</Label>
              <Input
                placeholder="Ex: Aluguel sede"
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo de Despesa</Label>
              <Select value={form.expense_type} onValueChange={v => setForm(p => ({ ...p, expense_type: v as ExpenseType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(expenseTypeLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Natureza</Label>
              <Select value={form.expense_nature} onValueChange={v => setForm(p => ({ ...p, expense_nature: v as ExpenseNature }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(expenseNatureLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Switch checked={form.is_recurring} onCheckedChange={v => setForm(p => ({ ...p, is_recurring: v }))} />
            <Label>Despesa Recorrente</Label>
          </div>

          <div className="space-y-2">
            <Label>Premissa / Justificativa</Label>
            <Textarea
              placeholder="Descreva a base de cálculo ou premissa desta despesa..."
              value={form.premise_description}
              onChange={e => setForm(p => ({ ...p, premise_description: e.target.value }))}
              rows={2}
            />
          </div>

          {/* Monthly breakdown */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <Label className="text-base font-semibold">Valores Mensais</Label>
              <Button type="button" variant="outline" size="sm" onClick={handleDistributeEvenly}>
                Distribuir Uniformemente
              </Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {Array.from({ length: 12 }, (_, i) => {
                const key = `month_${(i + 1).toString().padStart(2, "0")}` as keyof typeof form;
                return (
                  <div key={key} className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{monthNames[i]}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form[key] as number}
                      onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                      className="text-right"
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end pt-2 border-t">
              <p className="text-sm font-semibold">
                Total Anual: <span className="text-red-600">{formatCurrency(totalAmount)}</span>
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEditing ? "Salvar Alterações" : "Adicionar Despesa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
