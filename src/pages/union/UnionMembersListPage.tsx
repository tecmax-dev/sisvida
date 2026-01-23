import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Plus,
  Phone,
  MoreVertical,
  CreditCard,
  Loader2,
  ChevronLeft,
  ChevronRight,
  User,
  Users,
  UserCheck,
  UserX,
  Shield,
  FileText,
  MessageCircle,
  Paperclip,
  Send,
  Calendar,
  HeartPulse,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { calculateAge } from "@/lib/utils";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { RealtimeIndicator } from "@/components/ui/realtime-indicator";
import { InlineCardExpiryEdit } from "@/components/patients/InlineCardExpiryEdit";
import { InlineAppointmentLimitEdit } from "@/components/patients/InlineAppointmentLimitEdit";
import { usePermissions } from "@/hooks/usePermissions";
import { PatientAlertsPanel } from "@/components/patients/PatientAlertsPanel";

const ITEMS_PER_PAGE = 15;

interface UnionMember {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  cpf: string | null;
  birth_date: string | null;
  address: string | null;
  is_active: boolean;
  insurance_plan_id: string | null;
  insurance_plan?: { name: string } | null;
  max_appointments_per_month: number | null;
  card_expires_at?: string | null;
  card_number?: string | null;
  dependents_count?: number;
  inactivation_reason?: string | null;
}

// Formatação de CPF: 000.000.000-00
const formatCPF = (value: string | null): string => {
  if (!value) return "";
  const cleaned = value.replace(/\D/g, "");
  return cleaned
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})/, "$1-$2")
    .substring(0, 14);
};

// Formatação de telefone: (00) 00000-0000
const formatPhone = (value: string | null): string => {
  if (!value) return "";
  const cleaned = value.replace(/\D/g, "");
  return cleaned
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2")
    .substring(0, 15);
};

