import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Loader2,
  Pencil,
  Trash2,
  FolderOpen,
  Handshake,
  Heart,
  GraduationCap,
  Car,
  Home,
  ShoppingBag,
  Utensils,
  Dumbbell,
  Plane,
  Briefcase,
  Music,
  Camera,
  Wifi,
  Phone,
  MapPin,
  Star,
  Gift,
  Percent,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ConvenioCategory {
  id: string;
  clinic_id: string;
  nome: string;
  icon: string | null;
  color: string | null;
  order_index: number;
  is_active: boolean;
  created_at: string;
}

interface Convenio {
  id: string;
  clinic_id: string;
  category_id: string | null;
  categoria: string | null;
  nome: string;
  descricao: string | null;
  endereco: string | null;
  telefone: string | null;
  desconto: string | null;
  order_index: number;
  is_active: boolean;
  created_at: string;
}

const AVAILABLE_ICONS = [
  { name: "Heart", icon: Heart, label: "Saúde" },
  { name: "GraduationCap", icon: GraduationCap, label: "Educação" },
  { name: "Car", icon: Car, label: "Veículos" },
  { name: "Home", icon: Home, label: "Casa" },
  { name: "ShoppingBag", icon: ShoppingBag, label: "Compras" },
  { name: "Utensils", icon: Utensils, label: "Alimentação" },
  { name: "Dumbbell", icon: Dumbbell, label: "Fitness" },
  { name: "Plane", icon: Plane, label: "Viagens" },
  { name: "Briefcase", icon: Briefcase, label: "Serviços" },
  { name: "Music", icon: Music, label: "Entretenimento" },
  { name: "Camera", icon: Camera, label: "Fotografia" },
  { name: "Wifi", icon: Wifi, label: "Internet" },
  { name: "Phone", icon: Phone, label: "Telefonia" },
  { name: "MapPin", icon: MapPin, label: "Localização" },
  { name: "Star", icon: Star, label: "Premium" },
  { name: "Gift", icon: Gift, label: "Presentes" },
  { name: "Percent", icon: Percent, label: "Descontos" },
  { name: "Handshake", icon: Handshake, label: "Parcerias" },
];

const PRESET_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308",
  "#84cc16", "#22c55e", "#10b981", "#14b8a6",
  "#06b6d4", "#0ea5e9", "#3b82f6", "#6366f1",
  "#8b5cf6", "#a855f7", "#d946ef", "#ec4899",
];

const getIconComponent = (iconName: string | null) => {
  const found = AVAILABLE_ICONS.find(i => i.name === iconName);
  return found ? found.icon : Handshake;
};

