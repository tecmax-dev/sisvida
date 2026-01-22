import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUnionEntity } from "@/hooks/useUnionEntity";
import { useUnionPermissions } from "@/hooks/useUnionPermissions";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, Receipt, DollarSign, Handshake, TrendingUp, TrendingDown, Calendar, Loader2 } from "lucide-react";

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
  const { currentClinic } = useAuth();
  const { entity, isUnionEntityAdmin, loading: entityLoading } = useUnionEntity();
  const { canViewFinancials } = useUnionPermissions();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Get the clinic_id to use for queries
  const clinicId = currentClinic?.id;

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
    : currentClinic?.name || "Entidade";

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
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Módulo Sindical</h1>
        <p className="text-muted-foreground">
          Visão geral do gerenciamento sindical de {displayName}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold">
                    {loading ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                      stat.value
                    )}
                  </p>
                </div>
                <div className={`p-3 rounded-lg ${stat.bgColor}`}>
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
                      <Loader2 className="h-5 w-5 animate-spin" />
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
            <div className="text-center py-8 text-muted-foreground">
              <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma contribuição recente</p>
            </div>
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
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum vencimento próximo</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
