import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { History, Search, Filter, FileText, User, Clock, ChevronDown, ChevronRight, Eye } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";

interface AuditLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  old_data: any;
  new_data: any;
  performed_by: string;
  performed_at: string;
  ip_address?: string;
}

interface BudgetAuditTabProps {
  exerciseId?: string;
  clinicId?: string;
}

const actionLabels: Record<string, string> = {
  create: 'Criação',
  update: 'Atualização',
  delete: 'Exclusão',
  approve: 'Aprovação',
  reject: 'Rejeição',
  submit: 'Envio para Aprovação',
  replan: 'Replanejamento',
};

const actionColors: Record<string, string> = {
  create: 'bg-green-100 text-green-800',
  update: 'bg-blue-100 text-blue-800',
  delete: 'bg-red-100 text-red-800',
  approve: 'bg-emerald-100 text-emerald-800',
  reject: 'bg-orange-100 text-orange-800',
  submit: 'bg-purple-100 text-purple-800',
  replan: 'bg-yellow-100 text-yellow-800',
};

const entityLabels: Record<string, string> = {
  exercise: 'Exercício',
  union_budget_exercises: 'Exercício',
  revenue: 'Receita',
  union_budget_revenues: 'Receita',
  expense: 'Despesa',
  union_budget_expenses: 'Despesa',
  version: 'Versão',
  union_budget_versions: 'Versão',
  approver: 'Aprovador',
  alert: 'Alerta',
};

const fieldLabels: Record<string, string> = {
  name: 'Nome',
  description: 'Descrição',
  status: 'Status',
  month_01: 'Janeiro', month_02: 'Fevereiro', month_03: 'Março',
  month_04: 'Abril', month_05: 'Maio', month_06: 'Junho',
  month_07: 'Julho', month_08: 'Agosto', month_09: 'Setembro',
  month_10: 'Outubro', month_11: 'Novembro', month_12: 'Dezembro',
  total_amount: 'Total',
  revenue_type: 'Tipo de Receita',
  expense_type: 'Tipo de Despesa',
  expense_nature: 'Natureza',
  is_recurring: 'Recorrente',
  growth_rate_revenue: 'Cresc. Receitas',
  growth_rate_expense: 'Cresc. Despesas',
  inflation_rate: 'Inflação',
  approved_at: 'Aprovado em',
  closed_at: 'Encerrado em',
};

function formatValue(value: any): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (typeof value === 'number') {
    if (value >= 100 || value <= -100) {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    }
    return value.toString();
  }
  return String(value);
}

function getChangedFields(oldData: any, newData: any): Array<{ field: string; oldValue: any; newValue: any }> {
  if (!oldData || !newData) return [];
  const changes: Array<{ field: string; oldValue: any; newValue: any }> = [];
  const ignoredFields = ['updated_at', 'created_at', 'id', 'clinic_id', 'budget_version_id', 'budget_exercise_id'];
  
  const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
  allKeys.forEach((key) => {
    if (ignoredFields.includes(key)) return;
    const oldVal = oldData[key];
    const newVal = newData[key];
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes.push({ field: key, oldValue: oldVal, newValue: newVal });
    }
  });
  return changes;
}

