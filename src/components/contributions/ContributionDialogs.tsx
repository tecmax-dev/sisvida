import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Trash2,
} from "lucide-react";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  employers?: Employer;
  contribution_types?: ContributionType;
}

interface ContributionDialogsProps {
  // Create dialog
  createDialogOpen: boolean;
  onCreateDialogChange: (open: boolean) => void;
  employers: Employer[];
  contributionTypes: ContributionType[];
  clinicId: string;
  userId: string;
  onRefresh: () => void;
  // View dialog
  viewDialogOpen: boolean;
  onViewDialogChange: (open: boolean) => void;
  selectedContribution: Contribution | null;
  onGenerateInvoice: (contribution: Contribution) => void;
  generatingInvoice: boolean;
}

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export default function ContributionDialogs({
  createDialogOpen,
  onCreateDialogChange,
  employers,
  contributionTypes,
  clinicId,
  userId,
  onRefresh,
  viewDialogOpen,
  onViewDialogChange,
  selectedContribution,
  onGenerateInvoice,
  generatingInvoice,
}: ContributionDialogsProps) {
  // Create form states
  const [formEmployerId, setFormEmployerId] = useState("");
  const [formTypeId, setFormTypeId] = useState("");
  const [formMonth, setFormMonth] = useState(new Date().getMonth() + 1);
  const [formYear, setFormYear] = useState(new Date().getFullYear());
  const [formValue, setFormValue] = useState("");
  const [formDueDate, setFormDueDate] = useState(format(addDays(new Date(), 10), "yyyy-MM-dd"));
  const [formNotes, setFormNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Cancel dialog
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  
  // Edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [updating, setUpdating] = useState(false);
  
  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(cents / 100);
  };

  const resetCreateForm = () => {
    setFormEmployerId("");
    setFormTypeId("");
    setFormMonth(new Date().getMonth() + 1);
    setFormYear(new Date().getFullYear());
    setFormValue("");
    setFormDueDate(format(addDays(new Date(), 10), "yyyy-MM-dd"));
    setFormNotes("");
  };

  const handleTypeChange = (typeId: string) => {
    setFormTypeId(typeId);
    const type = contributionTypes.find(t => t.id === typeId);
    if (type && type.default_value > 0) {
      setFormValue((type.default_value / 100).toFixed(2).replace(".", ","));
    }
  };

  const handleSaveContribution = async () => {
    if (!formEmployerId || !formTypeId || !formValue || !formDueDate) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    setSaving(true);
    try {
      const valueInCents = Math.round(parseFloat(formValue.replace(",", ".")) * 100);

      const { data: newContribution, error } = await supabase
        .from("employer_contributions")
        .insert({
          clinic_id: clinicId,
          employer_id: formEmployerId,
          contribution_type_id: formTypeId,
          competence_month: formMonth,
          competence_year: formYear,
          value: valueInCents,
          due_date: formDueDate,
          notes: formNotes || null,
          created_by: userId,
        })
        .select(`
          *,
          employers (*),
          contribution_types (*)
        `)
        .single();

      if (error) {
        if (error.message.includes("unique_active_contribution_per_employer")) {
          toast.error("Já existe uma contribuição ativa deste tipo para esta competência");
          return;
        }
        throw error;
      }

      toast.success("Contribuição criada! Gerando boleto...");
      onCreateDialogChange(false);
      resetCreateForm();
      onRefresh();

      // Gerar boleto automaticamente
      if (newContribution) {
        try {
          await onGenerateInvoice(newContribution as Contribution);
        } catch (invoiceError) {
          console.error("Error generating invoice:", invoiceError);
          // O erro já será tratado pela função onGenerateInvoice
        }
      }
    } catch (error) {
      console.error("Error saving contribution:", error);
      toast.error("Erro ao salvar contribuição");
    } finally {
      setSaving(false);
    }
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
      setCancelDialogOpen(false);
      onViewDialogChange(false);
      onRefresh();
    } catch (error) {
      console.error("Error cancelling:", error);
      toast.error("Erro ao cancelar contribuição");
    }
  };

  const handleOpenEditDialog = () => {
    if (!selectedContribution) return;
    setEditValue((selectedContribution.value / 100).toFixed(2).replace(".", ","));
    setEditDueDate(selectedContribution.due_date);
    setEditDialogOpen(true);
  };

  const handleUpdateInvoice = async () => {
    if (!selectedContribution) return;
    
    setUpdating(true);
    try {
      const newValueCents = Math.round(parseFloat(editValue.replace(",", ".")) * 100);
      
      if (selectedContribution.lytex_invoice_id) {
        // Atualizar na Lytex e no banco
        const { error } = await supabase.functions.invoke("lytex-api", {
          body: {
            action: "update_invoice",
            invoiceId: selectedContribution.lytex_invoice_id,
            contributionId: selectedContribution.id,
            value: newValueCents,
            dueDate: editDueDate,
          },
        });

        if (error) throw error;
      } else {
        // Só atualizar no banco
        const { error } = await supabase
          .from("employer_contributions")
          .update({
            value: newValueCents,
            due_date: editDueDate,
          })
          .eq("id", selectedContribution.id);

        if (error) throw error;
      }

      toast.success("Contribuição atualizada com sucesso");
      setEditDialogOpen(false);
      onViewDialogChange(false);
      onRefresh();
    } catch (error: any) {
      console.error("Error updating:", error);
      toast.error(error.message || "Erro ao atualizar contribuição");
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

      toast.success("Contribuição excluída com sucesso");
      setDeleteDialogOpen(false);
      onViewDialogChange(false);
      onRefresh();
    } catch (error: any) {
      console.error("Error deleting:", error);
      toast.error(error.message || "Erro ao excluir contribuição");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={(open) => {
        onCreateDialogChange(open);
        if (!open) resetCreateForm();
      }}>
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
                    {[2024, 2025, 2026, 2027].map(year => (
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
            <Button variant="outline" onClick={() => onCreateDialogChange(false)}>
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
      <Dialog open={viewDialogOpen} onOpenChange={onViewDialogChange}>
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

              <DialogFooter className="flex-col sm:flex-row gap-2">
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
                      variant="destructive"
                      onClick={() => setCancelDialogOpen(true)}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Cancelar
                    </Button>
                  </>
                )}
                {!selectedContribution.lytex_invoice_id && selectedContribution.status !== "cancelled" && (
                  <Button
                    onClick={() => onGenerateInvoice(selectedContribution)}
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

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateInvoice} disabled={updating}>
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
    </>
  );
}
