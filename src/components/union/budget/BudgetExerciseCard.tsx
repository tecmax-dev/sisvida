import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Calendar, ChevronRight, Users, FileText, MoreVertical, Pencil, XCircle, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { budgetStatusLabels, budgetStatusColors } from "@/types/unionBudget";
import type { BudgetExercise, BudgetExerciseStatus } from "@/types/unionBudget";
import { useUnionBudget } from "@/hooks/useUnionBudget";
import { useUnionPermissions } from "@/hooks/useUnionPermissions";
import { BudgetExerciseDialog } from "./BudgetExerciseDialog";

interface BudgetExerciseCardProps {
  exercise: BudgetExercise;
}

export function BudgetExerciseCard({ exercise }: BudgetExerciseCardProps) {
  const startDate = new Date(exercise.start_date);
  const endDate = new Date(exercise.end_date);
  const { canManageFinancials } = useUnionPermissions();
  const { updateStatus, deleteExercise, isUpdating, isDeleting } = useUnionBudget(exercise.clinic_id);
  
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const canEdit = canManageFinancials() && !['closed', 'cancelled'].includes(exercise.status);
  const canCancel = canManageFinancials() && !['closed', 'cancelled'].includes(exercise.status);
  const canDelete = canManageFinancials() && exercise.status === 'draft';

  const handleCancel = () => {
    updateStatus({ id: exercise.id, status: 'cancelled' as BudgetExerciseStatus });
    setCancelDialogOpen(false);
  };

  const handleDelete = () => {
    deleteExercise(exercise.id);
    setDeleteDialogOpen(false);
  };

  return (
    <>
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1 flex-1 min-w-0">
              <CardTitle className="text-lg truncate">{exercise.name}</CardTitle>
              {exercise.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {exercise.description}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 ml-2">
              <Badge className={budgetStatusColors[exercise.status]}>
                {budgetStatusLabels[exercise.status]}
              </Badge>
              {canManageFinancials() && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                      <span className="sr-only">Ações</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {canEdit && (
                      <DropdownMenuItem onClick={() => setEditDialogOpen(true)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                    )}
                    {canCancel && (
                      <DropdownMenuItem 
                        onClick={() => setCancelDialogOpen(true)}
                        className="text-orange-600 focus:text-orange-600"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Cancelar
                      </DropdownMenuItem>
                    )}
                    {canDelete && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => setDeleteDialogOpen(true)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </>
                    )}
                    {!canEdit && !canCancel && !canDelete && (
                      <DropdownMenuItem disabled>
                        Nenhuma ação disponível
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Period */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>
              {format(startDate, "dd/MM/yyyy", { locale: ptBR })} - {format(endDate, "dd/MM/yyyy", { locale: ptBR })}
            </span>
          </div>

          {/* Fiscal Year Config */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileText className="h-4 w-4" />
            <span>
              Início fiscal: dia {exercise.fiscal_year_start_day}/{exercise.fiscal_year_start_month.toString().padStart(2, '0')}
            </span>
          </div>

          {/* Projections if available */}
          {(exercise.base_member_count || exercise.projected_member_count) && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>
                {exercise.base_member_count?.toLocaleString('pt-BR')} → {exercise.projected_member_count?.toLocaleString('pt-BR')} sócios
              </span>
            </div>
          )}

          {/* Growth rates */}
          {(exercise.growth_rate_revenue || exercise.growth_rate_expense) && (
            <div className="flex gap-4 text-sm">
              {exercise.growth_rate_revenue && (
                <span className="text-green-600">
                  +{exercise.growth_rate_revenue}% receitas
                </span>
              )}
              {exercise.growth_rate_expense && (
                <span className="text-red-600">
                  +{exercise.growth_rate_expense}% despesas
                </span>
              )}
            </div>
          )}

          {/* Action */}
          <Link to={`/union/orcamento/${exercise.id}`}>
            <Button variant="outline" className="w-full mt-2">
              Acessar Exercício
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <BudgetExerciseDialog 
        open={editDialogOpen} 
        onOpenChange={setEditDialogOpen}
        clinicId={exercise.clinic_id}
        exercise={exercise}
      />

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar exercício orçamentário?</AlertDialogTitle>
            <AlertDialogDescription>
              O exercício "{exercise.name}" será marcado como cancelado. 
              Esta ação pode ser revertida alterando o status posteriormente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleCancel}
              className="bg-orange-600 hover:bg-orange-700"
              disabled={isUpdating}
            >
              Confirmar Cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir exercício orçamentário?</AlertDialogTitle>
            <AlertDialogDescription>
              O exercício "{exercise.name}" será excluído permanentemente. 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive hover:bg-destructive/90"
              disabled={isDeleting}
            >
              Excluir Permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}