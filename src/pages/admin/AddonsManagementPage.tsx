import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Edit,
  Package,
  Loader2,
  DollarSign,
  Building2,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";

interface Addon {
  id: string;
  key: string;
  name: string;
  description: string | null;
  monthly_price: number;
  features: string[] | null;
  is_active: boolean;
  order_index: number;
  created_at: string;
  clinic_count?: number;
}

export default function AddonsManagementPage() {
  const { toast } = useToast();
  const [addons, setAddons] = useState<Addon[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingAddon, setEditingAddon] = useState<Addon | null>(null);

  // Form state
  const [formKey, setFormKey] = useState("");
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formMonthlyPrice, setFormMonthlyPrice] = useState("0");
  const [formFeatures, setFormFeatures] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);
  const [formOrderIndex, setFormOrderIndex] = useState("0");

  useEffect(() => {
    fetchAddons();
  }, []);

  const fetchAddons = async () => {
    try {
      // Fetch addons
      const { data: addonsData, error: addonsError } = await supabase
        .from('subscription_addons')
        .select('*')
        .order('order_index');

      if (addonsError) throw addonsError;

      // Fetch clinic counts for each addon
      const { data: clinicAddons, error: clinicError } = await supabase
        .from('clinic_addons')
        .select('addon_id')
        .eq('status', 'active');

      if (clinicError) throw clinicError;

      // Count clinics per addon
      const clinicCounts: Record<string, number> = {};
      clinicAddons?.forEach(ca => {
        clinicCounts[ca.addon_id] = (clinicCounts[ca.addon_id] || 0) + 1;
      });

      const addonsWithCounts: Addon[] = (addonsData || []).map(addon => ({
        ...addon,
        features: Array.isArray(addon.features) ? addon.features as string[] : [],
        clinic_count: clinicCounts[addon.id] || 0
      }));

      setAddons(addonsWithCounts);
    } catch (error) {
      console.error('Error fetching addons:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os add-ons.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormKey("");
    setFormName("");
    setFormDescription("");
    setFormMonthlyPrice("0");
    setFormFeatures("");
    setFormIsActive(true);
    setFormOrderIndex("0");
    setEditingAddon(null);
  };

  const openNewDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (addon: Addon) => {
    setEditingAddon(addon);
    setFormKey(addon.key);
    setFormName(addon.name);
    setFormDescription(addon.description || "");
    setFormMonthlyPrice(addon.monthly_price.toString());
    setFormFeatures(addon.features?.join(", ") || "");
    setFormIsActive(addon.is_active);
    setFormOrderIndex(addon.order_index.toString());
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formKey.trim() || !formName.trim()) {
      toast({
        title: "Erro",
        description: "Chave e nome são obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const featuresArray = formFeatures
        .split(",")
        .map(f => f.trim())
        .filter(f => f.length > 0);

      const addonData = {
        key: formKey.trim().toLowerCase().replace(/\s+/g, '_'),
        name: formName.trim(),
        description: formDescription.trim() || null,
        monthly_price: parseFloat(formMonthlyPrice) || 0,
        features: featuresArray,
        is_active: formIsActive,
        order_index: parseInt(formOrderIndex) || 0,
      };

      if (editingAddon) {
        const { error } = await supabase
          .from('subscription_addons')
          .update(addonData)
          .eq('id', editingAddon.id);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Add-on atualizado com sucesso.",
        });
      } else {
        const { error } = await supabase
          .from('subscription_addons')
          .insert(addonData);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Add-on criado com sucesso.",
        });
      }

      setDialogOpen(false);
      resetForm();
      fetchAddons();
    } catch (error: any) {
      console.error('Error saving addon:', error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível salvar o add-on.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (addon: Addon) => {
    try {
      const { error } = await supabase
        .from('subscription_addons')
        .update({ is_active: !addon.is_active })
        .eq('id', addon.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: `Add-on ${addon.is_active ? 'desativado' : 'ativado'} com sucesso.`,
      });

      fetchAddons();
    } catch (error: any) {
      console.error('Error toggling addon:', error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível alterar o status.",
        variant: "destructive",
      });
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center">
            <Package className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Gestão de Add-ons</h1>
            <p className="text-muted-foreground">
              Gerencie os produtos adicionais disponíveis para contratação
            </p>
          </div>
        </div>
        <Button onClick={openNewDialog} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Add-on
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de Add-ons
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold">{addons.length}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Add-ons Ativos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <ToggleRight className="h-5 w-5 text-green-500" />
              <span className="text-2xl font-bold">
                {addons.filter(a => a.is_active).length}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Clínicas com Add-ons
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-500" />
              <span className="text-2xl font-bold">
                {addons.reduce((sum, a) => sum + (a.clinic_count || 0), 0)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Addons Table */}
      <Card>
        <CardHeader>
          <CardTitle>Add-ons Cadastrados</CardTitle>
          <CardDescription>
            Lista de todos os produtos adicionais disponíveis no sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          {addons.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum add-on cadastrado</p>
              <Button onClick={openNewDialog} variant="outline" className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                Criar primeiro add-on
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Add-on</TableHead>
                  <TableHead>Chave</TableHead>
                  <TableHead className="text-right">Preço Mensal</TableHead>
                  <TableHead className="text-center">Clínicas</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {addons.map((addon) => (
                  <TableRow key={addon.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{addon.name}</p>
                        {addon.description && (
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {addon.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {addon.key}
                      </code>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <DollarSign className="h-4 w-4 text-green-600" />
                        <span className="font-semibold">
                          {formatCurrency(addon.monthly_price)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">
                        {addon.clinic_count || 0}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleActive(addon)}
                        className={addon.is_active ? "text-green-600" : "text-muted-foreground"}
                      >
                        {addon.is_active ? (
                          <ToggleRight className="h-5 w-5" />
                        ) : (
                          <ToggleLeft className="h-5 w-5" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(addon)}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Editar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingAddon ? "Editar Add-on" : "Novo Add-on"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="key">Chave (identificador)*</Label>
                <Input
                  id="key"
                  value={formKey}
                  onChange={(e) => setFormKey(e.target.value)}
                  placeholder="whatsapp_advanced"
                  disabled={!!editingAddon}
                />
                <p className="text-xs text-muted-foreground">
                  Usado internamente para identificar o add-on
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Nome*</Label>
                <Input
                  id="name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="WhatsApp Avançado"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Descreva as funcionalidades do add-on..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">Preço Mensal (R$)*</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formMonthlyPrice}
                  onChange={(e) => setFormMonthlyPrice(e.target.value)}
                  placeholder="99.90"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="order">Ordem de Exibição</Label>
                <Input
                  id="order"
                  type="number"
                  min="0"
                  value={formOrderIndex}
                  onChange={(e) => setFormOrderIndex(e.target.value)}
                  placeholder="1"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="features">Features (separadas por vírgula)</Label>
              <Input
                id="features"
                value={formFeatures}
                onChange={(e) => setFormFeatures(e.target.value)}
                placeholder="whatsapp_campaigns, whatsapp_automations, whatsapp_ai"
              />
              <p className="text-xs text-muted-foreground">
                Chaves das funcionalidades liberadas por este add-on
              </p>
            </div>

            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div>
                <Label htmlFor="active">Add-on Ativo</Label>
                <p className="text-sm text-muted-foreground">
                  Add-ons inativos não podem ser contratados
                </p>
              </div>
              <Switch
                id="active"
                checked={formIsActive}
                onCheckedChange={setFormIsActive}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingAddon ? "Salvar Alterações" : "Criar Add-on"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
