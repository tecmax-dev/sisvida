import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Check, Star, Sparkles, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";

interface PlanFeature {
  id: string;
  name: string;
}

interface Plan {
  id: string;
  name: string;
  description: string | null;
  monthly_price: number;
  max_professionals: number;
  features: string[];
  linkedFeatures: PlanFeature[];
}

export function PricingSection() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [isYearly, setIsYearly] = useState(false);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      // Fetch public active plans
      const { data: plansData, error: plansError } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .eq('is_public', true)
        .order('monthly_price', { ascending: true });

      if (plansError) throw plansError;

      // Fetch linked features for each plan
      const plansWithFeatures = await Promise.all(
        (plansData || []).map(async (plan) => {
          const { data: linkedData } = await supabase
            .from('plan_features')
            .select('feature_id, system_features(id, name)')
            .eq('plan_id', plan.id);

          const linkedFeatures = (linkedData || [])
            .map((pf: any) => pf.system_features)
            .filter(Boolean);

          return {
            ...plan,
            features: Array.isArray(plan.features) 
              ? (plan.features as unknown[]).map(f => String(f))
              : [],
            linkedFeatures,
          };
        })
      );

      setPlans(plansWithFeatures);
    } catch (error) {
      console.error("Error fetching plans:", error);
    } finally {
      setLoading(false);
    }
  };

  // Find most popular plan (middle one or marked)
  const popularIndex = plans.length === 3 ? 1 : Math.floor(plans.length / 2);

  if (loading) {
    return (
      <section id="pricing" className="py-20 lg:py-28 bg-background">
        <div className="container flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </section>
    );
  }

  if (plans.length === 0) {
    return null;
  }

  return (
    <section id="pricing" className="py-20 lg:py-28 bg-background">
      <div className="container">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-primary font-medium text-sm uppercase tracking-wider mb-3 block">
            Planos e preços
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            Escolha o plano ideal
          </h2>
          <p className="text-muted-foreground text-lg">
            Sem fidelidade, cancele quando quiser. Todos os planos incluem suporte técnico.
          </p>
        </div>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-4 mb-12">
          <span className={`text-sm font-medium transition-colors ${!isYearly ? 'text-foreground' : 'text-muted-foreground'}`}>
            Mensal
          </span>
          <button
            onClick={() => setIsYearly(!isYearly)}
            className={`relative w-16 h-8 rounded-full transition-colors duration-300 ${
              isYearly ? 'bg-primary' : 'bg-muted'
            }`}
          >
            <span
              className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-300 ${
                isYearly ? 'translate-x-8' : 'translate-x-0'
              }`}
            />
          </button>
          <span className={`text-sm font-medium transition-colors ${isYearly ? 'text-foreground' : 'text-muted-foreground'}`}>
            Anual
          </span>
          {isYearly && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-success/10 text-success text-xs font-semibold rounded-full">
              <Sparkles className="h-3 w-3" />
              Economize 20%
            </span>
          )}
        </div>

        <div className={`grid gap-6 lg:gap-8 max-w-5xl mx-auto ${
          plans.length === 1 ? 'md:grid-cols-1 max-w-md' :
          plans.length === 2 ? 'md:grid-cols-2 max-w-3xl' :
          'md:grid-cols-3'
        }`}>
          {plans.map((plan, i) => {
            const isPopular = i === popularIndex && plans.length > 1;
            const monthlyPrice = plan.monthly_price;
            const priceValue = isYearly ? Math.round(monthlyPrice * 0.8) : monthlyPrice;
            const formattedPrice = priceValue.toLocaleString('pt-BR', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            });
            
            // Combine descriptive features with linked features
            const displayFeatures = [
              ...plan.features,
              ...plan.linkedFeatures.map(f => f.name)
            ].slice(0, 8);
            
            return (
              <div
                key={plan.id}
                className={`relative rounded-3xl p-8 border transition-all duration-300 ${
                  isPopular
                    ? "bg-primary text-primary-foreground border-primary shadow-2xl shadow-primary/20 scale-105 z-10"
                    : "bg-card border-border hover:border-primary/30 hover:shadow-lg"
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-cta text-cta-foreground text-xs font-bold px-4 py-1.5 rounded-full flex items-center gap-1 shadow-lg">
                    <Star className="h-3 w-3 fill-current" />
                    Mais Popular
                  </div>
                )}

                <div className="mb-6">
                  <h3 className={`text-xl font-bold ${isPopular ? "" : "text-foreground"}`}>
                    {plan.name}
                  </h3>
                  <p className={`text-sm mt-1 ${isPopular ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                    {plan.description || `Até ${plan.max_professionals} profissional(is)`}
                  </p>
                </div>

                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className={`text-sm ${isPopular ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                      R$
                    </span>
                    <span className="text-5xl font-bold">{formattedPrice}</span>
                  </div>
                  <span className={`text-sm ${isPopular ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                    /mês {isYearly && priceValue > 0 && "(cobrado anualmente)"}
                  </span>
                </div>

                <ul className="space-y-3 mb-8">
                  {displayFeatures.map((feature, j) => (
                    <li key={j} className="flex items-start gap-3">
                      <Check className={`h-5 w-5 flex-shrink-0 mt-0.5 ${isPopular ? "" : "text-primary"}`} />
                      <span className={`text-sm ${isPopular ? "" : "text-muted-foreground"}`}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                <Button
                  className={`w-full rounded-full h-12 text-base font-semibold transition-all duration-300 hover:scale-[1.02] ${
                    isPopular
                      ? "bg-white text-primary hover:bg-white/90"
                      : "bg-primary text-primary-foreground hover:bg-primary/90"
                  }`}
                  asChild
                >
                  <Link to="/cadastro">
                    {priceValue === 0 ? "Começar grátis" : "Testar grátis"}
                  </Link>
                </Button>
              </div>
            );
          })}
        </div>

        {/* Trust badges */}
        <div className="mt-16 text-center">
          <p className="text-muted-foreground text-sm mb-4">
            Garantia de 7 dias • Cancele a qualquer momento • Suporte em português
          </p>
          <div className="flex items-center justify-center gap-6 text-muted-foreground flex-wrap">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-success" />
              <span className="text-sm">Sem taxas ocultas</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-success" />
              <span className="text-sm">Suporte à migração</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-success" />
              <span className="text-sm">Dados seguros (LGPD)</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
