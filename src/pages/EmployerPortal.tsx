import { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
  Calendar,
  DollarSign,
  AlertTriangle,
  Loader2,
  Filter,
  Search,
  TrendingUp,
  X,
  ChevronRight,
  Lock,
  Handshake
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

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
  negotiation_id: string | null;
  negotiation?: {
    id: string;
    negotiation_code: string;
    status: string;
    installments_count: number;
  } | null;
}

interface ReissueRequest {
  id: string;
  contribution_id: string;
  status: string;
  reason: string;
  created_at: string;
  new_lytex_url: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: React.ReactNode }> = {
  pending: { 
    label: "Pendente", 
    color: "text-amber-700", 
    bgColor: "bg-amber-50 border-amber-200",
    icon: <Clock className="h-3.5 w-3.5" />
  },
  paid: { 
    label: "Pago", 
    color: "text-emerald-700", 
    bgColor: "bg-emerald-50 border-emerald-200",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />
  },
  overdue: { 
    label: "Vencido", 
    color: "text-red-700", 
    bgColor: "bg-red-50 border-red-200",
    icon: <AlertCircle className="h-3.5 w-3.5" />
  },
  cancelled: { 
    label: "Cancelado", 
    color: "text-slate-500", 
    bgColor: "bg-slate-50 border-slate-200",
    icon: <XCircle className="h-3.5 w-3.5" />
  },
  awaiting_value: { 
    label: "Aguardando", 
    color: "text-purple-700", 
    bgColor: "bg-purple-50 border-purple-200",
    icon: <DollarSign className="h-3.5 w-3.5" />
  },
  negotiated: { 
    label: "Em Negociação", 
    color: "text-indigo-700", 
    bgColor: "bg-indigo-50 border-indigo-200",
    icon: <Handshake className="h-3.5 w-3.5" />
  },
};

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MONTHS_FULL = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

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
  const [statusFilter, setStatusFilter] = useState("hide_cancelled");
  const [typeFilter, setTypeFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (clinicSlug) {
      loadClinicBySlug(clinicSlug);
    }
  }, [clinicSlug]);

  const loadClinicBySlug = async (slug: string) => {
    try {
      const { data, error } = await supabase
        .from("clinics")
        .select("id, name, logo_url, phone")
        .eq("slug", slug)
        .maybeSingle();
      
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

  const contributionTypes = useMemo(() => {
    const types = new Set(contributions.map(c => c.contribution_type?.name).filter(Boolean));
    return Array.from(types) as string[];
  }, [contributions]);

  const contributionYears = useMemo(() => {
    const years = new Set(contributions.map(c => c.competence_year));
    return Array.from(years).sort((a, b) => b - a);
  }, [contributions]);

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
          setAlertMessage(`Você possui ${overdue.length} boleto(s) vencido(s) totalizando ${formatCurrency(overdueCents)}. Regularize sua situação.`);
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
    setStatusFilter("hide_cancelled");
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
      
      if (emp.clinic_id) {
        loadClinicById(emp.clinic_id);
      }
    }
  }, []);

  const filteredContributions = useMemo(() => {
    return contributions.filter((c) => {
      if (statusFilter === "hide_cancelled" && c.status === "cancelled") return false;
      if (statusFilter !== "all" && statusFilter !== "hide_cancelled" && c.status !== statusFilter) return false;
      if (typeFilter !== "all" && c.contribution_type?.name !== typeFilter) return false;
      if (yearFilter !== "all" && c.competence_year.toString() !== yearFilter) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const competence = `${MONTHS_FULL[c.competence_month - 1]}/${c.competence_year}`.toLowerCase();
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
    totalValue: contributions.filter(c => c.status !== "cancelled" && c.status !== "paid").reduce((sum, c) => sum + (c.amount || 0), 0),
    paidValue: contributions.filter(c => c.status === "paid").reduce((sum, c) => sum + (c.amount || 0), 0),
    overdueValue: contributions.filter(c => c.status === "overdue").reduce((sum, c) => sum + (c.amount || 0), 0),
  }), [contributions]);

  const hasActiveFilters = (statusFilter !== "all" && statusFilter !== "hide_cancelled") || typeFilter !== "all" || yearFilter !== "all" || searchTerm;

  // Login Screen
  if (!employer) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-40" />
        
        <Card className="w-full max-w-md relative bg-white/95 backdrop-blur shadow-2xl border-0">
          <CardHeader className="text-center space-y-4 pb-2">
            {clinic?.logo_url ? (
              <img 
                src={clinic.logo_url} 
                alt={clinic.name} 
                className="h-14 mx-auto object-contain"
              />
            ) : (
              <div className="h-14 w-14 mx-auto bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg">
                <Building2 className="h-7 w-7 text-white" />
              </div>
            )}
            <div>
              <CardTitle className="text-xl font-semibold text-slate-800">Portal da Empresa</CardTitle>
              <CardDescription className="text-slate-500">
                {clinic?.name || "Acesse seus boletos e contribuições"}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cnpj" className="text-slate-700 text-sm font-medium">CNPJ</Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="cnpj"
                    placeholder="00.000.000/0000-00"
                    value={cnpj}
                    onChange={(e) => setCnpj(formatCnpj(e.target.value))}
                    className="pl-10 h-11 border-slate-200 focus:border-amber-500 focus:ring-amber-500"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="accessCode" className="text-slate-700 text-sm font-medium">Código de Acesso</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="accessCode"
                    placeholder="XXXXXXXX"
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                    className="pl-10 h-11 uppercase tracking-widest font-mono border-slate-200 focus:border-amber-500 focus:ring-amber-500"
                    maxLength={8}
                  />
                </div>
              </div>
              
              <Button 
                type="submit"
                className="w-full h-11 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-medium shadow-lg shadow-amber-500/25"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  <>
                    <LogIn className="mr-2 h-4 w-4" />
                    Acessar Portal
                  </>
                )}
              </Button>

              <p className="text-xs text-center text-slate-500 pt-2">
                {clinic?.phone 
                  ? `Não possui código? Ligue: ${clinic.phone}` 
                  : "Não possui código? Entre em contato com o sindicato."}
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Dashboard
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Alert Dialog */}
      <Dialog open={showAlertDialog} onOpenChange={setShowAlertDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
            <DialogTitle className="text-center text-xl text-slate-900">Atenção!</DialogTitle>
            <DialogDescription className="text-center text-base text-slate-600">
              {alertMessage}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center">
            <Button onClick={() => setShowAlertDialog(false)} className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700">
              Entendi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reissue Dialog */}
      <Dialog open={showReissueDialog} onOpenChange={(open) => {
        setShowReissueDialog(open);
        if (!open) {
          setNewDueDate("");
          setSelectedContribution(null);
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <RefreshCw className="h-5 w-5 text-amber-600" />
              Gerar 2ª Via
            </DialogTitle>
            <DialogDescription>
              {selectedContribution && (
                <span className="text-slate-600">
                  {MONTHS_FULL[selectedContribution.competence_month - 1]}/{selectedContribution.competence_year} • {formatCurrency(selectedContribution.amount || 0)}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {selectedContribution && (selectedContribution.portal_reissue_count || 0) > 0 && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Atenção</p>
                  <p className="text-xs mt-0.5">
                    {selectedContribution.portal_reissue_count}/2 reemissões utilizadas. Após o limite, somente o gestor poderá emitir.
                  </p>
                </div>
              </div>
            )}
            <div>
              <Label className="text-slate-700 text-sm font-medium">Nova Data de Vencimento</Label>
              <Input
                type="date"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                min={getMinDate()}
                className="mt-2 h-10 border-slate-200"
              />
              <p className="text-xs text-slate-500 mt-2">
                O boleto anterior será cancelado automaticamente.
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowReissueDialog(false)} className="border-slate-200">
              Cancelar
            </Button>
            <Button 
              onClick={handleGenerateReissue} 
              disabled={isGeneratingReissue || !newDueDate}
              className="bg-amber-600 hover:bg-amber-700"
            >
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

      {/* Set Value Dialog */}
      <Dialog open={showSetValueDialog} onOpenChange={(open) => {
        setShowSetValueDialog(open);
        if (!open) {
          setNewValue("");
          setSelectedContribution(null);
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <DollarSign className="h-5 w-5 text-purple-600" />
              Definir Valor
            </DialogTitle>
            <DialogDescription>
              {selectedContribution && (
                <span className="text-slate-600">
                  {MONTHS_FULL[selectedContribution.competence_month - 1]}/{selectedContribution.competence_year}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-slate-700 text-sm font-medium">Valor (R$)</Label>
              <Input
                type="text"
                placeholder="0,00"
                value={newValue}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9,]/g, "");
                  setNewValue(val);
                }}
                className="mt-2 h-10 text-lg font-medium border-slate-200"
              />
              <p className="text-xs text-slate-500 mt-2">
                Após definir o valor, o boleto será gerado automaticamente.
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowSetValueDialog(false)} className="border-slate-200">
              Cancelar
            </Button>
            <Button 
              onClick={handleSetValue} 
              disabled={isSettingValue || !newValue}
              className="bg-purple-600 hover:bg-purple-700"
            >
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

      {/* Header */}
      <header className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white sticky top-0 z-20 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              {clinic?.logo_url ? (
                <img 
                  src={clinic.logo_url} 
                  alt={clinic.name} 
                  className="h-9 object-contain brightness-0 invert"
                />
              ) : (
                <div className="h-9 w-9 bg-white/10 rounded-lg flex items-center justify-center">
                  <Building2 className="h-5 w-5" />
                </div>
              )}
              <div className="hidden sm:block">
                <h1 className="font-semibold text-base leading-tight">{employer.name}</h1>
                <p className="text-xs text-white/60">{formatCnpj(employer.cnpj)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => loadContributions(employer.id)}
                className="text-white/80 hover:text-white hover:bg-white/10"
              >
                <RefreshCw className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Atualizar</span>
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={handleLogout}
                className="text-white/80 hover:text-white hover:bg-white/10"
              >
                <LogOut className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Sair</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <Card 
            className={`bg-white border-0 shadow-sm hover:shadow-md transition-all cursor-pointer ${statusFilter === "all" ? "ring-2 ring-amber-500" : ""}`}
            onClick={() => setStatusFilter("all")}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{stats.total}</p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-slate-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card 
            className={`bg-white border-0 shadow-sm hover:shadow-md transition-all cursor-pointer ${statusFilter === "pending" ? "ring-2 ring-amber-500" : ""}`}
            onClick={() => setStatusFilter("pending")}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Pendentes</p>
                  <p className="text-2xl font-bold text-amber-600 mt-1">{stats.pending}</p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card 
            className={`bg-white border-0 shadow-sm hover:shadow-md transition-all cursor-pointer ${statusFilter === "overdue" ? "ring-2 ring-red-500" : ""}`}
            onClick={() => setStatusFilter("overdue")}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Vencidos</p>
                  <p className="text-2xl font-bold text-red-600 mt-1">{stats.overdue}</p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-red-50 flex items-center justify-center">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            className={`bg-white border-0 shadow-sm hover:shadow-md transition-all cursor-pointer ${statusFilter === "paid" ? "ring-2 ring-emerald-500" : ""}`}
            onClick={() => setStatusFilter("paid")}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Pagos</p>
                  <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.paid}</p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-amber-500 to-orange-600 border-0 shadow-sm col-span-2 lg:col-span-1">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-white/80 uppercase tracking-wide">A Pagar</p>
                  <p className="text-xl font-bold text-white mt-1">{formatCurrency(stats.totalValue)}</p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Overdue Alert */}
        {stats.overdue > 0 && statusFilter !== "overdue" && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200">
            <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <Bell className="h-5 w-5 text-red-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-red-800">
                Você possui {stats.overdue} boleto(s) em atraso
              </p>
              <p className="text-sm text-red-600">
                Total: {formatCurrency(stats.overdueValue)}
              </p>
            </div>
            <Button 
              size="sm" 
              variant="outline" 
              className="border-red-300 text-red-700 hover:bg-red-100 flex-shrink-0"
              onClick={() => setStatusFilter("overdue")}
            >
              Ver boletos
            </Button>
          </div>
        )}

        {/* Filters */}
        <Card className="bg-white border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="h-4 w-4 text-slate-400" />
              <span className="text-sm font-medium text-slate-600">Filtros</span>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-6 px-2 text-xs ml-auto">
                  <X className="h-3 w-3 mr-1" />
                  Limpar
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-9 text-sm border-slate-200"
                />
              </div>
              
              {contributionTypes.length > 0 && (
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="h-9 text-sm border-slate-200">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="all">Todos os tipos</SelectItem>
                    {contributionTypes.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 text-sm border-slate-200">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="hide_cancelled">Ocultar cancelados</SelectItem>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="paid">Pago</SelectItem>
                  <SelectItem value="overdue">Vencido</SelectItem>
                  <SelectItem value="awaiting_value">Aguardando</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
              
              {contributionYears.length > 0 && (
                <Select value={yearFilter} onValueChange={setYearFilter}>
                  <SelectTrigger className="h-9 text-sm border-slate-200">
                    <SelectValue placeholder="Ano" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="all">Todos os anos</SelectItem>
                    {contributionYears.map(year => (
                      <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Contributions List */}
        <Card className="bg-white border-0 shadow-sm">
          <CardHeader className="pb-3 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <FileText className="h-4 w-4 text-slate-400" />
                Contribuições
              </CardTitle>
              <Badge variant="secondary" className="bg-slate-100 text-slate-600 font-medium">
                {filteredContributions.length} registros
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {filteredContributions.length === 0 ? (
              <div className="text-center py-16">
                <FileText className="h-12 w-12 mx-auto mb-3 text-slate-200" />
                <p className="text-slate-500 text-sm">Nenhuma contribuição encontrada</p>
                {hasActiveFilters && (
                  <Button variant="link" size="sm" onClick={clearFilters} className="mt-2">
                    Limpar filtros
                  </Button>
                )}
              </div>
            ) : (
              <ScrollArea className="h-[500px]">
                <div className="divide-y divide-slate-100">
                  {filteredContributions.map((contrib) => {
                    const dueDate = new Date(contrib.due_date + "T12:00:00");
                    const today = new Date();
                    const daysDiff = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
                    const isOverdue90Days = daysDiff > 90;
                    const reissueCount = contrib.portal_reissue_count || 0;
                    const reissueLimitReached = reissueCount >= 2;
                    const isOverdue = contrib.status === 'overdue';
                    const statusConfig = STATUS_CONFIG[contrib.status] || STATUS_CONFIG.pending;
                    
                    // Verificar se está em negociação ativa
                    const isInActiveNegotiation = contrib.negotiation_id && 
                      contrib.negotiation && 
                      ['active', 'approved', 'pending_approval'].includes(contrib.negotiation.status);

                    return (
                      <div 
                        key={contrib.id} 
                        className="p-4 hover:bg-slate-50/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4">
                          {/* Left: Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <h3 className="font-medium text-slate-900 text-sm">
                                {MONTHS_FULL[contrib.competence_month - 1]}/{contrib.competence_year}
                              </h3>
                              <Badge 
                                variant="outline" 
                                className={`${statusConfig.bgColor} ${statusConfig.color} border text-xs px-2 py-0 h-5 gap-1`}
                              >
                                {statusConfig.icon}
                                {statusConfig.label}
                              </Badge>
                              {isInActiveNegotiation && (
                                <Badge 
                                  variant="outline" 
                                  className="bg-indigo-50 border-indigo-200 text-indigo-700 text-xs px-2 py-0 h-5 gap-1"
                                >
                                  <Handshake className="h-3 w-3" />
                                  Parcelamento {contrib.negotiation?.installments_count}x
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-500">
                              <span>{contrib.contribution_type?.name || "Contribuição"}</span>
                              {contrib.lytex_invoice_id && (
                                <>
                                  <span>•</span>
                                  <span className="font-mono text-slate-400">#{contrib.lytex_invoice_id.slice(-8).toUpperCase()}</span>
                                </>
                              )}
                              {isInActiveNegotiation && contrib.negotiation && (
                                <>
                                  <span>•</span>
                                  <span className="font-mono text-indigo-500">Neg. {contrib.negotiation.negotiation_code}</span>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Center: Date & Value */}
                          <div className="hidden md:flex items-center gap-6 text-sm">
                            <div className="text-center">
                              <p className="text-xs text-slate-400 mb-0.5">Vencimento</p>
                              <p className={`font-medium ${isOverdue ? 'text-red-600' : 'text-slate-700'}`}>
                                {format(dueDate, "dd/MM/yyyy")}
                              </p>
                            </div>
                            <div className="text-center min-w-[100px]">
                              <p className="text-xs text-slate-400 mb-0.5">Valor</p>
                              <p className="font-semibold text-slate-900">
                                {formatCurrency(contrib.amount || 0)}
                              </p>
                            </div>
                          </div>

                          {/* Right: Actions */}
                          <div className="flex items-center gap-2">
                            {contrib.lytex_url && contrib.status !== "paid" && contrib.status !== "cancelled" && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-8 px-3 text-xs border-slate-200 hover:bg-slate-50"
                                      onClick={() => window.open(contrib.lytex_url!, "_blank")}
                                    >
                                      <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                                      Boleto
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Abrir boleto</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            
                            {contrib.status === 'pending' && !isOverdue90Days && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="text-xs text-slate-400 italic px-2">
                                      Aguardando venc.
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>2ª via disponível após vencimento</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            
                            {/* Boleto em negociação - bloquear 2ª via */}
                            {isInActiveNegotiation && isOverdue && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="text-xs text-indigo-500 flex items-center gap-1 px-2">
                                      <Handshake className="h-3 w-3" />
                                      Em parcelamento
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Esta contribuição faz parte de um parcelamento ativo</p>
                                    <p className="text-xs opacity-80">Contate o gestor para alterações</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            
                            {/* 2ª via normal - apenas para boletos não em negociação */}
                            {!isInActiveNegotiation && isOverdue && !isOverdue90Days && (
                              reissueLimitReached ? (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="text-xs text-slate-400 flex items-center gap-1">
                                        <AlertCircle className="h-3 w-3" />
                                        Limite
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Limite de {reissueCount} reemissões atingido</p>
                                      <p className="text-xs opacity-80">Contate o gestor</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              ) : (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 px-3 text-xs hover:bg-amber-50 hover:text-amber-700"
                                        onClick={() => {
                                          setSelectedContribution(contrib);
                                          setShowReissueDialog(true);
                                        }}
                                      >
                                        <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                                        2ª Via
                                        {reissueCount > 0 && (
                                          <span className="ml-1 text-slate-400">({reissueCount}/2)</span>
                                        )}
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Gerar nova via com nova data</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )
                            )}
                            
                            {contrib.status === "awaiting_value" && (
                              <Button
                                size="sm"
                                className="h-8 px-3 text-xs bg-purple-600 hover:bg-purple-700"
                                onClick={() => {
                                  setSelectedContribution(contrib);
                                  setShowSetValueDialog(true);
                                }}
                              >
                                <DollarSign className="h-3.5 w-3.5 mr-1.5" />
                                Definir Valor
                              </Button>
                            )}

                            <ChevronRight className="h-4 w-4 text-slate-300 hidden lg:block" />
                          </div>
                        </div>

                        {/* Mobile: Extra Info */}
                        <div className="flex md:hidden items-center gap-4 mt-3 text-xs text-slate-500">
                          <span className={isOverdue ? 'text-red-600' : ''}>
                            Venc: {format(dueDate, "dd/MM/yyyy")}
                          </span>
                          <span>•</span>
                          <span className="font-semibold text-slate-900">{formatCurrency(contrib.amount || 0)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Reissue Requests */}
        {reissueRequests.length > 0 && (
          <Card className="bg-white border-0 shadow-sm">
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-slate-400" />
                Solicitações de 2ª Via ({reissueRequests.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100">
                {reissueRequests.slice(0, 3).map((request) => (
                  <div key={request.id} className="flex items-center justify-between p-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-700">
                        {format(new Date(request.created_at), "dd/MM/yyyy HH:mm")}
                      </p>
                      <p className="text-xs text-slate-500 truncate">{request.reason}</p>
                    </div>
                    <Badge variant="outline" className={`text-xs ${
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
    </div>
  );
}
