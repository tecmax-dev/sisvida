import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  Settings,
  Trash2,
  Plus,
  Edit,
  Loader2,
  Tag,
  DollarSign,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ContributionType {
  id: string;
  name: string;
  description: string | null;
  default_value: number;
  is_active: boolean;
}

interface ContributionTypesTabProps {
  contributionTypes: ContributionType[];
  clinicId: string;
  onRefresh: () => void;
}

export default function ContributionTypesTab({
  contributionTypes,
  clinicId,
  onRefresh,
}: ContributionTypesTabProps) {
  const [typeFormName, setTypeFormName] = useState("");
  const [typeFormDescription, setTypeFormDescription] = useState("");
  const [typeFormValue, setTypeFormValue] = useState("");
  const [editingType, setEditingType] = useState<ContributionType | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [typeToDelete, setTypeToDelete] = useState<ContributionType | null>(null);
  const [saving, setSaving] = useState(false);

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(cents / 100);
  };

  const resetForm = () => {
    setTypeFormName("");
    setTypeFormDescription("");
    setTypeFormValue("");
    setEditingType(null);
  };

  const handleEditType = (type: ContributionType) => {
    setEditingType(type);
    setTypeFormName(type.name);
    setTypeFormDescription(type.description || "");
    setTypeFormValue(type.default_value ? (type.default_value / 100).toFixed(2).replace(".", ",") : "");
  };

  const handleSaveType = async () => {
    if (!typeFormName.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    setSaving(true);
    try {
      const valueInCents = typeFormValue 
        ? Math.round(parseFloat(typeFormValue.replace(",", ".")) * 100) 
        : 0;

      if (editingType) {
        const { error } = await supabase
          .from("contribution_types")
          .update({
            name: typeFormName.trim(),
            description: typeFormDescription.trim() || null,
            default_value: valueInCents,
          })
          .eq("id", editingType.id);

        if (error) throw error;
        toast.success("Tipo atualizado com sucesso");
      } else {
        const { error } = await supabase
          .from("contribution_types")
          .insert({
            clinic_id: clinicId,
            name: typeFormName.trim(),
            description: typeFormDescription.trim() || null,
            default_value: valueInCents,
          });

        if (error) throw error;
        toast.success("Tipo criado com sucesso");
      }

      resetForm();
      onRefresh();
    } catch (error) {
      console.error("Error saving type:", error);
      toast.error("Erro ao salvar tipo");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteType = async () => {
    if (!typeToDelete) return;

    try {
      const { error } = await supabase
        .from("contribution_types")
        .update({ is_active: false })
        .eq("id", typeToDelete.id);

      if (error) throw error;
      toast.success("Tipo desativado com sucesso");
      setDeleteDialogOpen(false);
      setTypeToDelete(null);
      onRefresh();
    } catch (error) {
      console.error("Error deleting type:", error);
      toast.error("Erro ao desativar tipo");
    }
  };

  const handleReactivateType = async (typeId: string) => {
    try {
      const { error } = await supabase
        .from("contribution_types")
        .update({ is_active: true })
        .eq("id", typeId);

      if (error) throw error;
      toast.success("Tipo reativado com sucesso");
      onRefresh();
    } catch (error) {
      console.error("Error reactivating type:", error);
      toast.error("Erro ao reativar tipo");
    }
  };

  const activeTypes = contributionTypes.filter(t => t.is_active);
  const inactiveTypes = contributionTypes.filter(t => !t.is_active);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Form */}
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            {editingType ? <Edit className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {editingType ? "Editar Tipo" : "Novo Tipo"}
          </CardTitle>
          <CardDescription>
            {editingType 
              ? "Atualize as informações do tipo de contribuição"
              : "Cadastre um novo tipo de contribuição"
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="typeName">Nome *</Label>
            <Input
              id="typeName"
              placeholder="Ex: Mensalidade Sindical"
              value={typeFormName}
              onChange={(e) => setTypeFormName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="typeDescription">Descrição</Label>
            <Textarea
              id="typeDescription"
              placeholder="Descrição opcional do tipo de contribuição"
              value={typeFormDescription}
              onChange={(e) => setTypeFormDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="typeValue">Valor Padrão (R$)</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="typeValue"
                placeholder="0,00"
                value={typeFormValue}
                onChange={(e) => setTypeFormValue(e.target.value)}
                className="pl-9"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Este valor será sugerido ao criar novas contribuições
            </p>
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={handleSaveType} 
              disabled={saving}
              className="flex-1"
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingType ? "Atualizar" : "Criar"} Tipo
            </Button>
            {editingType && (
              <Button variant="outline" onClick={resetForm}>
                Cancelar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Active Types List */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Tag className="h-4 w-4" />
            Tipos de Contribuição
          </CardTitle>
          <CardDescription>
            {activeTypes.length} tipo{activeTypes.length !== 1 ? "s" : ""} ativo{activeTypes.length !== 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {activeTypes.length > 0 ? (
              activeTypes.map((type) => (
                <div
                  key={type.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{type.name}</p>
                      <Badge variant="secondary" className="text-xs">Ativo</Badge>
                    </div>
                    {type.description && (
                      <p className="text-sm text-muted-foreground">{type.description}</p>
                    )}
                    {type.default_value > 0 && (
                      <p className="text-sm font-medium text-primary">
                        Valor padrão: {formatCurrency(type.default_value)}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEditType(type)}
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        setTypeToDelete(type);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Tag className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Nenhum tipo cadastrado</p>
                <p className="text-sm">Crie seu primeiro tipo de contribuição</p>
              </div>
            )}
          </div>

          {/* Inactive Types */}
          {inactiveTypes.length > 0 && (
            <div className="mt-6 pt-6 border-t">
              <h4 className="text-sm font-medium text-muted-foreground mb-3">
                Tipos Inativos ({inactiveTypes.length})
              </h4>
              <div className="space-y-2">
                {inactiveTypes.map((type) => (
                  <div
                    key={type.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-dashed opacity-60"
                  >
                    <div>
                      <p className="font-medium text-sm">{type.name}</p>
                      {type.default_value > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(type.default_value)}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleReactivateType(type.id)}
                    >
                      Reativar
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar Tipo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja desativar o tipo "{typeToDelete?.name}"? 
              Ele não estará mais disponível para novas contribuições, mas as contribuições 
              existentes serão mantidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteType}
              className="bg-destructive hover:bg-destructive/90"
            >
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
