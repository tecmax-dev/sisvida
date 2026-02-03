import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, Clock, CheckCircle2 } from "lucide-react";

interface Contribution {
  id: string;
  value: number;
  status: string;
  paid_value?: number | null;
}

interface UnionContributionsSummaryBarProps {
  contributions: Contribution[];
}

export default function UnionContributionsSummaryBar({
  contributions,
}: UnionContributionsSummaryBarProps) {
  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(cents / 100);
  };

  const totalValue = contributions.reduce((acc, c) => acc + c.value, 0);
  const paidValue = contributions
    .filter((c) => c.status === "paid")
    .reduce((acc, c) => acc + (c.paid_value || c.value), 0);
  const pendingValue = contributions
    .filter((c) => c.status === "pending" || c.status === "overdue")
    .reduce((acc, c) => acc + c.value, 0);

  const paidCount = contributions.filter((c) => c.status === "paid").length;
  const pendingCount = contributions.filter((c) => c.status === "pending" || c.status === "overdue").length;

  return (
    <Card className="border-primary/20 bg-gradient-to-r from-primary/5 via-primary/3 to-transparent shadow-sm">
      <CardContent className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Main Summary Text */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Contas a receber</p>
              <p className="text-base font-medium">
                Valor recebido{" "}
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                  {formatCurrency(paidValue)}
                </span>{" "}
                de um total de{" "}
                <span className="text-foreground font-bold">{formatCurrency(totalValue)}</span>
              </p>
            </div>
          </div>

          {/* Stats Badges */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <div className="text-sm">
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">{paidCount}</span>
                <span className="text-emerald-600/80 dark:text-emerald-400/80 ml-1">pagos</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <div className="text-sm">
                <span className="font-semibold text-amber-600 dark:text-amber-400">{pendingCount}</span>
                <span className="text-amber-600/80 dark:text-amber-400/80 ml-1">pendentes</span>
              </div>
            </div>

            <Badge 
              variant="outline" 
              className="h-8 px-3 bg-background border-primary/30 text-primary font-medium"
            >
              <TrendingUp className="h-3.5 w-3.5 mr-1.5" />
              {formatCurrency(pendingValue)} a receber
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
