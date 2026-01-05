import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, FileText } from "lucide-react";
import { format, differenceInDays } from "date-fns";

interface Contribution {
  id: string;
  employer_id: string;
  contribution_type_id: string;
  competence_month: number;
  competence_year: number;
  value: number;
  due_date: string;
  status: string;
  contribution_types?: {
    id: string;
    name: string;
  };
}

interface NegotiationStepContributionsProps {
  contributions: Contribution[];
  selectedContributions: string[];
  onSelectContributions: (ids: string[]) => void;
  loading: boolean;
  allowPartial: boolean;
}

const MONTHS = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez"
];

export default function NegotiationStepContributions({
  contributions,
  selectedContributions,
  onSelectContributions,
  loading,
  allowPartial,
}: NegotiationStepContributionsProps) {
  const today = new Date();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const toggleContribution = (id: string) => {
    if (!allowPartial) {
      // If partial selection is not allowed, select all or none
      if (selectedContributions.length === contributions.length) {
        onSelectContributions([]);
      } else {
        onSelectContributions(contributions.map((c) => c.id));
      }
      return;
    }

    if (selectedContributions.includes(id)) {
      onSelectContributions(selectedContributions.filter((cid) => cid !== id));
    } else {
      onSelectContributions([...selectedContributions, id]);
    }
  };

  const selectAll = () => {
    onSelectContributions(contributions.map((c) => c.id));
  };

  const deselectAll = () => {
    onSelectContributions([]);
  };

  const totalSelected = useMemo(() => {
    return contributions
      .filter((c) => selectedContributions.includes(c.id))
      .reduce((sum, c) => sum + c.value, 0);
  }, [contributions, selectedContributions]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (contributions.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">
            Esta empresa não possui contribuições em aberto para negociar.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Actions */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {selectedContributions.length} de {contributions.length} selecionada(s)
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={selectAll}>
            Selecionar Todas
          </Button>
          <Button variant="outline" size="sm" onClick={deselectAll}>
            Limpar Seleção
          </Button>
        </div>
      </div>

      {/* Contributions list */}
      <div className="space-y-2 max-h-[350px] overflow-y-auto">
        {contributions.map((contribution) => {
          const dueDate = new Date(contribution.due_date);
          const daysOverdue = differenceInDays(today, dueDate);
          const isSelected = selectedContributions.includes(contribution.id);

          return (
            <Card
              key={contribution.id}
              className={`cursor-pointer transition-colors hover:bg-accent/50 ${
                isSelected ? "ring-2 ring-primary" : ""
              }`}
              onClick={() => toggleContribution(contribution.id)}
            >
              <CardContent className="p-4 flex items-center gap-4">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => toggleContribution(contribution.id)}
                  disabled={!allowPartial && selectedContributions.length > 0 && !isSelected}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">
                      {contribution.contribution_types?.name || "Contribuição"}
                    </p>
                    <Badge variant="outline" className="text-xs">
                      {MONTHS[contribution.competence_month - 1]}/{contribution.competence_year}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Vencimento: {format(dueDate, "dd/MM/yyyy")}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatCurrency(contribution.value)}</p>
                  {daysOverdue > 0 && (
                    <div className="flex items-center gap-1 text-xs text-destructive">
                      <AlertTriangle className="h-3 w-3" />
                      {daysOverdue} dias de atraso
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Total */}
      <Card className="bg-muted/50">
        <CardContent className="py-3 flex items-center justify-between">
          <span className="text-sm font-medium">Total Selecionado (Valor Original)</span>
          <span className="text-lg font-bold">{formatCurrency(totalSelected)}</span>
        </CardContent>
      </Card>
    </div>
  );
}
