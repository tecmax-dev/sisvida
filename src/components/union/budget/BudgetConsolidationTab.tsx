import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { BudgetRevenue, BudgetExpense, monthNames, BudgetSummary, revenueTypeLabels, expenseTypeLabels, expenseNatureLabels, RevenueType, ExpenseType, ExpenseNature } from "@/types/unionBudget";
import { 
  TrendingUp, TrendingDown, Target, Wallet, PiggyBank, 
  BarChart3, PieChart, Users, ArrowUpRight, ArrowDownRight,
  Percent, Calculator, FileBarChart, DollarSign, AlertTriangle
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  ComposedChart,
  Area
} from "recharts";

interface BudgetConsolidationTabProps {
  revenues: BudgetRevenue[];
  expenses: BudgetExpense[];
  summary: BudgetSummary;
  projectedMemberCount?: number;
  baseMemberCount?: number;
}

// Helper to get monthly value from revenue/expense
const getMonthValue = (item: BudgetRevenue | BudgetExpense, month: number): number => {
  const key = `month_${month.toString().padStart(2, '0')}` as keyof typeof item;
  return (item[key] as number) || 0;
};

const CHART_COLORS = [
  "#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444", 
  "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#6366f1"
];

export function BudgetConsolidationTab({
  revenues,
  expenses,
  summary,
  projectedMemberCount,
  baseMemberCount,
}: BudgetConsolidationTabProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatCurrencyCompact = (value: number) => {
    if (Math.abs(value) >= 1000000) {
      return `R$ ${(value / 1000000).toFixed(1)}M`;
    }
    if (Math.abs(value) >= 1000) {
      return `R$ ${(value / 1000).toFixed(1)}K`;
    }
    return formatCurrency(value);
  };

  // Monthly data with cumulative balance
  const monthlyData = useMemo(() => {
    let cumulativeBalance = 0;
    return Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const totalRevenue = revenues.reduce((sum, r) => sum + getMonthValue(r, month), 0);
      const totalExpense = expenses.reduce((sum, e) => sum + getMonthValue(e, month), 0);
      const balance = totalRevenue - totalExpense;
      cumulativeBalance += balance;
      
      return {
        month,
        monthName: monthNames[i],
        monthShort: monthNames[i].substring(0, 3),
        revenues: totalRevenue,
        expenses: totalExpense,
        balance,
        cumulativeBalance,
      };
    });
  }, [revenues, expenses]);

  // Revenue breakdown by type
  const revenueByType = useMemo(() => {
    const grouped: Record<RevenueType, number> = {} as Record<RevenueType, number>;
    revenues.forEach(r => {
      const type = r.revenue_type || 'other';
      grouped[type] = (grouped[type] || 0) + (r.total_amount || 0);
    });
    return Object.entries(grouped)
      .map(([type, value], index) => ({
        type: type as RevenueType,
        name: revenueTypeLabels[type as RevenueType] || type,
        value,
        color: CHART_COLORS[index % CHART_COLORS.length],
      }))
      .sort((a, b) => b.value - a.value);
  }, [revenues]);

  // Expense breakdown by type
  const expenseByType = useMemo(() => {
    const grouped: Record<ExpenseType, number> = {} as Record<ExpenseType, number>;
    expenses.forEach(e => {
      const type = e.expense_type || 'other';
      grouped[type] = (grouped[type] || 0) + (e.total_amount || 0);
    });
    return Object.entries(grouped)
      .map(([type, value], index) => ({
        type: type as ExpenseType,
        name: expenseTypeLabels[type as ExpenseType] || type,
        value,
        color: CHART_COLORS[index % CHART_COLORS.length],
      }))
      .sort((a, b) => b.value - a.value);
  }, [expenses]);

  // Expense breakdown by nature
  const expenseByNature = useMemo(() => {
    const grouped: Record<string, number> = {};
    expenses.forEach(e => {
      const nature = e.expense_nature || 'other';
      grouped[nature] = (grouped[nature] || 0) + (e.total_amount || 0);
    });
    return Object.entries(grouped).map(([nature, value], index) => ({
      nature,
      name: expenseNatureLabels[nature as ExpenseNature] || 'Outros',
      value,
      color: nature === 'essential' ? '#ef4444' : nature === 'strategic' ? '#f59e0b' : '#10b981',
    }));
  }, [expenses]);

  // Quarterly summary
  const quarterlyData = useMemo(() => {
    return [
      { quarter: '1º Trim', months: [1, 2, 3] },
      { quarter: '2º Trim', months: [4, 5, 6] },
      { quarter: '3º Trim', months: [7, 8, 9] },
      { quarter: '4º Trim', months: [10, 11, 12] },
    ].map(q => {
      const rev = q.months.reduce((sum, m) => sum + (monthlyData[m - 1]?.revenues || 0), 0);
      const exp = q.months.reduce((sum, m) => sum + (monthlyData[m - 1]?.expenses || 0), 0);
      return {
        ...q,
        revenues: rev,
        expenses: exp,
        balance: rev - exp,
      };
    });
  }, [monthlyData]);

  // Key indicators
  const indicators = useMemo(() => {
    const totalRevenue = summary.totalRevenuesBudgeted;
    const totalExpense = summary.totalExpensesBudgeted;
    const result = summary.projectedResult;
    
    // Per member metrics
    const perMemberRevenue = projectedMemberCount ? totalRevenue / projectedMemberCount : 0;
    const perMemberExpense = projectedMemberCount ? totalExpense / projectedMemberCount : 0;
    
    // Monthly averages
    const avgMonthlyRevenue = totalRevenue / 12;
    const avgMonthlyExpense = totalExpense / 12;
    
    // Margin
    const operatingMargin = totalRevenue > 0 ? (result / totalRevenue) * 100 : 0;
    
    // Fixed vs Variable (personnel + administrative + fixed = fixed)
    const fixedExpenses = expenses
      .filter(e => ['fixed', 'personnel', 'administrative'].includes(e.expense_type))
      .reduce((sum, e) => sum + (e.total_amount || 0), 0);
    const variableExpenses = totalExpense - fixedExpenses;
    const fixedRatio = totalExpense > 0 ? (fixedExpenses / totalExpense) * 100 : 0;
    
    // Recurring vs Non-recurring
    const recurringRevenue = revenues.filter(r => r.is_recurring).reduce((sum, r) => sum + (r.total_amount || 0), 0);
    const recurringRatio = totalRevenue > 0 ? (recurringRevenue / totalRevenue) * 100 : 0;

    return {
      perMemberRevenue,
      perMemberExpense,
      avgMonthlyRevenue,
      avgMonthlyExpense,
      operatingMargin,
      fixedExpenses,
      variableExpenses,
      fixedRatio,
      recurringRevenue,
      recurringRatio,
    };
  }, [summary, expenses, revenues, projectedMemberCount]);

  // Top revenue items
  const topRevenues = useMemo(() => {
    return [...revenues]
      .sort((a, b) => (b.total_amount || 0) - (a.total_amount || 0))
      .slice(0, 5);
  }, [revenues]);

  // Top expense items
  const topExpenses = useMemo(() => {
    return [...expenses]
      .sort((a, b) => (b.total_amount || 0) - (a.total_amount || 0))
      .slice(0, 5);
  }, [expenses]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
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

  return (
    <div className="space-y-6">
      {/* Key Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 text-green-600">
                <TrendingUp className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">Total Receitas</p>
                <p className="text-lg font-bold text-green-600">
                  {formatCurrencyCompact(summary.totalRevenuesBudgeted)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100 text-red-600">
                <TrendingDown className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">Total Despesas</p>
                <p className="text-lg font-bold text-red-600">
                  {formatCurrencyCompact(summary.totalExpensesBudgeted)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${summary.projectedResult >= 0 ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'}`}>
                <Target className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">Resultado</p>
                <p className={`text-lg font-bold ${summary.projectedResult >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                  {formatCurrencyCompact(summary.projectedResult)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${indicators.operatingMargin >= 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                <Percent className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">Margem</p>
                <p className={`text-lg font-bold ${indicators.operatingMargin >= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {indicators.operatingMargin.toFixed(1)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 text-purple-600">
                <Calculator className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">Média Mensal</p>
                <p className="text-lg font-bold text-purple-600">
                  {formatCurrencyCompact(indicators.avgMonthlyRevenue)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-100 text-cyan-600">
                <PiggyBank className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">Rec. Recorrente</p>
                <p className="text-lg font-bold text-cyan-600">
                  {indicators.recurringRatio.toFixed(0)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Per Member Indicators (if member count is available) */}
      {projectedMemberCount && projectedMemberCount > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Indicadores Per Capita
              <Badge variant="outline" className="ml-2 font-normal">
                {projectedMemberCount.toLocaleString('pt-BR')} sócios projetados
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">Receita/Sócio/Ano</p>
                <p className="text-xl font-bold text-green-600">{formatCurrency(indicators.perMemberRevenue)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatCurrency(indicators.perMemberRevenue / 12)}/mês
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">Despesa/Sócio/Ano</p>
                <p className="text-xl font-bold text-red-600">{formatCurrency(indicators.perMemberExpense)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatCurrency(indicators.perMemberExpense / 12)}/mês
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">Resultado/Sócio</p>
                <p className={`text-xl font-bold ${summary.projectedResult >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                  {formatCurrency(indicators.perMemberRevenue - indicators.perMemberExpense)}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">Custo Fixo/Sócio</p>
                <p className="text-xl font-bold">
                  {formatCurrency(projectedMemberCount ? indicators.fixedExpenses / projectedMemberCount : 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Evolution Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Evolução Mensal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="monthShort" tick={{ fontSize: 11 }} />
                  <YAxis 
                    tickFormatter={(value) => formatCurrencyCompact(value)} 
                    tick={{ fontSize: 11 }}
                    width={70}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="revenues" name="Receitas" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" name="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  <Line 
                    type="monotone" 
                    dataKey="cumulativeBalance" 
                    name="Saldo Acumulado" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    dot={{ fill: '#3b82f6', strokeWidth: 2 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Revenue Composition */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <PieChart className="h-4 w-4" />
              Composição das Receitas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] flex">
              <div className="flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={revenueByType}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {revenueByType.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                    />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-[140px] flex flex-col justify-center gap-1 text-xs">
                {revenueByType.slice(0, 5).map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-sm flex-shrink-0" 
                      style={{ backgroundColor: item.color }} 
                    />
                    <span className="truncate">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Expense Analysis Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expense by Type */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <PieChart className="h-4 w-4" />
              Despesas por Tipo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] flex">
              <div className="flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={expenseByType}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {expenseByType.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                    />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-[140px] flex flex-col justify-center gap-1 text-xs">
                {expenseByType.slice(0, 6).map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-sm flex-shrink-0" 
                      style={{ backgroundColor: item.color }} 
                    />
                    <span className="truncate">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Expense by Nature */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FileBarChart className="h-4 w-4" />
              Despesas por Natureza
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {expenseByNature.map((item, index) => {
                const percentage = summary.totalExpensesBudgeted > 0 
                  ? (item.value / summary.totalExpensesBudgeted) * 100 
                  : 0;
                return (
                  <div key={index}>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium">{item.name}</span>
                      <span className="text-sm text-muted-foreground">
                        {formatCurrency(item.value)} ({percentage.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all"
                        style={{ 
                          width: `${percentage}%`,
                          backgroundColor: item.color 
                        }}
                      />
                    </div>
                  </div>
                );
              })}
              
              <Separator className="my-4" />
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-muted-foreground">Despesas Fixas</p>
                  <p className="text-lg font-bold">{formatCurrency(indicators.fixedExpenses)}</p>
                  <p className="text-xs text-muted-foreground">{indicators.fixedRatio.toFixed(1)}% do total</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-muted-foreground">Despesas Variáveis</p>
                  <p className="text-lg font-bold">{formatCurrency(indicators.variableExpenses)}</p>
                  <p className="text-xs text-muted-foreground">{(100 - indicators.fixedRatio).toFixed(1)}% do total</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quarterly Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resumo Trimestral</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {quarterlyData.map((q, index) => (
              <div key={index} className="p-4 rounded-lg border">
                <h4 className="font-semibold mb-3">{q.quarter}</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Receitas</span>
                    <span className="text-green-600 font-medium">{formatCurrencyCompact(q.revenues)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Despesas</span>
                    <span className="text-red-600 font-medium">{formatCurrencyCompact(q.expenses)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Saldo</span>
                    <span className={`font-bold ${q.balance >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                      {formatCurrencyCompact(q.balance)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Top Items */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Revenues */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowUpRight className="h-4 w-4 text-green-600" />
              Principais Receitas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topRevenues.map((rev, index) => {
                const percentage = summary.totalRevenuesBudgeted > 0 
                  ? ((rev.total_amount || 0) / summary.totalRevenuesBudgeted) * 100 
                  : 0;
                return (
                  <div key={rev.id} className="flex items-center gap-3">
                    <span className="text-sm font-bold text-muted-foreground w-5">{index + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{rev.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {revenueTypeLabels[rev.revenue_type] || rev.revenue_type}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-green-600">{formatCurrency(rev.total_amount || 0)}</p>
                      <p className="text-xs text-muted-foreground">{percentage.toFixed(1)}%</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Top Expenses */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowDownRight className="h-4 w-4 text-red-600" />
              Principais Despesas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topExpenses.map((exp, index) => {
                const percentage = summary.totalExpensesBudgeted > 0 
                  ? ((exp.total_amount || 0) / summary.totalExpensesBudgeted) * 100 
                  : 0;
                return (
                  <div key={exp.id} className="flex items-center gap-3">
                    <span className="text-sm font-bold text-muted-foreground w-5">{index + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{exp.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {expenseTypeLabels[exp.expense_type] || exp.expense_type}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-red-600">{formatCurrency(exp.total_amount || 0)}</p>
                      <p className="text-xs text-muted-foreground">{percentage.toFixed(1)}%</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Breakdown Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Demonstrativo Mensal Detalhado</CardTitle>
          <CardDescription>Fluxo de caixa projetado com saldo acumulado</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mês</TableHead>
                  <TableHead className="text-right">Receitas</TableHead>
                  <TableHead className="text-right">Despesas</TableHead>
                  <TableHead className="text-right">Saldo Mensal</TableHead>
                  <TableHead className="text-right">Saldo Acumulado</TableHead>
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
                    <TableCell className={`text-right font-bold ${data.cumulativeBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {formatCurrency(data.cumulativeBalance)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-bold bg-muted/50">
                  <TableCell>TOTAL ANUAL</TableCell>
                  <TableCell className="text-right text-green-600">
                    {formatCurrency(summary.totalRevenuesBudgeted)}
                  </TableCell>
                  <TableCell className="text-right text-red-600">
                    {formatCurrency(summary.totalExpensesBudgeted)}
                  </TableCell>
                  <TableCell className={`text-right ${summary.projectedResult >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                    {formatCurrency(summary.projectedResult)}
                  </TableCell>
                  <TableCell className={`text-right ${monthlyData[11]?.cumulativeBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {formatCurrency(monthlyData[11]?.cumulativeBalance || 0)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Financial Health Summary */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Resumo da Saúde Financeira
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Resultado Projetado</p>
              <p className={`text-2xl font-bold ${summary.projectedResult >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(summary.projectedResult)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {summary.projectedResult >= 0 ? 'Superávit' : 'Déficit'} previsto
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Margem Operacional</p>
              <p className={`text-2xl font-bold ${indicators.operatingMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {indicators.operatingMargin.toFixed(1)}%
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Sobre receita total
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Receita Recorrente</p>
              <p className="text-2xl font-bold text-blue-600">
                {indicators.recurringRatio.toFixed(0)}%
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {formatCurrencyCompact(indicators.recurringRevenue)} garantidos
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Custo Fixo</p>
              <p className="text-2xl font-bold text-amber-600">
                {indicators.fixedRatio.toFixed(0)}%
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {formatCurrencyCompact(indicators.fixedExpenses)} comprometidos
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
