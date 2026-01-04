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
  Users, 
  LogIn, 
  FileText, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  XCircle,
  RefreshCw,
  ExternalLink,
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
  User
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface Clinic {
  id: string;
  name: string;
  logo_url: string | null;
  phone: string | null;
}

interface Member {
  id: string;
  name: string;
  cpf: string;
  email: string | null;
  phone: string | null;
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
  contribution_type: { id: string; name: string } | null;
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
};

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MONTHS_FULL = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export default function MemberPortal() {
  const { clinicSlug } = useParams();
  const [cpf, setCpf] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRequestingCode, setIsRequestingCode] = useState(false);
  const [step, setStep] = useState<"cpf" | "code" | "dashboard">("cpf");
  const [member, setMember] = useState<Member | null>(null);
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [selectedContribution, setSelectedContribution] = useState<Contribution | null>(null);
  const [showReissueDialog, setShowReissueDialog] = useState(false);
  const [showAlertDialog, setShowAlertDialog] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [isGeneratingReissue, setIsGeneratingReissue] = useState(false);
  const [memberFirstName, setMemberFirstName] = useState("");

  // Filters
  const [statusFilter, setStatusFilter] = useState("hide_cancelled");
  const [typeFilter, setTypeFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Restore session
  useEffect(() => {
    const savedSession = sessionStorage.getItem(`member_portal_${clinicSlug}`);
    if (savedSession) {
      try {
        const session = JSON.parse(savedSession);
        if (session.member && session.clinic) {
          setMember(session.member);
          setClinic(session.clinic);
          setStep("dashboard");
          loadContributions(session.member.id);
        }
      } catch (e) {
        console.error("Error restoring session:", e);
      }
    }
  }, [clinicSlug]);

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
        .single();

      if (error) throw error;
      setClinic(data);
    } catch (error) {
      console.error("Error loading clinic:", error);
      toast.error("Clínica não encontrada");
    }
  };

  const formatCPF = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
    if (numbers.length <= 9) return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
    return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9, 11)}`;
  };

  const handleCPFChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCPF(e.target.value);
    if (formatted.length <= 14) {
      setCpf(formatted);
    }
  };

  const requestAccessCode = async () => {
    if (!clinicSlug || cpf.replace(/\D/g, "").length !== 11) {
      toast.error("CPF inválido");
      return;
    }

    setIsRequestingCode(true);
    try {
      const { data, error } = await supabase.functions.invoke("member-portal-auth", {
        body: {
          action: "request_code",
          clinicSlug,
          cpf: cpf.replace(/\D/g, "")
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      setMemberFirstName(data.memberName || "");
      setStep("code");
      
      if (data.hasWhatsApp) {
        toast.success("Código enviado para seu WhatsApp!");
      } else {
        toast.info("Código gerado. Entre em contato com a administração.");
      }
    } catch (error: any) {
      console.error("Error requesting code:", error);
      toast.error(error.message || "Erro ao solicitar código");
    } finally {
      setIsRequestingCode(false);
    }
  };

  const validateAccessCode = async () => {
    if (!clinicSlug || !accessCode) {
      toast.error("Digite o código de acesso");
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("member-portal-auth", {
        body: {
          action: "validate_code",
          clinicSlug,
          cpf: cpf.replace(/\D/g, ""),
          accessCode
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      setMember(data.member);
      setClinic(data.clinic);
      setStep("dashboard");
      
      // Save session
      sessionStorage.setItem(`member_portal_${clinicSlug}`, JSON.stringify({
        member: data.member,
        clinic: data.clinic
      }));

      await loadContributions(data.member.id);
      toast.success(`Bem-vindo, ${data.member.name.split(" ")[0]}!`);
    } catch (error: any) {
      console.error("Error validating code:", error);
      toast.error(error.message || "Código inválido");
    } finally {
      setIsLoading(false);
    }
  };

  const loadContributions = async (memberId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("member-portal-auth", {
        body: {
          action: "get_contributions",
          memberId
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      setContributions(data.contributions || []);
    } catch (error: any) {
      console.error("Error loading contributions:", error);
      toast.error("Erro ao carregar contribuições");
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem(`member_portal_${clinicSlug}`);
    setMember(null);
    setContributions([]);
    setStep("cpf");
    setCpf("");
    setAccessCode("");
    toast.success("Sessão encerrada");
  };

  const handleReissue = async () => {
    if (!selectedContribution || !newDueDate) {
      toast.error("Selecione uma nova data de vencimento");
      return;
    }

    // Check if contribution is overdue
    if (selectedContribution.status !== "overdue") {
      setAlertMessage("Só é possível gerar 2ª via para boletos vencidos. Este boleto ainda está a vencer.");
      setShowAlertDialog(true);
      setShowReissueDialog(false);
      return;
    }

    // Check reissue limit
    if (selectedContribution.portal_reissue_count >= 2) {
      setAlertMessage("Limite de reemissões atingido. Entre em contato com a administração.");
      setShowAlertDialog(true);
      setShowReissueDialog(false);
      return;
    }

    // Check if overdue for more than 90 days
    const dueDate = new Date(selectedContribution.due_date);
    const today = new Date();
    const daysDiff = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff > 90) {
      setAlertMessage("Boleto vencido há mais de 90 dias. Entre em contato com a administração para regularização.");
      setShowAlertDialog(true);
      setShowReissueDialog(false);
      return;
    }

    setIsGeneratingReissue(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-boleto-reissue", {
        body: {
          contributionId: selectedContribution.id,
          contributionType: "member",
          newDueDate,
          requestedBy: "portal"
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      toast.success("Novo boleto gerado com sucesso!");
      setShowReissueDialog(false);
      setSelectedContribution(null);
      setNewDueDate("");
      
      if (member) {
        await loadContributions(member.id);
      }
    } catch (error: any) {
      console.error("Error generating reissue:", error);
      toast.error(error.message || "Erro ao gerar novo boleto");
    } finally {
      setIsGeneratingReissue(false);
    }
  };

  // Calculate stats
  const stats = useMemo(() => {
    const pending = contributions.filter(c => c.status === "pending" || c.status === "overdue");
    const paid = contributions.filter(c => c.status === "paid");
    
    return {
      pendingCount: pending.length,
      pendingTotal: pending.reduce((sum, c) => sum + (c.value || 0), 0),
      paidCount: paid.length,
      paidTotal: paid.reduce((sum, c) => sum + (c.paid_at ? c.value : 0), 0),
      overdueCount: contributions.filter(c => c.status === "overdue").length
    };
  }, [contributions]);

  // Get unique years and types
  const years = useMemo(() => {
    const uniqueYears = [...new Set(contributions.map(c => c.competence_year))];
    return uniqueYears.sort((a, b) => b - a);
  }, [contributions]);

  const types = useMemo(() => {
    const uniqueTypes = contributions
      .filter(c => c.contribution_type)
      .map(c => c.contribution_type!)
      .filter((type, index, self) => self.findIndex(t => t.id === type.id) === index);
    return uniqueTypes;
  }, [contributions]);

  // Filter contributions
  const filteredContributions = useMemo(() => {
    return contributions.filter(c => {
      if (statusFilter === "hide_cancelled" && c.status === "cancelled") return false;
      if (statusFilter !== "all" && statusFilter !== "hide_cancelled" && c.status !== statusFilter) return false;
      if (yearFilter !== "all" && c.competence_year.toString() !== yearFilter) return false;
      if (typeFilter !== "all" && c.contribution_type?.id !== typeFilter) return false;
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const competence = `${MONTHS[c.competence_month - 1]}/${c.competence_year}`.toLowerCase();
        return competence.includes(search) || c.contribution_type?.name.toLowerCase().includes(search);
      }
      return true;
    });
  }, [contributions, statusFilter, yearFilter, typeFilter, searchTerm]);

  const getDocumentNumber = (contribution: Contribution) => {
    if (!contribution.lytex_invoice_id) return "-";
    return contribution.lytex_invoice_id.slice(-8);
  };

  // Login screens
  if (step === "cpf") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-purple-700 to-purple-900 relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
                <circle cx="30" cy="30" r="1.5" fill="white" opacity="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 py-12">
          {clinic?.logo_url && (
            <img src={clinic.logo_url} alt={clinic.name} className="h-20 mb-6 rounded-lg" />
          )}

          <Card className="w-full max-w-md shadow-2xl">
            <CardHeader className="text-center space-y-2 pb-4">
              <div className="mx-auto w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-2">
                <User className="h-8 w-8 text-purple-600" />
              </div>
              <CardTitle className="text-2xl font-semibold text-gray-800">Portal do Sócio</CardTitle>
              <CardDescription className="text-gray-500">
                {clinic?.name || "Acesso exclusivo para sócios"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="cpf" className="text-sm font-medium text-gray-700">CPF</Label>
                <Input
                  id="cpf"
                  value={cpf}
                  onChange={handleCPFChange}
                  placeholder="000.000.000-00"
                  className="text-lg h-12"
                  maxLength={14}
                />
              </div>
              <Button
                onClick={requestAccessCode}
                disabled={isRequestingCode || cpf.replace(/\D/g, "").length !== 11}
                className="w-full h-12 bg-purple-600 hover:bg-purple-700 text-white"
              >
                {isRequestingCode ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Enviando código...
                  </>
                ) : (
                  <>
                    <LogIn className="mr-2 h-5 w-5" />
                    Solicitar Código de Acesso
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <p className="mt-8 text-white/70 text-sm text-center">
            © {new Date().getFullYear()} {clinic?.name || "Sistema de Gestão"}
          </p>
        </div>
      </div>
    );
  }

  if (step === "code") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-purple-700 to-purple-900 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
                <circle cx="30" cy="30" r="1.5" fill="white" opacity="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 py-12">
          {clinic?.logo_url && (
            <img src={clinic.logo_url} alt={clinic.name} className="h-20 mb-6 rounded-lg" />
          )}

          <Card className="w-full max-w-md shadow-2xl">
            <CardHeader className="text-center space-y-2 pb-4">
              <div className="mx-auto w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-2">
                <Lock className="h-8 w-8 text-purple-600" />
              </div>
              <CardTitle className="text-2xl font-semibold text-gray-800">
                Olá, {memberFirstName || "Sócio"}!
              </CardTitle>
              <CardDescription className="text-gray-500">
                Digite o código enviado para seu WhatsApp
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="code" className="text-sm font-medium text-gray-700">Código de Acesso</Label>
                <Input
                  id="code"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                  placeholder="XXXXXX"
                  className="text-lg h-12 text-center tracking-widest font-mono"
                  maxLength={6}
                />
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setStep("cpf")}
                  className="flex-1 h-12"
                >
                  Voltar
                </Button>
                <Button
                  onClick={validateAccessCode}
                  disabled={isLoading || accessCode.length < 6}
                  className="flex-1 h-12 bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Validando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-5 w-5" />
                      Acessar
                    </>
                  )}
                </Button>
              </div>
              <Button
                variant="link"
                onClick={requestAccessCode}
                disabled={isRequestingCode}
                className="w-full text-purple-600"
              >
                {isRequestingCode ? "Reenviando..." : "Reenviar código"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Dashboard
  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-gradient-to-r from-purple-700 to-purple-900 text-white shadow-lg">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {clinic?.logo_url && (
                  <img src={clinic.logo_url} alt={clinic.name} className="h-10 rounded" />
                )}
                <div>
                  <h1 className="text-xl font-semibold">{clinic?.name}</h1>
                  <p className="text-purple-200 text-sm">Portal do Sócio</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right hidden sm:block">
                  <p className="font-medium">{member?.name}</p>
                  <p className="text-purple-200 text-sm">{member?.cpf}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  className="text-white hover:bg-white/10"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sair
                </Button>
              </div>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-amber-700 text-sm font-medium">Pendente</p>
                    <p className="text-2xl font-bold text-amber-900">
                      {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(stats.pendingTotal)}
                    </p>
                    <p className="text-amber-600 text-xs">{stats.pendingCount} contribuição(ões)</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-amber-200 flex items-center justify-center">
                    <Clock className="h-6 w-6 text-amber-700" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-red-700 text-sm font-medium">Vencidos</p>
                    <p className="text-2xl font-bold text-red-900">{stats.overdueCount}</p>
                    <p className="text-red-600 text-xs">boleto(s) em atraso</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-red-200 flex items-center justify-center">
                    <AlertCircle className="h-6 w-6 text-red-700" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-emerald-700 text-sm font-medium">Pagos</p>
                    <p className="text-2xl font-bold text-emerald-900">
                      {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(stats.paidTotal)}
                    </p>
                    <p className="text-emerald-600 text-xs">{stats.paidCount} contribuição(ões)</p>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-emerald-200 flex items-center justify-center">
                    <CheckCircle2 className="h-6 w-6 text-emerald-700" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-3 items-center">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">Filtros:</span>
                </div>
                
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hide_cancelled">Ativos</SelectItem>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="overdue">Vencido</SelectItem>
                    <SelectItem value="paid">Pago</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={yearFilter} onValueChange={setYearFilter}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="Ano" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {years.map(year => (
                      <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {types.length > 0 && (
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os tipos</SelectItem>
                      {types.map(type => (
                        <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Buscar..."
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contributions List */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5 text-purple-600" />
                Minhas Contribuições
              </CardTitle>
              <CardDescription>
                {filteredContributions.length} contribuição(ões) encontrada(s)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-3">
                  {filteredContributions.map((contribution) => (
                    <div
                      key={contribution.id}
                      className={`p-4 rounded-lg border ${STATUS_CONFIG[contribution.status]?.bgColor || "bg-gray-50 border-gray-200"}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Badge variant="outline" className={STATUS_CONFIG[contribution.status]?.color}>
                              {STATUS_CONFIG[contribution.status]?.icon}
                              <span className="ml-1">{STATUS_CONFIG[contribution.status]?.label}</span>
                            </Badge>
                            <span className="text-sm text-gray-600">
                              {contribution.contribution_type?.name || "Contribuição"}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                            <div>
                              <span className="text-gray-500">Competência:</span>
                              <span className="ml-2 font-medium">
                                {MONTHS_FULL[contribution.competence_month - 1]}/{contribution.competence_year}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500">Vencimento:</span>
                              <span className="ml-2 font-medium">
                                {format(new Date(contribution.due_date + "T00:00:00"), "dd/MM/yyyy")}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500">Valor:</span>
                              <span className="ml-2 font-medium">
                                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(contribution.value)}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500">Nº Doc:</span>
                              <span className="ml-2 font-mono text-xs">{getDocumentNumber(contribution)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          {contribution.lytex_invoice_url && contribution.status !== "paid" && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => window.open(contribution.lytex_invoice_url!, "_blank")}
                                >
                                  <ExternalLink className="h-4 w-4 mr-1" />
                                  Ver Boleto
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Abrir boleto em nova aba</TooltipContent>
                            </Tooltip>
                          )}
                          {contribution.status === "overdue" && contribution.portal_reissue_count < 2 && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedContribution(contribution);
                                    setShowReissueDialog(true);
                                  }}
                                >
                                  <RefreshCw className="h-4 w-4 mr-1" />
                                  2ª Via
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Gerar novo boleto com nova data</TooltipContent>
                            </Tooltip>
                          )}
                          {contribution.status === "pending" && (
                            <Tooltip>
                              <TooltipTrigger>
                                <Badge variant="secondary" className="text-xs">
                                  Aguardando vencimento
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                2ª via disponível após o vencimento
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {filteredContributions.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                      <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Nenhuma contribuição encontrada</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </main>

        {/* Reissue Dialog */}
        <Dialog open={showReissueDialog} onOpenChange={setShowReissueDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Gerar 2ª Via do Boleto</DialogTitle>
              <DialogDescription>
                Selecione a nova data de vencimento para o boleto.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Competência</Label>
                <p className="text-sm text-gray-600">
                  {selectedContribution && `${MONTHS_FULL[selectedContribution.competence_month - 1]}/${selectedContribution.competence_year}`}
                </p>
              </div>
              <div>
                <Label>Valor</Label>
                <p className="text-sm text-gray-600">
                  {selectedContribution && new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(selectedContribution.value)}
                </p>
              </div>
              <div>
                <Label htmlFor="newDueDate">Nova Data de Vencimento</Label>
                <Input
                  id="newDueDate"
                  type="date"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  min={format(new Date(), "yyyy-MM-dd")}
                />
              </div>
              {selectedContribution && selectedContribution.portal_reissue_count > 0 && (
                <p className="text-sm text-amber-600">
                  <AlertTriangle className="inline h-4 w-4 mr-1" />
                  Esta é sua {selectedContribution.portal_reissue_count + 1}ª reemissão. Limite: 2 vezes.
                </p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowReissueDialog(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleReissue}
                disabled={isGeneratingReissue || !newDueDate}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {isGeneratingReissue ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  "Gerar Novo Boleto"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Alert Dialog */}
        <Dialog open={showAlertDialog} onOpenChange={setShowAlertDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="h-5 w-5" />
                Atenção
              </DialogTitle>
            </DialogHeader>
            <p className="text-gray-600">{alertMessage}</p>
            <DialogFooter>
              <Button onClick={() => setShowAlertDialog(false)}>
                Entendi
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
