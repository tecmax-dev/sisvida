import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Building2,
  ArrowLeft,
  Save,
  Loader2,
  Users,
  Receipt,
  FileText,
  Plus,
  Eye,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
  Copy,
  Download,
  CreditCard,
  Pencil,
  Trash2,
  ExternalLink,
  MessageCircle,
  KeyRound,
  Globe,
  DollarSign,
} from "lucide-react";
import { SendBoletoWhatsAppDialog } from "@/components/contributions/SendBoletoWhatsAppDialog";
import { SendOverdueWhatsAppDialog } from "@/components/contributions/SendOverdueWhatsAppDialog";
import { EmployerContributionFilters } from "@/components/contributions/EmployerContributionFilters";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Employer {
  id: string;
  cnpj: string;
  name: string;
  trade_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  notes: string | null;
  is_active: boolean;
  access_code: string | null;
  access_code_expires_at: string | null;
  portal_last_access_at: string | null;
  cnae_code?: string | null;
  cnae_description?: string | null;
}

interface Patient {
  id: string;
  name: string;
  cpf: string | null;
  phone: string | null;
}

interface ContributionType {
  id: string;
  name: string;
  default_value: number;
  is_active: boolean;
}

interface Contribution {
  id: string;
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
  paid_at: string | null;
  paid_value: number | null;
  payment_method: string | null;
  notes: string | null;
  contribution_types?: ContributionType;
}

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const STATUS_CONFIG = {
  pending: { label: "Pendente", color: "bg-amber-100 text-amber-700", icon: Clock },
  processing: { label: "Processando", color: "bg-blue-100 text-blue-700", icon: RefreshCw },
  paid: { label: "Pago", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  overdue: { label: "Vencido", color: "bg-rose-100 text-rose-700", icon: AlertTriangle },
  cancelled: { label: "Cancelado", color: "bg-gray-100 text-gray-700", icon: XCircle },
  awaiting_value: { label: "Aguardando Valor", color: "bg-purple-100 text-purple-700", icon: Clock },
};

export default function EmployerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentClinic, session } = useAuth();

  const [employer, setEmployer] = useState<Employer | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [contributionTypes, setContributionTypes] = useState<ContributionType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form
  const [formData, setFormData] = useState({
    name: "",
    trade_name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    notes: "",
    is_active: true,
  });

  // Contribution dialogs
  const [createContribDialogOpen, setCreateContribDialogOpen] = useState(false);
  const [viewContribDialogOpen, setViewContribDialogOpen] = useState(false);
  const [manualPaymentDialogOpen, setManualPaymentDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedContribution, setSelectedContribution] = useState<Contribution | null>(null);
  const [whatsappDialogOpen, setWhatsappDialogOpen] = useState(false);
  const [overdueDialogOpen, setOverdueDialogOpen] = useState(false);
  const [filteredContributions, setFilteredContributions] = useState<Contribution[]>([]);

  const [contribTypeId, setContribTypeId] = useState("");
  const [contribMonth, setContribMonth] = useState(new Date().getMonth() + 1);
  const [contribYear, setContribYear] = useState(new Date().getFullYear());
  const [contribValue, setContribValue] = useState("");
  const [contribDueDate, setContribDueDate] = useState(format(addDays(new Date(), 10), "yyyy-MM-dd"));

  // Manual payment form
  const [manualPaymentValue, setManualPaymentValue] = useState("");
  const [manualPaymentMethod, setManualPaymentMethod] = useState("dinheiro");
  const [manualPaymentDate, setManualPaymentDate] = useState(format(new Date(), "yyyy-MM-dd"));

  // Edit contribution form
  const [editValue, setEditValue] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [generatingInvoice, setGeneratingInvoice] = useState(false);

  useEffect(() => {
    if (currentClinic && id) {
      fetchData();
    }
  }, [currentClinic, id]);

  const fetchData = async () => {
    if (!currentClinic || !id) return;
    setLoading(true);

    try {
      // Fetch employer
      const { data: empData, error: empError } = await supabase
        .from("employers")
        .select("*")
        .eq("id", id)
        .eq("clinic_id", currentClinic.id)
        .single();

      if (empError) throw empError;
      setEmployer(empData);
      setFormData({
        name: empData.name,
        trade_name: empData.trade_name || "",
        email: empData.email || "",
        phone: empData.phone || "",
        address: empData.address || "",
        city: empData.city || "",
        state: empData.state || "",
        notes: empData.notes || "",
        is_active: empData.is_active,
      });

      // Fetch patients linked to this employer
      const { data: patientsData, error: patientsError } = await supabase
        .from("patients")
        .select("id, name, cpf, phone")
        .eq("clinic_id", currentClinic.id)
        .eq("employer_cnpj", empData.cnpj)
        .order("name");

      if (patientsError) throw patientsError;
      setPatients(patientsData || []);

      // Fetch contributions for this employer
      const { data: contribData, error: contribError } = await supabase
        .from("employer_contributions")
        .select(`*, contribution_types (id, name, default_value, is_active)`)
        .eq("employer_id", id)
        .order("competence_year", { ascending: false })
        .order("competence_month", { ascending: false });

      if (contribError) throw contribError;
      setContributions(contribData || []);

      // Fetch contribution types
      const { data: typesData, error: typesError } = await supabase
        .from("contribution_types")
        .select("*")
        .eq("clinic_id", currentClinic.id)
        .eq("is_active", true)
        .order("name");

      if (typesError) throw typesError;
      setContributionTypes(typesData || []);
      
      // Initialize filtered contributions with all contributions
      setFilteredContributions([]);

    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erro ao carregar dados da empresa");
      navigate("/dashboard/empresas");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(cents / 100);
  };

  const formatCNPJ = (cnpj: string) => {
    return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  };

  const formatPhone = (value: string) => {
    const cleaned = value.replace(/\D/g, "").slice(0, 11);
    if (cleaned.length <= 2) return cleaned;
    if (cleaned.length <= 7) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2)}`;
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  };

  const handleSaveEmployer = async () => {
    if (!employer || !currentClinic) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("employers")
        .update({
          name: formData.name.trim(),
          trade_name: formData.trade_name.trim() || null,
          email: formData.email.trim() || null,
          phone: formData.phone.replace(/\D/g, "") || null,
          address: formData.address.trim() || null,
          city: formData.city.trim() || null,
          state: formData.state.trim() || null,
          notes: formData.notes.trim() || null,
          is_active: formData.is_active,
        })
        .eq("id", employer.id);

      if (error) throw error;
      toast.success("Empresa atualizada com sucesso");
      fetchData();
    } catch (error) {
      console.error("Error saving employer:", error);
      toast.error("Erro ao salvar empresa");
    } finally {
      setSaving(false);
    }
  };

  const handleTypeChange = (typeId: string) => {
    setContribTypeId(typeId);
    const type = contributionTypes.find(t => t.id === typeId);
    if (type && type.default_value > 0) {
      setContribValue((type.default_value / 100).toFixed(2).replace(".", ","));
    }
  };

  const handleCreateContribution = async () => {
    if (!employer || !currentClinic || !contribTypeId || !contribDueDate) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    setSaving(true);
    try {
      // Parse value - treat empty or invalid as 0
      let valueInCents = 0;
      if (contribValue && contribValue.trim() !== "") {
        const parsed = parseFloat(contribValue.replace(",", "."));
        if (!isNaN(parsed)) {
          valueInCents = Math.round(parsed * 100);
        }
      }

      // Se valor = 0, status = awaiting_value, senão pending
      const initialStatus = valueInCents === 0 ? "awaiting_value" : "pending";

      const { data: newContrib, error } = await supabase
        .from("employer_contributions")
        .insert({
          clinic_id: currentClinic.id,
          employer_id: employer.id,
          contribution_type_id: contribTypeId,
          competence_month: contribMonth,
          competence_year: contribYear,
          value: valueInCents,
          due_date: contribDueDate,
          status: initialStatus,
          created_by: session?.user.id,
        })
        .select()
        .single();

      if (error) {
        if (error.message.includes("unique_contribution_per_employer") || error.message.includes("unique_active_contribution_per_employer")) {
          toast.error("Já existe uma contribuição deste tipo para esta competência");
          return;
        }
        throw error;
      }

      // Se valor > 0, gerar boleto automaticamente
      if (valueInCents > 0 && newContrib) {
        try {
          const contribType = contributionTypes.find(t => t.id === contribTypeId);
          const description = `${contribType?.name || "Contribuição"} - ${MONTHS[contribMonth - 1]}/${contribYear}`;
          
          await supabase.functions.invoke("lytex-api", {
            body: {
              action: "create_invoice",
              contributionId: newContrib.id,
              clinicId: currentClinic.id,
              employer: {
                cnpj: employer.cnpj,
                name: employer.name,
                email: employer.email,
                phone: employer.phone,
              },
              value: valueInCents,
              dueDate: contribDueDate,
              description,
              enableBoleto: true,
              enablePix: true,
            },
          });
          toast.success("Contribuição criada e boleto gerado com sucesso!");
        } catch (invoiceError) {
          console.error("Erro ao gerar boleto:", invoiceError);
          toast.success("Contribuição criada. Boleto será gerado manualmente.");
        }
      } else {
        toast.success("Contribuição criada. Aguardando definição de valor.");
      }

      setCreateContribDialogOpen(false);
      resetContribForm();
      fetchData();
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : typeof error === "object" && error && "message" in error
            ? String((error as any).message)
            : "Erro desconhecido";

      console.error("Error creating contribution:", error);
      toast.error(`Erro ao criar contribuição: ${message}`);
    } finally {
      setSaving(false);
    }
  };

  const resetContribForm = () => {
    setContribTypeId("");
    setContribMonth(new Date().getMonth() + 1);
    setContribYear(new Date().getFullYear());
    setContribValue("");
    setContribDueDate(format(addDays(new Date(), 10), "yyyy-MM-dd"));
  };

  const handleGenerateInvoice = async (contribution: Contribution) => {
    if (!employer) return;

    setGeneratingInvoice(true);
    try {
      const response = await supabase.functions.invoke("lytex-api", {
        body: {
          action: "create_invoice",
          contributionId: contribution.id,
          clinicId: currentClinic?.id,
          employer: {
            cnpj: employer.cnpj,
            name: employer.name,
            email: employer.email,
            phone: employer.phone,
            address: employer.address ? {
              street: employer.address,
              city: employer.city,
              state: employer.state,
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
      setViewContribDialogOpen(false);
      fetchData();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      console.error("Error generating invoice:", error);
      toast.error(`Erro ao gerar boleto: ${errorMessage}`);
    } finally {
      setGeneratingInvoice(false);
    }
  };

  const handleManualPayment = async () => {
    if (!selectedContribution || !manualPaymentValue) {
      toast.error("Preencha o valor do pagamento");
      return;
    }

    try {
      const valueInCents = Math.round(parseFloat(manualPaymentValue.replace(",", ".")) * 100);

      const { error } = await supabase
        .from("employer_contributions")
        .update({
          status: "paid",
          paid_at: new Date(manualPaymentDate + "T12:00:00").toISOString(),
          paid_value: valueInCents,
          payment_method: manualPaymentMethod,
        })
        .eq("id", selectedContribution.id);

      if (error) throw error;

      toast.success("Baixa manual registrada com sucesso");
      setManualPaymentDialogOpen(false);
      setViewContribDialogOpen(false);
      setManualPaymentValue("");
      fetchData();
    } catch (error) {
      console.error("Error registering payment:", error);
      toast.error("Erro ao registrar pagamento");
    }
  };

  const handleCancelContribution = async () => {
    if (!selectedContribution) return;

    try {
      if (selectedContribution.lytex_invoice_id) {
        const { data, error } = await supabase.functions.invoke("lytex-api", {
          body: {
            action: "cancel_invoice",
            invoiceId: selectedContribution.lytex_invoice_id,
            contributionId: selectedContribution.id,
          },
        });

        if (error) {
          console.error("Edge function error:", error);
          throw new Error(error.message || "Erro ao cancelar na Lytex");
        }

        if (data?.error) {
          console.error("Lytex API error:", data.error);
          throw new Error(data.error);
        }
      } else {
        await supabase
          .from("employer_contributions")
          .update({ status: "cancelled" })
          .eq("id", selectedContribution.id);
      }

      toast.success("Contribuição cancelada");
      setCancelDialogOpen(false);
      setViewContribDialogOpen(false);
      fetchData();
    } catch (error: any) {
      console.error("Error cancelling:", error);
      toast.error(error.message || "Erro ao cancelar contribuição");
    }
  };

  const handleCopyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  const handleOpenEditDialog = () => {
    if (!selectedContribution) return;
    setEditValue((selectedContribution.value / 100).toFixed(2).replace(".", ","));
    setEditDueDate(selectedContribution.due_date);
    setEditDialogOpen(true);
  };

  const handleUpdateContribution = async () => {
    if (!selectedContribution) return;
    
    setUpdating(true);
    try {
      const newValueCents = Math.round(parseFloat(editValue.replace(",", ".")) * 100);
      
      // Check if due date changed and is in the future - auto change status to pending
      const dueDateChanged = editDueDate !== selectedContribution.due_date;
      const newDueDate = new Date(editDueDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const isNewDueDateFuture = newDueDate >= today;
      const shouldUpdateStatus = dueDateChanged && isNewDueDateFuture && 
        (selectedContribution.status === "overdue" || selectedContribution.status === "pending");
      
      if (selectedContribution.lytex_invoice_id) {
        const { error } = await supabase.functions.invoke("lytex-api", {
          body: {
            action: "update_invoice",
            invoiceId: selectedContribution.lytex_invoice_id,
            contributionId: selectedContribution.id,
            value: newValueCents,
            dueDate: editDueDate,
            ...(shouldUpdateStatus && { status: "pending" }),
          },
        });
        if (error) throw error;
      } else {
        const updateData: Record<string, unknown> = {
          value: newValueCents,
          due_date: editDueDate,
        };
        if (shouldUpdateStatus) {
          updateData.status = "pending";
        }
        const { error } = await supabase
          .from("employer_contributions")
          .update(updateData)
          .eq("id", selectedContribution.id);
        if (error) throw error;
      }

      toast.success("Contribuição atualizada");
      setEditDialogOpen(false);
      setViewContribDialogOpen(false);
      fetchData();
    } catch (error: any) {
      console.error("Error updating:", error);
      toast.error(error.message || "Erro ao atualizar");
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteContribution = async () => {
    if (!selectedContribution) return;
    
    setDeleting(true);
    try {
      const { error } = await supabase.functions.invoke("lytex-api", {
        body: {
          action: "delete_contribution",
          contributionId: selectedContribution.id,
        },
      });

      if (error) throw error;

      toast.success("Contribuição excluída");
      setDeleteDialogOpen(false);
      setViewContribDialogOpen(false);
      fetchData();
    } catch (error: any) {
      console.error("Error deleting:", error);
      toast.error(error.message || "Erro ao excluir");
    } finally {
      setDeleting(false);
    }
  };

  const handleSyncLytex = async () => {
    if (!currentClinic) return;
    
    setSyncing(true);
    try {
      // Sync all pending contributions for this employer
      const pendingContribs = contributions.filter(
        (c) => c.lytex_invoice_id && ["pending", "overdue", "processing"].includes(c.status)
      );

      let syncedCount = 0;
      for (const contrib of pendingContribs) {
        const { error } = await supabase.functions.invoke("lytex-api", {
          body: {
            action: "sync_status",
            contributionId: contrib.id,
          },
        });
        if (!error) syncedCount++;
      }

      toast.success(`${syncedCount} contribuição(ões) sincronizada(s)`);
      fetchData();
    } catch (error) {
      console.error("Error syncing:", error);
      toast.error("Erro ao sincronizar com Lytex");
    } finally {
      setSyncing(false);
    }
  };

  // Stats
  const stats = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const yearContribs = contributions.filter(c => c.competence_year === currentYear);
    return {
      total: contributions.length,
      yearTotal: yearContribs.length,
      paid: yearContribs.filter(c => c.status === "paid").length,
      pending: yearContribs.filter(c => c.status === "pending").length,
      overdue: yearContribs.filter(c => c.status === "overdue").length,
      totalValue: yearContribs.reduce((acc, c) => acc + c.value, 0),
      paidValue: yearContribs.filter(c => c.status === "paid").reduce((acc, c) => acc + (c.paid_value || c.value), 0),
    };
  }, [contributions]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!employer) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Empresa não encontrada</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/empresas")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">{employer.name}</h1>
            <Badge variant={employer.is_active ? "default" : "secondary"}>
              {employer.is_active ? "Ativa" : "Inativa"}
            </Badge>
          </div>
          <div className="space-y-0.5">
            <p className="text-sm text-muted-foreground">
              CNPJ: {formatCNPJ(employer.cnpj)}
            </p>
            {employer.cnae_code && (
              <p className="text-xs text-muted-foreground">
                CNAE: {employer.cnae_code}
                {employer.cnae_description ? ` - ${employer.cnae_description}` : ""}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="contributions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="contributions" className="gap-2">
            <Receipt className="h-4 w-4" />
            Contribuições
          </TabsTrigger>
          <TabsTrigger value="employees" className="gap-2">
            <Users className="h-4 w-4" />
            Colaboradores ({patients.length})
          </TabsTrigger>
          <TabsTrigger value="portal" className="gap-2">
            <Globe className="h-4 w-4" />
            Portal
          </TabsTrigger>
          <TabsTrigger value="data" className="gap-2">
            <FileText className="h-4 w-4" />
            Dados Cadastrais
          </TabsTrigger>
        </TabsList>

        {/* Contributions Tab */}
        <TabsContent value="contributions" className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card className="border-l-4 border-l-primary">
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">Total {new Date().getFullYear()}</p>
                <p className="text-xl font-bold">{stats.yearTotal}</p>
                <p className="text-xs text-muted-foreground">{formatCurrency(stats.totalValue)}</p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-emerald-500">
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">Pagos</p>
                <p className="text-xl font-bold text-emerald-600">{stats.paid}</p>
                <p className="text-xs text-muted-foreground">{formatCurrency(stats.paidValue)}</p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-amber-500">
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">Pendentes</p>
                <p className="text-xl font-bold text-amber-600">{stats.pending}</p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-rose-500">
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">Vencidos</p>
                <p className="text-xl font-bold text-rose-600">{stats.overdue}</p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-blue-500">
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground">Histórico Total</p>
                <p className="text-xl font-bold text-blue-600">{stats.total}</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          {(() => {
            const logoUrl = currentClinic?.logo_url ?? (currentClinic as any)?.whatsapp_header_image_url ?? null;
            console.log("[EmployerDetailPage] logo fallback:", { logo_url: currentClinic?.logo_url, whatsapp_header_image_url: (currentClinic as any)?.whatsapp_header_image_url, final: logoUrl });
            return (
              <EmployerContributionFilters
                contributions={contributions}
                onFilterChange={setFilteredContributions}
                onSendOverdueWhatsApp={() => setOverdueDialogOpen(true)}
                employerName={employer?.name || ""}
                employerCnpj={employer?.cnpj || ""}
                clinicInfo={currentClinic ? {
                  name: currentClinic.name,
                  cnpj: currentClinic.cnpj,
                  phone: currentClinic.phone,
                  address: currentClinic.address,
                  logoUrl,
                } : undefined}
              />
            );
          })()}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={handleSyncLytex}
              disabled={syncing}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Sincronizando..." : "Sincronizar Lytex"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setWhatsappDialogOpen(true)}
              className="gap-2"
            >
              <MessageCircle className="h-4 w-4" />
              Enviar Boletos
            </Button>
            <Button onClick={() => setCreateContribDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Contribuição
            </Button>
          </div>

          {/* Contributions Table */}
          <Card>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Tipo</TableHead>
                    <TableHead>Nº Documento</TableHead>
                    <TableHead>Competência</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Boleto</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(filteredContributions.length > 0 ? filteredContributions : contributions).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-32 text-center">
                        <Receipt className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-muted-foreground">Nenhuma contribuição encontrada</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    (filteredContributions.length > 0 ? filteredContributions : contributions).map((contrib) => {
                      const statusConfig = STATUS_CONFIG[contrib.status as keyof typeof STATUS_CONFIG];
                      const StatusIcon = statusConfig?.icon || Clock;

                      return (
                        <TableRow key={contrib.id} className="hover:bg-muted/30">
                          <TableCell>{contrib.contribution_types?.name}</TableCell>
                          <TableCell>
                            <span className="text-xs font-mono text-muted-foreground">
                              {contrib.lytex_invoice_id ? contrib.lytex_invoice_id.slice(-8).toUpperCase() : "-"}
                            </span>
                          </TableCell>
                          <TableCell className="font-medium">
                            {MONTHS[contrib.competence_month - 1]?.slice(0, 3)}/{contrib.competence_year}
                          </TableCell>
                          <TableCell>
                            {format(new Date(contrib.due_date + "T12:00:00"), "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(contrib.value)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className={`${statusConfig?.color} text-xs gap-1`}>
                              <StatusIcon className="h-3 w-3" />
                              {statusConfig?.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            {contrib.lytex_invoice_id ? (
                              contrib.lytex_invoice_url && contrib.status !== "paid" && contrib.status !== "cancelled" ? (
                                <a
                                  href={contrib.lytex_invoice_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  Ver Boleto
                                </a>
                              ) : (
                                <Badge variant="outline" className="text-xs text-emerald-600">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Gerado
                                </Badge>
                              )
                            ) : (
                              <Badge variant="outline" className="text-xs text-muted-foreground">
                                Não gerado
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <TooltipProvider>
                              <div className="flex items-center justify-end gap-1">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={() => {
                                        setSelectedContribution(contrib);
                                        setViewContribDialogOpen(true);
                                      }}
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Ver detalhes</TooltipContent>
                                </Tooltip>
                                {contrib.status === "awaiting_value" && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-purple-600"
                                        onClick={() => {
                                          setSelectedContribution(contrib);
                                          setViewContribDialogOpen(true);
                                        }}
                                      >
                                        <DollarSign className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Definir valor e gerar boleto</TooltipContent>
                                  </Tooltip>
                                )}
                                {!contrib.lytex_invoice_id && contrib.status !== "cancelled" && contrib.status !== "paid" && contrib.status !== "awaiting_value" && (
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
                                )}
                              </div>
                            </TooltipProvider>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* Employees Tab */}
        <TabsContent value="employees">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Colaboradores Vinculados</CardTitle>
              <CardDescription>
                Pacientes cadastrados com o CNPJ desta empresa
              </CardDescription>
            </CardHeader>
            <CardContent>
              {patients.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Nenhum colaborador vinculado</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {patients.map((patient) => (
                    <button
                      key={patient.id}
                      onClick={() => navigate(`/dashboard/patients/${patient.id}/edit`)}
                      className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 border transition-colors text-left"
                    >
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{patient.name}</p>
                        {patient.cpf && (
                          <p className="text-xs text-muted-foreground">
                            CPF: {patient.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}
                          </p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Portal Tab */}
        <TabsContent value="portal">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-cta/20 flex items-center justify-center">
                  <Globe className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">Portal da Empresa</CardTitle>
                  <CardDescription>
                    Acesso online para a empresa visualizar e gerenciar seus boletos
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Access Code Section */}
              <div className="p-4 rounded-lg border bg-muted/30 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <KeyRound className="h-5 w-5 text-primary" />
                    <span className="font-medium">Código de Acesso</span>
                  </div>
                  {employer.access_code ? (
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Configurado
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200">
                      <Clock className="h-3 w-3 mr-1" />
                      Não configurado
                    </Badge>
                  )}
                </div>

                {employer.access_code ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 p-3 rounded-lg bg-card border-2 border-dashed border-primary/30 text-center">
                        <span className="text-2xl font-mono font-bold tracking-[0.3em] text-primary">
                          {employer.access_code}
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          navigator.clipboard.writeText(employer.access_code || "");
                          toast.success("Código copiado!");
                        }}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    {employer.portal_last_access_at && (
                      <p className="text-xs text-muted-foreground text-center">
                        Último acesso: {format(new Date(employer.portal_last_access_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    )}
                    <div className="flex gap-2 justify-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          try {
                            const { data, error } = await supabase.rpc("generate_employer_access_code");
                            if (error) throw error;
                            
                            await supabase
                              .from("employers")
                              .update({ access_code: data, access_code_expires_at: null })
                              .eq("id", employer.id);
                            
                            toast.success("Novo código gerado!");
                            fetchData();
                          } catch (err) {
                            toast.error("Erro ao gerar código");
                          }
                        }}
                      >
                        <RefreshCw className="h-4 w-4 mr-1" />
                        Gerar Novo Código
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={async () => {
                          await supabase
                            .from("employers")
                            .update({ access_code: null, access_code_expires_at: null })
                            .eq("id", employer.id);
                          toast.success("Código removido");
                          fetchData();
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Remover
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-sm text-muted-foreground mb-4">
                      Gere um código de acesso para permitir que a empresa visualize seus boletos online.
                    </p>
                    <Button
                      onClick={async () => {
                        try {
                          const { data, error } = await supabase.rpc("generate_employer_access_code");
                          if (error) throw error;
                          
                          await supabase
                            .from("employers")
                            .update({ access_code: data })
                            .eq("id", employer.id);
                          
                          toast.success("Código de acesso gerado!");
                          fetchData();
                        } catch (err) {
                          toast.error("Erro ao gerar código");
                        }
                      }}
                    >
                      <KeyRound className="h-4 w-4 mr-2" />
                      Gerar Código de Acesso
                    </Button>
                  </div>
                )}
              </div>

              {/* Portal URL */}
              <div className="p-4 rounded-lg border space-y-3">
                <div className="flex items-center gap-2">
                  <ExternalLink className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">Link do Portal</span>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={`${window.location.origin}/portal-empresa`}
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/portal-empresa`);
                      toast.success("Link copiado!");
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    asChild
                  >
                    <a href="/portal-empresa" target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  A empresa usa o CNPJ <span className="font-medium">{formatCNPJ(employer.cnpj)}</span> e o código de acesso para entrar.
                </p>
              </div>

              {/* Instructions */}
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 space-y-2">
                <p className="font-medium text-sm">Como funciona:</p>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Gere um código de acesso único para esta empresa</li>
                  <li>Envie o link do portal e o código para a empresa</li>
                  <li>A empresa acessa usando CNPJ + código</li>
                  <li>No portal, ela pode ver boletos, pagar e solicitar 2ª via</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Data Tab */}
        <TabsContent value="data">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dados Cadastrais</CardTitle>
              <CardDescription>
                Informações da empresa
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>CNPJ</Label>
                  <div className="space-y-1">
                    <Input value={formatCNPJ(employer.cnpj)} disabled />
                    {employer.cnae_code && (
                      <p className="text-xs text-muted-foreground">
                        CNAE: {employer.cnae_code}
                        {employer.cnae_description ? ` - ${employer.cnae_description}` : ""}
                      </p>
                    )}
                  </div>
                </div>
                <div>
                  <Label>Razão Social *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Nome Fantasia</Label>
                  <Input
                    value={formData.trade_name}
                    onChange={(e) => setFormData({ ...formData, trade_name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Telefone</Label>
                  <Input
                    value={formatPhone(formData.phone)}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, "") })}
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>

              <div>
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div>
                <Label>Endereço</Label>
                <Input
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Cidade</Label>
                  <Input
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Estado</Label>
                  <Input
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value.toUpperCase().slice(0, 2) })}
                    maxLength={2}
                  />
                </div>
              </div>

              <div>
                <Label>Observações</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label>Empresa ativa</Label>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveEmployer} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  <Save className="h-4 w-4 mr-2" />
                  Salvar Alterações
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Contribution Dialog */}
      <Dialog open={createContribDialogOpen} onOpenChange={setCreateContribDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Contribuição</DialogTitle>
            <DialogDescription>
              Cadastrar contribuição para {employer.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Tipo de Contribuição *</Label>
              <Select value={contribTypeId} onValueChange={handleTypeChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {contributionTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Mês Competência *</Label>
                <Select value={String(contribMonth)} onValueChange={(v) => setContribMonth(parseInt(v))}>
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
              <div>
                <Label>Ano *</Label>
                <Select value={String(contribYear)} onValueChange={(v) => setContribYear(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[2024, 2025, 2026, 2027].map(year => (
                      <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor (R$) *</Label>
                <Input
                  placeholder="0,00"
                  value={contribValue}
                  onChange={(e) => setContribValue(e.target.value)}
                />
              </div>
              <div>
                <Label>Vencimento *</Label>
                <Input
                  type="date"
                  value={contribDueDate}
                  onChange={(e) => setContribDueDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateContribDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateContribution} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Contribution Dialog */}
      <Dialog open={viewContribDialogOpen} onOpenChange={setViewContribDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes da Contribuição</DialogTitle>
          </DialogHeader>

          {selectedContribution && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
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
                      {selectedContribution.paid_value && ` - ${formatCurrency(selectedContribution.paid_value)}`}
                    </p>
                  )}
                </div>
              )}

              <DialogFooter className="flex-wrap gap-2">
                {selectedContribution.status !== "paid" && selectedContribution.status !== "cancelled" && (
                  <>
                    <Button
                      variant="outline"
                      onClick={handleOpenEditDialog}
                    >
                      <Pencil className="h-4 w-4 mr-2" />
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setDeleteDialogOpen(true)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setManualPaymentValue((selectedContribution.value / 100).toFixed(2).replace(".", ","));
                        setManualPaymentDialogOpen(true);
                      }}
                    >
                      <CreditCard className="h-4 w-4 mr-2" />
                      Baixa Manual
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => setCancelDialogOpen(true)}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Cancelar
                    </Button>
                  </>
                )}
                {!selectedContribution.lytex_invoice_id && selectedContribution.status !== "cancelled" && selectedContribution.status !== "paid" && (
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

      {/* Manual Payment Dialog */}
      <Dialog open={manualPaymentDialogOpen} onOpenChange={setManualPaymentDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Baixa Manual</DialogTitle>
            <DialogDescription>
              Registrar pagamento recebido fora do sistema
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Valor Recebido (R$) *</Label>
              <Input
                placeholder="0,00"
                value={manualPaymentValue}
                onChange={(e) => setManualPaymentValue(e.target.value)}
              />
            </div>
            <div>
              <Label>Forma de Pagamento</Label>
              <Select value={manualPaymentMethod} onValueChange={setManualPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="transferencia">Transferência</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="cartao">Cartão</SelectItem>
                  <SelectItem value="outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data do Pagamento</Label>
              <Input
                type="date"
                value={manualPaymentDate}
                onChange={(e) => setManualPaymentDate(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setManualPaymentDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleManualPayment}>
              Confirmar Baixa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Contribuição</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar esta contribuição? 
              {selectedContribution?.lytex_invoice_id && " O boleto também será cancelado na Lytex."}
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

      {/* Edit Contribution Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar Contribuição</DialogTitle>
            <DialogDescription>
              {selectedContribution?.lytex_invoice_id 
                ? "A alteração será sincronizada com o boleto na Lytex."
                : "Altere o valor e/ou vencimento da contribuição."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Valor (R$)</Label>
              <Input
                placeholder="0,00"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
              />
            </div>
            <div>
              <Label>Vencimento</Label>
              <Input
                type="date"
                value={editDueDate}
                onChange={(e) => setEditDueDate(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateContribution} disabled={updating}>
              {updating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Contribuição</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta contribuição permanentemente?
              {selectedContribution?.lytex_invoice_id && " O boleto também será cancelado na Lytex."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteContribution}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar Exclusão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* WhatsApp Boleto Dialog */}
      <SendBoletoWhatsAppDialog
        open={whatsappDialogOpen}
        onOpenChange={setWhatsappDialogOpen}
        contributions={contributions.map((c) => ({
          ...c,
          employers: {
            name: employer?.name || "",
            cnpj: employer?.cnpj || "",
            phone: employer?.phone,
          },
        }))}
        clinicId={currentClinic?.id || ""}
      />

      {/* Overdue WhatsApp Dialog */}
      <SendOverdueWhatsAppDialog
        open={overdueDialogOpen}
        onOpenChange={setOverdueDialogOpen}
        contributions={contributions}
        employerName={employer?.name || ""}
        employerPhone={employer?.phone || null}
        clinicId={currentClinic?.id || ""}
      />
    </div>
  );
}
