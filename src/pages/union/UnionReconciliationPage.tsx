import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Search,
  XCircle,
  AlertCircle,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Contribution {
  id: string;
  employer_id: string;
  value: number;
  status: string;
  paid_at: string | null;
  paid_value: number | null;
  lytex_invoice_id: string | null;
  lytex_invoice_url: string | null;
  has_divergence: boolean | null;
  is_reconciled: boolean | null;
  reconciled_at: string | null;
  competence_month: number;
  competence_year: number;
  employers?: { name: string; cnpj: string };
  contribution_types?: { name: string };
}

export default function UnionReconciliationPage() {
  const { currentClinic, session } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [divergenceFilter, setDivergenceFilter] = useState<string>("all");
  const clinicId = currentClinic?.id;

  // Fetch contributions with Lytex integration
  const { data: contributions, isLoading } = useQuery({
    queryKey: ["union-reconciliation", clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employer_contributions")
        .select(`
          id, employer_id, value, status, paid_at, paid_value,
          lytex_invoice_id, lytex_invoice_url, has_divergence, 
          is_reconciled, reconciled_at, competence_month, competence_year,
          employers(name, cnpj),
          contribution_types(name)
        `)
        .eq("clinic_id", clinicId!)
        .not("lytex_invoice_id", "is", null)
        .order("competence_year", { ascending: false })
        .order("competence_month", { ascending: false })
        .limit(500);

      if (error) throw error;
      return data as Contribution[];
    },
    enabled: !!clinicId,
  });

  // Sync mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("lytex-api", {
        body: { action: "sync_all_pending", clinicId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["union-reconciliation"] });
      toast.success(`Sincronização concluída! ${data?.updated || 0} registro(s) atualizado(s).`);
    },
    onError: (error: Error) => {
      toast.error(`Erro na sincronização: ${error.message}`);
    },
  });

  // Reconcile single contribution
  const reconcileMutation = useMutation({
    mutationFn: async (contributionId: string) => {
      const { error } = await supabase
        .from("employer_contributions")
        .update({
          is_reconciled: true,
          reconciled_at: new Date().toISOString(),
          reconciled_by: session?.user?.id,
          has_divergence: false,
        })
        .eq("id", contributionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["union-reconciliation"] });
      toast.success("Contribuição conciliada!");
    },
    onError: () => {
      toast.error("Erro ao conciliar contribuição");
    },
  });

  // Reconcile in batch - all pending paid contributions
  const reconcileBatchMutation = useMutation({
    mutationFn: async (contributionIds: string[]) => {
      const { error } = await supabase
        .from("employer_contributions")
        .update({
          is_reconciled: true,
          reconciled_at: new Date().toISOString(),
          reconciled_by: session?.user?.id,
          has_divergence: false,
        })
        .in("id", contributionIds);
      if (error) throw error;
      return contributionIds.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["union-reconciliation"] });
      toast.success(`${count} contribuição(ões) conciliada(s) com sucesso!`);
    },
    onError: () => {
      toast.error("Erro ao conciliar contribuições em lote");
    },
  });

  // Get IDs of contributions pending reconciliation
  const pendingReconciliationIds = useMemo(() => {
    if (!contributions) return [];
    return contributions
      .filter((c) => !c.is_reconciled && c.status === "paid")
      .map((c) => c.id);
  }, [contributions]);

  const handleBatchReconcile = () => {
    if (pendingReconciliationIds.length === 0) {
      toast.info("Não há contribuições pendentes de conciliação.");
      return;
    }
    reconcileBatchMutation.mutate(pendingReconciliationIds);
  };

  // Filter contributions
  const filteredContributions = useMemo(() => {
    if (!contributions) return [];
    return contributions.filter((c) => {
      const matchesSearch =
        c.employers?.name?.toLowerCase().includes(search.toLowerCase()) ||
        c.employers?.cnpj?.includes(search) ||
        c.lytex_invoice_id?.toLowerCase().includes(search.toLowerCase());

      const matchesStatus = statusFilter === "all" || c.status === statusFilter;

      const matchesDivergence =
        divergenceFilter === "all" ||
        (divergenceFilter === "divergent" && c.has_divergence) ||
        (divergenceFilter === "reconciled" && c.is_reconciled) ||
        (divergenceFilter === "pending_reconciliation" && !c.is_reconciled && c.status === "paid");

      return matchesSearch && matchesStatus && matchesDivergence;
    });
  }, [contributions, search, statusFilter, divergenceFilter]);

  // Stats
  const stats = useMemo(() => {
    if (!contributions) return { total: 0, reconciled: 0, divergent: 0, pendingReconciliation: 0 };
    return {
      total: contributions.length,
      reconciled: contributions.filter((c) => c.is_reconciled).length,
      divergent: contributions.filter((c) => c.has_divergence).length,
      pendingReconciliation: contributions.filter((c) => !c.is_reconciled && c.status === "paid").length,
    };
  }, [contributions]);

  const formatCurrency = (cents: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge className="bg-emerald-100 text-emerald-800">Pago</Badge>;
      case "pending":
        return <Badge className="bg-amber-100 text-amber-800">Pendente</Badge>;
      case "overdue":
        return <Badge className="bg-rose-100 text-rose-800">Vencido</Badge>;
      case "cancelled":
        return <Badge className="bg-slate-100 text-slate-800">Cancelado</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (!clinicId) return null;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Conciliação Lytex</h1>
          <p className="text-muted-foreground">
            Verifique e concilie divergências entre o sistema e a Lytex
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleBatchReconcile}
            disabled={reconcileBatchMutation.isPending || pendingReconciliationIds.length === 0}
          >
            {reconcileBatchMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mr-2" />
            )}
            Conciliar Todos ({pendingReconciliationIds.length})
          </Button>
          <Button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
          >
            {syncMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Sincronizar com Lytex
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-muted-foreground">
              <ExternalLink className="h-4 w-4 text-blue-500" />
              <span className="text-sm">Total com Lytex</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.total}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span className="text-sm">Conciliados</span>
            </div>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.reconciled}</p>
          </CardContent>
        </Card>

        <Card className={stats.divergent > 0 ? "border-rose-200 bg-rose-50/30" : ""}>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-muted-foreground">
              <AlertTriangle className="h-4 w-4 text-rose-500" />
              <span className="text-sm">Com Divergência</span>
            </div>
            <p className="text-2xl font-bold text-rose-600 mt-1">{stats.divergent}</p>
          </CardContent>
        </Card>

        <Card className={stats.pendingReconciliation > 0 ? "border-amber-200 bg-amber-50/30" : ""}>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-muted-foreground">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              <span className="text-sm">Aguardando Conciliação</span>
            </div>
            <p className="text-2xl font-bold text-amber-600 mt-1">{stats.pendingReconciliation}</p>
          </CardContent>
        </Card>
      </div>

      {stats.divergent > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Existem {stats.divergent} contribuição(ões) com divergência entre o sistema e a Lytex.
            Verifique e corrija manualmente.
          </AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por empresa, CNPJ ou ID Lytex..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Status</SelectItem>
            <SelectItem value="paid">Pago</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="overdue">Vencido</SelectItem>
          </SelectContent>
        </Select>
        <Select value={divergenceFilter} onValueChange={setDivergenceFilter}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Conciliação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="reconciled">Conciliados</SelectItem>
            <SelectItem value="divergent">Com Divergência</SelectItem>
            <SelectItem value="pending_reconciliation">Aguardando Conciliação</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Competência</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data Pgto.</TableHead>
                <TableHead>Conciliação</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContributions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhuma contribuição encontrada
                  </TableCell>
                </TableRow>
              ) : (
                filteredContributions.map((c) => (
                  <TableRow key={c.id} className={c.has_divergence ? "bg-rose-50/50" : ""}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{c.employers?.name || "—"}</p>
                        <p className="text-xs text-muted-foreground">{c.employers?.cnpj || "—"}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {String(c.competence_month).padStart(2, "0")}/{c.competence_year}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{formatCurrency(c.value)}</p>
                        {c.paid_value && c.paid_value !== c.value && (
                          <p className="text-xs text-emerald-600">
                            Pago: {formatCurrency(c.paid_value)}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(c.status)}</TableCell>
                    <TableCell>
                      {c.paid_at ? format(new Date(c.paid_at), "dd/MM/yyyy") : "—"}
                    </TableCell>
                    <TableCell>
                      {c.is_reconciled ? (
                        <Badge className="bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Conciliado
                        </Badge>
                      ) : c.has_divergence ? (
                        <Badge className="bg-rose-100 text-rose-800">
                          <XCircle className="h-3 w-3 mr-1" />
                          Divergente
                        </Badge>
                      ) : c.status === "paid" ? (
                        <Badge className="bg-amber-100 text-amber-800">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Pendente
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        {c.lytex_invoice_url && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(c.lytex_invoice_url!, "_blank")}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        )}
                        {c.status === "paid" && !c.is_reconciled && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => reconcileMutation.mutate(c.id)}
                            disabled={reconcileMutation.isPending}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Conciliar
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
