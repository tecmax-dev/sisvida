import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Calculator, TrendingUp, Percent, AlertTriangle } from "lucide-react";

interface Contribution {
  id: string;
  value: number;
  competence_month: number;
  competence_year: number;
  due_date: string;
  contribution_types?: {
    id: string;
    name: string;
  };
}

interface CalculatedItem {
  contribution: Contribution;
  daysOverdue: number;
  interestValue: number;
  correctionValue: number;
  lateFeeValue: number;
  totalValue: number;
}

interface NegotiationSettings {
  interest_rate_monthly: number;
  monetary_correction_monthly: number;
  late_fee_percentage: number;
}

interface NegotiationStepCalculationProps {
  calculatedItems: CalculatedItem[];
  settings: NegotiationSettings;
  totals: {
    originalValue: number;
    totalInterest: number;
    totalCorrection: number;
    totalLateFee: number;
    totalNegotiated: number;
  };
}

import { formatCompetence } from "@/lib/competence-format";

export default function NegotiationStepCalculation({
  calculatedItems,
  settings,
  totals,
}: NegotiationStepCalculationProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Rates applied */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Percent className="h-4 w-4" />
            Taxas Aplicadas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-primary">{settings.interest_rate_monthly}%</p>
              <p className="text-xs text-muted-foreground">Juros/mês</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-primary">{settings.monetary_correction_monthly}%</p>
              <p className="text-xs text-muted-foreground">Correção/mês</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-primary">{settings.late_fee_percentage}%</p>
              <p className="text-xs text-muted-foreground">Multa</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            Detalhamento por Contribuição
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contribuição</TableHead>
                  <TableHead className="text-right">Original</TableHead>
                  <TableHead className="text-right">Atraso</TableHead>
                  <TableHead className="text-right">Juros</TableHead>
                  <TableHead className="text-right">Correção</TableHead>
                  <TableHead className="text-right">Multa</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {calculatedItems.map((item) => (
                  <TableRow key={item.contribution.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">
                          {item.contribution.contribution_types?.name}
                        </p>
                        <Badge variant="outline" className="text-xs">
                          {formatCompetence(item.contribution.competence_month, item.contribution.competence_year)}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {formatCurrency(item.contribution.value)}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.daysOverdue > 0 ? (
                        <Badge variant="destructive" className="text-xs">
                          {item.daysOverdue}d
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm text-amber-600">
                      +{formatCurrency(item.interestValue)}
                    </TableCell>
                    <TableCell className="text-right text-sm text-blue-600">
                      +{formatCurrency(item.correctionValue)}
                    </TableCell>
                    <TableCell className="text-right text-sm text-red-600">
                      +{formatCurrency(item.lateFeeValue)}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(item.totalValue)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Resumo Financeiro
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Valor Original Total</span>
              <span>{formatCurrency(totals.originalValue)}</span>
            </div>
            <div className="flex justify-between text-sm text-amber-600">
              <span>Total de Juros</span>
              <span>+{formatCurrency(totals.totalInterest)}</span>
            </div>
            <div className="flex justify-between text-sm text-blue-600">
              <span>Total de Correção Monetária</span>
              <span>+{formatCurrency(totals.totalCorrection)}</span>
            </div>
            <div className="flex justify-between text-sm text-red-600">
              <span>Total de Multa Moratória</span>
              <span>+{formatCurrency(totals.totalLateFee)}</span>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between text-lg font-bold">
              <span>Valor Total da Negociação</span>
              <span className="text-primary">{formatCurrency(totals.totalNegotiated)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
