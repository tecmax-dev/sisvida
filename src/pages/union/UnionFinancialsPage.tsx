import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Receipt,
  Building2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  Wallet,
  RefreshCw,
  FileBarChart,
  ArrowLeftRight,
  Loader2,
} from "lucide-react";
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
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

interface FinancialStats {
  totalRevenue: number;
  totalExpenses: number;
  currentBalance: number;
  pendingContributions: number;
  overdueContributions: number;
  paidContributions: number;
  pendingValue: number;
  overdueValue: number;
  paidValue: number;
  pendingExpenses: number;
  pendingExpensesValue: number;
}

interface RecentTransaction {
  id: string;
  description: string;
  type: string;
  amount: number;
  status: string;
  due_date: string;
}

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export default function UnionFinancialsPage() {
  const { currentClinic } = useAuth();
  const [stats, setStats] = useState<FinancialStats | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<RecentTransaction[]>([]);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const clinicId = currentClinic?.id;
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();

  useEffect(() => {
    const fetchData = async () => {
      if (!clinicId) {
        setLoading(false);
        return;
      }

      try {
        const now = new Date();
        const monthStart = startOfMonth(now).toISOString();
        const monthEnd = endOfMonth(now).toISOString();

        // Fetch contributions stats
        const { data: contributions } = await supabase
          .from("employer_contributions")
          .select("id, value, status, paid_value, paid_at")
          .eq("clinic_id", clinicId)
          .gte("created_at", `${currentYear}-01-01`)
          .lte("created_at", `${currentYear}-12-31`);

        const pendingContribs = contributions?.filter(c => c.status === "pending") || [];
        const overdueContribs = contributions?.filter(c => c.status === "overdue") || [];
        const paidContribs = contributions?.filter(c => c.status === "paid") || [];

        // Fetch current month paid contributions (revenue)
        const { data: paidThisMonth } = await supabase
          .from("employer_contributions")
          .select("value, paid_value")
          .eq("clinic_id", clinicId)
          .eq("status", "paid")
          .gte("paid_at", monthStart)
          .lte("paid_at", monthEnd);

        const monthlyRevenue = (paidThisMonth || []).reduce(
          (sum, c) => sum + (c.paid_value || c.value || 0),
          0
        );

        // Fetch expenses this month
        const { data: expensesThisMonth } = await supabase
          .from("union_financial_transactions")
          .select("net_value, amount")
          .eq("clinic_id", clinicId)
          .eq("type", "expense")
          .eq("status", "paid")
          .gte("paid_date", format(now, "yyyy-MM-01"))
          .lte("paid_date", format(endOfMonth(now), "yyyy-MM-dd"));

        const monthlyExpenses = (expensesThisMonth || []).reduce(
          (sum, e) => sum + Math.abs(e.net_value || e.amount || 0),
          0
        );

        // Fetch pending expenses
        const { data: pendingExpenses } = await supabase
          .from("union_financial_transactions")
          .select("net_value, amount")
          .eq("clinic_id", clinicId)
          .eq("type", "expense")
          .eq("status", "pending");

        const pendingExpenseCount = pendingExpenses?.length || 0;
        const pendingExpensesValue = (pendingExpenses || []).reduce(
          (sum, e) => sum + Math.abs(e.net_value || e.amount || 0),
          0
        );

        // Fetch cash registers balance
        const { data: cashRegisters } = await supabase
          .from("union_cash_registers")
          .select("current_balance")
          .eq("clinic_id", clinicId)
          .eq("is_active", true);

        const currentBalance = (cashRegisters || []).reduce(
          (sum, r) => sum + (r.current_balance || 0),
          0
        );

        // Fetch recent transactions
        const { data: recent } = await supabase
          .from("union_financial_transactions")
          .select("id, description, type, amount, status, due_date")
          .eq("clinic_id", clinicId)
          .order("created_at", { ascending: false })
          .limit(5);

        setRecentTransactions(recent || []);

        // Generate monthly chart data
        const monthlyChartData = MONTHS.map((month, index) => {
          const monthContribs = paidContribs.filter(c => {
            if (!c.paid_at) return false;
            const paidMonth = new Date(c.paid_at).getMonth();
            return paidMonth === index;
          });
          const received = monthContribs.reduce((sum, c) => sum + (c.paid_value || c.value || 0), 0) / 100;
          return { month, received };
        });
        setMonthlyData(monthlyChartData);

        setStats({
          totalRevenue: monthlyRevenue,
          totalExpenses: monthlyExpenses,
          currentBalance,
          pendingContributions: pendingContribs.length,
          overdueContributions: overdueContribs.length,
          paidContributions: paidContribs.length,
          pendingValue: pendingContribs.reduce((s, c) => s + (c.value || 0), 0),
          overdueValue: overdueContribs.reduce((s, c) => s + (c.value || 0), 0),
          paidValue: paidContribs.reduce((s, c) => s + (c.paid_value || c.value || 0), 0),
          pendingExpenses: pendingExpenseCount,
          pendingExpensesValue,
        });
      } catch (error) {
        console.error("Error fetching financial stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [clinicId, currentYear]);

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(cents / 100);
  };

  const statusPieData = useMemo(() => {
    if (!stats) return [];
    return [
      { name: "Pagos", value: stats.paidContributions, color: "#10b981" },
      { name: "Pendentes", value: stats.pendingContributions, color: "#f59e0b" },
      { name: "Vencidos", value: stats.overdueContributions, color: "#ef4444" },
    ].filter(item => item.value > 0);
  }, [stats]);

  const netResult = stats ? stats.totalRevenue - stats.totalExpenses : 0;

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96 mt-2" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Financeiro Sindical</h1>
          <p className="text-muted-foreground">
            Visão geral das finanças de {format(new Date(), "MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/union/financeiro/movimentacao">
              <ArrowLeftRight className="h-4 w-4 mr-2" />
              Extrato
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/union/financeiro/relatorios">
              <FileBarChart className="h-4 w-4 mr-2" />
              Relatórios
            </Link>
          </Button>
        </div>
      </div>

      {/* Main KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-muted-foreground">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              <span className="text-sm font-medium">Receita do Mês</span>
            </div>
            <p className="text-2xl font-bold text-emerald-600 mt-1">
              {formatCurrency(stats?.totalRevenue || 0)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-rose-500">
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-muted-foreground">
              <TrendingDown className="h-4 w-4 text-rose-500" />
              <span className="text-sm font-medium">Despesas do Mês</span>
            </div>
            <p className="text-2xl font-bold text-rose-600 mt-1">
              {formatCurrency(stats?.totalExpenses || 0)}
            </p>
          </CardContent>
        </Card>

        <Card className={`border-l-4 ${netResult >= 0 ? 'border-l-blue-500' : 'border-l-amber-500'}`}>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-muted-foreground">
              <DollarSign className={`h-4 w-4 ${netResult >= 0 ? 'text-blue-500' : 'text-amber-500'}`} />
              <span className="text-sm font-medium">Resultado do Mês</span>
            </div>
            <p className={`text-2xl font-bold mt-1 ${netResult >= 0 ? 'text-blue-600' : 'text-amber-600'}`}>
              {formatCurrency(netResult)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-violet-500">
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Wallet className="h-4 w-4 text-violet-500" />
              <span className="text-sm font-medium">Saldo em Caixa</span>
            </div>
            <p className="text-2xl font-bold text-violet-600 mt-1">
              {formatCurrency(stats?.currentBalance || 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Contributions Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Clock className="h-4 w-4 text-amber-500" />
                  <span className="text-sm">Contribuições Pendentes</span>
                </div>
                <p className="text-xl font-bold">{stats?.pendingContributions || 0}</p>
                <p className="text-sm text-muted-foreground">{formatCurrency(stats?.pendingValue || 0)}</p>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/union/contribuicoes">
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className={stats?.overdueContributions ? "border-rose-200 bg-rose-50/30" : ""}>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <AlertTriangle className="h-4 w-4 text-rose-500" />
                  <span className="text-sm">Contribuições Vencidas</span>
                </div>
                <p className="text-xl font-bold text-rose-600">{stats?.overdueContributions || 0}</p>
                <p className="text-sm text-rose-600">{formatCurrency(stats?.overdueValue || 0)}</p>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/union/contribuicoes">
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span className="text-sm">Contribuições Pagas ({currentYear})</span>
                </div>
                <p className="text-xl font-bold text-emerald-600">{stats?.paidContributions || 0}</p>
                <p className="text-sm text-emerald-600">{formatCurrency(stats?.paidValue || 0)}</p>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/union/contribuicoes">
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Receipts Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recebimentos Mensais ({currentYear})</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis
                  className="text-xs"
                  tickFormatter={(v) => `R$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                />
                <Tooltip
                  formatter={(value: number) => [`R$ ${value.toFixed(2)}`, "Recebido"]}
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                  }}
                />
                <Bar dataKey="received" name="Recebido" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Status Pie Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Status das Contribuições</CardTitle>
          </CardHeader>
          <CardContent>
            {statusPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={statusPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                    labelLine={false}
                  >
                    {statusPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[280px] text-muted-foreground">
                Sem dados para exibir
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions and Recent */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ações Rápidas</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" asChild>
              <Link to="/union/financeiro/despesas">
                <TrendingDown className="h-5 w-5 text-rose-500" />
                <span>Nova Despesa</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" asChild>
              <Link to="/union/financeiro/receitas">
                <TrendingUp className="h-5 w-5 text-emerald-500" />
                <span>Nova Receita</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" asChild>
              <Link to="/union/financeiro/contas">
                <Wallet className="h-5 w-5 text-blue-500" />
                <span>Contas Bancárias</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" asChild>
              <Link to="/union/contribuicoes">
                <Receipt className="h-5 w-5 text-amber-500" />
                <span>Contribuições</span>
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Pending Expenses Alert */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              Despesas Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.pendingExpenses && stats.pendingExpenses > 0 ? (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-amber-800">
                        {stats.pendingExpenses} despesa(s) a pagar
                      </p>
                      <p className="text-sm text-amber-700">
                        Total: {formatCurrency(stats.pendingExpensesValue)}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" className="border-amber-300" asChild>
                      <Link to="/union/financeiro/despesas">
                        Ver Todas
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 mb-3 text-emerald-500" />
                <p>Nenhuma despesa pendente</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
