import { useState, useEffect } from "react";
import { getStaticYearRange } from "@/hooks/useAvailableYears";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  FileText,
  CheckCircle2,
  XCircle,
  Copy,
  Download,
  Send,
  Loader2,
  Pencil,
  AlertCircle,
  Trash2,
  Clock,
  AlertTriangle,
  User,
  ExternalLink,
  Receipt,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatCompetence } from "@/lib/competence-format";

interface Member {
  id: string;
  name: string;
  cpf: string | null;
  email?: string | null;
  phone?: string | null;
}

interface ContributionType {
  id: string;
  name: string;
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
  paid_at: string | null;
  paid_value: number | null;
  payment_method: string | null;
  member_id?: string | null;
  patients?: Member;
  contribution_types?: ContributionType;
}

interface PFContributionDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contribution: Contribution | null;
  contributionTypes: ContributionType[];
  onGenerateInvoice: (contribution: Contribution) => void;
  generatingInvoice: boolean;
  onRefresh: () => void;
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  pending: { label: "Pendente", icon: Clock, className: "bg-amber-500/15 text-amber-700 border-amber-300" },
  processing: { label: "Processando", icon: Loader2, className: "bg-blue-500/15 text-blue-700 border-blue-300" },
  paid: { label: "Pago", icon: CheckCircle2, className: "bg-emerald-500/15 text-emerald-700 border-emerald-300" },
  overdue: { label: "Vencido", icon: AlertTriangle, className: "bg-rose-500/15 text-rose-700 border-rose-300" },
  cancelled: { label: "Cancelado", icon: XCircle, className: "bg-gray-500/15 text-gray-600 border-gray-300" },
};

