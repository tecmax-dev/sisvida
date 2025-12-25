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
import { Plus, MoreHorizontal, Check, X, Users, DollarSign } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CommissionsPanelProps {
  clinicId: string;
}

const commissionSchema = z.object({
  professional_id: z.string().min(1, "Profissional é obrigatório"),
  amount: z.string().min(1, "Valor é obrigatório"),
  percentage: z.string().optional(),
  description: z.string().min(1, "Descrição é obrigatória"),
  due_date: z.string().optional(),
});

type CommissionFormData = z.infer<typeof commissionSchema>;

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  paid: "Pago",
  cancelled: "Cancelado",
};

const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  paid: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  cancelled: "bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200",
};

export function CommissionsPanel({ clinicId }: CommissionsPanelProps) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "paid">("all");

  const form = useForm<CommissionFormData>({
    resolver: zodResolver(commissionSchema),
    defaultValues: {
      professional_id: "",
      amount: "",
      percentage: "",
      description: "",
      due_date: format(new Date(), "yyyy-MM-dd"),
    },
  });

  const { data: professionals } = useQuery({
    queryKey: ["professionals", clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("professionals")
        .select("id, name")
        .eq("clinic_id", clinicId)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data;
    },
  });

  const { data: commissions, isLoading } = useQuery({
    queryKey: ["commissions", clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("professional_commissions")
        .select(`
          *,
          professionals (name)
        `)
        .eq("clinic_id", clinicId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CommissionFormData) => {
      const amount = parseFloat(data.amount.replace(",", "."));
      if (isNaN(amount)) throw new Error("Valor inválido");

      const { error } = await supabase
        .from("professional_commissions")
        .insert({
          clinic_id: clinicId,
          professional_id: data.professional_id,
          amount,
          percentage: data.percentage ? parseFloat(data.percentage) : null,
          description: data.description,
          due_date: data.due_date || null,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commissions"] });
      toast.success("Comissão registrada!");
      setDialogOpen(false);
      form.reset();
    },
    onError: (error) => {
      toast.error("Erro ao registrar comissão: " + error.message);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updates: Record<string, unknown> = { status };
      if (status === "paid") {
        updates.paid_date = format(new Date(), "yyyy-MM-dd");
      }

      const { error } = await supabase
        .from("professional_commissions")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commissions"] });
      toast.success("Status atualizado!");
    },
    onError: () => {
      toast.error("Erro ao atualizar status");
    },
  });

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  // Calculate summary by professional
  const summaryByProfessional = professionals?.map((prof) => {
    const profCommissions = commissions?.filter((c) => c.professional_id === prof.id) || [];
    const pending = profCommissions.filter((c) => c.status === "pending").reduce((sum, c) => sum + Number(c.amount), 0);
    const paid = profCommissions.filter((c) => c.status === "paid").reduce((sum, c) => sum + Number(c.amount), 0);
    return { ...prof, pending, paid, total: pending + paid };
  }).filter((p) => p.total > 0);

  const filteredCommissions = commissions?.filter((c) => {
    if (filter === "all") return true;
    return c.status === filter;
  });

  if (isLoading) {
    return <Skeleton className="h-96" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Acerto / Comissões</h3>
          <p className="text-sm text-muted-foreground">
            Gerencie comissões de profissionais
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Comissão
        </Button>
      </div>

      {/* Summary by Professional */}
      {summaryByProfessional && summaryByProfessional.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {summaryByProfessional.map((prof) => (
            <Card key={prof.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {prof.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-xs text-muted-foreground">Pendente</p>
                    <p className="text-lg font-bold text-amber-600">
                      {formatCurrency(prof.pending)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Pago</p>
                    <p className="text-lg font-bold text-emerald-600">
                      {formatCurrency(prof.paid)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Comissões
          </CardTitle>
          <div className="flex gap-1">
            <Button
              variant={filter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("all")}
            >
              Todas
            </Button>
            <Button
              variant={filter === "pending" ? "secondary" : "outline"}
              size="sm"
              onClick={() => setFilter("pending")}
            >
              Pendentes
            </Button>
            <Button
              variant={filter === "paid" ? "secondary" : "outline"}
              size="sm"
              onClick={() => setFilter("paid")}
            >
              Pagas
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {filteredCommissions && filteredCommissions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Profissional</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Percentual</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCommissions.map((commission) => (
                  <TableRow key={commission.id}>
                    <TableCell className="font-medium">
                      {(commission.professionals as any)?.name}
                    </TableCell>
                    <TableCell>{commission.description}</TableCell>
                    <TableCell>
                      {commission.percentage ? `${commission.percentage}%` : "-"}
                    </TableCell>
                    <TableCell>
                      {commission.due_date
                        ? format(parseISO(commission.due_date), "dd/MM/yyyy", { locale: ptBR })
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={statusColors[commission.status]}>
                        {statusLabels[commission.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(Number(commission.amount))}
                    </TableCell>
                    <TableCell>
                      {commission.status === "pending" && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => updateStatusMutation.mutate({ id: commission.id, status: "paid" })}
                            >
                              <Check className="h-4 w-4 mr-2" />
                              Marcar como pago
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => updateStatusMutation.mutate({ id: commission.id, status: "cancelled" })}
                            >
                              <X className="h-4 w-4 mr-2" />
                              Cancelar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              Nenhuma comissão encontrada
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Comissão</DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
              <FormField
                control={form.control}
                name="professional_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Profissional *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o profissional" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {professionals?.map((prof) => (
                          <SelectItem key={prof.id} value={prof.id}>
                            {prof.name}
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
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Comissão de consultas - Janeiro" {...field} />
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
                  name="percentage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Percentual (%)</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: 30" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

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
