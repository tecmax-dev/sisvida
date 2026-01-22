import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUnionBudgetDetail } from "@/hooks/useUnionBudget";
import { useUnionPermissions } from "@/hooks/useUnionPermissions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, ArrowLeft, TrendingUp, TrendingDown, Target, 
  FileText, Users, AlertTriangle, History, Settings, Plus
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { budgetStatusLabels, budgetStatusColors, monthNames } from "@/types/unionBudget";
import { BudgetRevenuesTab } from "@/components/union/budget/BudgetRevenuesTab";
import { BudgetExpensesTab } from "@/components/union/budget/BudgetExpensesTab";
import { BudgetConsolidationTab } from "@/components/union/budget/BudgetConsolidationTab";
import { BudgetExecutionTab } from "@/components/union/budget/BudgetExecutionTab";
import { BudgetApproversTab } from "@/components/union/budget/BudgetApproversTab";
// BudgetAlertsTab - to be implemented later
import { BudgetAuditTab } from "@/components/union/budget/BudgetAuditTab";

export default function UnionBudgetDetailPage() {
  const { id: exerciseId } = useParams();
  const { currentClinic } = useAuth();
  const clinicId = currentClinic?.id;
  const { canManageFinancials } = useUnionPermissions();
  
  const {
    exercise,
    currentVersion,
    versions,
    revenues,
    expenses,
    approvers,
    execution,
    summary,
    loading,
    createRevenue,
    updateRevenue,
    deleteRevenue,
    createExpense,
    updateExpense,
    deleteExpense,
    createVersion,
  } = useUnionBudgetDetail(exerciseId, clinicId);

  const [activeTab, setActiveTab] = useState("overview");

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!exercise) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <p className="text-muted-foreground mb-4">Exercício não encontrado</p>
        <Link to="/union/orcamento">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Link to="/union/orcamento">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">{exercise.name}</h1>
            <Badge className={budgetStatusColors[exercise.status]}>
              {budgetStatusLabels[exercise.status]}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            {format(new Date(exercise.start_date), "dd/MM/yyyy", { locale: ptBR })} - {format(new Date(exercise.end_date), "dd/MM/yyyy", { locale: ptBR })}
            {currentVersion && ` • Versão ${currentVersion.version_number}`}
          </p>
        </div>

        {canManageFinancials() && exercise.status === 'draft' && (
          <div className="flex gap-2">
            <Button variant="outline">
              <Settings className="h-4 w-4 mr-2" />
              Configurar
            </Button>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-100 text-green-600">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Receitas Previstas</p>
                <p className="text-xl font-bold text-green-600">
                  {formatCurrency(summary.totalRevenuesBudgeted)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-red-100 text-red-600">
                <TrendingDown className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Despesas Previstas</p>
                <p className="text-xl font-bold text-red-600">
                  {formatCurrency(summary.totalExpensesBudgeted)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg ${summary.projectedResult >= 0 ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'}`}>
                <Target className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Resultado Projetado</p>
                <p className={`text-xl font-bold ${summary.projectedResult >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                  {formatCurrency(summary.projectedResult)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-purple-100 text-purple-600">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Itens Orçados</p>
                <p className="text-xl font-bold">
                  {revenues.length + expenses.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 md:grid-cols-7 w-full">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="revenues">Receitas</TabsTrigger>
          <TabsTrigger value="expenses">Despesas</TabsTrigger>
          <TabsTrigger value="consolidation">Consolidação</TabsTrigger>
          <TabsTrigger value="execution">Execução</TabsTrigger>
          <TabsTrigger value="approvers">Aprovadores</TabsTrigger>
          <TabsTrigger value="audit">Auditoria</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Overview content */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Parâmetros do Exercício</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Início Fiscal</p>
                    <p className="font-medium">
                      Dia {exercise.fiscal_year_start_day}/{exercise.fiscal_year_start_month.toString().padStart(2, '0')}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Ano Base</p>
                    <p className="font-medium">{exercise.base_year || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Crescimento Receitas</p>
                    <p className="font-medium text-green-600">+{exercise.growth_rate_revenue || 0}%</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Crescimento Despesas</p>
                    <p className="font-medium text-red-600">+{exercise.growth_rate_expense || 0}%</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Inflação</p>
                    <p className="font-medium">{exercise.inflation_rate || 0}%</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Versão Atual</p>
                    <p className="font-medium">{currentVersion?.version_number || 1}</p>
                  </div>
                </div>

                {(exercise.base_member_count || exercise.projected_member_count) && (
                  <div className="pt-4 border-t">
                    <p className="text-muted-foreground text-sm mb-2">Projeção de Sócios</p>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {exercise.base_member_count?.toLocaleString('pt-BR') || '-'} → {exercise.projected_member_count?.toLocaleString('pt-BR') || '-'}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Versões do Orçamento</CardTitle>
                <CardDescription>Histórico de versões</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {versions.map((version) => (
                    <div 
                      key={version.id} 
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        version.is_current ? 'bg-primary/5 border-primary' : ''
                      }`}
                    >
                      <div>
                        <p className="font-medium">
                          Versão {version.version_number}
                          {version.version_name && ` - ${version.version_name}`}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(version.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                      {version.is_current && (
                        <Badge>Atual</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {exercise.description && (
            <Card>
              <CardHeader>
                <CardTitle>Descrição</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{exercise.description}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="revenues">
          <BudgetRevenuesTab
            revenues={revenues}
            clinicId={clinicId}
            versionId={currentVersion?.id}
            isEditable={exercise.status === 'draft'}
            onCreate={(data) => createRevenue(data)}
            onUpdate={(data) => updateRevenue(data)}
            onDelete={(id) => deleteRevenue(id)}
          />
        </TabsContent>

        <TabsContent value="expenses">
          <BudgetExpensesTab
            expenses={expenses}
            clinicId={clinicId}
            versionId={currentVersion?.id}
            isEditable={exercise.status === 'draft'}
            onCreate={(data) => createExpense(data)}
            onUpdate={(data) => updateExpense(data)}
            onDelete={(id) => deleteExpense(id)}
          />
        </TabsContent>

        <TabsContent value="consolidation">
          <BudgetConsolidationTab
            revenues={revenues}
            expenses={expenses}
            summary={summary}
          />
        </TabsContent>

        <TabsContent value="execution">
          <BudgetExecutionTab
            execution={execution}
            exercise={exercise}
            revenues={revenues}
            expenses={expenses}
            clinicId={clinicId}
            versionId={currentVersion?.id}
          />
        </TabsContent>

        <TabsContent value="approvers">
          <BudgetApproversTab
            approvers={approvers}
            exerciseId={exerciseId}
            clinicId={clinicId}
            isEditable={['draft', 'pending_review'].includes(exercise.status)}
          />
        </TabsContent>

        <TabsContent value="audit">
          <BudgetAuditTab exerciseId={exerciseId} clinicId={clinicId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
