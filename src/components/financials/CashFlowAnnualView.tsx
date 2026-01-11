import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  BarChart3,
  ChevronLeft,
  ChevronRight 
} from "lucide-react";
import { FinancialExportButton } from "./FinancialExportButton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface CashFlowAnnualViewProps {
  clinicId: string;
}

const monthNames = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export function CashFlowAnnualView({ clinicId }: CashFlowAnnualViewProps) {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const { data: annualData, isLoading } = useQuery({
    queryKey: ["annual-cash-flow", clinicId, selectedYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_transactions")
        .select("*")
        .eq("clinic_id", clinicId)
        .gte("due_date", `${selectedYear}-01-01`)
        .lte("due_date", `${selectedYear}-12-31`)
        .not("status", "in", "(cancelled,reversed)");

      if (error) throw error;

      // Group by month
      const monthlyData = Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        monthName: monthNames[i],
        income: 0,
        expense: 0,
        balance: 0,
        pendingIncome: 0,
        pendingExpense: 0,
        transactionCount: 0,
      }));

      data?.forEach((t: any) => {
        if (!t.due_date) return;
        const month = new Date(t.due_date).getMonth();
        
        if (t.type === "income") {
          if (t.status === "paid") {
            monthlyData[month].income += Number(t.amount);
          } else if (t.status === "pending") {
            monthlyData[month].pendingIncome += Number(t.amount);
          }
        } else if (t.type === "expense") {
          if (t.status === "paid") {
            monthlyData[month].expense += Number(t.amount);
          } else if (t.status === "pending") {
            monthlyData[month].pendingExpense += Number(t.amount);
          }
        }
        monthlyData[month].transactionCount++;
      });

      // Calculate balance and running balance
      let runningBalance = 0;
      monthlyData.forEach((m) => {
        m.balance = m.income - m.expense;
        runningBalance += m.balance;
      });

      return { monthlyData, runningBalance };
    },
  });

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  const formatCurrencyShort = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      notation: "compact",
    }).format(value);

  // Calculate year totals
  const yearTotals = annualData?.monthlyData.reduce(
    (acc, m) => ({
      income: acc.income + m.income,
      expense: acc.expense + m.expense,
      pendingIncome: acc.pendingIncome + m.pendingIncome,
      pendingExpense: acc.pendingExpense + m.pendingExpense,
    }),
    { income: 0, expense: 0, pendingIncome: 0, pendingExpense: 0 }
  ) || { income: 0, expense: 0, pendingIncome: 0, pendingExpense: 0 };

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  if (isLoading) {
    return <Skeleton className="h-96" />;
  }

  // Chart data
  const chartData = annualData?.monthlyData.map((m) => ({
    name: m.monthName.substring(0, 3),
    Receitas: m.income,
    Despesas: m.expense,
    Saldo: m.balance,
  })) || [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h3 className="text-lg font-semibold">Fluxo de Caixa Anual</h3>
          <p className="text-sm text-muted-foreground">
            Visão consolidada mensal do ano
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSelectedYear((y) => y - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Select
            value={selectedYear.toString()}
            onValueChange={(v) => setSelectedYear(parseInt(v))}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={y.toString()}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSelectedYear((y) => y + 1)}
            disabled={selectedYear >= new Date().getFullYear()}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              Total Receitas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-600">
              {formatCurrency(yearTotals.income)}
            </p>
            {yearTotals.pendingIncome > 0 && (
              <p className="text-xs text-amber-500">
                +{formatCurrency(yearTotals.pendingIncome)} pendente
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-500" />
              Total Despesas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">
              {formatCurrency(yearTotals.expense)}
            </p>
            {yearTotals.pendingExpense > 0 && (
              <p className="text-xs text-amber-500">
                +{formatCurrency(yearTotals.pendingExpense)} pendente
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" />
              Saldo Anual
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${yearTotals.income - yearTotals.expense >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {formatCurrency(yearTotals.income - yearTotals.expense)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-indigo-500" />
              Média Mensal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-indigo-600">
              {formatCurrency((yearTotals.income - yearTotals.expense) / 12)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Evolução Mensal</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" className="text-xs" />
                <YAxis tickFormatter={formatCurrencyShort} className="text-xs" />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  labelClassName="font-medium"
                />
                <Legend />
                <Bar dataKey="Receitas" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Despesas" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead className="text-right text-emerald-600">Receitas</TableHead>
                <TableHead className="text-right text-red-600">Despesas</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead className="text-right">Pendente</TableHead>
                <TableHead className="text-center">Transações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {annualData?.monthlyData.map((m) => (
                <TableRow key={m.month}>
                  <TableCell className="font-medium">{m.monthName}</TableCell>
                  <TableCell className="text-right text-emerald-600">
                    {m.income > 0 ? formatCurrency(m.income) : "-"}
                  </TableCell>
                  <TableCell className="text-right text-red-600">
                    {m.expense > 0 ? formatCurrency(m.expense) : "-"}
                  </TableCell>
                  <TableCell className={`text-right font-medium ${m.balance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {formatCurrency(m.balance)}
                  </TableCell>
                  <TableCell className="text-right text-amber-500">
                    {m.pendingIncome + m.pendingExpense > 0 
                      ? formatCurrency(m.pendingIncome - m.pendingExpense) 
                      : "-"}
                  </TableCell>
                  <TableCell className="text-center">
                    {m.transactionCount > 0 && (
                      <Badge variant="outline">{m.transactionCount}</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {/* Total Row */}
              <TableRow className="bg-muted/50 font-bold">
                <TableCell>TOTAL</TableCell>
                <TableCell className="text-right text-emerald-600">
                  {formatCurrency(yearTotals.income)}
                </TableCell>
                <TableCell className="text-right text-red-600">
                  {formatCurrency(yearTotals.expense)}
                </TableCell>
                <TableCell className={`text-right ${yearTotals.income - yearTotals.expense >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {formatCurrency(yearTotals.income - yearTotals.expense)}
                </TableCell>
                <TableCell className="text-right text-amber-500">
                  {formatCurrency(yearTotals.pendingIncome - yearTotals.pendingExpense)}
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
