import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSystemFeatures, SystemFeature } from "@/hooks/usePlanFeatures";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Edit,
  Loader2,
  Layers,
  CheckCircle,
  XCircle,
} from "lucide-react";

const CATEGORIES = [
  { value: 'anamnese', label: 'Anamnese' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'financial', label: 'Financeiro' },
  { value: 'medical', label: 'Médico' },
  { value: 'patients', label: 'Pacientes' },
  { value: 'scheduling', label: 'Agendamento' },
  { value: 'integrations', label: 'Integrações' },
  { value: 'reports', label: 'Relatórios' },
  { value: 'management', label: 'Gestão' },
];

const ICONS = [
  'FileText', 'Link', 'Bell', 'MessageSquare', 'Send', 'DollarSign', 
  'BarChart', 'CreditCard', 'Smile', 'FileCheck', 'Award', 'ClipboardList',
  'PenTool', 'Upload', 'Download', 'Clock', 'Calendar', 'Code', 'Webhook',
  'FileSpreadsheet', 'TrendingUp', 'Users', 'Building', 'ListChecks', 
  'Image', 'Headphones'
];

export default function FeaturesManagement() {
  const { toast } = useToast();
  const { features, loading, refetch } = useSystemFeatures();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingFeature, setEditingFeature] = useState<SystemFeature | null>(null);

  // Form state
  const [formKey, setFormKey] = useState("");
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCategory, setFormCategory] = useState("management");
  const [formIcon, setFormIcon] = useState("Layers");
  const [formIsActive, setFormIsActive] = useState(true);

  const resetForm = () => {
    setFormKey("");
    setFormName("");
    setFormDescription("");
    setFormCategory("management");
    setFormIcon("Layers");
    setFormIsActive(true);
    setEditingFeature(null);
  };

  const openEditDialog = (feature: SystemFeature) => {
    setEditingFeature(feature);
    setFormKey(feature.key);
    setFormName(feature.name);
    setFormDescription(feature.description || "");
    setFormCategory(feature.category);
    setFormIcon(feature.icon || "Layers");
    setFormIsActive(feature.is_active);
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formKey.trim() || !formName.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha a chave e o nome do recurso.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    try {
      const featureData = {
        key: formKey.trim().toLowerCase().replace(/\s+/g, '_'),
        name: formName.trim(),
        description: formDescription.trim() || null,
        category: formCategory,
        icon: formIcon,
        is_active: formIsActive,
      };

      if (editingFeature) {
        const { error } = await supabase
          .from('system_features')
          .update(featureData)
          .eq('id', editingFeature.id);

        if (error) throw error;

        toast({
          title: "Recurso atualizado",
          description: "As alterações foram salvas.",
        });
      } else {
        const { error } = await supabase
          .from('system_features')
          .insert(featureData);

        if (error) throw error;

        toast({
          title: "Recurso criado",
          description: "O novo recurso foi adicionado ao sistema.",
        });
      }

      setDialogOpen(false);
      resetForm();
      refetch();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleFeatureActive = async (feature: SystemFeature) => {
    try {
      const { error } = await supabase
        .from('system_features')
        .update({ is_active: !feature.is_active })
        .eq('id', feature.id);

      if (error) throw error;

      toast({
        title: feature.is_active ? "Recurso desativado" : "Recurso ativado",
      });

      refetch();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getCategoryLabel = (category: string) => {
    return CATEGORIES.find(c => c.value === category)?.label || category;
  };

  // Group features by category
  const groupedFeatures = features.reduce((acc, feature) => {
    if (!acc[feature.category]) {
      acc[feature.category] = [];
    }
    acc[feature.category].push(feature);
    return acc;
  }, {} as Record<string, SystemFeature[]>);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gestão de Recursos</h1>
          <p className="text-muted-foreground">
            Configure os recursos disponíveis para vincular aos planos
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo Recurso
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingFeature ? "Editar Recurso" : "Novo Recurso"}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="key">Chave única *</Label>
                  <Input
                    id="key"
                    value={formKey}
                    onChange={(e) => setFormKey(e.target.value)}
                    placeholder="ex: dynamic_anamnesis"
                    disabled={!!editingFeature}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">Nome *</Label>
                  <Input
                    id="name"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="ex: Anamnese Dinâmica"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Descrição do recurso..."
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select value={formCategory} onValueChange={setFormCategory}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Ícone</Label>
                  <Select value={formIcon} onValueChange={setFormIcon}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ICONS.map((icon) => (
                        <SelectItem key={icon} value={icon}>
                          {icon}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Recurso Ativo</Label>
                  <p className="text-sm text-muted-foreground">
                    Disponível para vincular aos planos
                  </p>
                </div>
                <Switch
                  checked={formIsActive}
                  onCheckedChange={setFormIsActive}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingFeature ? "Salvar" : "Criar Recurso"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Recursos</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{features.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recursos Ativos</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {features.filter(f => f.is_active).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categorias</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Object.keys(groupedFeatures).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Features Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recurso</TableHead>
                  <TableHead>Chave</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {features.map((feature) => (
                  <TableRow key={feature.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{feature.name}</p>
                        <p className="text-sm text-muted-foreground truncate max-w-xs">
                          {feature.description || "Sem descrição"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {feature.key}
                      </code>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {getCategoryLabel(feature.category)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {feature.is_active ? (
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                          Ativo
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Inativo</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(feature)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleFeatureActive(feature)}
                        >
                          {feature.is_active ? (
                            <XCircle className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
