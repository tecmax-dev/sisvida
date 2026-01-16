import { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { 
  Building2, 
  FileText, 
  Search, 
  DollarSign,
  ExternalLink,
  Building,
  Loader2,
  RefreshCw,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  Filter,
  TrendingUp,
  ChevronRight,
  Handshake,
  X,
  FileCheck,
  Users,
  Mail
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { PortalLinkedEmployersList } from "@/components/portal/PortalLinkedEmployersList";
import { PortalHomologacaoBooking } from "@/components/portal/PortalHomologacaoBooking";
import { formatCompetence } from "@/lib/competence-format";

interface AccountingOffice {
  id: string;
  name: string;
  email: string;
  clinic_id: string;
}

interface Employer {
  id: string;
  name: string;
  cnpj: string;
  trade_name?: string;
  registration_number?: string | null;
  phone?: string | null;
  email?: string | null;
}

interface Contribution {
  id: string;
  employer_id: string;
  competence_month: number;
  competence_year: number;
  due_date: string;
  value: number;
  status: string;
  paid_at?: string | null;
  paid_value?: number | null;
  lytex_invoice_url?: string;
  lytex_invoice_id?: string;
  portal_reissue_count?: number;
  negotiation_id?: string | null;
  negotiation?: {
    id: string;
    negotiation_code: string;
    status: string;
    installments_count: number;
  } | null;
  employer?: {
    id: string;
    name: string;
    cnpj: string;
    registration_number?: string | null;
  };
  contribution_type?: {
    name: string;
  };
}

interface Clinic {
  id: string;
  name: string;
  logo_url?: string;
}

const MONTHS = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez"
];

const MONTHS_FULL = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

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

export default function AccountingOfficePortal() {
  const { clinicSlug } = useParams<{ clinicSlug: string }>();
  
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  
  const [email, setEmail] = useState("");
  const [accessCode, setAccessCode] = useState("");
  
  const [accountingOffice, setAccountingOffice] = useState<AccountingOffice | null>(null);
  const [employers, setEmployers] = useState<Employer[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [clinic, setClinic] = useState<Clinic | null>(null);
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("hide_cancelled");
  const [filterEmployer, setFilterEmployer] = useState<string>("all");
  const [filterMonth, setFilterMonth] = useState<string>(() => {
    const currentMonth = new Date().getMonth();
    return currentMonth === 0 ? "12" : String(currentMonth);
  });
  const [filterYear, setFilterYear] = useState<string>(() => {
    const now = new Date();
    return now.getMonth() === 0 ? String(now.getFullYear() - 1) : String(now.getFullYear());
  });
  
  // Views - added homologacao view
  const [activeView, setActiveView] = useState<"services" | "contributions" | "employers" | "homologacao">("services");
  
  // Dialog de segunda via
  const [showReissueDialog, setShowReissueDialog] = useState(false);
  const [selectedContribution, setSelectedContribution] = useState<Contribution | null>(null);
  const [newDueDate, setNewDueDate] = useState("");
  const [isGeneratingReissue, setIsGeneratingReissue] = useState(false);

  // Dialog de definir valor
  const [showSetValueDialog, setShowSetValueDialog] = useState(false);
  const [newValue, setNewValue] = useState("");
  const [isSettingValue, setIsSettingValue] = useState(false);

  // Employer selecionado para homologação (view embutida)
  const [selectedEmployerForHomologacao, setSelectedEmployerForHomologacao] = useState<Employer | null>(null);

  // Restaurar sessão do sessionStorage
  useEffect(() => {
    const savedSession = sessionStorage.getItem("accounting_office_session");
    if (savedSession) {
      try {
        const session = JSON.parse(savedSession);
        setAccountingOffice(session.accountingOffice);
        setIsAuthenticated(true);
        loadData(session.accountingOffice.id);
      } catch (e) {
        sessionStorage.removeItem("accounting_office_session");
      }
    }
  }, []);

  useEffect(() => {
    if (clinicSlug) {
      loadClinicBySlug(clinicSlug);
    }
  }, [clinicSlug]);

  const loadClinicBySlug = async (slug: string) => {
    try {
      const { data, error } = await supabase
        .from("clinics")
        .select("id, name, logo_url")
        .eq("slug", slug)
        .maybeSingle();
      
      if (!error && data) {
        setClinic(data);
      }
    } catch (error) {
      console.error("Error loading clinic:", error);
    }
  };

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("accounting-office-portal-auth", {
        body: { action: "login", email, access_code: accessCode },
      });

      if (error) throw error;

      if (data.error) {
        toast.error(data.error);
        return;
      }

      setAccountingOffice(data.accounting_office);
      setIsAuthenticated(true);
      
      sessionStorage.setItem("accounting_office_session", JSON.stringify({
        accountingOffice: data.accounting_office
      }));
      
      toast.success("Login realizado com sucesso!");
      loadData(data.accounting_office.id);
    } catch (error: any) {
      console.error("Login error:", error);
      toast.error("Erro ao fazer login. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const loadData = async (officeId: string) => {
    setIsLoadingData(true);
    try {
      const { data: employersData } = await supabase.functions.invoke("accounting-office-portal-auth", {
        body: { action: "get_employers", accounting_office_id: officeId },
      });
      
      if (employersData?.employers) {
        setEmployers(employersData.employers);
      }

      const { data: contribData } = await supabase.functions.invoke("accounting-office-portal-auth", {
        body: { action: "get_contributions", accounting_office_id: officeId },
      });
      
      if (contribData?.contributions) {
        setContributions(contribData.contributions);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("accounting_office_session");
    setIsAuthenticated(false);
    setAccountingOffice(null);
    setEmployers([]);
    setContributions([]);
    setEmail("");
    setAccessCode("");
    setActiveView("services");
  };

  const formatCurrency = (valueInCents: number) => {
    const valueInReais = (valueInCents || 0) / 100;
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(valueInReais);
  };

  const formatCNPJ = (cnpj: string) => {
    if (!cnpj) return "";
    return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  };

  const parseISODateToLocalNoon = (isoDate: string) => {
    const [y, m, d] = isoDate.split("-").map(Number);
    return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0);
  };

  const formatDateForInput = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const getMinDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return formatDateForInput(tomorrow);
  };

  const handleGenerateReissue = async () => {
    if (!selectedContribution || !accountingOffice || !newDueDate) {
      toast.error("Selecione uma nova data de vencimento");
      return;
    }

    setIsGeneratingReissue(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-boleto-reissue", {
        body: {
          contribution_id: selectedContribution.id,
          new_due_date: newDueDate,
          portal_type: "accounting_office",
          portal_id: accountingOffice.id,
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
      loadData(accountingOffice.id);

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
    if (!selectedContribution || !accountingOffice || !newValue) {
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
          portal_type: "accounting_office",
          portal_id: accountingOffice.id,
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
      loadData(accountingOffice.id);

      if (data.lytex_invoice_url) {
        window.open(data.lytex_invoice_url, "_blank");
      }
    } catch (err) {
      toast.error("Erro de conexão");
    } finally {
      setIsSettingValue(false);
    }
  };

  const handlePrintEmployersList = () => {
    if (!accountingOffice || employers.length === 0) {
      toast.error("Nenhuma empresa para imprimir");
      return;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 40, "F");
    
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text("Relatório de Empresas Vinculadas", pageWidth / 2, 18, { align: "center" });
    
    doc.setFontSize(11);
    doc.text(accountingOffice.name, pageWidth / 2, 28, { align: "center" });
    doc.setFontSize(9);
    doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR", { 
      day: "2-digit", 
      month: "long", 
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    })}`, pageWidth / 2, 35, { align: "center" });

    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text("Resumo", 14, 52);
    
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text(`Total de empresas vinculadas: ${employers.length}`, 14, 60);

    const tableData = employers.map((emp, index) => [
      (index + 1).toString(),
      emp.name,
      formatCNPJ(emp.cnpj),
      emp.trade_name || "-"
    ]);

    autoTable(doc, {
      startY: 70,
      head: [["#", "Razão Social", "CNPJ", "Nome Fantasia"]],
      body: tableData,
      theme: "striped",
      headStyles: { 
        fillColor: [15, 23, 42],
        fontSize: 10,
        fontStyle: "bold"
      },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 12, halign: "center" },
        1: { cellWidth: 75 },
        2: { cellWidth: 45 },
        3: { cellWidth: 55 }
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      styles: { cellPadding: 3, overflow: "linebreak" }
    });

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(
        `Página ${i} de ${pageCount} • ${clinic?.name || "Portal do Contador"}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: "center" }
      );
    }

    const fileName = `empresas-${accountingOffice.name.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().split("T")[0]}.pdf`;
    doc.save(fileName);
    toast.success("Relatório gerado com sucesso!");
  };

  const clearFilters = () => {
    setSearchTerm("");
    setFilterStatus("hide_cancelled");
    setFilterEmployer("all");
    setFilterMonth("all");
    setFilterYear("all");
  };

  const hasActiveFilters = (filterStatus !== "hide_cancelled") || filterEmployer !== "all" || filterMonth !== "all" || filterYear !== "all" || searchTerm;

  const currentYear = new Date().getFullYear();
  const availableYears = useMemo(() => {
    return [...new Set([currentYear, ...contributions.map(c => c.competence_year)])].sort((a, b) => b - a);
  }, [contributions, currentYear]);

  const filteredContributions = useMemo(() => {
    return contributions.filter(contrib => {
      const matchesSearch = searchTerm === "" || 
        contrib.employer?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contrib.employer?.cnpj?.includes(searchTerm.replace(/\D/g, "")) ||
        contrib.employer?.registration_number?.includes(searchTerm);
      
      const matchesStatus = filterStatus === "all" || (filterStatus === "hide_cancelled" ? contrib.status !== "cancelled" : contrib.status === filterStatus);
      const matchesEmployer = filterEmployer === "all" || contrib.employer_id === filterEmployer;
      const matchesMonth = filterMonth === "all" || contrib.competence_month === parseInt(filterMonth);
      const matchesYear = filterYear === "all" || contrib.competence_year === parseInt(filterYear);
      
      return matchesSearch && matchesStatus && matchesEmployer && matchesMonth && matchesYear;
    });
  }, [contributions, searchTerm, filterStatus, filterEmployer, filterMonth, filterYear]);

  const stats = useMemo(() => ({
    total: contributions.length,
    pending: contributions.filter(c => c.status === "pending").length,
    overdue: contributions.filter(c => c.status === "overdue").length,
    paid: contributions.filter(c => c.status === "paid").length,
    totalValue: contributions.filter(c => c.status !== "cancelled" && c.status !== "paid").reduce((sum, c) => sum + (c.value || 0), 0),
    paidValue: contributions.filter(c => c.status === "paid").reduce((sum, c) => sum + (c.value || 0), 0),
    overdueValue: contributions.filter(c => c.status === "overdue").reduce((sum, c) => sum + (c.value || 0), 0),
  }), [contributions]);

  // Login Screen
  if (!isAuthenticated) {
    return (
      <PortalLoginScreen
        logoUrl={clinic?.logo_url}
        clinicName={clinic?.name}
        title="Portal do Contador"
        subtitle="Gerencie as contribuições das empresas"
        variant="accounting"
        fields={{
          identifier: {
            label: "E-mail",
            placeholder: "seu@email.com",
            value: email,
            onChange: setEmail,
            icon: <Mail className="h-4 w-4" />,
            type: "email"
          },
          accessCode: {
            value: accessCode,
            onChange: setAccessCode,
          },
        }}
        onSubmit={handleLogin}
        isLoading={isLoading}
      />
    );
  }

  // Services View
  if (activeView === "services") {
    return (
      <PortalContainer>
        <PortalHeader
          logoUrl={clinic?.logo_url}
          clinicName={clinic?.name}
          entityName={accountingOffice?.name || "Escritório"}
          entitySubtitle={accountingOffice?.email}
          onLogout={handleLogout}
          onRefresh={() => accountingOffice && loadData(accountingOffice.id)}
          onPrint={handlePrintEmployersList}
          variant="teal"
        />
        
        <PortalMain>
          {/* Welcome Banner */}
          <PortalWelcomeBanner
            logoUrl={clinic?.logo_url}
            clinicName={clinic?.name}
            entityName={accountingOffice?.name || "Escritório"}
            variant="teal"
          />

          {/* Quick Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="bg-white border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Empresas</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">{employers.length}</p>
                  </div>
                  <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center">
                    <Building className="h-5 w-5 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-white border-0 shadow-sm">
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

            <Card className="bg-white border-0 shadow-sm">
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
            
            <Card className="bg-gradient-to-br from-teal-500 to-cyan-600 border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-white/80 uppercase tracking-wide">Total Pendente</p>
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
          {stats.overdue > 0 && (
            <Card className="bg-gradient-to-r from-red-50 to-orange-50 border-red-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-red-800">
                      {stats.overdue} contribuições vencidas
                    </p>
                    <p className="text-sm text-red-600">
                      Valor total em atraso: {formatCurrency(stats.overdueValue)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-red-300 text-red-700 hover:bg-red-100"
                    onClick={() => {
                      setFilterStatus("overdue");
                      setActiveView("contributions");
                    }}
                  >
                    Ver detalhes
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Services Grid */}
          <div>
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Serviços</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <PortalServiceCard
                icon={<FileText className="h-6 w-6" />}
                title="Contribuições"
                description="Gerencie boletos e pagamentos"
                onClick={() => setActiveView("contributions")}
                color="teal"
                badge={stats.overdue > 0 ? `${stats.overdue}` : undefined}
              />
              <PortalServiceCard
                icon={<Building className="h-6 w-6" />}
                title="Empresas Vinculadas"
                description={`${employers.length} empresa(s) sob gestão`}
                onClick={() => setActiveView("employers")}
                color="blue"
              />
              <PortalServiceCard
                icon={<FileCheck className="h-6 w-6" />}
                title="Relatórios"
                description="Imprima relatórios das empresas"
                onClick={handlePrintEmployersList}
                color="purple"
              />
              <PortalServiceCard
                icon={<Users className="h-6 w-6" />}
                title="Atualizar Dados"
                description="Atualize informações do escritório"
                onClick={() => toast.info("Entre em contato para atualizar seus dados")}
                color="amber"
              />
            </div>
          </div>

          {/* Homologação Card */}
          <PortalHomologacaoCard clinicSlug={clinicSlug} />

          {/* Convenções Coletivas */}
          <PortalConventionsSection clinicId={clinic?.id} />
        </PortalMain>
      </PortalContainer>
    );
  }

  // Employers View
  if (activeView === "employers") {
    return (
      <PortalContainer>
        <PortalHeader
          logoUrl={clinic?.logo_url}
          clinicName={clinic?.name}
          entityName={accountingOffice?.name || "Escritório"}
          entitySubtitle={accountingOffice?.email}
          onLogout={handleLogout}
          onRefresh={() => accountingOffice && loadData(accountingOffice.id)}
          variant="teal"
        />
        
        <PortalMain>
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

          <h2 className="text-lg font-semibold text-slate-800 mt-2">
            Empresas Vinculadas
          </h2>

          <PortalLinkedEmployersList
            employers={employers}
            accountingOfficeName={accountingOffice?.name || "Escritório"}
            clinicName={clinic?.name}
            onViewContributions={(employerId) => {
              setFilterEmployer(employerId);
              setActiveView("contributions");
            }}
            onScheduleHomologacao={(employer) => {
              setSelectedEmployerForHomologacao(employer);
              setActiveView("homologacao");
            }}
          />
        </PortalMain>
      </PortalContainer>
    );
  }

  // Homologacao Booking View (embutida)
  if (activeView === "homologacao" && selectedEmployerForHomologacao && clinic?.id) {
    return (
      <PortalContainer>
        <PortalHeader
          logoUrl={clinic?.logo_url}
          clinicName={clinic?.name}
          entityName={accountingOffice?.name || "Escritório"}
          entitySubtitle={accountingOffice?.email}
          onLogout={handleLogout}
          onRefresh={() => accountingOffice && loadData(accountingOffice.id)}
          variant="teal"
        />
        
        <PortalMain>
          <PortalHomologacaoBooking
            employer={selectedEmployerForHomologacao}
            clinicId={clinic.id}
            onBack={() => {
              setSelectedEmployerForHomologacao(null);
              setActiveView("employers");
            }}
            onSuccess={() => {
              setSelectedEmployerForHomologacao(null);
              setActiveView("employers");
            }}
          />
        </PortalMain>
      </PortalContainer>
    );
  }

  // Contributions View
  return (
    <PortalContainer>
      <PortalHeader
        logoUrl={clinic?.logo_url}
        clinicName={clinic?.name}
        entityName={accountingOffice?.name || "Escritório"}
        entitySubtitle={accountingOffice?.email}
        onLogout={handleLogout}
        onRefresh={() => accountingOffice && loadData(accountingOffice.id)}
        variant="teal"
      />
      
      <PortalMain>
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

        {/* Stats Cards - Compact style */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card 
            className="bg-white border border-slate-200 shadow-sm cursor-default ring-2 ring-teal-500 ring-offset-1"
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-lg bg-teal-100 flex items-center justify-center">
                  <FileText className="h-4 w-4 text-teal-600" />
                </div>
                <span className="text-sm font-medium text-slate-600">Contribuições</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">{contributions.length}</p>
              <p className="text-sm text-slate-500">{formatCurrency(contributions.reduce((sum, c) => sum + (c.value || 0), 0))}</p>
            </CardContent>
          </Card>
          
          <Card 
            className="bg-white border border-slate-200 shadow-sm cursor-pointer hover:shadow-md hover:border-blue-300 transition-all"
            onClick={() => setActiveView("employers")}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Building className="h-4 w-4 text-blue-600" />
                </div>
                <span className="text-sm font-medium text-slate-600">Empresas</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">{employers.length}</p>
              <p className="text-sm text-slate-500">vinculadas</p>
            </CardContent>
          </Card>
          
          <Card 
            className="bg-white border border-slate-200 shadow-sm cursor-pointer hover:shadow-md hover:border-purple-300 transition-all"
            onClick={handlePrintEmployersList}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-lg bg-purple-100 flex items-center justify-center">
                  <FileCheck className="h-4 w-4 text-purple-600" />
                </div>
                <span className="text-sm font-medium text-slate-600">Relatórios</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">PDF</p>
              <p className="text-sm text-slate-500">gerar relatório</p>
            </CardContent>
          </Card>
          
          <Card 
            className="bg-white border border-slate-200 shadow-sm cursor-pointer hover:shadow-md hover:border-amber-300 transition-all"
            onClick={() => toast.info("Entre em contato para atualizar seus dados")}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Users className="h-4 w-4 text-amber-600" />
                </div>
                <span className="text-sm font-medium text-slate-600">Dados</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">Atualizar</p>
              <p className="text-sm text-slate-500">informações</p>
            </CardContent>
          </Card>
        </div>

        {/* Contributions List - New Component */}
        <PortalContributionsList
          contributions={contributions.map(c => ({
            ...c,
            value: c.value,
            amount: c.value,
          }))}
          isLoading={isLoadingData}
          showEmployerInfo={true}
          filterEmployerId={filterEmployer !== "all" ? filterEmployer : undefined}
          onClearEmployerFilter={() => setFilterEmployer("all")}
          onReissue={(contrib) => {
            setSelectedContribution(contrib as any);
            setShowReissueDialog(true);
          }}
          onSetValue={(contrib) => {
            setSelectedContribution(contrib as any);
            setShowSetValueDialog(true);
          }}
        />
      </PortalMain>

      {/* Dialog de Segunda Via */}
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
              <RefreshCw className="h-5 w-5 text-teal-600" />
              Gerar 2ª Via
            </DialogTitle>
            <DialogDescription>
              {selectedContribution && (
                <span className="text-slate-600">
                  {selectedContribution.employer?.name} • {MONTHS_FULL[selectedContribution.competence_month - 1]}/{selectedContribution.competence_year}
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
              className="bg-teal-600 hover:bg-teal-700"
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

      {/* Dialog de Definir Valor */}
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
                  {selectedContribution.employer?.name} • {MONTHS_FULL[selectedContribution.competence_month - 1]}/{selectedContribution.competence_year}
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
    </PortalContainer>
  );
}
