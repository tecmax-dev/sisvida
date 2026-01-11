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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Building2,
  Scale,
  ArrowUpDown,
  Calendar,
  Settings2,
} from "lucide-react";
import { useSystemFeatures, usePlanLinkedFeatures, SystemFeature } from "@/hooks/usePlanFeatures";

type PlanCategory = 'clinica' | 'sindicato';

interface Plan {
  id: string;
  name: string;
  description: string | null;
  max_professionals: number;
  max_messages_monthly: number;
  monthly_price: number;
  annual_price: number;
  external_plan_id: string | null;
  is_active: boolean;
  is_public: boolean;
  is_default_trial: boolean;
  features: string[];
  created_at: string;
  subscription_count?: number;
  category: PlanCategory;
  billing_period: string;
  trial_days: number;
  display_order: number;
  resource_limits: Record<string, number>;
  module_flags: Record<string, boolean>;
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

const PLAN_CATEGORIES: { value: PlanCategory; label: string; icon: typeof Building2; color: string }[] = [
  { value: 'clinica', label: 'Clínica', icon: Building2, color: 'bg-blue-100 text-blue-800' },
  { value: 'sindicato', label: 'Sindicato', icon: Scale, color: 'bg-amber-100 text-amber-800' },
];

const BILLING_PERIODS = [
  { value: 'monthly', label: 'Mensal' },
  { value: 'annual', label: 'Anual' },
  { value: 'custom', label: 'Personalizado' },
];

const UNION_MODULE_FLAGS = [
  { key: 'empresas', label: 'Empresas', description: 'Cadastro e gestão de empresas' },
  { key: 'socios', label: 'Sócios', description: 'Cadastro e gestão de sócios/associados' },
  { key: 'contribuicoes', label: 'Contribuições', description: 'Gestão de contribuições sindicais' },
  { key: 'financeiro', label: 'Financeiro Sindical', description: 'Módulo financeiro completo' },
  { key: 'negociacoes', label: 'Negociações', description: 'Negociações e parcelamentos de débitos' },
  { key: 'relatorios_avancados', label: 'Relatórios Avançados', description: 'Relatórios gerenciais e institucionais' },
];

const UNION_RESOURCE_LIMITS = [
  { key: 'max_empresas', label: 'Máx. Empresas', description: '0 = ilimitado' },
  { key: 'max_socios', label: 'Máx. Sócios', description: '0 = ilimitado' },
  { key: 'max_negociacoes', label: 'Máx. Negociações/Mês', description: '0 = ilimitado' },
  { key: 'max_usuarios', label: 'Máx. Usuários', description: '0 = ilimitado' },
];

export default function PlansManagement() {
  const { toast } = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [activeTab, setActiveTab] = useState("details");
  const [categoryFilter, setCategoryFilter] = useState<PlanCategory | 'all'>('all');

  // Form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formMaxProfessionals, setFormMaxProfessionals] = useState("1");
  const [formMaxMessages, setFormMaxMessages] = useState("100");
  const [formMonthlyPrice, setFormMonthlyPrice] = useState("0");
  const [formAnnualPrice, setFormAnnualPrice] = useState("0");
  const [formExternalId, setFormExternalId] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);
  const [formIsPublic, setFormIsPublic] = useState(true);
  const [formIsDefaultTrial, setFormIsDefaultTrial] = useState(false);
  const [formFeatures, setFormFeatures] = useState("");
  const [selectedFeatureIds, setSelectedFeatureIds] = useState<string[]>([]);
  const [formCategory, setFormCategory] = useState<PlanCategory>('clinica');
  const [formBillingPeriod, setFormBillingPeriod] = useState('monthly');
  const [formTrialDays, setFormTrialDays] = useState("0");
  const [formDisplayOrder, setFormDisplayOrder] = useState("0");
  const [formModuleFlags, setFormModuleFlags] = useState<Record<string, boolean>>({});
  const [formResourceLimits, setFormResourceLimits] = useState<Record<string, string>>({});

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
        .order('display_order', { ascending: true })
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
            resource_limits: (plan.resource_limits as Record<string, number>) || {},
            module_flags: (plan.module_flags as Record<string, boolean>) || {},
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
    setFormAnnualPrice("0");
    setFormExternalId("");
    setFormIsActive(true);
    setFormIsPublic(true);
    setFormIsDefaultTrial(false);
    setFormFeatures("");
    setSelectedFeatureIds([]);
    setEditingPlan(null);
    setActiveTab("details");
    setFormCategory('clinica');
    setFormBillingPeriod('monthly');
    setFormTrialDays("0");
    setFormDisplayOrder("0");
    setFormModuleFlags({});
    setFormResourceLimits({});
  };

  const openEditDialog = (plan: Plan) => {
    setEditingPlan(plan);
    setFormName(plan.name);
    setFormDescription(plan.description || "");
    setFormMaxProfessionals(plan.max_professionals.toString());
    setFormMaxMessages((plan.max_messages_monthly ?? 100).toString());
    setFormMonthlyPrice(plan.monthly_price.toString());
    setFormAnnualPrice((plan.annual_price || 0).toString());
    setFormExternalId(plan.external_plan_id || "");
    setFormIsActive(plan.is_active);
    setFormIsPublic(plan.is_public);
    setFormIsDefaultTrial(plan.is_default_trial);
    setFormFeatures(plan.features.join("\n"));
    setFormCategory(plan.category || 'clinica');
    setFormBillingPeriod(plan.billing_period || 'monthly');
    setFormTrialDays((plan.trial_days || 0).toString());
    setFormDisplayOrder((plan.display_order || 0).toString());
    setFormModuleFlags(plan.module_flags || {});
    setFormResourceLimits(
      Object.fromEntries(
        Object.entries(plan.resource_limits || {}).map(([k, v]) => [k, v.toString()])
      )
    );
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

  const handleModuleFlagToggle = (key: string) => {
    setFormModuleFlags(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
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
      const resourceLimitsNumeric = Object.fromEntries(
        Object.entries(formResourceLimits).map(([k, v]) => [k, parseInt(v) || 0])
      );

      const planData = {
        name: formName.trim(),
        description: formDescription.trim() || null,
        max_professionals: parseInt(formMaxProfessionals) || 1,
        max_messages_monthly: parseInt(formMaxMessages) || 100,
        monthly_price: parseFloat(formMonthlyPrice) || 0,
        annual_price: parseFloat(formAnnualPrice) || 0,
        external_plan_id: formExternalId.trim() || null,
        is_active: formIsActive,
        is_public: formIsPublic,
        is_default_trial: formIsDefaultTrial,
        features: formFeatures.split("\n").filter(f => f.trim()),
        category: formCategory,
        billing_period: formBillingPeriod,
        trial_days: parseInt(formTrialDays) || 0,
        display_order: parseInt(formDisplayOrder) || 0,
        resource_limits: resourceLimitsNumeric,
        module_flags: formModuleFlags,
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
        await supabase
          .from('plan_features')
          .delete()
          .eq('plan_id', planId);

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

  const getPlanCategoryInfo = (category: PlanCategory) => {
    return PLAN_CATEGORIES.find(c => c.value === category) || PLAN_CATEGORIES[0];
  };

  // Group features by category
  const groupedFeatures = systemFeatures.reduce((acc, feature) => {
    if (!acc[feature.category]) {
      acc[feature.category] = [];
    }
    acc[feature.category].push(feature);
    return acc;
  }, {} as Record<string, SystemFeature[]>);

  // Filter plans by category
  const filteredPlans = categoryFilter === 'all' 
    ? plans 
    : plans.filter(p => p.category === categoryFilter);

  const clinicPlansCount = plans.filter(p => p.category === 'clinica').length;
  const unionPlansCount = plans.filter(p => p.category === 'sindicato').length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gestão de Planos</h1>
          <p className="text-muted-foreground">
            Configure planos de assinatura para Clínicas e Sindicatos
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
          <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle>
                {editingPlan ? "Editar Plano" : "Novo Plano"}
              </DialogTitle>
            </DialogHeader>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
              <TabsList className="grid w-full grid-cols-4 flex-shrink-0">
                <TabsTrigger value="details">Detalhes</TabsTrigger>
                <TabsTrigger value="pricing">Preços</TabsTrigger>
                <TabsTrigger value="modules">Módulos</TabsTrigger>
                <TabsTrigger value="features">
                  Recursos ({selectedFeatureIds.length})
                </TabsTrigger>
              </TabsList>

              <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 mt-4">
                <div className="flex-1 overflow-y-auto min-h-0">
                  {/* Details Tab */}
                  <TabsContent value="details" className="space-y-4 mt-0 data-[state=inactive]:hidden">
                    <div className="grid grid-cols-2 gap-4">
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
                        <Label>Categoria *</Label>
                        <Select value={formCategory} onValueChange={(v) => setFormCategory(v as PlanCategory)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            {PLAN_CATEGORIES.map((cat) => (
                              <SelectItem key={cat.value} value={cat.value}>
                                <div className="flex items-center gap-2">
                                  <cat.icon className="h-4 w-4" />
                                  {cat.label}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
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

                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Recorrência</Label>
                        <Select value={formBillingPeriod} onValueChange={setFormBillingPeriod}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {BILLING_PERIODS.map((bp) => (
                              <SelectItem key={bp.value} value={bp.value}>
                                {bp.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="trialDays">Dias de Trial</Label>
                        <Input
                          id="trialDays"
                          type="number"
                          min="0"
                          value={formTrialDays}
                          onChange={(e) => setFormTrialDays(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="displayOrder">Ordem de Exibição</Label>
                        <Input
                          id="displayOrder"
                          type="number"
                          min="0"
                          value={formDisplayOrder}
                          onChange={(e) => setFormDisplayOrder(e.target.value)}
                        />
                      </div>
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
                        Texto descritivo para exibição comercial.
                      </p>
                    </div>

                    <div className="space-y-4 pt-4 border-t">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Plano Ativo</Label>
                          <p className="text-sm text-muted-foreground">Disponível para assinaturas</p>
                        </div>
                        <Switch checked={formIsActive} onCheckedChange={setFormIsActive} />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Plano Público</Label>
                          <p className="text-sm text-muted-foreground">Visível na landing page</p>
                        </div>
                        <Switch checked={formIsPublic} onCheckedChange={setFormIsPublic} />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Plano Trial Padrão</Label>
                          <p className="text-sm text-muted-foreground">Atribuído automaticamente a novos cadastros</p>
                        </div>
                        <Switch checked={formIsDefaultTrial} onCheckedChange={setFormIsDefaultTrial} />
                      </div>
                    </div>
                  </TabsContent>

                  {/* Pricing Tab */}
                  <TabsContent value="pricing" className="space-y-4 mt-0 data-[state=inactive]:hidden">
                    <div className="grid grid-cols-2 gap-4">
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

                      <div className="space-y-2">
                        <Label htmlFor="annualPrice">Preço Anual (R$)</Label>
                        <Input
                          id="annualPrice"
                          type="number"
                          min="0"
                          step="0.01"
                          value={formAnnualPrice}
                          onChange={(e) => setFormAnnualPrice(e.target.value)}
                        />
                      </div>
                    </div>

                    {formCategory === 'clinica' && (
                      <>
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
                            <Label htmlFor="maxMessages">Mensagens/Mês (WhatsApp)</Label>
                            <Input
                              id="maxMessages"
                              type="number"
                              min="0"
                              value={formMaxMessages}
                              onChange={(e) => setFormMaxMessages(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">0 = ilimitado</p>
                          </div>
                        </div>
                      </>
                    )}

                    {formCategory === 'sindicato' && (
                      <div className="space-y-4">
                        <h4 className="font-medium flex items-center gap-2">
                          <Settings2 className="h-4 w-4" />
                          Limites de Recursos
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                          {UNION_RESOURCE_LIMITS.map((limit) => (
                            <div key={limit.key} className="space-y-2">
                              <Label htmlFor={limit.key}>{limit.label}</Label>
                              <Input
                                id={limit.key}
                                type="number"
                                min="0"
                                value={formResourceLimits[limit.key] || "0"}
                                onChange={(e) => setFormResourceLimits(prev => ({
                                  ...prev,
                                  [limit.key]: e.target.value
                                }))}
                              />
                              <p className="text-xs text-muted-foreground">{limit.description}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="externalId">ID Externo (gateway de pagamento)</Label>
                      <Input
                        id="externalId"
                        value={formExternalId}
                        onChange={(e) => setFormExternalId(e.target.value)}
                        placeholder="ID do plano no gateway"
                      />
                    </div>
                  </TabsContent>

                  {/* Modules Tab (for Union plans) */}
                  <TabsContent value="modules" className="space-y-4 mt-0 data-[state=inactive]:hidden">
                    {formCategory === 'sindicato' ? (
                      <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                          Selecione os módulos que estarão disponíveis para clientes deste plano sindical.
                        </p>
                        
                        <div className="space-y-3">
                          {UNION_MODULE_FLAGS.map((flag) => (
                            <div
                              key={flag.key}
                              className="flex items-start gap-3 p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                            >
                              <Checkbox
                                id={`module-${flag.key}`}
                                checked={formModuleFlags[flag.key] || false}
                                onCheckedChange={() => handleModuleFlagToggle(flag.key)}
                              />
                              <div className="flex-1">
                                <label
                                  htmlFor={`module-${flag.key}`}
                                  className="text-sm font-medium cursor-pointer"
                                >
                                  {flag.label}
                                </label>
                                <p className="text-xs text-muted-foreground">
                                  {flag.description}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
                        <h4 className="font-medium">Configuração de Módulos</h4>
                        <p className="text-sm text-muted-foreground max-w-md mt-2">
                          A configuração de módulos está disponível apenas para planos da categoria <strong>Sindicato</strong>.
                          Para planos de clínica, use a aba "Recursos" para vincular funcionalidades.
                        </p>
                      </div>
                    )}
                  </TabsContent>

                  {/* Features Tab */}
                  <TabsContent value="features" className="mt-0 data-[state=inactive]:hidden">
                    <div className="space-y-2 mb-4">
                      <p className="text-sm text-muted-foreground">
                        Selecione os recursos do sistema que estarão disponíveis. Recursos não marcados serão bloqueados.
                      </p>
                    </div>

                    {loadingFeatures ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <ScrollArea className="h-[300px] pr-4">
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
                                      <label htmlFor={feature.id} className="text-sm font-medium cursor-pointer">
                                        {feature.name}
                                      </label>
                                      {feature.description && (
                                        <p className="text-xs text-muted-foreground">{feature.description}</p>
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
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t mt-4 flex-shrink-0 bg-background">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
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
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Planos</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{plans.length}</div>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-700">Planos Clínica</CardTitle>
            <Building2 className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">{clinicPlansCount}</div>
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-amber-700">Planos Sindicato</CardTitle>
            <Scale className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-700">{unionPlansCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Planos Ativos</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{plans.filter(p => p.is_active).length}</div>
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

      {/* Category Filter */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Filtrar por categoria:</span>
        <div className="flex gap-2">
          <Button
            variant={categoryFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setCategoryFilter('all')}
          >
            Todos
          </Button>
          <Button
            variant={categoryFilter === 'clinica' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setCategoryFilter('clinica')}
            className={categoryFilter === 'clinica' ? '' : 'text-blue-600 border-blue-200 hover:bg-blue-50'}
          >
            <Building2 className="h-4 w-4 mr-1" />
            Clínica
          </Button>
          <Button
            variant={categoryFilter === 'sindicato' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setCategoryFilter('sindicato')}
            className={categoryFilter === 'sindicato' ? '' : 'text-amber-600 border-amber-200 hover:bg-amber-50'}
          >
            <Scale className="h-4 w-4 mr-1" />
            Sindicato
          </Button>
        </div>
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
                  <TableHead className="w-8">
                    <ArrowUpDown className="h-4 w-4" />
                  </TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Recorrência</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Assinaturas</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPlans.map((plan) => {
                  const categoryInfo = getPlanCategoryInfo(plan.category);
                  return (
                    <TableRow key={plan.id}>
                      <TableCell className="text-center text-muted-foreground">
                        {plan.display_order}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {plan.name}
                            {plan.is_default_trial && (
                              <Badge variant="secondary" className="text-xs">Trial</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {plan.description || "Sem descrição"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={categoryInfo.color}>
                          <categoryInfo.icon className="h-3 w-3 mr-1" />
                          {categoryInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {BILLING_PERIODS.find(b => b.value === plan.billing_period)?.label || 'Mensal'}
                        </div>
                      </TableCell>
                      <TableCell>
                        {plan.monthly_price === 0 ? (
                          <Badge variant="outline">Grátis</Badge>
                        ) : (
                          <div>
                            <div>{formatPrice(plan.monthly_price)}/mês</div>
                            {plan.annual_price > 0 && (
                              <div className="text-xs text-muted-foreground">
                                {formatPrice(plan.annual_price)}/ano
                              </div>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{plan.subscription_count} clínicas</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {plan.is_active ? (
                            <Badge className="bg-green-100 text-green-800">Ativo</Badge>
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
                          <Button variant="ghost" size="sm" onClick={() => openEditDialog(plan)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => togglePlanActive(plan)}>
                            {plan.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
