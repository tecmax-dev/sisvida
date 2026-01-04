import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { 
  Building2, 
  LogIn, 
  FileText, 
  Download, 
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
  Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Employer {
  id: string;
  name: string;
  cnpj: string;
}

interface Contribution {
  id: string;
  amount: number;
  due_date: string;
  status: string;
  competence_month: number;
  competence_year: number;
  lytex_url: string | null;
  paid_at: string | null;
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

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: "Pendente", color: "bg-amber-500/20 text-amber-600 border-amber-300", icon: <Clock className="h-3 w-3" /> },
  paid: { label: "Pago", color: "bg-emerald-500/20 text-emerald-600 border-emerald-300", icon: <CheckCircle2 className="h-3 w-3" /> },
  overdue: { label: "Vencido", color: "bg-red-500/20 text-red-600 border-red-300", icon: <AlertCircle className="h-3 w-3" /> },
  cancelled: { label: "Cancelado", color: "bg-gray-500/20 text-gray-600 border-gray-300", icon: <XCircle className="h-3 w-3" /> },
};

const monthNames = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export default function EmployerPortal() {
  const [cnpj, setCnpj] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [employer, setEmployer] = useState<Employer | null>(null);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [reissueRequests, setReissueRequests] = useState<ReissueRequest[]>([]);
  const [selectedContribution, setSelectedContribution] = useState<Contribution | null>(null);
  const [reissueReason, setReissueReason] = useState("");
  const [showReissueDialog, setShowReissueDialog] = useState(false);
  const [showAlertDialog, setShowAlertDialog] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  // Formatar CNPJ enquanto digita
  const formatCnpj = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    return numbers
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2")
      .slice(0, 18);
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
        
        // Verificar boletos vencidos para alerta
        const overdue = data.contributions.filter((c: Contribution) => c.status === "overdue");
        if (overdue.length > 0) {
          setAlertMessage(`Você possui ${overdue.length} boleto(s) vencido(s). Regularize sua situação para evitar pendências.`);
          setShowAlertDialog(true);
        }
      }

      // Carregar solicitações de 2ª via
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

  const handleReissueRequest = async () => {
    if (!selectedContribution || !employer) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("employer-portal-auth", {
        body: {
          action: "request_reissue",
          employer_id: employer.id,
          contribution_id: selectedContribution.id,
          reason: reissueReason || "Solicitação de 2ª via",
        },
      });

      if (error || data.error) {
        toast.error(data?.error || "Erro ao solicitar 2ª via");
        return;
      }

      toast.success("Solicitação enviada com sucesso! Aguarde o processamento.");
      setShowReissueDialog(false);
      setReissueReason("");
      loadContributions(employer.id);
    } catch (err) {
      toast.error("Erro de conexão");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    setEmployer(null);
    setContributions([]);
    setReissueRequests([]);
    sessionStorage.removeItem("employer_session");
    setCnpj("");
    setAccessCode("");
  };

  // Recuperar sessão ao carregar
  useEffect(() => {
    const saved = sessionStorage.getItem("employer_session");
    if (saved) {
      const emp = JSON.parse(saved);
      setEmployer(emp);
      loadContributions(emp.id);
    }
  }, []);

  const filteredContributions = contributions.filter((c) => {
    if (activeTab === "all") return true;
    return c.status === activeTab;
  });

  const stats = {
    total: contributions.length,
    paid: contributions.filter(c => c.status === "paid").length,
    pending: contributions.filter(c => c.status === "pending").length,
    overdue: contributions.filter(c => c.status === "overdue").length,
    totalValue: contributions.reduce((sum, c) => sum + (c.amount || 0), 0),
    overdueValue: contributions.filter(c => c.status === "overdue").reduce((sum, c) => sum + (c.amount || 0), 0),
  };

  // Login Screen
  if (!employer) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-cta/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-2xl border-0 bg-card/95 backdrop-blur-sm">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-cta flex items-center justify-center mb-4 shadow-lg">
              <Building2 className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold">Portal da Empresa</CardTitle>
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
              Não possui código de acesso? Entre em contato com o sindicato.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Dashboard
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-cta/5">
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

      {/* Reissue Dialog */}
      <Dialog open={showReissueDialog} onOpenChange={setShowReissueDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar 2ª Via do Boleto</DialogTitle>
            <DialogDescription>
              {selectedContribution && (
                <span>
                  Competência: {monthNames[selectedContribution.competence_month - 1]}/{selectedContribution.competence_year}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Motivo (opcional)</label>
              <Textarea
                placeholder="Ex: Boleto perdido, vencimento expirado..."
                value={reissueReason}
                onChange={(e) => setReissueReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReissueDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleReissueRequest} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Solicitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <header className="bg-card/95 backdrop-blur-sm border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-cta flex items-center justify-center">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg">{employer.name}</h1>
              <p className="text-xs text-muted-foreground">CNPJ: {formatCnpj(employer.cnpj)}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-primary mb-1">
                <Receipt className="h-4 w-4" />
                <span className="text-xs font-medium">Total</span>
              </div>
              <p className="text-2xl font-bold">{stats.total}</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-emerald-600 mb-1">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-xs font-medium">Pagos</span>
              </div>
              <p className="text-2xl font-bold text-emerald-600">{stats.paid}</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-amber-600 mb-1">
                <Clock className="h-4 w-4" />
                <span className="text-xs font-medium">Pendentes</span>
              </div>
              <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-red-600 mb-1">
                <AlertCircle className="h-4 w-4" />
                <span className="text-xs font-medium">Vencidos</span>
              </div>
              <p className="text-2xl font-bold text-red-600">{stats.overdue}</p>
            </CardContent>
          </Card>
        </div>

        {/* Overdue Alert Banner */}
        {stats.overdue > 0 && (
          <Card className="bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-900">
            <CardContent className="py-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center shrink-0">
                <Bell className="h-6 w-6 text-red-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-red-800 dark:text-red-200">
                  Você possui {stats.overdue} boleto(s) em atraso
                </p>
                <p className="text-sm text-red-600 dark:text-red-300">
                  Valor total em atraso: R$ {stats.overdueValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <Button 
                size="sm" 
                variant="outline" 
                className="border-red-300 text-red-700 hover:bg-red-100"
                onClick={() => setActiveTab("overdue")}
              >
                Ver Boletos
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Contributions Table */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Contribuições
              </CardTitle>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => loadContributions(employer.id)}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Atualizar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="all">Todos ({stats.total})</TabsTrigger>
                <TabsTrigger value="pending">Pendentes ({stats.pending})</TabsTrigger>
                <TabsTrigger value="overdue">Vencidos ({stats.overdue})</TabsTrigger>
                <TabsTrigger value="paid">Pagos ({stats.paid})</TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab} className="space-y-3">
                {filteredContributions.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhuma contribuição encontrada</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredContributions.map((contribution) => {
                      const status = statusConfig[contribution.status] || statusConfig.pending;
                      const hasPendingRequest = reissueRequests.some(
                        r => r.contribution_id === contribution.id && r.status === "pending"
                      );

                      return (
                        <div
                          key={contribution.id}
                          className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl border bg-card hover:shadow-md transition-shadow"
                        >
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">
                                {monthNames[contribution.competence_month - 1]}/{contribution.competence_year}
                              </span>
                              <Badge variant="outline" className={status.color}>
                                {status.icon}
                                <span className="ml-1">{status.label}</span>
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {contribution.contribution_type?.name || "Contribuição"}
                            </p>
                            <div className="flex items-center gap-4 text-sm">
                              <span className="flex items-center gap-1">
                                <DollarSign className="h-3 w-3" />
                                R$ {contribution.amount?.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                              </span>
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <Calendar className="h-3 w-3" />
                                Venc: {format(new Date(contribution.due_date + "T12:00:00"), "dd/MM/yyyy")}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {contribution.lytex_url && contribution.status !== "paid" && contribution.status !== "cancelled" && (
                              <Button
                                size="sm"
                                variant="outline"
                                asChild
                              >
                                <a href={contribution.lytex_url} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-4 w-4 mr-1" />
                                  Ver Boleto
                                </a>
                              </Button>
                            )}
                            {contribution.status === "overdue" && !hasPendingRequest && (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => {
                                  setSelectedContribution(contribution);
                                  setShowReissueDialog(true);
                                }}
                              >
                                <RefreshCw className="h-4 w-4 mr-1" />
                                2ª Via
                              </Button>
                            )}
                            {hasPendingRequest && (
                              <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200">
                                <Clock className="h-3 w-3 mr-1" />
                                2ª via solicitada
                              </Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Reissue Requests */}
        {reissueRequests.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                Solicitações de 2ª Via
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {reissueRequests.map((request) => (
                  <div
                    key={request.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        Solicitado em {format(new Date(request.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </p>
                      <p className="text-xs text-muted-foreground">{request.reason}</p>
                    </div>
                    <Badge variant="outline" className={
                      request.status === "completed" ? "bg-emerald-50 text-emerald-600 border-emerald-200" :
                      request.status === "processing" ? "bg-blue-50 text-blue-600 border-blue-200" :
                      request.status === "rejected" ? "bg-red-50 text-red-600 border-red-200" :
                      "bg-amber-50 text-amber-600 border-amber-200"
                    }>
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
      <footer className="border-t bg-card/50 py-6 mt-12">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>Portal da Empresa • Acesso seguro às suas contribuições</p>
        </div>
      </footer>
    </div>
  );
}
