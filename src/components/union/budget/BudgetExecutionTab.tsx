import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BudgetExercise, BudgetRevenue, BudgetExpense, monthNames } from "@/types/unionBudget";
import { TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface BudgetExecutionTabProps {
  execution: any[];
  exercise: BudgetExercise;
  revenues: BudgetRevenue[];
  expenses: BudgetExpense[];
  clinicId?: string;
  versionId?: string;
}

const getMonthValue = (item: BudgetRevenue | BudgetExpense, month: number): number => {
  const key = `month_${month.toString().padStart(2, '0')}` as keyof typeof item;
  return (item[key] as number) || 0;
};

export function BudgetExecutionTab({
  execution,
  exercise,
  revenues,
  expenses,
  clinicId,
  versionId,
}: BudgetExecutionTabProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  // Fetch realized transactions from union_financial_transactions for the exercise period
  const { data: realizedData, isLoading: loadingRealized } = useQuery({
    queryKey: ["budget-execution-realized", clinicId, exercise.start_date, exercise.end_date],
    queryFn: async () => {
      if (!clinicId) return { revenues: [] as any[], expenses: [] as any[] };

      const PAGE_SIZE = 1000;

      const fetchAll = async (type: string) => {
        let allData: any[] = [];
        let from = 0;
        let hasMore = true;

        while (hasMore) {
          const { data, error } = await supabase
            .from("union_financial_transactions")
            .select("amount, paid_date, category_id, type")
            .eq("clinic_id", clinicId)
            .eq("type", type)
            .eq("status", "paid")
            .gte("paid_date", exercise.start_date)
            .lte("paid_date", exercise.end_date)
            .not("paid_date", "is", null)
            .range(from, from + PAGE_SIZE - 1);

          if (error) throw error;
          allData = allData.concat(data || []);
          hasMore = (data?.length || 0) === PAGE_SIZE;
          from += PAGE_SIZE;
        }
        return allData;
      };

      const [revTx, expTx] = await Promise.all([
        fetchAll("revenue"),
        fetchAll("expense"),
      ]);

      return { revenues: revTx, expenses: expTx };
    },
    enabled: !!clinicId && !!exercise,
  });

  // Build monthly realized totals from actual transactions
  const getMonthFromDate = (dateStr: string): number => {
    const date = new Date(dateStr + "T12:00:00");
    return date.getMonth() + 1; // 1-12
  };

  const realizedByMonth = (() => {
    const map: Record<number, { revenue: number; expense: number }> = {};
    for (let m = 1; m <= 12; m++) {
      map[m] = { revenue: 0, expense: 0 };
    }

    if (realizedData?.revenues) {
      for (const tx of realizedData.revenues) {
        if (tx.paid_date) {
          const month = getMonthFromDate(tx.paid_date);
          if (month >= 1 && month <= 12) {
            map[month].revenue += Number(tx.amount) || 0;
          }
        }
      }
    }

    if (realizedData?.expenses) {
      for (const tx of realizedData.expenses) {
        if (tx.paid_date) {
          const month = getMonthFromDate(tx.paid_date);
          if (month >= 1 && month <= 12) {
            map[month].expense += Number(tx.amount) || 0;
          }
        }
      }
    }

    return map;
  })();

  // Calculate execution summary by month
  const monthlyExecution = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;

    const budgetedRevenue = revenues.reduce((sum, r) => sum + getMonthValue(r, month), 0);
    const budgetedExpense = expenses.reduce((sum, e) => sum + getMonthValue(e, month), 0);

    const realizedRevenue = realizedByMonth[month]?.revenue || 0;
    const realizedExpense = realizedByMonth[month]?.expense || 0;

    return {
      month,
      monthName: monthNames[i],
      budgetedRevenue,
      realizedRevenue,
      budgetedExpense,
      realizedExpense,
    };
  });

  const totalBudgetedRevenue = revenues.reduce((sum, r) => sum + (r.total_amount || 0), 0);
  const totalBudgetedExpense = expenses.reduce((sum, e) => sum + (e.total_amount || 0), 0);
  const totalRealizedRevenue = Object.values(realizedByMonth).reduce((s, m) => s + m.revenue, 0);
  const totalRealizedExpense = Object.values(realizedByMonth).reduce((s, m) => s + m.expense, 0);

  const revenuePercent = totalBudgetedRevenue > 0 ? Math.min((totalRealizedRevenue / totalBudgetedRevenue) * 100, 100) : 0;
  const expensePercent = totalBudgetedExpense > 0 ? Math.min((totalRealizedExpense / totalBudgetedExpense) * 100, 100) : 0;

  const getStatus = (data: { budgetedRevenue: number; budgetedExpense: number; realizedRevenue: number; realizedExpense: number }) => {
    const hasBudget = data.budgetedRevenue > 0 || data.budgetedExpense > 0;
    const hasRealized = data.realizedRevenue > 0 || data.realizedExpense > 0;

    if (!hasBudget && !hasRealized) return null;
    if (!hasRealized) return { label: "Pendente", variant: "outline" as const, className: "text-muted-foreground" };

    const totalBudgeted = data.budgetedRevenue + data.budgetedExpense;
    const totalRealized = data.realizedRevenue + data.realizedExpense;

    if (totalBudgeted === 0) return { label: "Realizado", variant: "default" as const, className: "bg-blue-100 text-blue-700" };

    const pct = (totalRealized / totalBudgeted) * 100;
    if (pct >= 90) return { label: "Executado", variant: "default" as const, className: "bg-green-100 text-green-700" };
    if (pct >= 50) return { label: "Em andamento", variant: "default" as const, className: "bg-yellow-100 text-yellow-700" };
    return { label: "Parcial", variant: "default" as const, className: "bg-orange-100 text-orange-700" };
  };

  if (loadingRealized) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Execution Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              Execução de Receitas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Previsto</span>
                <span className="font-medium">{formatCurrency(totalBudgetedRevenue)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Realizado</span>
                <span className="font-medium text-green-600">{formatCurrency(totalRealizedRevenue)}</span>
              </div>
              <Progress value={revenuePercent} className="h-2" />
              <p className="text-xs text-muted-foreground text-right">{revenuePercent.toFixed(1)}% executado</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-600" />
              Execução de Despesas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Previsto</span>
                <span className="font-medium">{formatCurrency(totalBudgetedExpense)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Realizado</span>
                <span className="font-medium text-red-600">{formatCurrency(totalRealizedExpense)}</span>
              </div>
              <Progress value={expensePercent} className="h-2" />
              <p className="text-xs text-muted-foreground text-right">{expensePercent.toFixed(1)}% executado</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Result Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Resultado Previsto</span>
              <span className={`text-lg font-bold ${(totalBudgetedRevenue - totalBudgetedExpense) >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                {formatCurrency(totalBudgetedRevenue - totalBudgetedExpense)}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Resultado Realizado</span>
              <span className={`text-lg font-bold ${(totalRealizedRevenue - totalRealizedExpense) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(totalRealizedRevenue - totalRealizedExpense)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Execution Table */}
      <Card>
        <CardHeader>
          <CardTitle>Acompanhamento Mensal</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead className="text-right">Receita Prev.</TableHead>
                <TableHead className="text-right">Receita Real.</TableHead>
                <TableHead className="text-right">Despesa Prev.</TableHead>
                <TableHead className="text-right">Despesa Real.</TableHead>
                <TableHead className="text-right">Resultado</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthlyExecution.map((data) => {
                const result = data.realizedRevenue - data.realizedExpense;
                const status = getStatus(data);
                return (
                  <TableRow key={data.month}>
                    <TableCell className="font-medium">{data.monthName}</TableCell>
                    <TableCell className="text-right">{formatCurrency(data.budgetedRevenue)}</TableCell>
                    <TableCell className="text-right text-green-600">{formatCurrency(data.realizedRevenue)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(data.budgetedExpense)}</TableCell>
                    <TableCell className="text-right text-red-600">{formatCurrency(data.realizedExpense)}</TableCell>
                    <TableCell className={`text-right font-medium ${result >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {(data.realizedRevenue > 0 || data.realizedExpense > 0) ? formatCurrency(result) : '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      {status ? (
                        <Badge variant={status.variant} className={status.className}>
                          {status.label}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {/* Total row */}
              <TableRow className="font-bold border-t-2">
                <TableCell>Total</TableCell>
                <TableCell className="text-right">{formatCurrency(totalBudgetedRevenue)}</TableCell>
                <TableCell className="text-right text-green-600">{formatCurrency(totalRealizedRevenue)}</TableCell>
                <TableCell className="text-right">{formatCurrency(totalBudgetedExpense)}</TableCell>
                <TableCell className="text-right text-red-600">{formatCurrency(totalRealizedExpense)}</TableCell>
                <TableCell className={`text-right ${(totalRealizedRevenue - totalRealizedExpense) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(totalRealizedRevenue - totalRealizedExpense)}
                </TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
