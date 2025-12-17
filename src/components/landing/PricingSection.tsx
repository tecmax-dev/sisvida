import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { Link } from "react-router-dom";

const plans = [
  {
    name: "Básico",
    price: "Grátis",
    description: "Para clínicas iniciando",
    features: [
      "1 profissional",
      "50 agendamentos/mês",
      "Calendário básico",
      "Cadastro de pacientes",
      "Suporte por email",
    ],
    cta: "Começar grátis",
    variant: "outline" as const,
    popular: false,
  },
  {
    name: "Profissional",
    price: "R$ 149",
    period: "/mês",
    description: "Para clínicas em crescimento",
    features: [
      "Até 5 profissionais",
      "Agendamentos ilimitados",
      "Lembretes WhatsApp",
      "Agendamento online",
      "Gestão de convênios",
      "Relatórios básicos",
      "Suporte prioritário",
    ],
    cta: "Escolher plano",
    variant: "hero" as const,
    popular: true,
  },
  {
    name: "Enterprise",
    price: "Sob consulta",
    description: "Para redes de clínicas",
    features: [
      "Profissionais ilimitados",
      "Múltiplas unidades",
      "API de integração",
      "Relatórios avançados",
      "Treinamento dedicado",
      "Gerente de conta",
      "SLA garantido",
    ],
    cta: "Falar com vendas",
    variant: "outline" as const,
    popular: false,
  },
];

export function PricingSection() {
  return (
    <section id="pricing" className="py-20 lg:py-28 bg-gradient-soft">
      <div className="container">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-sm font-medium text-primary uppercase tracking-wider">
            Planos
          </span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-foreground">
            Escolha o plano ideal
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Comece gratuitamente e escale conforme sua clínica cresce.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans.map((plan, i) => (
            <div
              key={i}
              className={`relative p-8 rounded-2xl bg-card border transition-all duration-300 ${
                plan.popular
                  ? "border-primary shadow-lg scale-105 md:scale-110"
                  : "border-border hover:border-primary/30 hover:shadow-md"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-primary text-primary-foreground text-sm font-medium">
                  Mais popular
                </div>
              )}

              <div className="text-center mb-6">
                <h3 className="text-xl font-semibold text-foreground">
                  {plan.name}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {plan.description}
                </p>
                <div className="mt-4">
                  <span className="text-4xl font-bold text-foreground">
                    {plan.price}
                  </span>
                  {plan.period && (
                    <span className="text-muted-foreground">{plan.period}</span>
                  )}
                </div>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, j) => (
                  <li key={j} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <span className="text-sm text-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                variant={plan.variant}
                className="w-full"
                size="lg"
                asChild
              >
                <Link to="/auth?tab=signup">{plan.cta}</Link>
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
