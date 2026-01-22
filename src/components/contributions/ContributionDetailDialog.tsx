import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PopupBase, PopupHeader, PopupTitle, PopupDescription } from "@/components/ui/popup-base";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Building2,
  Calendar,
  Receipt,
  CreditCard,
  DollarSign,
  FileText,
  History,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  ExternalLink,
  Loader2,
  BadgeCheck,
  AlertCircle,
  Banknote,
  ArrowRightLeft,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface Employer {
  id: string;
  name: string;
  cnpj: string;
  registration_number?: string | null;
}

interface ContributionType {
  id: string;
  name: string;
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
  paid_at: string | null;
  paid_value: number | null;
  payment_method: string | null;
  origin?: string;
  lytex_transaction_id?: string | null;
  lytex_fee_amount?: number | null;
  lytex_fee_details?: Record<string, unknown> | null;
  net_value?: number | null;
  is_reconciled?: boolean;
  reconciled_at?: string | null;
  has_divergence?: boolean;
  divergence_details?: Record<string, unknown> | null;
  imported_at?: string | null;
  is_editable?: boolean;
  employers?: Employer;
  contribution_types?: ContributionType;
  created_at?: string;
  updated_at?: string;
}

interface AuditLog {
  id: string;
  action: string;
  previous_status: string | null;
  new_status: string | null;
  previous_value: number | null;
  new_value: number | null;
  notes: string | null;
  performed_at: string;
  performed_by: string | null;
}

interface ContributionDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contribution: Contribution | null;
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  pending: { label: "Pendente", icon: Clock, className: "bg-amber-500/15 text-amber-700 border-amber-300" },
  processing: { label: "Processando", icon: Loader2, className: "bg-blue-500/15 text-blue-700 border-blue-300" },
  paid: { label: "Pago", icon: CheckCircle2, className: "bg-emerald-500/15 text-emerald-700 border-emerald-300" },
  overdue: { label: "Vencido", icon: AlertTriangle, className: "bg-rose-500/15 text-rose-700 border-rose-300" },
  cancelled: { label: "Cancelado", icon: XCircle, className: "bg-gray-500/15 text-gray-600 border-gray-300" },
  awaiting_value: { label: "Aguardando Valor", icon: Clock, className: "bg-purple-500/15 text-purple-700 border-purple-300" },
};

const ORIGIN_CONFIG: Record<string, { label: string; color: string }> = {
  lytex: { label: "Lytex", color: "bg-blue-100 text-blue-800 border-blue-300" },
  manual: { label: "Manual", color: "bg-gray-100 text-gray-800 border-gray-300" },
  import: { label: "Importação", color: "bg-purple-100 text-purple-800 border-purple-300" },
};

const ACTION_LABELS: Record<string, string> = {
  created: "Criado",
  imported: "Importado",
  invoice_generated: "Boleto Gerado",
  status_changed: "Status Alterado",
  reconciled: "Conciliado",
  value_adjusted: "Valor Ajustado",
  cancelled: "Cancelado",
  reversed: "Estornado",
  edited: "Editado",
  synced: "Sincronizado",
};

import { formatCompetence } from "@/lib/competence-format";

const PAYMENT_METHODS: Record<string, string> = {
  boleto: "Boleto Bancário",
  pix: "PIX",
  credit_card: "Cartão de Crédito",
  debit_card: "Cartão de Débito",
  bank_transfer: "Transferência Bancária",
  cash: "Dinheiro",
};

