import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { 
  Building2, 
  LogOut, 
  FileText, 
  Search, 
  Calendar, 
  DollarSign,
  ExternalLink,
  Building,
  Mail,
  Lock,
  Loader2,
  Printer,
  RefreshCw
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
}

interface Contribution {
  id: string;
  employer_id: string;
  competence_month: number;
  competence_year: number;
  due_date: string;
  value: number;
  status: string;
  lytex_invoice_url?: string;
  employer?: {
    id: string;
    name: string;
    cnpj: string;
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
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pending: { label: "Pendente", className: "bg-yellow-100 text-yellow-800" },
  paid: { label: "Pago", className: "bg-green-100 text-green-800" },
  overdue: { label: "Vencido", className: "bg-red-100 text-red-800" },
  cancelled: { label: "Cancelado", className: "bg-gray-100 text-gray-800" },
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
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterEmployer, setFilterEmployer] = useState<string>("all");
  const [filterMonth, setFilterMonth] = useState<string>("all");
  const [filterYear, setFilterYear] = useState<string>("all");
  
  // Dialog de segunda via
  const [showReissueDialog, setShowReissueDialog] = useState(false);
  const [selectedContribution, setSelectedContribution] = useState<Contribution | null>(null);
  const [newDueDate, setNewDueDate] = useState("");
  const [isGeneratingReissue, setIsGeneratingReissue] = useState(false);

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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
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
      
      // Salvar sessão no sessionStorage
      sessionStorage.setItem("accounting_office_session", JSON.stringify({
        accountingOffice: data.accounting_office
      }));
      
      toast.success("Login realizado com sucesso!");
      
      // Carregar dados
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
      // Carregar empresas
      const { data: employersData } = await supabase.functions.invoke("accounting-office-portal-auth", {
        body: { action: "get_employers", accounting_office_id: officeId },
      });
      
      if (employersData?.employers) {
        setEmployers(employersData.employers);
      }

      // Carregar contribuições
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

  const getMinDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split("T")[0];
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

