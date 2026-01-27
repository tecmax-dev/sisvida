import { 
  FileText, 
  Calendar, 
  Video, 
  Smile,
  Wallet,
  ArrowRight,
  Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface FeatureBlockProps {
  icon: React.ElementType;
  category: string;
  title: string;
  description: string;
  features: string[];
  imagePosition: "left" | "right";
  bgColor?: string;
}

function FeatureBlock({ 
  icon: Icon, 
  category, 
  title, 
  description, 
  features, 
  imagePosition,
  bgColor = "bg-background"
}: FeatureBlockProps) {
  const content = (
    <div className="lg:w-1/2">
      <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground mb-4">
        {title}
      </h2>
      
      <p className="text-muted-foreground mb-6 leading-relaxed">
        {description}
      </p>

      <ul className="space-y-3 mb-8">
        {features.map((feature, index) => (
          <li key={index} className="flex items-start gap-3">
            <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Check className="h-3 w-3 text-primary" />
            </div>
            <span className="text-muted-foreground text-sm">{feature}</span>
          </li>
        ))}
      </ul>

      <Button 
        variant="link"
        className="p-0 h-auto text-primary font-semibold group"
        asChild
      >
        <Link to="/cadastro" className="flex items-center gap-2">
          Conheça todos os recursos
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </Button>
    </div>
  );

  const visual = (
    <div className="lg:w-1/2 flex justify-center">
      <div className="relative w-full max-w-md">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-cta/10 rounded-3xl blur-xl" />
        <div className="relative bg-card border border-border rounded-2xl p-8 shadow-lg">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-xl feature-card-icon">
              <Icon className="h-7 w-7" />
            </div>
            <div>
              <span className="text-xs font-bold tracking-wider gradient-text uppercase">{category}</span>
              <h4 className="font-bold text-foreground">{title.split(' ')[0]}</h4>
            </div>
          </div>
          
          {/* Placeholder visual */}
          <div className="aspect-video bg-muted/50 rounded-xl flex items-center justify-center">
            <Icon className="h-16 w-16 text-primary/20" />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className={cn("py-16 lg:py-20", bgColor)}>
      <div className="container">
        <div className={cn(
          "flex flex-col gap-12 items-center",
          imagePosition === "left" ? "lg:flex-row" : "lg:flex-row-reverse"
        )}>
          {visual}
          {content}
        </div>
      </div>
    </div>
  );
}

const featuresData = [
  {
    icon: FileText,
    category: "PRONTUÁRIO ELETRÔNICO",
    title: "Prontuário Eletrônico",
    description: "Chega de prontuários de papel. Com o Prontuário Eletrônico, sua clínica torna todo o processo muito mais rápido, organizado e eficiente.",
    features: [
      "Todos os campos e ferramentas são configuráveis",
      "Segurança total para salvar as informações",
      "Melhor comunicação entre profissionais e pacientes",
      "Facilidade para solicitar exames e prescrever medicamentos",
      "Agilidade para criação de modelos de laudos e atestados"
    ],
    imagePosition: "right" as const,
    bgColor: "bg-background"
  },
  {
    icon: Calendar,
    category: "AGENDA MÉDICA",
    title: "Agenda Médica Online",
    description: "Todos os seus compromissos, como consultas, lembretes e reuniões, podem ser marcados e ajustados de maneira rápida e prática com a agenda online.",
    features: [
      "Gerenciamento de múltiplas agendas, em tempo real",
      "Otimização do tempo para pacientes e profissionais",
      "Controle de disponibilidade e escala dos profissionais",
      "Central de agendamentos com sistema de Call Center",
      "Alterações simultâneas para um grande número de dados"
    ],
    imagePosition: "left" as const,
    bgColor: "bg-card"
  },
  {
    icon: Video,
    category: "TELEMEDICINA",
    title: "Telemedicina",
    description: "Seu paciente não precisa sair de casa para consultar. Do seu notebook ou celular, você faz uma chamada de vídeo, e tudo acontece como se estivesse na clínica.",
    features: [
      "Prescrição de medicamentos com receita e assinatura digital",
      "Cobranças por cartão de crédito ou emissão de boleto",
      "Somente pessoas autorizadas têm acesso aos documentos",
      "Tudo fica integrado ao prontuário eletrônico"
    ],
    imagePosition: "right" as const,
    bgColor: "bg-background"
  },
  {
    icon: Smile,
    category: "ODONTOLOGIA",
    title: "Odontologia",
    description: "Um sistema para clínica odontológica feito por profissionais perfeccionistas como você.",
    features: [
      "Planos de tratamento integrados com a agenda",
      "Gere o plano de tratamento em minutos com o Odontograma",
      "Prontuário odontológico personalizável",
      "Integre as áreas de avaliação, orçamento, tratamento e finanças",
      "Gestão de franquias"
    ],
    imagePosition: "left" as const,
    bgColor: "bg-card"
  },
  {
    icon: Wallet,
    category: "CONTROLE FINANCEIRO",
    title: "Controle Financeiro",
    description: "Nunca mais perca dinheiro! Nosso sistema proporciona visão completa do seu financeiro. Saiba quem pagou, quem está pendente, parcelamentos e fluxo de caixa.",
    features: [
      "Controle total de fluxo de caixa, contas a pagar e receber",
      "Gerenciamento de orçamentos e contratos",
      "Geração de boletos e links de pagamento para cartão",
      "Emissão simplificada de notas fiscais",
      "Conciliação de extrato bancário"
    ],
    imagePosition: "right" as const,
    bgColor: "bg-background"
  }
];

export function AlternatingFeaturesSection() {
  return (
    <section className="divide-y divide-border">
      {/* Section Header */}
      <div className="py-16 lg:py-20 bg-muted/30">
        <div className="container text-center">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            Simplifique a gestão da sua clínica com{" "}
            <span className="gradient-text">funcionalidades inteligentes.</span>
          </h2>
        </div>
      </div>

      {/* Feature Blocks */}
      {featuresData.map((feature, index) => (
        <FeatureBlock key={index} {...feature} />
      ))}
    </section>
  );
}