export default function ContributionDetailDialog({
  open,
  onOpenChange,
  contribution,
}: ContributionDetailDialogProps) {
  const [activeTab, setActiveTab] = useState("details");

  // Fetch audit logs
  const { data: auditLogs, isLoading: loadingLogs } = useQuery({
    queryKey: ["contribution-audit-logs", contribution?.id],
    queryFn: async () => {
      if (!contribution?.id) return [];
      const { data, error } = await supabase
        .from("contribution_audit_logs")
        .select("*")
        .eq("contribution_id", contribution.id)
        .order("performed_at", { ascending: false });
      
      if (error) throw error;
      return data as AuditLog[];
    },
    enabled: open && !!contribution?.id,
  });

  if (!contribution) return null;

  const formatCurrency = (cents: number | null | undefined) => {
    if (cents === null || cents === undefined) return "—";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(cents / 100);
  };

  const formatCNPJ = (cnpj: string) => {
    const cleaned = cnpj.replace(/\D/g, "");
    return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  };

  const statusConfig = STATUS_CONFIG[contribution.status] || STATUS_CONFIG.pending;
  const StatusIcon = statusConfig.icon;
  const originConfig = ORIGIN_CONFIG[contribution.origin || "manual"];

  return (
    <PopupBase open={open} onClose={() => onOpenChange(false)} maxWidth="3xl">
      <PopupHeader>
        <PopupTitle className="flex items-center gap-2">
          <Receipt className="h-5 w-5 text-primary" />
          Detalhes da Contribuição
        </PopupTitle>
        <PopupDescription>
          Informações completas e histórico de auditoria
        </PopupDescription>
      </PopupHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="details" className="gap-2">
              <FileText className="h-4 w-4" />
              Detalhes
            </TabsTrigger>
            <TabsTrigger value="financial" className="gap-2">
              <DollarSign className="h-4 w-4" />
              Financeiro
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="h-4 w-4" />
              Histórico
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[60vh] mt-4 pr-4">
            <TabsContent value="details" className="space-y-4 mt-0">
              {/* Status and Origin */}
              <div className="flex items-center gap-3 flex-wrap">
                <Badge className={`${statusConfig.className} flex items-center gap-1 px-3 py-1`}>
                  <StatusIcon className="h-3.5 w-3.5" />
                  {statusConfig.label}
                </Badge>
                <Badge variant="outline" className={originConfig.color}>
                  Origem: {originConfig.label}
                </Badge>
                {contribution.is_reconciled && (
                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">
                    <BadgeCheck className="h-3.5 w-3.5 mr-1" />
                    Conciliado
                  </Badge>
                )}
                {contribution.has_divergence && (
                  <Badge className="bg-amber-100 text-amber-800 border-amber-300">
                    <AlertCircle className="h-3.5 w-3.5 mr-1" />
                    Com Divergência
                  </Badge>
                )}
                {contribution.is_editable === false && (
                  <Badge variant="secondary" className="text-xs">
                    🔒 Somente leitura
                  </Badge>
                )}
              </div>

              {/* Employer Info */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    Empresa Contribuinte
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div>
                    <p className="font-medium">{contribution.employers?.name || "—"}</p>
                    <p className="text-sm text-muted-foreground font-mono">
                      {contribution.employers?.cnpj ? formatCNPJ(contribution.employers.cnpj) : "—"}
                    </p>
                  </div>
                  {contribution.employers?.registration_number && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Matrícula:</span>
                      <Badge variant="outline" className="font-mono">
                        {contribution.employers.registration_number}
                      </Badge>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Contribution Info */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-muted-foreground" />
                    Dados da Contribuição
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Tipo</p>
                      <p className="font-medium">{contribution.contribution_types?.name || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Competência</p>
                      <p className="font-medium">
                        {formatCompetence(contribution.competence_month, contribution.competence_year)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Vencimento</p>
                      <p className="font-medium">
                        {format(new Date(contribution.due_date + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Valor Bruto</p>
                      <p className="font-medium text-lg">{formatCurrency(contribution.value)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Lytex Info */}
              {contribution.origin === "lytex" && (
                <Card className="border-blue-200 bg-blue-50/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2 text-blue-700">
                      <ExternalLink className="h-4 w-4" />
                      Dados Lytex
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">ID da Fatura</p>
                        <p className="font-mono text-xs">{contribution.lytex_invoice_id || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">ID da Transação</p>
                        <p className="font-mono text-xs">{contribution.lytex_transaction_id || "—"}</p>
                      </div>
                      {contribution.imported_at && (
                        <div className="col-span-2">
                          <p className="text-xs text-muted-foreground">Importado em</p>
                          <p className="text-sm">
                            {format(new Date(contribution.imported_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                      )}
                    </div>
                    {contribution.lytex_invoice_url && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => window.open(contribution.lytex_invoice_url!, "_blank")}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Abrir Fatura na Lytex
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="financial" className="space-y-4 mt-0">
              {/* Financial Summary */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Card className="border-l-4 border-l-slate-500">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Valor Bruto</p>
                    <p className="text-xl font-bold">{formatCurrency(contribution.value)}</p>
                  </CardContent>
                </Card>
                <Card className="border-l-4 border-l-amber-500">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Taxas Lytex</p>
                    <p className="text-xl font-bold text-amber-600">
                      {formatCurrency(contribution.lytex_fee_amount)}
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-l-4 border-l-emerald-500">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Valor Líquido</p>
                    <p className="text-xl font-bold text-emerald-600">
                      {formatCurrency(contribution.net_value)}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Payment Info */}
              {contribution.status === "paid" && (
                <Card className="border-emerald-200 bg-emerald-50/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2 text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" />
                      Pagamento Realizado
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Data do Pagamento</p>
                        <p className="font-medium">
                          {contribution.paid_at
                            ? format(new Date(contribution.paid_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                            : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Valor Pago</p>
                        <p className="font-medium text-emerald-700">
                          {formatCurrency(contribution.paid_value)}
                        </p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-xs text-muted-foreground">Forma de Pagamento</p>
                        <div className="flex items-center gap-2 mt-1">
                          <CreditCard className="h-4 w-4 text-muted-foreground" />
                          <p className="font-medium">
                            {PAYMENT_METHODS[contribution.payment_method || ""] || contribution.payment_method || "—"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Fee Details */}
              {contribution.lytex_fee_details && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Banknote className="h-4 w-4 text-muted-foreground" />
                      Detalhamento de Taxas
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto max-h-40">
                      {JSON.stringify(contribution.lytex_fee_details, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
              )}

              {/* Reconciliation */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                    Conciliação Financeira
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {contribution.is_reconciled ? (
                    <div className="space-y-2">
                      <Badge className="bg-emerald-100 text-emerald-800">
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                        Conciliado
                      </Badge>
                      {contribution.reconciled_at && (
                        <p className="text-sm text-muted-foreground">
                          Em {format(new Date(contribution.reconciled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-amber-600">
                      <Clock className="h-4 w-4" />
                      <span className="text-sm">Aguardando conciliação</span>
                    </div>
                  )}

                  {contribution.has_divergence && contribution.divergence_details && (
                    <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="flex items-center gap-2 text-amber-700 mb-2">
                        <AlertCircle className="h-4 w-4" />
                        <span className="font-medium text-sm">Divergência Detectada</span>
                      </div>
                      <pre className="text-xs overflow-auto">
                        {JSON.stringify(contribution.divergence_details, null, 2)}
                      </pre>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history" className="space-y-4 mt-0">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <History className="h-4 w-4 text-muted-foreground" />
                    Histórico de Auditoria
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingLogs ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : auditLogs && auditLogs.length > 0 ? (
                    <div className="space-y-3">
                      {auditLogs.map((log) => (
                        <div
                          key={log.id}
                          className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg"
                        >
                          <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className="text-xs">
                                {ACTION_LABELS[log.action] || log.action}
                              </Badge>
                              {log.previous_status && log.new_status && log.previous_status !== log.new_status && (
                                <span className="text-xs text-muted-foreground">
                                  {STATUS_CONFIG[log.previous_status]?.label || log.previous_status}
                                  {" → "}
                                  {STATUS_CONFIG[log.new_status]?.label || log.new_status}
                                </span>
                              )}
                              {log.previous_value !== null && log.new_value !== null && log.previous_value !== log.new_value && (
                                <span className="text-xs text-muted-foreground">
                                  {formatCurrency(log.previous_value)} → {formatCurrency(log.new_value)}
                                </span>
                              )}
                            </div>
                            {log.notes && (
                              <p className="text-xs text-muted-foreground mt-1">{log.notes}</p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(new Date(log.performed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Nenhum registro de auditoria encontrado</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Metadata */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Metadados</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground space-y-1">
                  <p>
                    <span className="font-medium">Criado em:</span>{" "}
                    {contribution.created_at
                      ? format(new Date(contribution.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                      : "—"}
                  </p>
                  <p>
                    <span className="font-medium">Atualizado em:</span>{" "}
                    {contribution.updated_at
                      ? format(new Date(contribution.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                      : "—"}
                  </p>
                  <p>
                    <span className="font-medium">ID:</span>{" "}
                    <code className="bg-muted px-1 rounded">{contribution.id}</code>
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </ScrollArea>
        </Tabs>
    </PopupBase>
  );
}