  const handlePrintEmployersList = () => {
    if (!accountingOffice || employers.length === 0) {
      toast.error("Nenhuma empresa para imprimir");
      return;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header com gradiente simulado
    doc.setFillColor(0, 128, 128);
    doc.rect(0, 0, pageWidth, 40, "F");
    
    // Título
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text("Relatório de Empresas Vinculadas", pageWidth / 2, 18, { align: "center" });
    
    // Subtítulo
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

    // Resumo
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text("Resumo", 14, 52);
    
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text(`Total de empresas vinculadas: ${employers.length}`, 14, 60);

    // Tabela de empresas
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
        fillColor: [0, 128, 128],
        fontSize: 10,
        fontStyle: "bold"
      },
      bodyStyles: {
        fontSize: 9
      },
      columnStyles: {
        0: { cellWidth: 12, halign: "center" },
        1: { cellWidth: 75 },
        2: { cellWidth: 45 },
        3: { cellWidth: 55 }
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245]
      },
      styles: {
        cellPadding: 3,
        overflow: "linebreak"
      }
    });

    // Footer em todas as páginas
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

    // Download
    const fileName = `empresas-${accountingOffice.name.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().split("T")[0]}.pdf`;
    doc.save(fileName);
    toast.success("Relatório gerado com sucesso!");
  };

  // Anos disponíveis para filtro
  const availableYears = [...new Set(contributions.map(c => c.competence_year))].sort((a, b) => b - a);

  // Filtrar contribuições
  const filteredContributions = contributions.filter(contrib => {
    const matchesSearch = searchTerm === "" || 
      contrib.employer?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contrib.employer?.cnpj?.includes(searchTerm);
    
    const matchesStatus = filterStatus === "all" || contrib.status === filterStatus;
    const matchesEmployer = filterEmployer === "all" || contrib.employer_id === filterEmployer;
    const matchesMonth = filterMonth === "all" || contrib.competence_month === parseInt(filterMonth);
    const matchesYear = filterYear === "all" || contrib.competence_year === parseInt(filterYear);
    
    return matchesSearch && matchesStatus && matchesEmployer && matchesMonth && matchesYear;
  });

  // Estatísticas
  const stats = {
    total: filteredContributions.length,
    pending: filteredContributions.filter(c => c.status === "pending").length,
    overdue: filteredContributions.filter(c => c.status === "overdue").length,
    totalValue: filteredContributions.reduce((sum, c) => sum + (c.value || 0), 0),
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-4">
            {clinic?.logo_url ? (
              <img 
                src={clinic.logo_url} 
                alt={clinic.name} 
                className="h-16 mx-auto object-contain"
              />
            ) : (
              <div className="h-16 w-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
                <Building2 className="h-8 w-8 text-primary" />
              </div>
            )}
            <div>
              <CardTitle className="text-2xl">Portal do Contador</CardTitle>
              <CardDescription>
                Acesse para visualizar os boletos das empresas
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="accessCode">Código de Acesso</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="accessCode"
                    type="text"
                    placeholder="XXXXXX"
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                    className="pl-10 uppercase"
                    maxLength={10}
                    required
                  />
                </div>
              </div>
              
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  "Entrar"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {clinic?.logo_url ? (
                <img 
                  src={clinic.logo_url} 
                  alt={clinic.name} 
                  className="h-10 object-contain"
                />
              ) : (
                <Building2 className="h-8 w-8 text-primary" />
              )}
              <div>
                <h1 className="font-semibold text-lg">{accountingOffice?.name}</h1>
                <p className="text-sm text-muted-foreground">{accountingOffice?.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handlePrintEmployersList}>
                <Printer className="h-4 w-4 mr-2" />
                Imprimir Empresas
              </Button>
              <Button variant="outline" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Sair
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Building className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Empresas</p>
                  <p className="text-2xl font-bold">{employers.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <FileText className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pendentes</p>
                  <p className="text-2xl font-bold">{stats.pending}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <Calendar className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Vencidos</p>
                  <p className="text-2xl font-bold">{stats.overdue}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <DollarSign className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-lg font-bold">{formatCurrency(stats.totalValue)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="md:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por empresa ou CNPJ..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <Select value={filterEmployer} onValueChange={setFilterEmployer}>
                <SelectTrigger>
                  <SelectValue placeholder="Empresa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as empresas</SelectItem>
                  {employers.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="paid">Pago</SelectItem>
                  <SelectItem value="overdue">Vencido</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
              
              <div className="flex gap-2">
                <Select value={filterMonth} onValueChange={setFilterMonth}>
                  <SelectTrigger>
                    <SelectValue placeholder="Mês" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {MONTHS.map((month, idx) => (
                      <SelectItem key={idx} value={String(idx + 1)}>
                        {month}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select value={filterYear} onValueChange={setFilterYear}>
                  <SelectTrigger>
                    <SelectValue placeholder="Ano" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {availableYears.map((year) => (
                      <SelectItem key={year} value={String(year)}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabela de Contribuições */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Contribuições ({filteredContributions.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingData ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredContributions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma contribuição encontrada</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empresa</TableHead>
                      <TableHead>CNPJ</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Competência</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredContributions.map((contrib) => {
                      // Calcular dias de atraso
                      const dueDate = new Date(contrib.due_date);
                      const today = new Date();
                      const daysDiff = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
                      const isOverdue90Days = daysDiff > 90;
                      
                      // Permitir 2ª via apenas para pendente/vencido e não mais de 90 dias
                      const canGenerateReissue = ["pending", "overdue"].includes(contrib.status) && !isOverdue90Days;
                      
                      return (
                        <TableRow key={contrib.id}>
                          <TableCell className="font-medium">
                            {contrib.employer?.name || "-"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatCNPJ(contrib.employer?.cnpj || "")}
                          </TableCell>
                          <TableCell>
                            {contrib.contribution_type?.name || "-"}
                          </TableCell>
                          <TableCell>
                            {MONTHS[contrib.competence_month - 1]}/{contrib.competence_year}
                          </TableCell>
                          <TableCell>
                            {new Date(contrib.due_date).toLocaleDateString("pt-BR")}
                          </TableCell>
                          <TableCell className="font-medium">
                            {formatCurrency(contrib.value)}
                          </TableCell>
                          <TableCell>
                            <Badge className={STATUS_CONFIG[contrib.status]?.className || ""}>
                              {STATUS_CONFIG[contrib.status]?.label || contrib.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {contrib.lytex_invoice_url && contrib.status !== "paid" && contrib.status !== "cancelled" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => window.open(contrib.lytex_invoice_url, "_blank")}
                                >
                                  <ExternalLink className="h-4 w-4 mr-1" />
                                  Ver Boleto
                                </Button>
                              )}
                              {canGenerateReissue && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedContribution(contrib);
                                    setShowReissueDialog(true);
                                  }}
                                >
                                  <RefreshCw className="h-4 w-4 mr-1" />
                                  2ª Via
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Dialog de Segunda Via */}
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
                  {selectedContribution.employer?.name} • {MONTHS[selectedContribution.competence_month - 1]}/{selectedContribution.competence_year} • {formatCurrency(selectedContribution.value)}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
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
    </div>
  );
}
