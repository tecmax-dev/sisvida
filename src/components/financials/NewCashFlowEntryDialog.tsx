import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PopupBase, PopupHeader, PopupTitle, PopupDescription, PopupFooter } from "@/components/ui/popup-base";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format } from "date-fns";
import { TrendingUp, TrendingDown } from "lucide-react";

const entrySchema = z.object({
  type: z.enum(["income", "expense"]),
  description: z.string().min(1, "Descrição é obrigatória"),
  amount: z.string().min(1, "Valor é obrigatório"),
  due_date: z.string().min(1, "Data é obrigatória"),
  category_id: z.string().optional(),
  cash_register_id: z.string().optional(),
  payment_method: z.string().optional(),
  notes: z.string().optional(),
});

type EntryFormData = z.infer<typeof entrySchema>;

interface NewCashFlowEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clinicId: string;
}

export function NewCashFlowEntryDialog({
  open,
  onOpenChange,
  clinicId,
}: NewCashFlowEntryDialogProps) {
  const queryClient = useQueryClient();

  const form = useForm<EntryFormData>({
    resolver: zodResolver(entrySchema),
    defaultValues: {
      type: "income",
      description: "",
      amount: "",
      due_date: format(new Date(), "yyyy-MM-dd"),
      payment_method: "cash",
    },
  });

  const type = form.watch("type");

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ["financial-categories", clinicId, type],
    queryFn: async () => {
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
  });

  // Fetch cash registers
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

  const createMutation = useMutation({
    mutationFn: async (data: EntryFormData) => {
      const amount = parseFloat(data.amount.replace(",", "."));
      if (isNaN(amount)) throw new Error("Valor inválido");

      const payload = {
        clinic_id: clinicId,
        type: data.type,
        description: data.description,
        amount,
        due_date: data.due_date,
        paid_date: data.due_date,
        status: "paid" as const,
        category_id: data.category_id || null,
        cash_register_id: data.cash_register_id || null,
        payment_method: data.payment_method || null,
        notes: data.notes || null,
      };

      const { error } = await supabase
        .from("financial_transactions")
        .insert(payload);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cash-flow"] });
      queryClient.invalidateQueries({ queryKey: ["financial-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["financial-metrics"] });
      toast.success("Lançamento criado com sucesso!");
      onOpenChange(false);
      form.reset({
        type: "income",
        description: "",
        amount: "",
        due_date: format(new Date(), "yyyy-MM-dd"),
        payment_method: "cash",
      });
    },
    onError: (error: Error) => {
      toast.error("Erro ao criar lançamento: " + error.message);
    },
  });

  const onSubmit = (data: EntryFormData) => {
    createMutation.mutate(data);
  };

  return (
    <PopupBase open={open} onClose={() => onOpenChange(false)} maxWidth="md">
      <PopupHeader>
        <PopupTitle>Novo Lançamento</PopupTitle>
        <PopupDescription>
          Adicione uma entrada ou saída manual no fluxo de caixa.
        </PopupDescription>
      </PopupHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Type Toggle */}
          <Tabs
            value={type}
            onValueChange={(v) => form.setValue("type", v as "income" | "expense")}
          >
            <TabsList className="w-full">
              <TabsTrigger value="income" className="flex-1 gap-2">
                <TrendingUp className="h-4 w-4" />
                Entrada
              </TabsTrigger>
              <TabsTrigger value="expense" className="flex-1 gap-2">
                <TrendingDown className="h-4 w-4" />
                Saída
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Description */}
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Descrição *</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: Pagamento de cliente" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-4">
            {/* Amount */}
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

            {/* Date */}
            <FormField
              control={form.control}
              name="due_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data *</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Category */}
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

          {/* Cash Register */}
          <FormField
            control={form.control}
            name="cash_register_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Caixa / Conta</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {cashRegisters?.map((register) => (
                      <SelectItem key={register.id} value={register.id}>
                        {register.name}
                        {register.bank_name && ` (${register.bank_name})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Payment Method */}
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
                    <SelectItem value="cash">Dinheiro</SelectItem>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="bank_transfer">Transferência</SelectItem>
                    <SelectItem value="credit_card">Cartão de Crédito</SelectItem>
                    <SelectItem value="debit_card">Cartão de Débito</SelectItem>
                    <SelectItem value="check">Cheque</SelectItem>
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
              <FormItem>
                <FormLabel>Observações</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Anotações adicionais..."
                    className="resize-none"
                    rows={2}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <PopupFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Salvando..." : "Salvar Lançamento"}
            </Button>
          </PopupFooter>
        </form>
      </Form>
    </PopupBase>
  );
}
