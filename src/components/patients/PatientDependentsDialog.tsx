import { useState, useEffect } from "react";
import { Users, UserX, Trash2, Loader2, Calendar, CreditCard, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { format, parseISO, differenceInYears, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

interface Dependent {
  id: string;
  name: string;
  cpf: string | null;
  birth_date: string | null;
  relationship: string | null;
  card_number: string | null;
  card_expires_at: string | null;
  is_active: boolean;
}

interface PatientDependentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  patientName: string;
}

const RELATIONSHIPS: Record<string, string> = {
  filho: "Filho(a)",
  conjuge: "Cônjuge",
  pai: "Pai",
  mae: "Mãe",
  irmao: "Irmão(ã)",
  neto: "Neto(a)",
  sobrinho: "Sobrinho(a)",
  outro: "Outro",
};

const formatCPF = (value: string): string => {
  const cleaned = value.replace(/\D/g, '');
  return cleaned
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})/, '$1-$2')
    .substring(0, 14);
};

export function PatientDependentsDialog({
  open,
  onOpenChange,
  patientId,
  patientName,
}: PatientDependentsDialogProps) {
  const { userRoles, isSuperAdmin } = useAuth();
  const canPermanentDelete = isSuperAdmin || userRoles.some((r) => r.role === "owner" || r.role === "admin");
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [dependents, setDependents] = useState<Dependent[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [dependentToDelete, setDependentToDelete] = useState<Dependent | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchDependents = async () => {
    if (!patientId) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("patient_dependents")
        .select("id, name, cpf, birth_date, relationship, card_number, card_expires_at, is_active")
        .eq("patient_id", patientId)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setDependents(data || []);
    } catch (error) {
      console.error("Error fetching dependents:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dependentes.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && patientId) {
      fetchDependents();
    }
  }, [open, patientId]);

  const getAge = (birthDate: string | null) => {
    if (!birthDate) return null;
    return differenceInYears(new Date(), parseISO(birthDate));
  };

  const isCardExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return isBefore(parseISO(expiresAt), new Date());
  };

  const handleInactivate = async () => {
    if (!dependentToDelete) return;
    setIsDeleting(true);

    try {
      const { error } = await supabase
        .from("patient_dependents")
        .update({ is_active: false })
        .eq("id", dependentToDelete.id);

      if (error) throw error;

      toast({
        title: "Dependente inativado",
        description: `${dependentToDelete.name} foi inativado com sucesso.`,
      });

      setDeleteDialogOpen(false);
      setDependentToDelete(null);
      fetchDependents();
    } catch (error) {
      console.error("Error inactivating dependent:", error);
      toast({
        title: "Erro",
        description: "Não foi possível inativar o dependente.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePermanentDelete = async () => {
    if (!dependentToDelete) return;
    setIsDeleting(true);

    try {
      const { error } = await supabase
        .from("patient_dependents")
        .delete()
        .eq("id", dependentToDelete.id);

      if (error) throw error;

      toast({
        title: "Dependente excluído",
        description: `${dependentToDelete.name} foi excluído permanentemente.`,
      });

      setDeleteDialogOpen(false);
      setDependentToDelete(null);
      fetchDependents();
    } catch (error) {
      console.error("Error deleting dependent:", error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir o dependente.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditDependent = (dependent: Dependent) => {
    onOpenChange(false);
    navigate(`/dashboard/patients/${patientId}/edit?tab=cadastro&dependentes=true&editDependent=${dependent.id}`);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Dependentes de {patientName}
            </DialogTitle>
            <DialogDescription>
              Gerencie os dependentes deste associado titular.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 mt-4">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                Carregando dependentes...
              </div>
            ) : dependents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p>Nenhum dependente ativo.</p>
                <Button 
                  variant="outline" 
                  className="mt-3"
                  onClick={() => {
                    onOpenChange(false);
                    navigate(`/dashboard/patients/${patientId}/edit?tab=cadastro&dependentes=true`);
                  }}
                >
                  Adicionar Dependente
                </Button>
              </div>
            ) : (
              dependents.map((dependent) => {
                const age = getAge(dependent.birth_date);
                const expired = isCardExpired(dependent.card_expires_at);

                return (
                  <div
                    key={dependent.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">{dependent.name}</span>
                        {dependent.relationship && (
                          <Badge variant="outline" className="text-xs">
                            {RELATIONSHIPS[dependent.relationship] || dependent.relationship}
                          </Badge>
                        )}
                        {expired && (
                          <Badge variant="destructive" className="text-xs">Vencida</Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                        {dependent.cpf && (
                          <span>CPF: {formatCPF(dependent.cpf)}</span>
                        )}
                        {dependent.birth_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(parseISO(dependent.birth_date), "dd/MM/yyyy", { locale: ptBR })}
                            {age !== null && ` (${age} anos)`}
                          </span>
                        )}
                        {dependent.card_number && (
                          <span className="flex items-center gap-1">
                            <CreditCard className="h-3 w-3" />
                            {dependent.card_number}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 ml-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEditDependent(dependent)}
                        title="Editar"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => {
                          setDependentToDelete(dependent);
                          setDeleteDialogOpen(true);
                        }}
                        title={canPermanentDelete ? "Remover dependente" : "Inativar dependente"}
                      >
                        {canPermanentDelete ? (
                          <Trash2 className="h-4 w-4" />
                        ) : (
                          <UserX className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {dependents.length > 0 && (
            <div className="flex justify-end mt-4 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                  navigate(`/dashboard/patients/${patientId}/edit?tab=cadastro&dependentes=true`);
                }}
              >
                Adicionar Dependente
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {canPermanentDelete ? "Remover dependente?" : "Inativar dependente?"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                {canPermanentDelete ? (
                  <>
                    <p>
                      O que deseja fazer com <strong>{dependentToDelete?.name}</strong>?
                    </p>
                    <p>
                      <strong>Inativar:</strong> O dependente não aparecerá mais nas listagens, mas poderá ser reativado posteriormente.
                    </p>
                    <p>
                      <strong>Excluir permanentemente:</strong> Remove todos os dados do dependente. Esta ação não pode ser desfeita.
                    </p>
                  </>
                ) : (
                  <>
                    <p>
                      Tem certeza que deseja inativar <strong>{dependentToDelete?.name}</strong>?
                    </p>
                    <p>O dependente não aparecerá mais nas listagens, mas poderá ser reativado posteriormente.</p>
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>

            <Button variant="outline" onClick={handleInactivate} disabled={isDeleting}>
              {isDeleting ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <UserX className="h-4 w-4 mr-1" />
              )}
              Inativar
            </Button>

            {canPermanentDelete && (
              <Button variant="destructive" onClick={handlePermanentDelete} disabled={isDeleting}>
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-1" />
                )}
                Excluir Permanentemente
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
