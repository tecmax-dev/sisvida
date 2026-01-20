import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Search,
  Plus,
  UserPlus,
  Users,
  UserCheck,
  UserX,
  MoreVertical,
  Phone,
  CreditCard,
  Loader2,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  FileText,
  Link2,
  FileArchive,
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
import { UnionMemberLinkDialog } from "@/components/union/members/UnionMemberLinkDialog";
import { UnionMemberBadge } from "@/components/union/members/UnionMemberBadge";
import { BulkFiliacaoGeneratorDialog } from "@/components/union/members/BulkFiliacaoGeneratorDialog";

interface UnionMember {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  cpf: string | null;
  is_union_member: boolean;
  union_member_status: string | null;
  union_joined_at: string | null;
  union_contribution_value: number | null;
  card_number?: string | null;
  card_expires_at?: string | null;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  ativo: { label: "Ativo", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
  pendente: { label: "Pendente", color: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
  inativo: { label: "Inativo", color: "bg-slate-500/20 text-slate-300 border-slate-500/30" },
  suspenso: { label: "Suspenso", color: "bg-red-500/20 text-red-300 border-red-500/30" },
};

const ITEMS_PER_PAGE = 15;

export default function UnionMembersListPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentClinic } = useAuth();
  const { canManageMembers, canViewMembers } = useUnionPermissions();
  const { toast } = useToast();
  
  const [members, setMembers] = useState<UnionMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [totalMembers, setTotalMembers] = useState(0);
  
