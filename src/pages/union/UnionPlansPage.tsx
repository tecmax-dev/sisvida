import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, MessageCircle, ArrowRight, Scale, Building2, Users, Receipt, PiggyBank, FileBarChart, Handshake } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface UnionPlan {
  id: string;
  name: string;
  description: string | null;
  monthly_price: number;
  annual_price: number;
  features: string[];
  billing_period: string;
  trial_days: number;
  display_order: number;
  resource_limits: Record<string, number>;
  module_flags: Record<string, boolean>;
}

const MODULE_ICONS: Record<string, typeof Scale> = {
  empresas: Building2,
  socios: Users,
  contribuicoes: Receipt,
  financeiro: PiggyBank,
  negociacoes: Handshake,
  relatorios_avancados: FileBarChart,
};

const MODULE_LABELS: Record<string, string> = {
  empresas: 'Empresas',
  socios: 'Sócios',
  contribuicoes: 'Contribuições',
  financeiro: 'Financeiro',
  negociacoes: 'Negociações',
  relatorios_avancados: 'Relatórios Avançados',
};

export default function UnionPlansPage() {
  const { toast } = useToast();
  const [plans, setPlans] = useState<UnionPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('category', 'sindicato')
        .eq('is_active', true)
        .eq('is_public', true)
        .order('display_order', { ascending: true })
        .order('monthly_price', { ascending: true });

      if (error) throw error;

      const formattedPlans = (data || []).map(plan => ({
        ...plan,
        features: Array.isArray(plan.features) 
          ? (plan.features as unknown[]).map(f => String(f))
          : [],
        resource_limits: (plan.resource_limits as Record<string, number>) || {},
        module_flags: (plan.module_flags as Record<string, boolean>) || {},
      }));

      setPlans(formattedPlans);
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

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  };

  const getEnabledModules = (moduleFlags: Record<string, boolean>) => {
    return Object.entries(moduleFlags)
      .filter(([_, enabled]) => enabled)
      .map(([key]) => key);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Planos do Sistema Sindical</h1>
          <p className="text-muted-foreground">
            Escolha o plano ideal para sua entidade
          </p>
        </div>

        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Scale className="h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">Nenhum plano disponível</h3>
          <p className="text-muted-foreground max-w-md">
            Os planos para o Sistema Sindical ainda estão sendo configurados. 
            Entre em contato com nosso time comercial para mais informações.
          </p>
          <Button className="mt-6" asChild>
            <a 
              href="https://wa.me/5571982786864?text=Olá! Gostaria de saber mais sobre os planos do Sistema Sindical."
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              Falar com Comercial
            </a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="text-center mb-8">
        <Badge className="mb-4 bg-amber-100 text-amber-800 border-amber-200">
          <Scale className="h-3 w-3 mr-1" />
          PLANOS SINDICAIS
        </Badge>
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Escolha o plano ideal para sua entidade
        </h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Todos os planos incluem suporte técnico especializado e atualizações contínuas do sistema.
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plans.map((plan, index) => {
          const enabledModules = getEnabledModules(plan.module_flags);
          const isPopular = index === 1 && plans.length > 1;
          
          return (
            <Card 
              key={plan.id} 
              className={`relative flex flex-col ${isPopular ? 'border-primary shadow-lg scale-105' : ''}`}
            >
              {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground">
                    Mais Popular
                  </Badge>
                </div>
              )}
              
              <CardHeader className="text-center">
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                
                <div className="mt-4">
                  {plan.monthly_price === 0 ? (
                    <div className="text-3xl font-bold text-foreground">Gratuito</div>
                  ) : (
                    <>
                      <div className="text-3xl font-bold text-foreground">
                        {formatPrice(plan.monthly_price)}
                        <span className="text-base font-normal text-muted-foreground">/mês</span>
                      </div>
                      {plan.annual_price > 0 && (
                        <p className="text-sm text-muted-foreground mt-1">
                          ou {formatPrice(plan.annual_price)}/ano
                        </p>
                      )}
                    </>
                  )}
                </div>

                {plan.trial_days > 0 && (
                  <Badge variant="outline" className="mt-2">
                    {plan.trial_days} dias grátis
                  </Badge>
                )}
              </CardHeader>

              <CardContent className="flex-1 space-y-4">
                {/* Módulos incluídos */}
                {enabledModules.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2 text-muted-foreground">Módulos incluídos:</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {enabledModules.map((moduleKey) => {
                        const Icon = MODULE_ICONS[moduleKey] || Scale;
                        return (
                          <div 
                            key={moduleKey} 
                            className="flex items-center gap-2 text-sm p-2 rounded-lg bg-muted/50"
                          >
                            <Icon className="h-4 w-4 text-primary" />
                            <span>{MODULE_LABELS[moduleKey] || moduleKey}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Features list */}
                {plan.features.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2 text-muted-foreground">Recursos:</h4>
                    <ul className="space-y-2">
                      {plan.features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <Check className="h-4 w-4 text-cta flex-shrink-0 mt-0.5" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Resource limits */}
                {Object.keys(plan.resource_limits).length > 0 && (
                  <div className="text-xs text-muted-foreground border-t pt-3">
                    {plan.resource_limits.max_empresas && plan.resource_limits.max_empresas > 0 && (
                      <p>Até {plan.resource_limits.max_empresas} empresas</p>
                    )}
                    {plan.resource_limits.max_socios && plan.resource_limits.max_socios > 0 && (
                      <p>Até {plan.resource_limits.max_socios} sócios</p>
                    )}
                    {plan.resource_limits.max_usuarios && plan.resource_limits.max_usuarios > 0 && (
                      <p>Até {plan.resource_limits.max_usuarios} usuários</p>
                    )}
                  </div>
                )}
              </CardContent>

              <CardFooter className="flex flex-col gap-2">
                <Button className="w-full btn-eclini" asChild>
                  <a 
                    href={`https://wa.me/5571982786864?text=Olá! Tenho interesse no plano ${plan.name} do Sistema Sindical.`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Contratar plano
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </a>
                </Button>
                <Button variant="ghost" size="sm" className="w-full" asChild>
                  <a 
                    href="mailto:contato@eclini.com.br?subject=Dúvidas sobre planos sindicais"
                  >
                    Falar com comercial
                  </a>
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      <div className="text-center mt-8 p-6 bg-muted/30 rounded-2xl">
        <h3 className="font-semibold mb-2">Precisa de um plano personalizado?</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Para federações e confederações com necessidades específicas, oferecemos planos sob medida.
        </p>
        <Button variant="outline" asChild>
          <a 
            href="https://wa.me/5571982786864?text=Olá! Preciso de um plano personalizado para minha entidade sindical."
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircle className="h-4 w-4 mr-2" />
            Solicitar proposta
          </a>
        </Button>
      </div>
    </div>
  );
}
