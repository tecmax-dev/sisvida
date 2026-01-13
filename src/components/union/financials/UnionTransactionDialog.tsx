import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, CalendarIcon, ChevronDown, Calculator, AlertTriangle, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { UnionSupplierCombobox } from "./UnionSupplierCombobox";
import { UnionSupplierDialog } from "./UnionSupplierDialog";
import { UnionSupplierDefaultsSelector } from "./UnionSupplierDefaultsSelector";
import { useUnionFinancialData } from "@/hooks/useUnionFinancialData";

interface UnionTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: any | null;
  clinicId: string;
  defaultType?: "income" | "expense";
  onSuccess: () => void;
}

const PAYMENT_METHODS = [
  { value: "pix", label: "PIX" },
  { value: "cash", label: "Dinheiro" },
  { value: "bank_transfer", label: "Transferência" },
  { value: "credit_card", label: "Cartão de Crédito" },
  { value: "debit_card", label: "Cartão de Débito" },
  { value: "check", label: "Cheque" },
  { value: "boleto", label: "Boleto" },
];

const DOCUMENT_TYPES = [
  { value: "nf", label: "Nota Fiscal" },
  { value: "nfse", label: "NFS-e" },
  { value: "recibo", label: "Recibo" },
  { value: "fatura", label: "Fatura" },
  { value: "boleto", label: "Boleto" },
  { value: "contrato", label: "Contrato" },
  { value: "outros", label: "Outros" },
];

