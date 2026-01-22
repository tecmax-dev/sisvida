import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUnionLegalDeadlines } from "@/hooks/useUnionLegal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { Link } from "react-router-dom";
import { Plus, Search, Clock, Filter, Eye, CheckCircle, Loader2, CalendarClock, AlertTriangle } from "lucide-react";
import {
  deadlineCriticalityLabels,
  deadlineCriticalityColors,
  deadlineStatusLabels,
  deadlineStatusColors,
  DeadlineCriticality,
  DeadlineStatus,
} from "@/types/unionLegal";
import { differenceInDays, format, isAfter, isBefore, parseISO, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function UnionLegalDeadlinesPage() {
  const { currentClinic } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("pendente");
  const [criticalityFilter, setCriticalityFilter] = useState<string>("all");

  const { deadlines, isLoading } = useUnionLegalDeadlines(currentClinic?.id);

  const today = startOfDay(new Date());

  const filteredDeadlines = (deadlines || []).filter((d) => {
    const matchesSearch =
      d.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (d.description && d.description.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === "all" || d.status === statusFilter;
    const matchesCriticality = criticalityFilter === "all" || d.criticality === criticalityFilter;

    return matchesSearch && matchesStatus && matchesCriticality;
  }).sort((a, b) => {
    // Sort by deadline date ascending (most urgent first)
    return new Date(a.deadline_date).getTime() - new Date(b.deadline_date).getTime();
  });

  const getDeadlineUrgency = (deadlineDate: string, status: string) => {
    if (status !== "pendente") return null;
    
    const deadline = parseISO(deadlineDate);
    const daysUntil = differenceInDays(deadline, today);
    
    if (isBefore(deadline, today)) {
      return { label: "Vencido", color: "text-red-600 bg-red-100" };
    } else if (daysUntil === 0) {
      return { label: "Hoje", color: "text-orange-600 bg-orange-100" };
    } else if (daysUntil === 1) {
      return { label: "Amanhã", color: "text-yellow-600 bg-yellow-100" };
    } else if (daysUntil <= 3) {
      return { label: `${daysUntil} dias`, color: "text-yellow-600 bg-yellow-100" };
    } else if (daysUntil <= 7) {
      return { label: `${daysUntil} dias`, color: "text-blue-600 bg-blue-100" };
    }
    return null;
  };

  const formatDate = (date: string) => {
    return format(parseISO(date), "dd/MM/yyyy", { locale: ptBR });
  };

  const formatDateTime = (date: string, time: string | null) => {
    const dateStr = format(parseISO(date), "dd/MM/yyyy", { locale: ptBR });
    return time ? `${dateStr} às ${time}` : dateStr;
  };

  // Stats
  const stats = {
    total: (deadlines || []).filter((d) => d.status === "pendente").length,
    urgent: (deadlines || []).filter((d) => {
      if (d.status !== "pendente") return false;
      const daysUntil = differenceInDays(parseISO(d.deadline_date), today);
      return daysUntil <= 3;
    }).length,
    overdue: (deadlines || []).filter((d) => {
      if (d.status !== "pendente") return false;
      return isBefore(parseISO(d.deadline_date), today);
    }).length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Clock className="h-7 w-7 text-orange-500" />
            Prazos Judiciais
          </h1>
          <p className="text-muted-foreground">
            Controle de prazos processuais e compromissos
          </p>
        </div>
        <Button asChild>
          <Link to="/union/juridico/prazos/novo">
            <Plus className="h-4 w-4 mr-2" />
            Novo Prazo
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Prazos Pendentes</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <div className="p-3 rounded-lg bg-blue-500/10">
                <CalendarClock className="h-6 w-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Urgentes (até 3 dias)</p>
                <p className="text-2xl font-bold text-orange-600">{stats.urgent}</p>
              </div>
              <div className="p-3 rounded-lg bg-orange-500/10">
                <AlertTriangle className="h-6 w-6 text-orange-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Vencidos</p>
                <p className="text-2xl font-bold text-red-600">{stats.overdue}</p>
              </div>
              <div className="p-3 rounded-lg bg-red-500/10">
                <Clock className="h-6 w-6 text-red-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por título, descrição..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                {Object.entries(deadlineStatusLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={criticalityFilter} onValueChange={setCriticalityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Criticidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {Object.entries(deadlineCriticalityLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredDeadlines.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum prazo encontrado</p>
              <Button asChild className="mt-4">
                <Link to="/union/juridico/prazos/novo">
                  <Plus className="h-4 w-4 mr-2" />
                  Cadastrar Primeiro Prazo
                </Link>
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead>Processo</TableHead>
                    <TableHead>Data Limite</TableHead>
                    <TableHead>Urgência</TableHead>
                    <TableHead>Criticidade</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDeadlines.map((deadline) => {
                    const urgency = getDeadlineUrgency(deadline.deadline_date, deadline.status);
                    return (
                      <TableRow key={deadline.id}>
                        <TableCell className="font-medium max-w-[200px]">
                          <span className="truncate block">{deadline.title}</span>
                          {deadline.description && (
                            <span className="text-xs text-muted-foreground truncate block">
                              {deadline.description}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {deadline.legal_case ? (
                            <Link
                              to={`/union/juridico/casos/${deadline.legal_case_id}`}
                              className="text-blue-600 hover:underline font-mono text-sm"
                            >
                              {deadline.legal_case.case_number}
                            </Link>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>
                          {formatDateTime(deadline.deadline_date, deadline.deadline_time)}
                        </TableCell>
                        <TableCell>
                          {urgency && (
                            <Badge className={urgency.color}>
                              {urgency.label}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={deadlineCriticalityColors[deadline.criticality as DeadlineCriticality]}
                          >
                            {deadlineCriticalityLabels[deadline.criticality as DeadlineCriticality]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {deadline.responsible_lawyer?.name || "-"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={deadlineStatusColors[deadline.status as DeadlineStatus]}
                          >
                            {deadlineStatusLabels[deadline.status as DeadlineStatus]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {deadline.status === "pendente" && (
                              <Button variant="ghost" size="icon" title="Marcar como cumprido">
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" asChild>
                              <Link to={`/union/juridico/casos/${deadline.legal_case_id}`}>
                                <Eye className="h-4 w-4" />
                              </Link>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
