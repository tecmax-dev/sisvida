import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PopupBase, PopupHeader, PopupTitle, PopupFooter } from "@/components/ui/popup-base";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, ArrowRight, Wallet } from "lucide-react";
import { FinancialExportButton } from "./FinancialExportButton";
import { exportTransfers, TransferData } from "@/lib/financialExportUtils";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TransfersPanelProps {
  clinicId: string;
}

const transferSchema = z.object({
  from_register_id: z.string().min(1, "Origem é obrigatória"),
  to_register_id: z.string().min(1, "Destino é obrigatório"),
  amount: z.string().min(1, "Valor é obrigatório"),
  description: z.string().optional(),
  transfer_date: z.string(),
}).refine((data) => data.from_register_id !== data.to_register_id, {
  message: "Origem e destino devem ser diferentes",
  path: ["to_register_id"],
});

type TransferFormData = z.infer<typeof transferSchema>;

export function TransfersPanel({ clinicId }: TransfersPanelProps) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  const form = useForm<TransferFormData>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      from_register_id: "",
      to_register_id: "",
      amount: "",
      description: "",
      transfer_date: format(new Date(), "yyyy-MM-dd"),
    },
  });

  const { data: registers } = useQuery({
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

  const { data: transfers, isLoading } = useQuery({
    queryKey: ["cash-transfers", clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cash_transfers")
        .select(`
          *,
          from_register:cash_registers!cash_transfers_from_register_id_fkey(name),
          to_register:cash_registers!cash_transfers_to_register_id_fkey(name)
        `)
        .eq("clinic_id", clinicId)
        .order("transfer_date", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: TransferFormData) => {
      const amount = parseFloat(data.amount.replace(",", "."));
      if (isNaN(amount) || amount <= 0) throw new Error("Valor inválido");

      // Create transfer record
      const { error: transferError } = await supabase
        .from("cash_transfers")
        .insert({
          clinic_id: clinicId,
          from_register_id: data.from_register_id,
          to_register_id: data.to_register_id,
          amount,
          description: data.description || null,
          transfer_date: data.transfer_date,
        });

      if (transferError) throw transferError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cash-transfers"] });
      queryClient.invalidateQueries({ queryKey: ["cash-registers"] });
      toast.success("Transferência realizada!");
      setDialogOpen(false);
      form.reset({
        from_register_id: "",
        to_register_id: "",
        amount: "",
        description: "",
        transfer_date: format(new Date(), "yyyy-MM-dd"),
      });
    },
    onError: (error) => {
      toast.error("Erro ao realizar transferência: " + error.message);
    },
  });

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  const handleExport = (exportFormat: 'pdf' | 'excel') => {
    const exportData: TransferData[] = (transfers || []).map(t => ({
      date: format(parseISO(t.transfer_date), "dd/MM/yyyy", { locale: ptBR }),
      from: (t.from_register as any)?.name || "-",
      to: (t.to_register as any)?.name || "-",
      amount: Number(t.amount),
      description: t.description || "",
    }));
    
    const totalAmount = transfers?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;
    
    exportTransfers("Clínica", "Período atual", exportData, totalAmount, exportFormat);
  };

  if (isLoading) {
    return <Skeleton className="h-96" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Transferências</h3>
          <p className="text-sm text-muted-foreground">
            Transfira valores entre caixas e contas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <FinancialExportButton
            onExportPDF={() => handleExport('pdf')}
            onExportExcel={() => handleExport('excel')}
            disabled={!transfers?.length}
          />
          <Button onClick={() => setDialogOpen(true)} disabled={!registers || registers.length < 2}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Transferência
          </Button>
        </div>
      </div>

      {(!registers || registers.length < 2) && (
        <Card className="border-amber-200 dark:border-amber-800">
          <CardContent className="py-4">
            <p className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Você precisa ter pelo menos 2 caixas cadastrados para fazer transferências.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico de Transferências</CardTitle>
        </CardHeader>
        <CardContent>
          {transfers && transfers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead></TableHead>
                  <TableHead>Destino</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfers.map((transfer) => (
                  <TableRow key={transfer.id}>
                    <TableCell>
                      {format(parseISO(transfer.transfer_date), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="font-medium">
                      {(transfer.from_register as any)?.name}
                    </TableCell>
                    <TableCell>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                    <TableCell className="font-medium">
                      {(transfer.to_register as any)?.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {transfer.description || "-"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(Number(transfer.amount))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              Nenhuma transferência realizada
            </div>
          )}
        </CardContent>
      </Card>

      <PopupBase open={dialogOpen} onClose={() => setDialogOpen(false)}>
        <PopupHeader>
          <PopupTitle>Nova Transferência</PopupTitle>
        </PopupHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
              <FormField
                control={form.control}
                name="from_register_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Origem *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o caixa de origem" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {registers?.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.name} ({formatCurrency(Number(r.current_balance))})
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
                name="to_register_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Destino *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o caixa de destino" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {registers?.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
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
                  name="transfer_date"
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

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição</FormLabel>
                    <FormControl>
                      <Input placeholder="Descrição da transferência" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Transferindo..." : "Transferir"}
                </Button>
              </div>
            </form>
          </Form>
      </PopupBase>
    </div>
  );
}
