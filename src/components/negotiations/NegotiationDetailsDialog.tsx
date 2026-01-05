import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Building2,
  FileText,
  DollarSign,
  Calendar,
  CheckCircle2,
  XCircle,
  Loader2,
  Download,
  Receipt,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";

interface Employer {
  id: string;
  name: string;
  cnpj: string;
  trade_name: string | null;
}

interface Negotiation {
  id: string;
  negotiation_code: string;
  status: string;
  employer_id: string;
  total_original_value: number;
  total_interest: number;
  total_monetary_correction: number;
  total_late_fee: number;
  total_negotiated_value: number;
  down_payment_value: number;
  installments_count: number;
  installment_value: number;
  first_due_date: string;
  applied_interest_rate: number;
  applied_correction_rate: number;
  applied_late_fee_rate: number;
  approved_at: string | null;
  approved_by: string | null;
  approval_method: string | null;
  approval_notes: string | null;
  finalized_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  created_at: string;
  employers?: Employer;
}

interface NegotiationItem {
  id: string;
  contribution_id: string;
  original_value: number;
  due_date: string;
  competence_month: number;
  competence_year: number;
  contribution_type_name: string;
  days_overdue: number;
  interest_value: number;
  correction_value: number;
  late_fee_value: number;
  total_value: number;
}

interface Installment {
  id: string;
  installment_number: number;
  value: number;
  due_date: string;
  status: string;
  lytex_invoice_url: string | null;
  paid_at: string | null;
  paid_value: number | null;
}

interface NegotiationDetailsDialogProps {
  negotiation: Negotiation;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh: () => void;
}

const STATUS_CONFIG: Record<string, { label: string; badgeClass: string }> = {
  simulation: { label: "Simulação", badgeClass: "bg-purple-500/15 text-purple-700" },
  pending_approval: { label: "Aguardando Aprovação", badgeClass: "bg-amber-500/15 text-amber-700" },
  approved: { label: "Aprovado", badgeClass: "bg-blue-500/15 text-blue-700" },
  active: { label: "Ativo", badgeClass: "bg-emerald-500/15 text-emerald-700" },
  completed: { label: "Concluído", badgeClass: "bg-green-500/15 text-green-700" },
  cancelled: { label: "Cancelado", badgeClass: "bg-gray-500/15 text-gray-500" },
};

const MONTHS = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez"
];

