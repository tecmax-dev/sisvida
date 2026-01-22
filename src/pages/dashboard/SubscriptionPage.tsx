import { useState, useEffect } from "react";
import { useSubscription, useAvailablePlans } from "@/hooks/useSubscription";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import { ClinicAddonsSection } from "@/components/subscription/ClinicAddonsSection";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PopupBase, PopupHeader, PopupTitle, PopupDescription, PopupFooter } from "@/components/ui/popup-base";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { RoleGuard } from "@/components/auth/RoleGuard";
import {
  CreditCard,
  Users,
  Calendar,
  Check,
  AlertTriangle,
  Loader2,
  Crown,
  Sparkles,
  Lock,
  Clock,
  CheckCircle,
  XCircle,
  MessageSquare,
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface UpgradeRequest {
  id: string;
  requested_plan_id: string;
  status: string;
  reason: string | null;
  admin_notes: string | null;
  created_at: string;
  processed_at: string | null;
  requested_plan?: { name: string };
}

export default function SubscriptionPage() {
  const { subscription, loading, professionalCount, messageUsage, refetch } = useSubscription();
  const { plans, loading: loadingPlans } = useAvailablePlans();
  const { availableFeatures, allFeatures, loading: loadingFeatures } = usePlanFeatures();
  const { currentClinic, user } = useAuth();
  const { toast } = useToast();
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [upgradeReason, setUpgradeReason] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [upgradeRequests, setUpgradeRequests] = useState<UpgradeRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);

  useEffect(() => {
    if (currentClinic) {
      fetchUpgradeRequests();
    }
  }, [currentClinic]);

  const fetchUpgradeRequests = async () => {
    if (!currentClinic) return;
    
    try {
      const { data, error } = await supabase
        .from('upgrade_requests')
        .select(`
          id,
          requested_plan_id,
          status,
          reason,
          admin_notes,
          created_at,
          processed_at,
          requested_plan:subscription_plans!upgrade_requests_requested_plan_id_fkey(name)
        `)
        .eq('clinic_id', currentClinic.id)
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (error) throw error;
      setUpgradeRequests(data || []);
    } catch (error) {
      console.error('Error fetching upgrade requests:', error);
    } finally {
      setLoadingRequests(false);
    }
  };

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

  const getRequestStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
      case 'approved':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"><CheckCircle className="h-3 w-3 mr-1" />Aprovado</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100"><XCircle className="h-3 w-3 mr-1" />Rejeitado</Badge>;
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

  const handleRequestUpgrade = async () => {
    if (!selectedPlan || !currentClinic || !user) return;

    setRequesting(true);

    try {
      const { error } = await supabase
        .from('upgrade_requests')
        .insert({
          clinic_id: currentClinic.id,
          current_plan_id: subscription?.plan_id,
          requested_plan_id: selectedPlan,
          requested_by: user.id,
          reason: upgradeReason || null,
        });

      if (error) throw error;

      toast({
        title: "Solicitação enviada!",
        description: "Sua solicitação de upgrade foi enviada para análise. Você será notificado quando for processada.",
      });

      setUpgradeDialogOpen(false);
      setSelectedPlan(null);
      setUpgradeReason("");
      fetchUpgradeRequests();
    } catch (error: any) {
      toast({
        title: "Erro ao solicitar upgrade",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setRequesting(false);
    }
  };

  const trialDaysRemaining = subscription?.trial_ends_at
    ? differenceInDays(new Date(subscription.trial_ends_at), new Date())
    : 0;

  const maxProfessionals = subscription?.plan?.max_professionals || 1;
  const usagePercentage = (professionalCount / maxProfessionals) * 100;

  // Determine which features are available and which are blocked
  const availableFeatureKeys = new Set(availableFeatures.map(f => f.key));
  const blockedFeatures = allFeatures.filter(f => !availableFeatureKeys.has(f.key));

  const hasPendingRequest = upgradeRequests.some(r => r.status === 'pending');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <RoleGuard permission="manage_subscription">
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

                <Button
                  onClick={() => setUpgradeDialogOpen(true)}
                  className="w-full"
                  disabled={loadingPlans || hasPendingRequest}
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  {hasPendingRequest ? "Solicitação pendente" : "Alterar Plano"}
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

          {/* Message Usage Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-muted-foreground" />
                Uso de Mensagens WhatsApp
              </CardTitle>
              <CardDescription>
                Mensagens enviadas neste mês (lembretes, confirmações e envios manuais)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {messageUsage ? (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Mensagens enviadas</span>
                      <span className="font-medium">
                        {messageUsage.used} / {messageUsage.max_allowed === 0 ? '∞' : messageUsage.max_allowed}
                      </span>
                    </div>
                    {messageUsage.max_allowed > 0 && (
                      <>
                        <Progress 
                          value={(messageUsage.used / messageUsage.max_allowed) * 100} 
                          className="h-2" 
                        />
                        {messageUsage.remaining <= 10 && messageUsage.remaining > 0 && (
                          <p className="text-xs text-yellow-600">
                            ⚠️ Você está próximo do limite ({messageUsage.remaining} restantes)
                          </p>
                        )}
                        {messageUsage.remaining <= 0 && (
                          <p className="text-xs text-red-600">
                            ❌ Limite de mensagens atingido. Faça upgrade para continuar enviando.
                          </p>
                        )}
                      </>
                    )}
                    {messageUsage.max_allowed === 0 && (
                      <p className="text-xs text-green-600">
                        ✓ Seu plano possui mensagens ilimitadas
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    O contador reinicia no primeiro dia de cada mês.
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nenhum dado de uso disponível.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Features Section - Redesigned */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Available Features */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-green-600">
                  <Check className="h-5 w-5" />
                  Recursos Incluídos
                  <Badge variant="secondary" className="ml-auto">
                    {availableFeatures.length}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Recursos disponíveis no seu plano atual
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingFeatures ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : availableFeatures.length > 0 ? (
                  <div className="space-y-3">
                    {/* Group features by category */}
                    {Object.entries(
                      availableFeatures.reduce((acc, feature) => {
                        const cat = feature.category || 'Geral';
                        if (!acc[cat]) acc[cat] = [];
                        acc[cat].push(feature);
                        return acc;
                      }, {} as Record<string, typeof availableFeatures>)
                    ).map(([category, features]) => (
                      <div key={category} className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          {category}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {features.map((feature) => (
                            <Badge 
                              key={feature.id} 
                              variant="secondary"
                              className="bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300 border-green-200 dark:border-green-800 gap-1"
                            >
                              <Check className="h-3 w-3" />
                              {feature.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhum recurso vinculado ao plano.</p>
                )}
              </CardContent>
            </Card>

            {/* Blocked Features */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-muted-foreground">
                  <Lock className="h-5 w-5" />
                  Recursos Bloqueados
                  <Badge variant="outline" className="ml-auto">
                    {blockedFeatures.length}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Faça upgrade para desbloquear
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingFeatures ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : blockedFeatures.length > 0 ? (
                  <div className="space-y-3">
                    {Object.entries(
                      blockedFeatures.reduce((acc, feature) => {
                        const cat = feature.category || 'Geral';
                        if (!acc[cat]) acc[cat] = [];
                        acc[cat].push(feature);
                        return acc;
                      }, {} as Record<string, typeof blockedFeatures>)
                    ).map(([category, features]) => (
                      <div key={category} className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          {category}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {features.map((feature) => (
                            <Badge 
                              key={feature.id} 
                              variant="outline"
                              className="text-muted-foreground gap-1"
                            >
                              <Lock className="h-3 w-3" />
                              {feature.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Você tem acesso a todos os recursos disponíveis!
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Upgrade Requests History */}
          {upgradeRequests.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Solicitações</CardTitle>
                <CardDescription>
                  Suas últimas solicitações de alteração de plano
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {upgradeRequests.map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card"
                    >
                      <div>
                        <p className="font-medium">
                          Upgrade para {request.requested_plan?.name || 'Plano'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(request.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                        {request.admin_notes && request.status !== 'pending' && (
                          <p className="text-sm text-muted-foreground mt-1">
                            Nota: {request.admin_notes}
                          </p>
                        )}
                      </div>
                      {getRequestStatusBadge(request.status)}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Addons Section */}
          <ClinicAddonsSection />
        </>
      )}

      {/* Upgrade Dialog */}
      <PopupBase 
        open={upgradeDialogOpen} 
        onClose={() => setUpgradeDialogOpen(false)} 
        maxWidth="2xl"
      >
        <PopupHeader>
          <PopupTitle>Alterar Plano</PopupTitle>
          <PopupDescription>
            Selecione o plano desejado e envie sua solicitação para análise.
          </PopupDescription>
        </PopupHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-4 pr-2">
            {loadingPlans ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <div className="grid gap-4">
                {plans
                  .filter(p => p.is_public && p.is_active)
                  .map((plan) => {
                    const isCurrentPlan = subscription?.plan_id === plan.id;
                    const isSelected = selectedPlan === plan.id;

                    return (
                      <div
                        key={plan.id}
                        className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                          isSelected
                            ? 'border-primary bg-primary/5'
                            : isCurrentPlan
                            ? 'border-muted bg-muted/50'
                            : 'border-border hover:border-primary/50'
                        }`}
                        onClick={() => !isCurrentPlan && setSelectedPlan(plan.id)}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-semibold flex items-center gap-2">
                              {plan.name}
                              {isCurrentPlan && (
                                <Badge variant="secondary">Plano Atual</Badge>
                              )}
                            </h4>
                            <p className="text-sm text-muted-foreground">
                              {plan.description}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold">
                              {plan.monthly_price === 0
                                ? 'Grátis'
                                : formatPrice(plan.monthly_price)}
                            </p>
                            {plan.monthly_price > 0 && (
                              <p className="text-xs text-muted-foreground">/mês</p>
                            )}
                          </div>
                        </div>
                        <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            {plan.max_professionals} profissionais
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageSquare className="h-4 w-4" />
                            {plan.max_messages_monthly === 0 
                              ? 'Mensagens ilimitadas' 
                              : `${plan.max_messages_monthly} mensagens/mês`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}

            {selectedPlan && (
              <div className="space-y-2">
                <Label htmlFor="reason">Motivo da solicitação (opcional)</Label>
                <Textarea
                  id="reason"
                  placeholder="Descreva por que deseja alterar seu plano..."
                  value={upgradeReason}
                  onChange={(e) => setUpgradeReason(e.target.value)}
                  rows={3}
                />
              </div>
            )}
          </div>
        </ScrollArea>

        <PopupFooter>
          <Button variant="outline" onClick={() => setUpgradeDialogOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleRequestUpgrade}
            disabled={!selectedPlan || requesting}
          >
            {requesting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Enviar Solicitação
          </Button>
        </PopupFooter>
      </PopupBase>
    </div>
    </RoleGuard>
  );
}
