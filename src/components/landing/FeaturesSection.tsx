import { 
  Calendar, 
  Bell, 
  Users, 
  CreditCard, 
  BarChart3, 
  Smartphone,
  Clock,
  Shield
} from "lucide-react";

const features = [
  {
    icon: Calendar,
    title: "Agenda Inteligente",
    description: "Visualize e gerencie agendamentos de múltiplos profissionais em uma interface intuitiva com calendário dinâmico.",
  },
  {
    icon: Bell,
    title: "Lembretes WhatsApp",
    description: "Envio automático de lembretes 48h e 24h antes. Pacientes confirmam ou cancelam com um clique.",
  },
  {
    icon: Smartphone,
    title: "Agendamento Online",
    description: "Página de agendamento 24/7 que pode ser integrada ao seu site ou Google Maps.",
  },
  {
    icon: Users,
    title: "Gestão de Pacientes",
    description: "Cadastro completo com histórico de consultas, anotações e dados de contato organizados.",
  },
  {
    icon: CreditCard,
    title: "Convênios",
    description: "Pacientes indicam o plano de saúde no agendamento, facilitando a validação prévia.",
  },
  {
    icon: Clock,
    title: "Lista de Espera",
    description: "Reencaixe automático de pacientes quando consultas são canceladas.",
  },
  {
    icon: BarChart3,
    title: "Relatórios",
    description: "Análises de fluxo de consultas, taxas de no-show e desempenho por convênio.",
  },
  {
    icon: Shield,
    title: "Segurança",
    description: "Dados protegidos com criptografia e conformidade com LGPD.",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-20 lg:py-28 bg-background">
      <div className="container">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-sm font-medium text-primary uppercase tracking-wider">
            Funcionalidades
          </span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-foreground">
            Tudo que sua clínica precisa
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Ferramentas pensadas para simplificar o dia a dia da sua recepção 
            e melhorar a experiência dos pacientes.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, i) => (
            <div
              key={i}
              className="group p-6 rounded-2xl bg-card border border-border hover:border-primary/30 hover:shadow-lg transition-all duration-300 card-hover"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
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
