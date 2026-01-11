import { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAutoSave } from "@/hooks/useAutoSave";
import { AutoSaveIndicator } from "@/components/ui/auto-save-indicator";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { FeatureGate } from "@/components/features/FeatureGate";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";
import { 
  ArrowLeft, 
  Save, 
  Check, 
  ChevronsUpDown, 
  Truck, 
  Building2,
  FileText,
  Calculator
} from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "eclini_transaction_draft";

const documentTypes = [
  { value: "nota_fiscal", label: "Nota Fiscal" },
  { value: "recibo", label: "Recibo" },
  { value: "boleto", label: "Boleto" },
  { value: "fatura", label: "Fatura" },
  { value: "cupom", label: "Cupom Fiscal" },
  { value: "outros", label: "Outros" },
];

const paymentMethods = [
  { value: "cash", label: "Dinheiro" },
  { value: "pix", label: "PIX" },
  { value: "bank_transfer", label: "Transferência Bancária" },
  { value: "check", label: "Cheque" },
  { value: "credit_card", label: "Cartão de Crédito" },
  { value: "debit_card", label: "Cartão de Débito" },
  { value: "boleto", label: "Boleto" },
  { value: "insurance", label: "Convênio" },
];

// Schema with conditional validation for expenses
const transactionSchema = z.object({
  type: z.enum(["income", "expense"]),
  description: z.string().min(1, "Descrição é obrigatória"),
  amount: z.string().optional(),
  category_id: z.string().optional(),
  patient_id: z.string().optional(),
  procedure_id: z.string().optional(),
  payment_method: z.string().optional(),
  status: z.enum(["pending", "paid"]),
  due_date: z.string().optional(),
  notes: z.string().optional(),
  // Expense-specific fields
  supplier_id: z.string().optional(),
  cash_register_id: z.string().optional(),
  document_type: z.string().optional(),
  document_number: z.string().optional(),
  check_number: z.string().optional(),
  gross_value: z.string().optional(),
  fine_value: z.string().optional(),
  interest_value: z.string().optional(),
  discount_value: z.string().optional(),
  other_values: z.string().optional(),
}).refine((data) => {
  // For expenses, validate required fields
  if (data.type === "expense") {
    if (!data.supplier_id) return false;
    if (!data.cash_register_id) return false;
    if (!data.gross_value || parseFloat(data.gross_value.replace(",", ".")) <= 0) return false;
    if (!data.payment_method) return false;
    if (data.payment_method === "check" && !data.check_number) return false;
  } else {
    // For income, require amount
    if (!data.amount) return false;
  }
  return true;
}, {
  message: "Preencha todos os campos obrigatórios",
  path: ["type"],
});

type TransactionFormData = z.infer<typeof transactionSchema>;

const defaultValues: TransactionFormData = {
  type: "income",
  description: "",
  amount: "",
  status: "pending",
  due_date: format(new Date(), "yyyy-MM-dd"),
  category_id: undefined,
  patient_id: undefined,
  procedure_id: undefined,
  payment_method: undefined,
  notes: undefined,
  supplier_id: undefined,
  cash_register_id: undefined,
  document_type: "outros",
  document_number: undefined,
  check_number: undefined,
  gross_value: "",
  fine_value: "",
  interest_value: "",
  discount_value: "",
  other_values: "",
};

