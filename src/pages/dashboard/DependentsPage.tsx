import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  UsersRound,
  Search,
  Pencil,
  User,
  Phone,
  Loader2,
  Clock,
  IdCard,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  UserX,
  Trash2,
} from "lucide-react";
import { InlineCardExpiryEdit } from "@/components/patients/InlineCardExpiryEdit";
import { Card, CardContent } from "@/components/ui/card";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, differenceInYears, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DependentWithPatient {
  id: string;
  name: string;
  cpf: string | null;
  birth_date: string | null;
  relationship: string | null;
  card_number: string | null;
  card_expires_at: string | null;
  patient_id: string;
  patient: {
    id: string;
    name: string;
    phone: string;
  };
}

const RELATIONSHIPS: Record<string, string> = {
  filho: "Filho(a)",
  conjuge: "Cônjuge",
  pai: "Pai",
  mae: "Mãe",
  irmao: "Irmão(ã)",
  neto: "Neto(a)",
  sobrinho: "Sobrinho(a)",
  outro: "Outro",
};

const ITEMS_PER_PAGE = 15;

export default function DependentsPage() {
  const navigate = useNavigate();
  const { currentClinic, userRoles, isSuperAdmin } = useAuth();
  const { toast } = useToast();
  const [dependents, setDependents] = useState<DependentWithPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalDependents, setTotalDependents] = useState(0);

  // Delete/Inactivate state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [dependentToDelete, setDependentToDelete] = useState<DependentWithPatient | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const canPermanentDelete = isSuperAdmin || userRoles.some(r => ["owner", "admin"].includes(r.role));

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    withCard: 0,
    expiredCards: 0,
    noCard: 0,
  });

  // Debounce search
  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
      setCurrentPage(1);
    }, 300);
    return () => window.clearTimeout(t);
  }, [searchTerm]);

  const fetchDependents = useCallback(async () => {
    if (!currentClinic) return;

    setLoading(true);
    try {
      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      let query = supabase
        .from("patient_dependents")
        .select(
          `
          id,
          name,
          cpf,
          birth_date,
          relationship,
          card_number,
          card_expires_at,
          patient_id,
          patient:patients!inner (
            id,
            name,
            phone
          )
        `,
          { count: "exact" }
        )
        .eq("clinic_id", currentClinic.id)
        .eq("is_active", true);

      if (debouncedSearch.length > 0) {
        const text = `%${debouncedSearch}%`;
        query = query.or(`name.ilike.${text},cpf.ilike.${text},card_number.ilike.${text}`);
      }

      const { data, error, count } = await query.order("name").range(from, to);

      if (error) throw error;

      const deps = (data as unknown as DependentWithPatient[]) || [];
      setDependents(deps);
      setTotalDependents(count || 0);

      // Calculate stats from all dependents (need separate query)
      const { data: allDeps } = await supabase
        .from("patient_dependents")
        .select("id, card_number, card_expires_at")
        .eq("clinic_id", currentClinic.id)
        .eq("is_active", true);

      if (allDeps) {
        const now = new Date();
        const withCard = allDeps.filter(d => d.card_number).length;
        const expiredCards = allDeps.filter(d => {
          if (!d.card_expires_at) return false;
          try {
            return isBefore(parseISO(d.card_expires_at), now);
          } catch { return false; }
        }).length;

        setStats({
          total: allDeps.length,
          withCard,
          expiredCards,
          noCard: allDeps.length - withCard,
        });
      }
    } catch (error) {
      console.error("Error fetching dependents:", error);
    } finally {
      setLoading(false);
    }
  }, [currentClinic, debouncedSearch, currentPage]);

  useEffect(() => {
    if (currentClinic) {
      fetchDependents();
    }
  }, [currentClinic, fetchDependents]);

  const totalPages = Math.ceil(totalDependents / ITEMS_PER_PAGE);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    try {
      return format(parseISO(dateStr), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return "—";
    }
  };

  const calculateAge = (birthDate: string | null) => {
    if (!birthDate) return null;
    try {
      return differenceInYears(new Date(), parseISO(birthDate));
    } catch {
      return null;
    }
  };

  // Use midday normalization to avoid timezone issues (memory: timezone-safe-date-parsing-system-wide-v2)
  const isCardExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    try {
      const expiryDate = parseISO(expiresAt);
      expiryDate.setHours(12, 0, 0, 0);
      const todayMidDay = new Date();
      todayMidDay.setHours(12, 0, 0, 0);
      return isBefore(expiryDate, todayMidDay);
    } catch {
      return false;
    }
  };

  const handleEditDependent = (dependent: DependentWithPatient) => {
    navigate(`/dashboard/patients/${dependent.patient_id}/edit?tab=dependentes&dependentes=true&editDependent=${dependent.id}`);
  };

  const handleEditPatient = (patientId: string) => {
    navigate(`/dashboard/patients/${patientId}/edit`);
  };

  const handleInactivate = async () => {
    if (!dependentToDelete) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("patient_dependents")
        .update({ is_active: false })
        .eq("id", dependentToDelete.id);

      if (error) throw error;

      toast({ title: "Dependente inativado com sucesso" });
      fetchDependents();
    } catch (error) {
      console.error("Error inactivating dependent:", error);
      toast({ title: "Erro ao inativar dependente", variant: "destructive" });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setDependentToDelete(null);
    }
  };

  const handlePermanentDelete = async () => {
    if (!dependentToDelete) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("patient_dependents")
        .delete()
        .eq("id", dependentToDelete.id);

      if (error) throw error;

      toast({ title: "Dependente excluído permanentemente" });
      fetchDependents();
    } catch (error) {
      console.error("Error deleting dependent:", error);
      toast({ title: "Erro ao excluir dependente", variant: "destructive" });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setDependentToDelete(null);
    }
  };

  if (loading && dependents.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <UsersRound className="h-6 w-6 text-primary" />
            Dependentes
          </h1>
          <p className="text-sm text-muted-foreground">
            Gerencie os dependentes vinculados aos pacientes titulares
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-l-4 border-l-primary bg-primary/5">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <UsersRound className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">Total</span>
            </div>
            <p className="text-xl font-bold text-foreground mt-1">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500 dark:border-l-emerald-400 bg-emerald-500/5">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <IdCard className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
              <span className="text-xs font-medium text-muted-foreground">Com Carteirinha</span>
            </div>
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{stats.withCard}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-rose-500 dark:border-l-rose-400 bg-rose-500/5">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-rose-500 dark:text-rose-400" />
              <span className="text-xs font-medium text-muted-foreground">Vencidas</span>
            </div>
            <p className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-1">{stats.expiredCards}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500 dark:border-l-amber-400 bg-amber-500/5">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-500 dark:text-amber-400" />
              <span className="text-xs font-medium text-muted-foreground">Sem Carteirinha</span>
            </div>
            <p className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1">{stats.noCard}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, CPF ou carteirinha..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Badge variant="outline" className="text-xs">
          {totalDependents} resultado{totalDependents !== 1 ? "s" : ""}
        </Badge>
      </div>

      {/* Table */}
      {dependents.length === 0 && !loading ? (
        <Card>
          <CardContent className="p-8 text-center">
            <UsersRound className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              Nenhum dependente encontrado
            </h3>
            <p className="text-muted-foreground mb-4 text-sm">
              Dependentes são cadastrados através da ficha do paciente titular.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">Dependente</TableHead>
                  <TableHead className="font-semibold">Parentesco</TableHead>
                  <TableHead className="font-semibold">Carteirinha</TableHead>
                  <TableHead className="font-semibold">Titular</TableHead>
                  <TableHead className="font-semibold text-right w-[80px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dependents.map((dependent) => {
                  const age = calculateAge(dependent.birth_date);
                  const expired = isCardExpired(dependent.card_expires_at);

                  return (
                    <TableRow key={dependent.id} className="h-12 hover:bg-muted/30 transition-colors">
                      <TableCell className="py-2">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
                            <UserPlus className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <button
                              onClick={() => handleEditDependent(dependent)}
                              className="font-medium text-sm text-primary hover:underline text-left truncate max-w-[180px] block"
                            >
                              {dependent.name}
                            </button>
                            <div className="flex items-center gap-2 mt-0.5">
                              {age !== null && (
                                <span className="text-xs text-muted-foreground">{age} anos</span>
                              )}
                              {dependent.cpf && (
                                <code className="text-xs bg-muted px-1 py-0.5 rounded font-mono">
                                  {dependent.cpf}
                                </code>
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-2">
                        <Badge variant="secondary" className="text-xs">
                          {RELATIONSHIPS[dependent.relationship || ""] || dependent.relationship || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="space-y-1">
                          {dependent.card_number ? (
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                              {dependent.card_number}
                            </code>
                          ) : (
                            <span className="text-xs text-muted-foreground">Sem carteirinha</span>
                          )}
                          <div>
                            <InlineCardExpiryEdit
                              entityId={dependent.id}
                              entityType="dependent"
                              currentExpiryDate={dependent.card_expires_at}
                              cardNumber={dependent.card_number}
                              onUpdate={fetchDependents}
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="space-y-0.5">
                          <button
                            onClick={() => handleEditPatient(dependent.patient.id)}
                            className="font-medium text-sm text-primary hover:underline flex items-center gap-1"
                          >
                            <User className="h-3 w-3" />
                            {dependent.patient.name}
                          </button>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            {dependent.patient.phone}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-2 text-right">
                        <TooltipProvider>
                          <div className="flex items-center justify-end gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                  onClick={() => handleEditDependent(dependent)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Editar</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                                  onClick={() => {
                                    setDependentToDelete(dependent);
                                    setDeleteDialogOpen(true);
                                  }}
                                >
                                  <UserX className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Inativar</TooltipContent>
                            </Tooltip>
                          </div>
                        </TooltipProvider>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-xs text-muted-foreground">
                Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} a {Math.min(currentPage * ITEMS_PER_PAGE, totalDependents)} de {totalDependents}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let page: number;
                  if (totalPages <= 5) {
                    page = i + 1;
                  } else if (currentPage <= 3) {
                    page = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    page = totalPages - 4 + i;
                  } else {
                    page = currentPage - 2 + i;
                  }
                  return (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      size="icon"
                      className="h-8 w-8 text-xs"
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </Button>
                  );
                })}
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Dialog de confirmação de inativação/exclusão */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {canPermanentDelete ? "Remover dependente?" : "Inativar dependente?"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  O que deseja fazer com <strong>{dependentToDelete?.name}</strong>?
                </p>
                <div className="text-sm space-y-1 mt-2">
                  <p className="flex items-center gap-2">
                    <UserX className="h-4 w-4 text-amber-500" />
                    <span><strong>Inativar:</strong> O dependente não aparecerá nas listagens, mas os dados são mantidos.</span>
                  </p>
                  {canPermanentDelete && (
                    <p className="flex items-center gap-2">
                      <Trash2 className="h-4 w-4 text-rose-500" />
                      <span><strong>Excluir:</strong> Remove permanentemente todos os dados do dependente.</span>
                    </p>
                  )}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <Button
              variant="outline"
              onClick={handleInactivate}
              disabled={isDeleting}
              className="border-amber-500 text-amber-600 hover:bg-amber-50"
            >
              <UserX className="h-4 w-4 mr-1" />
              {isDeleting ? "Inativando..." : "Inativar"}
            </Button>
            {canPermanentDelete && (
              <Button
                variant="destructive"
                onClick={handlePermanentDelete}
                disabled={isDeleting}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                {isDeleting ? "Excluindo..." : "Excluir Permanentemente"}
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
