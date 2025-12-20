import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Star, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

const plans = [
  {
    name: "Gratuito",
    monthlyPrice: 0,
    yearlyPrice: 0,
    description: "Ideal para começar",
    features: [
      "Até 50 agendamentos/mês",
      "1 profissional",
      "Agenda online básica",
      "Cadastro de pacientes",
      "Suporte por email",
    ],
    cta: "Começar grátis",
    popular: false,
  },
  {
    name: "Profissional",
    monthlyPrice: 99,
    yearlyPrice: 79,
    description: "Para clínicas em crescimento",
    features: [
      "Agendamentos ilimitados",
      "Até 5 profissionais",
      "Lembretes WhatsApp",
      "Prontuário eletrônico",
      "Relatórios básicos",
      "Lista de espera",
      "Suporte prioritário",
    ],
    cta: "Testar 7 dias grátis",
    popular: true,
  },
  {
    name: "Clínica",
    monthlyPrice: 199,
    yearlyPrice: 159,
    description: "Gestão completa",
    features: [
      "Tudo do Profissional",
      "Profissionais ilimitados",
      "Múltiplas unidades",
      "Gestão financeira",
      "Relatórios avançados",
      "API de integração",
      "Suporte dedicado",
      "Treinamento incluso",
    ],
    cta: "Falar com consultor",
    popular: false,
  },
];

export function PricingSection() {
  const [isYearly, setIsYearly] = useState(false);

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

        <div className="grid md:grid-cols-3 gap-6 lg:gap-8 max-w-5xl mx-auto">
          {plans.map((plan, i) => {
            const price = isYearly ? plan.yearlyPrice : plan.monthlyPrice;
            
            return (
              <div
                key={i}
                className={`relative rounded-3xl p-8 border transition-all duration-300 ${
                  plan.popular
                    ? "bg-primary text-primary-foreground border-primary shadow-2xl shadow-primary/20 scale-105 z-10"
                    : "bg-card border-border hover:border-primary/30 hover:shadow-lg"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-cta text-cta-foreground text-xs font-bold px-4 py-1.5 rounded-full flex items-center gap-1 shadow-lg">
                    <Star className="h-3 w-3 fill-current" />
                    Mais Popular
                  </div>
                )}

                <div className="mb-6">
                  <h3 className={`text-xl font-bold ${plan.popular ? "" : "text-foreground"}`}>
                    {plan.name}
                  </h3>
                  <p className={`text-sm mt-1 ${plan.popular ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                    {plan.description}
                  </p>
                </div>

                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className={`text-sm ${plan.popular ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                      R$
                    </span>
                    <span className="text-5xl font-bold">{price}</span>
                  </div>
                  <span className={`text-sm ${plan.popular ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                    /mês {isYearly && price > 0 && "(cobrado anualmente)"}
                  </span>
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, j) => (
                    <li key={j} className="flex items-start gap-3">
                      <Check className={`h-5 w-5 flex-shrink-0 mt-0.5 ${plan.popular ? "" : "text-primary"}`} />
                      <span className={`text-sm ${plan.popular ? "" : "text-muted-foreground"}`}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                <Button
                  className={`w-full rounded-full h-12 text-base font-semibold transition-all duration-300 hover:scale-[1.02] ${
                    plan.popular
                      ? "bg-white text-primary hover:bg-white/90"
                      : "bg-primary text-primary-foreground hover:bg-primary/90"
                  }`}
                  asChild
                >
                  <Link to="/auth?tab=signup">{plan.cta}</Link>
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
          <div className="flex items-center justify-center gap-6 text-muted-foreground">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-success" />
              <span className="text-sm">Sem taxas ocultas</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-success" />
              <span className="text-sm">Migração gratuita</span>
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
