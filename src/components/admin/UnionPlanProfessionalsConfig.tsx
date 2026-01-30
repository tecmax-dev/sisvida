import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Users, Save, Scale } from "lucide-react";

interface UnionPlan {
  id: string;
  name: string;
  max_professionals: number;
  is_active: boolean;
  monthly_price: number;
  resource_limits: Record<string, number>;
}

export function UnionPlanProfessionalsConfig() {
  const { toast } = useToast();
  const [plans, setPlans] = useState<UnionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editedValues, setEditedValues] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("id, name, max_professionals, is_active, monthly_price, resource_limits")
        .eq("category", "sindicato")
        .order("monthly_price", { ascending: true });

      if (error) throw error;

      const formattedPlans = (data || []).map(plan => ({
        ...plan,
        resource_limits: (plan.resource_limits as Record<string, number>) || {}
      }));

      setPlans(formattedPlans);
      
      // Initialize edited values with current values
      const initialValues: Record<string, number> = {};
      formattedPlans.forEach(plan => {
        initialValues[plan.id] = plan.max_professionals;
      });
      setEditedValues(initialValues);
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

  const handleValueChange = (planId: string, value: string) => {
    const numValue = parseInt(value) || 1;
    setEditedValues(prev => ({
      ...prev,
      [planId]: numValue
    }));
  };

  const handleSave = async (planId: string) => {
    const newValue = editedValues[planId];
    if (newValue < 1) {
      toast({
        title: "Valor inválido",
        description: "O número mínimo de profissionais é 1.",
        variant: "destructive",
      });
      return;
    }

    setSaving(planId);
    try {
      const { error } = await supabase
        .from("subscription_plans")
        .update({ max_professionals: newValue })
        .eq("id", planId);

      if (error) throw error;

      toast({
        title: "Atualizado com sucesso",
        description: "O limite de profissionais foi atualizado.",
      });

      // Update local state
      setPlans(prev => prev.map(plan => 
        plan.id === planId 
          ? { ...plan, max_professionals: newValue }
          : plan
      ));
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(null);
    }
  };

  const handleSaveAll = async () => {
    setSaving("all");
    try {
      const updates = plans.map(plan => ({
        id: plan.id,
        max_professionals: editedValues[plan.id] || plan.max_professionals
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from("subscription_plans")
          .update({ max_professionals: update.max_professionals })
          .eq("id", update.id);

        if (error) throw error;
      }

      toast({
        title: "Todos os planos atualizados",
        description: "Os limites de profissionais foram salvos com sucesso.",
      });

      fetchPlans();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(null);
    }
  };

  const hasChanges = (planId: string) => {
    const plan = plans.find(p => p.id === planId);
    return plan && editedValues[planId] !== plan.max_professionals;
  };

  const hasAnyChanges = plans.some(plan => hasChanges(plan.id));

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <Scale className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Nenhum plano de sindicato cadastrado.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Crie planos na seção "Gestão de Planos" com categoria "Sindicato".
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
              <Users className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <CardTitle className="text-lg">Limite de Profissionais por Plano</CardTitle>
              <CardDescription>
                Configure a quantidade máxima de profissionais que cada plano de sindicato pode ter
              </CardDescription>
            </div>
          </div>
          {hasAnyChanges && (
            <Button onClick={handleSaveAll} disabled={saving === "all"}>
              {saving === "all" ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar Todos
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border dark:border-slate-700"
            >
              <div className="flex items-center gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{plan.name}</p>
                    <Badge variant={plan.is_active ? "default" : "secondary"}>
                      {plan.is_active ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formatPrice(plan.monthly_price)}/mês
                    {plan.resource_limits?.max_usuarios && (
                      <span className="ml-2">
                        • Máx. {plan.resource_limits.max_usuarios} usuários
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-muted-foreground whitespace-nowrap">
                    Máx. Profissionais:
                  </label>
                  <Input
                    type="number"
                    min="1"
                    className="w-24"
                    value={editedValues[plan.id] ?? plan.max_professionals}
                    onChange={(e) => handleValueChange(plan.id, e.target.value)}
                  />
                </div>
                {hasChanges(plan.id) && (
                  <Button
                    size="sm"
                    onClick={() => handleSave(plan.id)}
                    disabled={saving === plan.id}
                  >
                    {saving === plan.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
            ℹ️ Sobre os limites de profissionais
          </h4>
          <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <li>• O limite define quantos profissionais uma entidade sindical pode cadastrar</li>
            <li>• Profissionais incluem médicos, dentistas, enfermeiros, etc. que atendem os associados</li>
            <li>• Alterar o limite não afeta profissionais já cadastrados</li>
            <li>• Use "Gestão de Planos" para configurar outros limites do plano</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
