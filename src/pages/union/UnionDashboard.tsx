import { useEffect, useState, useMemo} from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUnionEntity } from "@/hooks/useUnionEntity";
import { useUnionPermissions } from "@/hooks/useUnionPermissions";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, Receipt, DollarSign, Handshake, TrendingUp, TrendingDown, Calendar } from "lucide-react";
import { PushNotificationSetup } from "@/components/union/PushNotificationSetup";
import { NonAdminUnionHome } from "@/components/union/NonAdminUnionHome";
import { EmptyState, PageLoading } from "@/components/ui/page-state";
import { Skeleton } from "@/components/ui/skeleton";

import { SINDICATO_CLINIC_ID } from "@/constants/sindicato";
interface DashboardStats {
  totalEmployers: number;
  totalMembers: number;
  pendingContributions: number;
  activeNegotiations: number;
  monthlyRevenue: number;
  monthlyExpenses: number;
  currentBalance: number;
}

export default function UnionDashboard() {
  const { currentClinic, userRoles, isSuperAdmin } = useAuth();

  const resolvedClinic = useMemo(
    () => userRoles.find((role) => role.clinic_id === SINDICATO_CLINIC_ID)?.clinic || currentClinic,
    [currentClinic, userRoles]
  );
  const { entity, isUnionEntityAdmin, loading: entityLoading } = useUnionEntity();
  const { canViewFinancials } = useUnionPermissions();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Check if user has admin-level access to see dashboard data
  const isAdmin = isSuperAdmin || isUnionEntityAdmin || userRoles.some(r => r.role === 'admin');

  // Get the clinic_id to use for queries
  const clinicId = resolvedClinic?.id;

  useEffect(() => {
    const fetchStats = async () => {
      if (!clinicId) {
        setLoading(false);
        return;
      }

      try {
        // Fetch employers count
        const { count: employersCount } = await supabase
          .from("employers")
          .select("*", { count: "exact", head: true })
          .eq("clinic_id", clinicId)
          .eq("is_active", true);

        // Fetch members count (patients)
        const { count: membersCount } = await supabase
          .from("patients")
          .select("*", { count: "exact", head: true })
          .eq("clinic_id", clinicId);

        // Fetch pending contributions count
        const { count: pendingCount } = await supabase
          .from("employer_contributions")
          .select("*", { count: "exact", head: true })
          .eq("clinic_id", clinicId)
          .in("status", ["pending", "overdue"]);

        // Fetch active negotiations count
        const { count: negotiationsCount } = await supabase
          .from("debt_negotiations")
          .select("*", { count: "exact", head: true })
          .eq("clinic_id", clinicId)
          .in("status", ["draft", "approved", "pending_approval"]);

        // Fetch financial data for current month
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

        // Get paid contributions (revenue) this month
        const { data: paidContributions } = await supabase
          .from("employer_contributions")
          .select("value")
          .eq("clinic_id", clinicId)
          .eq("status", "paid")
          .gte("paid_at", startOfMonth)
          .lte("paid_at", endOfMonth);

        const monthlyRevenue = (paidContributions || []).reduce(
          (sum, c) => sum + (c.value || 0),
          0
        );

        // Get expenses this month from union_financial_transactions
        const { data: expenses } = await supabase
          .from("union_financial_transactions")
          .select("net_value")
          .eq("clinic_id", clinicId)
          .eq("type", "expense")
          .eq("status", "paid")
          .gte("paid_date", startOfMonth)
          .lte("paid_date", endOfMonth);

        const monthlyExpenses = (expenses || []).reduce(
          (sum, e) => sum + Math.abs(e.net_value || 0),
          0
        );

        // Calculate balance from cash registers
        const { data: cashRegisters } = await supabase
          .from("union_cash_registers")
          .select("current_balance")
          .eq("clinic_id", clinicId)
          .eq("is_active", true);

        const currentBalance = (cashRegisters || []).reduce(
          (sum, r) => sum + (r.current_balance || 0),
          0
        );

        setStats({
          totalEmployers: employersCount || 0,
          totalMembers: membersCount || 0,
          pendingContributions: pendingCount || 0,
          activeNegotiations: negotiationsCount || 0,
          monthlyRevenue: monthlyRevenue / 100, // Convert from cents
          monthlyExpenses: monthlyExpenses / 100,
          currentBalance: currentBalance / 100,
        });
      } catch (error) {
        console.error("Error fetching dashboard stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [clinicId]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const displayName = isUnionEntityAdmin && entity
    ? entity.nome_fantasia || entity.razao_social
    : resolvedClinic?.name || "Entidade";

  const statsCards = [
    { 
      label: "Empresas Ativas", 
      value: loading ? "-" : stats?.totalEmployers?.toString() || "0", 
      icon: Building2, 
      color: "text-amber-500", 
      bgColor: "bg-amber-500/10" 
    },
    { 
      label: "Sócios Cadastrados", 
      value: loading ? "-" : stats?.totalMembers?.toString() || "0", 
      icon: Users, 
      color: "text-purple-500", 
      bgColor: "bg-purple-500/10" 
    },
    { 
      label: "Contribuições Pendentes", 
      value: loading ? "-" : stats?.pendingContributions?.toString() || "0", 
      icon: Receipt, 
      color: "text-emerald-500", 
      bgColor: "bg-emerald-500/10" 
    },
    { 
      label: "Negociações Ativas", 
      value: loading ? "-" : stats?.activeNegotiations?.toString() || "0", 
      icon: Handshake, 
      color: "text-blue-500", 
      bgColor: "bg-blue-500/10" 
    },
  ];

  const financialSummary = [
    { 
      label: "Receita do Mês", 
      value: loading ? "-" : formatCurrency(stats?.monthlyRevenue || 0), 
      icon: TrendingUp, 
      color: "text-emerald-600" 
    },
    { 
      label: "Despesas do Mês", 
      value: loading ? "-" : formatCurrency(stats?.monthlyExpenses || 0), 
      icon: TrendingDown, 
      color: "text-rose-600" 
    },
    { 
      label: "Saldo Atual", 
      value: loading ? "-" : formatCurrency(stats?.currentBalance || 0), 
      icon: DollarSign, 
      color: "text-blue-600" 
    },
  ];

  if (entityLoading) {
    return (
      <PageLoading label="Carregando painel sindical..." className="min-h-[400px]" />
    );
  }

  // Non-admin users see a placeholder
  if (!isAdmin) {
    return <NonAdminUnionHome entityName={displayName} />;
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="border-b border-border/70 pb-4">
        <p className="mb-1 text-xs font-semibold uppercase text-primary">Visão geral</p>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Módulo Sindical</h1>
        <p className="mt-1 text-sm sm:text-base text-muted-foreground">
          Visão geral do gerenciamento sindical de {displayName}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((stat) => (
          <Card key={stat.label} className="transition-[border-color,box-shadow] hover:border-primary/20 hover:shadow-md">
            <CardContent className="pt-4 sm:pt-5 lg:pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold">
                    {loading ? (
                      <Skeleton className="mt-1 h-7 w-16" />
                    ) : (
                      stat.value
                    )}
                  </p>
                </div>
                  <div className={`p-3 rounded-md ${stat.bgColor}`}>
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Financial Summary - Only visible to users with financial permissions */}
      {canViewFinancials() && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-blue-500" />
              Resumo Financeiro
            </CardTitle>
            <CardDescription>Movimentações do mês atual</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {financialSummary.map((item) => (
                <div key={item.label} className="p-4 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2 mb-2">
                    <item.icon className={`h-4 w-4 ${item.color}`} />
                    <span className="text-sm text-muted-foreground">{item.label}</span>
                  </div>
                  <p className={`text-xl font-semibold ${item.color}`}>
                    {loading ? (
                      <Skeleton className="h-6 w-28" />
                    ) : (
                      item.value
                    )}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-emerald-500" />
              Contribuições Recentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <EmptyState icon={Receipt} title="Nenhuma contribuição recente" description="As movimentações mais recentes aparecerão aqui." />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-purple-500" />
              Próximos Vencimentos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <EmptyState icon={Calendar} title="Nenhum vencimento próximo" description="Os próximos compromissos financeiros aparecerão aqui." />
          </CardContent>
        </Card>
      </div>

      {/* Push Notifications Setup */}
      <PushNotificationSetup 
        patientId={null} 
        clinicId={clinicId || null} 
      />
    </div>
  );
}
