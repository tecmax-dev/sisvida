import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
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
} from "lucide-react";

interface Plan {
  id: string;
  name: string;
  description: string | null;
  max_professionals: number;
  monthly_price: number;
  external_plan_id: string | null;
  is_active: boolean;
  is_public: boolean;
  is_default_trial: boolean;
  features: string[];
  created_at: string;
  subscription_count?: number;
}

export default function PlansManagement() {
  const { toast } = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formMaxProfessionals, setFormMaxProfessionals] = useState("1");
  const [formMonthlyPrice, setFormMonthlyPrice] = useState("0");
  const [formExternalId, setFormExternalId] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);
  const [formIsPublic, setFormIsPublic] = useState(true);
  const [formIsDefaultTrial, setFormIsDefaultTrial] = useState(false);
  const [formFeatures, setFormFeatures] = useState("");

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      
      // Fetch plans
      const { data: plansData, error: plansError } = await supabase
        .from('subscription_plans')
        .select('*')
        .order('monthly_price', { ascending: true });

      if (plansError) throw plansError;

      // Fetch subscription counts for each plan
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
    setFormMonthlyPrice("0");
    setFormExternalId("");
    setFormIsActive(true);
    setFormIsPublic(true);
    setFormIsDefaultTrial(false);
    setFormFeatures("");
    setEditingPlan(null);
  };

  const openEditDialog = (plan: Plan) => {
    setEditingPlan(plan);
    setFormName(plan.name);
    setFormDescription(plan.description || "");
    setFormMaxProfessionals(plan.max_professionals.toString());
    setFormMonthlyPrice(plan.monthly_price.toString());
    setFormExternalId(plan.external_plan_id || "");
    setFormIsActive(plan.is_active);
    setFormIsPublic(plan.is_public);
    setFormIsDefaultTrial(plan.is_default_trial);
    setFormFeatures(plan.features.join("\n"));
    setDialogOpen(true);
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
        monthly_price: parseFloat(formMonthlyPrice) || 0,
        external_plan_id: formExternalId.trim() || null,
        is_active: formIsActive,
        is_public: formIsPublic,
        is_default_trial: formIsDefaultTrial,
        features: formFeatures.split("\n").filter(f => f.trim()),
      };

      if (editingPlan) {
        const { error } = await supabase
          .from('subscription_plans')
          .update(planData)
          .eq('id', editingPlan.id);

        if (error) throw error;

        toast({
          title: "Plano atualizado",
          description: "As alterações foram salvas com sucesso.",
        });
      } else {
        const { error } = await supabase
          .from('subscription_plans')
          .insert(planData);

        if (error) throw error;

        toast({
          title: "Plano criado",
          description: "O novo plano foi criado com sucesso.",
        });
      }

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
        description: plan.is_active
          ? "O plano não estará mais disponível para novos usuários."
          : "O plano está disponível para novos usuários.",
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gestão de Planos</h1>
          <p className="text-muted-foreground">
            Configure os planos de assinatura disponíveis para as clínicas
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
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingPlan ? "Editar Plano" : "Novo Plano"}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
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
                <Label htmlFor="externalId">ID Externo (gateway)</Label>
                <Input
                  id="externalId"
                  value={formExternalId}
                  onChange={(e) => setFormExternalId(e.target.value)}
                  placeholder="ID do plano no gateway de pagamento"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="features">Recursos (um por linha)</Label>
                <Textarea
                  id="features"
                  value={formFeatures}
                  onChange={(e) => setFormFeatures(e.target.value)}
                  placeholder="Agendamento online&#10;Prontuário eletrônico&#10;Relatórios"
                  rows={3}
                />
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
                      Visível para usuários
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
                  {editingPlan ? "Salvar" : "Criar Plano"}
                </Button>
              </div>
            </form>
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
