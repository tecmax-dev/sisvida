import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Edit,
  Users,
  CreditCard,
  Star,
  Loader2,
  Eye,
  EyeOff,
  Layers,
  MessageSquare,
} from "lucide-react";
import { useSystemFeatures, usePlanLinkedFeatures, SystemFeature } from "@/hooks/usePlanFeatures";

interface Plan {
  id: string;
  name: string;
  description: string | null;
  max_professionals: number;
  max_messages_monthly: number;
  monthly_price: number;
  external_plan_id: string | null;
  is_active: boolean;
  is_public: boolean;
  is_default_trial: boolean;
  features: string[];
  created_at: string;
  subscription_count?: number;
}

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

export default function PlansManagement() {
  const { toast } = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [activeTab, setActiveTab] = useState("details");

  // Form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formMaxProfessionals, setFormMaxProfessionals] = useState("1");
  const [formMaxMessages, setFormMaxMessages] = useState("100");
  const [formMonthlyPrice, setFormMonthlyPrice] = useState("0");
  const [formExternalId, setFormExternalId] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);
  const [formIsPublic, setFormIsPublic] = useState(true);
  const [formIsDefaultTrial, setFormIsDefaultTrial] = useState(false);
  const [formFeatures, setFormFeatures] = useState("");
  const [selectedFeatureIds, setSelectedFeatureIds] = useState<string[]>([]);

  // System features
  const { features: systemFeatures, loading: loadingFeatures } = useSystemFeatures();
  const { linkedFeatureIds, refetch: refetchLinked } = usePlanLinkedFeatures(editingPlan?.id || null);

  useEffect(() => {
    fetchPlans();
  }, []);

  useEffect(() => {
    if (editingPlan) {
      setSelectedFeatureIds(linkedFeatureIds);
    }
  }, [linkedFeatureIds, editingPlan]);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      
      const { data: plansData, error: plansError } = await supabase
        .from('subscription_plans')
        .select('*')
        .order('monthly_price', { ascending: true });

      if (plansError) throw plansError;

      const plansWithCounts = await Promise.all(
        (plansData || []).map(async (plan) => {
          const { count } = await supabase
            .from('subscriptions')
            .select('*', { count: 'exact', head: true })
            .eq('plan_id', plan.id);

          return {
            ...plan,
            features: Array.isArray(plan.features) 
              ? (plan.features as unknown[]).map(f => String(f))
              : [],
            subscription_count: count || 0,
          };
        })
      );

      setPlans(plansWithCounts);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar planos",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormName("");
    setFormDescription("");
    setFormMaxProfessionals("1");
    setFormMaxMessages("100");
    setFormMonthlyPrice("0");
    setFormExternalId("");
    setFormIsActive(true);
    setFormIsPublic(true);
    setFormIsDefaultTrial(false);
    setFormFeatures("");
    setSelectedFeatureIds([]);
    setEditingPlan(null);
    setActiveTab("details");
  };

  const openEditDialog = (plan: Plan) => {
    setEditingPlan(plan);
    setFormName(plan.name);
    setFormDescription(plan.description || "");
    setFormMaxProfessionals(plan.max_professionals.toString());
    setFormMaxMessages((plan.max_messages_monthly ?? 100).toString());
    setFormMonthlyPrice(plan.monthly_price.toString());
    setFormExternalId(plan.external_plan_id || "");
    setFormIsActive(plan.is_active);
    setFormIsPublic(plan.is_public);
    setFormIsDefaultTrial(plan.is_default_trial);
    setFormFeatures(plan.features.join("\n"));
    setDialogOpen(true);
    refetchLinked();
  };

  const handleFeatureToggle = (featureId: string) => {
    setSelectedFeatureIds(prev => 
      prev.includes(featureId)
        ? prev.filter(id => id !== featureId)
        : [...prev, featureId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formName.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Informe um nome para o plano.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    try {
      const planData = {
        name: formName.trim(),
        description: formDescription.trim() || null,
        max_professionals: parseInt(formMaxProfessionals) || 1,
        max_messages_monthly: parseInt(formMaxMessages) || 100,
        monthly_price: parseFloat(formMonthlyPrice) || 0,
        external_plan_id: formExternalId.trim() || null,
        is_active: formIsActive,
        is_public: formIsPublic,
        is_default_trial: formIsDefaultTrial,
        features: formFeatures.split("\n").filter(f => f.trim()),
      };

      let planId = editingPlan?.id;

      if (editingPlan) {
        const { error } = await supabase
          .from('subscription_plans')
          .update(planData)
          .eq('id', editingPlan.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('subscription_plans')
          .insert(planData)
          .select('id')
          .single();

        if (error) throw error;
        planId = data.id;
      }

      // Update linked features
      if (planId) {
        // Remove all existing links
        await supabase
          .from('plan_features')
          .delete()
          .eq('plan_id', planId);

        // Add new links
        if (selectedFeatureIds.length > 0) {
          const linksToInsert = selectedFeatureIds.map(featureId => ({
            plan_id: planId,
            feature_id: featureId,
          }));

          const { error: linkError } = await supabase
            .from('plan_features')
            .insert(linksToInsert);

          if (linkError) throw linkError;
        }
      }

      toast({
        title: editingPlan ? "Plano atualizado" : "Plano criado",
        description: editingPlan 
          ? "As alterações foram salvas com sucesso."
          : "O novo plano foi criado com sucesso.",
      });

      setDialogOpen(false);
      resetForm();
      fetchPlans();
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

  const togglePlanActive = async (plan: Plan) => {
    try {
      const { error } = await supabase
        .from('subscription_plans')
        .update({ is_active: !plan.is_active })
        .eq('id', plan.id);

      if (error) throw error;

      toast({
        title: plan.is_active ? "Plano desativado" : "Plano ativado",
      });

      fetchPlans();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  };

  const getCategoryLabel = (category: string) => {
    return CATEGORIES.find(c => c.value === category)?.label || category;
  };

  // Group features by category
  const groupedFeatures = systemFeatures.reduce((acc, feature) => {
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
          <h1 className="text-2xl font-bold text-foreground">Gestão de Planos</h1>
          <p className="text-muted-foreground">
            Configure os planos de assinatura e vincule recursos
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo Plano
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>
                {editingPlan ? "Editar Plano" : "Novo Plano"}
              </DialogTitle>
            </DialogHeader>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="details">Detalhes</TabsTrigger>
                <TabsTrigger value="features">
                  Recursos ({selectedFeatureIds.length})
                </TabsTrigger>
              </TabsList>

              <form onSubmit={handleSubmit}>
                <TabsContent value="details" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome do Plano *</Label>
                    <Input
                      id="name"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="Ex: Profissional"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Descrição</Label>
                    <Textarea
                      id="description"
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      placeholder="Descrição do plano..."
                      rows={2}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="maxProfessionals">Máx. Profissionais</Label>
                      <Input
                        id="maxProfessionals"
                        type="number"
                        min="1"
                        value={formMaxProfessionals}
                        onChange={(e) => setFormMaxProfessionals(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="monthlyPrice">Preço Mensal (R$)</Label>
                      <Input
                        id="monthlyPrice"
                        type="number"
                        min="0"
                        step="0.01"
                        value={formMonthlyPrice}
                        onChange={(e) => setFormMonthlyPrice(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="maxMessages">Mensagens/Mês (WhatsApp)</Label>
                    <Input
                      id="maxMessages"
                      type="number"
                      min="0"
                      value={formMaxMessages}
                      onChange={(e) => setFormMaxMessages(e.target.value)}
                      placeholder="100"
                    />
                    <p className="text-xs text-muted-foreground">
                      0 = ilimitado. Inclui lembretes automáticos, confirmações e envios manuais.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="externalId">ID Externo (gateway)</Label>
                    <Input
                      id="externalId"
                      value={formExternalId}
                      onChange={(e) => setFormExternalId(e.target.value)}
                      placeholder="ID do plano no gateway de pagamento"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="features">Descrição de recursos (um por linha)</Label>
                    <Textarea
                      id="features"
                      value={formFeatures}
                      onChange={(e) => setFormFeatures(e.target.value)}
                      placeholder="Agendamento online&#10;Prontuário eletrônico&#10;Relatórios"
                      rows={3}
                    />
                    <p className="text-xs text-muted-foreground">
                      Texto descritivo para exibição. Use a aba "Recursos" para vincular funcionalidades reais.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Plano Ativo</Label>
                        <p className="text-sm text-muted-foreground">
                          Disponível para assinaturas
                        </p>
                      </div>
                      <Switch
                        checked={formIsActive}
                        onCheckedChange={setFormIsActive}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Plano Público</Label>
                        <p className="text-sm text-muted-foreground">
                          Visível na landing page
                        </p>
                      </div>
                      <Switch
                        checked={formIsPublic}
                        onCheckedChange={setFormIsPublic}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Plano Trial Padrão</Label>
                        <p className="text-sm text-muted-foreground">
                          Atribuído automaticamente a novos cadastros
                        </p>
                      </div>
                      <Switch
                        checked={formIsDefaultTrial}
                        onCheckedChange={setFormIsDefaultTrial}
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="features" className="mt-4">
                  <div className="space-y-2 mb-4">
                    <p className="text-sm text-muted-foreground">
                      Selecione os recursos que estarão disponíveis para clínicas com este plano.
                      Recursos não marcados serão bloqueados.
                    </p>
                  </div>

                  {loadingFeatures ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <ScrollArea className="h-[400px] pr-4">
                      <div className="space-y-6">
                        {Object.entries(groupedFeatures).map(([category, features]) => (
                          <div key={category}>
                            <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                              <Layers className="h-4 w-4" />
                              {getCategoryLabel(category)}
                            </h4>
                            <div className="space-y-2 pl-6">
                              {features.filter(f => f.is_active).map((feature) => (
                                <div
                                  key={feature.id}
                                  className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50"
                                >
                                  <Checkbox
                                    id={feature.id}
                                    checked={selectedFeatureIds.includes(feature.id)}
                                    onCheckedChange={() => handleFeatureToggle(feature.id)}
                                  />
                                  <div className="flex-1">
                                    <label
                                      htmlFor={feature.id}
                                      className="text-sm font-medium cursor-pointer"
                                    >
                                      {feature.name}
                                    </label>
                                    {feature.description && (
                                      <p className="text-xs text-muted-foreground">
                                        {feature.description}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </TabsContent>

                <div className="flex justify-end gap-2 pt-4 border-t mt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {editingPlan ? "Salvar" : "Criar Plano"}
                  </Button>
                </div>
              </form>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Planos</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{plans.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Planos Ativos</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {plans.filter(p => p.is_active).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Planos Públicos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {plans.filter(p => p.is_public).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Assinaturas</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {plans.reduce((acc, p) => acc + (p.subscription_count || 0), 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Plans Table */}
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
                  <TableHead>Plano</TableHead>
                  <TableHead>Profissionais</TableHead>
                  <TableHead>Mensagens/Mês</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Assinaturas</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {plan.name}
                            {plan.is_default_trial && (
                              <Badge variant="secondary" className="text-xs">
                                Trial Padrão
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {plan.description || "Sem descrição"}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        {plan.max_professionals}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                        {plan.max_messages_monthly === 0 ? '∞' : plan.max_messages_monthly ?? 100}
                      </div>
                    </TableCell>
                    <TableCell>
                      {plan.monthly_price === 0 ? (
                        <Badge variant="outline">Grátis</Badge>
                      ) : (
                        formatPrice(plan.monthly_price)
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {plan.subscription_count} clínicas
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {plan.is_active ? (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                            Ativo
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Inativo</Badge>
                        )}
                        {plan.is_public ? (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(plan)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => togglePlanActive(plan)}
                        >
                          {plan.is_active ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
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
