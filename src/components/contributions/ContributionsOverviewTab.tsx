import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Building2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  BarChart3,
  Calendar,
  CalendarDays,
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
  Legend,
} from "recharts";

interface Contribution {
  id: string;
  employer_id: string;
  contribution_type_id: string;
  competence_month: number;
  competence_year: number;
  value: number;
  due_date: string;
  status: string;
  paid_at: string | null;
  paid_value: number | null;
  employers?: { name: string; cnpj: string };
  contribution_types?: { name: string };
}

interface Employer {
  id: string;
  name: string;
  cnpj: string;
  registration_number?: string | null;
}

interface ContributionType {
  id: string;
  name: string;
  default_value: number;
  is_active: boolean;
}

interface ContributionsOverviewTabProps {
  contributions: Contribution[];
  employers: Employer[];
  contributionTypes: ContributionType[];
  yearFilter: number;
}

const MONTHS = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez"
];

const MONTHS_FULL = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const STATUS_COLORS = {
  pending: "#f59e0b",
  paid: "#10b981",
  overdue: "#ef4444",
  cancelled: "#6b7280",
  processing: "#3b82f6",
};

export default function ContributionsOverviewTab({
  contributions,
  employers,
  contributionTypes,
  yearFilter,
}: ContributionsOverviewTabProps) {
  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(cents / 100);
  };

  const yearContribs = useMemo(() => 
    contributions.filter(c => c.competence_year === yearFilter),
    [contributions, yearFilter]
  );

  const stats = useMemo(() => {
    const total = yearContribs.length;
    const pending = yearContribs.filter(c => c.status === "pending").length;
    const paid = yearContribs.filter(c => c.status === "paid").length;
    const overdue = yearContribs.filter(c => c.status === "overdue").length;
    const cancelled = yearContribs.filter(c => c.status === "cancelled").length;
    const totalValue = yearContribs.reduce((acc, c) => acc + c.value, 0);
    const paidValue = yearContribs
      .filter(c => c.status === "paid")
      .reduce((acc, c) => acc + (c.paid_value || c.value), 0);
    const pendingValue = yearContribs
      .filter(c => c.status === "pending" || c.status === "overdue")
      .reduce((acc, c) => acc + c.value, 0);
    
    return { total, pending, paid, overdue, cancelled, totalValue, paidValue, pendingValue };
  }, [yearContribs]);

  // Pagamentos de hoje e ontem (filtrados por paid_at)
  const recentPayments = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const todayStr = today.toISOString().split("T")[0];
    const yesterdayStr = yesterday.toISOString().split("T")[0];
    
    const paidContribs = contributions.filter(c => c.status === "paid" && c.paid_at);
    
    const todayPayments = paidContribs.filter(c => {
      if (!c.paid_at) return false;
      const paidDate = c.paid_at.split("T")[0];
      return paidDate === todayStr;
    });
    
    const yesterdayPayments = paidContribs.filter(c => {
      if (!c.paid_at) return false;
      const paidDate = c.paid_at.split("T")[0];
      return paidDate === yesterdayStr;
    });
    
    const todayValue = todayPayments.reduce((acc, c) => acc + (c.paid_value || c.value), 0);
    const yesterdayValue = yesterdayPayments.reduce((acc, c) => acc + (c.paid_value || c.value), 0);
    
    return {
      todayCount: todayPayments.length,
      todayValue,
      yesterdayCount: yesterdayPayments.length,
      yesterdayValue,
    };
  }, [contributions]);

  const monthlyData = useMemo(() => {
    return MONTHS.map((month, index) => {
      const monthContribs = yearContribs.filter(c => c.competence_month === index + 1);
      const paid = monthContribs.filter(c => c.status === "paid").reduce((acc, c) => acc + (c.paid_value || c.value), 0);
      const pending = monthContribs.filter(c => c.status === "pending" || c.status === "overdue").reduce((acc, c) => acc + c.value, 0);
      
      return {
        month,
        paid: paid / 100,
        pending: pending / 100,
        total: monthContribs.length,
      };
    });
  }, [yearContribs]);

  const statusPieData = useMemo(() => [
    { name: "Pagos", value: stats.paid, color: STATUS_COLORS.paid },
    { name: "Pendentes", value: stats.pending, color: STATUS_COLORS.pending },
    { name: "Vencidos", value: stats.overdue, color: STATUS_COLORS.overdue },
    { name: "Cancelados", value: stats.cancelled, color: STATUS_COLORS.cancelled },
  ].filter(item => item.value > 0), [stats]);

  const topEmployers = useMemo(() => {
    const employerTotals = new Map<string, { name: string; total: number; paid: number; count: number }>();
    
    yearContribs.forEach(c => {
      if (!c.employers) return;
      const existing = employerTotals.get(c.employer_id) || { 
        name: c.employers.name, 
        total: 0, 
        paid: 0,
        count: 0 
      };
      existing.total += c.value;
      existing.count += 1;
      if (c.status === "paid") existing.paid += c.paid_value || c.value;
      employerTotals.set(c.employer_id, existing);
    });

    return Array.from(employerTotals.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [yearContribs]);

  const byTypeData = useMemo(() => {
    const typeTotals = new Map<string, { name: string; value: number; count: number }>();
    
    yearContribs.forEach(c => {
      if (!c.contribution_types) return;
      const existing = typeTotals.get(c.contribution_type_id) || { 
        name: c.contribution_types.name, 
        value: 0,
        count: 0 
      };
      existing.value += c.value;
      existing.count += 1;
      typeTotals.set(c.contribution_type_id, existing);
    });

    return Array.from(typeTotals.values());
  }, [yearContribs]);

  const collectRate = stats.total > 0 ? Math.round((stats.paid / stats.total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Pagamentos Recentes - Cards destacados */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border-emerald-200 dark:border-emerald-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Pagamentos Hoje</span>
                </div>
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{formatCurrency(recentPayments.todayValue)}</p>
                <p className="text-xs text-emerald-600 dark:text-emerald-500">{recentPayments.todayCount} boletos baixados</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-cyan-50 to-sky-50 dark:from-cyan-950/20 dark:to-sky-950/20 border-cyan-200 dark:border-cyan-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <CalendarDays className="h-4 w-4 text-cyan-600" />
                  <span className="text-sm font-medium text-cyan-700 dark:text-cyan-400">Pagamentos Ontem</span>
                </div>
                <p className="text-2xl font-bold text-cyan-700 dark:text-cyan-300">{formatCurrency(recentPayments.yesterdayValue)}</p>
                <p className="text-xs text-cyan-600 dark:text-cyan-500">{recentPayments.yesterdayCount} boletos baixados</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-cyan-500/20 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-cyan-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">Total {yearFilter}</span>
            </div>
            <p className="text-2xl font-bold text-foreground mt-1">{stats.total}</p>
            <p className="text-xs text-muted-foreground">{formatCurrency(stats.totalValue)}</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span className="text-xs font-medium text-muted-foreground">Recebido</span>
            </div>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{formatCurrency(stats.paidValue)}</p>
            <p className="text-xs text-muted-foreground">{stats.paid} contribuições</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              <span className="text-xs font-medium text-muted-foreground">A Receber</span>
            </div>
            <p className="text-2xl font-bold text-amber-600 mt-1">{formatCurrency(stats.pendingValue)}</p>
            <p className="text-xs text-muted-foreground">{stats.pending + stats.overdue} pendentes</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-rose-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-500" />
              <span className="text-xs font-medium text-muted-foreground">Vencidos</span>
            </div>
            <p className="text-2xl font-bold text-rose-600 mt-1">{stats.overdue}</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-blue-500" />
              <span className="text-xs font-medium text-muted-foreground">Empresas</span>
            </div>
            <p className="text-2xl font-bold text-blue-600 mt-1">{employers.length}</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-violet-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-violet-500" />
              <span className="text-xs font-medium text-muted-foreground">Taxa Recebimento</span>
            </div>
            <p className="text-2xl font-bold text-violet-600 mt-1">{collectRate}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Recebimentos por Mês ({yearFilter})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis 
                  className="text-xs" 
                  tickFormatter={(v) => `R$${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`}
                />
                <Tooltip 
                  formatter={(value: number) => [`R$ ${value.toFixed(2)}`, '']}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))', 
                    border: '1px solid hsl(var(--border))' 
                  }}
                />
                <Bar dataKey="paid" name="Recebido" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="pending" name="Pendente" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Status Pie Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Distribuição por Status</CardTitle>
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
                  <Legend />
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

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Employers */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Maiores Contribuintes ({yearFilter})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topEmployers.length > 0 ? (
                topEmployers.map((emp, index) => (
                  <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{emp.name}</p>
                        <p className="text-xs text-muted-foreground">{emp.count} contribuições</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm">{formatCurrency(emp.total)}</p>
                      <p className="text-xs text-emerald-600">{formatCurrency(emp.paid)} pago</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-8">Nenhuma contribuição registrada</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* By Type */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <PiggyBank className="h-4 w-4" />
              Por Tipo de Contribuição ({yearFilter})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {byTypeData.length > 0 ? (
                byTypeData.map((type, index) => {
                  const percentage = stats.totalValue > 0 
                    ? Math.round((type.value / stats.totalValue) * 100) 
                    : 0;
                  
                  return (
                    <div key={index} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{type.name}</span>
                        <span>{formatCurrency(type.value)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary rounded-full transition-all" 
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-10 text-right">{percentage}%</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{type.count} contribuições</p>
                    </div>
                  );
                })
              ) : (
                <p className="text-center text-muted-foreground py-8">Nenhum tipo registrado</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
