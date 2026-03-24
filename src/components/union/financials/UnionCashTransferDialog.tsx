import { useState } from "react";
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
import { ArrowRightLeft } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const transferSchema = z.object({
  from_register_id: z.string().min(1, "Conta de origem é obrigatória"),
  to_register_id: z.string().min(1, "Conta de destino é obrigatória"),
  amount: z.string().min(1, "Valor é obrigatório"),
  transfer_date: z.string().min(1, "Data é obrigatória"),
  description: z.string().optional(),
  check_number: z.string().optional(),
}).refine((data) => data.from_register_id !== data.to_register_id, {
  message: "A conta de origem e destino devem ser diferentes",
  path: ["to_register_id"],
});

type TransferFormData = z.infer<typeof transferSchema>;

interface UnionCashTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clinicId: string;
}

export function UnionCashTransferDialog({
  open,
  onOpenChange,
  clinicId,
}: UnionCashTransferDialogProps) {
  const queryClient = useQueryClient();
  const [useCheck, setUseCheck] = useState(false);

  const form = useForm<TransferFormData>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      from_register_id: "",
      to_register_id: "",
      amount: "",
      transfer_date: format(new Date(), "yyyy-MM-dd"),
      description: "",
      check_number: "",
    },
  });

  const { data: cashRegisters } = useQuery({
    queryKey: ["union-cash-registers-transfer", clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("union_cash_registers")
        .select("id, name, current_balance, bank_name, type")
        .eq("clinic_id", clinicId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!clinicId && open,
  });

  const fromRegisterId = form.watch("from_register_id");
  const selectedFromRegister = cashRegisters?.find(r => r.id === fromRegisterId);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const createTransferMutation = useMutation({
    mutationFn: async (data: TransferFormData) => {
      const amount = parseFloat(data.amount.replace(",", "."));
      if (isNaN(amount) || amount <= 0) throw new Error("Valor inválido");

      // Get current balances
      const { data: fromReg, error: fromErr } = await supabase
        .from("union_cash_registers")
        .select("current_balance, name")
        .eq("id", data.from_register_id)
        .single();
      if (fromErr) throw fromErr;

      const { data: toReg, error: toErr } = await supabase
        .from("union_cash_registers")
        .select("current_balance, name")
        .eq("id", data.to_register_id)
        .single();
      if (toErr) throw toErr;

      const descBase = data.description || `Transferência entre contas`;
      const checkNum = useCheck && data.check_number ? data.check_number.replace(/[^0-9]/g, "") : null;

      // 1. Register the transfer record
      const { error: transferError } = await supabase
        .from("union_cash_transfers")
        .insert({
          clinic_id: clinicId,
          from_register_id: data.from_register_id,
          to_register_id: data.to_register_id,
          amount,
          transfer_date: data.transfer_date,
          description: descBase,
          check_number: checkNum,
          created_by: (await supabase.auth.getUser()).data.user?.id || null,
        });
      if (transferError) throw transferError;

      // 2. Create expense transaction on source account (debit)
      const { error: expenseError } = await supabase
        .from("union_financial_transactions")
        .insert({
          clinic_id: clinicId,
          type: "expense",
          description: `TRANSF. P/ ${toReg.name} - ${descBase}`,
          amount,
          due_date: data.transfer_date,
          paid_date: data.transfer_date,
          status: "paid",
          cash_register_id: data.from_register_id,
          payment_method: useCheck ? "check" : "bank_transfer",
          check_number: checkNum,
          notes: `Transferência entre contas`,
        });
      if (expenseError) throw expenseError;

      // 3. Create income transaction on destination account (credit)
      const { error: incomeError } = await supabase
        .from("union_financial_transactions")
        .insert({
          clinic_id: clinicId,
          type: "income",
          description: `TRANSF. DE ${fromReg.name} - ${descBase}`,
          amount,
          due_date: data.transfer_date,
          paid_date: data.transfer_date,
          status: "paid",
          cash_register_id: data.to_register_id,
          payment_method: useCheck ? "check" : "bank_transfer",
          check_number: checkNum,
          notes: `Transferência entre contas`,
        });
      if (incomeError) throw incomeError;

      // Note: union_cash_register balance updates are handled by the
      // update_union_cash_register_balance() trigger on union_financial_transactions
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["union-cash-registers"] });
      queryClient.invalidateQueries({ queryKey: ["union-cash-registers-statement"] });
      queryClient.invalidateQueries({ queryKey: ["union-cash-registers-transfer"] });
      queryClient.invalidateQueries({ queryKey: ["union-statement-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["union-statement-previous-balance"] });
      queryClient.invalidateQueries({ queryKey: ["union-financial-transactions"] });
      toast.success("Transferência realizada com sucesso!");
      onOpenChange(false);
      form.reset({
        from_register_id: "",
        to_register_id: "",
        amount: "",
        transfer_date: format(new Date(), "yyyy-MM-dd"),
        description: "",
        check_number: "",
      });
      setUseCheck(false);
    },
    onError: (error: Error) => {
      toast.error("Erro na transferência: " + error.message);
    },
  });

  const onSubmit = (data: TransferFormData) => {
    createTransferMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Transferência entre Contas
          </DialogTitle>
          <DialogDescription>
            Transfira valores entre contas/portadores. As movimentações aparecerão no extrato de ambas as contas.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Source Account */}
            <FormField
              control={form.control}
              name="from_register_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Conta de Origem *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a conta de origem" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {cashRegisters?.map((reg) => (
                        <SelectItem key={reg.id} value={reg.id}>
                          {reg.name}
                          {reg.bank_name ? ` (${reg.bank_name})` : ""}
                          {" — "}
                          {formatCurrency(Number(reg.current_balance || 0))}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Destination Account */}
            <FormField
              control={form.control}
              name="to_register_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Conta de Destino *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a conta de destino" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {cashRegisters
                        ?.filter((r) => r.id !== fromRegisterId)
                        .map((reg) => (
                          <SelectItem key={reg.id} value={reg.id}>
                            {reg.name}
                            {reg.bank_name ? ` (${reg.bank_name})` : ""}
                            {" — "}
                            {formatCurrency(Number(reg.current_balance || 0))}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
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
                name="transfer_date"
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

            {/* Check toggle */}
            <div className="flex items-center gap-3 py-2">
              <Switch
                id="use-check"
                checked={useCheck}
                onCheckedChange={setUseCheck}
              />
              <Label htmlFor="use-check" className="text-sm cursor-pointer">
                Transferência via cheque
              </Label>
            </div>

            {/* Check Number */}
            {useCheck && (
              <FormField
                control={form.control}
                name="check_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nº do Cheque *</FormLabel>
                    <FormControl>
                      <Input placeholder="Número do cheque" {...field} />
                    </FormControl>
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
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Motivo da transferência..."
                      className="resize-none"
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Balance preview */}
            {selectedFromRegister && (
              <div className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
                Saldo atual da conta de origem:{" "}
                <span className="font-semibold text-foreground">
                  {formatCurrency(Number(selectedFromRegister.current_balance || 0))}
                </span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={createTransferMutation.isPending}>
                {createTransferMutation.isPending ? "Transferindo..." : "Confirmar Transferência"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
