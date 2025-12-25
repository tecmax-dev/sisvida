import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { CheckCircle2, Circle, ChevronLeft, ChevronRight, FileCheck } from "lucide-react";

interface ReconciliationPanelProps {
  clinicId: string;
}

export function ReconciliationPanel({ clinicId }: ReconciliationPanelProps) {
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const startDate = startOfMonth(currentDate);
  const endDate = endOfMonth(currentDate);

  const { data: transactions, isLoading } = useQuery({
    queryKey: ["reconciliation", clinicId, format(startDate, "yyyy-MM")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_transactions")
        .select(`
          *,
          financial_categories (name),
          patients (name)
        `)
        .eq("clinic_id", clinicId)
        .eq("status", "paid")
        .gte("paid_date", format(startDate, "yyyy-MM-dd"))
        .lte("paid_date", format(endDate, "yyyy-MM-dd"))
        .order("paid_date");

      if (error) throw error;
      return data;
    },
  });

  const reconcileMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from("financial_transactions")
        .update({
          is_reconciled: true,
          reconciled_at: new Date().toISOString(),
        })
        .in("id", ids);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reconciliation"] });
      setSelectedIds([]);
      toast.success("Transações conciliadas!");
    },
    onError: () => {
      toast.error("Erro ao conciliar transações");
    },
  });

  const unreconcileMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("financial_transactions")
        .update({
          is_reconciled: false,
          reconciled_at: null,
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reconciliation"] });
      toast.success("Conciliação removida!");
    },
    onError: () => {
      toast.error("Erro ao remover conciliação");
    },
  });

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    const unreconciled = transactions?.filter((t) => !t.is_reconciled) || [];
    if (selectedIds.length === unreconciled.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(unreconciled.map((t) => t.id));
    }
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  // Summary
  const totalReconciled = transactions?.filter((t) => t.is_reconciled).length || 0;
  const totalPending = transactions?.filter((t) => !t.is_reconciled).length || 0;
  const incomeReconciled = transactions
    ?.filter((t) => t.is_reconciled && t.type === "income")
    .reduce((sum, t) => sum + Number(t.amount), 0) || 0;
  const expenseReconciled = transactions
    ?.filter((t) => t.is_reconciled && t.type === "expense")
    .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

  if (isLoading) {
    return <Skeleton className="h-96" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Conciliação Bancária</h3>
          <p className="text-sm text-muted-foreground">
            Concilie transações com seu extrato bancário
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-medium min-w-[150px] text-center">
            {format(currentDate, "MMMM yyyy", { locale: ptBR })}
          </span>
          <Button variant="outline" size="icon" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              Conciliados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-600">{totalReconciled}</p>
            <p className="text-xs text-muted-foreground">transações</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Circle className="h-4 w-4 text-amber-500" />
              Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-600">{totalPending}</p>
            <p className="text-xs text-muted-foreground">transações</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Entradas Conciliadas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-600">
              {formatCurrency(incomeReconciled)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Saídas Conciliadas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">
              {formatCurrency(expenseReconciled)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      {selectedIds.length > 0 && (
        <Card className="border-primary">
          <CardContent className="py-3 flex items-center justify-between">
            <span className="text-sm">
              <strong>{selectedIds.length}</strong> transação(ões) selecionada(s)
            </span>
            <Button
              onClick={() => reconcileMutation.mutate(selectedIds)}
              disabled={reconcileMutation.isPending}
            >
              <FileCheck className="h-4 w-4 mr-2" />
              {reconcileMutation.isPending ? "Conciliando..." : "Conciliar Selecionados"}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Transações do Período</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions && transactions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={
                        selectedIds.length > 0 &&
                        selectedIds.length === transactions.filter((t) => !t.is_reconciled).length
                      }
                      onCheckedChange={selectAll}
                    />
                  </TableHead>
                  <TableHead>Data Pgto</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((transaction) => (
                  <TableRow
                    key={transaction.id}
                    className={transaction.is_reconciled ? "bg-emerald-50 dark:bg-emerald-900/10" : ""}
                  >
                    <TableCell>
                      {!transaction.is_reconciled ? (
                        <Checkbox
                          checked={selectedIds.includes(transaction.id)}
                          onCheckedChange={() => toggleSelect(transaction.id)}
                        />
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => unreconcileMutation.mutate(transaction.id)}
                          title="Remover conciliação"
                        >
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        </Button>
                      )}
                    </TableCell>
                    <TableCell>
                      {transaction.paid_date
                        ? format(parseISO(transaction.paid_date), "dd/MM/yyyy", { locale: ptBR })
                        : "-"}
                    </TableCell>
                    <TableCell className="font-medium">
                      {transaction.description}
                    </TableCell>
                    <TableCell>
                      {(transaction.financial_categories as any)?.name || "-"}
                    </TableCell>
                    <TableCell>
                      {transaction.is_reconciled ? (
                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                          Conciliado
                        </Badge>
                      ) : (
                        <Badge variant="outline">Pendente</Badge>
                      )}
                    </TableCell>
                    <TableCell
                      className={`text-right font-medium ${
                        transaction.type === "income" ? "text-emerald-600" : "text-red-600"
                      }`}
                    >
                      {transaction.type === "expense" ? "- " : "+ "}
                      {formatCurrency(Number(transaction.amount))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              Nenhuma transação paga neste período
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
