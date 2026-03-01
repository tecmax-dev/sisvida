import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Layers } from "lucide-react";
import { BudgetRevenue, BudgetExpense, monthNames, revenueTypeLabels, expenseTypeLabels } from "@/types/unionBudget";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface BudgetCategoryDetailProps {
  revenues: BudgetRevenue[];
  expenses: BudgetExpense[];
  realizedByMonth: Record<number, { revenue: number; expense: number }>;
  realizedByCategory?: Record<string, Record<number, number>>;
}

const getMonthValue = (item: BudgetRevenue | BudgetExpense, month: number): number => {
  const key = `month_${month.toString().padStart(2, "0")}` as keyof typeof item;
  return (item[key] as number) || 0;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export function BudgetCategoryDetail({
  revenues,
  expenses,
  realizedByMonth,
}: BudgetCategoryDetailProps) {
  const [expandedMonths, setExpandedMonths] = useState<Set<number>>(new Set());

  const toggleMonth = (month: number) => {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(month)) next.delete(month);
      else next.add(month);
      return next;
    });
  };

  const monthlyBreakdown = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const revenueItems = revenues
        .map((r) => ({
          description: r.description,
          type: revenueTypeLabels[r.revenue_type],
          budgeted: getMonthValue(r, month),
        }))
        .filter((r) => r.budgeted > 0);

      const expenseItems = expenses
        .map((e) => ({
          description: e.description,
          type: expenseTypeLabels[e.expense_type],
          budgeted: getMonthValue(e, month),
        }))
        .filter((e) => e.budgeted > 0);

      const totalBudRev = revenueItems.reduce((s, r) => s + r.budgeted, 0);
      const totalBudExp = expenseItems.reduce((s, e) => s + e.budgeted, 0);
      const realized = realizedByMonth[month] || { revenue: 0, expense: 0 };

      return {
        month,
        monthName: monthNames[i],
        revenueItems,
        expenseItems,
        totalBudRev,
        totalBudExp,
        realizedRev: realized.revenue,
        realizedExp: realized.expense,
      };
    });
  }, [revenues, expenses, realizedByMonth]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Layers className="h-4 w-4" />
          Detalhamento por Categoria (Mensal)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {monthlyBreakdown.map((data) => {
          const isExpanded = expandedMonths.has(data.month);
          const hasData = data.revenueItems.length > 0 || data.expenseItems.length > 0;
          const result = data.realizedRev - data.realizedExp;
          const hasRealized = data.realizedRev > 0 || data.realizedExp > 0;

          return (
            <Collapsible key={data.month} open={isExpanded} onOpenChange={() => toggleMonth(data.month)}>
              <CollapsibleTrigger asChild>
                <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors">
                  <div className="flex items-center gap-3">
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <span className="font-medium">{data.monthName}</span>
                    <Badge variant="outline" className="text-xs">
                      {data.revenueItems.length + data.expenseItems.length} itens
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-green-600">Rec: {formatCurrency(hasRealized ? data.realizedRev : data.totalBudRev)}</span>
                    <span className="text-red-600">Desp: {formatCurrency(hasRealized ? data.realizedExp : data.totalBudExp)}</span>
                    {hasRealized && (
                      <span className={`font-medium ${result >= 0 ? "text-green-600" : "text-red-600"}`}>
                        Res: {formatCurrency(result)}
                      </span>
                    )}
                  </div>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                {hasData ? (
                  <div className="ml-7 mt-2 mb-3 space-y-3">
                    {data.revenueItems.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1 uppercase">Receitas Previstas</p>
                        <Table>
                          <TableBody>
                            {data.revenueItems.map((item, idx) => (
                              <TableRow key={idx}>
                                <TableCell className="py-1 text-sm">{item.description}</TableCell>
                                <TableCell className="py-1 text-sm text-muted-foreground">{item.type}</TableCell>
                                <TableCell className="py-1 text-sm text-right text-green-600">{formatCurrency(item.budgeted)}</TableCell>
                              </TableRow>
                            ))}
                            <TableRow className="font-medium border-t">
                              <TableCell className="py-1 text-sm" colSpan={2}>Subtotal Receitas</TableCell>
                              <TableCell className="py-1 text-sm text-right text-green-600">{formatCurrency(data.totalBudRev)}</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    )}
                    {data.expenseItems.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1 uppercase">Despesas Previstas</p>
                        <Table>
                          <TableBody>
                            {data.expenseItems.map((item, idx) => (
                              <TableRow key={idx}>
                                <TableCell className="py-1 text-sm">{item.description}</TableCell>
                                <TableCell className="py-1 text-sm text-muted-foreground">{item.type}</TableCell>
                                <TableCell className="py-1 text-sm text-right text-red-600">{formatCurrency(item.budgeted)}</TableCell>
                              </TableRow>
                            ))}
                            <TableRow className="font-medium border-t">
                              <TableCell className="py-1 text-sm" colSpan={2}>Subtotal Despesas</TableCell>
                              <TableCell className="py-1 text-sm text-right text-red-600">{formatCurrency(data.totalBudExp)}</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="ml-7 mt-2 mb-3 text-sm text-muted-foreground">
                    Nenhum item orçado para este mês.
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </CardContent>
    </Card>
  );
}
