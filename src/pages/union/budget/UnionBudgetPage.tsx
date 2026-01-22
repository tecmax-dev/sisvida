import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUnionBudget } from "@/hooks/useUnionBudget";
import { useUnionPermissions } from "@/hooks/useUnionPermissions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, Search, Calendar, TrendingUp, TrendingDown, Target, FileText, Settings } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { budgetStatusLabels, budgetStatusColors } from "@/types/unionBudget";
import { BudgetExerciseDialog } from "@/components/union/budget/BudgetExerciseDialog";
import { BudgetExerciseCard } from "@/components/union/budget/BudgetExerciseCard";

export default function UnionBudgetPage() {
  const { currentClinic } = useAuth();
  const clinicId = currentClinic?.id;
  const { canManageFinancials } = useUnionPermissions();
  
  const { exercises, loadingExercises } = useUnionBudget(clinicId);
  
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const filteredExercises = exercises.filter(e => 
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.description?.toLowerCase().includes(search.toLowerCase())
  );

  // Separate exercises by status
  const activeExercises = filteredExercises.filter(e => 
    !['closed', 'cancelled'].includes(e.status)
  );
  const closedExercises = filteredExercises.filter(e => 
    ['closed', 'cancelled'].includes(e.status)
  );

  // Calculate summary stats
  const totalBudgeted = 0; // Will be calculated from actual data
  const approvedCount = exercises.filter(e => e.status === 'approved').length;
  const pendingCount = exercises.filter(e => ['pending_review', 'pending_approval'].includes(e.status)).length;

  if (loadingExercises) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Previsão Orçamentária</h1>
          <p className="text-muted-foreground">
            Planejamento e acompanhamento orçamentário
          </p>
        </div>
        
        {canManageFinancials() && (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Exercício
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-100 text-blue-600">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Exercícios Ativos</p>
                <p className="text-2xl font-bold">{activeExercises.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-100 text-green-600">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Aprovados</p>
                <p className="text-2xl font-bold">{approvedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-yellow-100 text-yellow-600">
                <Target className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Em Aprovação</p>
                <p className="text-2xl font-bold">{pendingCount}</p>
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
                <p className="text-sm text-muted-foreground">Total Exercícios</p>
                <p className="text-2xl font-bold">{exercises.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar exercícios orçamentários..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Active Exercises */}
      {activeExercises.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Exercícios em Andamento</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeExercises.map((exercise) => (
              <BudgetExerciseCard key={exercise.id} exercise={exercise} />
            ))}
          </div>
        </div>
      )}

      {/* Closed Exercises */}
      {closedExercises.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-muted-foreground">Exercícios Encerrados</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {closedExercises.map((exercise) => (
              <BudgetExerciseCard key={exercise.id} exercise={exercise} />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {exercises.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum exercício orçamentário</h3>
            <p className="text-muted-foreground text-center mb-4">
              Crie seu primeiro exercício orçamentário para começar o planejamento financeiro.
            </p>
            {canManageFinancials() && (
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Primeiro Exercício
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create Dialog */}
      <BudgetExerciseDialog 
        open={dialogOpen} 
        onOpenChange={setDialogOpen}
        clinicId={clinicId}
      />
    </div>
  );
}
