import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BudgetRevenue, BudgetExpense, monthNames, BudgetSummary } from "@/types/unionBudget";
import { TrendingUp, TrendingDown, Target } from "lucide-react";

interface BudgetConsolidationTabProps {
  revenues: BudgetRevenue[];
  expenses: BudgetExpense[];
  summary: BudgetSummary;
}

// Helper to get monthly value from revenue/expense
const getMonthValue = (item: BudgetRevenue | BudgetExpense, month: number): number => {
  const key = `month_${month.toString().padStart(2, '0')}` as keyof typeof item;
  return (item[key] as number) || 0;
};

export function BudgetConsolidationTab({
  revenues,
  expenses,
  summary,
}: BudgetConsolidationTabProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  // Group by month
  const monthlyData = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const totalRevenue = revenues.reduce((sum, r) => sum + getMonthValue(r, month), 0);
    const totalExpense = expenses.reduce((sum, e) => sum + getMonthValue(e, month), 0);
    
    return {
      month,
      monthName: monthNames[i],
      revenues: totalRevenue,
      expenses: totalExpense,
      balance: totalRevenue - totalExpense,
    };
  });

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-100 text-green-600">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Receitas</p>
                <p className="text-xl font-bold text-green-600">
                  {formatCurrency(summary.totalRevenuesBudgeted)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-red-100 text-red-600">
                <TrendingDown className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Despesas</p>
                <p className="text-xl font-bold text-red-600">
                  {formatCurrency(summary.totalExpensesBudgeted)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg ${summary.projectedResult >= 0 ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'}`}>
                <Target className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Resultado</p>
                <p className={`text-xl font-bold ${summary.projectedResult >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                  {formatCurrency(summary.projectedResult)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Demonstrativo Mensal</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead className="text-right">Receitas</TableHead>
                <TableHead className="text-right">Despesas</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthlyData.map((data) => (
                <TableRow key={data.month}>
                  <TableCell className="font-medium">{data.monthName}</TableCell>
                  <TableCell className="text-right text-green-600">
                    {formatCurrency(data.revenues)}
                  </TableCell>
                  <TableCell className="text-right text-red-600">
                    {formatCurrency(data.expenses)}
                  </TableCell>
                  <TableCell className={`text-right font-medium ${data.balance >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                    {formatCurrency(data.balance)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="font-bold bg-muted/50">
                <TableCell>TOTAL</TableCell>
                <TableCell className="text-right text-green-600">
                  {formatCurrency(summary.totalRevenuesBudgeted)}
                </TableCell>
                <TableCell className="text-right text-red-600">
                  {formatCurrency(summary.totalExpensesBudgeted)}
                </TableCell>
                <TableCell className={`text-right ${summary.projectedResult >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                  {formatCurrency(summary.projectedResult)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
