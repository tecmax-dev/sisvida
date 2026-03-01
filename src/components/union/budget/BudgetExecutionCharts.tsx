import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BudgetRevenue, BudgetExpense, monthNames } from "@/types/unionBudget";
import { BarChart3, TrendingUp } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ComposedChart,
  Line,
  Area,
} from "recharts";

interface BudgetExecutionChartsProps {
  revenues: BudgetRevenue[];
  expenses: BudgetExpense[];
  realizedByMonth: Record<number, { revenue: number; expense: number }>;
}

const getMonthValue = (item: BudgetRevenue | BudgetExpense, month: number): number => {
  const key = `month_${month.toString().padStart(2, "0")}` as keyof typeof item;
  return (item[key] as number) || 0;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const formatCompact = (value: number) => {
  if (Math.abs(value) >= 1000000) return `R$ ${(value / 1000000).toFixed(1)}M`;
  if (Math.abs(value) >= 1000) return `R$ ${(value / 1000).toFixed(1)}K`;
  return formatCurrency(value);
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="bg-background border rounded-lg shadow-lg p-3">
        <p className="font-medium mb-1">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {formatCurrency(entry.value)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export function BudgetExecutionCharts({
  revenues,
  expenses,
  realizedByMonth,
}: BudgetExecutionChartsProps) {
  const chartData = useMemo(() => {
    let accBudget = 0;
    let accRealized = 0;
    return Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const budRev = revenues.reduce((s, r) => s + getMonthValue(r, month), 0);
      const budExp = expenses.reduce((s, e) => s + getMonthValue(e, month), 0);
      const realRev = realizedByMonth[month]?.revenue || 0;
      const realExp = realizedByMonth[month]?.expense || 0;
      const budgetResult = budRev - budExp;
      const realizedResult = realRev - realExp;
      accBudget += budgetResult;
      accRealized += realizedResult;
      return {
        month: monthNames[i].substring(0, 3),
        receitaPrev: budRev,
        receitaReal: realRev,
        despesaPrev: budExp,
        despesaReal: realExp,
        resultadoPrev: budgetResult,
        resultadoReal: realizedResult,
        acumPrev: accBudget,
        acumReal: accRealized,
      };
    });
  }, [revenues, expenses, realizedByMonth]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Revenue: Budget vs Realized */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Receitas: Previsto vs Realizado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={formatCompact} tick={{ fontSize: 10 }} width={65} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="receitaPrev" name="Previsto" fill="#86efac" radius={[3, 3, 0, 0]} />
                <Bar dataKey="receitaReal" name="Realizado" fill="#16a34a" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Expense: Budget vs Realized */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Despesas: Previsto vs Realizado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={formatCompact} tick={{ fontSize: 10 }} width={65} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="despesaPrev" name="Previsto" fill="#fca5a5" radius={[3, 3, 0, 0]} />
                <Bar dataKey="despesaReal" name="Realizado" fill="#dc2626" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Cumulative Result */}
      <Card className="lg:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Resultado Acumulado: Previsto vs Realizado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={formatCompact} tick={{ fontSize: 10 }} width={65} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Area type="monotone" dataKey="acumPrev" name="Previsto Acumulado" fill="#dbeafe" stroke="#3b82f6" strokeWidth={2} />
                <Line type="monotone" dataKey="acumReal" name="Realizado Acumulado" stroke="#16a34a" strokeWidth={3} dot={{ fill: "#16a34a", strokeWidth: 2 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
