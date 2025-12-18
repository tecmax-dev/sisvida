import { 
  Calendar, 
  Bell, 
  Users, 
  CreditCard, 
  BarChart3, 
  Smartphone,
  Clock,
  Shield,
  FileText,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const features = [
  {
    icon: Calendar,
    title: "Agenda Prática e Completa",
    description: "Com a agenda online do Eclini, sua equipe gerencia os agendamentos, diminui as faltas por meio do envio de lembretes automáticos via SMS e WhatsApp e ganha tempo para realizar o que realmente importa: o atendimento ao paciente.",
    highlight: "Tenha uma agenda personalizada e sempre cheia,",
    highlightText: " administre os horários disponíveis nas agendas de todos os profissionais. Fica mais fácil evitar horários vagos e o acúmulo de várias consultas em um mesmo período.",
    stats: [
      { value: "1 milhão+", label: "de agendamentos feitos" },
      { value: "WhatsApp", label: "confirmações automáticas" },
    ],
  },
  {
    icon: FileText,
    title: "Prontuário Eletrônico",
    description: "Registre o histórico médico completo dos seus pacientes de forma digital, segura e organizada. Acesse informações de qualquer lugar e a qualquer momento.",
    highlight: "Economize tempo e papel",
    highlightText: " com prontuários digitais que facilitam o acompanhamento do paciente e garantem conformidade com a LGPD.",
    stats: [
      { value: "100%", label: "digital e seguro" },
      { value: "LGPD", label: "em conformidade" },
    ],
  },
  {
    icon: MessageCircle,
    title: "Lembretes via WhatsApp",
    description: "Reduza as faltas em até 50% com lembretes automáticos enviados por WhatsApp. Pacientes confirmam ou cancelam com apenas um clique.",
    highlight: "Comunicação eficiente",
    highlightText: " que mantém seus pacientes informados e sua agenda organizada sem esforço manual.",
    stats: [
      { value: "50%", label: "menos faltas" },
      { value: "24/7", label: "disponível sempre" },
    ],
  },
];

const additionalFeatures = [
  { icon: Users, title: "Gestão de Pacientes", description: "Cadastro completo com histórico" },
  { icon: CreditCard, title: "Convênios", description: "Gestão de planos de saúde" },
  { icon: Clock, title: "Lista de Espera", description: "Reencaixe automático" },
  { icon: BarChart3, title: "Relatórios", description: "Análises detalhadas" },
  { icon: Smartphone, title: "Agendamento Online", description: "Página 24/7" },
  { icon: Shield, title: "Segurança", description: "Dados protegidos" },
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-20 lg:py-28 bg-muted/30">
      <div className="container">
        {/* Main Features */}
        {features.map((feature, index) => (
          <div 
            key={index}
            className={`grid lg:grid-cols-2 gap-12 items-center mb-20 lg:mb-32 ${
              index % 2 === 1 ? "lg:flex-row-reverse" : ""
            }`}
          >
            <div className={index % 2 === 1 ? "lg:order-2" : ""}>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-primary mb-6">
                {feature.title}
              </h2>
              <p className="text-muted-foreground text-base lg:text-lg leading-relaxed mb-4">
                {feature.description}
              </p>
              <p className="text-foreground text-base lg:text-lg leading-relaxed">
                <strong>{feature.highlight}</strong>
                {feature.highlightText}
              </p>

              {/* Stats */}
              <div className="flex gap-8 mt-8">
                {feature.stats.map((stat, i) => (
                  <div key={i}>
                    <div className="text-2xl lg:text-3xl font-bold text-primary">
                      {stat.value}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-4 mt-8">
                <Button 
                  className="bg-primary hover:bg-primary/90 rounded-full px-6"
                  asChild
                >
                  <Link to="/auth?tab=signup">
                    Quero começar com a versão gratuita
                  </Link>
                </Button>
                <Button 
                  variant="outline" 
                  className="border-primary text-primary hover:bg-primary/5 rounded-full px-6"
                  asChild
                >
                  <Link to="/#pricing">
                    Ver planos
                  </Link>
                </Button>
              </div>
            </div>

            <div className={`flex justify-center ${index % 2 === 1 ? "lg:order-1" : ""}`}>
              <div className="w-full max-w-md lg:max-w-lg bg-white rounded-3xl p-8 shadow-xl border border-border/50">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                  <feature.icon className="w-8 h-8 text-primary" />
                </div>
                <div className="space-y-4">
                  <div className="h-4 bg-muted rounded-full w-3/4" />
                  <div className="h-4 bg-muted rounded-full w-full" />
                  <div className="h-4 bg-muted rounded-full w-5/6" />
                  <div className="h-20 bg-primary/5 rounded-xl mt-6" />
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div className="h-16 bg-muted/50 rounded-lg" />
                    <div className="h-16 bg-muted/50 rounded-lg" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Additional Features Grid */}
        <div className="mt-16">
          <h3 className="text-xl sm:text-2xl font-bold text-center text-foreground mb-10">
            E muito mais recursos para sua clínica
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {additionalFeatures.map((feature, i) => (
              <div
                key={i}
                className="p-4 rounded-2xl bg-white border border-border hover:border-primary/30 hover:shadow-md transition-all duration-300 text-center"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <h4 className="font-semibold text-sm text-foreground mb-1">
                  {feature.title}
                </h4>
                <p className="text-xs text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
