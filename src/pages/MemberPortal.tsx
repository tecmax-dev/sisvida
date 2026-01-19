import { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { 
  User, 
  FileText, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  XCircle,
  DollarSign,
  AlertTriangle,
  Loader2,
  CreditCard,
  LogOut,
  Eye,
  EyeOff,
  Building2,
  ExternalLink,
  Handshake
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCompetence } from "@/lib/competence-format";
import { formatDateBR } from "@/lib/date";
import { 
  PortalHeader, 
  PortalContainer, 
  PortalMain 
} from "@/components/portal/PortalLayout";
import { PortalConventionsSection } from "@/components/portal/PortalServicesSection";

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
  photo_url: string | null;
  registration_number: string | null;
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
  contribution_type: { id: string; name: string } | null;
}

interface PatientCard {
  id: string;
  card_number: string;
  card_expires_at: string | null;
  is_active: boolean;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: React.ReactNode }> = {
  pending: { 
    label: "Pendente", 
    color: "text-amber-700 dark:text-amber-400", 
    bgColor: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800",
    icon: <Clock className="h-3.5 w-3.5" />
  },
  paid: { 
    label: "Pago", 
    color: "text-emerald-700 dark:text-emerald-400", 
    bgColor: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />
  },
  overdue: { 
    label: "Vencido", 
    color: "text-red-700 dark:text-red-400", 
    bgColor: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800",
    icon: <AlertCircle className="h-3.5 w-3.5" />
  },
  cancelled: { 
    label: "Cancelado", 
    color: "text-slate-500 dark:text-slate-400", 
    bgColor: "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700",
    icon: <XCircle className="h-3.5 w-3.5" />
  },
  awaiting_value: { 
    label: "Aguardando", 
    color: "text-purple-700 dark:text-purple-400", 
    bgColor: "bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800",
    icon: <DollarSign className="h-3.5 w-3.5" />
  },
  negotiated: { 
    label: "Em Negociação", 
    color: "text-indigo-700 dark:text-indigo-400", 
    bgColor: "bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800",
    icon: <Handshake className="h-3.5 w-3.5" />
  },
};

