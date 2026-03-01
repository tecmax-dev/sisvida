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
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  Loader2, ArrowLeft, TrendingUp, TrendingDown, Target, 
  FileText, Users, History, Settings, Plus, Lock, Unlock,
  Copy, CheckCircle, GitCompare, Printer
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { budgetStatusLabels, budgetStatusColors, monthNames } from "@/types/unionBudget";
import { BudgetRevenuesTab } from "@/components/union/budget/BudgetRevenuesTab";
import { BudgetExpensesTab } from "@/components/union/budget/BudgetExpensesTab";
import { BudgetConsolidationTab } from "@/components/union/budget/BudgetConsolidationTab";
import { BudgetExecutionTab } from "@/components/union/budget/BudgetExecutionTab";
import { BudgetApproversTab } from "@/components/union/budget/BudgetApproversTab";
import { BudgetAuditTab } from "@/components/union/budget/BudgetAuditTab";
import { BudgetPrintReport } from "@/components/union/budget/BudgetPrintReport";
import { BudgetVersionComparison } from "@/components/union/budget/BudgetVersionComparison";
import { useUnionBudget } from "@/hooks/useUnionBudget";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

export default function UnionBudgetDetailPage() {
  const { id: exerciseId } = useParams();
  const { currentClinic, user } = useAuth();
  const clinicId = currentClinic?.id;
  const { canManageFinancials } = useUnionPermissions();
  const { updateStatus } = useUnionBudget(clinicId);
  
  const {
    exercise, currentVersion, versions, revenues, expenses,
    approvers, execution, summary, loading,
    createRevenue, updateRevenue, deleteRevenue,
    createExpense, updateExpense, deleteExpense,
    createVersion,
  } = useUnionBudgetDetail(exerciseId, clinicId);

  const [activeTab, setActiveTab] = useState("overview");
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [lockDialogOpen, setLockDialogOpen] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [newVersionDialogOpen, setNewVersionDialogOpen] = useState(false);
  const [newVersionName, setNewVersionName] = useState("");

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const handleApprove = () => {
    if (exercise) {
      updateStatus({ id: exercise.id, status: 'approved' });
      setApproveDialogOpen(false);
      toast.success("Orçamento aprovado com sucesso!");
    }
  };

  const handleLockVersion = () => {
    if (exercise) {
      updateStatus({ id: exercise.id, status: 'closed' });
      setLockDialogOpen(false);
      toast.success("Exercício encerrado e bloqueado!");
    }
  };

  const handleDuplicateExercise = async () => {
    if (!exercise || !clinicId) return;
    setDuplicating(true);
    try {
      // Create new exercise based on current
      const newYear = new Date(exercise.end_date).getFullYear() + 1;
      const newStartDate = exercise.start_date.replace(/\d{4}/, String(newYear));
      const newEndDate = exercise.end_date.replace(/\d{4}/, String(newYear));
      
      const { data: newExercise, error: exError } = await db
        .from("union_budget_exercises")
        .insert({
          clinic_id: clinicId,
          name: `${exercise.name} (Cópia ${newYear})`,
          description: exercise.description,
          fiscal_year_start_month: exercise.fiscal_year_start_month,
          fiscal_year_start_day: exercise.fiscal_year_start_day,
          start_date: newStartDate,
          end_date: newEndDate,
          base_year: exercise.base_year ? exercise.base_year + 1 : null,
          growth_rate_revenue: exercise.growth_rate_revenue,
          growth_rate_expense: exercise.growth_rate_expense,
          inflation_rate: exercise.inflation_rate,
          base_member_count: exercise.projected_member_count || exercise.base_member_count,
          projected_member_count: exercise.projected_member_count,
          status: 'draft',
          created_by: user?.id,
          notes: `Duplicado a partir de "${exercise.name}"`,
        })
        .select()
        .single();

      if (exError) throw exError;

      // Create initial version
      const { data: newVersion, error: vError } = await db
        .from("union_budget_versions")
        .insert({
          budget_exercise_id: newExercise.id,
          version_number: 1,
          version_name: "Versão Inicial (Cópia)",
          is_current: true,
          created_by: user?.id,
        })
        .select()
        .single();

      if (vError) throw vError;

      // Copy revenues
      if (revenues.length > 0) {
        const revenueCopies = revenues.map((r) => ({
          budget_version_id: newVersion.id,
          clinic_id: clinicId,
          category_id: r.category_id,
          chart_account_id: r.chart_account_id,
          cost_center_id: r.cost_center_id,
          description: r.description,
          revenue_type: r.revenue_type,
          month_01: r.month_01, month_02: r.month_02, month_03: r.month_03,
          month_04: r.month_04, month_05: r.month_05, month_06: r.month_06,
          month_07: r.month_07, month_08: r.month_08, month_09: r.month_09,
          month_10: r.month_10, month_11: r.month_11, month_12: r.month_12,
          premise_description: r.premise_description,
          growth_rate_applied: r.growth_rate_applied,
          is_recurring: r.is_recurring,
          is_locked: false,
          created_by: user?.id,
        }));
        await db.from("union_budget_revenues").insert(revenueCopies);
      }

      // Copy expenses
      if (expenses.length > 0) {
        const expenseCopies = expenses.map((e) => ({
          budget_version_id: newVersion.id,
          clinic_id: clinicId,
          category_id: e.category_id,
          chart_account_id: e.chart_account_id,
          cost_center_id: e.cost_center_id,
          supplier_id: e.supplier_id,
          description: e.description,
          expense_type: e.expense_type,
          expense_nature: e.expense_nature,
          month_01: e.month_01, month_02: e.month_02, month_03: e.month_03,
          month_04: e.month_04, month_05: e.month_05, month_06: e.month_06,
          month_07: e.month_07, month_08: e.month_08, month_09: e.month_09,
          month_10: e.month_10, month_11: e.month_11, month_12: e.month_12,
          budget_limit: e.budget_limit,
          requires_approval_above: e.requires_approval_above,
          premise_description: e.premise_description,
          growth_rate_applied: e.growth_rate_applied,
          is_recurring: e.is_recurring,
          is_locked: false,
          created_by: user?.id,
        }));
        await db.from("union_budget_expenses").insert(expenseCopies);
      }

      toast.success(`Exercício duplicado com sucesso! "${newExercise.name}" criado como rascunho.`);
    } catch (err: any) {
      toast.error("Erro ao duplicar: " + err.message);
    } finally {
      setDuplicating(false);
    }
  };

  const handleCreateNewVersion = () => {
    if (!newVersionName.trim()) {
      toast.error("Informe um nome para a nova versão");
      return;
    }
    createVersion(newVersionName.trim());
    setNewVersionDialogOpen(false);
    setNewVersionName("");
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
        <Link to="/union/financeiro/orcamento">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </Link>
      </div>
    );
  }

  const isEditable = exercise.status === 'draft';
  const isApproved = exercise.status === 'approved';
  const isClosed = exercise.status === 'closed';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Link to="/union/financeiro/orcamento">
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
            {isClosed && <Lock className="h-4 w-4 text-muted-foreground" />}
          </div>
          <p className="text-muted-foreground">
            {format(new Date(exercise.start_date), "dd/MM/yyyy", { locale: ptBR })} - {format(new Date(exercise.end_date), "dd/MM/yyyy", { locale: ptBR })}
            {currentVersion && ` • Versão ${currentVersion.version_number}`}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Print/PDF */}
          <BudgetPrintReport
            exercise={exercise}
            revenues={revenues}
            expenses={expenses}
            summary={summary}
            versionNumber={currentVersion?.version_number}
          />

          {/* Duplicate */}
          <Button variant="outline" size="sm" onClick={handleDuplicateExercise} disabled={duplicating}>
            {duplicating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Copy className="h-4 w-4 mr-2" />}
            Duplicar
          </Button>

          {/* New Version */}
          {canManageFinancials() && isEditable && (
            <Button variant="outline" size="sm" onClick={() => setNewVersionDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Versão
            </Button>
          )}

          {/* Approve */}
          {canManageFinancials() && isEditable && (
            <Button size="sm" onClick={() => setApproveDialogOpen(true)} className="bg-green-600 hover:bg-green-700 text-white">
              <CheckCircle className="h-4 w-4 mr-2" />
              Aprovar
            </Button>
          )}

          {/* Lock/Close */}
          {canManageFinancials() && isApproved && (
            <Button variant="outline" size="sm" onClick={() => setLockDialogOpen(true)}>
              <Lock className="h-4 w-4 mr-2" />
              Encerrar
            </Button>
          )}
        </div>
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
                <p className="text-xl font-bold text-green-600">{formatCurrency(summary.totalRevenuesBudgeted)}</p>
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
                <p className="text-xl font-bold text-red-600">{formatCurrency(summary.totalExpensesBudgeted)}</p>
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
                <p className="text-xl font-bold">{revenues.length + expenses.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 md:grid-cols-8 w-full">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="revenues">Receitas</TabsTrigger>
          <TabsTrigger value="expenses">Despesas</TabsTrigger>
          <TabsTrigger value="consolidation">Consolidação</TabsTrigger>
          <TabsTrigger value="execution">Execução</TabsTrigger>
          <TabsTrigger value="comparison">Comparativo</TabsTrigger>
          <TabsTrigger value="approvers">Aprovadores</TabsTrigger>
          <TabsTrigger value="audit">Auditoria</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Parâmetros do Exercício</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Início Fiscal</p>
                    <p className="font-medium">Dia {exercise.fiscal_year_start_day}/{exercise.fiscal_year_start_month.toString().padStart(2, '0')}</p>
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
                      <span>{exercise.base_member_count?.toLocaleString('pt-BR') || '-'} → {exercise.projected_member_count?.toLocaleString('pt-BR') || '-'}</span>
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
                    <div key={version.id} className={`flex items-center justify-between p-3 rounded-lg border ${version.is_current ? 'bg-primary/5 border-primary' : ''}`}>
                      <div>
                        <p className="font-medium">
                          Versão {version.version_number}
                          {version.version_name && ` - ${version.version_name}`}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(version.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                      {version.is_current && <Badge>Atual</Badge>}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {exercise.description && (
            <Card>
              <CardHeader><CardTitle>Descrição</CardTitle></CardHeader>
              <CardContent><p className="text-muted-foreground">{exercise.description}</p></CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="revenues">
          <BudgetRevenuesTab
            revenues={revenues}
            clinicId={clinicId}
            versionId={currentVersion?.id}
            isEditable={isEditable}
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
            isEditable={isEditable}
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
            projectedMemberCount={exercise.projected_member_count}
            baseMemberCount={exercise.base_member_count}
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

        <TabsContent value="comparison">
          <BudgetVersionComparison
            versions={versions}
            currentVersion={currentVersion || undefined}
            exerciseId={exerciseId}
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

      {/* Approve Dialog */}
      <AlertDialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aprovar Orçamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Ao aprovar, o orçamento "{exercise.name}" não poderá mais ser editado diretamente.
              Para alterações futuras será necessário criar uma nova versão.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleApprove} className="bg-green-600 hover:bg-green-700">
              <CheckCircle className="h-4 w-4 mr-2" />
              Confirmar Aprovação
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Lock/Close Dialog */}
      <AlertDialog open={lockDialogOpen} onOpenChange={setLockDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Encerrar Exercício?</AlertDialogTitle>
            <AlertDialogDescription>
              Ao encerrar, o exercício "{exercise.name}" será bloqueado permanentemente.
              Nenhuma alteração poderá ser feita após o encerramento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleLockVersion}>
              <Lock className="h-4 w-4 mr-2" />
              Confirmar Encerramento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* New Version Dialog */}
      <AlertDialog open={newVersionDialogOpen} onOpenChange={setNewVersionDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Criar Nova Versão</AlertDialogTitle>
            <AlertDialogDescription>
              Uma nova versão será criada e marcada como atual. A versão anterior será preservada para comparação.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <input
              className="w-full border rounded-md px-3 py-2 text-sm"
              placeholder="Nome da versão (ex: Revisão Março)"
              value={newVersionName}
              onChange={(e) => setNewVersionName(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCreateNewVersion}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Versão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
