import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Receipt,
  Settings,
  RefreshCw,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Building2,
  ExternalLink,
  FileText,
  Zap,
  Calendar,
  DollarSign,
  Search,
 Plus,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { EditSubscriptionInvoiceDialog } from "@/components/admin/EditSubscriptionInvoiceDialog";

 interface Clinic {
   id: string;
   name: string;
   cnpj: string | null;
   email: string | null;
 }

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const formatCurrency = (cents: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case "paid":
      return <Badge className="bg-success/10 text-success border-success/20"><CheckCircle className="h-3 w-3 mr-1" />Pago</Badge>;
    case "pending":
      return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
    case "overdue":
      return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Vencido</Badge>;
    case "cancelled":
      return <Badge variant="secondary"><XCircle className="h-3 w-3 mr-1" />Cancelado</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

export default function SubscriptionBillingPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [generateSingleDialogOpen, setGenerateSingleDialogOpen] = useState(false);
  const [selectedClinic, setSelectedClinic] = useState<Clinic | null>(null);
  const [clinicSearchTerm, setClinicSearchTerm] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [invoiceToEdit, setInvoiceToEdit] = useState<any>(null);

  // Verificar se credenciais estão configuradas
  const { data: credentialsStatus, isLoading: checkingCredentials } = useQuery({
    queryKey: ["subscription-lytex-credentials"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/subscription-billing-api`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action: "check_credentials" }),
        }
      );

      if (!response.ok) throw new Error("Erro ao verificar credenciais");
      return response.json();
    },
  });

  // Buscar configurações
  const { data: settings, isLoading: loadingSettings } = useQuery({
    queryKey: ["subscription-billing-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_billing_settings")
        .select("*")
        .limit(1)
        .single();

      if (error) throw error;
      return data;
    },
  });

  // Buscar faturas
  const { data: invoices = [], isLoading: loadingInvoices, refetch: refetchInvoices } = useQuery({
    queryKey: ["subscription-invoices", statusFilter, searchTerm],
    queryFn: async () => {
      let query = supabase
        .from("subscription_invoices")
        .select(`
          *,
          clinics(id, name, slug, cnpj),
          subscription_plans(id, name)
        `)
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Filtro de busca no client-side
      if (searchTerm) {
        return data?.filter(inv =>
          (inv.clinics as any)?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (inv.clinics as any)?.cnpj?.includes(searchTerm)
        ) || [];
      }

      return data || [];
    },
  });

  // Buscar clínicas com assinatura ativa para gerar boleto individual
  const { data: clinicsWithSubscription = [] } = useQuery({
    queryKey: ["clinics-with-subscription"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select(`
          clinic_id,
          clinics(id, name, cnpj, email)
        `)
        .eq("status", "active");

      if (error) throw error;
      return (data || [])
        .filter((s: any) => s.clinics?.cnpj)
        .map((s: any) => s.clinics as Clinic);
    },
  });

  // Mutation para gerar boletos em lote
  const generateBulkMutation = useMutation({
    mutationFn: async ({ month, year }: { month: number; year: number }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/subscription-billing-api`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action: "generate_bulk", month, year }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao gerar boletos");
      }

      return response.json();
    },
    onSuccess: (data) => {
      const results = data.results;
      toast.success(`Boletos gerados: ${results.success} criados, ${results.skipped} ignorados`);
      if (results.errors?.length > 0) {
        console.error("Erros na geração:", results.errors);
      }
      queryClient.invalidateQueries({ queryKey: ["subscription-invoices"] });
      setGenerateDialogOpen(false);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Mutation para gerar boleto individual
  const generateSingleMutation = useMutation({
    mutationFn: async ({ clinicId, month, year }: { clinicId: string; month: number; year: number }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/subscription-billing-api`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action: "generate_invoice", clinicId, month, year }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao gerar boleto");
      }

      return response.json();
    },
    onSuccess: () => {
      toast.success("Boleto gerado com sucesso");
      queryClient.invalidateQueries({ queryKey: ["subscription-invoices"] });
      setGenerateSingleDialogOpen(false);
      setSelectedClinic(null);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Mutation para sincronizar status
  const syncStatusMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/subscription-billing-api`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action: "sync_status" }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao sincronizar");
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast.success(`Sincronização concluída: ${data.updated} de ${data.total} atualizados`);
      queryClient.invalidateQueries({ queryKey: ["subscription-invoices"] });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Mutation para atualizar configurações
  const updateSettingsMutation = useMutation({
    mutationFn: async (updates: Partial<typeof settings>) => {
      const { error } = await supabase
        .from("subscription_billing_settings")
        .update(updates)
        .eq("id", settings?.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Configurações salvas");
      queryClient.invalidateQueries({ queryKey: ["subscription-billing-settings"] });
    },
    onError: (error) => {
      toast.error("Erro ao salvar configurações");
    },
  });

  // Estatísticas
  const stats = {
    total: invoices.length,
    pending: invoices.filter(i => i.status === "pending").length,
    paid: invoices.filter(i => i.status === "paid").length,
    overdue: invoices.filter(i => i.status === "overdue").length,
    totalValue: invoices.reduce((sum, i) => sum + (i.value_cents || 0), 0),
    paidValue: invoices.filter(i => i.status === "paid").reduce((sum, i) => sum + (i.paid_value_cents || i.value_cents || 0), 0),
  };

  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Boletos de Assinatura</h1>
          <p className="text-muted-foreground">Gerenciamento de cobranças de planos das clínicas</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => syncStatusMutation.mutate()}
            disabled={syncStatusMutation.isPending}
          >
            {syncStatusMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Sincronizar Status
          </Button>
          <Button onClick={() => setGenerateDialogOpen(true)}>
            <Zap className="h-4 w-4 mr-2" />
            Gerar Boletos
          </Button>
          <Button variant="outline" onClick={() => setGenerateSingleDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Gerar por Clínica
          </Button>
        </div>
      </div>

      {/* Status das Credenciais */}
      {!checkingCredentials && !credentialsStatus?.valid && (
        <Card className="border-warning bg-warning/5">
          <CardContent className="p-4 flex items-center gap-4">
            <AlertCircle className="h-5 w-5 text-warning" />
            <div className="flex-1">
              <p className="font-medium text-warning">Credenciais Lytex não configuradas</p>
              <p className="text-sm text-muted-foreground">
                Configure as credenciais LYTEX_SUBSCRIPTION_CLIENT_ID e LYTEX_SUBSCRIPTION_CLIENT_SECRET nos secrets.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Receipt className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total de boletos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10">
                <Clock className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.pending}</p>
                <p className="text-sm text-muted-foreground">Pendentes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <CheckCircle className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.paid}</p>
                <p className="text-sm text-muted-foreground">Pagos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-info/10">
                <DollarSign className="h-5 w-5 text-info" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatCurrency(stats.paidValue)}</p>
                <p className="text-sm text-muted-foreground">Arrecadado</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="invoices" className="space-y-4">
        <TabsList>
          <TabsTrigger value="invoices">
            <Receipt className="h-4 w-4 mr-2" />
            Boletos
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="h-4 w-4 mr-2" />
            Configurações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="invoices" className="space-y-4">
          {/* Filtros */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por clínica ou CNPJ..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-64"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
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
                <Button variant="outline" size="sm" onClick={() => refetchInvoices()}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Tabela de Boletos */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Clínica</TableHead>
                    <TableHead>Competência</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingInvoices ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                      </TableCell>
                    </TableRow>
                  ) : invoices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Nenhum boleto encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    invoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="font-medium">{(invoice.clinics as any)?.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {(invoice.clinics as any)?.cnpj || `CPF: ${(invoice.clinics as any)?.owner_cpf}` || "-"}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {MONTHS[invoice.competence_month - 1]}/{invoice.competence_year}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{(invoice.subscription_plans as any)?.name || "-"}</Badge>
                        </TableCell>
                        <TableCell>
                          {format(new Date(invoice.due_date + "T12:00:00"), "dd/MM/yyyy")}
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(invoice.value_cents)}
                        </TableCell>
                        <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {invoice.invoice_url && (
                              <Button
                                variant="ghost"
                                size="sm"
                                asChild
                              >
                                <a href={invoice.invoice_url} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              </Button>
                            )}
                            {invoice.status !== "paid" && invoice.status !== "cancelled" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setInvoiceToEdit(invoice);
                                  setEditDialogOpen(true);
                                }}
                                title="Editar boleto"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configurações de Cobrança</CardTitle>
              <CardDescription>
                Configure a geração automática de boletos e integração com Lytex
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {loadingSettings ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Integração Lytex</p>
                      <p className="text-sm text-muted-foreground">
                        Habilitar geração de boletos via Lytex
                      </p>
                    </div>
                    <Switch
                      checked={settings?.lytex_enabled || false}
                      onCheckedChange={(checked) =>
                        updateSettingsMutation.mutate({ lytex_enabled: checked })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Geração Automática</p>
                      <p className="text-sm text-muted-foreground">
                        Gerar boletos automaticamente todo mês
                      </p>
                    </div>
                    <Switch
                      checked={settings?.auto_generate_enabled || false}
                      onCheckedChange={(checked) =>
                        updateSettingsMutation.mutate({ auto_generate_enabled: checked })
                      }
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Dia de geração (mensal)</Label>
                      <Input
                        type="number"
                        min={1}
                        max={28}
                        value={settings?.generate_day_of_month || 1}
                        onChange={(e) =>
                          updateSettingsMutation.mutate({
                            generate_day_of_month: parseInt(e.target.value) || 1,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Dias até vencimento</Label>
                      <Input
                        type="number"
                        min={1}
                        max={30}
                        value={settings?.default_due_day_offset || 10}
                        onChange={(e) =>
                          updateSettingsMutation.mutate({
                            default_due_day_offset: parseInt(e.target.value) || 10,
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Enviar E-mail na Geração</p>
                      <p className="text-sm text-muted-foreground">
                        Notificar clínicas quando boleto for gerado
                      </p>
                    </div>
                    <Switch
                      checked={settings?.send_email_on_generation || false}
                      onCheckedChange={(checked) =>
                        updateSettingsMutation.mutate({ send_email_on_generation: checked })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Enviar WhatsApp na Geração</p>
                      <p className="text-sm text-muted-foreground">
                        Notificar via WhatsApp (requer Evolution API)
                      </p>
                    </div>
                    <Switch
                      checked={settings?.send_whatsapp_on_generation || false}
                      onCheckedChange={(checked) =>
                        updateSettingsMutation.mutate({ send_whatsapp_on_generation: checked })
                      }
                    />
                  </div>

                  <div className="pt-4 border-t">
                    <h4 className="font-medium mb-2">Status da Integração</h4>
                    {checkingCredentials ? (
                      <p className="text-sm text-muted-foreground">Verificando...</p>
                    ) : credentialsStatus?.valid ? (
                      <div className="flex items-center gap-2 text-success">
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-sm">Credenciais válidas e conectadas</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-destructive">
                        <XCircle className="h-4 w-4" />
                        <span className="text-sm">
                          {credentialsStatus?.message || "Credenciais não configuradas"}
                        </span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog de Geração em Lote */}
      <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerar Boletos em Lote</DialogTitle>
            <DialogDescription>
              Gerar boletos de assinatura para todas as clínicas ativas
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Mês</Label>
                <Select
                  value={String(selectedMonth)}
                  onValueChange={(v) => setSelectedMonth(parseInt(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((month, index) => (
                      <SelectItem key={index} value={String(index + 1)}>
                        {month}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ano</Label>
                <Select
                  value={String(selectedYear)}
                  onValueChange={(v) => setSelectedYear(parseInt(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((year) => (
                      <SelectItem key={year} value={String(year)}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Serão gerados boletos para competência {MONTHS[selectedMonth - 1]}/{selectedYear} para todas as clínicas com assinatura ativa e documento (CNPJ ou CPF) cadastrado.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => generateBulkMutation.mutate({ month: selectedMonth, year: selectedYear })}
              disabled={generateBulkMutation.isPending}
            >
              {generateBulkMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Zap className="h-4 w-4 mr-2" />
              )}
              Gerar Boletos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Geração Individual por Clínica */}
      <Dialog open={generateSingleDialogOpen} onOpenChange={(open) => {
        setGenerateSingleDialogOpen(open);
        if (!open) {
          setSelectedClinic(null);
          setClinicSearchTerm("");
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Gerar Boleto por Clínica</DialogTitle>
            <DialogDescription>
              Gerar boleto de assinatura para uma clínica específica
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Seleção de Clínica */}
            <div className="space-y-2">
              <Label>Clínica</Label>
              {selectedClinic ? (
                <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">{selectedClinic.name}</p>
                      <p className="text-xs text-muted-foreground">{selectedClinic.cnpj}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedClinic(null)}>
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar clínica por nome..."
                      value={clinicSearchTerm}
                      onChange={(e) => setClinicSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto border rounded-lg divide-y">
                    {clinicsWithSubscription
                      .filter((c) => 
                        !clinicSearchTerm || 
                        c.name.toLowerCase().includes(clinicSearchTerm.toLowerCase()) ||
                        c.cnpj?.includes(clinicSearchTerm)
                      )
                      .slice(0, 10)
                      .map((clinic) => (
                        <button
                          key={clinic.id}
                          className="w-full p-3 text-left hover:bg-muted/50 transition-colors flex items-center gap-2"
                          onClick={() => {
                            setSelectedClinic(clinic);
                            setClinicSearchTerm("");
                          }}
                        >
                          <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{clinic.name}</p>
                            <p className="text-xs text-muted-foreground">{clinic.cnpj}</p>
                          </div>
                        </button>
                      ))}
                    {clinicsWithSubscription.filter((c) => 
                      !clinicSearchTerm || 
                      c.name.toLowerCase().includes(clinicSearchTerm.toLowerCase())
                    ).length === 0 && (
                      <p className="p-3 text-sm text-muted-foreground text-center">
                        Nenhuma clínica encontrada
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Seleção de Mês/Ano */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Mês</Label>
                <Select
                  value={String(selectedMonth)}
                  onValueChange={(v) => setSelectedMonth(parseInt(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((month, index) => (
                      <SelectItem key={index} value={String(index + 1)}>
                        {month}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ano</Label>
                <Select
                  value={String(selectedYear)}
                  onValueChange={(v) => setSelectedYear(parseInt(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((year) => (
                      <SelectItem key={year} value={String(year)}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedClinic && (
              <p className="text-sm text-muted-foreground">
                Será gerado boleto de {MONTHS[selectedMonth - 1]}/{selectedYear} para{" "}
                <span className="font-medium">{selectedClinic.name}</span>.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateSingleDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (selectedClinic) {
                  generateSingleMutation.mutate({
                    clinicId: selectedClinic.id,
                    month: selectedMonth,
                    year: selectedYear,
                  });
                }
              }}
              disabled={!selectedClinic || generateSingleMutation.isPending}
            >
              {generateSingleMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Receipt className="h-4 w-4 mr-2" />
              )}
              Gerar Boleto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Edição de Boleto */}
      <EditSubscriptionInvoiceDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        invoice={invoiceToEdit}
      />
    </div>
  );
}
