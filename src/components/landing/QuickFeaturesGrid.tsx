import {
  Smartphone,
  RefreshCw,
  Activity,
  Cloud,
  Settings,
  Wallet,
} from "lucide-react";

const features = [
  {
    icon: Smartphone,
    title: "App Mobile",
    description: "Carteirinha digital, notificações push e autoatendimento completo para seus associados.",
  },
  {
    icon: RefreshCw,
    title: "Migração Gratuita",
    description: "Nossa equipe realiza a migração completa dos dados do seu sistema anterior com segurança.",
  },
  {
    icon: Activity,
    title: "Tempo Real",
    description: "Dashboard completo com informações atualizadas em tempo real para tomada de decisão.",
  },
  {
    icon: Cloud,
    title: "100% Cloud",
    description: "Sem servidores locais. Backup automático, segurança e acesso de qualquer lugar.",
  },
  {
    icon: Settings,
    title: "Personalizável",
    description: "Adaptamos o sistema à rotina da sua entidade sindical sem custo adicional.",
  },
  {
    icon: Wallet,
    title: "Módulo Financeiro",
    description: "Boletos registrados, controle de arrecadação e integração bancária completa.",
  },
];

export function QuickFeaturesGrid() {
  return (
    <section className="py-20 lg:py-28 bg-muted/20">
      <div className="container">
        <div className="text-center mb-16">
          <span className="text-primary font-semibold text-sm uppercase tracking-widest mb-3 block">
            Benefícios
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4 tracking-tight">
            Mais do que um sistema
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Soluções integradas que impulsionam a gestão do seu sindicato
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group relative bg-card border border-border/50 rounded-2xl p-7 hover:shadow-xl hover:border-primary/20 transition-all duration-500 hover:-translate-y-1"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/8 flex items-center justify-center mb-5 group-hover:bg-primary/15 transition-colors duration-300">
                <feature.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-base font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
                {feature.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
