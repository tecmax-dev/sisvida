import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  UserPlus,
  Users,
  UserCheck,
  UserX,
  MoreVertical,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Eye,
  CheckCircle,
  XCircle,
  FileText,
  Mail,
  MessageCircle,
  Clock,
  Filter,
} from "lucide-react";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useUnionPermissions } from "@/hooks/useUnionPermissions";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FiliacaoDetailDialog } from "@/components/union/filiacoes/FiliacaoDetailDialog";
import { FiliacaoApprovalDialog } from "@/components/union/filiacoes/FiliacaoApprovalDialog";

interface Filiacao {
  id: string;
  nome: string;
  cpf: string;
  email: string;
  telefone: string;
  empresa_razao_social?: string | null;
  empresa_cnpj?: string | null;
  cargo?: string | null;
  status: string;
  created_at: string;
  aprovado_at?: string | null;
  rejeitado_at?: string | null;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pendente: { label: "Pendente", color: "bg-amber-500/20 text-amber-600 border-amber-500/30", icon: Clock },
  aprovado: { label: "Aprovado", color: "bg-emerald-500/20 text-emerald-600 border-emerald-500/30", icon: CheckCircle },
  rejeitado: { label: "Rejeitado", color: "bg-red-500/20 text-red-600 border-red-500/30", icon: XCircle },
};

const ITEMS_PER_PAGE = 15;

