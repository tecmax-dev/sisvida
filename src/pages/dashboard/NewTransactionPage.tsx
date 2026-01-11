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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { toast } from "sonner";
import { format } from "date-fns";
import { ArrowLeft, Save, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "eclini_transaction_draft";

const transactionSchema = z.object({
  type: z.enum(["income", "expense"]),
  description: z.string().min(1, "Descrição é obrigatória"),
  amount: z.string().min(1, "Valor é obrigatório"),
  category_id: z.string().optional(),
  patient_id: z.string().optional(),
  procedure_id: z.string().optional(),
  payment_method: z.string().optional(),
  status: z.enum(["pending", "paid"]),
  due_date: z.string().optional(),
  notes: z.string().optional(),
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
};

function NewTransactionContent() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentClinic } = useAuth();
  const queryClient = useQueryClient();
  const [initialData, setInitialData] = useState<TransactionFormData>(defaultValues);

  const defaultType = (searchParams.get("type") as "income" | "expense") || "income";

  const form = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: { ...defaultValues, type: defaultType },
  });

  const type = form.watch("type");
  const procedureId = form.watch("procedure_id");
  const formData = form.watch();

  const clinicId = currentClinic?.id;

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
    enabled: !!clinicId,
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
    // Draft is persisted via storageKey in useAutoSave
    // This is just a no-op async function for the hook
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

      const amount = parseFloat(data.amount.replace(",", "."));
      if (isNaN(amount)) throw new Error("Valor inválido");

      const payload = {
        clinic_id: clinicId,
        type: data.type,
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

      const { error } = await supabase.from("financial_transactions").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["financial-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["financial-monthly"] });
      
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
    // Clear draft on explicit cancel
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

                {/* Procedure (income only) */}
                {type === "income" && procedures && procedures.length > 0 && (
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

                {/* Description */}
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem className="max-w-xl">
                      <FormLabel>Descrição *</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Consulta particular" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Amount + Date */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md">
                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valor *</FormLabel>
                        <FormControl>
                          <Input placeholder="0,00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="due_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Category + Payment Method */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
                  <FormField
                    control={form.control}
                    name="category_id"
                    render={({ field }) => {
                      const selectedCategory = categories?.find(c => c.id === field.value);
                      return (
                        <FormItem className="flex flex-col">
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

                  <FormField
                    control={form.control}
                    name="payment_method"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Forma de Pagamento</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="cash">Dinheiro</SelectItem>
                            <SelectItem value="credit_card">Cartão de Crédito</SelectItem>
                            <SelectItem value="debit_card">Cartão de Débito</SelectItem>
                            <SelectItem value="pix">PIX</SelectItem>
                            <SelectItem value="bank_transfer">Transferência</SelectItem>
                            <SelectItem value="check">Cheque</SelectItem>
                            <SelectItem value="insurance">Convênio</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

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
