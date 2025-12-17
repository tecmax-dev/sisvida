import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuditLog } from "@/hooks/useAuditLog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  ScrollText, 
  Search,
  RefreshCw,
  Eye,
  LogIn,
  LogOut,
  Building2,
  Users,
  Shield
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: unknown;
  created_at: string;
  user_name?: string;
}

const actionLabels: Record<string, { label: string; icon: typeof Eye; color: string }> = {
  view_clinic: { label: "Visualizou clínica", icon: Eye, color: "bg-info/10 text-info" },
  access_clinic: { label: "Acessou clínica", icon: Building2, color: "bg-primary/10 text-primary" },
  view_clinics_list: { label: "Listou clínicas", icon: Building2, color: "bg-muted text-muted-foreground" },
  view_users_list: { label: "Listou usuários", icon: Users, color: "bg-muted text-muted-foreground" },
  view_audit_logs: { label: "Visualizou logs", icon: ScrollText, color: "bg-muted text-muted-foreground" },
  login: { label: "Login", icon: LogIn, color: "bg-success/10 text-success" },
  logout: { label: "Logout", icon: LogOut, color: "bg-warning/10 text-warning" },
  create_super_admin: { label: "Criou super admin", icon: Shield, color: "bg-success/10 text-success" },
  remove_super_admin: { label: "Removeu super admin", icon: Shield, color: "bg-destructive/10 text-destructive" },
};

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const { logAction } = useAuditLog();

  useEffect(() => {
    fetchLogs();
    logAction({ action: 'view_audit_logs', entityType: 'system' });
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data: logsData, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      if (logsData) {
        // Fetch user names for all unique user_ids
        const userIds = [...new Set(logsData.map(log => log.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, name')
          .in('user_id', userIds);

        const userNameMap = new Map(profiles?.map(p => [p.user_id, p.name]) || []);

        const logsWithNames = logsData.map(log => ({
          ...log,
          user_name: userNameMap.get(log.user_id) || 'Usuário desconhecido',
        }));

        setLogs(logsWithNames);
      }
    } catch (error) {
      console.error("Error fetching audit logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter((log) => {
    const matchesSearch = 
      log.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesEntity = entityFilter === "all" || log.entity_type === entityFilter;
    
    return matchesSearch && matchesEntity;
  });

  const getActionDisplay = (action: string) => {
    const actionInfo = actionLabels[action] || { 
      label: action, 
      icon: Eye, 
      color: "bg-muted text-muted-foreground" 
    };
    const Icon = actionInfo.icon;
    
    return (
      <Badge variant="secondary" className={`${actionInfo.color} gap-1.5`}>
        <Icon className="h-3 w-3" />
        {actionInfo.label}
      </Badge>
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Logs de Auditoria</h1>
          <p className="text-muted-foreground mt-1">
            Histórico de ações realizadas no sistema
          </p>
        </div>
        <Button variant="outline" onClick={fetchLogs} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por usuário ou ação..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={entityFilter} onValueChange={setEntityFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="clinic">Clínica</SelectItem>
                <SelectItem value="user">Usuário</SelectItem>
                <SelectItem value="super_admin">Super Admin</SelectItem>
                <SelectItem value="system">Sistema</SelectItem>
              </SelectContent>
            </Select>
            <Badge variant="secondary" className="text-sm">
              {filteredLogs.length} registro{filteredLogs.length !== 1 ? 's' : ''}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScrollText className="h-5 w-5 text-primary" />
            Registros
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12">
              <ScrollText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {searchTerm || entityFilter !== "all" 
                  ? "Nenhum registro encontrado" 
                  : "Nenhum registro de auditoria ainda"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Detalhes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-xs font-medium text-primary">
                            {log.user_name?.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="text-sm font-medium">{log.user_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{getActionDisplay(log.action)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {log.entity_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                      {log.details ? JSON.stringify(log.details) : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
