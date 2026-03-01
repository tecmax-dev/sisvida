import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { UnionSupplierCombobox } from "./UnionSupplierCombobox";
import { BankStatementTransaction } from "@/hooks/useUnionReconciliation";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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

interface PerTxOverride {
  supplierId: string;
  categoryId: string;
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
  const [globalSupplierId, setGlobalSupplierId] = useState("");
  const [globalCategoryId, setGlobalCategoryId] = useState("");
  const [notes, setNotes] = useState("");
  const [perTxOverrides, setPerTxOverrides] = useState<Record<string, PerTxOverride>>({});
  const [detailsOpen, setDetailsOpen] = useState(false);

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

  // Fetch supplier defaults when global supplier changes
  const { data: supplierDefaults } = useQuery({
    queryKey: ["union-supplier-defaults-list", globalSupplierId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("union_supplier_defaults")
        .select("category_id, description")
        .eq("supplier_id", globalSupplierId)
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
    enabled: !!globalSupplierId && open,
  });

  // Auto-set category from supplier defaults
  useEffect(() => {
    if (!supplierDefaults?.length || !transactions.length) return;
    const defaultCat = supplierDefaults[0]?.category_id;
    if (defaultCat) setGlobalCategoryId(defaultCat);
  }, [supplierDefaults, transactions]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setGlobalSupplierId("");
      setGlobalCategoryId("");
      setNotes("");
      setPerTxOverrides({});
      setDetailsOpen(false);
    }
  }, [open]);

  const totalAmount = useMemo(
    () => transactions.reduce((sum, t) => sum + t.amount, 0),
    [transactions]
  );

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

  // Categories for a specific transaction type
  const getCategoriesForType = useCallback((txType: string) => {
    if (!categories) return [];
    const targetType = txType === "credit" ? "income" : "expense";
    return categories.filter(c => c.type === targetType);
  }, [categories]);

  const updateOverride = useCallback((txId: string, field: keyof PerTxOverride, value: string) => {
    setPerTxOverrides(prev => ({
      ...prev,
      [txId]: { ...prev[txId], [field]: value } as PerTxOverride,
    }));
  }, []);

  const handleConfirm = async () => {
    const params: GenerateEntryParams[] = transactions.map((tx) => {
      const override = perTxOverrides[tx.id];
      return {
        statementTransactionId: tx.id,
        supplierId: override?.supplierId || globalSupplierId || null,
        categoryId: override?.categoryId || globalCategoryId || null,
        description: tx.description || "Lançamento OFX",
        amount: tx.amount,
        type: tx.transaction_type === "credit" ? "income" as const : "expense" as const,
        cashRegisterId: tx.cash_register_id,
        transactionDate: tx.transaction_date,
        notes: notes || undefined,
      };
    });

    await onGenerate(params);
    onOpenChange(false);
  };

  const customizedCount = Object.keys(perTxOverrides).filter(
    id => perTxOverrides[id]?.supplierId || perTxOverrides[id]?.categoryId
  ).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {isBatch
              ? `Gerar ${transactions.length} Lançamentos`
              : "Gerar Lançamento Financeiro"}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6">
          <div className="space-y-4 pb-4">
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

            {/* Global Supplier + Category (applies to all unless overridden) */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium">
                  {isBatch ? "Fornecedor padrão (opcional)" : "Fornecedor (opcional)"}
                </Label>
                {isBatch && customizedCount > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {customizedCount} personalizado{customizedCount > 1 ? "s" : ""}
                  </Badge>
                )}
              </div>
              <UnionSupplierCombobox
                value={globalSupplierId}
                onChange={setGlobalSupplierId}
                clinicId={clinicId}
                placeholder="Selecione um fornecedor"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">
                {isBatch ? "Categoria padrão (opcional)" : "Categoria (opcional)"}
              </Label>
              <Select value={globalCategoryId} onValueChange={setGlobalCategoryId}>
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

            {/* Per-transaction overrides (batch only) */}
            {isBatch && (
              <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-between text-muted-foreground hover:text-foreground">
                    <span className="text-sm">
                      Personalizar fornecedor/categoria por transação
                    </span>
                    {detailsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-3 mt-2">
                    {transactions.map((tx, idx) => {
                      const override = perTxOverrides[tx.id] || { supplierId: "", categoryId: "" };
                      const txCategories = getCategoriesForType(tx.transaction_type);
                      return (
                        <div key={tx.id} className="border rounded-md p-3 space-y-2 bg-muted/30">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium truncate flex-1 mr-2">
                              {idx + 1}. {tx.description || "Sem descrição"}
                            </span>
                            <span className={tx.transaction_type === "credit" ? "text-emerald-600 font-medium text-nowrap" : "text-rose-600 font-medium text-nowrap"}>
                              {formatCurrency(tx.amount)}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Fornecedor</Label>
                              <UnionSupplierCombobox
                                value={override.supplierId}
                                onChange={(v) => updateOverride(tx.id, "supplierId", v)}
                                clinicId={clinicId}
                                placeholder="Usar padrão"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Categoria</Label>
                              <Select
                                value={override.categoryId}
                                onValueChange={(v) => updateOverride(tx.id, "categoryId", v)}
                              >
                                <SelectTrigger className="h-9 text-sm">
                                  <SelectValue placeholder="Usar padrão" />
                                </SelectTrigger>
                                <SelectContent>
                                  {txCategories.map((cat) => (
                                    <SelectItem key={cat.id} value={cat.id}>
                                      {cat.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Notes */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Observações (opcional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observações adicionais..."
                rows={2}
              />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 pb-6 pt-2 border-t">
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
