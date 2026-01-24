import { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { 
  Building2, 
  FileText, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  XCircle,
  RefreshCw,
  DollarSign,
  AlertTriangle,
  Loader2,
  Handshake,
  History,
  FileStack,
  MoreHorizontal,
  ExternalLink,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Sun,
  Search,
  Bell
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { formatCompetence } from "@/lib/competence-format";
import { PortalLoginScreen } from "@/components/portal/PortalLoginScreen";
import { PortalConventionsSection } from "@/components/portal/PortalServicesSection";

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
  category_id?: string | null;
}

interface Contribution {
  id: string;
  value: number;
  due_date: string;
  status: string;
  competence_month: number;
  competence_year: number;
  lytex_invoice_url: string | null;
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

type ActiveView = "home" | "contributions" | "documents" | "history";
type ContributionTab = "pending" | "overdue" | "paid" | "all";

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
  const [showSetValueDialog, setShowSetValueDialog] = useState(false);
  const [newValue, setNewValue] = useState("");
  const [isSettingValue, setIsSettingValue] = useState(false);
  const [generatingInvoiceId, setGeneratingInvoiceId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ActiveView>("home");
  const [activeTab, setActiveTab] = useState<ContributionTab>("pending");
  const [searchTerm, setSearchTerm] = useState("");
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [currentPage, setCurrentPage] = useState(1);

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

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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
        
        // Só exibe alerta de vencidos se for a partir de Dez/2025
        const overdueFromDec2025 = data.contributions.filter((c: Contribution) => 
          c.status === "overdue" && 
          (c.competence_year > 2025 || (c.competence_year === 2025 && c.competence_month >= 12))
        );
        
        if (overdueFromDec2025.length > 0) {
          const overdueCents = overdueFromDec2025.reduce((sum: number, c: Contribution) => sum + (c.value || 0), 0);
          setAlertMessage(`Você possui ${overdueFromDec2025.length} boleto(s) vencido(s) totalizando ${formatCurrency(overdueCents)}. Regularize sua situação.`);
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

      if (error) {
        // Extrair mensagem de erro detalhada do edge function
        const errorMessage = error.message || "Erro ao emitir boleto";
        console.error("[EmployerPortal] Set value error:", error);
        toast.error(`Erro ao emitir boleto: ${errorMessage}`);
        return;
      }
      
      if (data?.error) {
        toast.error(data.error);
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

  const handleGenerateInvoice = async (contrib: Contribution) => {
    if (!employer) {
      toast.error("Sessão expirada. Faça login novamente.");
      return;
    }
    if (!clinic?.id) {
      toast.error("Clínica não carregada. Atualize a página e tente novamente.");
      return;
    }
    if (contrib.status === "cancelled" || contrib.status === "paid") {
      toast.error("Não é possível emitir boleto para esta contribuição");
      return;
    }

    setGeneratingInvoiceId(contrib.id);
    try {
      const { data, error } = await supabase.functions.invoke("lytex-api", {
        body: {
          action: "create_invoice",
          contributionId: contrib.id,
          clinicId: clinic.id,
          employer: {
            cnpj: employer.cnpj,
            name: employer.name,
          },
          value: contrib.value,
          dueDate: contrib.due_date,
          description: `${contrib.contribution_type?.name || "Contribuição"} - ${formatCompetence(contrib.competence_month, contrib.competence_year)}`,
          enableBoleto: true,
          enablePix: true,
        },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || "Erro ao gerar boleto");
      }

      toast.success("Boleto emitido com sucesso!");
      loadContributions(employer.id);

      const url =
        data?.invoiceUrl ||
        data?.invoice_url ||
        data?.lytex_invoice_url ||
        data?.linkCheckout ||
        data?.linkBoleto;

      if (typeof url === "string" && url.length > 0) {
        window.open(url, "_blank");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      toast.error(`Erro ao emitir boleto: ${message}`);
    } finally {
      setGeneratingInvoiceId(null);
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
    setActiveView("home");
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

  // Filtered contributions based on active tab
  const filteredContributions = useMemo(() => {
    let filtered = contributions.filter(c => c.status !== "cancelled");
    
    if (activeTab === "pending") {
      // Include both pending and awaiting_value in "A Vencer" tab
      filtered = contributions.filter(c => c.status === "pending" || c.status === "awaiting_value");
    } else if (activeTab === "overdue") {
      filtered = contributions.filter(c => c.status === "overdue");
    } else if (activeTab === "paid") {
      filtered = contributions.filter(c => c.status === "paid");
    }

    // Apply search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(c => {
        const typeName = c.contribution_type?.name?.toLowerCase() || "";
        const competence = formatCompetence(c.competence_month, c.competence_year).toLowerCase();
        return typeName.includes(term) || competence.includes(term);
      });
    }

    return filtered;
  }, [contributions, activeTab, searchTerm]);

  // Pagination
  const totalPages = Math.ceil(filteredContributions.length / itemsPerPage);
  const paginatedContributions = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredContributions.slice(start, start + itemsPerPage);
  }, [filteredContributions, currentPage, itemsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchTerm, itemsPerPage]);

  const stats = useMemo(() => ({
    pending: contributions.filter(c => c.status === "pending").length,
    overdue: contributions.filter(c => c.status === "overdue").length,
    paid: contributions.filter(c => c.status === "paid").length,
  }), [contributions]);

  // Login Screen
  if (!employer) {
    return (
      <PortalLoginScreen
        logoUrl={clinic?.logo_url}
        clinicName={clinic?.name}
        title="Portal da Empresa"
        subtitle="Acesse seus boletos e contribuições"
        variant="employer"
        isLoading={isLoading}
        onSubmit={handleLogin}
        fields={{
          identifier: {
            label: "CNPJ",
            placeholder: "00.000.000/0000-00",
            value: cnpj,
            onChange: (v) => setCnpj(formatCnpj(v)),
            icon: <Building2 className="h-4 w-4" />
          },
          accessCode: {
            value: accessCode,
            onChange: setAccessCode
          }
        }}
        helpText={clinic?.phone ? `Não possui código? Ligue: ${clinic.phone}` : "Não possui código? Entre em contato com o sindicato."}
      />
    );
  }

  // Main Portal Layout
  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      {/* Dialogs */}
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

      <Dialog open={showReissueDialog} onOpenChange={(open) => {
        setShowReissueDialog(open);
        if (!open) { setNewDueDate(""); setSelectedContribution(null); }
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
                  {formatCompetence(selectedContribution.competence_month, selectedContribution.competence_year)} • {formatCurrency(selectedContribution.value || 0)}
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
                  <p className="text-xs mt-0.5">{selectedContribution.portal_reissue_count}/2 reemissões utilizadas.</p>
                </div>
              </div>
            )}
            <div>
              <Label className="text-slate-700 text-sm font-medium">Nova Data de Vencimento</Label>
              <Input type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} min={getMinDate()} className="mt-2 h-10 border-slate-200" />
              <p className="text-xs text-slate-500 mt-2">O boleto anterior será cancelado automaticamente.</p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowReissueDialog(false)}>Cancelar</Button>
            <Button onClick={handleGenerateReissue} disabled={isGeneratingReissue || !newDueDate} className="bg-amber-600 hover:bg-amber-700">
              {isGeneratingReissue ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Gerando...</> : <><FileText className="h-4 w-4 mr-2" />Gerar Boleto</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSetValueDialog} onOpenChange={(open) => {
        setShowSetValueDialog(open);
        if (!open) { setNewValue(""); setSelectedContribution(null); }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <DollarSign className="h-5 w-5 text-purple-600" />
              Definir Valor
            </DialogTitle>
            <DialogDescription>
              {selectedContribution && formatCompetence(selectedContribution.competence_month, selectedContribution.competence_year)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-slate-700 text-sm font-medium">Valor (R$)</Label>
              <Input type="text" placeholder="0,00" value={newValue} onChange={(e) => setNewValue(e.target.value.replace(/[^0-9,]/g, ""))} className="mt-2 h-10 text-lg font-medium border-slate-200" />
              <p className="text-xs text-slate-500 mt-2">Após definir o valor, o boleto será gerado automaticamente.</p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowSetValueDialog(false)}>Cancelar</Button>
            <Button onClick={handleSetValue} disabled={isSettingValue || !newValue} className="bg-purple-600 hover:bg-purple-700">
              {isSettingValue ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Gerando...</> : <><FileText className="h-4 w-4 mr-2" />Gerar Boleto</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Header - Blue Bar */}
      <header className="bg-[#2c5282] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <div className="flex items-center gap-3">
              {clinic?.logo_url ? (
                <img 
                  src={clinic.logo_url} 
                  alt={clinic.name || "Logo"} 
                  className="h-8 object-contain brightness-0 invert"
                />
              ) : (
                <div className="flex items-center gap-2">
                  <div className="bg-white/20 rounded-lg p-1.5">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <span className="font-semibold text-lg">{clinic?.name || "Portal"}</span>
                </div>
              )}
            </div>
            
            {/* Right side - Company name & actions */}
            <div className="flex items-center gap-4">
              <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                <Bell className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center">
                  <Building2 className="h-4 w-4" />
                </div>
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium leading-tight truncate max-w-[200px]">{employer.name}</p>
                  <p className="text-xs text-white/70">{formatCnpj(employer.cnpj)}</p>
                </div>
              </div>
              <button 
                onClick={handleLogout}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                title="Sair"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {activeView === "home" && (
          <>
            {/* Welcome Section */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-2">
                <Sun className="h-6 w-6 text-amber-500" />
                <h1 className="text-2xl font-semibold text-slate-800">Olá, Bem-vindo de volta.</h1>
              </div>
              <p className="text-slate-500">Gerenciamento e consultas.</p>
            </div>

            {/* Main Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Contribuições Card */}
              <button
                onClick={() => setActiveView("contributions")}
                className="group relative h-48 rounded-xl bg-[#26a69a] hover:bg-[#1e8e82] transition-all duration-300 p-6 text-white text-left shadow-lg hover:shadow-xl hover:-translate-y-1"
              >
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <div className="flex gap-0.5">
                    <div className="w-1.5 h-12 bg-white/80 rounded-sm" />
                    <div className="w-1.5 h-12 bg-white/80 rounded-sm" />
                    <div className="w-1.5 h-12 bg-white/80 rounded-sm" />
                    <div className="w-1.5 h-12 bg-white/80 rounded-sm" />
                  </div>
                  <div className="text-center">
                    <h3 className="text-lg font-bold uppercase tracking-wide">Contribuições</h3>
                    <p className="text-sm text-white/80 mt-1">Gerenciamento de contribuições.</p>
                  </div>
                </div>
                {stats.overdue > 0 && (
                  <span className="absolute top-3 right-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                    {stats.overdue}
                  </span>
                )}
              </button>

              {/* Documentos Coletivos Card */}
              <button
                onClick={() => setActiveView("documents")}
                className="group h-48 rounded-xl bg-[#e89e4c] hover:bg-[#d68f3f] transition-all duration-300 p-6 text-white text-left shadow-lg hover:shadow-xl hover:-translate-y-1"
              >
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <FileStack className="h-14 w-14 text-white/90" />
                  <div className="text-center">
                    <h3 className="text-lg font-bold uppercase tracking-wide">Documentos Coletivos</h3>
                    <p className="text-sm text-white/80 mt-1">Listagem de documentos coletivos.</p>
                  </div>
                </div>
              </button>

              {/* Histórico Financeiro Card */}
              <button
                onClick={() => setActiveView("history")}
                className="group h-48 rounded-xl bg-[#b07eb0] hover:bg-[#9c6a9c] transition-all duration-300 p-6 text-white text-left shadow-lg hover:shadow-xl hover:-translate-y-1"
              >
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <History className="h-14 w-14 text-white/90" />
                  <div className="text-center">
                    <h3 className="text-lg font-bold uppercase tracking-wide">Histórico Financeiro</h3>
                    <p className="text-sm text-white/80 mt-1">Listagem de todo o seu histórico.</p>
                  </div>
                </div>
              </button>
            </div>
          </>
        )}

        {activeView === "contributions" && (
          <>
            {/* Header */}
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex gap-0.5">
                  <div className="w-1 h-6 bg-[#26a69a] rounded-sm" />
                  <div className="w-1 h-6 bg-[#26a69a] rounded-sm" />
                  <div className="w-1 h-6 bg-[#26a69a] rounded-sm" />
                  <div className="w-1 h-6 bg-[#26a69a] rounded-sm" />
                </div>
                <h1 className="text-2xl font-semibold text-slate-800">Gerenciamento de contribuições</h1>
              </div>
              <p className="text-slate-500">Gerenciamento de consulta e emissão de contribuições.</p>
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap gap-2 mb-6">
              <button
                onClick={() => setActiveTab("pending")}
                className={`px-8 py-3 rounded-lg font-medium text-sm transition-all ${
                  activeTab === "pending" 
                    ? "bg-[#26a69a] text-white shadow-md" 
                    : "bg-[#26a69a]/10 text-[#26a69a] hover:bg-[#26a69a]/20"
                }`}
              >
                A vencer
                {stats.pending > 0 && (
                  <Badge className="ml-2 bg-white/20 text-white border-0">{stats.pending}</Badge>
                )}
              </button>
              <button
                onClick={() => setActiveTab("overdue")}
                className={`px-8 py-3 rounded-lg font-medium text-sm transition-all ${
                  activeTab === "overdue" 
                    ? "bg-[#e89e4c] text-white shadow-md" 
                    : "bg-[#e89e4c]/10 text-[#e89e4c] hover:bg-[#e89e4c]/20"
                }`}
              >
                Vencidas
                {stats.overdue > 0 && (
                  <Badge className="ml-2 bg-white/20 text-white border-0">{stats.overdue}</Badge>
                )}
              </button>
              <button
                onClick={() => setActiveTab("paid")}
                className={`px-8 py-3 rounded-lg font-medium text-sm transition-all ${
                  activeTab === "paid" 
                    ? "bg-[#607d8b] text-white shadow-md" 
                    : "bg-[#607d8b]/10 text-[#607d8b] hover:bg-[#607d8b]/20"
                }`}
              >
                Pagas
              </button>
              <button
                onClick={() => setActiveTab("all")}
                className={`px-8 py-3 rounded-lg font-medium text-sm transition-all ${
                  activeTab === "all" 
                    ? "bg-[#2c5282] text-white shadow-md" 
                    : "bg-transparent text-[#2c5282] hover:bg-[#2c5282]/10 border border-[#2c5282]"
                }`}
              >
                Todos os boletos
              </button>
            </div>

            {/* Table Card */}
            <Card className="bg-white border-0 shadow-sm rounded-xl overflow-hidden">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Listagem de contribuições.</h3>
                
                {/* Table Controls */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <Select value={String(itemsPerPage)} onValueChange={(v) => setItemsPerPage(Number(v))}>
                      <SelectTrigger className="w-20 h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5</SelectItem>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-sm text-slate-500">resultados por página</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-500">Pesquisar</span>
                    <Input
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-48 h-9"
                      placeholder="..."
                    />
                  </div>
                </div>

                {/* Table */}
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="w-24 font-medium text-slate-600">#</TableHead>
                        <TableHead className="font-medium text-slate-600">Descrição</TableHead>
                        <TableHead className="font-medium text-slate-600">Documento</TableHead>
                        <TableHead className="font-medium text-slate-600">Vencimento</TableHead>
                        <TableHead className="font-medium text-slate-600">Valor</TableHead>
                        <TableHead className="w-20 font-medium text-slate-600 text-center">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedContributions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-12 text-slate-500">
                            <FileText className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                            <p>Nenhuma contribuição encontrada</p>
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedContributions.map((contrib) => {
                          const value = contrib.value || 0;
                          const needsValue = contrib.status === "awaiting_value" && !contrib.lytex_invoice_url;
                          const invoiceUrl = contrib.lytex_invoice_url;
                          const dueDate = new Date(contrib.due_date + "T12:00:00");
                          
                          return (
                            <TableRow key={contrib.id} className="hover:bg-slate-50/50">
                              <TableCell className="font-mono text-sm text-slate-600">
                                {formatCompetence(contrib.competence_month, contrib.competence_year)}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <span className="text-slate-700">
                                    {contrib.lytex_invoice_id?.slice(0, 6) || "—"} - {contrib.contribution_type?.name || "Contribuição"}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="font-mono text-sm text-slate-600">
                                {contrib.lytex_invoice_id?.slice(0, 8) || "—"}
                              </TableCell>
                              <TableCell>
                                <Badge 
                                  className={`font-medium ${
                                    contrib.status === "overdue" 
                                      ? "bg-[#26a69a] text-white border-0" 
                                      : contrib.status === "paid"
                                      ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                                      : "bg-[#26a69a] text-white border-0"
                                  }`}
                                >
                                  {format(dueDate, "dd/MM/yyyy")}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {needsValue ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setSelectedContribution(contrib);
                                      setShowSetValueDialog(true);
                                    }}
                                    className="h-8 text-xs border-[#2c5282] text-[#2c5282] hover:bg-[#2c5282]/10"
                                  >
                                    Informar o valor
                                  </Button>
                                ) : (
                                  <span className="font-medium text-slate-700">{formatCurrency(value)}</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-1">
                                  {invoiceUrl && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-[#2c5282] hover:text-[#2c5282] hover:bg-[#2c5282]/10"
                                      onClick={() => window.open(invoiceUrl, "_blank")}
                                      title="Ver Boleto"
                                    >
                                      <ExternalLink className="h-4 w-4" />
                                    </Button>
                                  )}
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-8 w-8">
                                        <MoreHorizontal className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="bg-white border shadow-lg z-50">
                                      {invoiceUrl && (
                                        <DropdownMenuItem onClick={() => window.open(invoiceUrl, "_blank")}>
                                          <ExternalLink className="h-4 w-4 mr-2" />
                                          Abrir Boleto
                                        </DropdownMenuItem>
                                      )}
                                      {!invoiceUrl && contrib.status !== "paid" && contrib.status !== "cancelled" && value > 0 && (
                                        <DropdownMenuItem 
                                          onClick={() => handleGenerateInvoice(contrib)}
                                          disabled={generatingInvoiceId === contrib.id}
                                        >
                                          {generatingInvoiceId === contrib.id ? (
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                          ) : (
                                            <FileText className="h-4 w-4 mr-2" />
                                          )}
                                          Emitir Boleto
                                        </DropdownMenuItem>
                                      )}
                                      {contrib.status !== "paid" && contrib.status !== "cancelled" && (
                                        <DropdownMenuItem 
                                          onClick={() => {
                                            setSelectedContribution(contrib);
                                            setShowReissueDialog(true);
                                          }}
                                          disabled={(contrib.portal_reissue_count || 0) >= 2}
                                        >
                                          <RefreshCw className="h-4 w-4 mr-2" />
                                          Gerar 2ª Via
                                        </DropdownMenuItem>
                                      )}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination Footer */}
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-4">
                  <p className="text-sm text-slate-500">
                    Mostrando de {Math.min((currentPage - 1) * itemsPerPage + 1, filteredContributions.length)} até {Math.min(currentPage * itemsPerPage, filteredContributions.length)} de {filteredContributions.length} registros
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      Anterior
                    </Button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map((page) => (
                      <Button
                        key={page}
                        variant={currentPage === page ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(page)}
                        className={currentPage === page ? "bg-[#2c5282]" : ""}
                      >
                        {page}
                      </Button>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages || totalPages === 0}
                    >
                      Próximo
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-6">
              <Button className="bg-[#26a69a] hover:bg-[#1e8e82] text-white">
                <FileStack className="h-4 w-4 mr-2" />
                Exibir várias contribuições
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setActiveView("home")}
                className="border-[#607d8b] text-[#607d8b] hover:bg-[#607d8b]/10"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
            </div>
          </>
        )}

        {activeView === "documents" && (
          <>
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <FileStack className="h-6 w-6 text-[#e89e4c]" />
                <h1 className="text-2xl font-semibold text-slate-800">Documentos Coletivos</h1>
              </div>
              <p className="text-slate-500">Listagem de documentos coletivos disponíveis.</p>
            </div>

            {clinic?.id && (
              <PortalConventionsSection 
                clinicId={clinic.id} 
                employerCategoryId={employer?.category_id}
              />
            )}

            <div className="flex gap-3 mt-6">
              <Button 
                variant="outline" 
                onClick={() => setActiveView("home")}
                className="border-[#607d8b] text-[#607d8b] hover:bg-[#607d8b]/10"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
            </div>
          </>
        )}

        {activeView === "history" && (
          <>
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <History className="h-6 w-6 text-[#b07eb0]" />
                <h1 className="text-2xl font-semibold text-slate-800">Histórico Financeiro</h1>
              </div>
              <p className="text-slate-500">Listagem de todo o seu histórico financeiro.</p>
            </div>

            <Card className="bg-white border-0 shadow-sm rounded-xl">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Histórico de pagamentos</h3>
                
                {contributions.filter(c => c.status === "paid").length === 0 ? (
                  <div className="text-center py-12">
                    <History className="h-16 w-16 mx-auto mb-4 text-slate-300" />
                    <p className="text-slate-500">Nenhum pagamento registrado.</p>
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead className="font-medium text-slate-600">Competência</TableHead>
                          <TableHead className="font-medium text-slate-600">Tipo</TableHead>
                          <TableHead className="font-medium text-slate-600">Valor</TableHead>
                          <TableHead className="font-medium text-slate-600">Data Pagamento</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {contributions.filter(c => c.status === "paid").slice(0, 10).map((contrib) => (
                          <TableRow key={contrib.id}>
                            <TableCell className="font-mono text-sm">
                              {formatCompetence(contrib.competence_month, contrib.competence_year)}
                            </TableCell>
                            <TableCell>{contrib.contribution_type?.name || "Contribuição"}</TableCell>
                            <TableCell className="font-medium">{formatCurrency(contrib.value || 0)}</TableCell>
                            <TableCell>
                              {contrib.paid_at ? format(new Date(contrib.paid_at), "dd/MM/yyyy") : "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex gap-3 mt-6">
              <Button 
                variant="outline" 
                onClick={() => setActiveView("home")}
                className="border-[#607d8b] text-[#607d8b] hover:bg-[#607d8b]/10"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