export function ConveniosManagementTab() {
  const { currentClinic } = useAuth();
  const { toast } = useToast();

  const [activeSubTab, setActiveSubTab] = useState<"convenios" | "categorias">("convenios");
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<ConvenioCategory[]>([]);
  const [convenios, setConvenios] = useState<Convenio[]>([]);

  // Category dialog state
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ConvenioCategory | null>(null);
  const [categoryForm, setCategoryForm] = useState({
    nome: "",
    icon: "Heart",
    color: "#3b82f6",
    is_active: true,
  });

  // Convenio dialog state
  const [isConvenioDialogOpen, setIsConvenioDialogOpen] = useState(false);
  const [editingConvenio, setEditingConvenio] = useState<Convenio | null>(null);
  const [convenioForm, setConvenioForm] = useState({
    nome: "",
    descricao: "",
    category_id: "",
    desconto: "",
    telefone: "",
    endereco: "",
    is_active: true,
  });

  // Delete dialog state
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; type: "category" | "convenio"; id: string | null }>({
    open: false,
    type: "category",
    id: null,
  });

  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    if (!currentClinic?.id) return;

    try {
      setLoading(true);

      const [catResult, convResult] = await Promise.all([
        supabase
          .from("union_convenio_categories")
          .select("*")
          .eq("clinic_id", currentClinic.id)
          .order("order_index"),
        supabase
          .from("union_convenios")
          .select("*")
          .eq("clinic_id", currentClinic.id)
          .order("order_index"),
      ]);

      if (catResult.data) setCategories(catResult.data);
      if (convResult.data) setConvenios(convResult.data);
    } catch (error) {
      console.error("Error fetching convenios data:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados de convênios",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentClinic?.id]);

  // Category handlers
  const handleOpenCategoryCreate = () => {
    setEditingCategory(null);
    setCategoryForm({
      nome: "",
      icon: "Heart",
      color: "#3b82f6",
      is_active: true,
    });
    setIsCategoryDialogOpen(true);
  };

  const handleOpenCategoryEdit = (category: ConvenioCategory) => {
    setEditingCategory(category);
    setCategoryForm({
      nome: category.nome,
      icon: category.icon || "Heart",
      color: category.color || "#3b82f6",
      is_active: category.is_active,
    });
    setIsCategoryDialogOpen(true);
  };

  const handleSaveCategory = async () => {
    if (!currentClinic?.id || !categoryForm.nome.trim()) return;

    setSaving(true);
    try {
      if (editingCategory) {
        const { error } = await supabase
          .from("union_convenio_categories")
          .update({
            nome: categoryForm.nome,
            icon: categoryForm.icon,
            color: categoryForm.color,
            is_active: categoryForm.is_active,
          })
          .eq("id", editingCategory.id);

        if (error) throw error;
        toast({ title: "Sucesso", description: "Categoria atualizada!" });
      } else {
        const { error } = await supabase
          .from("union_convenio_categories")
          .insert({
            clinic_id: currentClinic.id,
            nome: categoryForm.nome,
            icon: categoryForm.icon,
            color: categoryForm.color,
            order_index: categories.length,
            is_active: categoryForm.is_active,
          });

        if (error) throw error;
        toast({ title: "Sucesso", description: "Categoria criada!" });
      }

      setIsCategoryDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error("Error saving category:", error);
      toast({
        title: "Erro",
        description: "Erro ao salvar categoria",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCategory = async () => {
    if (!deleteDialog.id) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("union_convenio_categories")
        .delete()
        .eq("id", deleteDialog.id);

      if (error) throw error;
      toast({ title: "Sucesso", description: "Categoria excluída!" });
      setDeleteDialog({ open: false, type: "category", id: null });
      fetchData();
    } catch (error) {
      console.error("Error deleting category:", error);
      toast({
        title: "Erro",
        description: "Erro ao excluir categoria. Verifique se não há convênios vinculados.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Convenio handlers
  const handleOpenConvenioCreate = () => {
    setEditingConvenio(null);
    setConvenioForm({
      nome: "",
      descricao: "",
      category_id: categories[0]?.id || "",
      desconto: "",
      telefone: "",
      endereco: "",
      is_active: true,
    });
    setIsConvenioDialogOpen(true);
  };

  const handleOpenConvenioEdit = (convenio: Convenio) => {
    setEditingConvenio(convenio);
    setConvenioForm({
      nome: convenio.nome,
      descricao: convenio.descricao || "",
      category_id: convenio.category_id || "",
      desconto: convenio.desconto || "",
      telefone: convenio.telefone || "",
      endereco: convenio.endereco || "",
      is_active: convenio.is_active,
    });
    setIsConvenioDialogOpen(true);
  };

  const handleSaveConvenio = async () => {
    if (!currentClinic?.id || !convenioForm.nome.trim()) return;

    setSaving(true);
    try {
      // Get category name for the 'categoria' field
      const selectedCategory = categories.find(c => c.id === convenioForm.category_id);
      
      if (editingConvenio) {
        const { error } = await supabase
          .from("union_convenios")
          .update({
            nome: convenioForm.nome,
            descricao: convenioForm.descricao || null,
            category_id: convenioForm.category_id || null,
            categoria: selectedCategory?.nome || null,
            desconto: convenioForm.desconto || null,
            telefone: convenioForm.telefone || null,
            endereco: convenioForm.endereco || null,
            is_active: convenioForm.is_active,
          })
          .eq("id", editingConvenio.id);

        if (error) throw error;
        toast({ title: "Sucesso", description: "Convênio atualizado!" });
      } else {
        const { error } = await supabase
          .from("union_convenios")
          .insert({
            clinic_id: currentClinic.id,
            nome: convenioForm.nome,
            descricao: convenioForm.descricao || null,
            category_id: convenioForm.category_id || null,
            categoria: selectedCategory?.nome || null,
            desconto: convenioForm.desconto || null,
            telefone: convenioForm.telefone || null,
            endereco: convenioForm.endereco || null,
            order_index: convenios.length,
            is_active: convenioForm.is_active,
          });

        if (error) throw error;
        toast({ title: "Sucesso", description: "Convênio criado!" });
      }

      setIsConvenioDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error("Error saving convenio:", error);
      toast({
        title: "Erro",
        description: "Erro ao salvar convênio",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConvenio = async () => {
    if (!deleteDialog.id) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("union_convenios")
        .delete()
        .eq("id", deleteDialog.id);

      if (error) throw error;
      toast({ title: "Sucesso", description: "Convênio excluído!" });
      setDeleteDialog({ open: false, type: "convenio", id: null });
      fetchData();
    } catch (error) {
      console.error("Error deleting convenio:", error);
      toast({
        title: "Erro",
        description: "Erro ao excluir convênio",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleCategoryActive = async (category: ConvenioCategory) => {
    try {
      const { error } = await supabase
        .from("union_convenio_categories")
        .update({ is_active: !category.is_active })
        .eq("id", category.id);

      if (error) throw error;
      fetchData();
    } catch (error) {
      console.error("Error toggling category:", error);
    }
  };

  const handleToggleConvenioActive = async (convenio: Convenio) => {
    try {
      const { error } = await supabase
        .from("union_convenios")
        .update({ is_active: !convenio.is_active })
        .eq("id", convenio.id);

      if (error) throw error;
      fetchData();
    } catch (error) {
      console.error("Error toggling convenio:", error);
    }
  };

  const getCategoryById = (id: string | null) => {
    return categories.find(c => c.id === id);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sub-tabs for Convenios and Categories */}
      <Tabs value={activeSubTab} onValueChange={(v) => setActiveSubTab(v as "convenios" | "categorias")}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="convenios" className="gap-2">
              <Handshake className="h-4 w-4" />
              Convênios
              <Badge variant="secondary">{convenios.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="categorias" className="gap-2">
              <FolderOpen className="h-4 w-4" />
              Categorias
              <Badge variant="secondary">{categories.length}</Badge>
            </TabsTrigger>
          </TabsList>

          {activeSubTab === "categorias" ? (
            <Button onClick={handleOpenCategoryCreate} size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Categoria
            </Button>
          ) : (
            <Button onClick={handleOpenConvenioCreate} size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Convênio
            </Button>
          )}
        </div>

        {/* Categorias Tab */}
        <TabsContent value="categorias" className="mt-4">
          {categories.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                  <FolderOpen className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="font-medium mb-1">Nenhuma categoria encontrada</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Crie categorias para organizar seus convênios
                </p>
                <Button onClick={handleOpenCategoryCreate} variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Categoria
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {categories.map((category) => {
                const IconComponent = getIconComponent(category.icon);
                const conveniosCount = convenios.filter(c => c.category_id === category.id).length;

                return (
                  <Card key={category.id} className={!category.is_active ? "opacity-60" : ""}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: category.color || "#3b82f6" }}
                        >
                          <IconComponent className="h-5 w-5 text-white" />
                        </div>

                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium">{category.nome}</h3>
                            <Badge variant="secondary" className="text-xs">
                              {conveniosCount} convênio{conveniosCount !== 1 ? "s" : ""}
                            </Badge>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Switch
                            checked={category.is_active}
                            onCheckedChange={() => handleToggleCategoryActive(category)}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenCategoryEdit(category)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteDialog({ open: true, type: "category", id: category.id })}
                            disabled={conveniosCount > 0}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Convenios Tab */}
        <TabsContent value="convenios" className="mt-4">
          {convenios.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Handshake className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="font-medium mb-1">Nenhum convênio encontrado</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Adicione convênios para seus associados
                </p>
                <Button onClick={handleOpenConvenioCreate} variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Convênio
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {convenios.map((convenio) => {
                const category = getCategoryById(convenio.category_id);

                return (
                  <Card key={convenio.id} className={!convenio.is_active ? "opacity-60" : ""}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Handshake className="h-6 w-6 text-primary" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-2">
                            <div>
                              <h3 className="font-medium">{convenio.nome}</h3>
                              {convenio.descricao && (
                                <p className="text-sm text-muted-foreground line-clamp-1">
                                  {convenio.descricao}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2 mt-2">
                            {category && (
                              <Badge
                                variant="outline"
                                style={{ borderColor: category.color || undefined }}
                              >
                                {category.nome}
                              </Badge>
                            )}
                            {convenio.desconto && (
                              <Badge variant="secondary" className="gap-1">
                                <Percent className="h-3 w-3" />
                                {convenio.desconto}
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Switch
                            checked={convenio.is_active}
                            onCheckedChange={() => handleToggleConvenioActive(convenio)}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenConvenioEdit(convenio)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteDialog({ open: true, type: "convenio", id: convenio.id })}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Category Dialog */}
      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? "Editar" : "Nova"} Categoria
            </DialogTitle>
            <DialogDescription>
              Categorias ajudam a organizar os convênios no aplicativo
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                value={categoryForm.nome}
                onChange={(e) => setCategoryForm(prev => ({ ...prev, nome: e.target.value }))}
                placeholder="Ex: Saúde, Educação, Lazer..."
              />
            </div>

            <div className="space-y-2">
              <Label>Ícone</Label>
              <div className="grid grid-cols-6 gap-2">
                {AVAILABLE_ICONS.map((iconOption) => {
                  const IconComp = iconOption.icon;
                  return (
                    <Button
                      key={iconOption.name}
                      type="button"
                      variant={categoryForm.icon === iconOption.name ? "default" : "outline"}
                      size="icon"
                      onClick={() => setCategoryForm(prev => ({ ...prev, icon: iconOption.name }))}
                      title={iconOption.label}
                    >
                      <IconComp className="h-4 w-4" />
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="grid grid-cols-8 gap-2">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`w-8 h-8 rounded-lg border-2 transition-transform hover:scale-110 ${
                      categoryForm.color === color ? "border-foreground ring-2 ring-offset-2" : "border-transparent"
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setCategoryForm(prev => ({ ...prev, color }))}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label>Ativo</Label>
              <Switch
                checked={categoryForm.is_active}
                onCheckedChange={(checked) => setCategoryForm(prev => ({ ...prev, is_active: checked }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCategoryDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveCategory} disabled={saving || !categoryForm.nome.trim()}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Convenio Dialog */}
      <Dialog open={isConvenioDialogOpen} onOpenChange={setIsConvenioDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>
              {editingConvenio ? "Editar" : "Novo"} Convênio
            </DialogTitle>
            <DialogDescription>
              Preencha as informações do convênio
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input
                  value={convenioForm.nome}
                  onChange={(e) => setConvenioForm(prev => ({ ...prev, nome: e.target.value }))}
                  placeholder="Nome do convênio/parceiro"
                />
              </div>

              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select
                  value={convenioForm.category_id}
                  onValueChange={(v) => setConvenioForm(prev => ({ ...prev, category_id: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.filter(c => c.is_active).map((cat) => {
                      const IconComp = getIconComponent(cat.icon);
                      return (
                        <SelectItem key={cat.id} value={cat.id}>
                          <div className="flex items-center gap-2">
                            <IconComp className="h-4 w-4" style={{ color: cat.color || undefined }} />
                            {cat.nome}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea
                  value={convenioForm.descricao}
                  onChange={(e) => setConvenioForm(prev => ({ ...prev, descricao: e.target.value }))}
                  placeholder="Breve descrição do convênio"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>Desconto/Benefício</Label>
                <Input
                  value={convenioForm.desconto}
                  onChange={(e) => setConvenioForm(prev => ({ ...prev, desconto: e.target.value }))}
                  placeholder="Ex: 20% de desconto, 2 meses grátis..."
                />
              </div>

              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input
                  value={convenioForm.telefone}
                  onChange={(e) => setConvenioForm(prev => ({ ...prev, telefone: e.target.value }))}
                  placeholder="(00) 00000-0000"
                />
              </div>

              <div className="space-y-2">
                <Label>Endereço</Label>
                <Input
                  value={convenioForm.endereco}
                  onChange={(e) => setConvenioForm(prev => ({ ...prev, endereco: e.target.value }))}
                  placeholder="Endereço do estabelecimento"
                />
              </div>

              <div className="flex items-center justify-between">
                <Label>Ativo</Label>
                <Switch
                  checked={convenioForm.is_active}
                  onCheckedChange={(checked) => setConvenioForm(prev => ({ ...prev, is_active: checked }))}
                />
              </div>
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConvenioDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveConvenio} disabled={saving || !convenioForm.nome.trim()}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog(prev => ({ ...prev, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialog.type === "category"
                ? "Tem certeza que deseja excluir esta categoria? Esta ação não pode ser desfeita."
                : "Tem certeza que deseja excluir este convênio? Esta ação não pode ser desfeita."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteDialog.type === "category" ? handleDeleteCategory : handleDeleteConvenio}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
