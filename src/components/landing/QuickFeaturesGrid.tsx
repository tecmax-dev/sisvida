import {
  Smartphone,
  RefreshCw,
  Activity,
  Cloud,
  Settings,
  Wallet,
} from "lucide-react";
import { Link } from "react-router-dom";

const features = [
  {
    icon: Smartphone,
    title: "App mobile",
    description:
      "Aproxime-se de seus filiados com um aplicativo personalizado e totalmente integrado. Carteirinha digital, notificações e autoatendimento.",
    link: "/cadastro",
    linkText: "Saiba mais",
  },
  {
    icon: RefreshCw,
    title: "Troque de sistema",
    description:
      "Realize a migração completa dos dados do seu sistema anterior para o ProsindWeb. Nossa equipe garante segurança e eficiência.",
    link: "/cadastro",
    linkText: "Fale conosco",
  },
  {
    icon: Activity,
    title: "Em tempo real",
    description:
      "Automatize sua rotina e melhore a tomada de decisões com informações em tempo real. Dashboard completo para o seu dia a dia.",
    link: "/cadastro",
    linkText: "Ver recursos",
  },
  {
    icon: Cloud,
    title: "Cloud",
    description:
      "Reduza os gastos com servidores locais. Oferecemos servidor dedicado com backups automáticos inclusos.",
    link: "/cadastro",
    linkText: "Ver planos",
  },
  {
    icon: Settings,
    title: "Flexível",
    description:
      "Adquira uma solução personalizada para a rotina da sua entidade sindical ou associação. Analisamos alterações sem custo adicional.",
    link: "/cadastro",
    linkText: "Solicitar proposta",
  },
  {
    icon: Wallet,
    title: "Financeiro",
    description:
      "Gere boletos registrados com facilidade, sem burocracias. Total integração financeira em suas mãos.",
    link: "/cadastro",
    linkText: "Conhecer módulo",
  },
];

export function QuickFeaturesGrid() {
  return (
    <section className="py-16 lg:py-24 bg-muted/30">
      <div className="container">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Muito além de um sistema: mais benefícios para sua entidade
          </h2>
          <p className="text-muted-foreground text-lg max-w-3xl mx-auto">
            Descubra como podemos impulsionar a gestão do seu sindicato ou associação com soluções personalizadas, inovadoras e eficientes.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {features.map((feature, index) => (
            <div
              key={index}
              className="bg-card border border-border rounded-2xl p-6 hover:shadow-lg hover:border-primary/30 transition-all duration-300 hover:-translate-y-1 group"
            >
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <feature.icon className="h-7 w-7 text-primary" />
              </div>

              <h3 className="text-lg font-bold text-foreground mb-3 group-hover:text-primary transition-colors">
                {feature.title}
              </h3>

              <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                {feature.description}
              </p>

              <Link
                to={feature.link}
                className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
              >
                {feature.linkText}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
