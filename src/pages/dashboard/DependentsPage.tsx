import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  Search,
  Edit2,
  User,
  Phone,
  CreditCard,
  Calendar,
  Loader2,
  AlertCircle,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
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

export default function DependentsPage() {
  const navigate = useNavigate();
  const { currentClinic } = useAuth();
  const [dependents, setDependents] = useState<DependentWithPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalDependents, setTotalDependents] = useState(0);

  // Debounce search
  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(t);
  }, [searchTerm]);

  const fetchDependents = useCallback(async () => {
    if (!currentClinic) return;

    setLoading(true);
    try {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

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

      setDependents((data as unknown as DependentWithPatient[]) || []);
      setTotalDependents(count || 0);
    } catch (error) {
      console.error("Error fetching dependents:", error);
    } finally {
      setLoading(false);
    }
  }, [currentClinic, debouncedSearch, page, pageSize]);

  useEffect(() => {
    if (currentClinic) {
      fetchDependents();
    }
  }, [currentClinic, fetchDependents]);

  const showingFrom = totalDependents > 0 ? (page - 1) * pageSize + 1 : 0;
  const showingTo = Math.min(page * pageSize, totalDependents);
  const canPrev = page > 1;
  const canNext = page * pageSize < totalDependents;

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

  const isCardExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    try {
      return isBefore(parseISO(expiresAt), new Date());
    } catch {
      return false;
    }
  };

  const handleEditDependent = (dependent: DependentWithPatient) => {
    navigate(`/dashboard/patients/${dependent.patient_id}/edit?tab=cadastro&dependentes=true`);
  };

  const handleEditPatient = (patientId: string) => {
    navigate(`/dashboard/patients/${patientId}/edit`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Dependentes
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie os dependentes vinculados aos pacientes titulares
          </p>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="py-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, CPF ou número da carteirinha..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Dependents List */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="text-lg">Lista de Dependentes</CardTitle>
            <p className="text-sm text-muted-foreground">
              {totalDependents > 0
                ? `Mostrando ${showingFrom}-${showingTo} de ${totalDependents}`
                : "0 dependentes"}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={String(pageSize)}
              onValueChange={(val) => {
                setPageSize(Number(val));
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 w-[150px]">
                <SelectValue placeholder="Por página" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25 / página</SelectItem>
                <SelectItem value="50">50 / página</SelectItem>
                <SelectItem value="100">100 / página</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              disabled={!canPrev || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!canNext || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
              Carregando dependentes...
            </div>
          ) : dependents.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dependente</TableHead>
                    <TableHead>Parentesco</TableHead>
                    <TableHead>Carteirinha</TableHead>
                    <TableHead>Titular</TableHead>
                    <TableHead className="w-[100px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dependents.map((dependent) => {
                    const age = calculateAge(dependent.birth_date);
                    const expired = isCardExpired(dependent.card_expires_at);

                    return (
                      <TableRow key={dependent.id}>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{dependent.name}</span>
                              {age !== null && (
                                <Badge variant="outline" className="text-xs">
                                  {age} anos
                                </Badge>
                              )}
                            </div>
                            {dependent.cpf && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <CreditCard className="h-3 w-3" />
                                CPF: {dependent.cpf}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {RELATIONSHIPS[dependent.relationship || ""] || dependent.relationship || "—"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {dependent.card_number ? (
                              <span className="text-sm">{dependent.card_number}</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                            {dependent.card_expires_at && (
                              <div className="flex items-center gap-1">
                                {expired ? (
                                  <Badge variant="destructive" className="text-xs gap-1">
                                    <AlertCircle className="h-3 w-3" />
                                    Vencida {formatDate(dependent.card_expires_at)}
                                  </Badge>
                                ) : (
                                  <span className="text-xs text-muted-foreground">
                                    Vence: {formatDate(dependent.card_expires_at)}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <button
                              onClick={() => handleEditPatient(dependent.patient.id)}
                              className="font-medium text-primary hover:underline flex items-center gap-1"
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
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditDependent(dependent)}
                              title="Editar dependente"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="mb-2">Nenhum dependente encontrado</p>
              <p className="text-sm">
                Dependentes são cadastrados através da ficha do paciente titular.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
