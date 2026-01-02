import { 
  Calendar, 
  FileText, 
  Video,
  CreditCard,
  ClipboardList,
  Receipt,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const features = [
  { 
    icon: Calendar, 
    category: "GESTÃO CLÍNICA",
    title: "Controle da clínica de ponta a ponta", 
    description: "Reduza até 38% das ausências de pacientes nos atendimentos.",
    link: "#features"
  },
  { 
    icon: FileText, 
    category: "PRONTUÁRIO ELETRÔNICO",
    title: "Todos os registros do paciente em tela única", 
    description: "Otimize até 42% do tempo com o prontuário personalizável.",
    link: "#features"
  },
  { 
    icon: Video, 
    category: "TELECONSULTA",
    title: "Teleconsultas ilimitadas", 
    description: "Atenda pacientes de diferentes lugares do Brasil e do mundo.",
    link: "#features"
  },
  { 
    icon: ClipboardList, 
    category: "AGENDAMENTO ONLINE",
    title: "Agendamento 24 horas por dia", 
    description: "Simplifique o agendamento para seus pacientes e automatize os processos.",
    link: "#features"
  },
  { 
    icon: CreditCard, 
    category: "GESTÃO FINANCEIRA",
    title: "Gestão financeira descomplicada", 
    description: "Controle as finanças da clínica com relatórios gerenciais.",
    link: "#features"
  },
  { 
    icon: Receipt, 
    category: "FATURAMENTO TISS",
    title: "Reduza 99% das glosas", 
    description: "Facilite a comunicação entre clínicas e operadoras de saúde.",
    link: "#features"
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-20 lg:py-28 bg-background">
      <div className="container">
        {/* Section Header */}
        <div className="text-center mb-16">
          <span className="section-badge mb-4">
            CONECTAR PARA CUIDAR
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            Gestão clínica simplificada para você<br />
            <span className="gradient-text">focar no seu paciente</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Conheça a solução intuitiva e completa que cuida da sua clínica enquanto você prioriza a experiência de quem confia em você.
          </p>
          <div className="mt-8">
            <Button 
              size="lg"
              className="btn-eclini px-8 h-14 text-base shadow-lg"
              asChild
            >
              <Link to="/cadastro">
                Começar agora
              </Link>
            </Button>
          </div>
        </div>

        {/* Features Carousel/Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <div
              key={i}
              className="feature-card group cursor-pointer"
            >
              <div className="feature-card-icon mb-4">
                <feature.icon className="h-6 w-6" />
              </div>
              <span className="text-xs font-bold tracking-wider mb-3 block gradient-text">
                {feature.category}
              </span>
              <h3 className="text-xl font-bold text-foreground mb-3 group-hover:text-primary transition-colors">
                {feature.title}
              </h3>
              <p className="text-muted-foreground mb-4">
                {feature.description}
              </p>
              <a 
                href={feature.link}
                className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:gap-3 transition-all"
              >
                Conhecer solução
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}