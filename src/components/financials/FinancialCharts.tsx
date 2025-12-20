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
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

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
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Receitas vs Despesas</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" className="text-xs" />
              <YAxis tickFormatter={(v) => `R$${v / 1000}k`} className="text-xs" />
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
              />
              <Bar dataKey="receitas" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Despesas por Categoria (Mês)</CardTitle>
        </CardHeader>
        <CardContent>
          {categoryData && categoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
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
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              Nenhuma despesa registrada este mês
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
