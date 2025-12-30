import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MoreHorizontal, Search, Check, X, Trash2, Receipt } from "lucide-react";
import { FinancialExportButton } from "./FinancialExportButton";
import { exportTransactions, TransactionData } from "@/lib/financialExportUtils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { RealtimeIndicator } from "@/components/ui/realtime-indicator";
import { PaymentReceiptDialog } from "./PaymentReceiptDialog";


interface TransactionTableProps {
  clinicId: string;
  filterType?: "income" | "expense";
}

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  paid: "Pago",
  cancelled: "Cancelado",
  overdue: "Atrasado",
};

const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  paid: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  cancelled: "bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200",
  overdue: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const paymentMethodLabels: Record<string, string> = {
  cash: "Dinheiro",
  credit_card: "Cartão de Crédito",
  debit_card: "Cartão de Débito",
  pix: "PIX",
  bank_transfer: "Transferência",
  check: "Cheque",
  insurance: "Convênio",
};

export function TransactionTable({ clinicId, filterType }: TransactionTableProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);

  const { data: transactions, isLoading } = useQuery({
    queryKey: ["financial-transactions", clinicId, filterType],
    queryFn: async () => {
      let query = supabase
        .from("financial_transactions")
        .select(`
          *,
          financial_categories (name, color),
          patients (name),
          procedures (name, price)
        `)
        .eq("clinic_id", clinicId)
        .order("due_date", { ascending: false })
        .limit(100);

      if (filterType) {
        query = query.eq("type", filterType);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Realtime subscription for automatic updates
  useRealtimeSubscription({
    table: "financial_transactions",
    filter: { column: "clinic_id", value: clinicId },
    onInsert: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["financial-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["financial-monthly"] });
    },
    onUpdate: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["financial-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["financial-monthly"] });
    },
    onDelete: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["financial-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["financial-monthly"] });
    },
    enabled: !!clinicId,
    showToast: false, // Avoid duplicate toasts since table already shows updates
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: "paid" | "cancelled";
    }) => {
      const updates: Record<string, unknown> = { status };
      if (status === "paid") {
        updates.paid_date = format(new Date(), "yyyy-MM-dd");
      }

      const { error } = await supabase
        .from("financial_transactions")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["financial-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["financial-monthly"] });
      toast.success("Status atualizado com sucesso!");
    },
    onError: () => {
      toast.error("Erro ao atualizar status");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("financial_transactions")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["financial-metrics"] });
      toast.success("Transação excluída com sucesso!");
    },
    onError: () => {
      toast.error("Erro ao excluir transação");
    },
  });

  const filteredTransactions = transactions?.filter(
    (t) =>
      t.description.toLowerCase().includes(search.toLowerCase()) ||
      (t.patients as any)?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  const handleExport = (exportFormat: 'pdf' | 'excel') => {
    const exportData: TransactionData[] = (filteredTransactions || []).map(t => ({
      date: t.due_date ? format(new Date(t.due_date), "dd/MM/yyyy", { locale: ptBR }) : "-",
      description: t.description,
      category: (t.financial_categories as any)?.name || "-",
      patient: (t.patients as any)?.name || "-",
      paymentMethod: t.payment_method ? paymentMethodLabels[t.payment_method] : "-",
      amount: Number(t.amount),
      type: t.type as 'income' | 'expense',
      status: statusLabels[t.status || "pending"],
    }));
    
    const totalIncome = filteredTransactions?.filter(t => t.type === 'income').reduce((sum, t) => sum + Number(t.amount), 0) || 0;
    const totalExpense = filteredTransactions?.filter(t => t.type === 'expense').reduce((sum, t) => sum + Number(t.amount), 0) || 0;
    
    exportTransactions(
      "Clínica",
      "Período atual",
      exportData,
      { income: totalIncome, expense: totalExpense },
      exportFormat
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Transações</CardTitle>
        <div className="flex items-center gap-4">
          <FinancialExportButton
            onExportPDF={() => handleExport('pdf')}
            onExportExcel={() => handleExport('excel')}
            disabled={!filteredTransactions?.length}
          />
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredTransactions && filteredTransactions.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Procedimento</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Paciente</TableHead>
                <TableHead>Forma Pgto</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTransactions.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell>
                    {transaction.due_date
                      ? format(new Date(transaction.due_date), "dd/MM/yyyy", {
                          locale: ptBR,
                        })
                      : "-"}
                  </TableCell>
                  <TableCell className="font-medium">
                    {transaction.description}
                  </TableCell>
                  <TableCell>
                    {(transaction.procedures as any)?.name || "-"}
                  </TableCell>
                  <TableCell>
                    {(transaction.financial_categories as any)?.name || "-"}
                  </TableCell>
                  <TableCell>
                    {(transaction.patients as any)?.name || "-"}
                  </TableCell>
                  <TableCell>
                    {transaction.payment_method
                      ? paymentMethodLabels[transaction.payment_method]
                      : "-"}
                  </TableCell>
                  <TableCell
                    className={`text-right font-medium ${
                      transaction.type === "income"
                        ? "text-emerald-600"
                        : "text-red-600"
                    }`}
                  >
                    {transaction.type === "expense" ? "- " : "+ "}
                    {formatCurrency(Number(transaction.amount))}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={statusColors[transaction.status || "pending"]}
                    >
                      {statusLabels[transaction.status || "pending"]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {transaction.status === "pending" && (
                          <>
                            <DropdownMenuItem
                              onClick={() =>
                                updateStatusMutation.mutate({
                                  id: transaction.id,
                                  status: "paid",
                                })
                              }
                            >
                              <Check className="h-4 w-4 mr-2" />
                              Marcar como pago
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                updateStatusMutation.mutate({
                                  id: transaction.id,
                                  status: "cancelled",
                                })
                              }
                            >
                              <X className="h-4 w-4 mr-2" />
                              Cancelar
                            </DropdownMenuItem>
                          </>
                        )}
                        {transaction.type === "income" && transaction.status === "paid" && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedTransaction(transaction);
                                setReceiptDialogOpen(true);
                              }}
                            >
                              <Receipt className="h-4 w-4 mr-2" />
                              Emitir Recibo
                            </DropdownMenuItem>
                          </>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => deleteMutation.mutate(transaction.id)}
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
            Nenhuma transação encontrada
          </div>
        )}
      </CardContent>

      {/* Payment Receipt Dialog */}
      {selectedTransaction && (
        <PaymentReceiptDialog
          open={receiptDialogOpen}
          onOpenChange={(open) => {
            setReceiptDialogOpen(open);
            if (!open) setSelectedTransaction(null);
          }}
          transaction={selectedTransaction}
          clinicId={clinicId}
        />
      )}

    </Card>
  );
}
