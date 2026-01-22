import { useAuth } from "@/hooks/useAuth";
import { useUnionLegalStats } from "@/hooks/useUnionLegal";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Scale, FileText, AlertTriangle, DollarSign, Clock, Users, Building2, Loader2, CalendarClock, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function UnionLegalDashboardPage() {
  const { currentClinic } = useAuth();
  const { stats, isLoading } = useUnionLegalStats(currentClinic?.id);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const statsCards = [
    {
      label: "Processos Ativos",
      value: stats?.activeCases || 0,
      icon: FileText,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      href: "/union/juridico/casos",
    },
    {
      label: "Alto Risco",
      value: stats?.highRiskCases || 0,
      icon: AlertTriangle,
      color: "text-red-500",
      bgColor: "bg-red-500/10",
      href: "/union/juridico/casos?risk=alto,critico",
    },
    {
      label: "Prazos Urgentes",
      value: stats?.urgentDeadlines || 0,
      icon: Clock,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
      href: "/union/juridico/prazos",
    },
    {
      label: "Passivo Estimado",
      value: formatCurrency(stats?.totalEstimatedLiability || 0),
      icon: DollarSign,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
      href: "/union/juridico/provisoes",
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Scale className="h-7 w-7 text-blue-500" />
            Módulo Jurídico
          </h1>
          <p className="text-muted-foreground">
            Gestão de processos judiciais e administrativos
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link to="/union/juridico/casos/novo">
              <FileText className="h-4 w-4 mr-2" />
              Novo Processo
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((stat) => (
          <Link key={stat.label} to={stat.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
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
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5 text-blue-500" />
              Processos
            </CardTitle>
            <CardDescription>Gestão de casos judiciais e administrativos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link to="/union/juridico/casos">
                <FileText className="h-4 w-4 mr-2" />
                Ver Todos os Processos
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link to="/union/juridico/casos/novo">
                <FileText className="h-4 w-4 mr-2" />
                Cadastrar Novo Processo
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5 text-purple-500" />
              Advogados e Escritórios
            </CardTitle>
            <CardDescription>Cadastro de representantes jurídicos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link to="/union/juridico/advogados">
                <Users className="h-4 w-4 mr-2" />
                Advogados
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link to="/union/juridico/escritorios">
                <Building2 className="h-4 w-4 mr-2" />
                Escritórios de Advocacia
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarClock className="h-5 w-5 text-orange-500" />
              Prazos e Compromissos
            </CardTitle>
            <CardDescription>Controle de datas e audiências</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link to="/union/juridico/prazos">
                <Clock className="h-4 w-4 mr-2" />
                Agenda de Prazos
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link to="/union/juridico/prazos/novo">
                <CalendarClock className="h-4 w-4 mr-2" />
                Novo Prazo
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <DollarSign className="h-5 w-5 text-emerald-500" />
              Financeiro Jurídico
            </CardTitle>
            <CardDescription>Custas, honorários e provisões</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link to="/union/juridico/despesas">
                <TrendingUp className="h-4 w-4 mr-2" />
                Despesas Jurídicas
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link to="/union/juridico/provisoes">
                <DollarSign className="h-4 w-4 mr-2" />
                Provisões
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Riscos
            </CardTitle>
            <CardDescription>Análise e monitoramento de riscos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 rounded bg-red-500/10">
                <span className="text-sm">Crítico</span>
                <Badge variant="destructive">0</Badge>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-orange-500/10">
                <span className="text-sm">Alto</span>
                <Badge className="bg-orange-500">{stats?.highRiskCases || 0}</Badge>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-yellow-500/10">
                <span className="text-sm">Médio</span>
                <Badge className="bg-yellow-500 text-yellow-950">0</Badge>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-green-500/10">
                <span className="text-sm">Baixo</span>
                <Badge className="bg-green-500">0</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5 text-gray-500" />
              Relatórios
            </CardTitle>
            <CardDescription>Relatórios e estatísticas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link to="/union/juridico/relatorios">
                <FileText className="h-4 w-4 mr-2" />
                Relatório Geral
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link to="/union/juridico/auditoria">
                <FileText className="h-4 w-4 mr-2" />
                Log de Auditoria
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
