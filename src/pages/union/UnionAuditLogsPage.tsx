import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUnionPermissions } from "@/hooks/useUnionPermissions";
import { SINDICATO_CLINIC_ID } from "@/constants/sindicato";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ScrollText,
  Search,
  RefreshCw,
  Eye,
  ShieldAlert,
  Filter,
  Download,
} from "lucide-react";

interface ActivityLogRow {
  id: string;
  source: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  actor_user_id: string | null;
  actor_name: string | null;
  old_data: unknown;
  new_data: unknown;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

const ACTION_LABELS: Record<string, string> = {
  user_role_created: "Papel de usuário criado",
  user_role_updated: "Papel de usuário atualizado",
  user_role_removed: "Papel de usuário removido",
  profile_created: "Perfil criado",
  profile_updated: "Perfil atualizado",
  profile_deleted: "Perfil excluído",
  access_group_created: "Grupo de acesso criado",
  access_group_updated: "Grupo de acesso alterado",
  access_group_deleted: "Grupo de acesso removido",
  permission_granted: "Permissão concedida",
  permission_revoked: "Permissão revogada",
  permission_changed: "Permissão alterada",
  INSERT: "Criado",
  UPDATE: "Atualizado",
  DELETE: "Removido",
  create: "Criado",
  update: "Atualizado",
  delete: "Removido",
};

const ENTITY_LABELS: Record<string, string> = {
  user_role: "Cadastro de Usuário",
  user_profile: "Perfil de Usuário",
  access_group: "Grupo de Acesso",
  access_group_permission: "Permissão de Grupo",
  member: "Sócio",
  contribution: "Contribuição",
  transaction: "Financeiro",
  expense: "Despesa",
  income: "Receita",
  budget_exercise: "Orçamento",
  budget_expense: "Despesa Orçamentária",
  budget_revenue: "Receita Orçamentária",
  legal_case: "Processo Jurídico",
  legal_deadline: "Prazo Jurídico",
  legal_expense: "Despesa Jurídica",
};

const SOURCE_LABELS: Record<string, string> = {
  union_audit_logs: "Sistema",
  union_member_audit_logs: "Sócios",
  financial_audit_logs: "Financeiro",
  contribution_audit_logs: "Contribuições",
  union_budget_audit_logs: "Orçamento",
  union_legal_audit_logs: "Jurídico",
  audit_logs: "Administração",
  union_share_logs: "Compartilhamento WhatsApp",
  member_portal_logs: "Portal do Sócio",
  employer_portal_logs: "Portal Empregador",
  accounting_office_portal_logs: "Portal Contábil",
  homologacao_notification_logs: "Homologação",
  union_bank_statement_imports: "Extrato Bancário",
  attachment_access_logs: "Acesso a Anexos",
};

function friendlyAction(action: string) {
  return ACTION_LABELS[action] || action.replace(/_/g, " ");
}
function friendlyEntity(entity: string) {
  return ENTITY_LABELS[entity] || entity.replace(/_/g, " ");
}
function friendlySource(source: string) {
  return SOURCE_LABELS[source] || source;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function daysAgoISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export default function UnionAuditLogsPage() {
  const { currentClinic } = useAuth();
  const { canViewAudit, permissionsLoading } = useUnionPermissions();
  const clinicId = currentClinic?.id || SINDICATO_CLINIC_ID;

  const [dateFrom, setDateFrom] = useState<string>(daysAgoISO(7));
  const [dateTo, setDateTo] = useState<string>(todayISO());
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [selected, setSelected] = useState<ActivityLogRow | null>(null);

  const filters = useMemo(
    () => ({
      p_clinic_id: clinicId,
      p_from: new Date(dateFrom + "T00:00:00").toISOString(),
      p_to: new Date(dateTo + "T23:59:59").toISOString(),
      p_entity_type: entityFilter === "all" ? null : entityFilter,
      p_search: search || null,
      p_limit: 500,
      p_offset: 0,
    }),
    [clinicId, dateFrom, dateTo, entityFilter, search],
  );

  const { data, isFetching, refetch, error } = useQuery({
    queryKey: ["union-activity-log", filters],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)(
        "get_union_activity_log",
        filters,
      );
      if (error) throw error;
      return (data ?? []) as ActivityLogRow[];
    },
    enabled: !!clinicId && canViewAudit(),
  });

  const filteredRows = useMemo(() => {
    if (!data) return [];
    if (sourceFilter === "all") return data;
    return data.filter((r) => r.source === sourceFilter);
  }, [data, sourceFilter]);

