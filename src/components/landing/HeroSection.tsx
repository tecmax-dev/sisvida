import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, Check, Star, Users, Shield } from "lucide-react";
// Imagem do dashboard gerada por IA com sidebar branca e tema teal
const dashboardMockup = "https://eahhszmbyxapxzilfdlo.supabase.co/storage/v1/object/public/carousel-images/dashboard-mockup-1766375649088.png";

const highlights = [
  "Agenda online 24h",
  "Lembretes WhatsApp automáticos",
  "Prontuário eletrônico completo",
  "Teleconsulta integrada",
];

export function HeroSection() {
  return (
    <section className="relative min-h-[90vh] flex items-center pt-20 lg:pt-24 pb-12 overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/10" />
      <div className="absolute top-20 right-0 w-[500px] h-[500px] bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-accent/20 rounded-full blur-3xl" />
      
      <div className="container relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left Column - Content */}
          <div className="order-2 lg:order-1">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full mb-6 animate-fade-in">
              <Star className="h-4 w-4 text-primary fill-primary" />
              <span className="text-sm font-medium text-primary">Sistema #1 para clínicas no Brasil</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight text-foreground animate-fade-in" style={{ animationDelay: '100ms' }}>
              Simplifique a gestão
              <br />
              <span className="text-primary">da sua clínica</span>
            </h1>

            <p className="mt-6 text-lg lg:text-xl text-muted-foreground leading-relaxed max-w-lg animate-fade-in" style={{ animationDelay: '200ms' }}>
              Organize agendamentos, automatize lembretes e gerencie seu negócio em um só lugar. 
              Junte-se a milhares de profissionais de saúde.
            </p>

            {/* Highlights */}
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3 animate-fade-in" style={{ animationDelay: '300ms' }}>
              {highlights.map((item, i) => (
                <div 
                  key={i} 
                  className="flex items-center gap-3 text-foreground"
                >
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Check className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <span className="text-sm font-medium">{item}</span>
                </div>
              ))}
            </div>

            {/* CTA Buttons */}
            <div className="mt-10 flex flex-col sm:flex-row gap-4 animate-fade-in" style={{ animationDelay: '400ms' }}>
              <Button 
                size="lg" 
                className="bg-cta hover:bg-cta-hover text-cta-foreground rounded-full px-8 h-14 text-base shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-xl"
                asChild
              >
                <Link to="/cadastro" className="flex items-center gap-2">
                  Começar grátis por 7 dias
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
              <Button 
                size="lg"
                variant="outline" 
                className="border-primary text-primary hover:bg-primary/5 rounded-full px-8 h-14 text-base"
                asChild
              >
                <a href="#pricing">
                  Ver planos e preços
                </a>
              </Button>
            </div>

            {/* Social Proof */}
            <div className="mt-10 flex items-center gap-8 text-sm text-muted-foreground animate-fade-in" style={{ animationDelay: '500ms' }}>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <span><strong className="text-foreground">+10.000</strong> clínicas</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex -space-x-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 text-warning fill-warning" />
                  ))}
                </div>
                <span><strong className="text-foreground">4.9</strong> no Google</span>
              </div>
              <div className="hidden sm:flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <span>LGPD</span>
              </div>
            </div>
          </div>

          {/* Right Column - Mockup */}
          <div className="order-1 lg:order-2 flex justify-center lg:justify-end">
            <div className="relative w-full max-w-lg lg:max-w-xl">
              <div className="overflow-hidden rounded-2xl shadow-2xl border border-border animate-float">
                <img 
                  src={dashboardMockup}
                  alt="Painel de agenda do Eclini - Sistema de gestão para clínicas"
                  className="w-full h-auto"
                />
              </div>
              {/* Decorative elements */}
              <div className="absolute -z-10 inset-0 bg-gradient-to-br from-primary/20 via-transparent to-accent/20 rounded-3xl blur-3xl scale-110" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
