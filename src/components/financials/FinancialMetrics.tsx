import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format, startOfMonth, endOfMonth } from "date-fns";

interface FinancialMetricsProps {
  clinicId: string;
}

export function FinancialMetrics({ clinicId }: FinancialMetricsProps) {
  const startDate = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const endDate = format(endOfMonth(new Date()), "yyyy-MM-dd");

  const { data: metrics, isLoading } = useQuery({
    queryKey: ["financial-metrics", clinicId, startDate, endDate],
    queryFn: async () => {
      const { data: transactions, error } = await supabase
        .from("financial_transactions")
        .select("type, amount, status")
        .eq("clinic_id", clinicId)
        .gte("due_date", startDate)
        .lte("due_date", endDate);

      if (error) throw error;

      const totalIncome = transactions
        ?.filter((t) => t.type === "income" && t.status === "paid")
        .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

      const totalExpense = transactions
        ?.filter((t) => t.type === "expense" && t.status === "paid")
        .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

      const pendingIncome = transactions
        ?.filter((t) => t.type === "income" && t.status === "pending")
        .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

      const overdueAmount = transactions
        ?.filter((t) => t.status === "overdue")
        .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

      return {
        totalIncome,
        totalExpense,
        balance: totalIncome - totalExpense,
        pendingIncome,
        overdueAmount,
      };
    },
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Receitas (Mês)</CardTitle>
          <TrendingUp className="h-4 w-4 text-emerald-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-emerald-600">
            {formatCurrency(metrics?.totalIncome || 0)}
          </div>
          <p className="text-xs text-muted-foreground">
            +{formatCurrency(metrics?.pendingIncome || 0)} a receber
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Despesas (Mês)</CardTitle>
          <TrendingDown className="h-4 w-4 text-red-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">
            {formatCurrency(metrics?.totalExpense || 0)}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Saldo (Mês)</CardTitle>
          <DollarSign className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div
            className={`text-2xl font-bold ${
              (metrics?.balance || 0) >= 0 ? "text-emerald-600" : "text-red-600"
            }`}
          >
            {formatCurrency(metrics?.balance || 0)}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Em Atraso</CardTitle>
          <AlertCircle className="h-4 w-4 text-amber-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-amber-600">
            {formatCurrency(metrics?.overdueAmount || 0)}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