function NewTransactionContent() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentClinic } = useAuth();
  const queryClient = useQueryClient();
  const [initialData, setInitialData] = useState<TransactionFormData>(defaultValues);
  const [supplierSearch, setSupplierSearch] = useState("");
  const [supplierPopoverOpen, setSupplierPopoverOpen] = useState(false);

  const defaultType = (searchParams.get("type") as "income" | "expense") || "income";

  const form = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: { ...defaultValues, type: defaultType },
  });

  const type = form.watch("type");
  const procedureId = form.watch("procedure_id");
  const paymentMethod = form.watch("payment_method");
  const grossValue = form.watch("gross_value");
  const fineValue = form.watch("fine_value");
  const interestValue = form.watch("interest_value");
  const discountValue = form.watch("discount_value");
  const otherValues = form.watch("other_values");
  const formData = form.watch();

  const clinicId = currentClinic?.id;

  // Calculate net value for expenses
  const calculateNetValue = () => {
    const gross = parseFloat(grossValue?.replace(",", ".") || "0");
    const fine = parseFloat(fineValue?.replace(",", ".") || "0");
    const interest = parseFloat(interestValue?.replace(",", ".") || "0");
    const discount = parseFloat(discountValue?.replace(",", ".") || "0");
    const other = parseFloat(otherValues?.replace(",", ".") || "0");
    return gross + fine + interest - discount + other;
  };

  const netValue = calculateNetValue();

  // Queries
  const { data: categories } = useQuery({
    queryKey: ["financial-categories", clinicId, type],
    queryFn: async () => {
      if (!clinicId) return [];
      const { data, error } = await supabase
        .from("financial_categories")
        .select("*")
        .eq("clinic_id", clinicId)
        .eq("type", type)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!clinicId,
  });

  const { data: patients } = useQuery({
    queryKey: ["patients-list", clinicId],
    queryFn: async () => {
      if (!clinicId) return [];
      const { data, error } = await supabase
        .from("patients")
        .select("id, name")
        .eq("clinic_id", clinicId)
        .order("name")
        .limit(100);
      if (error) throw error;
      return data;
    },
    enabled: !!clinicId && type === "income",
  });

  const { data: procedures } = useQuery({
    queryKey: ["procedures-list", clinicId],
    queryFn: async () => {
      if (!clinicId) return [];
      const { data, error } = await supabase
        .from("procedures")
        .select("id, name, price")
        .eq("clinic_id", clinicId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!clinicId && type === "income",
  });

  // Expense-specific queries
  const { data: suppliers } = useQuery({
    queryKey: ["suppliers", clinicId],
    queryFn: async () => {
      if (!clinicId) return [];
      const { data, error } = await supabase
        .from("suppliers")
        .select("id, name, cnpj")
        .eq("clinic_id", clinicId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!clinicId && type === "expense",
  });

  const { data: cashRegisters } = useQuery({
    queryKey: ["cash-registers", clinicId],
    queryFn: async () => {
      if (!clinicId) return [];
      const { data, error } = await supabase
        .from("cash_registers")
        .select("*")
        .eq("clinic_id", clinicId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!clinicId && type === "expense",
  });

  // Auto-fill from procedure
  useEffect(() => {
    if (procedureId && procedures) {
      const selectedProcedure = procedures.find((p) => p.id === procedureId);
      if (selectedProcedure) {
        form.setValue("amount", selectedProcedure.price.toString());
        if (!form.getValues("description")) {
          form.setValue("description", selectedProcedure.name);
        }
      }
    }
  }, [procedureId, procedures, form]);

  // Save draft to localStorage (for auto-save)
  const saveDraft = useCallback(async (data: TransactionFormData) => {
    return Promise.resolve();
  }, []);

  // Auto-save hook
  const { status: autoSaveStatus, hasUnsavedChanges } = useAutoSave({
    data: formData,
    initialData,
    onSave: saveDraft,
    debounceMs: 2000,
    enabled: true,
    storageKey: STORAGE_KEY,
    onRestoreDraft: (draft) => {
      form.reset(draft);
      setInitialData(draft);
      toast.info("Rascunho restaurado");
    },
  });

  // Set initial data after form is ready
  useEffect(() => {
    setInitialData({ ...defaultValues, type: defaultType });
  }, [defaultType]);

  // Mutation
  const createMutation = useMutation({
    mutationFn: async (data: TransactionFormData) => {
      if (!clinicId) throw new Error("Clínica não encontrada");

      let payload: Record<string, any>;

      if (data.type === "expense") {
        // Expense payload with all advanced fields
        const gross = parseFloat(data.gross_value?.replace(",", ".") || "0");
        const fine = parseFloat(data.fine_value?.replace(",", ".") || "0");
        const interest = parseFloat(data.interest_value?.replace(",", ".") || "0");
        const discount = parseFloat(data.discount_value?.replace(",", ".") || "0");
        const other = parseFloat(data.other_values?.replace(",", ".") || "0");
        const net = gross + fine + interest - discount + other;

        payload = {
          clinic_id: clinicId,
          type: "expense",
          description: data.description,
          amount: net,
          supplier_id: data.supplier_id || null,
          cash_register_id: data.cash_register_id || null,
          document_type: data.document_type || null,
          document_number: data.document_number || null,
          payment_method: data.payment_method || null,
          check_number: data.check_number || null,
          due_date: data.due_date || null,
          gross_value: gross,
          fine_value: fine,
          interest_value: interest,
          discount_value: discount,
          other_values: other,
          net_value: net,
          status: data.status,
          category_id: data.category_id || null,
          notes: data.notes || null,
          paid_date: data.status === "paid" ? format(new Date(), "yyyy-MM-dd") : null,
        };
      } else {
        // Income payload
        const amount = parseFloat(data.amount?.replace(",", ".") || "0");
        if (isNaN(amount) || amount <= 0) throw new Error("Valor inválido");

        payload = {
          clinic_id: clinicId,
          type: "income",
          description: data.description,
          amount,
          category_id: data.category_id || null,
          patient_id: data.patient_id || null,
          procedure_id: data.procedure_id || null,
          payment_method: data.payment_method || null,
          status: data.status,
          due_date: data.due_date || null,
          paid_date: data.status === "paid" ? format(new Date(), "yyyy-MM-dd") : null,
          notes: data.notes || null,
        };
      }

      const { error } = await supabase.from("financial_transactions").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["financial-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["financial-monthly"] });
      queryClient.invalidateQueries({ queryKey: ["cash-flow"] });
      
      // Clear draft
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {}
      
      toast.success("Transação criada com sucesso!");
      navigate("/dashboard/financials");
    },
    onError: (error) => {
      toast.error("Erro ao criar transação: " + error.message);
    },
  });

  const onSubmit = (data: TransactionFormData) => {
    createMutation.mutate(data);
  };

  const handleCancel = () => {
    if (hasUnsavedChanges) {
      const confirm = window.confirm("Você tem alterações não salvas. Deseja realmente sair?");
      if (!confirm) return;
    }
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    navigate("/dashboard/financials");
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  const filteredSuppliers = suppliers?.filter(
    (s) =>
      s.name.toLowerCase().includes(supplierSearch.toLowerCase()) ||
      s.cnpj?.includes(supplierSearch)
  );

  const selectedSupplier = suppliers?.find(
    (s) => s.id === form.watch("supplier_id")
  );

  if (!currentClinic) {
    return null;
  }

  return (
    <RoleGuard permission="view_financials">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={handleCancel}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Nova Transação</h1>
              <p className="text-muted-foreground text-sm">
                Registre uma nova receita ou despesa
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <AutoSaveIndicator status={autoSaveStatus} />
            <Button
              onClick={form.handleSubmit(onSubmit)}
              disabled={createMutation.isPending}
            >
              <Save className="h-4 w-4 mr-2" />
              {createMutation.isPending ? "Salvando..." : "Salvar Transação"}
            </Button>
          </div>
        </div>

        {/* Form Card */}
        <Card>
          <CardHeader>
            <CardTitle>Dados da Transação</CardTitle>
            <CardDescription>
              {type === "expense" 
                ? "Preencha os dados da despesa. Fornecedor, portador e valor são obrigatórios."
                : "Preencha os dados da receita."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Type Tabs */}
                <Tabs
                  value={type}
                  onValueChange={(v) => form.setValue("type", v as "income" | "expense")}
                >
                  <TabsList className="w-full max-w-md">
                    <TabsTrigger value="income" className="flex-1">
                      Receita
                    </TabsTrigger>
                    <TabsTrigger value="expense" className="flex-1">
                      Despesa
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                {/* ===== EXPENSE SPECIFIC FIELDS ===== */}
                {type === "expense" && (
                  <>
                    {/* Supplier Selection */}
                    <FormField
                      control={form.control}
                      name="supplier_id"
                      render={({ field }) => (
                        <FormItem className="flex flex-col max-w-xl">
                          <FormLabel className="flex items-center gap-1">
                            Fornecedor <span className="text-red-500">*</span>
                          </FormLabel>
                          <Popover open={supplierPopoverOpen} onOpenChange={setSupplierPopoverOpen}>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  className={cn(
                                    "w-full justify-between",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  {selectedSupplier ? (
                                    <span className="flex items-center gap-2">
                                      <Truck className="h-4 w-4" />
                                      {selectedSupplier.name}
                                    </span>
                                  ) : (
                                    "Selecione um fornecedor"
                                  )}
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-[400px] p-0" align="start">
                              <Command>
                                <CommandInput
                                  placeholder="Buscar fornecedor..."
                                  value={supplierSearch}
                                  onValueChange={setSupplierSearch}
                                />
                                <CommandList>
                                  <CommandEmpty>Nenhum fornecedor encontrado.</CommandEmpty>
                                  <CommandGroup>
                                    {filteredSuppliers?.map((supplier) => (
                                      <CommandItem
                                        key={supplier.id}
                                        value={supplier.name}
                                        onSelect={() => {
                                          form.setValue("supplier_id", supplier.id);
                                          setSupplierPopoverOpen(false);
                                          setSupplierSearch("");
                                        }}
                                      >
                                        <div className="flex flex-col">
                                          <span className="font-medium">{supplier.name}</span>
                                          {supplier.cnpj && (
                                            <span className="text-xs text-muted-foreground">
                                              CNPJ: {supplier.cnpj}
                                            </span>
                                          )}
                                        </div>
                                        <Check
                                          className={cn(
                                            "ml-auto h-4 w-4",
                                            field.value === supplier.id ? "opacity-100" : "opacity-0"
                                          )}
                                        />
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Cash Register (Portador) */}
                    <FormField
                      control={form.control}
                      name="cash_register_id"
                      render={({ field }) => (
                        <FormItem className="max-w-xl">
                          <FormLabel className="flex items-center gap-1">
                            Portador / Conta Bancária <span className="text-red-500">*</span>
                          </FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o portador" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {cashRegisters?.map((register) => (
                                <SelectItem key={register.id} value={register.id}>
                                  <span className="flex items-center gap-2">
                                    <Building2 className="h-4 w-4" />
                                    {register.name}
                                    {register.bank_name && (
                                      <Badge variant="outline" className="text-xs ml-2">
                                        {register.bank_name}
                                      </Badge>
                                    )}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Document Type + Number */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
                      <FormField
                        control={form.control}
                        name="document_type"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-1">
                              <FileText className="h-4 w-4" />
                              Tipo de Documento
                            </FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {documentTypes.map((type) => (
                                  <SelectItem key={type.value} value={type.value}>
                                    {type.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="document_number"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nº Documento</FormLabel>
                            <FormControl>
                              <Input placeholder="Ex: 12345" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <Separator />

                    {/* Value Decomposition Section */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Calculator className="h-5 w-5 text-primary" />
                        <h4 className="font-medium">Decomposição de Valores</h4>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-2xl">
                        <FormField
                          control={form.control}
                          name="gross_value"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex items-center gap-1">
                                Valor Bruto <span className="text-red-500">*</span>
                              </FormLabel>
                              <FormControl>
                                <Input placeholder="0,00" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="fine_value"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Multa (+)</FormLabel>
                              <FormControl>
                                <Input placeholder="0,00" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="interest_value"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Juros (+)</FormLabel>
                              <FormControl>
                                <Input placeholder="0,00" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="discount_value"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Desconto (-)</FormLabel>
                              <FormControl>
                                <Input placeholder="0,00" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="other_values"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Outros (+/-)</FormLabel>
                              <FormControl>
                                <Input placeholder="0,00" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Net Value Display */}
                        <div className="flex flex-col justify-end">
                          <div className="rounded-lg border-2 border-primary bg-primary/5 p-3 text-center">
                            <p className="text-xs text-muted-foreground mb-1">Valor Líquido</p>
                            <p className="text-xl font-bold text-primary">
                              {formatCurrency(netValue)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <Separator />
                  </>
                )}

                {/* ===== INCOME SPECIFIC FIELDS ===== */}
                {type === "income" && (
                  <>
                    {/* Procedure (income only) */}
                    {procedures && procedures.length > 0 && (
                      <FormField
                        control={form.control}
                        name="procedure_id"
                        render={({ field }) => (
                          <FormItem className="max-w-md">
                            <FormLabel>Procedimento</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione um procedimento (opcional)" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {procedures.map((p) => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.name} - {formatCurrency(p.price)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    {/* Amount for income */}
                    <FormField
                      control={form.control}
                      name="amount"
                      render={({ field }) => (
                        <FormItem className="max-w-xs">
                          <FormLabel className="flex items-center gap-1">
                            Valor <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input placeholder="0,00" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}

                {/* ===== COMMON FIELDS ===== */}
                {/* Description */}
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem className="max-w-xl">
                      <FormLabel className="flex items-center gap-1">
                        Descrição <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Consulta particular" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Date + Payment Method + Check Number */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl">
                  <FormField
                    control={form.control}
                    name="due_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data de Vencimento</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="payment_method"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1">
                          Forma de Pagamento
                          {type === "expense" && <span className="text-red-500">*</span>}
                        </FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {paymentMethods.map((method) => (
                              <SelectItem key={method.value} value={method.value}>
                                {method.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Check Number (conditional) */}
                  {paymentMethod === "check" && (
                    <FormField
                      control={form.control}
                      name="check_number"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1">
                            Nº do Cheque <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input placeholder="Ex: 000123" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                {/* Category */}
                <FormField
                  control={form.control}
                  name="category_id"
                  render={({ field }) => {
                    const selectedCategory = categories?.find(c => c.id === field.value);
                    return (
                      <FormItem className="flex flex-col max-w-md">
                        <FormLabel>Categoria</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                role="combobox"
                                className={cn(
                                  "w-full justify-between",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {selectedCategory ? (
                                  <span className="flex items-center gap-2">
                                    <span
                                      className="w-3 h-3 rounded-full shrink-0"
                                      style={{ backgroundColor: selectedCategory.color || '#888' }}
                                    />
                                    {selectedCategory.name}
                                  </span>
                                ) : (
                                  "Buscar categoria..."
                                )}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-[300px] p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Buscar categoria..." />
                              <CommandList>
                                <CommandEmpty>Nenhuma categoria encontrada.</CommandEmpty>
                                <CommandGroup>
                                  {categories?.map((cat) => (
                                    <CommandItem
                                      key={cat.id}
                                      value={cat.name}
                                      onSelect={() => {
                                        field.onChange(cat.id);
                                      }}
                                    >
                                      <span
                                        className="w-3 h-3 rounded-full mr-2 shrink-0"
                                        style={{ backgroundColor: cat.color || '#888' }}
                                      />
                                      {cat.name}
                                      <Check
                                        className={cn(
                                          "ml-auto h-4 w-4",
                                          field.value === cat.id ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />

                {/* Patient (income only) */}
                {type === "income" && (
                  <FormField
                    control={form.control}
                    name="patient_id"
                    render={({ field }) => (
                      <FormItem className="max-w-md">
                        <FormLabel>Paciente</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione (opcional)" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {patients?.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Status */}
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem className="max-w-xs">
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="pending">Pendente</SelectItem>
                          <SelectItem value="paid">Pago</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Notes */}
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem className="max-w-xl">
                      <FormLabel>Observações</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Anotações adicionais..."
                          className="resize-none"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Footer Buttons */}
                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={handleCancel}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    <Save className="h-4 w-4 mr-2" />
                    {createMutation.isPending ? "Salvando..." : "Salvar Transação"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </RoleGuard>
  );
}

export default function NewTransactionPage() {
  return (
    <FeatureGate feature="financial_management" showUpgradePrompt>
      <NewTransactionContent />
    </FeatureGate>
  );
}
