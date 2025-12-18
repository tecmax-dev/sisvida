import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { 
  Calendar, 
  MessageCircle, 
  FileText, 
  Video, 
  CreditCard, 
  BarChart3,
  Package,
  Bot,
  FileCheck,
  Users,
  Presentation,
  Network,
  ChevronRight,
  CheckCircle2,
} from "lucide-react";
import heroMockup from "@/assets/hero-mockup.png";

const features = [
  { icon: Calendar, label: "Agenda Online" },
  { icon: MessageCircle, label: "WhatsApp" },
  { icon: FileText, label: "Prontuário Eletrônico" },
  { icon: FileCheck, label: "Assinatura Digital" },
  { icon: Video, label: "Telemedicina" },
  { icon: CreditCard, label: "Convênios" },
  { icon: BarChart3, label: "Gestão financeira" },
  { icon: Package, label: "Estoque" },
  { icon: Bot, label: "Agente de IA" },
  { icon: Users, label: "Marketing e CRM" },
  { icon: Presentation, label: "Relatórios" },
  { icon: Network, label: "+20 recursos" },
];

export function HeroSection() {
  return (
    <section className="relative bg-white py-12 lg:py-20 overflow-hidden">
      <div className="container">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
          {/* Left Column - Content */}
          <div className="order-2 lg:order-1">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight">
              <span className="text-primary">Sistema para clínicas</span>
              <br />
              <span className="text-primary">de multi especialidades</span>
            </h1>

            <p className="mt-6 text-base lg:text-lg text-muted-foreground max-w-xl leading-relaxed">
              Junte-se a profissionais da saúde de todo o Brasil e melhore sua gestão com o{" "}
              <Link to="/" className="text-foreground underline hover:text-primary transition-colors">
                Eclini
              </Link>
              . Ganhe tempo ao organizar sua agenda e economize gerenciando melhor sua clínica com o software 
              para controle e gestão mais completo e fácil de usar.
            </p>

            {/* Feature Tags */}
            <div className="mt-8 flex flex-wrap gap-x-4 gap-y-2">
              {features.map((feature, i) => (
                <div 
                  key={i} 
                  className="flex items-center gap-1.5 text-sm text-muted-foreground"
                >
                  <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                  <span>{feature.label}</span>
                </div>
              ))}
            </div>

            {/* CTA Buttons */}
            <div className="mt-10 flex flex-col sm:flex-row gap-4">
              <Button 
                size="lg" 
                className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full px-8 h-12"
                asChild
              >
                <Link to="/auth?tab=signup" className="flex items-center gap-2">
                  Quero testar agora
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button 
                variant="outline" 
                size="lg"
                className="border-primary text-primary hover:bg-primary/5 rounded-full px-8 h-12"
                asChild
              >
                <Link to="/#pricing" className="flex items-center gap-2">
                  Conheça os planos
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>

          {/* Right Column - Mockup Image */}
          <div className="order-1 lg:order-2 flex justify-center lg:justify-end">
            <div className="relative">
              <img 
                src={heroMockup} 
                alt="Eclini - Sistema de gestão para clínicas" 
                className="w-full max-w-lg lg:max-w-xl xl:max-w-2xl h-auto object-contain drop-shadow-2xl"
              />
              {/* Decorative gradient */}
              <div className="absolute -z-10 inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 rounded-3xl blur-3xl scale-110" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
