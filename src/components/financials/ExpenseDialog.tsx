import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
import { toast } from "sonner";
import { format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Search, Truck, Building2 } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const expenseSchema = z.object({
  supplier_id: z.string().optional(),
  cash_register_id: z.string().optional(),
  description: z.string().min(1, "Descrição é obrigatória"),
  document_type: z.string().default("outros"),
  document_number: z.string().optional(),
  payment_method: z.string().default("cash"),
  check_number: z.string().optional(),
  due_date: z.string().min(1, "Data de vencimento é obrigatória"),
  gross_value: z.string().min(1, "Valor bruto é obrigatório"),
  fine_value: z.string().optional(),
  interest_value: z.string().optional(),
  discount_value: z.string().optional(),
  other_values: z.string().optional(),
  status: z.enum(["pending", "paid", "cancelled"]).default("pending"),
  category_id: z.string().optional(),
  notes: z.string().optional(),
}).refine((data) => {
  if (data.payment_method === "check" && !data.check_number) {
    return false;
  }
  return true;
}, {
  message: "Número do cheque é obrigatório para pagamento com cheque",
  path: ["check_number"],
});

type ExpenseFormData = z.infer<typeof expenseSchema>;

interface ExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clinicId: string;
  expense?: any;
}

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
];

export function ExpenseDialog({
  open,
  onOpenChange,
  clinicId,
  expense,
}: ExpenseDialogProps) {
  const queryClient = useQueryClient();
  const [supplierSearch, setSupplierSearch] = useState("");
  const [supplierPopoverOpen, setSupplierPopoverOpen] = useState(false);

  const form = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      description: "",
      document_type: "outros",
      payment_method: "cash",
      status: "pending",
      due_date: format(new Date(), "yyyy-MM-dd"),
      gross_value: "",
      fine_value: "",
      interest_value: "",
      discount_value: "",
      other_values: "",
    },
  });

  const paymentMethod = form.watch("payment_method");
  const grossValue = form.watch("gross_value");
  const fineValue = form.watch("fine_value");
  const interestValue = form.watch("interest_value");
  const discountValue = form.watch("discount_value");
  const otherValues = form.watch("other_values");

  // Calculate net value
  const calculateNetValue = () => {
    const gross = parseFloat(grossValue?.replace(",", ".") || "0");
    const fine = parseFloat(fineValue?.replace(",", ".") || "0");
    const interest = parseFloat(interestValue?.replace(",", ".") || "0");
    const discount = parseFloat(discountValue?.replace(",", ".") || "0");
    const other = parseFloat(otherValues?.replace(",", ".") || "0");
    return gross + fine + interest - discount + other;
  };

  const netValue = calculateNetValue();

  // Fetch suppliers
  const { data: suppliers } = useQuery({
    queryKey: ["suppliers", clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id, name, cnpj")
        .eq("clinic_id", clinicId)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data;
    },
  });

  // Fetch cash registers (portadores)
  const { data: cashRegisters } = useQuery({
    queryKey: ["cash-registers", clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cash_registers")
        .select("*")
        .eq("clinic_id", clinicId)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data;
    },
  });

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ["financial-categories", clinicId, "expense"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_categories")
        .select("*")
        .eq("clinic_id", clinicId)
        .eq("type", "expense")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data;
    },
  });

  // Reset form when expense changes
  useEffect(() => {
    if (expense) {
      form.reset({
        supplier_id: expense.supplier_id || "",
        cash_register_id: expense.cash_register_id || "",
        description: expense.description || "",
        document_type: expense.document_type || "outros",
        document_number: expense.document_number || "",
        payment_method: expense.payment_method || "cash",
        check_number: expense.check_number || "",
        due_date: expense.due_date || format(new Date(), "yyyy-MM-dd"),
        gross_value: expense.gross_value?.toString() || expense.amount?.toString() || "",
        fine_value: expense.fine_value?.toString() || "",
        interest_value: expense.interest_value?.toString() || "",
        discount_value: expense.discount_value?.toString() || "",
        other_values: expense.other_values?.toString() || "",
        status: expense.status || "pending",
        category_id: expense.category_id || "",
        notes: expense.notes || "",
      });
    } else {
      form.reset({
        description: "",
        document_type: "outros",
        payment_method: "cash",
        status: "pending",
        due_date: format(new Date(), "yyyy-MM-dd"),
        gross_value: "",
        fine_value: "",
        interest_value: "",
        discount_value: "",
        other_values: "",
      });
    }
  }, [expense, open, form]);

  const createMutation = useMutation({
    mutationFn: async (data: ExpenseFormData) => {
      const gross = parseFloat(data.gross_value.replace(",", "."));
      const fine = parseFloat(data.fine_value?.replace(",", ".") || "0");
      const interest = parseFloat(data.interest_value?.replace(",", ".") || "0");
      const discount = parseFloat(data.discount_value?.replace(",", ".") || "0");
      const other = parseFloat(data.other_values?.replace(",", ".") || "0");
      const net = gross + fine + interest - discount + other;

      const payload = {
        clinic_id: clinicId,
        type: "expense" as const,
        description: data.description,
        amount: net,
        supplier_id: data.supplier_id || null,
        cash_register_id: data.cash_register_id || null,
        document_type: data.document_type,
        document_number: data.document_number || null,
        payment_method: data.payment_method,
        check_number: data.check_number || null,
        due_date: data.due_date,
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

      if (expense) {
        const { error } = await supabase
          .from("financial_transactions")
          .update(payload)
          .eq("id", expense.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("financial_transactions")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["financial-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["cash-flow"] });
      toast.success(expense ? "Despesa atualizada!" : "Despesa criada!");
      onOpenChange(false);
      form.reset();
    },
    onError: (error) => {
      toast.error("Erro ao salvar despesa: " + error.message);
    },
  });

  const onSubmit = (data: ExpenseFormData) => {
    createMutation.mutate(data);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-red-500" />
            {expense ? "Editar Despesa" : "Nova Despesa"}
          </DialogTitle>
          <DialogDescription>
            Preencha os dados da despesa. Campos com * são obrigatórios.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)] pr-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Fornecedor */}
              <FormField
                control={form.control}
                name="supplier_id"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Fornecedor</FormLabel>
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
                            <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
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
                                  value={supplier.id}
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

              {/* Portador (Conta Bancária) */}
              <FormField
                control={form.control}
                name="cash_register_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Portador / Conta Bancária</FormLabel>
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

              {/* Descrição */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Pagamento de luz" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                {/* Tipo de Documento */}
                <FormField
                  control={form.control}
                  name="document_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Documento</FormLabel>
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

                {/* Número do Documento */}
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

              <div className="grid grid-cols-2 gap-4">
                {/* Forma de Pagamento */}
                <FormField
                  control={form.control}
                  name="payment_method"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Forma de Pagamento</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
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

                {/* Número do Cheque (condicional) */}
                {paymentMethod === "check" && (
                  <FormField
                    control={form.control}
                    name="check_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nº Cheque *</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: 000123" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Data de Vencimento */}
                {paymentMethod !== "check" && (
                  <FormField
                    control={form.control}
                    name="due_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data de Vencimento *</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              {paymentMethod === "check" && (
                <FormField
                  control={form.control}
                  name="due_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de Vencimento *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <Separator />

              {/* Valores */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm">Valores</h4>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="gross_value"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valor Bruto *</FormLabel>
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
                        <FormLabel>Multa</FormLabel>
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
                        <FormLabel>Juros</FormLabel>
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
                        <FormLabel>Desconto</FormLabel>
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
                        <FormLabel>Outros Valores</FormLabel>
                        <FormControl>
                          <Input placeholder="0,00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex items-end">
                    <div className="w-full p-3 bg-muted rounded-md">
                      <p className="text-xs text-muted-foreground">Valor Líquido</p>
                      <p className="text-lg font-bold text-red-600">
                        {formatCurrency(netValue)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                {/* Categoria */}
                <FormField
                  control={form.control}
                  name="category_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categoria</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories?.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Status */}
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="pending">Em Aberto</SelectItem>
                          <SelectItem value="paid">Liquidada</SelectItem>
                          <SelectItem value="cancelled">Cancelada</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Observações */}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
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

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Salvando..." : "Salvar Despesa"}
                </Button>
              </div>
            </form>
          </Form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
