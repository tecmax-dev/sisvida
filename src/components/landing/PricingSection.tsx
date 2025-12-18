import { Button } from "@/components/ui/button";
import { Check, Star } from "lucide-react";
import { Link } from "react-router-dom";

const plans = [
  {
    name: "Gratuito",
    price: "R$ 0",
    period: "/mês",
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
    price: "R$ 99",
    period: "/mês",
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
    cta: "Testar 14 dias grátis",
    popular: true,
  },
  {
    name: "Clínica",
    price: "R$ 199",
    period: "/mês",
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
  return (
    <section id="pricing" className="py-20 lg:py-28 bg-white">
      <div className="container">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-primary">
            Planos para todos os tamanhos
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Escolha o plano ideal para sua clínica. Sem fidelidade, cancele quando quiser.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 lg:gap-8 max-w-5xl mx-auto">
          {plans.map((plan, i) => (
            <div
              key={i}
              className={`relative rounded-3xl p-8 border transition-all duration-300 ${
                plan.popular
                  ? "bg-primary text-primary-foreground border-primary shadow-2xl shadow-primary/20 scale-105"
                  : "bg-white border-border hover:border-primary/30 hover:shadow-lg"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-warning text-warning-foreground text-xs font-bold px-4 py-1.5 rounded-full flex items-center gap-1">
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
                <span className="text-4xl font-bold">{plan.price}</span>
                <span className={`text-sm ${plan.popular ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                  {plan.period}
                </span>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, j) => (
                  <li key={j} className="flex items-start gap-3">
                    <Check className={`h-5 w-5 flex-shrink-0 ${plan.popular ? "" : "text-primary"}`} />
                    <span className={`text-sm ${plan.popular ? "" : "text-muted-foreground"}`}>
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <Button
                className={`w-full rounded-full h-12 ${
                  plan.popular
                    ? "bg-white text-primary hover:bg-white/90"
                    : "bg-primary text-primary-foreground hover:bg-primary/90"
                }`}
                asChild
              >
                <Link to="/auth?tab=signup">{plan.cta}</Link>
              </Button>
            </div>
          ))}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-10">
          Todos os planos incluem suporte técnico e atualizações gratuitas.
        </p>
      </div>
    </section>
  );
}
