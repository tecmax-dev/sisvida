import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUnionPermissions } from "@/hooks/useUnionPermissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { UnionTransactionDialog } from "@/components/union/financials/UnionTransactionDialog";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Plus,
  Search,
  TrendingDown,
  MoreHorizontal,
  Edit,
  Trash2,
  DollarSign,
  Clock,
  CheckCircle,
} from "lucide-react";

export default function UnionExpensesPage() {
  const { currentClinic } = useAuth();
  const { canManageExpenses } = useUnionPermissions();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<any>(null);

  const clinicId = currentClinic?.id;

  const { data: transactions, isLoading } = useQuery({
    queryKey: ["union-financial-transactions", clinicId, "expense"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("union_financial_transactions")
        .select(`
          *,
          category:union_financial_categories(id, name, color),
          supplier:union_suppliers(id, name),
          cash_register:union_cash_registers(id, name)
        `)
        .eq("clinic_id", clinicId!)
        .eq("type", "expense")
        .order("due_date", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data;
    },
    enabled: !!clinicId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("union_financial_transactions")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["union-financial-transactions"] });
      toast.success("Despesa excluída!");
    },
    onError: () => {
      toast.error("Erro ao excluir despesa");
    },
  });

  const handleEdit = (transaction: any) => {
    setEditingTransaction(transaction);
    setDialogOpen(true);
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  const filteredTransactions = transactions?.filter(
    (t) =>
      t.description.toLowerCase().includes(search.toLowerCase()) ||
      t.supplier?.name?.toLowerCase().includes(search.toLowerCase()) ||
      t.category?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const totalExpenses = transactions?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;
  const pendingExpenses = transactions?.filter((t) => t.status === "pending").reduce((sum, t) => sum + Number(t.amount), 0) || 0;
  const paidExpenses = transactions?.filter((t) => t.status === "paid").reduce((sum, t) => sum + Number(t.amount), 0) || 0;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge className="bg-emerald-100 text-emerald-800">Pago</Badge>;
      case "pending":
        return <Badge className="bg-amber-100 text-amber-800">Pendente</Badge>;
      case "cancelled":
        return <Badge className="bg-slate-100 text-slate-800">Cancelado</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (!clinicId) return null;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Despesas</h1>
        <p className="text-muted-foreground">
          Gerencie as despesas do módulo sindical
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-rose-500" />
              Total de Despesas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-rose-600">{formatCurrency(totalExpenses)}</p>
            <p className="text-xs text-muted-foreground">{transactions?.length || 0} lançamento(s)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-600">{formatCurrency(pendingExpenses)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
              Pagas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-600">{formatCurrency(paidExpenses)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por descrição, fornecedor ou categoria..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {canManageExpenses() && (
          <Button
            onClick={() => {
              setEditingTransaction(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Nova Despesa
          </Button>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <ScrollArea className="max-h-[500px]">
            {filteredTransactions && filteredTransactions.length > 0 ? (
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <TrendingDown className="h-4 w-4 text-rose-500" />
                          <span className="font-medium">{transaction.description}</span>
                        </div>
                      </TableCell>
                      <TableCell>{transaction.supplier?.name || "-"}</TableCell>
                      <TableCell>
                        {transaction.category ? (
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: transaction.category.color || "#6b7280" }}
                            />
                            <span>{transaction.category.name}</span>
                          </div>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        {transaction.due_date
                          ? format(parseISO(transaction.due_date), "dd/MM/yyyy", { locale: ptBR })
                          : "-"}
                      </TableCell>
                      <TableCell className="font-semibold text-rose-600">
                        {formatCurrency(Number(transaction.amount))}
                      </TableCell>
                      <TableCell>{getStatusBadge(transaction.status)}</TableCell>
                      <TableCell>
                        {canManageExpenses() && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEdit(transaction)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => deleteMutation.mutate(transaction.id)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Excluir
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
                <TrendingDown className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma despesa encontrada</p>
                <p className="text-sm">Clique em "Nova Despesa" para começar.</p>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      <UnionTransactionDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingTransaction(null);
        }}
        transaction={editingTransaction}
        clinicId={clinicId}
        defaultType="expense"
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["union-financial-transactions"] });
        }}
      />
    </div>
  );
}