export function BudgetAuditTab({ exerciseId, clinicId }: BudgetAuditTabProps) {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState<string>('all');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchAuditLogs = async () => {
      if (!exerciseId || !clinicId) { setLoading(false); return; }
      try {
        const { data, error } = await (supabase as any)
          .from('union_budget_audit_logs')
          .select('*')
          .eq('budget_exercise_id', exerciseId)
          .eq('clinic_id', clinicId)
          .order('performed_at', { ascending: false })
          .limit(200);
        if (error) throw error;
        setAuditLogs(data || []);

        // Resolve user names
        const userIds: string[] = [...new Set((data || []).map((l: AuditLog) => l.performed_by).filter(Boolean))] as string[];
        if (userIds.length > 0) {
          const { data: profiles } = await (supabase as any)
            .from('profiles')
            .select('id, full_name, email')
            .in('id', userIds);

          const names: Record<string, string> = {};
          (profiles || []).forEach((p: any) => {
            names[p.id] = p.full_name || p.email || p.id.substring(0, 8);
          });
          setUserNames(names);
        }
      } catch (error) {
        console.error('Error fetching audit logs:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchAuditLogs();
  }, [exerciseId, clinicId]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const filteredLogs = auditLogs.filter((log) => {
    const matchesSearch = searchTerm === '' ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.entity_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (userNames[log.performed_by] || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterAction === 'all' || log.action === filterAction;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Histórico de Auditoria</h3>
          <p className="text-sm text-muted-foreground">
            Registro imutável de todas as alterações no orçamento
          </p>
        </div>
        <Badge variant="outline">{filteredLogs.length} registro(s)</Badge>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por ação, entidade ou usuário..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
            </div>
            <Select value={filterAction} onValueChange={setFilterAction}>
              <SelectTrigger className="w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filtrar por ação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as ações</SelectItem>
                <SelectItem value="create">Criação</SelectItem>
                <SelectItem value="update">Atualização</SelectItem>
                <SelectItem value="delete">Exclusão</SelectItem>
                <SelectItem value="approve">Aprovação</SelectItem>
                <SelectItem value="reject">Rejeição</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Audit Log Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" />
            Linha do Tempo
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum registro de auditoria</p>
              <p className="text-sm">As alterações no orçamento serão registradas aqui</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLogs.map((log) => {
                const isExpanded = expandedIds.has(log.id);
                const changes = getChangedFields(log.old_data, log.new_data);
                const hasDetails = log.new_data || log.old_data;
                const userName = userNames[log.performed_by] || log.performed_by?.substring(0, 8) || 'Sistema';
                const entityName = log.new_data?.name || log.new_data?.description || log.old_data?.name || log.old_data?.description || '';

                return (
                  <div key={log.id} className="border rounded-lg overflow-hidden">
                    <div
                      className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => hasDetails && toggleExpand(log.id)}
                    >
                      {hasDetails ? (
                        isExpanded ? <ChevronDown className="h-4 w-4 flex-shrink-0" /> : <ChevronRight className="h-4 w-4 flex-shrink-0" />
                      ) : <div className="w-4" />}

                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Badge className={`text-xs ${actionColors[log.action] || 'bg-gray-100 text-gray-800'}`}>
                          {actionLabels[log.action] || log.action}
                        </Badge>
                        <span className="text-sm font-medium">{entityLabels[log.entity_type] || log.entity_type}</span>
                        {entityName && <span className="text-sm text-muted-foreground truncate">"{entityName}"</span>}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-shrink-0">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {userName}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(log.performed_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                    </div>

                    {isExpanded && hasDetails && (
                      <div className="border-t bg-muted/30 p-3">
                        {log.action === 'update' && changes.length > 0 ? (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase">Campos Alterados</p>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-xs">Campo</TableHead>
                                  <TableHead className="text-xs">Valor Anterior</TableHead>
                                  <TableHead className="text-xs">Novo Valor</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {changes.map((change, idx) => (
                                  <TableRow key={idx}>
                                    <TableCell className="text-sm font-medium">{fieldLabels[change.field] || change.field}</TableCell>
                                    <TableCell className="text-sm text-red-600">{formatValue(change.oldValue)}</TableCell>
                                    <TableCell className="text-sm text-green-600">{formatValue(change.newValue)}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        ) : log.action === 'create' && log.new_data ? (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase">Dados Criados</p>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                              {Object.entries(log.new_data)
                                .filter(([k]) => !['id', 'clinic_id', 'budget_version_id', 'budget_exercise_id', 'created_at', 'updated_at', 'created_by'].includes(k))
                                .slice(0, 12)
                                .map(([key, value]) => (
                                  <div key={key} className="bg-background p-2 rounded">
                                    <span className="text-xs text-muted-foreground">{fieldLabels[key] || key}</span>
                                    <p className="font-medium truncate">{formatValue(value)}</p>
                                  </div>
                                ))}
                            </div>
                          </div>
                        ) : log.action === 'delete' && log.old_data ? (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase">Dados Excluídos</p>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                              {Object.entries(log.old_data)
                                .filter(([k]) => !['id', 'clinic_id', 'budget_version_id', 'budget_exercise_id', 'created_at', 'updated_at', 'created_by'].includes(k))
                                .slice(0, 12)
                                .map(([key, value]) => (
                                  <div key={key} className="bg-background p-2 rounded">
                                    <span className="text-xs text-muted-foreground">{fieldLabels[key] || key}</span>
                                    <p className="font-medium truncate line-through text-red-600">{formatValue(value)}</p>
                                  </div>
                                ))}
                            </div>
                          </div>
                        ) : (
                          <pre className="text-xs whitespace-pre-wrap max-h-40 overflow-auto">
                            {JSON.stringify(log.new_data || log.old_data, null, 2)}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
