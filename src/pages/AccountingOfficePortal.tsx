import { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { 
  Building2, 
  FileText, 
  DollarSign,
  Building,
  Loader2,
  RefreshCw,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  Handshake,
  Barcode,
  FolderOpen,
  Sun,
  Mail
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { 
  SindSystemHeader,
  SindSystemContainer,
  SindSystemMain,
  SindSystemPageHeader,
  SindSystemServiceCard,
  SindSystemBackButton
} from "@/components/portal/SindSystemLayout";
import { SindSystemEmployersTable } from "@/components/portal/SindSystemEmployersTable";
import { PortalLoginScreen } from "@/components/portal/PortalLoginScreen";
import { PortalConventionsSection, PortalHomologacaoCard } from "@/components/portal/PortalServicesSection";
import { PortalContributionsList } from "@/components/portal/PortalContributionsList";
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
  city?: string | null;
  state?: string | null;
  is_active?: boolean;
  category_id?: string | null;
  category?: {
    id: string;
    name: string;
  } | null;
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

const MONTHS_FULL = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

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
  
  // Views
  const [activeView, setActiveView] = useState<"home" | "boletos" | "employers" | "documents" | "homologacao">("home");
  
  // Filters
  const [filterEmployer, setFilterEmployer] = useState<string>("all");
  
  // Dialog de segunda via
  const [showReissueDialog, setShowReissueDialog] = useState(false);
  const [selectedContribution, setSelectedContribution] = useState<Contribution | null>(null);
  const [newDueDate, setNewDueDate] = useState("");
  const [isGeneratingReissue, setIsGeneratingReissue] = useState(false);

  // Dialog de definir valor
  const [showSetValueDialog, setShowSetValueDialog] = useState(false);
  const [newValue, setNewValue] = useState("");
  const [isSettingValue, setIsSettingValue] = useState(false);

  // Employer selecionado para homologação
  const [selectedEmployerForHomologacao, setSelectedEmployerForHomologacao] = useState<Employer | null>(null);

  // Employer selecionado para documentos (CCTs por categoria)
  const [selectedEmployerForDocuments, setSelectedEmployerForDocuments] = useState<Employer | null>(null);

  // Restaurar sessão do localStorage (persistente entre abas e recarregamentos)
  useEffect(() => {
    const savedSession = localStorage.getItem("accounting_office_session");
    if (savedSession) {
      try {
        const session = JSON.parse(savedSession);
        // Validar que a sessão tem os dados mínimos necessários
        if (session?.accountingOffice?.id && session?.accountingOffice?.clinic_id) {
          setAccountingOffice(session.accountingOffice);
          setIsAuthenticated(true);
          loadData(session.accountingOffice.id);
        } else {
          localStorage.removeItem("accounting_office_session");
        }
      } catch (e) {
        localStorage.removeItem("accounting_office_session");
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

  const getInvokeErrorMessage = (err: any): string | null => {
    // Caso 1: FunctionsHttpError com body parseável
    const body = err?.context?.body;
    if (typeof body === "string") {
      try {
        const parsed = JSON.parse(body);
        if (typeof parsed?.error === "string" && parsed.error.trim()) return parsed.error;
        if (typeof parsed?.message === "string" && parsed.message.trim()) return parsed.message;
      } catch {
        // ignore
      }
      // body é string plana não-JSON
      if (body.trim()) return body.trim();
    }
    // Caso 2: erro tem message diretamente
    if (typeof err?.message === "string" && err.message.trim()) {
      // Filtrar mensagens genéricas do SDK que não ajudam o usuário
      const msg = err.message.trim();
      if (msg.toLowerCase().includes("failed to fetch") || msg.toLowerCase().includes("networkerror")) {
        return "Erro de conexão. Verifique sua internet e tente novamente.";
      }
      return msg;
    }
    return null;
  };

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsLoading(true);

    try {
      const cleanEmail = email.trim();
      const cleanAccessCode = accessCode.trim();

      const { data, error } = await supabase.functions.invoke("accounting-office-portal-auth", {
        body: { action: "login", email: cleanEmail, access_code: cleanAccessCode },
      });

      if (error) {
        toast.error(getInvokeErrorMessage(error) || "Erro ao fazer login.");
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      setAccountingOffice(data.accounting_office);
      setIsAuthenticated(true);

      localStorage.setItem(
        "accounting_office_session",
        JSON.stringify({
          accountingOffice: data.accounting_office,
          savedAt: Date.now(),
        })
      );

      toast.success("Login realizado com sucesso!");
      loadData(data.accounting_office.id);
    } catch (error: any) {
      console.error("Login error:", error);
      toast.error(error?.message || "Erro ao fazer login. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const loadData = async (officeId: string) => {
    setIsLoadingData(true);
    // Reset states before loading to avoid stale data
    setEmployers([]);
    setContributions([]);
    
    try {
      console.log("[Portal Contador] Carregando dados para escritório:", officeId);
      
      const { data: employersData, error: employersError } = await supabase.functions.invoke("accounting-office-portal-auth", {
        body: { action: "get_employers", accounting_office_id: officeId },
      });
      
      if (employersError) {
        console.error("[Portal Contador] Erro ao buscar empresas:", employersError);
      }
      
      if (employersData?.employers) {
        console.log("[Portal Contador] Empresas carregadas:", employersData.employers.length);
        setEmployers(employersData.employers);
      } else {
        console.warn("[Portal Contador] Nenhuma empresa retornada:", employersData);
      }

      const { data: contribData, error: contribError } = await supabase.functions.invoke("accounting-office-portal-auth", {
        body: { action: "get_contributions", accounting_office_id: officeId },
      });
      
      if (contribError) {
        console.error("[Portal Contador] Erro ao buscar contribuições:", contribError);
      }
      
      if (contribData?.contributions) {
        console.log("[Portal Contador] Contribuições carregadas:", contribData.contributions.length);
        setContributions(contribData.contributions);
      } else {
        console.warn("[Portal Contador] Nenhuma contribuição retornada:", contribData);
      }
    } catch (error) {
      console.error("[Portal Contador] Erro ao carregar dados:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("accounting_office_session");
    setIsAuthenticated(false);
    setAccountingOffice(null);
    setEmployers([]);
    setContributions([]);
    setEmail("");
    setAccessCode("");
    setActiveView("home");
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

      if (error) {
        // Extrair mensagem de erro detalhada do edge function
        const errorMessage = error.message || "Erro ao emitir boleto";
        console.error("[AccountingPortal] Set value error:", error);
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
    
    doc.setFillColor(44, 82, 130);
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
        fillColor: [44, 82, 130],
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

  // Home View - 3 Cards (SindSystem layout)
  if (activeView === "home") {
    return (
      <SindSystemContainer>
        <SindSystemHeader
          logoUrl={clinic?.logo_url}
          entityName={accountingOffice?.name || "Escritório"}
          entityEmail={accountingOffice?.email}
          onLogout={handleLogout}
        />
        
        <SindSystemMain>
          <SindSystemPageHeader
            icon={<Sun className="h-6 w-6" />}
            title="Olá, Bem-vindo de volta."
            subtitle="Gerenciamento e consultas."
          />

          {/* 4 Service Cards - SindSystem style */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-8">
            <SindSystemServiceCard
              icon={<Barcode className="h-12 w-12" />}
              title="BOLETOS"
              description="Gerenciamento de boletos."
              onClick={() => setActiveView("boletos")}
              color="green"
            />
            <SindSystemServiceCard
              icon={<Building2 className="h-12 w-12" />}
              title="EMPRESAS"
              description="Gerenciamento de Empresas."
              onClick={() => setActiveView("employers")}
              color="blue"
            />
            <SindSystemServiceCard
              icon={<FolderOpen className="h-12 w-12" />}
              title="DOCUMENTOS COLETIVOS"
              description="Listagem de documentos coletivos."
              onClick={() => setActiveView("documents")}
              color="orange"
            />
            <SindSystemServiceCard
              icon={<Handshake className="h-12 w-12" />}
              title="AGENDAR HOMOLOGAÇÃO"
              description="Agendamento de homologações."
              onClick={() => setActiveView("homologacao")}
              color="blue"
            />
          </div>
        </SindSystemMain>
      </SindSystemContainer>
    );
  }

  // Employers View - SindSystem table layout
  if (activeView === "employers") {
    return (
      <SindSystemContainer>
        <SindSystemHeader
          logoUrl={clinic?.logo_url}
          entityName={accountingOffice?.name || "Escritório"}
          entityEmail={accountingOffice?.email}
          onLogout={handleLogout}
        />
        
        <SindSystemMain>
          <SindSystemPageHeader
            icon={<Building2 className="h-6 w-6 text-blue-500" />}
            title="Gerenciamento de Empresas."
            subtitle="Gerenciamento e consulta de Empresas."
            onBack={() => setActiveView("home")}
          />

          <SindSystemEmployersTable
            employers={employers}
            onViewContributions={(employerId) => {
              setFilterEmployer(employerId);
              setActiveView("boletos");
            }}
          />

          <div className="mt-6">
            <SindSystemBackButton onClick={() => setActiveView("home")} />
          </div>
        </SindSystemMain>
      </SindSystemContainer>
    );
  }

  // Documents View - Convenções Coletivas por Categoria da Empresa
  if (activeView === "documents") {
    return (
      <SindSystemContainer>
        <SindSystemHeader
          logoUrl={clinic?.logo_url}
          entityName={accountingOffice?.name || "Escritório"}
          entityEmail={accountingOffice?.email}
          onLogout={handleLogout}
        />
        
        <SindSystemMain>
          <SindSystemPageHeader
            icon={<FolderOpen className="h-6 w-6 text-amber-500" />}
            title="Documentos Coletivos"
            subtitle={selectedEmployerForDocuments 
              ? `Convenções para: ${selectedEmployerForDocuments.name}` 
              : "Selecione uma empresa para ver as convenções coletivas"}
            onBack={() => {
              if (selectedEmployerForDocuments) {
                setSelectedEmployerForDocuments(null);
              } else {
                setActiveView("home");
              }
            }}
          />

          {!selectedEmployerForDocuments ? (
            // Mostrar lista de empresas para seleção
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50">
                <h3 className="font-medium text-slate-700 flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-slate-500" />
                  Selecione a empresa
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  As convenções coletivas serão exibidas de acordo com o segmento da empresa selecionada.
                </p>
              </div>
              
              {employers.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  <Building2 className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                  <p>Nenhuma empresa vinculada.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {employers.map((employer) => (
                    <button
                      key={employer.id}
                      onClick={() => setSelectedEmployerForDocuments(employer)}
                      className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors text-left group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                          <Building2 className="h-5 w-5 text-amber-600" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-medium text-slate-900 text-sm truncate">
                            {employer.trade_name || employer.name}
                          </h4>
                          <p className="text-xs text-slate-500 truncate mt-0.5">
                            {formatCNPJ(employer.cnpj)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {employer.category?.name && (
                          <span className="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-700">
                            {employer.category.name}
                          </span>
                        )}
                        <FileText className="h-4 w-4 text-slate-400 group-hover:text-amber-600 transition-colors flex-shrink-0" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            // Mostrar convenções filtradas pela categoria
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              {clinic?.id && (
                <PortalConventionsSection 
                  clinicId={clinic.id} 
                  employerCategoryId={selectedEmployerForDocuments.category_id}
                />
              )}
            </div>
          )}

          <div className="mt-6">
            <SindSystemBackButton onClick={() => {
              if (selectedEmployerForDocuments) {
                setSelectedEmployerForDocuments(null);
              } else {
                setActiveView("home");
              }
            }} />
          </div>
        </SindSystemMain>
      </SindSystemContainer>
    );
  }

  // Homologacao View - Seleção de empresa ou agendamento
  if (activeView === "homologacao") {
    // Se já selecionou uma empresa, mostra o formulário de agendamento
    if (selectedEmployerForHomologacao && clinic?.id) {
      return (
        <SindSystemContainer>
          <SindSystemHeader
            logoUrl={clinic?.logo_url}
            entityName={accountingOffice?.name || "Escritório"}
            entityEmail={accountingOffice?.email}
            onLogout={handleLogout}
          />
          
          <SindSystemMain>
            <PortalHomologacaoBooking
              employer={selectedEmployerForHomologacao}
              clinicId={clinic.id}
              onBack={() => {
                setSelectedEmployerForHomologacao(null);
              }}
              onSuccess={() => {
                setSelectedEmployerForHomologacao(null);
                setActiveView("home");
              }}
            />
          </SindSystemMain>
        </SindSystemContainer>
      );
    }

    // Mostrar lista de empresas para seleção
    return (
      <SindSystemContainer>
        <SindSystemHeader
          logoUrl={clinic?.logo_url}
          entityName={accountingOffice?.name || "Escritório"}
          entityEmail={accountingOffice?.email}
          onLogout={handleLogout}
        />
        
        <SindSystemMain>
          <SindSystemPageHeader
            icon={<Handshake className="h-6 w-6 text-blue-500" />}
            title="Agendar Homologação"
            subtitle="Selecione uma empresa para agendar a homologação"
            onBack={() => setActiveView("home")}
          />

          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50">
              <h3 className="font-medium text-slate-700 flex items-center gap-2">
                <Building2 className="h-5 w-5 text-slate-500" />
                Selecione a empresa
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                Escolha a empresa para agendar a homologação de rescisão.
              </p>
            </div>
            
            {employers.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <Building2 className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                <p>Nenhuma empresa vinculada.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {employers.map((employer) => (
                  <button
                    key={employer.id}
                    onClick={() => setSelectedEmployerForHomologacao(employer)}
                    className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors text-left group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <Building2 className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-medium text-slate-900 text-sm truncate">
                          {employer.trade_name || employer.name}
                        </h4>
                        <p className="text-xs text-slate-500 truncate mt-0.5">
                          {formatCNPJ(employer.cnpj)}
                        </p>
                      </div>
                    </div>
                    <Handshake className="h-4 w-4 text-slate-400 group-hover:text-blue-600 transition-colors flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6">
            <SindSystemBackButton onClick={() => setActiveView("home")} />
          </div>
        </SindSystemMain>
      </SindSystemContainer>
    );
  }

  // Boletos View
  return (
    <SindSystemContainer>
      <SindSystemHeader
        logoUrl={clinic?.logo_url}
        entityName={accountingOffice?.name || "Escritório"}
        entityEmail={accountingOffice?.email}
        onLogout={handleLogout}
      />
      
      <SindSystemMain>
        <SindSystemPageHeader
          icon={<Barcode className="h-6 w-6 text-emerald-500" />}
          title="Gerenciamento de Boletos."
          subtitle="Gerenciamento e consulta de boletos."
          onBack={() => setActiveView("home")}
        />

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
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
        </div>

        <div className="mt-6">
          <SindSystemBackButton onClick={() => setActiveView("home")} />
        </div>
      </SindSystemMain>

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
    </SindSystemContainer>
  );
}
