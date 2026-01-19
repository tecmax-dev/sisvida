import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Plus, Loader2, Pencil, Trash2, FileText, ArrowUp, ArrowDown } from "lucide-react";

interface CctCategory {
  id: string;
  name: string;
  description: string | null;
  color: string;
  order_index: number;
  is_active: boolean;
}

export function CctCategoriesManagement() {
  const { currentClinic } = useAuth();
  const { toast } = useToast();
  
  const [categories, setCategories] = useState<CctCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CctCategory | null>(null);
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    color: "#0d9488",
    is_active: true,
  });

  const loadCategories = async () => {
    if (!currentClinic?.id) return;
    
    try {
      const { data, error } = await supabase
        .from("union_cct_categories")
        .select("*")
        .eq("clinic_id", currentClinic.id)
        .order("order_index");

      if (error) throw error;
      setCategories(data || []);
    } catch (err) {
      console.error("Error loading CCT categories:", err);
      toast({
        title: "Erro",
        description: "Erro ao carregar categorias CCT",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, [currentClinic?.id]);

  const handleOpenCreate = () => {
    setEditingCategory(null);
    setFormData({
      name: "",
      description: "",
      color: "#0d9488",
      is_active: true,
    });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (category: CctCategory) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || "",
      color: category.color,
      is_active: category.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim() || !currentClinic?.id) return;

    setSaving(true);
    try {
      if (editingCategory) {
        const { error } = await supabase
          .from("union_cct_categories")
          .update({
            name: formData.name,
            description: formData.description || null,
            color: formData.color,
            is_active: formData.is_active,
          })
          .eq("id", editingCategory.id);

        if (error) throw error;
        toast({
          title: "Sucesso",
          description: "Categoria atualizada com sucesso!",
        });
      } else {
        const { error } = await supabase
          .from("union_cct_categories")
          .insert({
            name: formData.name,
            description: formData.description || null,
            color: formData.color,
            is_active: formData.is_active,
            order_index: categories.length,
            clinic_id: currentClinic.id,
          });

        if (error) throw error;
        toast({
          title: "Sucesso",
          description: "Categoria criada com sucesso!",
        });
      }

      setIsDialogOpen(false);
      loadCategories();
    } catch (err) {
      console.error("Error saving category:", err);
      toast({
        title: "Erro",
        description: "Erro ao salvar categoria",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingCategoryId) return;

    try {
      const { error } = await supabase
        .from("union_cct_categories")
        .delete()
        .eq("id", deletingCategoryId);

      if (error) throw error;
      
      toast({
        title: "Sucesso",
        description: "Categoria excluída com sucesso!",
      });
      setIsDeleteDialogOpen(false);
      setDeletingCategoryId(null);
      loadCategories();
    } catch (err) {
      console.error("Error deleting category:", err);
      toast({
        title: "Erro",
        description: "Erro ao excluir categoria",
        variant: "destructive",
      });
    }
  };

  const handleMoveUp = async (category: CctCategory, index: number) => {
    if (index === 0) return;
    const prevCategory = categories[index - 1];
    
    await supabase
      .from("union_cct_categories")
      .update({ order_index: prevCategory.order_index })
      .eq("id", category.id);
      
    await supabase
      .from("union_cct_categories")
      .update({ order_index: category.order_index })
      .eq("id", prevCategory.id);
      
    loadCategories();
  };

  const handleMoveDown = async (category: CctCategory, index: number) => {
    if (index === categories.length - 1) return;
    const nextCategory = categories[index + 1];
    
    await supabase
      .from("union_cct_categories")
      .update({ order_index: nextCategory.order_index })
      .eq("id", category.id);
      
    await supabase
      .from("union_cct_categories")
      .update({ order_index: category.order_index })
      .eq("id", nextCategory.id);
      
    loadCategories();
  };

  const handleToggleActive = async (category: CctCategory) => {
    await supabase
      .from("union_cct_categories")
      .update({ is_active: !category.is_active })
      .eq("id", category.id);
    loadCategories();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                <FileText className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <CardTitle className="text-lg">Categorias CCT (Abas no App)</CardTitle>
                <CardDescription>
                  Organize as Convenções Coletivas em abas no aplicativo mobile
                </CardDescription>
              </div>
            </div>
            <Button onClick={handleOpenCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Categoria
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                Nenhuma categoria CCT cadastrada.
              </p>
              <Button onClick={handleOpenCreate} variant="outline" size="sm" className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar primeira categoria
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {categories.map((category, index) => (
                <div
                  key={category.id}
                  className={`flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border dark:border-slate-700 ${
                    !category.is_active ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: category.color }}
                    />
                    <div>
                      <p className="font-medium">{category.name}</p>
                      {category.description && (
                        <p className="text-xs text-muted-foreground">{category.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={category.is_active ? "default" : "secondary"}>
                      {category.is_active ? "Ativo" : "Inativo"}
                    </Badge>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleMoveUp(category, index)}
                      disabled={index === 0}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleMoveDown(category, index)}
                      disabled={index === categories.length - 1}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Switch
                      checked={category.is_active}
                      onCheckedChange={() => handleToggleActive(category)}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleOpenEdit(category)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => {
                        setDeletingCategoryId(category.id);
                        setIsDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? "Editar Categoria" : "Nova Categoria CCT"}
            </DialogTitle>
            <DialogDescription>
              Estas categorias organizam as CCTs em abas no aplicativo mobile.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome da Categoria *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Comércio Ilhéus"
              />
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Descrição opcional..."
              />
            </div>

            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex items-center gap-3">
                <Input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                  className="w-20 h-10 p-1"
                />
                <span className="text-sm text-muted-foreground">{formData.color}</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label>Status</Label>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                />
                <span className="text-sm">
                  {formData.is_active ? "Ativo" : "Inativo"}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={saving || !formData.name.trim()}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {editingCategory ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir categoria?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. As CCTs associadas a esta categoria ficarão sem categoria.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}