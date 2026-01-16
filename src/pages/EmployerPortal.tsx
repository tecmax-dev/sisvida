import { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { 
  Building2, 
  FileText, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  XCircle,
  RefreshCw,
  Bell,
  Calendar,
  DollarSign,
  AlertTriangle,
  Loader2,
  TrendingUp,
  ChevronRight,
  Handshake,
  Users
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { formatCompetence } from "@/lib/competence-format";
import { 
  PortalHeader, 
  PortalWelcomeBanner, 
  PortalServiceCard, 
  PortalContainer, 
  PortalMain 
} from "@/components/portal/PortalLayout";
import { PortalLoginScreen } from "@/components/portal/PortalLoginScreen";
import { PortalConventionsSection, PortalHomologacaoCard } from "@/components/portal/PortalServicesSection";
import { PortalContributionsList } from "@/components/portal/PortalContributionsList";

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
  const [statusFilter, setStatusFilter] = useState("hide_cancelled");
  const [typeFilter, setTypeFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState(() => {
    const now = new Date();
    return now.getMonth() === 0 ? String(now.getFullYear() - 1) : String(now.getFullYear());
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [activeView, setActiveView] = useState<"services" | "contributions">("services");

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
    const currentYear = new Date().getFullYear();
    const years = new Set([currentYear, ...contributions.map(c => c.competence_year)]);
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
          value: contrib.amount,
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
        const competence = formatCompetence(c.competence_month, c.competence_year).toLowerCase();
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

  // Dashboard
  return (
    <PortalContainer>
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
                  {formatCompetence(selectedContribution.competence_month, selectedContribution.competence_year)} • {formatCurrency(selectedContribution.amount || 0)}
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

      <PortalHeader
        logoUrl={clinic?.logo_url}
        clinicName={clinic?.name}
        entityName={employer.name}
        entitySubtitle={formatCnpj(employer.cnpj)}
        onLogout={handleLogout}
        onRefresh={() => loadContributions(employer.id)}
        variant="amber"
      />

      <PortalMain>
        {/* Welcome Banner */}
        <PortalWelcomeBanner
          logoUrl={clinic?.logo_url}
          clinicName={clinic?.name}
          entityName={employer.name}
          variant="amber"
        />

        {/* Quick Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className={`bg-white border-0 shadow-sm hover:shadow-md transition-all cursor-pointer ${statusFilter === "pending" ? "ring-2 ring-amber-500" : ""}`} onClick={() => { setActiveView("contributions"); setStatusFilter("pending"); }}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase">Pendentes</p>
                  <p className="text-2xl font-bold text-amber-600 mt-1">{stats.pending}</p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className={`bg-white border-0 shadow-sm hover:shadow-md transition-all cursor-pointer ${statusFilter === "overdue" ? "ring-2 ring-red-500" : ""}`} onClick={() => { setActiveView("contributions"); setStatusFilter("overdue"); }}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase">Vencidos</p>
                  <p className="text-2xl font-bold text-red-600 mt-1">{stats.overdue}</p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-red-50 flex items-center justify-center">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={`bg-white border-0 shadow-sm hover:shadow-md transition-all cursor-pointer ${statusFilter === "paid" ? "ring-2 ring-emerald-500" : ""}`} onClick={() => { setActiveView("contributions"); setStatusFilter("paid"); }}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase">Pagos</p>
                  <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.paid}</p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-amber-500 to-orange-600 border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-white/80 uppercase">A Pagar</p>
                  <p className="text-lg font-bold text-white mt-1">{formatCurrency(stats.totalValue)}</p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Overdue Alert */}
        {stats.overdue > 0 && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200">
            <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <Bell className="h-5 w-5 text-red-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-red-800">Você possui {stats.overdue} boleto(s) em atraso</p>
              <p className="text-sm text-red-600">Total: {formatCurrency(stats.overdueValue)}</p>
            </div>
            <Button size="sm" variant="outline" className="border-red-300 text-red-700 hover:bg-red-100 flex-shrink-0" onClick={() => { setActiveView("contributions"); setStatusFilter("overdue"); }}>
              Ver boletos
            </Button>
          </div>
        )}

        {/* Services Section */}
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Serviços</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <PortalServiceCard
              icon={<FileText className="h-6 w-6" />}
              title="Contribuições"
              description="Visualize e pague seus boletos"
              onClick={() => setActiveView("contributions")}
              color="amber"
              badge={stats.overdue > 0 ? String(stats.overdue) : undefined}
            />
            <PortalServiceCard
              icon={<Calendar className="h-6 w-6" />}
              title="Homologação"
              description="Agende rescisões de contrato"
              onClick={() => window.open(`/agendamento/profissional/`, "_blank")}
              color="green"
            />
            <PortalServiceCard
              icon={<Handshake className="h-6 w-6" />}
              title="Convenções"
              description="Convenções coletivas vigentes"
              onClick={() => {}}
              color="indigo"
            />
            <PortalServiceCard
              icon={<Users className="h-6 w-6" />}
              title="Fale Conosco"
              description="Entre em contato"
              onClick={() => clinic?.phone && window.open(`https://wa.me/55${clinic.phone.replace(/\D/g, "")}`, "_blank")}
              color="teal"
            />
          </div>
        </div>

        {/* Homologacao & Conventions Section */}
        {clinic?.id && (
          <div className="grid md:grid-cols-2 gap-6">
            <PortalHomologacaoCard clinicSlug={clinicSlug} />
            <PortalConventionsSection clinicId={clinic.id} employerCategoryId={employer?.category_id} />
          </div>
        )}

        {/* Contributions View */}
        {activeView === "contributions" && (
          <>
            {/* Back button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveView("services")}
              className="text-slate-600 hover:text-slate-900 -ml-2"
            >
              <ChevronRight className="h-4 w-4 rotate-180 mr-1" />
              Voltar aos serviços
            </Button>

            {/* Contributions List - New Component */}
            <PortalContributionsList
              contributions={contributions}
              isLoading={false}
              showEmployerInfo={false}
              onReissue={(contrib) => {
                setSelectedContribution(contrib as any);
                setShowReissueDialog(true);
              }}
              onSetValue={(contrib) => {
                setSelectedContribution(contrib as any);
                setShowSetValueDialog(true);
              }}
              onGenerateInvoice={(contrib) => handleGenerateInvoice(contrib as any)}
              generatingInvoiceId={generatingInvoiceId}
            />
          </>
        )}

        {/* Reissue Requests */}
        {reissueRequests.length > 0 && (
          <Card className="bg-white border-0 shadow-sm">
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-slate-400" />Solicitações de 2ª Via ({reissueRequests.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100">
                {reissueRequests.slice(0, 3).map((request) => (
                  <div key={request.id} className="flex items-center justify-between p-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-700">{format(new Date(request.created_at), "dd/MM/yyyy HH:mm")}</p>
                      <p className="text-xs text-slate-500 truncate">{request.reason}</p>
                    </div>
                    <Badge variant="outline" className={`text-xs ${
                      request.status === "completed" ? "bg-emerald-50 text-emerald-600 border-emerald-200" :
                      request.status === "processing" ? "bg-blue-50 text-blue-600 border-blue-200" :
                      request.status === "rejected" ? "bg-red-50 text-red-600 border-red-200" :
                      "bg-amber-50 text-amber-600 border-amber-200"
                    }`}>
                      {request.status === "completed" ? "Concluído" : request.status === "processing" ? "Processando" : request.status === "rejected" ? "Rejeitado" : "Pendente"}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </PortalMain>
    </PortalContainer>
  );
}
