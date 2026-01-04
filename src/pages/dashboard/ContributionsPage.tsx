import { useState, useEffect, useMemo } from "react";
import {
  FileText,
  Plus,
  Search,
  Calendar,
  Building2,
  Receipt,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Loader2,
  Eye,
  Send,
  RefreshCw,
  Filter,
  Download,
  Copy,
  QrCode,
  ChevronLeft,
  ChevronRight,
  Settings,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Employer {
  id: string;
  name: string;
  cnpj: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
}

interface ContributionType {
  id: string;
  name: string;
  description: string | null;
  default_value: number;
  is_active: boolean;
}

interface Contribution {
  id: string;
  employer_id: string;
  contribution_type_id: string;
  competence_month: number;
  competence_year: number;
  value: number;
  due_date: string;
  status: string;
  lytex_invoice_id: string | null;
  lytex_invoice_url: string | null;
  lytex_boleto_digitable_line: string | null;
  lytex_pix_code: string | null;
  lytex_pix_qrcode: string | null;
  paid_at: string | null;
  paid_value: number | null;
  payment_method: string | null;
  notes: string | null;
  created_at: string;
  employers?: Employer;
  contribution_types?: ContributionType;
}

const ITEMS_PER_PAGE = 15;

const STATUS_CONFIG = {
  pending: { label: "Pendente", color: "bg-amber-100 text-amber-700", icon: Clock },
  processing: { label: "Processando", color: "bg-blue-100 text-blue-700", icon: RefreshCw },
  paid: { label: "Pago", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  overdue: { label: "Vencido", color: "bg-rose-100 text-rose-700", icon: AlertTriangle },
  cancelled: { label: "Cancelado", color: "bg-gray-100 text-gray-700", icon: XCircle },
};

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export default function ContributionsPage() {
  const { currentClinic, session } = useAuth();
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [employers, setEmployers] = useState<Employer[]>([]);
  const [contributionTypes, setContributionTypes] = useState<ContributionType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [yearFilter, setYearFilter] = useState<number>(new Date().getFullYear());
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  
  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [typesDialogOpen, setTypesDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedContribution, setSelectedContribution] = useState<Contribution | null>(null);
  
  // Form states
  const [formEmployerId, setFormEmployerId] = useState("");
  const [formTypeId, setFormTypeId] = useState("");
  const [formMonth, setFormMonth] = useState(new Date().getMonth() + 1);
  const [formYear, setFormYear] = useState(new Date().getFullYear());
  const [formValue, setFormValue] = useState("");
  const [formDueDate, setFormDueDate] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [generatingInvoice, setGeneratingInvoice] = useState(false);

  // Type form states
  const [typeFormName, setTypeFormName] = useState("");
  const [typeFormDescription, setTypeFormDescription] = useState("");
  const [typeFormValue, setTypeFormValue] = useState("");
  const [editingType, setEditingType] = useState<ContributionType | null>(null);

  useEffect(() => {
    if (currentClinic) {
      fetchData();
    }
  }, [currentClinic]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, yearFilter, monthFilter]);

  const fetchData = async () => {
    if (!currentClinic) return;
    setLoading(true);

    try {
      // Fetch contributions with relations
      const { data: contribData, error: contribError } = await supabase
        .from("employer_contributions")
        .select(`
          *,
          employers (id, name, cnpj, email, phone, address, city, state),
          contribution_types (id, name, description, default_value, is_active)
        `)
        .eq("clinic_id", currentClinic.id)
        .order("competence_year", { ascending: false })
        .order("competence_month", { ascending: false })
        .order("created_at", { ascending: false });

      if (contribError) throw contribError;
      setContributions(contribData || []);

      // Fetch employers
      const { data: empData, error: empError } = await supabase
        .from("employers")
        .select("id, name, cnpj, email, phone, address, city, state")
        .eq("clinic_id", currentClinic.id)
        .eq("is_active", true)
        .order("name");

      if (empError) throw empError;
      setEmployers(empData || []);

      // Fetch contribution types
      const { data: typesData, error: typesError } = await supabase
        .from("contribution_types")
        .select("*")
        .eq("clinic_id", currentClinic.id)
        .order("name");

      if (typesError) throw typesError;
      setContributionTypes(typesData || []);

    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const filteredContributions = useMemo(() => {
    return contributions.filter((c) => {
      const matchesSearch = 
        c.employers?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.employers?.cnpj.includes(searchTerm.replace(/\D/g, "")) ||
        c.contribution_types?.name.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === "all" || c.status === statusFilter;
      const matchesYear = c.competence_year === yearFilter;
      const matchesMonth = monthFilter === "all" || c.competence_month === parseInt(monthFilter);

      return matchesSearch && matchesStatus && matchesYear && matchesMonth;
    });
  }, [contributions, searchTerm, statusFilter, yearFilter, monthFilter]);

  const totalPages = Math.ceil(filteredContributions.length / ITEMS_PER_PAGE);
  const paginatedContributions = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredContributions.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredContributions, currentPage]);

  const stats = useMemo(() => {
    const yearContribs = contributions.filter(c => c.competence_year === yearFilter);
    return {
      total: yearContribs.length,
      pending: yearContribs.filter(c => c.status === "pending").length,
      paid: yearContribs.filter(c => c.status === "paid").length,
      overdue: yearContribs.filter(c => c.status === "overdue").length,
      totalValue: yearContribs.reduce((acc, c) => acc + c.value, 0),
      paidValue: yearContribs.filter(c => c.status === "paid").reduce((acc, c) => acc + (c.paid_value || c.value), 0),
    };
  }, [contributions, yearFilter]);

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(cents / 100);
  };

  const handleOpenCreateDialog = () => {
    setFormEmployerId("");
    setFormTypeId("");
    setFormMonth(new Date().getMonth() + 1);
    setFormYear(new Date().getFullYear());
    setFormValue("");
    setFormDueDate(format(addDays(new Date(), 10), "yyyy-MM-dd"));
    setFormNotes("");
    setCreateDialogOpen(true);
  };

  const handleTypeChange = (typeId: string) => {
    setFormTypeId(typeId);
    const type = contributionTypes.find(t => t.id === typeId);
    if (type && type.default_value > 0) {
      setFormValue((type.default_value / 100).toFixed(2).replace(".", ","));
    }
  };

  const handleSaveContribution = async () => {
    if (!currentClinic || !formEmployerId || !formTypeId || !formValue || !formDueDate) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    setSaving(true);
    try {
      const valueInCents = Math.round(parseFloat(formValue.replace(",", ".")) * 100);

      const { error } = await supabase
        .from("employer_contributions")
        .insert({
          clinic_id: currentClinic.id,
          employer_id: formEmployerId,
          contribution_type_id: formTypeId,
          competence_month: formMonth,
          competence_year: formYear,
          value: valueInCents,
          due_date: formDueDate,
          notes: formNotes || null,
          created_by: session?.user.id,
        });

      if (error) {
        if (error.message.includes("unique_contribution_per_employer")) {
          toast.error("Já existe uma contribuição deste tipo para esta competência");
          return;
        }
        throw error;
      }

      toast.success("Contribuição criada com sucesso");
      setCreateDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error("Error saving contribution:", error);
      toast.error("Erro ao salvar contribuição");
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateInvoice = async (contribution: Contribution) => {
    if (!contribution.employers) {
      toast.error("Dados da empresa não encontrados");
      return;
    }

    setGeneratingInvoice(true);
    try {
      const response = await supabase.functions.invoke("lytex-api", {
        body: {
          action: "create_invoice",
          contributionId: contribution.id,
          clinicId: currentClinic?.id,
          employer: {
            cnpj: contribution.employers.cnpj,
            name: contribution.employers.name,
            email: contribution.employers.email,
            phone: contribution.employers.phone,
            address: contribution.employers.address ? {
              street: contribution.employers.address,
              city: contribution.employers.city,
              state: contribution.employers.state,
            } : undefined,
          },
          value: contribution.value,
          dueDate: contribution.due_date,
          description: `${contribution.contribution_types?.name || "Contribuição"} - ${MONTHS[contribution.competence_month - 1]}/${contribution.competence_year}`,
          enableBoleto: true,
          enablePix: true,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      toast.success("Boleto gerado com sucesso!");
      fetchData();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      console.error("Error generating invoice:", error);
      toast.error(`Erro ao gerar boleto: ${errorMessage}`);
    } finally {
      setGeneratingInvoice(false);
    }
  };

  const handleViewContribution = (contribution: Contribution) => {
    setSelectedContribution(contribution);
    setViewDialogOpen(true);
  };

  const handleCopyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  const handleCancelContribution = async () => {
    if (!selectedContribution) return;

    try {
      if (selectedContribution.lytex_invoice_id) {
        await supabase.functions.invoke("lytex-api", {
          body: {
            action: "cancel_invoice",
            invoiceId: selectedContribution.lytex_invoice_id,
            contributionId: selectedContribution.id,
          },
        });
      } else {
        await supabase
          .from("employer_contributions")
          .update({ status: "cancelled" })
          .eq("id", selectedContribution.id);
      }

      toast.success("Contribuição cancelada");
      setDeleteDialogOpen(false);
      setViewDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error("Error cancelling:", error);
      toast.error("Erro ao cancelar contribuição");
    }
  };

  // Contribution Types management
  const handleSaveType = async () => {
    if (!currentClinic || !typeFormName) {
      toast.error("Nome é obrigatório");
      return;
    }

    try {
      const valueInCents = typeFormValue ? Math.round(parseFloat(typeFormValue.replace(",", ".")) * 100) : 0;

      if (editingType) {
        const { error } = await supabase
          .from("contribution_types")
          .update({
            name: typeFormName,
            description: typeFormDescription || null,
            default_value: valueInCents,
          })
          .eq("id", editingType.id);

        if (error) throw error;
        toast.success("Tipo atualizado");
      } else {
        const { error } = await supabase
          .from("contribution_types")
          .insert({
            clinic_id: currentClinic.id,
            name: typeFormName,
            description: typeFormDescription || null,
            default_value: valueInCents,
          });

        if (error) throw error;
        toast.success("Tipo criado");
      }

      setTypeFormName("");
      setTypeFormDescription("");
      setTypeFormValue("");
      setEditingType(null);
      fetchData();
    } catch (error) {
      console.error("Error saving type:", error);
      toast.error("Erro ao salvar tipo");
    }
  };

  const handleEditType = (type: ContributionType) => {
    setEditingType(type);
    setTypeFormName(type.name);
    setTypeFormDescription(type.description || "");
    setTypeFormValue(type.default_value ? (type.default_value / 100).toFixed(2).replace(".", ",") : "");
  };

  const handleDeleteType = async (typeId: string) => {
    try {
      const { error } = await supabase
        .from("contribution_types")
        .update({ is_active: false })
        .eq("id", typeId);

      if (error) throw error;
      toast.success("Tipo desativado");
      fetchData();
    } catch (error) {
      console.error("Error deleting type:", error);
      toast.error("Erro ao desativar tipo");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Receipt className="h-6 w-6 text-primary" />
            Contribuições Sindicais
          </h1>
          <p className="text-sm text-muted-foreground">
            Gerencie boletos e contribuições das empresas
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setTypesDialogOpen(true)}>
            <Settings className="h-4 w-4 mr-2" />
            Tipos
          </Button>
          <Button onClick={handleOpenCreateDialog} className="bg-primary hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-2" />
            Nova Contribuição
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">Total {yearFilter}</span>
            </div>
            <p className="text-xl font-bold text-foreground mt-1">{stats.total}</p>
            <p className="text-xs text-muted-foreground">{formatCurrency(stats.totalValue)}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              <span className="text-xs font-medium text-muted-foreground">Pendentes</span>
            </div>
            <p className="text-xl font-bold text-amber-600 mt-1">{stats.pending}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span className="text-xs font-medium text-muted-foreground">Pagos</span>
            </div>
            <p className="text-xl font-bold text-emerald-600 mt-1">{stats.paid}</p>
            <p className="text-xs text-muted-foreground">{formatCurrency(stats.paidValue)}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-rose-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-500" />
              <span className="text-xs font-medium text-muted-foreground">Vencidos</span>
            </div>
            <p className="text-xl font-bold text-rose-600 mt-1">{stats.overdue}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-blue-500" />
              <span className="text-xs font-medium text-muted-foreground">Empresas</span>
            </div>
            <p className="text-xl font-bold text-blue-600 mt-1">{employers.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar empresa, CNPJ ou tipo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="paid">Pagos</SelectItem>
                <SelectItem value="overdue">Vencidos</SelectItem>
                <SelectItem value="cancelled">Cancelados</SelectItem>
              </SelectContent>
            </Select>
            <Select value={monthFilter} onValueChange={setMonthFilter}>
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue placeholder="Mês" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os meses</SelectItem>
                {MONTHS.map((month, i) => (
                  <SelectItem key={i} value={String(i + 1)}>{month}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={String(yearFilter)} onValueChange={(v) => setYearFilter(parseInt(v))}>
              <SelectTrigger className="w-[100px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2024, 2025, 2026].map(year => (
                  <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant="outline" className="text-xs">
              {filteredContributions.length} resultado{filteredContributions.length !== 1 ? "s" : ""}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">Empresa</TableHead>
                <TableHead className="font-semibold">Tipo</TableHead>
                <TableHead className="font-semibold">Competência</TableHead>
                <TableHead className="font-semibold">Vencimento</TableHead>
                <TableHead className="font-semibold text-right">Valor</TableHead>
                <TableHead className="font-semibold text-center">Status</TableHead>
                <TableHead className="font-semibold text-center">Boleto</TableHead>
                <TableHead className="font-semibold text-right w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedContributions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Receipt className="h-8 w-8 text-muted-foreground" />
                      <p className="text-muted-foreground">Nenhuma contribuição encontrada</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedContributions.map((contrib) => {
                  const statusConfig = STATUS_CONFIG[contrib.status as keyof typeof STATUS_CONFIG];
                  const StatusIcon = statusConfig?.icon || Clock;

                  return (
                    <TableRow key={contrib.id} className="h-12 hover:bg-muted/30">
                      <TableCell className="py-2">
                        <div>
                          <p className="font-medium text-sm">{contrib.employers?.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {contrib.employers?.cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="py-2">
                        <span className="text-sm">{contrib.contribution_types?.name}</span>
                      </TableCell>
                      <TableCell className="py-2">
                        <span className="text-sm font-medium">
                          {MONTHS[contrib.competence_month - 1]?.slice(0, 3)}/{contrib.competence_year}
                        </span>
                      </TableCell>
                      <TableCell className="py-2">
                        <span className="text-sm">
                          {format(new Date(contrib.due_date + "T12:00:00"), "dd/MM/yyyy")}
                        </span>
                      </TableCell>
                      <TableCell className="py-2 text-right">
                        <span className="font-medium">{formatCurrency(contrib.value)}</span>
                      </TableCell>
                      <TableCell className="py-2 text-center">
                        <Badge className={`${statusConfig?.color} text-xs gap-1`}>
                          <StatusIcon className="h-3 w-3" />
                          {statusConfig?.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2 text-center">
                        {contrib.lytex_invoice_id ? (
                          <Badge variant="outline" className="text-xs text-emerald-600">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Gerado
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            Não gerado
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => handleViewContribution(contrib)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Ver detalhes</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          {!contrib.lytex_invoice_id && contrib.status !== "cancelled" && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-primary"
                                    onClick={() => handleGenerateInvoice(contrib)}
                                    disabled={generatingInvoice}
                                  >
                                    {generatingInvoice ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Send className="h-4 w-4" />
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Gerar boleto</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-3 border-t">
            <span className="text-sm text-muted-foreground">
              Página {currentPage} de {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Contribuição</DialogTitle>
            <DialogDescription>
              Cadastre uma nova contribuição para gerar o boleto
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Empresa *</Label>
              <Select value={formEmployerId} onValueChange={setFormEmployerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a empresa" />
                </SelectTrigger>
                <SelectContent>
                  {employers.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tipo de Contribuição *</Label>
              <Select value={formTypeId} onValueChange={handleTypeChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {contributionTypes.filter(t => t.is_active).map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Mês Competência *</Label>
                <Select value={String(formMonth)} onValueChange={(v) => setFormMonth(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((month, i) => (
                      <SelectItem key={i} value={String(i + 1)}>{month}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ano *</Label>
                <Select value={String(formYear)} onValueChange={(v) => setFormYear(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[2024, 2025, 2026].map(year => (
                      <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Valor (R$) *</Label>
                <Input
                  placeholder="0,00"
                  value={formValue}
                  onChange={(e) => setFormValue(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Vencimento *</Label>
                <Input
                  type="date"
                  value={formDueDate}
                  onChange={(e) => setFormDueDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Input
                placeholder="Observações opcionais"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveContribution} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Details Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes da Contribuição</DialogTitle>
          </DialogHeader>

          {selectedContribution && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Empresa</p>
                  <p className="font-medium">{selectedContribution.employers?.name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">CNPJ</p>
                  <p className="font-medium">
                    {selectedContribution.employers?.cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Tipo</p>
                  <p className="font-medium">{selectedContribution.contribution_types?.name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Competência</p>
                  <p className="font-medium">
                    {MONTHS[selectedContribution.competence_month - 1]}/{selectedContribution.competence_year}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Valor</p>
                  <p className="font-medium text-lg">{formatCurrency(selectedContribution.value)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Vencimento</p>
                  <p className="font-medium">
                    {format(new Date(selectedContribution.due_date + "T12:00:00"), "dd/MM/yyyy")}
                  </p>
                </div>
              </div>

              {selectedContribution.lytex_invoice_url && (
                <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    <span className="font-medium">Dados do Boleto</span>
                  </div>

                  {selectedContribution.lytex_boleto_digitable_line && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Linha Digitável</p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-xs bg-background p-2 rounded overflow-x-auto">
                          {selectedContribution.lytex_boleto_digitable_line}
                        </code>
                        <Button
                          variant="outline"
                          size="icon"
                          className="shrink-0"
                          onClick={() => handleCopyToClipboard(selectedContribution.lytex_boleto_digitable_line!, "Linha digitável")}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {selectedContribution.lytex_pix_code && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">PIX Copia e Cola</p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-xs bg-background p-2 rounded overflow-x-auto max-h-20">
                          {selectedContribution.lytex_pix_code.slice(0, 50)}...
                        </code>
                        <Button
                          variant="outline"
                          size="icon"
                          className="shrink-0"
                          onClick={() => handleCopyToClipboard(selectedContribution.lytex_pix_code!, "Código PIX")}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  <Button
                    className="w-full"
                    onClick={() => window.open(selectedContribution.lytex_invoice_url!, "_blank")}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Abrir Boleto / Fatura
                  </Button>
                </div>
              )}

              {selectedContribution.status === "paid" && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg">
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="font-medium">Pagamento Confirmado</span>
                  </div>
                  {selectedContribution.paid_at && (
                    <p className="text-sm text-emerald-600 dark:text-emerald-500 mt-1">
                      Pago em {format(new Date(selectedContribution.paid_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      {selectedContribution.payment_method && ` via ${selectedContribution.payment_method}`}
                    </p>
                  )}
                </div>
              )}

              <DialogFooter>
                {selectedContribution.status !== "paid" && selectedContribution.status !== "cancelled" && (
                  <Button
                    variant="destructive"
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Cancelar
                  </Button>
                )}
                {!selectedContribution.lytex_invoice_id && selectedContribution.status !== "cancelled" && (
                  <Button
                    onClick={() => handleGenerateInvoice(selectedContribution)}
                    disabled={generatingInvoice}
                  >
                    {generatingInvoice ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    Gerar Boleto
                  </Button>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Types Management Dialog */}
      <Dialog open={typesDialogOpen} onOpenChange={setTypesDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Tipos de Contribuição</DialogTitle>
            <DialogDescription>
              Gerencie os tipos de contribuição disponíveis
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-3 p-3 border rounded-lg">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Nome *</Label>
                  <Input
                    placeholder="Ex: Mensalidade Sindical"
                    value={typeFormName}
                    onChange={(e) => setTypeFormName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Valor Padrão (R$)</Label>
                  <Input
                    placeholder="0,00"
                    value={typeFormValue}
                    onChange={(e) => setTypeFormValue(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input
                  placeholder="Descrição opcional"
                  value={typeFormDescription}
                  onChange={(e) => setTypeFormDescription(e.target.value)}
                />
              </div>
              <Button onClick={handleSaveType} className="w-full">
                {editingType ? "Atualizar" : "Adicionar"} Tipo
              </Button>
              {editingType && (
                <Button 
                  variant="ghost" 
                  className="w-full"
                  onClick={() => {
                    setEditingType(null);
                    setTypeFormName("");
                    setTypeFormDescription("");
                    setTypeFormValue("");
                  }}
                >
                  Cancelar Edição
                </Button>
              )}
            </div>

            <div className="space-y-2">
              {contributionTypes.map((type) => (
                <div
                  key={type.id}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    !type.is_active ? "opacity-50 bg-muted/50" : ""
                  }`}
                >
                  <div>
                    <p className="font-medium text-sm">{type.name}</p>
                    {type.description && (
                      <p className="text-xs text-muted-foreground">{type.description}</p>
                    )}
                    {type.default_value > 0 && (
                      <p className="text-xs text-primary font-medium">
                        Valor padrão: {formatCurrency(type.default_value)}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleEditType(type)}
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                    {type.is_active && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => handleDeleteType(type.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {contributionTypes.length === 0 && (
                <p className="text-center text-muted-foreground text-sm py-4">
                  Nenhum tipo cadastrado
                </p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Contribuição</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar esta contribuição? Esta ação irá cancelar o boleto na Lytex.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelContribution}
              className="bg-destructive hover:bg-destructive/90"
            >
              Confirmar Cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