export default function UnionFiliacoesPage() {
  const navigate = useNavigate();
  const { currentClinic, user } = useAuth();
  const { canManageMembers } = useUnionPermissions();
  const { toast } = useToast();
  
  const [filiacoes, setFiliacoes] = useState<Filiacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("pendente");
  const [page, setPage] = useState(1);
  const [totalFiliacoes, setTotalFiliacoes] = useState(0);
  
  // Dialog states
  const [selectedFiliacao, setSelectedFiliacao] = useState<Filiacao | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [approvalAction, setApprovalAction] = useState<"approve" | "reject">("approve");
  
  // Stats
  const [stats, setStats] = useState({
    total: 0,
    pendentes: 0,
    aprovados: 0,
    rejeitados: 0,
  });

  // Get union entity ID
  const [unionEntityId, setUnionEntityId] = useState<string | null>(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // Fetch union entity
  useEffect(() => {
    const fetchUnionEntity = async () => {
      if (!currentClinic) return;
      
      const { data } = await supabase
        .from("union_entities")
        .select("id")
        .eq("clinic_id", currentClinic.id)
        .eq("status", "ativa")
        .maybeSingle();
      
      if (data) {
        setUnionEntityId(data.id);
      }
    };
    
    fetchUnionEntity();
  }, [currentClinic]);

  const fetchFiliacoes = useCallback(async () => {
    if (!unionEntityId) return;
    
    setLoading(true);
    try {
      const from = (page - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      let query = supabase
        .from("sindical_associados")
        .select("*", { count: "exact" })
        .eq("sindicato_id", unionEntityId);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      if (debouncedSearch) {
        const searchText = `%${debouncedSearch}%`;
        query = query.or(`nome.ilike.${searchText},cpf.ilike.${searchText},email.ilike.${searchText}`);
      }

      const { data, error, count } = await query
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;

      setFiliacoes(data || []);
      setTotalFiliacoes(count || 0);
    } catch (error) {
      console.error("Error fetching filiacoes:", error);
      toast({ title: "Erro ao carregar filiações", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [unionEntityId, debouncedSearch, statusFilter, page, toast]);

  const fetchStats = useCallback(async () => {
    if (!unionEntityId) return;

    try {
      const { data, error } = await supabase
        .from("sindical_associados")
        .select("status")
        .eq("sindicato_id", unionEntityId);

      if (error) throw error;

      const counts = {
        total: data.length,
        pendentes: data.filter((f) => f.status === "pendente").length,
        aprovados: data.filter((f) => f.status === "aprovado").length,
        rejeitados: data.filter((f) => f.status === "rejeitado").length,
      };
      setStats(counts);
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  }, [unionEntityId]);

  useEffect(() => {
    if (unionEntityId) {
      fetchFiliacoes();
      fetchStats();
    }
  }, [unionEntityId, fetchFiliacoes, fetchStats]);

  const handleViewDetails = (filiacao: Filiacao) => {
    setSelectedFiliacao(filiacao);
    setDetailDialogOpen(true);
  };

  const handleApprove = (filiacao: Filiacao) => {
    setSelectedFiliacao(filiacao);
    setApprovalAction("approve");
    setApprovalDialogOpen(true);
  };

  const handleReject = (filiacao: Filiacao) => {
    setSelectedFiliacao(filiacao);
    setApprovalAction("reject");
    setApprovalDialogOpen(true);
  };

  const handleApprovalComplete = () => {
    fetchFiliacoes();
    fetchStats();
    setApprovalDialogOpen(false);
  };

  const totalPages = Math.ceil(totalFiliacoes / ITEMS_PER_PAGE);

  const formatCPF = (cpf: string | null) => {
    if (!cpf) return "-";
    const cleaned = cpf.replace(/\D/g, "");
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <UserPlus className="h-6 w-6 text-purple-500" />
            Solicitações de Filiação
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gerencie as solicitações de filiação de novos associados
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <Users className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-500">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card 
          className={`cursor-pointer transition-all ${statusFilter === 'pendente' ? 'ring-2 ring-amber-500' : ''} bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20`}
          onClick={() => setStatusFilter("pendente")}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <Clock className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-500">{stats.pendentes}</p>
                <p className="text-xs text-muted-foreground">Pendentes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card 
          className={`cursor-pointer transition-all ${statusFilter === 'aprovado' ? 'ring-2 ring-emerald-500' : ''} bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20`}
          onClick={() => setStatusFilter("aprovado")}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <UserCheck className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-500">{stats.aprovados}</p>
                <p className="text-xs text-muted-foreground">Aprovados</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card 
          className={`cursor-pointer transition-all ${statusFilter === 'rejeitado' ? 'ring-2 ring-red-500' : ''} bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20`}
          onClick={() => setStatusFilter("rejeitado")}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/20">
                <UserX className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-500">{stats.rejeitados}</p>
                <p className="text-xs text-muted-foreground">Rejeitados</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, CPF ou e-mail..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pendente">Pendentes</SelectItem>
                <SelectItem value="aprovado">Aprovados</SelectItem>
                <SelectItem value="rejeitado">Rejeitados</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filiacoes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <UserPlus className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium text-foreground">Nenhuma filiação encontrada</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {debouncedSearch || statusFilter !== "pendente"
                  ? "Tente ajustar os filtros de busca"
                  : "Não há solicitações de filiação pendentes"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome / CPF</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data Solicitação</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filiacoes.map((filiacao) => {
                  const status = statusConfig[filiacao.status] || statusConfig.pendente;
                  const StatusIcon = status.icon;
                  return (
                    <TableRow 
                      key={filiacao.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleViewDetails(filiacao)}
                    >
                      <TableCell>
                        <div>
                          <span className="font-medium">{filiacao.nome}</span>
                          <p className="text-xs text-muted-foreground font-mono">
                            {formatCPF(filiacao.cpf)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p>{filiacao.email}</p>
                          <p className="text-muted-foreground">{filiacao.telefone}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {filiacao.empresa_razao_social ? (
                          <div className="text-sm">
                            <p className="truncate max-w-[200px]">{filiacao.empresa_razao_social}</p>
                            {filiacao.cargo && (
                              <p className="text-muted-foreground">{filiacao.cargo}</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`gap-1 ${status.color}`}>
                          <StatusIcon className="h-3 w-3" />
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(filiacao.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleViewDetails(filiacao)}>
                              <Eye className="h-4 w-4 mr-2" />
                              Ver Detalhes
                            </DropdownMenuItem>
                            {filiacao.status === "pendente" && canManageMembers() && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => handleApprove(filiacao)}
                                  className="text-emerald-600"
                                >
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Aprovar
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleReject(filiacao)}
                                  className="text-red-600"
                                >
                                  <XCircle className="h-4 w-4 mr-2" />
                                  Rejeitar
                                </DropdownMenuItem>
                              </>
                            )}
                            {filiacao.status === "aprovado" && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleViewDetails(filiacao)}>
                                  <FileText className="h-4 w-4 mr-2" />
                                  Ver Ficha
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleViewDetails(filiacao)}>
                                  <Mail className="h-4 w-4 mr-2" />
                                  Reenviar E-mail
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleViewDetails(filiacao)}>
                                  <MessageCircle className="h-4 w-4 mr-2" />
                                  Enviar WhatsApp
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-sm text-muted-foreground">
                Mostrando {(page - 1) * ITEMS_PER_PAGE + 1} a{" "}
                {Math.min(page * ITEMS_PER_PAGE, totalFiliacoes)} de {totalFiliacoes}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">
                  Página {page} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <FiliacaoDetailDialog
        filiacao={selectedFiliacao}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        onApprove={() => {
          setDetailDialogOpen(false);
          handleApprove(selectedFiliacao!);
        }}
        onReject={() => {
          setDetailDialogOpen(false);
          handleReject(selectedFiliacao!);
        }}
        onRefresh={fetchFiliacoes}
      />

      <FiliacaoApprovalDialog
        filiacao={selectedFiliacao}
        action={approvalAction}
        open={approvalDialogOpen}
        onOpenChange={setApprovalDialogOpen}
        onComplete={handleApprovalComplete}
      />
    </div>
  );
}
