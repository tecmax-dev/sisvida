import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, ChevronRight, Users, FileText } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { budgetStatusLabels, budgetStatusColors } from "@/types/unionBudget";
import type { BudgetExercise } from "@/types/unionBudget";

interface BudgetExerciseCardProps {
  exercise: BudgetExercise;
}

export function BudgetExerciseCard({ exercise }: BudgetExerciseCardProps) {
  const startDate = new Date(exercise.start_date);
  const endDate = new Date(exercise.end_date);
  
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">{exercise.name}</CardTitle>
            {exercise.description && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {exercise.description}
              </p>
            )}
          </div>
          <Badge className={budgetStatusColors[exercise.status]}>
            {budgetStatusLabels[exercise.status]}
          </Badge>
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
  );
}
