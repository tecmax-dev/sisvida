import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  History, 
  RefreshCw, 
  Trash2, 
  FileSpreadsheet,
  Users,
  ClipboardList,
  Phone,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle
} from "lucide-react";
import { toast } from "sonner";

interface ImportLog {
  id: string;
  clinic_id: string;
  import_type: string;
  file_name: string | null;
  total_rows: number;
  success_count: number;
  error_count: number;
  status: string;
  error_details: any;
  created_by: string | null;
  created_at: string;
  completed_at: string | null;
  clinic?: { name: string };
}

interface ImportHistoryPanelProps {
  clinicId?: string;
}

export function ImportHistoryPanel({ clinicId }: ImportHistoryPanelProps) {
  const [logs, setLogs] = useState<ImportLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("import_logs")
        .select("*, clinic:clinics(name)")
        .order("created_at", { ascending: false })
        .limit(50);

      if (clinicId) {
        query = query.eq("clinic_id", clinicId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error("Error fetching import logs:", error);
      toast.error("Erro ao carregar histórico de importações");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [clinicId]);

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      const { error } = await supabase
        .from("import_logs")
        .delete()
        .eq("id", deleteId);

      if (error) throw error;

      setLogs(logs.filter((log) => log.id !== deleteId));
      toast.success("Registro removido com sucesso");
    } catch (error) {
      console.error("Error deleting import log:", error);
      toast.error("Erro ao remover registro");
    } finally {
      setDeleteId(null);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "patients":
        return <Users className="h-4 w-4" />;
      case "records":
        return <ClipboardList className="h-4 w-4" />;
      case "contacts":
        return <Phone className="h-4 w-4" />;
      case "combined":
        return <FileSpreadsheet className="h-4 w-4" />;
      default:
        return <FileSpreadsheet className="h-4 w-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "patients":
        return "Pacientes";
      case "records":
        return "Prontuários";
      case "contacts":
        return "Contatos";
      case "combined":
        return "Combinado";
      default:
        return type;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge variant="default" className="bg-green-600">
            <CheckCircle className="h-3 w-3 mr-1" />
            Concluído
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Falhou
          </Badge>
        );
      case "cancelled":
        return (
          <Badge variant="secondary">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Cancelado
          </Badge>
        );
      case "in_progress":
        return (
          <Badge variant="outline">
            <Clock className="h-3 w-3 mr-1" />
            Em Progresso
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDuration = (start: string, end: string | null) => {
    if (!end) return "-";
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffMs = endDate.getTime() - startDate.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    
    if (diffSecs < 60) return `${diffSecs}s`;
    const mins = Math.floor(diffSecs / 60);
    const secs = diffSecs % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Histórico de Importações
        </CardTitle>
        <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma importação registrada</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  {!clinicId && <TableHead>Clínica</TableHead>}
                  <TableHead>Tipo</TableHead>
                  <TableHead>Arquivo</TableHead>
                  <TableHead className="text-center">Total</TableHead>
                  <TableHead className="text-center">Sucesso</TableHead>
                  <TableHead className="text-center">Erros</TableHead>
                  <TableHead>Duração</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(log.created_at), "dd/MM/yyyy HH:mm", {
                        locale: ptBR,
                      })}
                    </TableCell>
                    {!clinicId && (
                      <TableCell className="max-w-[150px] truncate">
                        {log.clinic?.name || "-"}
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getTypeIcon(log.import_type)}
                        <span>{getTypeLabel(log.import_type)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {log.file_name || "-"}
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {log.total_rows}
                    </TableCell>
                    <TableCell className="text-center text-green-600 font-medium">
                      {log.success_count}
                    </TableCell>
                    <TableCell className="text-center text-red-600 font-medium">
                      {log.error_count}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatDuration(log.created_at, log.completed_at)}
                    </TableCell>
                    <TableCell>{getStatusBadge(log.status)}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteId(log.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover registro?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação irá remover apenas o registro do histórico. Os dados
                importados não serão afetados.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>Remover</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
