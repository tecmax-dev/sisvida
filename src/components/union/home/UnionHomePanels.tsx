import { Link } from "react-router-dom";
import { ChevronRight, AlertCircle, Zap, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useUnionNavCategories } from "@/components/dashboard/useUnionNavCategories";
import { usePendingFiliacoes } from "@/hooks/usePendingFiliacoes";
import { usePendingPayslipReviews } from "@/hooks/usePendingPayslipReviews";

interface Props {
  pendingContributions: number;
  activeNegotiations: number;
  loading: boolean;
}

// Atalhos mais usados; só aparecem se o usuário já tem acesso no menu.
const SHORTCUTS = [
  "/union/socios",
  "/union/empresas",
  "/union/contribuicoes",
  "/union/filiacoes",
  "/union/homologacao",
  "/union/negociacoes",
  "/union/financeiro",
  "/union/relatorios/inadimplencia",
];

export function UnionHomePanels({ pendingContributions, activeNegotiations, loading }: Props) {
  const categories = useUnionNavCategories();
  const items = categories.flatMap((c) => c.items);
  const allowed = new Map(items.map((i) => [i.href, i]));
  const has = (href: string) => allowed.has(href);

  const { count: filiacoes, loading: lf } = usePendingFiliacoes();
  const { count: payslips, loading: lp } = usePendingPayslipReviews();

  const pendings = [
    { label: "Filiações aguardando aprovação", count: filiacoes, href: "/union/filiacoes", loading: lf },
    { label: "Contracheques para analisar", count: payslips, href: "/union/socios/contracheques", loading: lp },
    { label: "Contribuições pendentes ou vencidas", count: pendingContributions, href: "/union/contribuicoes", loading },
    { label: "Negociações em andamento", count: activeNegotiations, href: "/union/negociacoes", loading },
  ].filter((p) => has(p.href));

  const shortcuts = SHORTCUTS.map((h) => allowed.get(h)).filter(Boolean) as typeof items;
  // Se "Empresas" estiver em outra rota, usa o primeiro item da categoria de empresas
  if (!shortcuts.some((s) => s.href.includes("empresa"))) {
    const emp = categories.find((c) => c.id === "empresas")?.items[0];
    if (emp) shortcuts.splice(1, 0, emp);
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
      <Card className="lg:col-span-3">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertCircle className="h-4 w-4 text-warning" /> Pendências
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {pendings.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma pendência disponível para o seu acesso.</p>}
          {pendings.map((p) => (
            <Link
              key={p.href}
              to={p.href}
              className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted"
            >
              <span className="flex items-center gap-2 text-sm">
                {p.count > 0 ? <AlertCircle className="h-4 w-4 text-warning" /> : <CheckCircle2 className="h-4 w-4 text-success" />}
                {p.label}
              </span>
              <span className="flex items-center gap-2">
                {p.loading ? <Skeleton className="h-5 w-8" /> : (
                  <Badge variant={p.count > 0 ? "warning" : "success"}>{p.count.toLocaleString("pt-BR")}</Badge>
                )}
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </span>
            </Link>
          ))}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="h-4 w-4 text-primary" /> Ações rápidas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {shortcuts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum atalho disponível.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {shortcuts.slice(0, 8).map((s) => (
                <Link
                  key={s.href}
                  to={s.href}
                  className="flex items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-sm transition-colors hover:border-primary/30 hover:bg-primary/5"
                >
                  <s.icon className="h-4 w-4 shrink-0 text-primary" />
                  <span className="truncate">{s.label}</span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