export default function PFContributionDetailDialog({
  open,
  onOpenChange,
  contribution,
  contributionTypes,
  onGenerateInvoice,
  generatingInvoice,
  onRefresh,
}: PFContributionDetailDialogProps) {
  // Edit dialog states
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editTypeId, setEditTypeId] = useState("");
  const [editMonth, setEditMonth] = useState(1);
  const [editYear, setEditYear] = useState(new Date().getFullYear());
  const [updating, setUpdating] = useState(false);
  
  // Duplicate check
  const [hasDuplicate, setHasDuplicate] = useState(false);
  const [duplicateId, setDuplicateId] = useState<string | null>(null);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const [forceDuplicate, setForceDuplicate] = useState(false);
  
  // Delete/Cancel dialog states
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [forceDeleteLocal, setForceDeleteLocal] = useState(false);

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(cents / 100);
  };

  const formatCPF = (cpf: string | null) => {
    if (!cpf) return "-";
    const clean = cpf.replace(/\D/g, "");
    return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  };

  const handleCopyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  const handleOpenEditDialog = () => {
    if (!contribution) return;
    setEditValue((contribution.value / 100).toFixed(2).replace(".", ","));
    setEditDueDate(contribution.due_date);
    setEditTypeId(contribution.contribution_type_id);
    setEditMonth(contribution.competence_month);
    setEditYear(contribution.competence_year);
    setHasDuplicate(false);
    setForceDuplicate(false);
    setDuplicateId(null);
    setEditDialogOpen(true);
  };

  const checkDuplicateCompetence = async () => {
    if (!contribution || !editDialogOpen) return;
    
    if (
      editMonth === contribution.competence_month && 
      editYear === contribution.competence_year &&
      editTypeId === contribution.contribution_type_id
    ) {
      setHasDuplicate(false);
      setDuplicateId(null);
      return;
    }
    
    setCheckingDuplicate(true);
    try {
      const { data } = await supabase
        .from("employer_contributions")
        .select("id")
        .eq("member_id", contribution.member_id)
        .eq("contribution_type_id", editTypeId)
        .eq("competence_month", editMonth)
        .eq("competence_year", editYear)
        .neq("id", contribution.id)
        .neq("status", "cancelled")
        .maybeSingle();
      
      setHasDuplicate(!!data);
      setDuplicateId(data?.id || null);
    } catch (error) {
      console.error("Error checking duplicate:", error);
    } finally {
      setCheckingDuplicate(false);
    }
  };

  useEffect(() => {
    if (editDialogOpen) {
      checkDuplicateCompetence();
    }
  }, [editMonth, editYear, editTypeId, editDialogOpen]);

  const handleUpdateInvoice = async () => {
    if (!contribution) return;
    
    setUpdating(true);
    try {
      const newValueCents = Math.round(parseFloat(editValue.replace(",", ".")) * 100);
      
      const selectedType = contributionTypes.find(t => t.id === editTypeId);
      const newDescription = `${selectedType?.name || 'Contribuição'} - ${formatCompetence(editMonth, editYear)}`;
      
      if (hasDuplicate && forceDuplicate && duplicateId) {
        const { error: cancelError } = await supabase
          .from("employer_contributions")
          .update({ status: "cancelled" })
          .eq("id", duplicateId);
        
        if (cancelError) {
          console.error("Error cancelling duplicate:", cancelError);
          throw new Error("Erro ao cancelar contribuição duplicada");
        }
      }
      
      if (contribution.lytex_invoice_id) {
        const { error } = await supabase.functions.invoke("lytex-api", {
          body: {
            action: "update_invoice",
            invoiceId: contribution.lytex_invoice_id,
            contributionId: contribution.id,
            value: newValueCents,
            dueDate: editDueDate,
            description: newDescription,
            contributionTypeId: editTypeId,
            competenceMonth: editMonth,
            competenceYear: editYear,
          },
        });

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("employer_contributions")
          .update({
            value: newValueCents,
            due_date: editDueDate,
            contribution_type_id: editTypeId,
            competence_month: editMonth,
            competence_year: editYear,
          })
          .eq("id", contribution.id);

        if (error) throw error;
      }

      toast.success("Contribuição atualizada com sucesso");
      setEditDialogOpen(false);
      onOpenChange(false);
      onRefresh();
    } catch (error: any) {
      console.error("Error updating:", error);
      toast.error(error.message || "Erro ao atualizar contribuição");
    } finally {
      setUpdating(false);
    }
  };

  const handleCancelContribution = async () => {
    if (!contribution) return;

    try {
      if (contribution.lytex_invoice_id) {
        const { data, error } = await supabase.functions.invoke("lytex-api", {
          body: {
            action: "cancel_invoice",
            invoiceId: contribution.lytex_invoice_id,
            contributionId: contribution.id,
          },
        });

        if (data?.error === "BOLETO_EM_PROCESSAMENTO" || data?.canForceLocal) {
          toast.error(
            "Boleto em processamento na Lytex (aguarde 30 min após criação). Cancelando apenas no sistema local.",
            { duration: 6000 }
          );
          await supabase
            .from("employer_contributions")
            .update({ status: "cancelled" })
            .eq("id", contribution.id);
          
          toast.success("Contribuição cancelada localmente");
          setCancelDialogOpen(false);
          onOpenChange(false);
          onRefresh();
          return;
        }

        if (error) {
          console.error("Edge function error:", error);
          const errMsg = error?.message || (typeof error === 'string' ? error : "Erro ao cancelar na Lytex");
          
          if (errMsg.includes("processamento") || errMsg.includes("30 min")) {
            await supabase
              .from("employer_contributions")
              .update({ status: "cancelled" })
              .eq("id", contribution.id);
            
            toast.success("Contribuição cancelada localmente (boleto pode permanecer ativo na Lytex por alguns minutos)");
            setCancelDialogOpen(false);
            onOpenChange(false);
            onRefresh();
            return;
          }
          
          throw new Error(errMsg);
        }

        if (data?.error) {
          console.error("Lytex API error:", data.error);
          throw new Error(data.message || data.error);
        }
      } else {
        await supabase
          .from("employer_contributions")
          .update({ status: "cancelled" })
          .eq("id", contribution.id);
      }

      toast.success("Contribuição cancelada");
      setCancelDialogOpen(false);
      onOpenChange(false);
      onRefresh();
    } catch (error: any) {
      console.error("Error cancelling:", error);
      toast.error(error?.message || "Erro ao cancelar contribuição");
    }
  };

  const handleDeleteContribution = async (forceLocal = false) => {
    if (!contribution) return;
    
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke("lytex-api", {
        body: {
          action: "delete_contribution",
          contributionId: contribution.id,
          forceLocal,
        },
      });

      if (data?.error === "BOLETO_EM_PROCESSAMENTO" || data?.canForceLocal) {
        console.log("Boleto em processamento, habilitando opção de exclusão local");
        toast.error(
          "Boleto em processamento na Lytex (aguarde 30 min após criação). Clique em 'Forçar exclusão local' para excluir apenas do sistema.",
          { duration: 8000 }
        );
        setForceDeleteLocal(true);
        setDeleting(false);
        return;
      }

      if (error) {
        console.error("Edge function error:", error);
        const errMsg = error?.message || (typeof error === 'string' ? error : "Erro ao excluir contribuição");
        throw new Error(errMsg);
      }

      if (data?.error) {
        console.error("Lytex API error:", data.error);
        throw new Error(data.message || data.error);
      }

      toast.success(forceLocal 
        ? "Contribuição excluída localmente (boleto pode permanecer na Lytex)" 
        : "Contribuição e boleto excluídos com sucesso"
      );
      setDeleteDialogOpen(false);
      setForceDeleteLocal(false);
      onOpenChange(false);
      onRefresh();
    } catch (error: any) {
      console.error("Error deleting:", error);
      const msg = error?.message || "";
      
      if ((msg.includes("processamento") || msg.includes("30 min") || msg.includes("BOLETO_EM_PROCESSAMENTO")) && !forceLocal) {
        toast.error(
          "Boleto em processamento na Lytex. Clique em 'Forçar exclusão local' para excluir apenas do sistema.",
          { duration: 8000 }
        );
        setForceDeleteLocal(true);
      } else {
        toast.error(msg || "Falha ao excluir. O boleto pode ainda estar ativo na Lytex.");
      }
    } finally {
      setDeleting(false);
    }
  };

  if (!contribution) return null;

  const statusConfig = STATUS_CONFIG[contribution.status] || STATUS_CONFIG.pending;
  const StatusIcon = statusConfig.icon;

  return (
    <>
      {/* Main View Dialog */}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              Detalhes da Contribuição
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Status Badge */}
            <div className="flex items-center gap-2">
              <Badge className={`${statusConfig.className} flex items-center gap-1 px-3 py-1`}>
                <StatusIcon className="h-3.5 w-3.5" />
                {statusConfig.label}
              </Badge>
            </div>

            {/* Member Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Sócio</p>
                <p className="font-medium flex items-center gap-1">
                  <User className="h-3.5 w-3.5" />
                  {contribution.patients?.name || "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">CPF</p>
                <p className="font-mono text-sm">{formatCPF(contribution.patients?.cpf || null)}</p>
              </div>
            </div>

            {/* Contribution Details */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Tipo</p>
                <p className="font-medium">{contribution.contribution_types?.name || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Competência</p>
                <p className="font-medium">{formatCompetence(contribution.competence_month, contribution.competence_year)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Valor</p>
                <p className="font-semibold text-lg">{formatCurrency(contribution.value)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Vencimento</p>
                <p className="font-medium">{format(new Date(contribution.due_date + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })}</p>
              </div>
            </div>

            {/* Lytex Info */}
            {contribution.lytex_invoice_url && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg space-y-3">
                <p className="text-sm font-medium text-blue-700 dark:text-blue-400 flex items-center gap-2">
                  <ExternalLink className="h-4 w-4" />
                  Boleto Lytex
                </p>

                {contribution.lytex_boleto_digitable_line && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Linha Digitável</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs bg-background p-2 rounded overflow-x-auto">
                        {contribution.lytex_boleto_digitable_line}
                      </code>
                      <Button
                        variant="outline"
                        size="icon"
                        className="shrink-0"
                        onClick={() => handleCopyToClipboard(contribution.lytex_boleto_digitable_line!, "Linha digitável")}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {contribution.lytex_pix_code && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">PIX Copia e Cola</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs bg-background p-2 rounded overflow-x-auto max-h-20">
                        {contribution.lytex_pix_code.slice(0, 50)}...
                      </code>
                      <Button
                        variant="outline"
                        size="icon"
                        className="shrink-0"
                        onClick={() => handleCopyToClipboard(contribution.lytex_pix_code!, "Código PIX")}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                <Button
                  className="w-full"
                  onClick={() => window.open(contribution.lytex_invoice_url!, "_blank")}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Abrir Boleto / Fatura
                </Button>
              </div>
            )}

            {/* Payment Confirmation */}
            {contribution.status === "paid" && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-medium">Pagamento Confirmado</span>
                </div>
                {contribution.paid_at && (
                  <p className="text-sm text-emerald-600 dark:text-emerald-500 mt-1">
                    Pago em {format(new Date(contribution.paid_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    {contribution.payment_method && ` via ${contribution.payment_method}`}
                  </p>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <DialogFooter className="flex-col sm:flex-row gap-2">
              {contribution.status !== "paid" && contribution.status !== "cancelled" && (
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
                    variant="destructive"
                    onClick={() => setCancelDialogOpen(true)}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Cancelar
                  </Button>
                </>
              )}
              {(!contribution.lytex_invoice_id || !contribution.lytex_invoice_url) && 
                contribution.status !== "cancelled" && 
                contribution.status !== "paid" && (
                <Button
                  onClick={() => onGenerateInvoice(contribution)}
                  disabled={generatingInvoice}
                  className="bg-primary hover:bg-primary/90"
                >
                  {generatingInvoice ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  {contribution.lytex_invoice_id ? "Reemitir Boleto" : "Gerar Boleto"}
                </Button>
              )}
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
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

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Contribuição</DialogTitle>
            <DialogDescription>
              {contribution?.lytex_invoice_id 
                ? "A alteração será sincronizada com o boleto na Lytex."
                : "Altere os dados da contribuição."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de Contribuição</Label>
              <Select value={editTypeId} onValueChange={setEditTypeId}>
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
                <Label>Mês Competência</Label>
                <Select value={String(editMonth)} onValueChange={(v) => setEditMonth(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => (
                      <SelectItem key={i} value={String(i + 1)}>
                        {String(i + 1).padStart(2, "0")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ano</Label>
                <Select value={String(editYear)} onValueChange={(v) => setEditYear(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getStaticYearRange().map(year => (
                      <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Valor (R$)</Label>
                <Input
                  placeholder="0,00"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Vencimento</Label>
                <Input
                  type="date"
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                />
              </div>
            </div>

            {/* Duplicate warning */}
            {(checkingDuplicate || hasDuplicate) && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg space-y-2">
                {checkingDuplicate ? (
                  <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Verificando duplicidade...</span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                      <AlertCircle className="h-5 w-5" />
                      <span className="font-medium text-sm">
                        Já existe contribuição para esta competência
                      </span>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <Checkbox 
                        id="force-duplicate"
                        checked={forceDuplicate}
                        onCheckedChange={(checked) => setForceDuplicate(checked as boolean)}
                      />
                      <Label htmlFor="force-duplicate" className="text-sm text-amber-600 dark:text-amber-500 cursor-pointer">
                        Forçar alteração (a duplicada será cancelada)
                      </Label>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleUpdateInvoice} 
              disabled={updating || checkingDuplicate || (hasDuplicate && !forceDuplicate)}
            >
              {updating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={(open) => {
        setDeleteDialogOpen(open);
        if (!open) setForceDeleteLocal(false);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Contribuição</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              {forceDeleteLocal ? (
                <>
                  <span className="block text-amber-600 dark:text-amber-500 font-medium">
                    ⚠️ O boleto foi criado há menos de 30 minutos e não pode ser cancelado na Lytex ainda.
                  </span>
                  <span className="block mt-2">
                    Ao forçar a exclusão local, a contribuição será removida do sistema, mas o boleto pode permanecer ativo na Lytex por alguns minutos.
                  </span>
                </>
              ) : (
                <>
                  <span>Tem certeza que deseja excluir esta contribuição permanentemente?</span>
                  {contribution?.lytex_invoice_id && (
                    <span className="block mt-2 text-amber-600 dark:text-amber-500 font-medium">
                      ⚠️ O boleto correspondente também será cancelado na Lytex.
                    </span>
                  )}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting} onClick={() => setForceDeleteLocal(false)}>
              Voltar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleDeleteContribution(forceDeleteLocal)}
              disabled={deleting}
              className={cn(
                "bg-destructive hover:bg-destructive/90",
                forceDeleteLocal && "bg-amber-600 hover:bg-amber-700"
              )}
            >
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {forceDeleteLocal ? "Forçar Exclusão Local" : "Confirmar Exclusão"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
