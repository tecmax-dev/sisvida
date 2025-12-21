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
  Stethoscope,
  ClipboardList,
  Wallet,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const mainFeatures = [
  { 
    icon: Calendar, 
    title: "Agenda Inteligente", 
    description: "Gerencie agendamentos com drag-and-drop, visualize por dia, semana ou mês. Reduza faltas em até 80% com confirmações automáticas.",
    highlight: true
  },
  { 
    icon: MessageCircle, 
    title: "WhatsApp Integrado", 
    description: "Lembretes automáticos, confirmações e envio de documentos diretamente pelo WhatsApp. Seus pacientes nunca mais esquecem.",
    highlight: true
  },
  { 
    icon: FileText, 
    title: "Prontuário Eletrônico", 
    description: "Histórico completo do paciente, anamnese personalizável, prescrições e atestados com assinatura digital.",
    highlight: true
  },
  { 
    icon: Video, 
    title: "Teleconsulta Integrada", 
    description: "Consultas por vídeo diretamente pelo sistema. Paciente acessa via link único, sem instalar nada. Compartilhe tela e documentos.",
    highlight: true
  },
];

const otherFeatures = [
  { icon: Wallet, title: "Gestão Financeira", description: "Controle receitas e despesas" },
  { icon: Stethoscope, title: "Anamnese Customizável", description: "Formulários por especialidade" },
  { icon: ClipboardList, title: "Prescrição Digital", description: "Com assinatura digital" },
  { icon: Users, title: "Gestão de Pacientes", description: "Cadastro completo" },
  { icon: CreditCard, title: "Convênios", description: "Planos de saúde integrados" },
  { icon: Clock, title: "Lista de Espera", description: "Reencaixe automático" },
  { icon: BarChart3, title: "Relatórios", description: "Análises detalhadas" },
  { icon: Smartphone, title: "Agendamento 24/7", description: "Página online para pacientes" },
  { icon: Bell, title: "Notificações", description: "Alertas em tempo real" },
  { icon: Shield, title: "Segurança LGPD", description: "Dados protegidos" },
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-20 lg:py-28 bg-card">
      <div className="container">
        <div className="text-center mb-16">
          <span className="text-primary font-medium text-sm uppercase tracking-wider mb-3 block">
            Recursos completos
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            Tudo para sua clínica
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Ferramentas poderosas para otimizar sua gestão e oferecer o melhor atendimento
          </p>
        </div>

        {/* Main Features - Large Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 mb-12">
          {mainFeatures.map((feature, i) => (
            <div
              key={i}
              className="group relative p-8 rounded-3xl bg-gradient-to-br from-primary/5 to-accent/5 border border-primary/20 hover:border-primary/40 transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
            >
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                <feature.icon className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-3">
                {feature.title}
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        {/* Other Features - Compact Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {otherFeatures.map((feature, i) => (
            <div
              key={i}
              className="group p-4 rounded-xl bg-background border border-border hover:border-primary/30 hover:shadow-md transition-all duration-300"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                <feature.icon className="w-5 h-5 text-primary" />
              </div>
              <h4 className="font-semibold text-foreground text-sm mb-1">
                {feature.title}
              </h4>
              <p className="text-xs text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-16 text-center">
          <Button 
            size="lg"
            className="bg-cta hover:bg-cta-hover text-cta-foreground rounded-full px-8 h-14 text-base shadow-lg transition-all duration-300 hover:scale-105"
            asChild
          >
            <Link to="/cadastro">
              Experimentar grátis por 7 dias
            </Link>
          </Button>
          <p className="mt-4 text-sm text-muted-foreground">
            Sem cartão de crédito • Cancele quando quiser
          </p>
        </div>
      </div>
    </section>
  );
}