export default function NegotiationDetailsDialog({
  negotiation,
  open,
  onOpenChange,
  onRefresh,
}: NegotiationDetailsDialogProps) {
  const { user } = useAuth();
  const [items, setItems] = useState<NegotiationItem[]>([]);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  // Approval dialog
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [approvalMethod, setApprovalMethod] = useState<string>("presencial");
  const [approvalNotes, setApprovalNotes] = useState("");

  // Cancel dialog
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  useEffect(() => {
    if (open && negotiation.id) {
      fetchDetails();
    }
  }, [open, negotiation.id]);

  const fetchDetails = async () => {
    setLoading(true);
    try {
      const [itemsRes, installmentsRes] = await Promise.all([
        supabase
          .from("negotiation_items")
          .select("*")
          .eq("negotiation_id", negotiation.id)
          .order("competence_year", { ascending: true })
          .order("competence_month", { ascending: true }),
        supabase
          .from("negotiation_installments")
          .select("*")
          .eq("negotiation_id", negotiation.id)
          .order("installment_number", { ascending: true }),
      ]);

      if (itemsRes.error) throw itemsRes.error;
      if (installmentsRes.error) throw installmentsRes.error;

      setItems(itemsRes.data || []);
      setInstallments(installmentsRes.data || []);
    } catch (error) {
      console.error("Error fetching details:", error);
      toast.error("Erro ao carregar detalhes");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatCNPJ = (cnpj: string) => {
    return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  };

  const handleSendForApproval = async () => {
    setProcessing(true);
    try {
      const { error } = await supabase
        .from("debt_negotiations")
        .update({ status: "pending_approval" })
        .eq("id", negotiation.id);

      if (error) throw error;

      toast.success("Negociação enviada para aprovação");
      onRefresh();
      onOpenChange(false);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Erro ao enviar para aprovação");
    } finally {
      setProcessing(false);
    }
  };

  const handleApprove = async () => {
    setProcessing(true);
    try {
      const { error } = await supabase
        .from("debt_negotiations")
        .update({
          status: "approved",
          approved_at: new Date().toISOString(),
          approved_by: user?.id,
          approval_method: approvalMethod,
          approval_notes: approvalNotes || null,
        })
        .eq("id", negotiation.id);

      if (error) throw error;

      toast.success("Negociação aprovada com sucesso");
      setShowApprovalDialog(false);
      onRefresh();
      onOpenChange(false);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Erro ao aprovar negociação");
    } finally {
      setProcessing(false);
    }
  };

  const handleFinalize = async () => {
    setProcessing(true);
    try {
      // Update negotiation status
      const { error: negError } = await supabase
        .from("debt_negotiations")
        .update({
          status: "active",
          finalized_at: new Date().toISOString(),
          finalized_by: user?.id,
        })
        .eq("id", negotiation.id);

      if (negError) throw negError;

      // Update original contributions to mark as negotiated
      const contributionIds = items.map((item) => item.contribution_id);
      const { error: contribError } = await supabase
        .from("employer_contributions")
        .update({
          negotiation_id: negotiation.id,
          status: "negotiated",
        })
        .in("id", contributionIds);

      if (contribError) throw contribError;

      // Generate boletos for installments
      for (const installment of installments) {
        try {
          const { error: boletoError } = await supabase.functions.invoke("lytex-api", {
            body: {
              action: "createInvoice",
              clientId: negotiation.employers?.id,
              clientName: negotiation.employers?.name,
              clientDocument: negotiation.employers?.cnpj,
              value: installment.value,
              dueDate: installment.due_date,
              description: `Negociação ${negotiation.negotiation_code} - Parcela ${installment.installment_number}/${negotiation.installments_count}`,
            },
          });

          if (boletoError) {
            console.error("Error generating boleto:", boletoError);
          }
        } catch (err) {
          console.error("Error invoking lytex-api:", err);
        }
      }

      toast.success("Negociação efetivada! Boletos estão sendo gerados.");
      onRefresh();
      onOpenChange(false);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Erro ao efetivar negociação");
    } finally {
      setProcessing(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelReason.trim()) {
      toast.error("Informe o motivo do cancelamento");
      return;
    }

    setProcessing(true);
    try {
      // Update negotiation
      const { error: negError } = await supabase
        .from("debt_negotiations")
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
          cancelled_by: user?.id,
          cancellation_reason: cancelReason,
        })
        .eq("id", negotiation.id);

      if (negError) throw negError;

      // Reopen original contributions if they were marked as negotiated
      if (negotiation.status === "active") {
        const contributionIds = items.map((item) => item.contribution_id);
        const { error: contribError } = await supabase
          .from("employer_contributions")
          .update({
            negotiation_id: null,
            status: "overdue",
          })
          .in("id", contributionIds);

        if (contribError) throw contribError;
      }

      toast.success("Negociação cancelada");
      setShowCancelDialog(false);
      onRefresh();
      onOpenChange(false);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Erro ao cancelar negociação");
    } finally {
      setProcessing(false);
    }
  };

  const statusConfig = STATUS_CONFIG[negotiation.status] || STATUS_CONFIG.simulation;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-xl font-bold">
                  {negotiation.negotiation_code}
                </DialogTitle>
                <DialogDescription>
                  {negotiation.employers?.name}
                </DialogDescription>
              </div>
              <Badge variant="outline" className={statusConfig.badgeClass}>
                {statusConfig.label}
              </Badge>
            </div>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <Tabs defaultValue="summary">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="summary">Resumo</TabsTrigger>
                <TabsTrigger value="items">Contribuições</TabsTrigger>
                <TabsTrigger value="installments">Parcelas</TabsTrigger>
              </TabsList>

              <TabsContent value="summary" className="space-y-4 mt-4">
                {/* Company Info */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Contribuinte
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm space-y-1">
                      <p className="font-medium">{negotiation.employers?.name}</p>
                      <p className="text-muted-foreground font-mono">
                        {negotiation.employers?.cnpj && formatCNPJ(negotiation.employers.cnpj)}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Financial Summary */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Resumo Financeiro
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Valor Original</span>
                      <span>{formatCurrency(negotiation.total_original_value)}</span>
                    </div>
                    <div className="flex justify-between text-amber-600">
                      <span>Juros ({negotiation.applied_interest_rate}%)</span>
                      <span>+{formatCurrency(negotiation.total_interest)}</span>
                    </div>
                    <div className="flex justify-between text-blue-600">
                      <span>Correção ({negotiation.applied_correction_rate}%)</span>
                      <span>+{formatCurrency(negotiation.total_monetary_correction)}</span>
                    </div>
                    <div className="flex justify-between text-red-600">
                      <span>Multa ({negotiation.applied_late_fee_rate}%)</span>
                      <span>+{formatCurrency(negotiation.total_late_fee)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-bold text-base">
                      <span>Total Negociado</span>
                      <span className="text-primary">{formatCurrency(negotiation.total_negotiated_value)}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Installment Info */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Parcelamento
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {negotiation.down_payment_value > 0 && (
                      <div className="flex justify-between">
                        <span>Entrada</span>
                        <span>{formatCurrency(negotiation.down_payment_value)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>Parcelas</span>
                      <span>{negotiation.installments_count}x de {formatCurrency(negotiation.installment_value)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Primeira Parcela</span>
                      <span>{format(new Date(negotiation.first_due_date), "dd/MM/yyyy")}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Approval Info */}
                {negotiation.approved_at && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        Aprovação
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Data</span>
                        <span>{format(new Date(negotiation.approved_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Método</span>
                        <span className="capitalize">{negotiation.approval_method}</span>
                      </div>
                      {negotiation.approval_notes && (
                        <p className="text-muted-foreground italic">{negotiation.approval_notes}</p>
                      )}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="items" className="mt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Competência</TableHead>
                      <TableHead className="text-right">Original</TableHead>
                      <TableHead className="text-center">Atraso</TableHead>
                      <TableHead className="text-right">Encargos</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.contribution_type_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {MONTHS[item.competence_month - 1]}/{item.competence_year}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(item.original_value)}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="destructive" className="text-xs">{item.days_overdue}d</Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {formatCurrency(item.interest_value + item.correction_value + item.late_fee_value)}
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(item.total_value)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>

              <TabsContent value="installments" className="mt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Parcela</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {installments.map((inst) => (
                      <TableRow key={inst.id}>
                        <TableCell>{inst.installment_number}/{negotiation.installments_count}</TableCell>
                        <TableCell>{format(new Date(inst.due_date), "dd/MM/yyyy")}</TableCell>
                        <TableCell className="text-right">{formatCurrency(inst.value)}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              inst.status === "paid"
                                ? "bg-emerald-500/15 text-emerald-700"
                                : inst.status === "overdue"
                                ? "bg-rose-500/15 text-rose-700"
                                : "bg-amber-500/15 text-amber-700"
                            }
                          >
                            {inst.status === "paid" ? "Pago" : inst.status === "overdue" ? "Vencido" : "Pendente"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {inst.lytex_invoice_url && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(inst.lytex_invoice_url!, "_blank")}
                            >
                              <Receipt className="h-4 w-4 mr-1" />
                              Boleto
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>
            </Tabs>
          )}

          {/* Actions */}
          <div className="flex justify-between pt-4 border-t">
            <div>
              {negotiation.status !== "cancelled" && negotiation.status !== "completed" && (
                <Button
                  variant="destructive"
                  onClick={() => setShowCancelDialog(true)}
                  disabled={processing}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              {negotiation.status === "simulation" && (
                <Button onClick={handleSendForApproval} disabled={processing}>
                  {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Enviar para Aprovação
                </Button>
              )}
              {negotiation.status === "pending_approval" && (
                <Button onClick={() => setShowApprovalDialog(true)} disabled={processing}>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Aprovar
                </Button>
              )}
              {negotiation.status === "approved" && (
                <Button onClick={handleFinalize} disabled={processing}>
                  {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Efetivar e Gerar Boletos
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Approval Dialog */}
      <AlertDialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aprovar Negociação</AlertDialogTitle>
            <AlertDialogDescription>
              Confirme a aprovação da negociação pelo contribuinte.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Forma de Aceite</Label>
              <Select value={approvalMethod} onValueChange={setApprovalMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="presencial">Aceite Presencial</SelectItem>
                  <SelectItem value="portal">Portal da Empresa</SelectItem>
                  <SelectItem value="documento_assinado">Documento Assinado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Observações (opcional)</Label>
              <Textarea
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                placeholder="Informações adicionais sobre a aprovação..."
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleApprove} disabled={processing}>
              {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar Aprovação
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Negociação</AlertDialogTitle>
            <AlertDialogDescription>
              {negotiation.status === "active"
                ? "As contribuições originais serão reabertas como débitos em atraso."
                : "Esta ação não poderá ser desfeita."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Motivo do Cancelamento *</Label>
              <Textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Informe o motivo do cancelamento..."
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              disabled={processing || !cancelReason.trim()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar Cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