  const uniqueEntities = useMemo(() => {
    const s = new Set<string>();
    data?.forEach((r) => s.add(r.entity_type));
    return Array.from(s).sort();
  }, [data]);

  const exportCSV = () => {
    if (!filteredRows.length) return;
    const header = [
      "Data/Hora",
      "Origem",
      "Ação",
      "Módulo",
      "Usuário",
      "Entidade ID",
      "IP",
    ];
    const rows = filteredRows.map((r) => [
      format(new Date(r.created_at), "dd/MM/yyyy HH:mm:ss"),
      friendlySource(r.source),
      friendlyAction(r.action),
      friendlyEntity(r.entity_type),
      r.actor_name || "-",
      r.entity_id || "",
      r.ip_address || "",
    ]);
    const csv = [header, ...rows]
      .map((cols) => cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `auditoria-sindicato-${todayISO()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (permissionsLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!canViewAudit()) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-10 text-center space-y-3">
            <ShieldAlert className="h-12 w-12 text-destructive mx-auto" />
            <h2 className="text-lg font-semibold">Acesso restrito</h2>
            <p className="text-muted-foreground">
              Você não possui a permissão <strong>Visualizar Auditoria</strong>.
              Solicite ao administrador da entidade sindical para liberar o acesso
              no grupo de permissões.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ScrollText className="h-6 w-6 text-primary" />
            Auditoria do Sindicato
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Histórico completo de ações realizadas no módulo sindical — usuários,
            permissões, sócios, contribuições, financeiro, orçamento e jurídico.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCSV} disabled={!filteredRows.length}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <div className="md:col-span-1">
              <label className="text-xs text-muted-foreground">De</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="md:col-span-1">
              <label className="text-xs text-muted-foreground">Até</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <div className="md:col-span-1">
              <label className="text-xs text-muted-foreground">Origem</label>
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {Object.entries(SOURCE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-1">
              <label className="text-xs text-muted-foreground">Entidade</label>
              <Select value={entityFilter} onValueChange={setEntityFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {uniqueEntities.map((e) => (
                    <SelectItem key={e} value={e}>{friendlyEntity(e)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-muted-foreground">Busca</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Usuário, ação ou entidade..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">
            Registros{" "}
            <Badge variant="secondary" className="ml-2">
              {filteredRows.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="text-center py-10 text-destructive text-sm">
              Erro ao carregar auditoria: {(error as Error).message}
            </div>
          ) : isFetching && !data ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhum registro encontrado para os filtros aplicados.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Data/Hora</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Módulo</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead className="text-right">Detalhes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.map((r) => (
                    <TableRow key={`${r.source}-${r.id}`}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(r.created_at), "dd/MM/yyyy HH:mm:ss", {
                          locale: ptBR,
                        })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <span className="text-xs font-semibold text-primary">
                              {(r.actor_name || "S").charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <span className="text-sm font-medium">
                            {r.actor_name || "Sistema"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{friendlyAction(r.action)}</Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{friendlyEntity(r.entity_type)}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{friendlySource(r.source)}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelected(r)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de detalhes */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {selected ? friendlyAction(selected.action) : "Detalhes"}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground">Data/Hora</div>
                  <div className="font-medium">
                    {format(new Date(selected.created_at), "dd/MM/yyyy HH:mm:ss", {
                      locale: ptBR,
                    })}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Usuário</div>
                  <div className="font-medium">{selected.actor_name || "Sistema"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Módulo</div>
                  <div className="font-medium">{friendlyEntity(selected.entity_type)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Origem</div>
                  <div className="font-medium">{friendlySource(selected.source)}</div>
                </div>
                {selected.entity_id && (
                  <div className="col-span-2">
                    <div className="text-xs text-muted-foreground">ID da entidade</div>
                    <div className="font-mono text-xs">{selected.entity_id}</div>
                  </div>
                )}
                {selected.ip_address && (
                  <div>
                    <div className="text-xs text-muted-foreground">IP</div>
                    <div className="font-mono text-xs">{selected.ip_address}</div>
                  </div>
                )}
              </div>
              {selected.old_data ? (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Valores anteriores</div>
                  <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-64">
                    {JSON.stringify(selected.old_data, null, 2)}
                  </pre>
                </div>
              ) : null}
              {selected.new_data ? (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Novos valores</div>
                  <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-64">
                    {JSON.stringify(selected.new_data, null, 2)}
                  </pre>
                </div>
              ) : null}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}