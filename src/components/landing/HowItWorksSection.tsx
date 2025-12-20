import { UserPlus, Settings, Rocket } from "lucide-react";

const steps = [
  {
    icon: UserPlus,
    number: "01",
    title: "Crie sua conta",
    description: "Cadastre-se em menos de 2 minutos. Sem burocracia, sem cartão de crédito."
  },
  {
    icon: Settings,
    number: "02",
    title: "Configure sua clínica",
    description: "Adicione profissionais, procedimentos e personalize sua agenda conforme sua necessidade."
  },
  {
    icon: Rocket,
    number: "03",
    title: "Comece a usar",
    description: "Pronto! Comece a agendar consultas, enviar lembretes e gerenciar sua clínica."
  }
];

export function HowItWorksSection() {
  return (
    <section className="py-20 lg:py-28 bg-card">
      <div className="container">
        <div className="text-center mb-16">
          <span className="text-primary font-medium text-sm uppercase tracking-wider mb-3 block">
            Simples e rápido
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            Como funciona
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Comece a usar o Eclini em apenas 3 passos simples
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 lg:gap-12 max-w-5xl mx-auto">
          {steps.map((step, index) => (
            <div 
              key={index} 
              className="relative group"
            >
              {/* Connector line */}
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-16 left-[60%] w-full h-0.5 bg-gradient-to-r from-primary/50 to-transparent" />
              )}
              
              <div className="text-center relative z-10">
                {/* Icon container */}
                <div className="relative inline-flex mb-6">
                  <div className="w-24 h-24 rounded-2xl bg-primary/10 flex items-center justify-center transition-all duration-300 group-hover:bg-primary/20 group-hover:scale-105">
                    <step.icon className="h-10 w-10 text-primary" />
                  </div>
                  {/* Step number */}
                  <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-cta text-cta-foreground text-sm font-bold flex items-center justify-center shadow-lg">
                    {step.number}
                  </div>
                </div>
                
                <h3 className="text-xl font-semibold text-foreground mb-3">
                  {step.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
