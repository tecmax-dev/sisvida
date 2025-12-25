import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, MoreHorizontal, Trash2, Play, Pause, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface RecurringPanelProps {
  clinicId: string;
}

const recurringSchema = z.object({
  type: z.enum(["income", "expense"]),
  description: z.string().min(1, "Descrição é obrigatória"),
  amount: z.string().min(1, "Valor é obrigatório"),
  frequency: z.enum(["daily", "weekly", "monthly", "yearly"]),
  start_date: z.string().min(1, "Data inicial é obrigatória"),
  end_date: z.string().optional(),
  day_of_month: z.string().optional(),
  category_id: z.string().optional(),
});

type RecurringFormData = z.infer<typeof recurringSchema>;

const frequencyLabels: Record<string, string> = {
  daily: "Diária",
  weekly: "Semanal",
  monthly: "Mensal",
  yearly: "Anual",
};

export function RecurringPanel({ clinicId }: RecurringPanelProps) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  const form = useForm<RecurringFormData>({
    resolver: zodResolver(recurringSchema),
    defaultValues: {
      type: "expense",
      description: "",
      amount: "",
      frequency: "monthly",
      start_date: format(new Date(), "yyyy-MM-dd"),
    },
  });

  const type = form.watch("type");

  const { data: recurrings, isLoading } = useQuery({
    queryKey: ["recurring-transactions", clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recurring_transactions")
        .select(`
          *,
          financial_categories (name)
        `)
        .eq("clinic_id", clinicId)
        .order("next_due_date");

      if (error) throw error;
      return data;
    },
  });

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

  const createMutation = useMutation({
    mutationFn: async (data: RecurringFormData) => {
      const amount = parseFloat(data.amount.replace(",", "."));
      if (isNaN(amount)) throw new Error("Valor inválido");

      const { error } = await supabase
        .from("recurring_transactions")
        .insert({
          clinic_id: clinicId,
          type: data.type,
          description: data.description,
          amount,
          frequency: data.frequency,
          start_date: data.start_date,
          end_date: data.end_date || null,
          next_due_date: data.start_date,
          day_of_month: data.day_of_month ? parseInt(data.day_of_month) : null,
          category_id: data.category_id || null,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring-transactions"] });
      toast.success("Recorrência criada!");
      setDialogOpen(false);
      form.reset();
    },
    onError: (error) => {
      toast.error("Erro ao criar recorrência: " + error.message);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("recurring_transactions")
        .update({ is_active: !isActive })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring-transactions"] });
      toast.success("Status atualizado!");
    },
    onError: () => {
      toast.error("Erro ao atualizar status");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("recurring_transactions")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring-transactions"] });
      toast.success("Recorrência removida!");
    },
    onError: () => {
      toast.error("Erro ao remover recorrência");
    },
  });

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  if (isLoading) {
    return <Skeleton className="h-96" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Transações Recorrentes</h3>
          <p className="text-sm text-muted-foreground">
            Configure receitas e despesas que se repetem automaticamente
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Recorrência
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Recorrências Cadastradas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recurrings && recurrings.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Frequência</TableHead>
                  <TableHead>Próximo Vcto</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recurrings.map((recurring) => (
                  <TableRow key={recurring.id} className={!recurring.is_active ? "opacity-50" : ""}>
                    <TableCell>
                      <Badge
                        variant={recurring.is_active ? "default" : "secondary"}
                        className={recurring.is_active ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200" : ""}
                      >
                        {recurring.is_active ? "Ativa" : "Pausada"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {recurring.description}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={recurring.type === "income" ? "border-emerald-500 text-emerald-600" : "border-red-500 text-red-600"}
                      >
                        {recurring.type === "income" ? "Receita" : "Despesa"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {frequencyLabels[recurring.frequency]}
                    </TableCell>
                    <TableCell>
                      {format(parseISO(recurring.next_due_date), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell className={`text-right font-medium ${
                      recurring.type === "income" ? "text-emerald-600" : "text-red-600"
                    }`}>
                      {recurring.type === "expense" ? "- " : "+ "}
                      {formatCurrency(Number(recurring.amount))}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => toggleMutation.mutate({ id: recurring.id, isActive: recurring.is_active })}
                          >
                            {recurring.is_active ? (
                              <>
                                <Pause className="h-4 w-4 mr-2" />
                                Pausar
                              </>
                            ) : (
                              <>
                                <Play className="h-4 w-4 mr-2" />
                                Ativar
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => deleteMutation.mutate(recurring.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              Nenhuma recorrência cadastrada
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Recorrência</DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
              <Tabs
                value={type}
                onValueChange={(v) => form.setValue("type", v as "income" | "expense")}
              >
                <TabsList className="w-full">
                  <TabsTrigger value="income" className="flex-1">Receita</TabsTrigger>
                  <TabsTrigger value="expense" className="flex-1">Despesa</TabsTrigger>
                </TabsList>
              </Tabs>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Aluguel mensal" {...field} />
                    </FormControl>
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
                  name="frequency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Frequência</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="daily">Diária</SelectItem>
                          <SelectItem value="weekly">Semanal</SelectItem>
                          <SelectItem value="monthly">Mensal</SelectItem>
                          <SelectItem value="yearly">Anual</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="start_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data Inicial *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="end_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data Final (opcional)</FormLabel>
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
                name="category_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoria</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma categoria" />
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

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
