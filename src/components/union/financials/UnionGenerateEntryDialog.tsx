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
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Loader2, Plus, Trash2, AlertTriangle } from "lucide-react";
import { UnionSupplierCombobox } from "./UnionSupplierCombobox";
import { BankStatementTransaction } from "@/hooks/useUnionReconciliation";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";

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

interface SplitLine {
  id: string;
  supplierId: string;
  categoryId: string;
  description: string;
  amount: string;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

let lineCounter = 0;
const nextLineId = () => `line-${++lineCounter}`;

export function UnionGenerateEntryDialog({
  open,
  onOpenChange,
  transactions,
  clinicId,
  onGenerate,
  isGenerating,
}: Props) {
  // Single-tx mode: split into multiple lines
  const isSingleTx = transactions.length === 1;
  const singleTx = isSingleTx ? transactions[0] : null;

  // For batch mode (multiple OFX txs → 1 entry each)
  const [globalSupplierId, setGlobalSupplierId] = useState("");
  const [globalCategoryId, setGlobalCategoryId] = useState("");
  const [notes, setNotes] = useState("");

  // For split mode (1 OFX tx → multiple entries)
  const [splitLines, setSplitLines] = useState<SplitLine[]>([]);

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
    enabled: !!globalSupplierId && open && !isSingleTx,
  });

  // Auto-set category from supplier defaults (batch mode only)
  useEffect(() => {
    if (!supplierDefaults?.length || isSingleTx) return;
    const defaultCat = supplierDefaults[0]?.category_id;
    if (defaultCat) setGlobalCategoryId(defaultCat);
  }, [supplierDefaults, isSingleTx]);

  // Reset on open
  useEffect(() => {
    if (open) {
      lineCounter = 0;
      setGlobalSupplierId("");
      setGlobalCategoryId("");
      setNotes("");
      // Initialize split lines for single tx
      if (transactions.length === 1) {
        const tx = transactions[0];
        setSplitLines([{
          id: nextLineId(),
          supplierId: "",
          categoryId: "",
          description: tx.description || "",
          amount: tx.amount.toFixed(2),
        }]);
      } else {
        setSplitLines([]);
      }
    }
  }, [open, transactions]);

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

  // Split line helpers
  const addSplitLine = useCallback(() => {
    setSplitLines(prev => [...prev, {
      id: nextLineId(),
      supplierId: "",
      categoryId: "",
      description: "",
      amount: "",
    }]);
  }, []);

  const removeSplitLine = useCallback((lineId: string) => {
    setSplitLines(prev => prev.filter(l => l.id !== lineId));
  }, []);

  const updateSplitLine = useCallback((lineId: string, field: keyof SplitLine, value: string) => {
    setSplitLines(prev => prev.map(l => l.id === lineId ? { ...l, [field]: value } : l));
  }, []);

  // Split totals
  const splitTotal = useMemo(() => {
    return splitLines.reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0);
  }, [splitLines]);

  const splitDifference = singleTx ? Math.abs(singleTx.amount - splitTotal) : 0;
  const splitBalanced = splitDifference < 0.01;

  const handleConfirm = async () => {
    if (isSingleTx && singleTx) {
      // Split mode: multiple entries from one OFX tx
      const params: GenerateEntryParams[] = splitLines
        .filter(l => parseFloat(l.amount) > 0)
        .map((line) => ({
          statementTransactionId: singleTx.id,
          supplierId: line.supplierId || null,
          categoryId: line.categoryId || null,
          description: line.description || singleTx.description || "Lançamento OFX",
          amount: parseFloat(line.amount),
          type: singleTx.transaction_type === "credit" ? "income" as const : "expense" as const,
          cashRegisterId: singleTx.cash_register_id,
          transactionDate: singleTx.transaction_date,
          notes: notes || undefined,
        }));
      await onGenerate(params);
    } else {
      // Batch mode: one entry per OFX tx
      const params: GenerateEntryParams[] = transactions.map((tx) => ({
        statementTransactionId: tx.id,
        supplierId: globalSupplierId || null,
        categoryId: globalCategoryId || null,
        description: tx.description || "Lançamento OFX",
        amount: tx.amount,
        type: tx.transaction_type === "credit" ? "income" as const : "expense" as const,
        cashRegisterId: tx.cash_register_id,
        transactionDate: tx.transaction_date,
        notes: notes || undefined,
      }));
      await onGenerate(params);
    }
    onOpenChange(false);
  };

  const canConfirm = isSingleTx
    ? splitLines.length > 0 && splitLines.some(l => parseFloat(l.amount) > 0) && splitBalanced
    : true;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileText className="h-5 w-5" />
            {isSingleTx
              ? "Gerar Lançamento(s) Financeiro(s)"
              : `Gerar ${transactions.length} Lançamentos`}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 min-h-0">
          <div className="space-y-4 py-4">
            {/* Summary */}
            <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
              {isSingleTx && singleTx ? (
                <>
                  <p className="font-medium truncate">{singleTx.description || "Sem descrição"}</p>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span className={singleTx.transaction_type === "credit" ? "text-emerald-600 font-semibold" : "text-rose-600 font-semibold"}>
                      {singleTx.transaction_type === "credit" ? "+ " : "- "}
                      {formatCurrency(singleTx.amount)}
                    </span>
                    <span>{singleTx.transaction_date}</span>
                    {singleTx.check_number && (
                      <Badge variant="outline" className="text-xs">Cheque {singleTx.check_number}</Badge>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <p className="font-medium">{transactions.length} transações selecionadas</p>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span className={dominantType === "credit" ? "text-emerald-600 font-semibold" : "text-rose-600 font-semibold"}>
                      Total: {formatCurrency(totalAmount)}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {dominantType === "credit" ? "Receitas" : "Despesas"}
                    </Badge>
                  </div>
                </>
              )}
            </div>

            {/* SPLIT MODE: Single tx → multiple entries */}
            {isSingleTx ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Lançamentos</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addSplitLine}
                    className="h-8 text-xs gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Adicionar linha
                  </Button>
                </div>

                <div className="space-y-2">
                  {splitLines.map((line, idx) => (
                    <div key={line.id} className="border rounded-lg p-3 space-y-2 bg-card">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">
                          Linha {idx + 1}
                        </span>
                        {splitLines.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            onClick={() => removeSplitLine(line.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Fornecedor</Label>
                          <UnionSupplierCombobox
                            value={line.supplierId}
                            onChange={(v) => updateSplitLine(line.id, "supplierId", v)}
                            clinicId={clinicId}
                            placeholder="Selecione"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Categoria</Label>
                          <Select
                            value={line.categoryId}
                            onValueChange={(v) => updateSplitLine(line.id, "categoryId", v)}
                          >
                            <SelectTrigger className="h-9 text-sm">
                              <SelectValue placeholder="Selecione" />
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
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Descrição</Label>
                          <Input
                            value={line.description}
                            onChange={(e) => updateSplitLine(line.id, "description", e.target.value)}
                            placeholder="Descrição do lançamento"
                            className="h-9 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Valor (R$)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={line.amount}
                            onChange={(e) => updateSplitLine(line.id, "amount", e.target.value)}
                            placeholder="0,00"
                            className="h-9 text-sm font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Split balance indicator */}
                <div className={`rounded-lg p-3 text-sm flex items-center justify-between ${
                  splitBalanced ? "bg-emerald-50 border border-emerald-200" : "bg-amber-50 border border-amber-200"
                }`}>
                  <div className="flex items-center gap-2">
                    {!splitBalanced && <AlertTriangle className="h-4 w-4 text-amber-600" />}
                    <span className={splitBalanced ? "text-emerald-700" : "text-amber-700"}>
                      Total das linhas: {formatCurrency(splitTotal)}
                    </span>
                  </div>
                  {!splitBalanced && (
                    <span className="text-amber-700 font-medium">
                      Diferença: {formatCurrency(splitDifference)}
                    </span>
                  )}
                  {splitBalanced && (
                    <Badge variant="outline" className="text-emerald-700 border-emerald-300 text-xs">
                      ✓ Valores conferem
                    </Badge>
                  )}
                </div>
              </div>
            ) : (
              /* BATCH MODE: Multiple OFX txs → 1 entry each */
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Fornecedor padrão (opcional)</Label>
                  <UnionSupplierCombobox
                    value={globalSupplierId}
                    onChange={setGlobalSupplierId}
                    clinicId={clinicId}
                    placeholder="Selecione um fornecedor"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Categoria padrão (opcional)</Label>
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
              </div>
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

        <DialogFooter className="px-6 pb-5 pt-3 border-t gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={isGenerating || !canConfirm}>
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                {isSingleTx
                  ? splitLines.length > 1
                    ? `Gerar ${splitLines.length} Lançamentos`
                    : "Gerar Lançamento"
                  : `Gerar ${transactions.length} Lançamentos`}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