export default function UnionMembersListPage() {
  const navigate = useNavigate();
  const { currentClinic } = useAuth();
  const { isAdmin } = usePermissions();
  const { canManageMembers } = useUnionPermissions();
  const { toast } = useToast();

  // Storage keys for search persistence
  const SEARCH_TITULARES_KEY = "union-members:search-titulares";
  const SEARCH_DEPENDENTES_KEY = "union-members:search-dependentes";
  const ACTIVE_TAB_KEY = "union-members:active-tab";

  const getInitialSearch = (key: string): string => {
    try {
      return sessionStorage.getItem(key) || "";
    } catch {
      return "";
    }
  };

  const getInitialTab = (): "titulares" | "dependentes" => {
    try {
      const saved = sessionStorage.getItem(ACTIVE_TAB_KEY);
      return saved === "dependentes" ? "dependentes" : "titulares";
    } catch {
      return "titulares";
    }
  };

  const [members, setMembers] = useState<UnionMember[]>([]);
  const [insurancePlans, setInsurancePlans] = useState<{ id: string; name: string }[]>([]);
  const [clinicDefaultLimit, setClinicDefaultLimit] = useState<number | null>(null);

  // Search + pagination
  const [searchTerm, setSearchTerm] = useState(() => getInitialSearch(SEARCH_TITULARES_KEY));
  const [debouncedSearch, setDebouncedSearch] = useState(() => getInitialSearch(SEARCH_TITULARES_KEY));
  const [page, setPage] = useState(1);
  const [totalMembers, setTotalMembers] = useState(0);
  const [showInactive, setShowInactive] = useState(false);
  const [cardFilter, setCardFilter] = useState<"all" | "valid" | "expired" | "no-card">("all");
  const [loading, setLoading] = useState(true);

  // Tab state
  const [activeTab, setActiveTab] = useState<"titulares" | "dependentes">(getInitialTab);

  // Dependents state
  const [dependents, setDependents] = useState<any[]>([]);
  const [dependentsLoading, setDependentsLoading] = useState(false);
  const [totalDependents, setTotalDependents] = useState(0);
  const [dependentsSearch, setDependentsSearch] = useState(() => getInitialSearch(SEARCH_DEPENDENTES_KEY));
  const [debouncedDependentsSearch, setDebouncedDependentsSearch] = useState(() => getInitialSearch(SEARCH_DEPENDENTES_KEY));

  // Persist search terms
  useEffect(() => {
    try {
      sessionStorage.setItem(SEARCH_TITULARES_KEY, searchTerm);
    } catch {}
  }, [searchTerm]);

  useEffect(() => {
    try {
      sessionStorage.setItem(SEARCH_DEPENDENTES_KEY, dependentsSearch);
    } catch {}
  }, [dependentsSearch]);

  useEffect(() => {
    try {
      sessionStorage.setItem(ACTIVE_TAB_KEY, activeTab);
    } catch {}
  }, [activeTab]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedDependentsSearch(dependentsSearch.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [dependentsSearch]);

  const normalizePhoneDigits = (value: string): string => value.replace(/\D/g, "");

  const buildPhoneSearchVariants = (digitsRaw: string): string[] => {
    if (!digitsRaw) return [];
    const digits = digitsRaw.startsWith("55") && digitsRaw.length > 11 ? digitsRaw.slice(2) : digitsRaw;
    const variants = new Set<string>();
    variants.add(digits);
    variants.add(digitsRaw);
    if (digits.length === 11) {
      variants.add(formatPhone(digits));
    }
    return Array.from(variants).filter((v) => v.length >= 3);
  };

  const fetchMembers = useCallback(async () => {
    if (!currentClinic) return;

    setLoading(true);
    try {
      const from = (page - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      const safeSearch = debouncedSearch.replace(/,/g, " ");
      const searchDigits = normalizePhoneDigits(safeSearch);
      const phoneVariants = buildPhoneSearchVariants(searchDigits);

      let query = supabase
        .from("patients")
        .select(
          `
          id,
          name,
          email,
          phone,
          cpf,
          address,
          birth_date,
          is_active,
          inactivation_reason,
          insurance_plan_id,
          max_appointments_per_month,
          insurance_plan:insurance_plans ( name ),
          patient_dependents ( id ),
          patient_cards ( card_number, expires_at, is_active )
        `,
          { count: "exact" }
        )
        .eq("clinic_id", currentClinic.id);

      // Filter by active status
      if (showInactive) {
        query = query.eq("is_active", false);
      } else {
        query = query.eq("is_active", true);
      }

      if (safeSearch.length > 0) {
        const text = `%${safeSearch}%`;
        const orParts: string[] = [`name.ilike.${text}`, `email.ilike.${text}`];

        if (searchDigits.length >= 3) {
          orParts.push(`cpf.ilike.%${searchDigits}%`);
          if (searchDigits.length >= 11) {
            const cpfClean = searchDigits.slice(0, 11);
            const cpfFormatted = cpfClean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
            orParts.push(`cpf.eq.${cpfClean}`);
            orParts.push(`cpf.eq.${cpfFormatted}`);
            orParts.push(`cpf.ilike.%${cpfFormatted}%`);
          }
        }

        orParts.push(`phone.ilike.${text}`);
        for (const v of phoneVariants) {
          orParts.push(`phone.ilike.%${v}%`);
        }

        query = query.or(orParts.join(","));
      }

      const { data, error, count } = await query.order("name").range(from, to);

      if (error) throw error;

      const today = new Date().toISOString().split('T')[0];
      
      let membersWithData = (data || []).map((p: any) => {
        const activeCard = Array.isArray(p.patient_cards)
          ? p.patient_cards.find((c: any) => c.is_active)
          : null;
        return {
          ...p,
          dependents_count: Array.isArray(p.patient_dependents)
            ? p.patient_dependents.filter((d: any) => d.id).length
            : 0,
          card_expires_at: activeCard?.expires_at || null,
          card_number: activeCard?.card_number || null,
          patient_dependents: undefined,
          patient_cards: undefined,
        };
      });

      // Apply card filter client-side (since we need to check card dates)
      if (cardFilter === "valid") {
        membersWithData = membersWithData.filter((m: any) => 
          m.card_expires_at && m.card_expires_at >= today
        );
      } else if (cardFilter === "expired") {
        membersWithData = membersWithData.filter((m: any) => 
          m.card_expires_at && m.card_expires_at < today
        );
      } else if (cardFilter === "no-card") {
        membersWithData = membersWithData.filter((m: any) => !m.card_number);
      }

      setMembers(membersWithData as UnionMember[]);
      setTotalMembers(cardFilter === "all" ? (count || 0) : membersWithData.length);
    } catch (error) {
      console.error("Error fetching members:", error);
      toast({ title: "Erro ao carregar sócios", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [currentClinic, debouncedSearch, page, showInactive, cardFilter, toast]);

  const fetchDependents = useCallback(async () => {
    if (!currentClinic) return;

    setDependentsLoading(true);
    try {
      const from = (page - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      const safeSearch = debouncedDependentsSearch.replace(/,/g, " ");

      let query = supabase
        .from("patient_dependents")
        .select(
          `
          id,
          name,
          cpf,
          birth_date,
          phone,
          relationship,
          is_active,
          patient_id,
          created_at,
          patient:patients!patient_dependents_patient_id_fkey (id, name)
        `,
          { count: "exact" }
        )
        .eq("clinic_id", currentClinic.id);

      if (showInactive) {
        query = query.eq("is_active", false);
      } else {
        query = query.eq("is_active", true);
      }

      if (safeSearch.length > 0) {
        const text = `%${safeSearch}%`;
        const searchDigits = safeSearch.replace(/\D/g, "");
        const orParts: string[] = [`name.ilike.${text}`];
        if (searchDigits.length >= 3) {
          orParts.push(`cpf.ilike.%${searchDigits}%`);
        }
        query = query.or(orParts.join(","));
      }

      const { data, error, count } = await query.order("name").range(from, to);

      if (error) throw error;

      setDependents(data || []);
      setTotalDependents(count || 0);
    } catch (error) {
      console.error("Error fetching dependents:", error);
    } finally {
      setDependentsLoading(false);
    }
  }, [currentClinic, debouncedDependentsSearch, page, showInactive]);

  const fetchInsurancePlans = async () => {
    if (!currentClinic) return;
    try {
      const { data, error } = await supabase
        .from("insurance_plans")
        .select("id, name")
        .eq("clinic_id", currentClinic.id)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      setInsurancePlans(data || []);
    } catch (error) {
      console.error("Error fetching insurance plans:", error);
    }
  };

  const fetchClinicLimit = async () => {
    if (!currentClinic) return;
    try {
      const { data } = await supabase
        .from("clinics")
        .select("max_appointments_per_cpf_month")
        .eq("id", currentClinic.id)
        .single();
      setClinicDefaultLimit(data?.max_appointments_per_cpf_month ?? null);
    } catch (error) {
      console.error("Error fetching clinic limit:", error);
    }
  };

  useEffect(() => {
    if (currentClinic) {
      fetchMembers();
      fetchInsurancePlans();
      fetchClinicLimit();
    }
  }, [currentClinic, fetchMembers]);

  useEffect(() => {
    if (currentClinic && activeTab === "dependentes") {
      fetchDependents();
    }
  }, [currentClinic, activeTab, fetchDependents]);

  // Realtime subscription
  useRealtimeSubscription({
    table: "patients",
    filter: currentClinic ? { column: "clinic_id", value: currentClinic.id } : undefined,
    onInsert: () => fetchMembers(),
    onUpdate: () => fetchMembers(),
    onDelete: () => fetchMembers(),
    enabled: !!currentClinic,
  });

  const handleOpenEdit = (member: UnionMember) => {
    navigate(`/dashboard/patients/${member.id}/edit`);
  };

  const handleViewMember = (memberId: string) => {
    navigate(`/sindicato/socios/${memberId}`);
  };

  // Stats
  const activeCount = useMemo(() => members.filter((m) => m.is_active !== false).length, [members]);
  const inactiveCount = useMemo(() => totalMembers - activeCount, [totalMembers, activeCount]);
  const withInsuranceCount = useMemo(() => members.filter((m) => m.insurance_plan_id).length, [members]);

  const totalPages = Math.max(1, Math.ceil((activeTab === "titulares" ? totalMembers : totalDependents) / ITEMS_PER_PAGE));
  const showingFrom = (activeTab === "titulares" ? totalMembers : totalDependents) === 0 ? 0 : (page - 1) * ITEMS_PER_PAGE + 1;
  const showingTo = Math.min(page * ITEMS_PER_PAGE, activeTab === "titulares" ? totalMembers : totalDependents);

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <HeartPulse className="h-6 w-6 text-primary" />
            Sócios
          </h1>
          <p className="text-sm text-muted-foreground">
            Gerencie o cadastro dos seus sócios
          </p>
          <RealtimeIndicator className="mt-1" />
        </div>
        {canManageMembers() && (
          <Button
            className="bg-primary hover:bg-primary/90"
            onClick={() => navigate("/dashboard/patients/new")}
          >
            <Plus className="h-4 w-4 mr-2" />
            Novo Sócio
          </Button>
        )}
      </div>

      {/* TABS - Titulares / Dependentes / Contracheques */}
      <div className="flex items-center gap-1 border-b">
        <button
          onClick={() => {
            setActiveTab("titulares");
            setPage(1);
          }}
          className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
            activeTab === "titulares"
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <div className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Titulares
          </div>
          {activeTab === "titulares" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t" />
          )}
        </button>
        <button
          onClick={() => {
            setActiveTab("dependentes");
            setPage(1);
          }}
          className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
            activeTab === "dependentes"
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Dependentes
          </div>
          {activeTab === "dependentes" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t" />
          )}
        </button>
        <button
          onClick={() => navigate("/union/socios/contracheques")}
          className="px-4 py-2.5 text-sm font-medium transition-colors relative text-muted-foreground hover:text-foreground"
        >
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Contracheques
          </div>
        </button>
      </div>

      {/* SEARCH - Primary Focus */}
      <Card className="border-2 border-primary/30 bg-gradient-to-r from-primary/5 to-transparent shadow-lg">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-primary" />
              <Input
                placeholder={
                  activeTab === "titulares"
                    ? "Buscar por nome, CPF ou telefone..."
                    : "Buscar dependente por nome ou CPF..."
                }
                value={activeTab === "titulares" ? searchTerm : dependentsSearch}
                onChange={(e) =>
                  activeTab === "titulares"
                    ? setSearchTerm(e.target.value)
                    : setDependentsSearch(e.target.value)
                }
                className="pl-12 h-12 text-base border-2 border-primary/20 focus:border-primary bg-background shadow-sm"
                autoFocus
              />
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              {activeTab === "titulares" && (
                <Select 
                  value={cardFilter} 
                  onValueChange={(value: "all" | "valid" | "expired" | "no-card") => {
                    setCardFilter(value);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-[180px] h-10">
                    <CreditCard className="h-4 w-4 mr-2 text-muted-foreground" />
                    <SelectValue placeholder="Filtrar carteirinha" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas carteirinhas</SelectItem>
                    <SelectItem value="valid">Carteirinhas válidas</SelectItem>
                    <SelectItem value="expired">Carteirinhas vencidas</SelectItem>
                    <SelectItem value="no-card">Sem carteirinha</SelectItem>
                  </SelectContent>
                </Select>
              )}
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50">
                <Switch
                  id="show-inactive"
                  checked={showInactive}
                  onCheckedChange={(checked) => {
                    setShowInactive(checked);
                    setPage(1);
                  }}
                />
                <Label htmlFor="show-inactive" className="text-sm cursor-pointer whitespace-nowrap">
                  Mostrar inativos
                </Label>
              </div>
              <Badge variant="secondary" className="h-8 px-3 text-sm font-medium">
                {activeTab === "titulares" ? totalMembers : totalDependents} resultado
                {(activeTab === "titulares" ? totalMembers : totalDependents) !== 1 ? "s" : ""}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards - Compact row (only for Titulares) */}
      {activeTab === "titulares" && (
        <div className="grid grid-cols-4 gap-2">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20">
            <HeartPulse className="h-4 w-4 text-primary" />
            <div>
              <span className="text-xs text-muted-foreground">Total</span>
              <p className="text-lg font-bold text-foreground leading-none">{totalMembers}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
            <UserCheck className="h-4 w-4 text-emerald-500" />
            <div>
              <span className="text-xs text-muted-foreground">Ativos</span>
              <p className="text-lg font-bold text-emerald-600 leading-none">{activeCount}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-500/5 border border-rose-500/20">
            <UserX className="h-4 w-4 text-rose-500" />
            <div>
              <span className="text-xs text-muted-foreground">Inativos</span>
              <p className="text-lg font-bold text-rose-600 leading-none">
                {showInactive ? members.length : inactiveCount}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/5 border border-blue-500/20">
            <Shield className="h-4 w-4 text-blue-500" />
            <div>
              <span className="text-xs text-muted-foreground">Convênio</span>
              <p className="text-lg font-bold text-blue-600 leading-none">{withInsuranceCount}</p>
            </div>
          </div>
        </div>
      )}

      {/* Alerts Panel (only for Titulares) */}
      {activeTab === "titulares" && <PatientAlertsPanel />}

      {/* Members List (Titulares) */}
      {activeTab === "titulares" && (
        <Card>
          <div className="overflow-x-auto">
            {loading ? (
              <div className="text-center py-12 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                Carregando sócios...
              </div>
            ) : members.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">Sócio</TableHead>
                    <TableHead className="hidden sm:table-cell font-semibold">CPF</TableHead>
                    <TableHead className="font-semibold">Telefone</TableHead>
                    <TableHead className="hidden lg:table-cell font-semibold">Convênio</TableHead>
                    <TableHead className="hidden md:table-cell font-semibold">Carteirinha</TableHead>
                    {isAdmin && (
                      <TableHead className="hidden xl:table-cell font-semibold">Limite/Mês</TableHead>
                    )}
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => (
                    <TableRow
                      key={member.id}
                      className={`h-12 hover:bg-muted/30 transition-colors ${
                        member.is_active === false ? "opacity-60" : ""
                      }`}
                    >
                      <TableCell className="py-2">
                        <div className="flex items-center gap-2">
                          <div
                            className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                              member.is_active === false
                                ? "bg-muted text-muted-foreground"
                                : "bg-primary/10 text-primary"
                            }`}
                          >
                            <User className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <button
                              onClick={() => handleOpenEdit(member)}
                              className="font-medium text-sm text-primary hover:underline text-left truncate max-w-[180px] block"
                            >
                              {member.name}
                            </button>
                            <div className="flex items-center gap-2 mt-0.5">
                              {member.birth_date && (
                                <span className="text-xs text-muted-foreground">
                                  {calculateAge(member.birth_date)} anos
                                </span>
                              )}
                              {member.is_active === false && (
                                <Badge
                                  variant="outline"
                                  className="text-xs bg-rose-50 text-rose-700 border-rose-200"
                                >
                                  Inativo
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell py-2">
                        {member.cpf ? (
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                            {formatCPF(member.cpf)}
                          </code>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="py-2">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {formatPhone(member.phone) || "—"}
                        </span>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell py-2">
                        {member.insurance_plan ? (
                          <Badge variant="secondary" className="text-xs">
                            {member.insurance_plan.name}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell py-2">
                        <InlineCardExpiryEdit
                          entityId={member.id}
                          entityType="patient"
                          currentExpiryDate={member.card_expires_at || null}
                          cardNumber={member.card_number}
                          onUpdate={fetchMembers}
                        />
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="hidden xl:table-cell py-2">
                          <InlineAppointmentLimitEdit
                            patientId={member.id}
                            patientName={member.name}
                            currentLimit={member.max_appointments_per_month ?? null}
                            clinicDefault={clinicDefaultLimit}
                            onUpdate={fetchMembers}
                          />
                        </TableCell>
                      )}
                      <TableCell className="text-right py-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-popover">
                            <DropdownMenuItem onClick={() => handleViewMember(member.id)}>
                              <User className="h-4 w-4 mr-2" />
                              Ver perfil
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleOpenEdit(member)}>
                              <FileText className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                navigate(`/dashboard/patients/${member.id}/attachments`)
                              }
                            >
                              <Paperclip className="h-4 w-4 mr-2" />
                              Anexos
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                if ((member.dependents_count || 0) > 0) {
                                  navigate(
                                    `/dashboard/patients/${member.id}/edit?tab=dependentes`
                                  );
                                } else {
                                  navigate(
                                    `/dashboard/patients/${member.id}/edit?tab=dependentes&dependentes=true`
                                  );
                                }
                              }}
                            >
                              <Users className="h-4 w-4 mr-2" />
                              {(member.dependents_count || 0) > 0
                                ? `Dependentes (${member.dependents_count})`
                                : "Novo dependente"}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <HeartPulse className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="mb-4">Nenhum sócio encontrado</p>
                {canManageMembers() && (
                  <Button variant="outline" onClick={() => navigate("/dashboard/patients/new")}>
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar sócio
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-xs text-muted-foreground">
                Mostrando {showingFrom} a {showingTo} de {totalMembers}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (page <= 3) {
                    pageNum = i + 1;
                  } else if (page >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = page - 2 + i;
                  }
                  return (
                    <Button
                      key={pageNum}
                      variant={page === pageNum ? "default" : "outline"}
                      size="icon"
                      className="h-8 w-8 text-xs"
                      onClick={() => setPage(pageNum)}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Dependents List */}
      {activeTab === "dependentes" && (
        <Card>
          <div className="overflow-x-auto">
            {dependentsLoading ? (
              <div className="text-center py-12 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                Carregando dependentes...
              </div>
            ) : dependents.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">Dependente</TableHead>
                    <TableHead className="hidden sm:table-cell font-semibold">CPF</TableHead>
                    <TableHead className="font-semibold">Parentesco</TableHead>
                    <TableHead className="font-semibold">Titular</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dependents.map((dep) => (
                    <TableRow
                      key={dep.id}
                      className={`h-12 hover:bg-muted/30 transition-colors ${
                        dep.is_active === false ? "opacity-60" : ""
                      }`}
                    >
                      <TableCell className="py-2">
                        <div className="flex items-center gap-2">
                          <div
                            className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                              dep.is_active === false
                                ? "bg-muted text-muted-foreground"
                                : "bg-violet-100 text-violet-600"
                            }`}
                          >
                            <Users className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <button
                              onClick={() =>
                                navigate(
                                  `/dashboard/patients/${dep.patient_id}/edit?tab=dependentes&editDependent=${dep.id}`
                                )
                              }
                              className="font-medium text-sm text-primary hover:underline text-left truncate max-w-[180px] block"
                            >
                              {dep.name}
                            </button>
                            <div className="flex items-center gap-2 mt-0.5">
                              {dep.birth_date && (
                                <span className="text-xs text-muted-foreground">
                                  {calculateAge(dep.birth_date)} anos
                                </span>
                              )}
                              {dep.is_active === false && (
                                <Badge
                                  variant="outline"
                                  className="text-xs bg-rose-50 text-rose-700 border-rose-200"
                                >
                                  Inativo
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell py-2">
                        {dep.cpf ? (
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                            {formatCPF(dep.cpf)}
                          </code>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="py-2">
                        <Badge variant="secondary" className="text-xs">
                          {dep.relationship || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2">
                        <button
                          onClick={() => navigate(`/dashboard/patients/${dep.patient_id}/edit`)}
                          className="text-xs text-primary hover:underline truncate max-w-[150px] block"
                        >
                          {dep.patient?.name || "—"}
                        </button>
                      </TableCell>
                      <TableCell className="py-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() =>
                            navigate(
                              `/dashboard/patients/${dep.patient_id}/edit?tab=dependentes&editDependent=${dep.id}`
                            )
                          }
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum dependente encontrado</p>
              </div>
            )}
          </div>

          {/* Pagination for Dependents */}
          {totalPages > 1 && activeTab === "dependentes" && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-xs text-muted-foreground">
                Mostrando {showingFrom} a {showingTo} de {totalDependents}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (page <= 3) {
                    pageNum = i + 1;
                  } else if (page >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = page - 2 + i;
                  }
                  return (
                    <Button
                      key={pageNum}
                      variant={page === pageNum ? "default" : "outline"}
                      size="icon"
                      className="h-8 w-8 text-xs"
                      onClick={() => setPage(pageNum)}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
