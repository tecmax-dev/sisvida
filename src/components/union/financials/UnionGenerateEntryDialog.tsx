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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Loader2 } from "lucide-react";
import { UnionSupplierCombobox } from "./UnionSupplierCombobox";
import { BankStatementTransaction } from "@/hooks/useUnionReconciliation";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactions: BankStatementTransaction[];
  clinicId: string;
  onGenerate: (params: GenerateEntryParams[]) => Promise<void>;
  isGenerating?: boolean;
}

export interface GenerateEntryParams {
  statementTransactionId: string;
  supplierId: string | null;
  categoryId: string | null;
  description: string;
  amount: number;
  type: "expense" | "income";
  cashRegisterId: string;
  transactionDate: string;
  notes?: string;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export function UnionGenerateEntryDialog({
  open,
  onOpenChange,
  transactions,
  clinicId,
  onGenerate,
  isGenerating,
}: Props) {
  const [supplierId, setSupplierId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [notes, setNotes] = useState("");

  const isBatch = transactions.length > 1;

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ["union-financial-categories", clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("union_financial_categories")
        .select("id, name, type")
        .eq("clinic_id", clinicId)
        .eq("is_active", true)
        .order("type")
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!clinicId && open,
  });

  // Fetch supplier defaults when supplier changes
  const { data: supplierDefaults } = useQuery({
    queryKey: ["union-supplier-defaults-list", supplierId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("union_supplier_defaults")
        .select("category_id, description")
        .eq("supplier_id", supplierId)
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
    enabled: !!supplierId && open,
  });

  // Auto-set category from supplier defaults (use first available)
  useEffect(() => {
    if (!supplierDefaults?.length || !transactions.length) return;
    const defaultCat = supplierDefaults[0]?.category_id;
    if (defaultCat) setCategoryId(defaultCat);
  }, [supplierDefaults, transactions]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setSupplierId("");
      setCategoryId("");
      setNotes("");
    }
  }, [open]);

  const totalAmount = useMemo(
    () => transactions.reduce((sum, t) => sum + t.amount, 0),
    [transactions]
  );

  // Determine dominant type
  const dominantType = useMemo(() => {
    if (transactions.length === 0) return "debit";
    const credits = transactions.filter(t => t.transaction_type === "credit").length;
    return credits > transactions.length / 2 ? "credit" : "debit";
  }, [transactions]);

  const filteredCategories = useMemo(() => {
    if (!categories) return [];
    const targetType = dominantType === "credit" ? "income" : "expense";
    return categories.filter(c => c.type === targetType);
  }, [categories, dominantType]);

  const handleConfirm = async () => {
    const params: GenerateEntryParams[] = transactions.map((tx) => ({
      statementTransactionId: tx.id,
      supplierId: supplierId || null,
      categoryId: categoryId || null,
      description: tx.description || "Lançamento OFX",
      amount: tx.amount,
      type: tx.transaction_type === "credit" ? "income" : "expense",
      cashRegisterId: tx.cash_register_id,
      transactionDate: tx.transaction_date,
      notes: notes || undefined,
    }));

    await onGenerate(params);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {isBatch
              ? `Gerar ${transactions.length} Lançamentos`
              : "Gerar Lançamento Financeiro"}
          </DialogTitle>
        </DialogHeader>

        {/* Summary */}
        <div className="bg-muted/50 rounded-md p-3 text-sm space-y-1">
          {isBatch ? (
            <>
              <p className="font-medium">{transactions.length} transações selecionadas</p>
              <div className="flex items-center gap-3 text-muted-foreground">
                <span className={dominantType === "credit" ? "text-emerald-600 font-medium" : "text-rose-600 font-medium"}>
                  Total: {formatCurrency(totalAmount)}
                </span>
                <Badge variant="outline" className="text-xs">
                  {dominantType === "credit" ? "Receitas" : "Despesas"}
                </Badge>
              </div>
            </>
          ) : transactions[0] && (
            <>
              <p className="font-medium">{transactions[0].description || "Sem descrição"}</p>
              <div className="flex items-center gap-3 text-muted-foreground">
                <span className={transactions[0].transaction_type === "credit" ? "text-emerald-600 font-medium" : "text-rose-600 font-medium"}>
                  {transactions[0].transaction_type === "credit" ? "+ " : "- "}
                  {formatCurrency(transactions[0].amount)}
                </span>
                <span>{transactions[0].transaction_date}</span>
              </div>
            </>
          )}
        </div>

        {/* Supplier */}
        <div className="space-y-2">
          <Label>Fornecedor (opcional)</Label>
          <UnionSupplierCombobox
            value={supplierId}
            onChange={setSupplierId}
            clinicId={clinicId}
            placeholder="Selecione um fornecedor"
          />
        </div>

        {/* Category */}
        <div className="space-y-2">
          <Label>Categoria (opcional)</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma categoria" />
            </SelectTrigger>
            <SelectContent>
              {filteredCategories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label>Observações (opcional)</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Observações adicionais..."
            rows={2}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={isGenerating}>
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                {isBatch ? `Gerar ${transactions.length} Lançamentos` : "Gerar Lançamento"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
