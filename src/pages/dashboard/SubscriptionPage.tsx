import { useState } from "react";
import { useSubscription, useAvailablePlans } from "@/hooks/useSubscription";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  CreditCard,
  Users,
  Calendar,
  Check,
  AlertTriangle,
  Loader2,
  Crown,
  Sparkles,
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function SubscriptionPage() {
  const { subscription, loading, professionalCount, refetch } = useSubscription();
  const { plans, loading: loadingPlans } = useAvailablePlans();
  const { currentClinic } = useAuth();
  const { toast } = useToast();
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [upgrading, setUpgrading] = useState(false);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'trial':
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">Trial</Badge>;
      case 'active':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">Ativo</Badge>;
      case 'past_due':
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100">Pagamento Pendente</Badge>;
      case 'suspended':
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100">Suspenso</Badge>;
      case 'canceled':
        return <Badge variant="secondary">Cancelado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  };

  const handleUpgrade = async () => {
    if (!selectedPlan || !currentClinic) return;

    setUpgrading(true);

    try {
      const { error } = await supabase
        .from('subscriptions')
        .update({
          plan_id: selectedPlan,
          status: 'active',
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq('clinic_id', currentClinic.id);

      if (error) throw error;

      toast({
        title: "Plano atualizado!",
        description: "Seu plano foi atualizado com sucesso. Os novos limites já estão ativos.",
      });

      setUpgradeDialogOpen(false);
      setSelectedPlan(null);
      refetch();
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar plano",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUpgrading(false);
    }
  };

  const trialDaysRemaining = subscription?.trial_ends_at
    ? differenceInDays(new Date(subscription.trial_ends_at), new Date())
    : 0;

  const maxProfessionals = subscription?.plan?.max_professionals || 1;
  const usagePercentage = (professionalCount / maxProfessionals) * 100;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Meu Plano</h1>
        <p className="text-muted-foreground">
          Gerencie sua assinatura e visualize os recursos disponíveis
        </p>
      </div>

      {!subscription ? (
        <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-800">
          <CardContent className="flex items-center gap-4 p-6">
            <AlertTriangle className="h-8 w-8 text-yellow-600" />
            <div>
              <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">
                Sem assinatura ativa
              </h3>
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                Sua clínica não possui uma assinatura vinculada. Entre em contato com o suporte.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Current Plan */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Crown className="h-5 w-5 text-primary" />
                    {subscription.plan.name}
                  </CardTitle>
                  {getStatusBadge(subscription.status)}
                </div>
                <CardDescription>
                  {subscription.plan.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {subscription.status === 'trial' && trialDaysRemaining > 0 && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
                    <Calendar className="h-4 w-4 text-blue-600" />
                    <span className="text-sm text-blue-800 dark:text-blue-200">
                      {trialDaysRemaining} dias restantes no período de teste
                    </span>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Profissionais</span>
                    <span className="font-medium">
                      {professionalCount} / {maxProfessionals}
                    </span>
                  </div>
                  <Progress value={usagePercentage} className="h-2" />
                  {usagePercentage >= 80 && usagePercentage < 100 && (
                    <p className="text-xs text-yellow-600">
                      Você está próximo do limite do seu plano
                    </p>
                  )}
                  {usagePercentage >= 100 && (
                    <p className="text-xs text-red-600">
                      Você atingiu o limite do seu plano
                    </p>
                  )}
                </div>

                {subscription.plan.features.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Recursos incluídos:</p>
                    <ul className="space-y-1">
                      {subscription.plan.features.map((feature, index) => (
                        <li key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Check className="h-4 w-4 text-green-600" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <Button
                  onClick={() => setUpgradeDialogOpen(true)}
                  className="w-full"
                  disabled={loadingPlans}
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Ver planos disponíveis
                </Button>
              </CardContent>
            </Card>

            {/* Billing Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-muted-foreground" />
                  Informações de Cobrança
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Valor Mensal</p>
                    <p className="text-lg font-semibold">
                      {subscription.plan.monthly_price === 0
                        ? "Grátis"
                        : formatPrice(subscription.plan.monthly_price)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <p className="text-lg font-semibold capitalize">
                      {subscription.status === 'trial' ? 'Período de teste' : subscription.status}
                    </p>
                  </div>
                </div>

                {subscription.current_period_start && (
                  <div>
                    <p className="text-sm text-muted-foreground">Início do período atual</p>
                    <p className="font-medium">
                      {format(new Date(subscription.current_period_start), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </p>
                  </div>
                )}

                {subscription.trial_ends_at && subscription.status === 'trial' && (
                  <div>
                    <p className="text-sm text-muted-foreground">Fim do período de teste</p>
                    <p className="font-medium">
                      {format(new Date(subscription.trial_ends_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </p>
                  </div>
                )}

                <div className="p-4 rounded-lg bg-muted/50 border">
                  <p className="text-sm text-muted-foreground">
                    💡 A integração com gateway de pagamento será disponibilizada em breve.
                    Por enquanto, a troca de planos é gerenciada manualmente.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Upgrade Dialog */}
      <Dialog open={upgradeDialogOpen} onOpenChange={setUpgradeDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Escolha seu plano</DialogTitle>
            <DialogDescription>
              Selecione o plano que melhor atende às necessidades da sua clínica
            </DialogDescription>
          </DialogHeader>

          {loadingPlans ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 py-4">
              {plans.map((plan) => (
                <Card
                  key={plan.id}
                  className={`cursor-pointer transition-all hover:border-primary ${
                    selectedPlan === plan.id ? 'border-primary ring-2 ring-primary/20' : ''
                  } ${subscription?.plan_id === plan.id ? 'bg-muted/50' : ''}`}
                  onClick={() => setSelectedPlan(plan.id)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{plan.name}</CardTitle>
                      {subscription?.plan_id === plan.id && (
                        <Badge variant="secondary">Atual</Badge>
                      )}
                    </div>
                    <CardDescription className="text-xs">
                      {plan.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <span className="text-2xl font-bold">
                        {plan.monthly_price === 0 ? "Grátis" : formatPrice(plan.monthly_price)}
                      </span>
                      {plan.monthly_price > 0 && (
                        <span className="text-muted-foreground text-sm">/mês</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>Até {plan.max_professionals} profissional(is)</span>
                    </div>

                    {plan.features.length > 0 && (
                      <ul className="space-y-1">
                        {plan.features.slice(0, 4).map((feature, index) => (
                          <li key={index} className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Check className="h-3 w-3 text-green-600" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setUpgradeDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleUpgrade}
              disabled={!selectedPlan || selectedPlan === subscription?.plan_id || upgrading}
            >
              {upgrading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar Upgrade
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
