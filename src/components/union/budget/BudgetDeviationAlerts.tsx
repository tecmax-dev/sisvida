import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, AlertCircle, CheckCircle2, TrendingUp, TrendingDown } from "lucide-react";
import { BudgetRevenue, BudgetExpense, monthNames } from "@/types/unionBudget";

interface BudgetDeviationAlertsProps {
  revenues: BudgetRevenue[];
  expenses: BudgetExpense[];
  realizedByMonth: Record<number, { revenue: number; expense: number }>;
}

interface DeviationAlert {
  id: string;
  level: "info" | "warning" | "critical";
  type: "revenue" | "expense";
  month: string;
  message: string;
  budgeted: number;
  realized: number;
  deviationPct: number;
}

const getMonthValue = (item: BudgetRevenue | BudgetExpense, month: number): number => {
  const key = `month_${month.toString().padStart(2, "0")}` as keyof typeof item;
  return (item[key] as number) || 0;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export function BudgetDeviationAlerts({
  revenues,
  expenses,
  realizedByMonth,
}: BudgetDeviationAlertsProps) {
  const alerts = useMemo(() => {
    const result: DeviationAlert[] = [];

    for (let m = 1; m <= 12; m++) {
      const real = realizedByMonth[m];
      if (!real) continue;

      const budRev = revenues.reduce((s, r) => s + getMonthValue(r, m), 0);
      const budExp = expenses.reduce((s, e) => s + getMonthValue(e, m), 0);

      // Revenue below expected
      if (budRev > 0 && real.revenue > 0) {
        const pct = ((real.revenue - budRev) / budRev) * 100;
        if (pct < -20) {
          result.push({
            id: `rev-${m}`,
            level: pct < -40 ? "critical" : "warning",
            type: "revenue",
            month: monthNames[m - 1],
            message: `Receita ${Math.abs(pct).toFixed(0)}% abaixo do previsto`,
            budgeted: budRev,
            realized: real.revenue,
            deviationPct: pct,
          });
        } else if (pct > 20) {
          result.push({
            id: `rev-${m}`,
            level: "info",
            type: "revenue",
            month: monthNames[m - 1],
            message: `Receita ${pct.toFixed(0)}% acima do previsto`,
            budgeted: budRev,
            realized: real.revenue,
            deviationPct: pct,
          });
        }
      }

      // Expense above expected
      if (budExp > 0 && real.expense > 0) {
        const pct = ((real.expense - budExp) / budExp) * 100;
        if (pct > 20) {
          result.push({
            id: `exp-${m}`,
            level: pct > 40 ? "critical" : "warning",
            type: "expense",
            month: monthNames[m - 1],
            message: `Despesa ${pct.toFixed(0)}% acima do previsto`,
            budgeted: budExp,
            realized: real.expense,
            deviationPct: pct,
          });
        } else if (pct < -20) {
          result.push({
            id: `exp-${m}`,
            level: "info",
            type: "expense",
            month: monthNames[m - 1],
            message: `Despesa ${Math.abs(pct).toFixed(0)}% abaixo do previsto (economia)`,
            budgeted: budExp,
            realized: real.expense,
            deviationPct: pct,
          });
        }
      }
    }

    return result.sort((a, b) => {
      const order = { critical: 0, warning: 1, info: 2 };
      return order[a.level] - order[b.level];
    });
  }, [revenues, expenses, realizedByMonth]);

  const criticals = alerts.filter((a) => a.level === "critical").length;
  const warnings = alerts.filter((a) => a.level === "warning").length;

  if (alerts.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 text-muted-foreground">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <p>Nenhum desvio significativo detectado. Execução dentro dos parâmetros previstos.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const levelConfig = {
    critical: { icon: AlertTriangle, color: "bg-red-100 text-red-800 border-red-200", iconColor: "text-red-600" },
    warning: { icon: AlertCircle, color: "bg-yellow-100 text-yellow-800 border-yellow-200", iconColor: "text-yellow-600" },
    info: { icon: CheckCircle2, color: "bg-blue-100 text-blue-800 border-blue-200", iconColor: "text-blue-600" },
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Alertas de Desvio Orçamentário
          </CardTitle>
          <div className="flex gap-2">
            {criticals > 0 && <Badge variant="destructive">{criticals} crítico(s)</Badge>}
            {warnings > 0 && <Badge className="bg-yellow-100 text-yellow-800">{warnings} atenção</Badge>}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {alerts.map((alert) => {
            const config = levelConfig[alert.level];
            const Icon = config.icon;
            return (
              <div key={alert.id} className={`flex items-start gap-3 p-3 rounded-lg border ${config.color}`}>
                <Icon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${config.iconColor}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{alert.month}</span>
                    <Badge variant="outline" className="text-xs">
                      {alert.type === "revenue" ? (
                        <><TrendingUp className="h-3 w-3 mr-1" />Receita</>
                      ) : (
                        <><TrendingDown className="h-3 w-3 mr-1" />Despesa</>
                      )}
                    </Badge>
                  </div>
                  <p className="text-sm mt-1">{alert.message}</p>
                  <div className="flex gap-4 mt-1 text-xs opacity-80">
                    <span>Previsto: {formatCurrency(alert.budgeted)}</span>
                    <span>Realizado: {formatCurrency(alert.realized)}</span>
                    <span className="font-medium">Desvio: {alert.deviationPct > 0 ? "+" : ""}{alert.deviationPct.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
