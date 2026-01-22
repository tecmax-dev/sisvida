import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { History, Search, Filter, FileText, User, Clock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";

interface AuditLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  previous_data: any;
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
  revenue: 'Receita',
  expense: 'Despesa',
  version: 'Versão',
  approver: 'Aprovador',
  alert: 'Alerta',
};

export function BudgetAuditTab({
  exerciseId,
  clinicId,
}: BudgetAuditTabProps) {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState<string>('all');

  useEffect(() => {
    const fetchAuditLogs = async () => {
      if (!exerciseId || !clinicId) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await (supabase as any)
          .from('union_budget_audit_logs')
          .select('*')
          .eq('exercise_id', exerciseId)
          .eq('clinic_id', clinicId)
          .order('performed_at', { ascending: false })
          .limit(100);

        if (error) throw error;
        setAuditLogs(data || []);
      } catch (error) {
        console.error('Error fetching audit logs:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAuditLogs();
  }, [exerciseId, clinicId]);

  const filteredLogs = auditLogs.filter((log) => {
    const matchesSearch = searchTerm === '' || 
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.entity_type.toLowerCase().includes(searchTerm.toLowerCase());
    
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
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar no histórico..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
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

      {/* Audit Log Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" />
            Registros de Auditoria
          </CardTitle>
          <CardDescription>
            {filteredLogs.length} registro(s) encontrado(s)
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Entidade</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Detalhes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhum registro de auditoria</p>
                    <p className="text-sm">As alterações no orçamento serão registradas aqui</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        {format(new Date(log.performed_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={actionColors[log.action] || 'bg-gray-100 text-gray-800'}>
                        {actionLabels[log.action] || log.action}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {entityLabels[log.entity_type] || log.entity_type}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{log.performed_by || 'Sistema'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {log.new_data ? JSON.stringify(log.new_data).substring(0, 50) + '...' : '-'}
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