export function UnionTransactionDialog({
  open,
  onOpenChange,
  transaction,
  clinicId,
  defaultType = "expense",
  onSuccess,
}: UnionTransactionDialogProps) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState<"income" | "expense">(defaultType);
  const [dueDate, setDueDate] = useState<Date | undefined>(new Date());
  const [paidDate, setPaidDate] = useState<Date | undefined>();
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const [valuesOpen, setValuesOpen] = useState(false);
  const [defaultsSelectorOpen, setDefaultsSelectorOpen] = useState(false);
  const [selectedSupplierName, setSelectedSupplierName] = useState("");

  const [formData, setFormData] = useState({
    description: "",
    amount: "",
    category_id: "",
    cash_register_id: "",
    supplier_id: "",
    payment_method: "pix",
    status: "pending",
    notes: "",
    document_number: "",
    document_type: "",
    check_number: "",
    gross_value: "",
    fine_value: "",
    interest_value: "",
    discount_value: "",
  });

  // Calculate net value
  const calculatedNetValue = useMemo(() => {
    const gross = parseFloat(formData.gross_value.replace(",", ".") || "0");
    const fine = parseFloat(formData.fine_value.replace(",", ".") || "0");
    const interest = parseFloat(formData.interest_value.replace(",", ".") || "0");
    const discount = parseFloat(formData.discount_value.replace(",", ".") || "0");
    return gross + fine + interest - discount;
  }, [formData.gross_value, formData.fine_value, formData.interest_value, formData.discount_value]);

  // Use unified hook with fallback and migration capability
  const {
    categories: allCategories,
    categoriesSource,
    cashRegisters: allCashRegisters,
    cashRegistersSource,
    needsMigration,
    migrateData,
    loadingCategories,
    loadingCashRegisters,
  } = useUnionFinancialData(clinicId);

  const [isMigrating, setIsMigrating] = useState(false);

  // Filter categories by type
  const categories = useMemo(() => {
    return allCategories.filter((c: any) => c.type === type);
  }, [allCategories, type]);

  // Use cash registers from the hook directly
  const cashRegisters = allCashRegisters;

  // Check if we're using fallback data (clinic data instead of union data)
  const usingFallbackCategories = categoriesSource === "clinic";
  const usingFallbackCashRegisters = cashRegistersSource === "clinic";
  const requiresMigration = usingFallbackCategories || usingFallbackCashRegisters;

  // Auto-migrate when dialog opens if needed
  const handleMigration = async () => {
    setIsMigrating(true);
    try {
      const success = await migrateData();
      if (success) {
        toast.success("Dados financeiros migrados com sucesso!");
      }
    } finally {
      setIsMigrating(false);
    }
  };

  // Supplier refresh handler
  const handleSupplierCreated = () => {
    queryClient.invalidateQueries({ queryKey: ["union-suppliers", clinicId] });
    setSupplierDialogOpen(false);
  };

  // Handle supplier selection - check for defaults
  const { data: suppliers } = useQuery({
    queryKey: ["union-suppliers", clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("union_suppliers")
        .select("id, name")
        .eq("clinic_id", clinicId)
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
    enabled: !!clinicId,
  });

  const handleSupplierChange = async (supplierId: string) => {
    setFormData({ ...formData, supplier_id: supplierId });
    
    if (supplierId && !transaction) {
      // Check if supplier has defaults configured
      const { data: defaults } = await supabase
        .from("union_supplier_defaults")
        .select("id")
        .eq("supplier_id", supplierId)
        .eq("is_active", true)
        .limit(1);

      if (defaults && defaults.length > 0) {
        const supplier = suppliers?.find(s => s.id === supplierId);
        if (supplier) {
          setSelectedSupplierName(supplier.name);
          setDefaultsSelectorOpen(true);
        }
      }
    }
  };

  // Handle defaults selection
  const handleDefaultsSelect = (data: {
    description: string;
    category_id: string;
    amount: string;
    gross_value: string;
  }) => {
    setFormData(prev => ({
      ...prev,
      description: data.description,
      category_id: data.category_id,
      amount: data.amount,
      gross_value: data.gross_value,
    }));
  };

  useEffect(() => {
    if (transaction) {
      setType(transaction.type);
      setFormData({
        description: transaction.description || "",
        amount: transaction.amount?.toString() || "",
        category_id: transaction.category_id || "",
        cash_register_id: transaction.cash_register_id || "",
        supplier_id: transaction.supplier_id || "",
        payment_method: transaction.payment_method || "pix",
        status: transaction.status || "pending",
        notes: transaction.notes || "",
        document_number: transaction.document_number || "",
        document_type: transaction.document_type || "",
        check_number: transaction.check_number || "",
        gross_value: transaction.gross_value?.toString() || transaction.amount?.toString() || "",
        fine_value: transaction.fine_value?.toString() || "",
        interest_value: transaction.interest_value?.toString() || "",
        discount_value: transaction.discount_value?.toString() || "",
      });
      setDueDate(transaction.due_date ? new Date(transaction.due_date) : new Date());
      setPaidDate(transaction.paid_date ? new Date(transaction.paid_date) : undefined);
      // Open values section if there are decomposed values
      if (transaction.fine_value || transaction.interest_value || transaction.discount_value) {
        setValuesOpen(true);
      }
    } else {
      setType(defaultType);
      setFormData({
        description: "",
        amount: "",
        category_id: "",
        cash_register_id: "",
        supplier_id: "",
        payment_method: "pix",
        status: "pending",
        notes: "",
        document_number: "",
        document_type: "",
        check_number: "",
        gross_value: "",
        fine_value: "",
        interest_value: "",
        discount_value: "",
      });
      setDueDate(new Date());
      setPaidDate(undefined);
      setValuesOpen(false);
    }
  }, [transaction, open, defaultType]);

  // Sync amount with gross_value when not using decomposed values
  useEffect(() => {
    if (!valuesOpen && formData.amount && !formData.gross_value) {
      setFormData((prev) => ({ ...prev, gross_value: prev.amount }));
    }
  }, [formData.amount, valuesOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clinicId) return;

    // Block if using fallback data - must migrate first
    if (requiresMigration) {
      toast.error("É necessário migrar os dados financeiros antes de lançar transações. Clique em 'Migrar Dados'.");
      return;
    }

    if (!formData.description.trim()) {
      toast.error("Descrição é obrigatória");
      return;
    }

    // Determine the final amount
    let finalAmount: number;
    let grossValue: number | null = null;
    let fineValue: number | null = null;
    let interestValue: number | null = null;
    let discountValue: number | null = null;
    let netValue: number | null = null;

    if (valuesOpen && formData.gross_value) {
      // Using decomposed values
      grossValue = parseFloat(formData.gross_value.replace(",", ".") || "0");
      fineValue = parseFloat(formData.fine_value.replace(",", ".") || "0") || null;
      interestValue = parseFloat(formData.interest_value.replace(",", ".") || "0") || null;
      discountValue = parseFloat(formData.discount_value.replace(",", ".") || "0") || null;
      netValue = calculatedNetValue;
      finalAmount = netValue;
    } else {
      // Using simple amount
      finalAmount = parseFloat(formData.amount.replace(",", ".") || "0");
    }

    if (finalAmount <= 0) {
      toast.error("Valor deve ser maior que zero");
      return;
    }

    // Validate check number when payment method is check
    if (formData.payment_method === "check" && !formData.check_number.trim()) {
      toast.error("Número do cheque é obrigatório para pagamentos em cheque");
      return;
    }

    setLoading(true);
    try {
      const data: any = {
        clinic_id: clinicId,
        type,
        description: formData.description,
        amount: finalAmount,
        category_id: formData.category_id || null,
        cash_register_id: formData.cash_register_id || null,
        supplier_id: type === "expense" ? (formData.supplier_id || null) : null,
        payment_method: formData.payment_method,
        status: formData.status,
        notes: formData.notes || null,
        document_number: formData.document_number || null,
        document_type: formData.document_type || null,
        check_number: formData.check_number || null,
        due_date: dueDate ? format(dueDate, "yyyy-MM-dd") : null,
        paid_date: paidDate ? format(paidDate, "yyyy-MM-dd") : null,
      };

      // Add decomposed values if using them
      if (valuesOpen && grossValue) {
        data.gross_value = grossValue;
        data.fine_value = fineValue;
        data.interest_value = interestValue;
        data.discount_value = discountValue;
        data.net_value = netValue;
      }

      if (transaction) {
        const { error } = await supabase
          .from("union_financial_transactions")
          .update(data)
          .eq("id", transaction.id);
        if (error) throw error;
        toast.success("Transação atualizada!");
      } else {
        const { error } = await supabase.from("union_financial_transactions").insert(data);
        if (error) throw error;
        toast.success(type === "income" ? "Receita lançada!" : "Despesa lançada!");
      }

      queryClient.invalidateQueries({ queryKey: ["union-financial-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["union-cash-registers"] });
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error("Transaction save error:", error);
      // Provide more specific error messages
      if (error?.message?.includes("foreign key constraint")) {
        if (error.message.includes("category_id")) {
          toast.error("Categoria inválida. Por favor, migre os dados financeiros primeiro.");
        } else if (error.message.includes("cash_register_id")) {
          toast.error("Conta bancária inválida. Por favor, migre os dados financeiros primeiro.");
        } else if (error.message.includes("supplier_id")) {
          toast.error("Fornecedor inválido. Por favor, cadastre o fornecedor no módulo sindical.");
        } else {
          toast.error("Erro de referência: " + error.message);
        }
      } else if (error?.message) {
        toast.error("Erro: " + error.message);
      } else {
        toast.error("Erro ao salvar transação. Verifique os dados e tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {transaction ? "Editar Transação" : type === "income" ? "Nova Receita" : "Nova Despesa"}
            </DialogTitle>
            <DialogDescription>
              Lance {type === "income" ? "receitas" : "despesas"} do módulo sindical
            </DialogDescription>
          </DialogHeader>

          {/* Migration Alert */}
          {requiresMigration && (
            <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950/30">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="flex items-center justify-between gap-4">
                <span className="text-amber-800 dark:text-amber-200">
                  Os dados financeiros precisam ser migrados da clínica para o módulo sindical.
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="shrink-0 border-amber-600 text-amber-700 hover:bg-amber-100"
                  onClick={handleMigration}
                  disabled={isMigrating}
                >
                  {isMigrating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Migrando...
                    </>
                  ) : (
                    "Migrar Dados"
                  )}
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!transaction && (
              <Tabs value={type} onValueChange={(v) => setType(v as "income" | "expense")}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="income" className="gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Receita
                  </TabsTrigger>
                  <TabsTrigger value="expense" className="gap-2">
                    <TrendingDown className="h-4 w-4" />
                    Despesa
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="description">Descrição *</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder={type === "income" ? "Ex: Mensalidade Sindical" : "Ex: Material de Escritório"}
                  required
                />
              </div>

              {/* Simple Amount (when not using decomposed values) */}
              {!valuesOpen && (
                <div>
                  <Label htmlFor="amount">Valor (R$) *</Label>
                  <Input
                    id="amount"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value, gross_value: e.target.value })}
                    placeholder="0,00"
                    required
                  />
                </div>
              )}

              <div>
                <Label>Data de Vencimento</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dueDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dueDate ? format(dueDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dueDate}
                      onSelect={setDueDate}
                      locale={ptBR}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Decomposed Values Section */}
              <div className="col-span-2">
                <Collapsible open={valuesOpen} onOpenChange={setValuesOpen}>
                  <CollapsibleTrigger asChild>
                    <Button type="button" variant="ghost" className="w-full justify-between p-2 h-auto">
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <Calculator className="h-4 w-4" />
                        Decomposição de Valores
                      </span>
                      <ChevronDown className={cn("h-4 w-4 transition-transform", valuesOpen && "rotate-180")} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 border rounded-md bg-muted/30">
                      <div>
                        <Label className="text-xs">Valor Bruto *</Label>
                        <Input
                          value={formData.gross_value}
                          onChange={(e) => setFormData({ ...formData, gross_value: e.target.value })}
                          placeholder="0,00"
                          className="h-9"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Multa</Label>
                        <Input
                          value={formData.fine_value}
                          onChange={(e) => setFormData({ ...formData, fine_value: e.target.value })}
                          placeholder="0,00"
                          className="h-9"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Juros</Label>
                        <Input
                          value={formData.interest_value}
                          onChange={(e) => setFormData({ ...formData, interest_value: e.target.value })}
                          placeholder="0,00"
                          className="h-9"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Desconto</Label>
                        <Input
                          value={formData.discount_value}
                          onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })}
                          placeholder="0,00"
                          className="h-9"
                        />
                      </div>
                      <div className="col-span-2 md:col-span-4 pt-2 border-t">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Valor Líquido:</span>
                          <span className={cn("text-lg font-bold", type === "expense" ? "text-rose-600" : "text-emerald-600")}>
                            {formatCurrency(calculatedNetValue)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>

              <div>
                <Label>Categoria</Label>
                <Select
                  value={formData.category_id}
                  onValueChange={(value) => setFormData({ ...formData, category_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categories?.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: category.color || "#6b7280" }}
                          />
                          {category.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Conta Bancária</Label>
                <Select
                  value={formData.cash_register_id}
                  onValueChange={(value) => setFormData({ ...formData, cash_register_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {cashRegisters?.map((register) => (
                      <SelectItem key={register.id} value={register.id}>
                        {register.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {type === "expense" && (
                <div>
                  <Label>Fornecedor</Label>
                  <UnionSupplierCombobox
                    value={formData.supplier_id}
                    onChange={handleSupplierChange}
                    clinicId={clinicId}
                    placeholder="Buscar fornecedor..."
                    onAddNew={() => setSupplierDialogOpen(true)}
                  />
                </div>
              )}

              <div>
                <Label>Forma de Pagamento</Label>
                <Select
                  value={formData.payment_method}
                  onValueChange={(value) => setFormData({ ...formData, payment_method: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((method) => (
                      <SelectItem key={method.value} value={method.value}>
                        {method.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Check Number - shows when payment method is check */}
              {formData.payment_method === "check" && (
                <div>
                  <Label htmlFor="check_number">Nº do Cheque *</Label>
                  <Input
                    id="check_number"
                    value={formData.check_number}
                    onChange={(e) => setFormData({ ...formData, check_number: e.target.value })}
                    placeholder="Ex: 001234"
                    required
                  />
                </div>
              )}

              <div>
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="paid">{type === "income" ? "Recebido" : "Pago"}</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.status === "paid" && (
                <div>
                  <Label>Data do {type === "income" ? "Recebimento" : "Pagamento"}</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !paidDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {paidDate ? format(paidDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={paidDate}
                        onSelect={setPaidDate}
                        locale={ptBR}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}

              <div>
                <Label>Tipo de Documento</Label>
                <Select
                  value={formData.document_type}
                  onValueChange={(value) => setFormData({ ...formData, document_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPES.map((dt) => (
                      <SelectItem key={dt.value} value={dt.value}>
                        {dt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="document_number">Nº do Documento</Label>
                <Input
                  id="document_number"
                  value={formData.document_number}
                  onChange={(e) => setFormData({ ...formData, document_number: e.target.value })}
                  placeholder="Opcional"
                />
              </div>

              <div className="col-span-2">
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog para novo fornecedor */}
      <UnionSupplierDialog
        open={supplierDialogOpen}
        onOpenChange={setSupplierDialogOpen}
        supplier={null}
        clinicId={clinicId}
        onSuccess={handleSupplierCreated}
      />

      {/* Dialog para seleção de defaults do fornecedor */}
      <UnionSupplierDefaultsSelector
        open={defaultsSelectorOpen}
        onOpenChange={setDefaultsSelectorOpen}
        supplierId={formData.supplier_id}
        supplierName={selectedSupplierName}
        onSelect={handleDefaultsSelect}
      />
    </>
  );
}
