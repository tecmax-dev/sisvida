import { useState, useEffect } from "react";
import { Users, Plus, Edit2, Save, X, CreditCard, Calendar, User, Phone, UserX, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { format, parseISO, differenceInYears, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";
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
import { CpfInputCard } from "@/components/ui/cpf-input-card";

interface Dependent {
  id: string;
  name: string;
  cpf: string | null;
  birth_date: string | null;
  relationship: string | null;
  card_number: string | null;
  card_expires_at: string | null;
  notes: string | null;
  is_active: boolean;
}

interface DependentsPanelProps {
  patientId: string;
  clinicId: string;
  patientPhone?: string;
  autoOpenForm?: boolean;
}

const RELATIONSHIPS = [
  { value: "filho", label: "Filho(a)" },
  { value: "conjuge", label: "Cônjuge" },
  { value: "pai", label: "Pai" },
  { value: "mae", label: "Mãe" },
  { value: "irmao", label: "Irmão(ã)" },
  { value: "neto", label: "Neto(a)" },
  { value: "sobrinho", label: "Sobrinho(a)" },
  { value: "outro", label: "Outro" },
];

const formatCPF = (value: string): string => {
  const cleaned = value.replace(/\D/g, '');
  return cleaned
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})/, '$1-$2')
    .substring(0, 14);
};

