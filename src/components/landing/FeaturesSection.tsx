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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const features = [
  { 
    icon: Calendar, 
    title: "Agenda Online", 
    description: "Gerencie agendamentos com facilidade e reduza faltas" 
  },
  { 
    icon: MessageCircle, 
    title: "WhatsApp", 
    description: "Lembretes automáticos e confirmações via WhatsApp" 
  },
  { 
    icon: FileText, 
    title: "Prontuário Eletrônico", 
    description: "Histórico completo do paciente em um só lugar" 
  },
  { 
    icon: Stethoscope, 
    title: "Anamnese Digital", 
    description: "Formulários personalizados para cada especialidade" 
  },
  { 
    icon: ClipboardList, 
    title: "Prescrição Digital", 
    description: "Receitas e atestados com assinatura digital" 
  },
  { 
    icon: Users, 
    title: "Gestão de Pacientes", 
    description: "Cadastro completo com histórico de atendimentos" 
  },
  { 
    icon: CreditCard, 
    title: "Convênios", 
    description: "Gestão integrada de planos de saúde" 
  },
  { 
    icon: Clock, 
    title: "Lista de Espera", 
    description: "Reencaixe automático de pacientes" 
  },
  { 
    icon: BarChart3, 
    title: "Relatórios", 
    description: "Análises detalhadas da sua clínica" 
  },
  { 
    icon: Smartphone, 
    title: "Agendamento 24/7", 
    description: "Página online para agendamentos" 
  },
  { 
    icon: Bell, 
    title: "Notificações", 
    description: "Alertas e lembretes automáticos" 
  },
  { 
    icon: Shield, 
    title: "Segurança LGPD", 
    description: "Dados protegidos e em conformidade" 
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-16 lg:py-24 bg-muted/30">
      <div className="container">
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-16">
          {/* Left Column - Title */}
          <div className="lg:col-span-4">
            <div className="lg:sticky lg:top-24">
              <span className="text-sm font-medium text-primary uppercase tracking-wider">
                Recursos
              </span>
              <h2 className="mt-3 text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground leading-tight">
                Tudo que sua clínica precisa em um só lugar
              </h2>
              <p className="mt-4 text-muted-foreground text-base lg:text-lg leading-relaxed">
                Ferramentas completas para otimizar sua gestão e oferecer o melhor atendimento aos seus pacientes.
              </p>
              
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Button 
                  className="bg-cta hover:bg-cta-hover text-cta-foreground rounded-full px-6"
                  asChild
                >
                  <Link to="/auth?tab=signup">
                    Começar gratuitamente
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
          </div>

          {/* Right Column - Features Grid */}
          <div className="lg:col-span-8">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {features.map((feature, i) => (
                <div
                  key={i}
                  className="group p-5 rounded-2xl bg-card border border-border hover:border-primary/30 hover:shadow-lg transition-all duration-300"
                >
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-1.5">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