  // Dialog states
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [bulkFiliacaoDialogOpen, setBulkFiliacaoDialogOpen] = useState(false);
  // Stats
  const [stats, setStats] = useState({
    total: 0,
    ativos: 0,
    pendentes: 0,
    inativos: 0,
  });

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const fetchMembers = useCallback(async () => {
    if (!currentClinic) return;
    
    setLoading(true);
    try {
      const from = (page - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      // Lista todos os pacientes ativos da clínica vinculada (associados do sindicato)
      let query = supabase
        .from("patients")
        .select(`
          id,
          name,
          email,
          phone,
          cpf,
          is_union_member,
          union_member_status,
          union_joined_at,
          union_contribution_value,
          tag,
          patient_cards (card_number, expires_at, is_active)
        `, { count: "exact" })
        .eq("clinic_id", currentClinic.id)
        .eq("is_active", true);

      // Filtra por status usando tag ou union_member_status
      if (statusFilter !== "all") {
        query = query.or(`tag.ilike.${statusFilter},union_member_status.eq.${statusFilter}`);
      }

      if (debouncedSearch) {
        const searchText = `%${debouncedSearch}%`;
        query = query.or(`name.ilike.${searchText},cpf.ilike.${searchText},email.ilike.${searchText}`);
      }

      const { data, error, count } = await query
        .order("name")
        .range(from, to);

      if (error) throw error;

      const membersWithCards = (data || []).map((m: any) => {
        const activeCard = Array.isArray(m.patient_cards)
          ? m.patient_cards.find((c: any) => c.is_active)
          : null;
        return {
          ...m,
          card_number: activeCard?.card_number || null,
          card_expires_at: activeCard?.expires_at || null,
          patient_cards: undefined,
        };
      });

      setMembers(membersWithCards);
      setTotalMembers(count || 0);
    } catch (error) {
      console.error("Error fetching members:", error);
      toast({ title: "Erro ao carregar associados", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [currentClinic, debouncedSearch, statusFilter, page, toast]);

  const fetchStats = useCallback(async () => {
    if (!currentClinic) return;

    try {
      // Conta todos os pacientes ativos da clínica como associados do sindicato
      const { data, error } = await supabase
        .from("patients")
        .select("tag, union_member_status")
        .eq("clinic_id", currentClinic.id)
        .eq("is_active", true);

      if (error) throw error;

      // Usa o campo 'tag' para classificar status (ou union_member_status se disponível)
      const counts = {
        total: data.length,
        ativos: data.filter((m) => 
          m.tag === "Ativo" || m.tag === "ativo" || m.union_member_status === "ativo"
        ).length,
        pendentes: data.filter((m) => 
          m.tag === "Pendente" || m.tag === "pendente" || m.union_member_status === "pendente"
        ).length,
        inativos: data.filter((m) => 
          m.tag === "Inativo" || m.tag === "inativo" || 
          m.union_member_status === "inativo" || m.union_member_status === "suspenso"
        ).length,
      };
      setStats(counts);
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  }, [currentClinic]);

  useEffect(() => {
    if (currentClinic) {
      fetchMembers();
      fetchStats();
    }
  }, [currentClinic, fetchMembers, fetchStats]);

  const handleMemberLinked = () => {
    fetchMembers();
    fetchStats();
    toast({ title: "Associado vinculado com sucesso!" });
  };

  const handleViewMember = (memberId: string) => {
    navigate(`/union/socios/${memberId}`);
  };

  const totalPages = Math.ceil(totalMembers / ITEMS_PER_PAGE);

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
            <Users className="h-6 w-6 text-purple-500" />
            Gestão de Sócios
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gerencie os associados vinculados ao sindicato
          </p>
        </div>
        {canManageMembers() && (
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => setBulkFiliacaoDialogOpen(true)} 
              className="gap-2"
            >
              <FileArchive className="h-4 w-4" />
              <span className="hidden sm:inline">Gerar Fichas</span>
            </Button>
            <Button onClick={() => setLinkDialogOpen(true)} className="gap-2">
              <UserPlus className="h-4 w-4" />
              Incluir Novo Associado
            </Button>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <Users className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-400">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total de Sócios</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <UserCheck className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-400">{stats.ativos}</p>
                <p className="text-xs text-muted-foreground">Ativos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <UserPlus className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-400">{stats.pendentes}</p>
                <p className="text-xs text-muted-foreground">Pendentes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-slate-500/10 to-slate-600/5 border-slate-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-500/20">
                <UserX className="h-5 w-5 text-slate-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-400">{stats.inativos}</p>
                <p className="text-xs text-muted-foreground">Inativos</p>
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
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="ativo">Ativos</SelectItem>
                <SelectItem value="pendente">Pendentes</SelectItem>
                <SelectItem value="inativo">Inativos</SelectItem>
                <SelectItem value="suspenso">Suspensos</SelectItem>
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
          ) : members.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium text-foreground">Nenhum associado encontrado</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {debouncedSearch || statusFilter !== "all"
                  ? "Tente ajustar os filtros de busca"
                  : "Clique em 'Incluir Novo Associado' para começar"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Carteirinha</TableHead>
                  <TableHead>Filiação</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => {
                  const status = statusConfig[member.union_member_status || "pendente"];
                  return (
                    <TableRow 
                      key={member.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleViewMember(member.id)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{member.name}</span>
                          <UnionMemberBadge status={member.union_member_status} size="sm" />
                        </div>
                        {member.email && (
                          <p className="text-xs text-muted-foreground">{member.email}</p>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {formatCPF(member.cpf)}
                      </TableCell>
                      <TableCell>{member.phone || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={status.color}>
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {member.card_number ? (
                          <div className="flex items-center gap-1 text-sm">
                            <CreditCard className="h-3.5 w-3.5 text-emerald-500" />
                            <span>{member.card_number}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {member.union_joined_at
                          ? format(new Date(member.union_joined_at), "dd/MM/yyyy", { locale: ptBR })
                          : "-"}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleViewMember(member.id)}>
                              <FileText className="h-4 w-4 mr-2" />
                              Ver Detalhes
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <MessageCircle className="h-4 w-4 mr-2" />
                              Enviar WhatsApp
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <CreditCard className="h-4 w-4 mr-2" />
                              Carteirinha
                            </DropdownMenuItem>
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
                {Math.min(page * ITEMS_PER_PAGE, totalMembers)} de {totalMembers} associados
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

      {/* Link Dialog */}
      <UnionMemberLinkDialog
        open={linkDialogOpen}
        onOpenChange={setLinkDialogOpen}
        onSuccess={handleMemberLinked}
      />

      {/* Bulk Filiacao Dialog */}
      {currentClinic && (
        <BulkFiliacaoGeneratorDialog
          open={bulkFiliacaoDialogOpen}
          onOpenChange={setBulkFiliacaoDialogOpen}
          clinicId={currentClinic.id}
        />
      )}
    </div>
  );
}
