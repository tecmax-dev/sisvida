import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BudgetExercise, BudgetRevenue, BudgetExpense, monthNames } from "@/types/unionBudget";
import { TrendingUp, TrendingDown } from "lucide-react";

interface BudgetExecutionTabProps {
  execution: any[];
  exercise: BudgetExercise;
  revenues: BudgetRevenue[];
  expenses: BudgetExpense[];
  clinicId?: string;
  versionId?: string;
}

// Helper to get monthly value from revenue/expense
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

  // Calculate execution summary by month
  const monthlyExecution = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    
    const budgetedRevenue = revenues.reduce((sum, r) => sum + getMonthValue(r, month), 0);
    const budgetedExpense = expenses.reduce((sum, e) => sum + getMonthValue(e, month), 0);
    
    // For now, we'll show 0 as realized since we need to integrate with actual transactions
    const realizedRevenue = 0;
    const realizedExpense = 0;
    
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
                <span className="font-medium">{formatCurrency(0)}</span>
              </div>
              <Progress value={0} className="h-2" />
              <p className="text-xs text-muted-foreground text-right">0% executado</p>
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
                <span className="font-medium">{formatCurrency(0)}</span>
              </div>
              <Progress value={0} className="h-2" />
              <p className="text-xs text-muted-foreground text-right">0% executado</p>
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
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthlyExecution.map((data) => (
                <TableRow key={data.month}>
                  <TableCell className="font-medium">{data.monthName}</TableCell>
                  <TableCell className="text-right">{formatCurrency(data.budgetedRevenue)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(data.realizedRevenue)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(data.budgetedExpense)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(data.realizedExpense)}</TableCell>
                  <TableCell className="text-center">
                    {data.budgetedRevenue > 0 || data.budgetedExpense > 0 ? (
                      <Badge variant="outline" className="text-muted-foreground">
                        Pendente
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
