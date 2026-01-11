import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, Receipt, DollarSign, Handshake, TrendingUp, TrendingDown, Calendar } from "lucide-react";

export default function UnionDashboard() {
  const { currentClinic } = useAuth();

  const stats = [
    { label: "Empresas Ativas", value: "0", icon: Building2, color: "text-amber-500", bgColor: "bg-amber-500/10" },
    { label: "Sócios Cadastrados", value: "0", icon: Users, color: "text-purple-500", bgColor: "bg-purple-500/10" },
    { label: "Contribuições Pendentes", value: "0", icon: Receipt, color: "text-emerald-500", bgColor: "bg-emerald-500/10" },
    { label: "Negociações Ativas", value: "0", icon: Handshake, color: "text-blue-500", bgColor: "bg-blue-500/10" },
  ];

  const financialSummary = [
    { label: "Receita do Mês", value: "R$ 0,00", icon: TrendingUp, color: "text-emerald-600" },
    { label: "Despesas do Mês", value: "R$ 0,00", icon: TrendingDown, color: "text-rose-600" },
    { label: "Saldo Atual", value: "R$ 0,00", icon: DollarSign, color: "text-blue-600" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Módulo Sindical</h1>
        <p className="text-muted-foreground">
          Visão geral do gerenciamento sindical de {currentClinic?.name}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Financial Summary */}
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
                <p className={`text-xl font-semibold ${item.color}`}>{item.value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

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