// CPF formatting
const formatCPF = (value: string) => {
  const numbers = value.replace(/\D/g, '');
  if (numbers.length <= 3) return numbers;
  if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
  if (numbers.length <= 9) return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
  return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9, 11)}`;
};

// CPF validation
const isValidCPF = (cpf: string) => {
  const numbers = cpf.replace(/\D/g, '');
  if (numbers.length !== 11) return false;
  if (/^(\d)\1+$/.test(numbers)) return false;
  
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(numbers[i]) * (10 - i);
  }
  let digit = (sum * 10) % 11;
  if (digit === 10) digit = 0;
  if (digit !== parseInt(numbers[9])) return false;
  
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(numbers[i]) * (11 - i);
  }
  digit = (sum * 10) % 11;
  if (digit === 10) digit = 0;
  if (digit !== parseInt(numbers[10])) return false;
  
  return true;
};

const TARGET_CLINIC_ID = "89e7585e-7bce-4e58-91fa-c37080d1170d";

export default function MemberPortal() {
  const { clinicSlug } = useParams();
  const [cpf, setCpf] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [member, setMember] = useState<Member | null>(null);
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [card, setCard] = useState<PatientCard | null>(null);
  const [showAlertDialog, setShowAlertDialog] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState(() => {
    const now = new Date();
    return now.getMonth() === 0 ? String(now.getFullYear() - 1) : String(now.getFullYear());
  });

  useEffect(() => {
    if (clinicSlug) {
      loadClinicBySlug(clinicSlug);
    } else {
      loadClinicById(TARGET_CLINIC_ID);
    }
    
    // Check for existing session
    const savedSession = sessionStorage.getItem("member_portal_session");
    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession);
        setMember(parsed);
        loadContributions(parsed.id);
        loadCard(parsed.id);
      } catch (e) {
        sessionStorage.removeItem("member_portal_session");
      }
    }
  }, [clinicSlug]);

  const loadClinicBySlug = async (slug: string) => {
    const { data } = await supabase
      .from("clinics")
      .select("id, name, logo_url, phone")
      .eq("slug", slug)
      .maybeSingle();
    if (data) setClinic(data);
  };

  const loadClinicById = async (id: string) => {
    const { data } = await supabase
      .from("clinics")
      .select("id, name, logo_url, phone")
      .eq("id", id)
      .maybeSingle();
    if (data) setClinic(data);
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format((cents || 0) / 100);
  };

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!cpf || !password) {
      toast.error("Preencha CPF e senha");
      return;
    }

    if (!isValidCPF(cpf)) {
      toast.error("CPF inválido");
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("member-portal-auth", {
        body: { 
          action: "login", 
          cpf, 
          password,
          clinic_id: clinic?.id || TARGET_CLINIC_ID
        },
      });

      if (error || data.error) {
        toast.error(data?.error || "Erro ao fazer login");
        return;
      }

      setMember(data.member);
      sessionStorage.setItem("member_portal_session", JSON.stringify(data.member));
      
      toast.success(`Bem-vindo(a), ${data.member.name.split(' ')[0]}!`);
      loadContributions(data.member.id);
      loadCard(data.member.id);
    } catch (err) {
      toast.error("Erro de conexão");
    } finally {
      setIsLoading(false);
    }
  };

  const loadContributions = async (memberId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("member-portal-auth", {
        body: { action: "get_contributions", member_id: memberId },
      });

      if (!error && data.contributions) {
        setContributions(data.contributions);
        
        const overdue = data.contributions.filter((c: Contribution) => c.status === "overdue");
        if (overdue.length > 0) {
          const overdueCents = overdue.reduce((sum: number, c: Contribution) => sum + (c.amount || 0), 0);
          setAlertMessage(`Você possui ${overdue.length} contribuição(ões) vencida(s) totalizando ${formatCurrency(overdueCents)}.`);
          setShowAlertDialog(true);
        }
      }
    } catch (err) {
      console.error("Error loading contributions:", err);
    }
  };

  const loadCard = async (memberId: string) => {
    try {
      const { data } = await supabase.functions.invoke("member-portal-auth", {
        body: { action: "get_card", member_id: memberId },
      });
      if (data?.card) {
        setCard(data.card);
      }
    } catch (err) {
      console.error("Error loading card:", err);
    }
  };

  const handleLogout = () => {
    setMember(null);
    setContributions([]);
    setCard(null);
    sessionStorage.removeItem("member_portal_session");
    toast.success("Sessão encerrada");
  };

  const contributionYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years = new Set([currentYear, ...contributions.map(c => c.competence_year)]);
    return Array.from(years).sort((a, b) => b - a);
  }, [contributions]);

  const filteredContributions = useMemo(() => {
    return contributions.filter(c => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (yearFilter !== "all" && c.competence_year !== parseInt(yearFilter)) return false;
      return true;
    });
  }, [contributions, statusFilter, yearFilter]);

  // Group by competence
  const groupedContributions = useMemo(() => {
    const groups: Record<string, Contribution[]> = {};
    filteredContributions.forEach(c => {
      const key = `${c.competence_year}-${String(c.competence_month).padStart(2, '0')}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(c);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredContributions]);

  // Metrics
  const metrics = useMemo(() => {
    const pending = contributions.filter(c => c.status === "pending");
    const overdue = contributions.filter(c => c.status === "overdue");
    const paid = contributions.filter(c => c.status === "paid");
    
    return {
      pendingCount: pending.length,
      pendingValue: pending.reduce((s, c) => s + (c.amount || 0), 0),
      overdueCount: overdue.length,
      overdueValue: overdue.reduce((s, c) => s + (c.amount || 0), 0),
      paidCount: paid.length,
      paidValue: paid.reduce((s, c) => s + (c.amount || 0), 0),
    };
  }, [contributions]);

  // ==================== LOGIN SCREEN ====================
  if (!member) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-800 via-emerald-900 to-slate-900 relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="network" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
                <circle cx="50" cy="50" r="1.5" fill="currentColor" className="text-emerald-300" />
                <circle cx="0" cy="0" r="1" fill="currentColor" className="text-emerald-300" />
                <circle cx="100" cy="0" r="1" fill="currentColor" className="text-emerald-300" />
                <circle cx="0" cy="100" r="1" fill="currentColor" className="text-emerald-300" />
                <circle cx="100" cy="100" r="1" fill="currentColor" className="text-emerald-300" />
                <line x1="50" y1="50" x2="0" y2="0" stroke="currentColor" strokeWidth="0.3" className="text-emerald-300/50" />
                <line x1="50" y1="50" x2="100" y2="0" stroke="currentColor" strokeWidth="0.3" className="text-emerald-300/50" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#network)" />
          </svg>
        </div>

        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 py-12">
          {/* Logo */}
          <div className="text-center mb-8">
            {clinic?.logo_url ? (
              <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-white/10 backdrop-blur-sm p-2 shadow-xl ring-2 ring-white/20">
                <img src={clinic.logo_url} alt={clinic.name} className="w-full h-full object-contain rounded-full" />
              </div>
            ) : (
              <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center shadow-xl ring-2 ring-white/20">
                <User className="w-12 h-12 text-white/70" />
              </div>
            )}
            <h1 className="text-2xl font-bold text-white mb-2">{clinic?.name || "Portal do Sócio"}</h1>
            <p className="text-emerald-200/80">Acesso restrito para associados</p>
          </div>

          {/* Login Card */}
          <Card className="w-full max-w-md shadow-2xl border-0">
            <CardContent className="pt-6 space-y-4">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="cpf">CPF</Label>
                  <Input
                    id="cpf"
                    type="text"
                    placeholder="000.000.000-00"
                    value={cpf}
                    onChange={(e) => setCpf(formatCPF(e.target.value))}
                    maxLength={14}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Digite sua senha"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={isLoading}>
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Acessar
                </Button>
              </form>

              <div className="text-center text-sm text-muted-foreground">
                <a href="/app" className="text-emerald-600 hover:underline">
                  Primeiro acesso? Recuperar senha
                </a>
              </div>
            </CardContent>
          </Card>

          <p className="mt-8 text-emerald-200/60 text-sm">
            © {new Date().getFullYear()} {clinic?.name || "Sindicato"}
          </p>
        </div>
      </div>
    );
  }

  // ==================== PORTAL DASHBOARD ====================
  return (
    <PortalContainer>
      <PortalHeader 
        logoUrl={clinic?.logo_url} 
        clinicName={clinic?.name || "Portal do Sócio"}
        entityName={member.name}
        entitySubtitle={`CPF: ${formatCPF(member.cpf)}`}
        onLogout={handleLogout}
        variant="teal"
      />

      <PortalMain>
        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl p-6 text-white mb-6">
          <div className="flex items-center gap-4">
            {member.photo_url ? (
              <img src={member.photo_url} alt={member.name} className="w-16 h-16 rounded-full border-2 border-white/30" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
                <User className="w-8 h-8" />
              </div>
            )}
            <div>
              <h2 className="text-xl font-bold">Olá, {member.name.split(' ')[0]}!</h2>
              <p className="text-emerald-100">
                CPF: {formatCPF(member.cpf)} {member.registration_number && `• Matrícula: ${member.registration_number}`}
              </p>
            </div>
          </div>
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="border-l-4 border-l-amber-500 dark:border-l-amber-400">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pendentes</p>
                  <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{metrics.pendingCount}</p>
                  <p className="text-sm text-muted-foreground">{formatCurrency(metrics.pendingValue)}</p>
                </div>
                <Clock className="h-8 w-8 text-amber-500/30 dark:text-amber-400/30" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-red-500 dark:border-l-red-400">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Vencidas</p>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">{metrics.overdueCount}</p>
                  <p className="text-sm text-muted-foreground">{formatCurrency(metrics.overdueValue)}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-red-500/30 dark:text-red-400/30" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-emerald-500 dark:border-l-emerald-400">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pagas</p>
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{metrics.paidCount}</p>
                  <p className="text-sm text-muted-foreground">{formatCurrency(metrics.paidValue)}</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-emerald-500/30 dark:text-emerald-400/30" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Card Info */}
        {card && (
          <Card className="mb-6 bg-gradient-to-r from-slate-800 to-slate-900 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CreditCard className="h-6 w-6" />
                  <div>
                    <p className="font-semibold">Carteirinha Digital</p>
                    <p className="text-sm text-slate-300">Nº {card.card_number}</p>
                  </div>
                </div>
                {card.card_expires_at && (
                  <Badge variant="outline" className="text-white border-white/30">
                    Válida até {formatDateBR(card.card_expires_at)}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[150px]">
                <Label className="text-xs">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="pending">Pendentes</SelectItem>
                    <SelectItem value="overdue">Vencidas</SelectItem>
                    <SelectItem value="paid">Pagas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 min-w-[150px]">
                <Label className="text-xs">Ano</Label>
                <Select value={yearFilter} onValueChange={setYearFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {contributionYears.map(year => (
                      <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contributions List */}
        <div className="space-y-4">
          {groupedContributions.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>Nenhuma contribuição encontrada</p>
              </CardContent>
            </Card>
          ) : (
            groupedContributions.map(([key, items]) => {
              const [year, month] = key.split('-').map(Number);
              return (
                <Card key={key}>
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-lg mb-3 text-slate-700 dark:text-slate-200">
                      {formatCompetence(month, year)}
                    </h3>
                    <div className="space-y-2">
                      {items.map(contrib => {
                        const config = STATUS_CONFIG[contrib.status] || STATUS_CONFIG.pending;
                        return (
                          <div 
                            key={contrib.id} 
                            className={`flex items-center justify-between p-3 rounded-lg border ${config.bgColor}`}
                          >
                            <div className="flex items-center gap-3">
                              <Badge variant="outline" className={`${config.color} ${config.bgColor}`}>
                                {config.icon}
                                <span className="ml-1">{config.label}</span>
                              </Badge>
                              <div>
                                <p className="font-medium">{contrib.contribution_type?.name || "Contribuição"}</p>
                                <p className="text-sm text-muted-foreground">
                                  Venc.: {contrib.due_date ? formatDateBR(contrib.due_date) : "-"}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-bold">{formatCurrency(contrib.amount)}</p>
                              {contrib.lytex_url && contrib.status !== "paid" && (
                                <Button
                                  variant="link"
                                  size="sm"
                                  className="h-auto p-0 text-emerald-600"
                                  onClick={() => window.open(contrib.lytex_url!, "_blank")}
                                >
                                  <ExternalLink className="h-3 w-3 mr-1" />
                                  Ver Boleto
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Convenções Coletivas */}
        {clinic?.id && (
          <div className="mt-6">
            <PortalConventionsSection clinicId={clinic.id} />
          </div>
        )}
      </PortalMain>

      {/* Overdue Alert Dialog */}
      <Dialog open={showAlertDialog} onOpenChange={setShowAlertDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Atenção
            </DialogTitle>
            <DialogDescription>{alertMessage}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setShowAlertDialog(false)}>Entendi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalContainer>
  );
}
