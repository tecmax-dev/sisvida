import { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { 
  Building2, 
  LogIn, 
  FileText, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  XCircle,
  RefreshCw,
  ExternalLink,
  Bell,
  LogOut,
  Receipt,
  Calendar,
  DollarSign,
  AlertTriangle,
  Loader2,
  Filter,
  LayoutGrid,
  LayoutList,
  Search,
  TrendingUp,
  X
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Clinic {
  id: string;
  name: string;
  logo_url: string | null;
  phone: string | null;
}

interface Employer {
  id: string;
  name: string;
  cnpj: string;
  clinic_id: string;
}

interface Contribution {
  id: string;
  amount: number;
  due_date: string;
  status: string;
  competence_month: number;
  competence_year: number;
  lytex_url: string | null;
  lytex_invoice_id: string | null;
  paid_at: string | null;
  portal_reissue_count: number;
  contribution_type: { name: string } | null;
}

interface ReissueRequest {
  id: string;
  contribution_id: string;
  status: string;
  reason: string;
  created_at: string;
  new_lytex_url: string | null;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode; bgClass: string }> = {
  pending: { label: "Pendente", color: "bg-amber-100 text-amber-700 border-amber-300", icon: <Clock className="h-3 w-3" />, bgClass: "bg-amber-500" },
  paid: { label: "Pago", color: "bg-emerald-100 text-emerald-700 border-emerald-300", icon: <CheckCircle2 className="h-3 w-3" />, bgClass: "bg-emerald-500" },
  overdue: { label: "Vencido", color: "bg-red-100 text-red-700 border-red-300", icon: <AlertCircle className="h-3 w-3" />, bgClass: "bg-red-500" },
  cancelled: { label: "Cancelado", color: "bg-gray-100 text-gray-600 border-gray-300", icon: <XCircle className="h-3 w-3" />, bgClass: "bg-gray-400" },
  awaiting_value: { label: "Aguardando Valor", color: "bg-purple-100 text-purple-700 border-purple-300", icon: <DollarSign className="h-3 w-3" />, bgClass: "bg-purple-500" },
};

const monthNames = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez"
];

const monthNamesFull = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export default function EmployerPortal() {
  const { clinicSlug } = useParams();
  const [cnpj, setCnpj] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [employer, setEmployer] = useState<Employer | null>(null);
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [reissueRequests, setReissueRequests] = useState<ReissueRequest[]>([]);
  const [selectedContribution, setSelectedContribution] = useState<Contribution | null>(null);
  const [showReissueDialog, setShowReissueDialog] = useState(false);
  const [showAlertDialog, setShowAlertDialog] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [isGeneratingReissue, setIsGeneratingReissue] = useState(false);

  // Dialog de definir valor
  const [showSetValueDialog, setShowSetValueDialog] = useState(false);
  const [newValue, setNewValue] = useState("");
  const [isSettingValue, setIsSettingValue] = useState(false);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");

  // Load clinic by slug
  useEffect(() => {
    if (clinicSlug) {
      loadClinicBySlug(clinicSlug);
    }
  }, [clinicSlug]);

  const loadClinicBySlug = async (slug: string) => {
    try {
      console.log("[EmployerPortal] Loading clinic by slug:", slug);
      const { data, error } = await supabase
        .from("clinics")
        .select("id, name, logo_url, phone")
        .eq("slug", slug)
        .maybeSingle();
      
      console.log("[EmployerPortal] Clinic data:", data, "Error:", error);
      
      if (!error && data) {
        setClinic(data);
      }
    } catch (err) {
      console.error("Error loading clinic:", err);
    }
  };

  const loadClinicById = async (clinicId: string) => {
    try {
      const { data, error } = await supabase
        .from("clinics")
        .select("id, name, logo_url, phone")
        .eq("id", clinicId)
        .single();
      
      if (!error && data) {
        setClinic(data);
      }
    } catch (err) {
      console.error("Error loading clinic:", err);
    }
  };

  // Extract unique contribution types and years
  const contributionTypes = useMemo(() => {
    const types = new Set(contributions.map(c => c.contribution_type?.name).filter(Boolean));
    return Array.from(types) as string[];
  }, [contributions]);

  const contributionYears = useMemo(() => {
    const years = new Set(contributions.map(c => c.competence_year));
    return Array.from(years).sort((a, b) => b - a);
  }, [contributions]);

  // Format CNPJ
  const formatCnpj = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    return numbers
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2")
      .slice(0, 18);
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format((cents || 0) / 100);
  };

  const handleLogin = async () => {
    if (!cnpj || !accessCode) {
      toast.error("Preencha todos os campos");
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("employer-portal-auth", {
        body: { action: "login", cnpj, access_code: accessCode },
      });

      if (error || data.error) {
        toast.error(data?.error || "Erro ao fazer login");
        return;
      }

      setEmployer(data.employer);
      sessionStorage.setItem("employer_session", JSON.stringify(data.employer));
      
      // Load clinic info after login
      if (data.employer.clinic_id) {
        loadClinicById(data.employer.clinic_id);
      }
      
      toast.success(`Bem-vindo, ${data.employer.name}!`);
      loadContributions(data.employer.id);
    } catch (err) {
      toast.error("Erro de conexão");
    } finally {
      setIsLoading(false);
    }
  };

  const loadContributions = async (employerId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("employer-portal-auth", {
        body: { action: "get_contributions", employer_id: employerId },
      });

      if (!error && data.contributions) {
        setContributions(data.contributions);
        
        const overdue = data.contributions.filter((c: Contribution) => c.status === "overdue");
        if (overdue.length > 0) {
          const overdueCents = overdue.reduce((sum: number, c: Contribution) => sum + (c.amount || 0), 0);
          setAlertMessage(`Você possui ${overdue.length} boleto(s) vencido(s) totalizando ${formatCurrency(overdueCents)}. Regularize sua situação para evitar pendências.`);
          setShowAlertDialog(true);
        }
      }

      const { data: reqData } = await supabase.functions.invoke("employer-portal-auth", {
        body: { action: "get_reissue_requests", employer_id: employerId },
      });
      if (reqData?.requests) {
        setReissueRequests(reqData.requests);
      }
    } catch (err) {
      toast.error("Erro ao carregar dados");
    }
  };

  const handleGenerateReissue = async () => {
    if (!selectedContribution || !employer || !newDueDate) {
      toast.error("Selecione uma nova data de vencimento");
      return;
    }

    setIsGeneratingReissue(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-boleto-reissue", {
        body: {
          contribution_id: selectedContribution.id,
          new_due_date: newDueDate,
          portal_type: "employer",
          portal_id: employer.id,
        },
      });

      if (error || data.error) {
        toast.error(data?.error || "Erro ao gerar 2ª via");
        return;
      }

      toast.success(data.message || "Segunda via gerada com sucesso!");
      setShowReissueDialog(false);
      setNewDueDate("");
      setSelectedContribution(null);
      loadContributions(employer.id);

      // Abrir o novo boleto automaticamente se disponível
      if (data.lytex_invoice_url) {
        window.open(data.lytex_invoice_url, "_blank");
      }
    } catch (err) {
      toast.error("Erro de conexão");
    } finally {
      setIsGeneratingReissue(false);
    }
  };

  const handleSetValue = async () => {
    if (!selectedContribution || !employer || !newValue) {
      toast.error("Informe o valor da contribuição");
      return;
    }

    setIsSettingValue(true);
    try {
      const valueInCents = Math.round(parseFloat(newValue.replace(",", ".")) * 100);
      
      if (isNaN(valueInCents) || valueInCents <= 0) {
        toast.error("Valor inválido");
        return;
      }

      const { data, error } = await supabase.functions.invoke("set-contribution-value", {
        body: {
          contribution_id: selectedContribution.id,
          value: valueInCents,
          portal_type: "employer",
          portal_id: employer.id,
        },
      });

      if (error || data.error) {
        toast.error(data?.error || "Erro ao definir valor");
        return;
      }

      toast.success(data.message || "Valor definido e boleto gerado!");
      setShowSetValueDialog(false);
      setNewValue("");
      setSelectedContribution(null);
      loadContributions(employer.id);

      if (data.lytex_invoice_url) {
        window.open(data.lytex_invoice_url, "_blank");
      }
    } catch (err) {
      toast.error("Erro de conexão");
    } finally {
      setIsSettingValue(false);
    }
  };

  const getMinDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split("T")[0];
  };

  const handleLogout = () => {
    setEmployer(null);
    setContributions([]);
    setReissueRequests([]);
    sessionStorage.removeItem("employer_session");
    setCnpj("");
    setAccessCode("");
  };

  const clearFilters = () => {
    setStatusFilter("all");
    setTypeFilter("all");
    setYearFilter("all");
    setSearchTerm("");
  };

  useEffect(() => {
    const saved = sessionStorage.getItem("employer_session");
    if (saved) {
      const emp = JSON.parse(saved);
      setEmployer(emp);
      loadContributions(emp.id);
      
      // Load clinic info for saved session
      if (emp.clinic_id) {
        loadClinicById(emp.clinic_id);
      }
    }
  }, []);

  // Filtered contributions
  const filteredContributions = useMemo(() => {
    return contributions.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (typeFilter !== "all" && c.contribution_type?.name !== typeFilter) return false;
      if (yearFilter !== "all" && c.competence_year.toString() !== yearFilter) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const competence = `${monthNamesFull[c.competence_month - 1]}/${c.competence_year}`.toLowerCase();
        const type = (c.contribution_type?.name || "").toLowerCase();
        if (!competence.includes(term) && !type.includes(term)) return false;
      }
      return true;
    });
  }, [contributions, statusFilter, typeFilter, yearFilter, searchTerm]);

  const stats = useMemo(() => ({
    total: contributions.length,
    paid: contributions.filter(c => c.status === "paid").length,
    pending: contributions.filter(c => c.status === "pending").length,
    overdue: contributions.filter(c => c.status === "overdue").length,
    totalValue: contributions.reduce((sum, c) => sum + (c.amount || 0), 0),
    paidValue: contributions.filter(c => c.status === "paid").reduce((sum, c) => sum + (c.amount || 0), 0),
    pendingValue: contributions.filter(c => c.status === "pending").reduce((sum, c) => sum + (c.amount || 0), 0),
    overdueValue: contributions.filter(c => c.status === "overdue").reduce((sum, c) => sum + (c.amount || 0), 0),
  }), [contributions]);

  const hasActiveFilters = statusFilter !== "all" || typeFilter !== "all" || yearFilter !== "all" || searchTerm;

  // Login Screen
  if (!employer) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-cta/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-2xl border-0 bg-card/95 backdrop-blur-sm">
          <CardHeader className="text-center pb-2">
            {clinic?.logo_url ? (
              <div className="mx-auto mb-4">
                <img 
                  src={clinic.logo_url} 
                  alt={clinic.name} 
                  className="h-16 w-auto max-w-[200px] object-contain"
                />
              </div>
            ) : (
              <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-cta flex items-center justify-center mb-4 shadow-lg">
                <Building2 className="h-8 w-8 text-white" />
              </div>
            )}
            <CardTitle className="text-2xl font-bold">
              {clinic?.name ? `Portal ${clinic.name}` : "Portal da Empresa"}
            </CardTitle>
            <CardDescription className="text-base">
              Acesse seus boletos e contribuições
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">CNPJ</label>
              <Input
                placeholder="00.000.000/0000-00"
                value={cnpj}
                onChange={(e) => setCnpj(formatCnpj(e.target.value))}
                className="h-12 text-lg"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Código de Acesso</label>
              <Input
                placeholder="Digite o código"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                className="h-12 text-lg font-mono tracking-widest"
                maxLength={8}
              />
            </div>
            <Button 
              onClick={handleLogin} 
              disabled={isLoading}
              className="w-full h-12 text-lg bg-gradient-to-r from-primary to-cta hover:opacity-90"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
              ) : (
                <LogIn className="h-5 w-5 mr-2" />
              )}
              Entrar
            </Button>
            <p className="text-xs text-center text-muted-foreground pt-2">
              {clinic?.phone 
                ? `Não possui código de acesso? Ligue: ${clinic.phone}` 
                : "Não possui código de acesso? Entre em contato com o sindicato."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Dashboard
  return (
    <div className="min-h-screen bg-muted/30">
      {/* Alert Dialog */}
      <Dialog open={showAlertDialog} onOpenChange={setShowAlertDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
            <DialogTitle className="text-center text-xl">Atenção!</DialogTitle>
            <DialogDescription className="text-center text-base">
              {alertMessage}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center">
            <Button onClick={() => setShowAlertDialog(false)} className="w-full sm:w-auto">
              Entendi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reissue Dialog - Gerar 2ª Via */}
      <Dialog open={showReissueDialog} onOpenChange={(open) => {
        setShowReissueDialog(open);
        if (!open) {
          setNewDueDate("");
          setSelectedContribution(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Gerar 2ª Via do Boleto
            </DialogTitle>
            <DialogDescription>
              {selectedContribution && (
                <span>
                  Competência: {monthNamesFull[selectedContribution.competence_month - 1]}/{selectedContribution.competence_year} • 
                  Valor: {formatCurrency(selectedContribution.amount || 0)}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedContribution && (
              <div className="flex items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>
                  Reemissões utilizadas: {selectedContribution.portal_reissue_count || 0}/2. 
                  {(selectedContribution.portal_reissue_count || 0) >= 1 && " Após o limite, somente o gestor poderá emitir."}
                </span>
              </div>
            )}
            <div>
              <label className="text-sm font-medium block mb-2">Nova Data de Vencimento *</label>
              <Input
                type="date"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                min={getMinDate()}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground mt-1">
                O boleto anterior será cancelado e um novo será gerado com a nova data
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReissueDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleGenerateReissue} disabled={isGeneratingReissue || !newDueDate}>
              {isGeneratingReissue ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Gerando...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Gerar Boleto
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <header className="bg-card border-b sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {clinic?.logo_url ? (
              <img 
                src={clinic.logo_url} 
                alt={clinic.name} 
                className="h-10 w-auto max-w-[120px] object-contain"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-cta flex items-center justify-center">
                <Building2 className="h-5 w-5 text-white" />
              </div>
            )}
            <div className="border-l pl-3">
              <h1 className="font-bold text-base sm:text-lg leading-tight">{employer.name}</h1>
              <p className="text-xs text-muted-foreground">{formatCnpj(employer.cnpj)}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground">
            <LogOut className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Sair</span>
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-4 space-y-4">
        {/* Compact Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <button 
            onClick={() => setStatusFilter("all")} 
            className={`p-3 rounded-xl border transition-all text-left ${statusFilter === "all" ? "ring-2 ring-primary bg-primary/5" : "bg-card hover:shadow-md"}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Receipt className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-lg font-bold">{stats.total}</p>
                </div>
              </div>
              <TrendingUp className="h-4 w-4 text-muted-foreground/50" />
            </div>
          </button>

          <button 
            onClick={() => setStatusFilter("paid")} 
            className={`p-3 rounded-xl border transition-all text-left ${statusFilter === "paid" ? "ring-2 ring-emerald-500 bg-emerald-50" : "bg-card hover:shadow-md"}`}
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pagos</p>
                <p className="text-lg font-bold text-emerald-600">{stats.paid}</p>
              </div>
            </div>
          </button>

          <button 
            onClick={() => setStatusFilter("pending")} 
            className={`p-3 rounded-xl border transition-all text-left ${statusFilter === "pending" ? "ring-2 ring-amber-500 bg-amber-50" : "bg-card hover:shadow-md"}`}
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                <Clock className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pendentes</p>
                <p className="text-lg font-bold text-amber-600">{stats.pending}</p>
              </div>
            </div>
          </button>

          <button 
            onClick={() => setStatusFilter("overdue")} 
            className={`p-3 rounded-xl border transition-all text-left ${statusFilter === "overdue" ? "ring-2 ring-red-500 bg-red-50" : "bg-card hover:shadow-md"}`}
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                <AlertCircle className="h-4 w-4 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Vencidos</p>
                <p className="text-lg font-bold text-red-600">{stats.overdue}</p>
              </div>
            </div>
          </button>
        </div>

        {/* Overdue Alert Banner - More compact */}
        {stats.overdue > 0 && statusFilter !== "overdue" && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-red-50 border border-red-200 dark:bg-red-950/30 dark:border-red-900">
            <Bell className="h-5 w-5 text-red-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-red-800 dark:text-red-200">
                {stats.overdue} boleto(s) em atraso • {formatCurrency(stats.overdueValue)}
              </p>
            </div>
            <Button 
              size="sm" 
              variant="outline" 
              className="border-red-300 text-red-700 hover:bg-red-100 shrink-0"
              onClick={() => setStatusFilter("overdue")}
            >
              Ver
            </Button>
          </div>
        )}

        {/* Filters + Table Card */}
        <Card className="overflow-hidden">
          {/* Filters Header */}
          <div className="p-3 border-b bg-muted/30">
            <div className="flex flex-col sm:flex-row gap-2">
              {/* Search */}
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar competência..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>

              {/* Filter Selects */}
              <div className="flex gap-2 flex-wrap">
                {contributionTypes.length > 1 && (
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="h-9 w-[140px]">
                      <Filter className="h-3 w-3 mr-1" />
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os tipos</SelectItem>
                      {contributionTypes.map(type => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {contributionYears.length > 1 && (
                  <Select value={yearFilter} onValueChange={setYearFilter}>
                    <SelectTrigger className="h-9 w-[100px]">
                      <Calendar className="h-3 w-3 mr-1" />
                      <SelectValue placeholder="Ano" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {contributionYears.map(year => (
                        <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 px-2">
                    <X className="h-4 w-4 mr-1" />
                    Limpar
                  </Button>
                )}

                <div className="hidden sm:flex border-l pl-2 ml-auto gap-1">
                  <Button
                    variant={viewMode === "table" ? "secondary" : "ghost"}
                    size="sm"
                    className="h-9 w-9 p-0"
                    onClick={() => setViewMode("table")}
                  >
                    <LayoutList className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === "cards" ? "secondary" : "ghost"}
                    size="sm"
                    className="h-9 w-9 p-0"
                    onClick={() => setViewMode("cards")}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                </div>

                <Button 
                  variant="outline" 
                  size="sm"
                  className="h-9"
                  onClick={() => loadContributions(employer.id)}
                >
                  <RefreshCw className="h-3 w-3 sm:mr-1" />
                  <span className="hidden sm:inline">Atualizar</span>
                </Button>
              </div>
            </div>

            {/* Active filters display */}
            {hasActiveFilters && (
              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                <span>Filtros:</span>
                {statusFilter !== "all" && (
                  <Badge variant="secondary" className="h-5">
                    Status: {statusConfig[statusFilter]?.label}
                  </Badge>
                )}
                {typeFilter !== "all" && (
                  <Badge variant="secondary" className="h-5">
                    Tipo: {typeFilter}
                  </Badge>
                )}
                {yearFilter !== "all" && (
                  <Badge variant="secondary" className="h-5">
                    Ano: {yearFilter}
                  </Badge>
                )}
                <span className="ml-auto">{filteredContributions.length} resultado(s)</span>
              </div>
            )}
          </div>

          {/* Content */}
          {filteredContributions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Receipt className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Nenhuma contribuição encontrada</p>
              {hasActiveFilters && (
                <Button variant="link" size="sm" onClick={clearFilters} className="mt-2">
                  Limpar filtros
                </Button>
              )}
            </div>
          ) : viewMode === "table" ? (
            <ScrollArea className="max-h-[500px]">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow>
                    <TableHead className="w-[130px]">Competência</TableHead>
                    <TableHead>Nº Documento</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-center">Vencimento</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right w-[140px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredContributions.map((contribution) => {
                    const status = statusConfig[contribution.status] || statusConfig.pending;
                    
                    // Calcular dias de atraso
                    const dueDate = new Date(contribution.due_date);
                    const today = new Date();
                    const daysDiff = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
                    const isOverdue90Days = daysDiff > 90;
                    
                    // Permitir 2ª via apenas para vencido (não pendente), não mais de 90 dias e máximo 2 reemissões
                    const reissueCount = contribution.portal_reissue_count || 0;
                    const reissueLimitReached = reissueCount >= 2;
                    const isOverdue = contribution.status === 'overdue';
                    const canGenerateReissue = isOverdue && !isOverdue90Days && !reissueLimitReached;

                    return (
                      <TableRow key={contribution.id} className="group">
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <div className={`w-1 h-8 rounded-full ${status.bgClass}`} />
                            <span>{monthNames[contribution.competence_month - 1]}/{contribution.competence_year}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs font-mono text-muted-foreground">
                            {contribution.lytex_invoice_id ? contribution.lytex_invoice_id.slice(-8).toUpperCase() : "-"}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {contribution.contribution_type?.name || "—"}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(contribution.amount || 0)}
                        </TableCell>
                        <TableCell className="text-center text-sm text-muted-foreground">
                          {format(new Date(contribution.due_date + "T12:00:00"), "dd/MM/yy")}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={`${status.color} text-xs`}>
                            {status.icon}
                            <span className="ml-1">{status.label}</span>
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {contribution.lytex_url && contribution.status !== "paid" && contribution.status !== "cancelled" && (
                              <Button size="sm" variant="outline" className="h-7 px-2" asChild>
                                <a href={contribution.lytex_url} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-3 w-3 mr-1" />
                                  Boleto
                                </a>
                              </Button>
                            )}
                            {contribution.status === 'pending' && !isOverdue90Days && (
                              <span className="text-xs text-muted-foreground italic" title="2ª via disponível somente após vencimento">
                                Aguardando vencimento
                              </span>
                            )}
                            {isOverdue && !isOverdue90Days && (
                              reissueLimitReached ? (
                                <span className="text-xs text-muted-foreground italic" title="Limite de 2 reemissões atingido. Contate o gestor.">
                                  Limite atingido
                                </span>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2"
                                  onClick={() => {
                                    setSelectedContribution(contribution);
                                    setShowReissueDialog(true);
                                  }}
                                  title={`2ª Via (${reissueCount}/2 usadas)`}
                                >
                                  <RefreshCw className="h-3 w-3 mr-1" />
                                  2ª Via
                                </Button>
                              )
                            )}
                            {contribution.status === "awaiting_value" && (
                              <Button
                                size="sm"
                                variant="default"
                                className="h-7 px-2"
                                onClick={() => {
                                  setSelectedContribution(contribution);
                                  setShowSetValueDialog(true);
                                }}
                              >
                                <DollarSign className="h-3 w-3 mr-1" />
                                Definir Valor
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          ) : (
            <div className="p-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {filteredContributions.map((contribution) => {
                const status = statusConfig[contribution.status] || statusConfig.pending;
                
                // Calcular dias de atraso
                const dueDate = new Date(contribution.due_date);
                const today = new Date();
                const daysDiff = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
                const isOverdue90Days = daysDiff > 90;
                
                // Permitir 2ª via apenas para pendente/vencido e não mais de 90 dias
                const canGenerateReissue = ["pending", "overdue"].includes(contribution.status) && !isOverdue90Days;

                return (
                  <div
                    key={contribution.id}
                    className="p-3 rounded-lg border bg-card hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${status.bgClass}`} />
                          <span className="font-semibold text-sm">
                            {monthNames[contribution.competence_month - 1]}/{contribution.competence_year}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {contribution.contribution_type?.name || "Contribuição"}
                        </p>
                      </div>
                      <Badge variant="outline" className={`${status.color} text-xs shrink-0`}>
                        {status.label}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(contribution.due_date + "T12:00:00"), "dd/MM/yy")}
                      </span>
                      <span className="font-semibold flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        {formatCurrency(contribution.amount || 0)}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      {contribution.lytex_url && contribution.status !== "paid" && contribution.status !== "cancelled" && (
                        <Button size="sm" variant="outline" className="h-7 flex-1 text-xs" asChild>
                          <a href={contribution.lytex_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3 w-3 mr-1" />
                            Ver Boleto
                          </a>
                        </Button>
                      )}
                      {canGenerateReissue && (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-7 text-xs"
                          onClick={() => {
                            setSelectedContribution(contribution);
                            setShowReissueDialog(true);
                          }}
                        >
                          <RefreshCw className="h-3 w-3 mr-1" />
                          2ª Via
                        </Button>
                      )}
                      {contribution.status === "awaiting_value" && (
                        <Button
                          size="sm"
                          variant="default"
                          className="h-7 text-xs"
                          onClick={() => {
                            setSelectedContribution(contribution);
                            setShowSetValueDialog(true);
                          }}
                        >
                          <DollarSign className="h-3 w-3 mr-1" />
                          Definir Valor
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Reissue Requests - Compact */}
        {reissueRequests.length > 0 && (
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Solicitações de 2ª Via ({reissueRequests.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {reissueRequests.slice(0, 3).map((request) => (
                  <div key={request.id} className="flex items-center justify-between px-4 py-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">
                        {format(new Date(request.created_at), "dd/MM/yy HH:mm")}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{request.reason}</p>
                    </div>
                    <Badge variant="outline" className={`shrink-0 text-xs ${
                      request.status === "completed" ? "bg-emerald-50 text-emerald-600 border-emerald-200" :
                      request.status === "processing" ? "bg-blue-50 text-blue-600 border-blue-200" :
                      request.status === "rejected" ? "bg-red-50 text-red-600 border-red-200" :
                      "bg-amber-50 text-amber-600 border-amber-200"
                    }`}>
                      {request.status === "completed" ? "Concluído" :
                       request.status === "processing" ? "Processando" :
                       request.status === "rejected" ? "Rejeitado" : "Pendente"}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t bg-card/50 py-4 mt-8">
        <div className="container mx-auto px-4 text-center text-xs text-muted-foreground">
          Portal da Empresa • Acesso seguro às suas contribuições
        </div>
      </footer>

      {/* Dialog de Definir Valor */}
      <Dialog open={showSetValueDialog} onOpenChange={(open) => {
        setShowSetValueDialog(open);
        if (!open) {
          setNewValue("");
          setSelectedContribution(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Definir Valor da Contribuição
            </DialogTitle>
            <DialogDescription>
              {selectedContribution && (
                <span>
                  {monthNamesFull[selectedContribution.competence_month - 1]}/{selectedContribution.competence_year} • {selectedContribution.contribution_type?.name || "Contribuição"}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium block mb-2">Valor (R$) *</label>
              <Input
                type="text"
                placeholder="0,00"
                value={newValue}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9,]/g, "");
                  setNewValue(val);
                }}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Após definir o valor, o boleto será gerado automaticamente
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSetValueDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSetValue} disabled={isSettingValue || !newValue}>
              {isSettingValue ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Gerando...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Gerar Boleto
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
