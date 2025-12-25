import { ReactNode, useState } from "react";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Lock, Sparkles, Loader2, ArrowUpCircle, AlertTriangle, ArrowDownCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useSubscription } from "@/hooks/useSubscription";
import { useAvailablePlans } from "@/hooks/useSubscription";

interface FeatureGateProps {
  feature: string;
  children: ReactNode;
  fallback?: ReactNode;
  showUpgradePrompt?: boolean;
}

export function FeatureGate({
  feature,
  children,
  fallback,
  showUpgradePrompt = true,
}: FeatureGateProps) {
  const { hasFeature, loading } = usePlanFeatures();
  const { subscription } = useSubscription();
  const { plans } = useAvailablePlans();
  const { currentClinic, user } = useAuth();
  const { toast } = useToast();
  
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Check if user has access to this feature
  if (hasFeature(feature)) {
    return <>{children}</>;
  }

  // If fallback is provided, render it
  if (fallback) {
    return <>{fallback}</>;
  }

  // Filter plans based on price for upgrade/downgrade
  const currentPrice = subscription?.plan?.monthly_price || 0;
  const upgradePlans = plans.filter(p => 
    p.id !== subscription?.plan_id && 
    p.monthly_price > currentPrice
  );
  
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  };

  const handleRequestUpgrade = async () => {
    if (!currentClinic || !selectedPlanId || !user) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.from('upgrade_requests').insert({
        clinic_id: currentClinic.id,
        current_plan_id: subscription?.plan_id || null,
        requested_plan_id: selectedPlanId,
        reason: reason.trim() || `Necessita acesso ao recurso: ${feature}`,
        requested_by: user.id,
      });

      if (error) throw error;

      toast({
        title: "Solicitação enviada!",
        description: "Sua solicitação de upgrade foi enviada. Entraremos em contato em breve.",
      });

      setUpgradeDialogOpen(false);
      setSelectedPlanId(null);
      setReason("");
    } catch (error: any) {
      toast({
        title: "Erro ao enviar solicitação",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Show upgrade prompt if enabled
  if (!showUpgradePrompt) {
    return null;
  }

  return (
    <>
      <Card className="border-dashed border-2 border-muted-foreground/30 bg-muted/20">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <Lock className="h-6 w-6 text-muted-foreground" />
          </div>
          <CardTitle className="text-lg">Recurso não disponível</CardTitle>
          <CardDescription>
            Este recurso não está incluído no seu plano atual.
            <br />
            Solicite um upgrade para ter acesso.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button onClick={() => setUpgradeDialogOpen(true)} className="gap-2">
            <Sparkles className="h-4 w-4" />
            Solicitar Upgrade
          </Button>
        </CardContent>
      </Card>

      {/* Upgrade Request Dialog */}
      <Dialog open={upgradeDialogOpen} onOpenChange={setUpgradeDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowUpCircle className="h-5 w-5 text-primary" />
              Solicitar Upgrade de Plano
            </DialogTitle>
            <DialogDescription>
              Selecione o plano desejado e nossa equipe entrará em contato
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Current Plan Info */}
            <div className="p-3 rounded-lg bg-muted/50 border">
              <p className="text-sm text-muted-foreground">Seu plano atual:</p>
              <p className="font-medium">{subscription?.plan?.name || "Sem plano"}</p>
            </div>

            {/* Plan Selection - Upgrades */}
            {upgradePlans.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <ArrowUpCircle className="h-4 w-4 text-green-600" />
                  <p className="text-sm font-medium text-green-600">Upgrades disponíveis:</p>
                </div>
                <div className="grid gap-2">
                  {upgradePlans.map((plan) => (
                    <div
                      key={plan.id}
                      onClick={() => setSelectedPlanId(plan.id)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all border-green-200 dark:border-green-800 ${
                        selectedPlanId === plan.id
                          ? 'border-green-500 bg-green-50 dark:bg-green-950 ring-2 ring-green-500/20'
                          : 'hover:border-green-500/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{plan.name}</p>
                          <p className="text-sm text-muted-foreground">{plan.description}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-green-600">
                            {plan.monthly_price === 0 
                              ? "Grátis" 
                              : formatPrice(plan.monthly_price)}
                            <span className="text-xs font-normal text-muted-foreground">/mês</span>
                          </p>
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 text-xs">
                            +{formatPrice(plan.monthly_price - currentPrice)}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {upgradePlans.length === 0 && (
              <div className="flex items-center gap-2 p-4 rounded-lg bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  Você já está no plano mais completo disponível.
                  Entre em contato para soluções personalizadas.
                </p>
              </div>
            )}

            {/* Reason */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Motivo (opcional):</p>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Descreva por que precisa deste upgrade..."
                rows={3}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={() => setUpgradeDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleRequestUpgrade}
              disabled={!selectedPlanId || submitting}
            >
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Enviar Solicitação
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Inline variant for smaller contexts
export function FeatureGateInline({
  feature,
  children,
}: {
  feature: string;
  children: ReactNode;
}) {
  const { hasFeature, loading } = usePlanFeatures();

  if (loading) return null;
  if (!hasFeature(feature)) return null;

  return <>{children}</>;
}