export function DependentsPanel({ patientId, clinicId, patientPhone, autoOpenForm = false }: DependentsPanelProps) {
  const { userRoles, isSuperAdmin } = useAuth();
  const canPermanentDelete = isSuperAdmin || userRoles.some((r) => r.role === "owner" || r.role === "admin");

  const [dependents, setDependents] = useState<Dependent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [dependentToDelete, setDependentToDelete] = useState<Dependent | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [hasCheckedAutoOpen, setHasCheckedAutoOpen] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: "",
    cpf: "",
    birth_date: "",
    relationship: "",
    card_number: "",
    card_expires_at: "",
    notes: "",
  });

  const fetchDependents = async () => {
    try {
      const { data, error } = await supabase
        .from("patient_dependents")
        .select("*")
        .eq("patient_id", patientId)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setDependents(data || []);
      
      // Auto-open form if requested and no dependents exist
      if (autoOpenForm && !hasCheckedAutoOpen) {
        setHasCheckedAutoOpen(true);
        if (!data || data.length === 0) {
          setIsAdding(true);
        }
      }
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
    if (patientId) {
      fetchDependents();
    }
  }, [patientId]);

  const resetForm = () => {
    setFormData({
      name: "",
      cpf: "",
      birth_date: "",
      relationship: "",
      card_number: "",
      card_expires_at: "",
      notes: "",
    });
    setIsAdding(false);
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Campo obrigatório",
        description: "Por favor, informe o nome do dependente.",
        variant: "destructive",
      });
      return;
    }

    try {
      const payload = {
        clinic_id: clinicId,
        patient_id: patientId,
        name: formData.name.trim(),
        cpf: formData.cpf.replace(/\D/g, '') || null,
        birth_date: formData.birth_date || null,
        relationship: formData.relationship || null,
        card_number: formData.card_number || null,
        card_expires_at: formData.card_expires_at ? new Date(formData.card_expires_at).toISOString() : null,
        notes: formData.notes || null,
      };

      if (editingId) {
        const { error } = await supabase
          .from("patient_dependents")
          .update(payload)
          .eq("id", editingId);

        if (error) throw error;
        toast({
          title: "Sucesso!",
          description: "Dependente atualizado com sucesso.",
        });
      } else {
        const { error } = await supabase
          .from("patient_dependents")
          .insert(payload);

        if (error) {
          if (error.message.includes("unique")) {
            toast({
              title: "CPF já cadastrado",
              description: "Este CPF já está vinculado a outro dependente.",
              variant: "destructive",
            });
            return;
          }
          throw error;
        }
        toast({
          title: "Sucesso!",
          description: "Dependente adicionado com sucesso.",
        });
      }

      resetForm();
      fetchDependents();
    } catch (error) {
      console.error("Error saving dependent:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar o dependente.",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (dependent: Dependent) => {
    setFormData({
      name: dependent.name,
      cpf: dependent.cpf ? formatCPF(dependent.cpf) : "",
      birth_date: dependent.birth_date || "",
      relationship: dependent.relationship || "",
      card_number: dependent.card_number || "",
      card_expires_at: dependent.card_expires_at ? dependent.card_expires_at.split("T")[0] : "",
      notes: dependent.notes || "",
    });
    setEditingId(dependent.id);
    setIsAdding(true);
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

  const getAge = (birthDate: string | null) => {
    if (!birthDate) return null;
    return differenceInYears(new Date(), parseISO(birthDate));
  };

  const isCardExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return isBefore(parseISO(expiresAt), new Date());
  };

  const getRelationshipLabel = (value: string | null) => {
    if (!value) return null;
    return RELATIONSHIPS.find(r => r.value === value)?.label || value;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Carregando dependentes...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Dependentes</h3>
          <Badge variant="secondary">{dependents.length}</Badge>
        </div>
        {!isAdding && (
          <Button onClick={() => setIsAdding(true)} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Adicionar Dependente
          </Button>
        )}
      </div>

      {/* Formulário de adição/edição */}
      {isAdding && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4" />
              {editingId ? "Editar Dependente" : "Novo Dependente"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dep-name">Nome Completo *</Label>
                <Input
                  id="dep-name"
                  placeholder="Nome do dependente"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="md:col-span-2">
                <CpfInputCard
                  value={formData.cpf}
                  onChange={(value) => setFormData({ ...formData, cpf: value })}
                  showValidation
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dep-birth">Data de Nascimento</Label>
                <Input
                  id="dep-birth"
                  type="date"
                  value={formData.birth_date}
                  onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dep-relationship">Parentesco</Label>
                <Select
                  value={formData.relationship}
                  onValueChange={(value) => setFormData({ ...formData, relationship: value })}
                >
                  <SelectTrigger id="dep-relationship">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {RELATIONSHIPS.map((rel) => (
                      <SelectItem key={rel.value} value={rel.value}>
                        {rel.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dep-card">Nº Carteirinha</Label>
                <Input
                  id="dep-card"
                  placeholder="Número da carteirinha"
                  value={formData.card_number}
                  onChange={(e) => setFormData({ ...formData, card_number: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dep-card-expires">Validade da Carteirinha</Label>
                <Input
                  id="dep-card-expires"
                  type="date"
                  value={formData.card_expires_at}
                  onChange={(e) => setFormData({ ...formData, card_expires_at: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dep-notes">Observações</Label>
              <Textarea
                id="dep-notes"
                placeholder="Informações adicionais sobre o dependente..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
              />
            </div>

            {patientPhone && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                <Phone className="h-4 w-4" />
                <span>WhatsApp do titular: <strong>{patientPhone}</strong></span>
              </div>
            )}

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={resetForm}>
                <X className="h-4 w-4 mr-1" />
                Cancelar
              </Button>
              <Button onClick={handleSave}>
                <Save className="h-4 w-4 mr-1" />
                {editingId ? "Atualizar" : "Salvar"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de dependentes */}
      {dependents.length === 0 && !isAdding ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground mb-4">
              Nenhum dependente cadastrado ainda.
            </p>
            <Button variant="outline" onClick={() => setIsAdding(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Adicionar Primeiro Dependente
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {dependents.map((dependent) => {
            const age = getAge(dependent.birth_date);
            const expired = isCardExpired(dependent.card_expires_at);

            return (
              <Card key={dependent.id} className="hover:shadow-md transition-shadow">
                <CardContent className="py-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold text-lg">{dependent.name}</h4>
                        {dependent.relationship && (
                          <Badge variant="outline">
                            {getRelationshipLabel(dependent.relationship)}
                          </Badge>
                        )}
                        {expired && (
                          <Badge variant="destructive">Carteirinha Vencida</Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
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
                        {dependent.card_expires_at && (
                          <span className={expired ? "text-destructive font-medium" : ""}>
                            Validade: {format(parseISO(dependent.card_expires_at), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                        )}
                      </div>

                      {dependent.notes && (
                        <p className="text-sm text-muted-foreground italic">
                          {dependent.notes}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-1 ml-4">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(dependent)}
                        title="Editar"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDependentToDelete(dependent);
                          setDeleteDialogOpen(true);
                        }}
                        title={canPermanentDelete ? "Excluir dependente" : "Inativar dependente"}
                      >
                        {canPermanentDelete ? (
                          <Trash2 className="h-4 w-4" />
                        ) : (
                          <UserX className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog de confirmação de exclusão */}
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
    </div>
  );
}
