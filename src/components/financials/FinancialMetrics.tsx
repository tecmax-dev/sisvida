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

      const overdueTransactions = transactions?.filter((t) => t.status === "overdue") || [];
      const overdueAmount = overdueTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
      const overdueCount = overdueTransactions.length;

      return {
        totalIncome,
        totalExpense,
        balance: totalIncome - totalExpense,
        pendingIncome,
        overdueAmount,
        overdueCount,
      };
    },
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="border-l-4 border-l-muted">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-10 rounded-lg" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-32 mb-1" />
              <Skeleton className="h-3 w-24" />
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

  const metricsConfig = [
    {
      title: "Receitas (Mês)",
      value: metrics?.totalIncome || 0,
      subtext: `+${formatCurrency(metrics?.pendingIncome || 0)} a receber`,
      icon: TrendingUp,
      borderColor: "border-l-emerald-500",
      bgGradient: "bg-gradient-to-r from-emerald-50/80 to-transparent dark:from-emerald-950/30",
      iconBg: "bg-emerald-100 dark:bg-emerald-900/50",
      iconColor: "text-emerald-600 dark:text-emerald-400",
      valueColor: "text-emerald-600 dark:text-emerald-400",
      titleColor: "text-emerald-700 dark:text-emerald-300",
    },
    {
      title: "Despesas (Mês)",
      value: metrics?.totalExpense || 0,
      subtext: "Total pago no período",
      icon: TrendingDown,
      borderColor: "border-l-rose-500",
      bgGradient: "bg-gradient-to-r from-rose-50/80 to-transparent dark:from-rose-950/30",
      iconBg: "bg-rose-100 dark:bg-rose-900/50",
      iconColor: "text-rose-600 dark:text-rose-400",
      valueColor: "text-rose-600 dark:text-rose-400",
      titleColor: "text-rose-700 dark:text-rose-300",
    },
    {
      title: "Saldo (Mês)",
      value: metrics?.balance || 0,
      subtext: (metrics?.balance || 0) >= 0 ? "Resultado positivo" : "Resultado negativo",
      icon: DollarSign,
      borderColor: "border-l-blue-500",
      bgGradient: "bg-gradient-to-r from-blue-50/80 to-transparent dark:from-blue-950/30",
      iconBg: "bg-blue-100 dark:bg-blue-900/50",
      iconColor: "text-blue-600 dark:text-blue-400",
      valueColor: (metrics?.balance || 0) >= 0 
        ? "text-emerald-600 dark:text-emerald-400" 
        : "text-rose-600 dark:text-rose-400",
      titleColor: "text-blue-700 dark:text-blue-300",
    },
    {
      title: "Em Atraso",
      value: metrics?.overdueAmount || 0,
      subtext: `${metrics?.overdueCount || 0} título(s) pendente(s)`,
      icon: AlertCircle,
      borderColor: "border-l-amber-500",
      bgGradient: "bg-gradient-to-r from-amber-50/80 to-transparent dark:from-amber-950/30",
      iconBg: "bg-amber-100 dark:bg-amber-900/50",
      iconColor: "text-amber-600 dark:text-amber-400",
      valueColor: "text-amber-600 dark:text-amber-400",
      titleColor: "text-amber-700 dark:text-amber-300",
    },
  ];

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      {metricsConfig.map((metric, index) => {
        const Icon = metric.icon;
        return (
          <Card 
            key={index} 
            className={`border-l-4 ${metric.borderColor} ${metric.bgGradient} transition-all hover:shadow-md`}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className={`text-sm font-medium ${metric.titleColor}`}>
                {metric.title}
              </CardTitle>
              <div className={`p-2.5 rounded-lg ${metric.iconBg}`}>
                <Icon className={`h-5 w-5 ${metric.iconColor}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${metric.valueColor}`}>
                {formatCurrency(metric.value)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {metric.subtext}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
