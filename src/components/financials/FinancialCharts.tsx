import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart3, PieChart as PieChartIcon } from "lucide-react";

interface FinancialChartsProps {
  clinicId: string;
}

const COLORS = ["#10b981", "#ef4444", "#f59e0b", "#3b82f6", "#8b5cf6", "#ec4899"];

export function FinancialCharts({ clinicId }: FinancialChartsProps) {
  const { data: monthlyData, isLoading: isLoadingMonthly } = useQuery({
    queryKey: ["financial-monthly", clinicId],
    queryFn: async () => {
      const months = [];
      for (let i = 5; i >= 0; i--) {
        const date = subMonths(new Date(), i);
        months.push({
          start: format(startOfMonth(date), "yyyy-MM-dd"),
          end: format(endOfMonth(date), "yyyy-MM-dd"),
          label: format(date, "MMM", { locale: ptBR }),
        });
      }

      const results = await Promise.all(
        months.map(async (month) => {
          const { data: transactions } = await supabase
            .from("financial_transactions")
            .select("type, amount, status")
            .eq("clinic_id", clinicId)
            .eq("status", "paid")
            .gte("paid_date", month.start)
            .lte("paid_date", month.end);

          const income = transactions
            ?.filter((t) => t.type === "income")
            .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

          const expense = transactions
            ?.filter((t) => t.type === "expense")
            .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

          return {
            name: month.label,
            receitas: income,
            despesas: expense,
          };
        })
      );

      return results;
    },
  });

  const { data: categoryData, isLoading: isLoadingCategory } = useQuery({
    queryKey: ["financial-categories-summary", clinicId],
    queryFn: async () => {
      const startDate = format(startOfMonth(new Date()), "yyyy-MM-dd");
      const endDate = format(endOfMonth(new Date()), "yyyy-MM-dd");

      const { data: transactions } = await supabase
        .from("financial_transactions")
        .select(`
          amount,
          type,
          category_id,
          financial_categories (
            name,
            color
          )
        `)
        .eq("clinic_id", clinicId)
        .eq("status", "paid")
        .eq("type", "expense")
        .gte("paid_date", startDate)
        .lte("paid_date", endDate);

      const categoryMap = new Map<string, { name: string; value: number; color: string }>();

      transactions?.forEach((t) => {
        const categoryName = (t.financial_categories as any)?.name || "Sem categoria";
        const categoryColor = (t.financial_categories as any)?.color || "#94a3b8";
        const existing = categoryMap.get(categoryName) || { name: categoryName, value: 0, color: categoryColor };
        existing.value += Number(t.amount);
        categoryMap.set(categoryName, existing);
      });

      return Array.from(categoryMap.values());
    },
  });

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
    }).format(value);

  if (isLoadingMonthly || isLoadingCategory) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-72 w-full" />
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-72 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="border-l-4 border-l-blue-500 bg-gradient-to-r from-blue-50/50 to-transparent dark:from-blue-950/20">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base font-medium text-blue-700 dark:text-blue-300">
            Receitas vs Despesas
          </CardTitle>
          <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
            <BarChart3 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" className="text-xs" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(v) => `R$${v / 1000}k`} className="text-xs" tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Legend 
                wrapperStyle={{ fontSize: "12px", paddingTop: "12px" }}
                formatter={(value) => value === "receitas" ? "Receitas" : "Despesas"}
              />
              <Bar dataKey="receitas" fill="#10b981" radius={[4, 4, 0, 0]} name="receitas" />
              <Bar dataKey="despesas" fill="#ef4444" radius={[4, 4, 0, 0]} name="despesas" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-purple-500 bg-gradient-to-r from-purple-50/50 to-transparent dark:from-purple-950/20">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base font-medium text-purple-700 dark:text-purple-300">
            Despesas por Categoria (Mês)
          </CardTitle>
          <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
            <PieChartIcon className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </div>
        </CardHeader>
        <CardContent>
          {categoryData && categoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="45%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) =>
                    `${name.length > 10 ? name.slice(0, 10) + '...' : name} ${(percent * 100).toFixed(0)}%`
                  }
                  labelLine={false}
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Legend 
                  wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
                  formatter={(value: string) => value.length > 15 ? value.slice(0, 15) + '...' : value}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-72 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <PieChartIcon className="h-12 w-12 mx-auto mb-2 opacity-30" />
                <p>Nenhuma despesa registrada este mês</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
