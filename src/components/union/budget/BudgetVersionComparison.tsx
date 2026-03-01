import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GitCompare, ArrowRight, TrendingUp, TrendingDown, Equal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BudgetVersion, BudgetRevenue, BudgetExpense, monthNames, revenueTypeLabels, expenseTypeLabels } from "@/types/unionBudget";

interface BudgetVersionComparisonProps {
  versions: BudgetVersion[];
  currentVersion?: BudgetVersion;
  exerciseId?: string;
}

const db = supabase as any;

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export function BudgetVersionComparison({
  versions,
  currentVersion,
  exerciseId,
}: BudgetVersionComparisonProps) {
  const [versionAId, setVersionAId] = useState<string>("");
  const [versionBId, setVersionBId] = useState<string>("");
  const [dataA, setDataA] = useState<{ revenues: BudgetRevenue[]; expenses: BudgetExpense[] } | null>(null);
  const [dataB, setDataB] = useState<{ revenues: BudgetRevenue[]; expenses: BudgetExpense[] } | null>(null);
  const [loading, setLoading] = useState(false);

  // Auto-select versions
  useEffect(() => {
    if (versions.length >= 2 && !versionAId && !versionBId) {
      setVersionAId(versions[1].id); // older
      setVersionBId(versions[0].id); // newer (current)
    }
  }, [versions]);

  // Fetch data for selected versions
  useEffect(() => {
    const fetchVersionData = async (versionId: string) => {
      const [revRes, expRes] = await Promise.all([
        db.from("union_budget_revenues").select("*").eq("budget_version_id", versionId),
        db.from("union_budget_expenses").select("*").eq("budget_version_id", versionId),
      ]);
      return {
        revenues: (revRes.data || []) as BudgetRevenue[],
        expenses: (expRes.data || []) as BudgetExpense[],
      };
    };

    if (versionAId && versionBId) {
      setLoading(true);
      Promise.all([fetchVersionData(versionAId), fetchVersionData(versionBId)])
        .then(([a, b]) => {
          setDataA(a);
          setDataB(b);
        })
        .finally(() => setLoading(false));
    }
  }, [versionAId, versionBId]);

  const comparison = useMemo(() => {
    if (!dataA || !dataB) return null;

    const totalRevA = dataA.revenues.reduce((s, r) => s + (r.total_amount || 0), 0);
    const totalRevB = dataB.revenues.reduce((s, r) => s + (r.total_amount || 0), 0);
    const totalExpA = dataA.expenses.reduce((s, e) => s + (e.total_amount || 0), 0);
    const totalExpB = dataB.expenses.reduce((s, e) => s + (e.total_amount || 0), 0);

    // Map items by description for comparison
    const allRevDescriptions = new Set([
      ...dataA.revenues.map((r) => r.description),
      ...dataB.revenues.map((r) => r.description),
    ]);
    const allExpDescriptions = new Set([
      ...dataA.expenses.map((e) => e.description),
      ...dataB.expenses.map((e) => e.description),
    ]);

    const revenueComparison = Array.from(allRevDescriptions).map((desc) => {
      const itemA = dataA.revenues.find((r) => r.description === desc);
      const itemB = dataB.revenues.find((r) => r.description === desc);
      const valA = itemA?.total_amount || 0;
      const valB = itemB?.total_amount || 0;
      return { description: desc, valueA: valA, valueB: valB, diff: valB - valA, status: !itemA ? "added" as const : !itemB ? "removed" as const : valA !== valB ? "changed" as const : "unchanged" as const };
    });

    const expenseComparison = Array.from(allExpDescriptions).map((desc) => {
      const itemA = dataA.expenses.find((e) => e.description === desc);
      const itemB = dataB.expenses.find((e) => e.description === desc);
      const valA = itemA?.total_amount || 0;
      const valB = itemB?.total_amount || 0;
      return { description: desc, valueA: valA, valueB: valB, diff: valB - valA, status: !itemA ? "added" as const : !itemB ? "removed" as const : valA !== valB ? "changed" as const : "unchanged" as const };
    });

    return {
      totalRevA, totalRevB, totalExpA, totalExpB,
      resultA: totalRevA - totalExpA,
      resultB: totalRevB - totalExpB,
      revenueComparison: revenueComparison.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)),
      expenseComparison: expenseComparison.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)),
    };
  }, [dataA, dataB]);

  if (versions.length < 2) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground py-8">
            <GitCompare className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>É necessário pelo menos 2 versões para comparar</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const versionA = versions.find((v) => v.id === versionAId);
  const versionB = versions.find((v) => v.id === versionBId);

  const statusBadge = (status: string) => {
    switch (status) {
      case "added": return <Badge className="bg-green-100 text-green-800 text-xs">Novo</Badge>;
      case "removed": return <Badge className="bg-red-100 text-red-800 text-xs">Removido</Badge>;
      case "changed": return <Badge className="bg-yellow-100 text-yellow-800 text-xs">Alterado</Badge>;
      default: return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Version Selectors */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-1 block">Versão A (Base)</label>
              <Select value={versionAId} onValueChange={setVersionAId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar versão" />
                </SelectTrigger>
                <SelectContent>
                  {versions.map((v) => (
                    <SelectItem key={v.id} value={v.id} disabled={v.id === versionBId}>
                      V{v.version_number} {v.version_name ? `- ${v.version_name}` : ""} {v.is_current ? "(Atual)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground mt-6" />
            <div className="flex-1">
              <label className="text-sm font-medium mb-1 block">Versão B (Comparar)</label>
              <Select value={versionBId} onValueChange={setVersionBId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar versão" />
                </SelectTrigger>
                <SelectContent>
                  {versions.map((v) => (
                    <SelectItem key={v.id} value={v.id} disabled={v.id === versionAId}>
                      V{v.version_number} {v.version_name ? `- ${v.version_name}` : ""} {v.is_current ? "(Atual)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading && <p className="text-center text-muted-foreground py-8">Carregando...</p>}

      {comparison && !loading && (
        <>
          {/* Summary Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: "Receitas", a: comparison.totalRevA, b: comparison.totalRevB },
              { label: "Despesas", a: comparison.totalExpA, b: comparison.totalExpB },
              { label: "Resultado", a: comparison.resultA, b: comparison.resultB },
            ].map((item) => {
              const diff = item.b - item.a;
              const pct = item.a > 0 ? ((diff / item.a) * 100).toFixed(1) : "N/A";
              return (
                <Card key={item.label}>
                  <CardContent className="pt-4 pb-3">
                    <p className="text-xs text-muted-foreground mb-2">{item.label}</p>
                    <div className="flex justify-between text-sm">
                      <span>V{versionA?.version_number}: {formatCurrency(item.a)}</span>
                      <span>V{versionB?.version_number}: {formatCurrency(item.b)}</span>
                    </div>
                    <div className={`text-center mt-2 font-medium text-sm ${diff > 0 ? "text-green-600" : diff < 0 ? "text-red-600" : "text-muted-foreground"}`}>
                      {diff > 0 ? "+" : ""}{formatCurrency(diff)} ({pct}%)
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Revenue Comparison Table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Comparativo de Receitas</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">V{versionA?.version_number}</TableHead>
                    <TableHead className="text-right">V{versionB?.version_number}</TableHead>
                    <TableHead className="text-right">Diferença</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comparison.revenueComparison.filter((r) => r.status !== "unchanged").map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{item.description}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.valueA)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.valueB)}</TableCell>
                      <TableCell className={`text-right font-medium ${item.diff > 0 ? "text-green-600" : item.diff < 0 ? "text-red-600" : ""}`}>
                        {item.diff > 0 ? "+" : ""}{formatCurrency(item.diff)}
                      </TableCell>
                      <TableCell className="text-center">{statusBadge(item.status)}</TableCell>
                    </TableRow>
                  ))}
                  {comparison.revenueComparison.filter((r) => r.status !== "unchanged").length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-4">Nenhuma alteração nas receitas</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Expense Comparison Table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Comparativo de Despesas</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">V{versionA?.version_number}</TableHead>
                    <TableHead className="text-right">V{versionB?.version_number}</TableHead>
                    <TableHead className="text-right">Diferença</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comparison.expenseComparison.filter((e) => e.status !== "unchanged").map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{item.description}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.valueA)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.valueB)}</TableCell>
                      <TableCell className={`text-right font-medium ${item.diff > 0 ? "text-red-600" : item.diff < 0 ? "text-green-600" : ""}`}>
                        {item.diff > 0 ? "+" : ""}{formatCurrency(item.diff)}
                      </TableCell>
                      <TableCell className="text-center">{statusBadge(item.status)}</TableCell>
                    </TableRow>
                  ))}
                  {comparison.expenseComparison.filter((e) => e.status !== "unchanged").length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-4">Nenhuma alteração nas despesas</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
