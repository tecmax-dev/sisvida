import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, Check, Star, Users, Shield } from "lucide-react";
import heroMockupScreens from "@/assets/hero-mockup-screens.png";

const highlights = [
  "Agenda online 24h",
  "Lembretes WhatsApp automáticos",
  "Prontuário eletrônico completo",
  "Teleconsulta integrada",
];

export function HeroSection() {
  return (
    <section className="relative min-h-[90vh] flex items-center pt-20 lg:pt-24 pb-12 overflow-hidden">
      {/* Animated background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/10 animate-pulse-soft" />
      
      {/* Floating orbs */}
      <div className="absolute top-20 right-0 w-[500px] h-[500px] bg-primary/15 rounded-full blur-3xl animate-float" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-accent/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />
      <div className="absolute top-1/2 left-1/4 w-[300px] h-[300px] bg-primary/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '4s' }} />
      
      {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--primary)/0.03)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--primary)/0.03)_1px,transparent_1px)] bg-[size:4rem_4rem]" />
      
      {/* Radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-primary/10 via-transparent to-transparent rounded-full blur-2xl" />
      
      <div className="container relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left Column - Content */}
          <div className="order-2 lg:order-1">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 backdrop-blur-sm rounded-full mb-6 animate-fade-in border border-primary/20 hover:bg-primary/15 transition-colors cursor-default">
              <Star className="h-4 w-4 text-primary fill-primary animate-pulse-soft" />
              <span className="text-sm font-medium text-primary">Sistema #1 para clínicas no Brasil</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight text-foreground animate-fade-in" style={{ animationDelay: '100ms' }}>
              Simplifique a gestão
              <br />
              <span className="text-primary relative">
                da sua clínica
                <svg className="absolute -bottom-2 left-0 w-full h-3 text-primary/30" viewBox="0 0 200 12" preserveAspectRatio="none">
                  <path d="M0,6 Q50,0 100,6 T200,6" stroke="currentColor" strokeWidth="3" fill="none" className="animate-pulse-soft" />
                </svg>
              </span>
            </h1>

            <p className="mt-8 text-lg lg:text-xl text-muted-foreground leading-relaxed max-w-lg animate-fade-in" style={{ animationDelay: '200ms' }}>
              Organize agendamentos, automatize lembretes e gerencie seu negócio em um só lugar. 
              Junte-se a milhares de profissionais de saúde.
            </p>

            {/* Highlights */}
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3 animate-fade-in" style={{ animationDelay: '300ms' }}>
              {highlights.map((item, i) => (
                <div 
                  key={i} 
                  className="flex items-center gap-3 text-foreground group hover:translate-x-1 transition-transform duration-300"
                  style={{ animationDelay: `${300 + i * 100}ms` }}
                >
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 group-hover:scale-110 transition-all duration-300">
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
                className="bg-cta hover:bg-cta-hover text-cta-foreground rounded-full px-8 h-14 text-base shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-cta/25 group"
                asChild
              >
                <Link to="/cadastro" className="flex items-center gap-2">
                  Começar grátis por 7 dias
                  <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
              <Button 
                size="lg"
                variant="outline" 
                className="border-primary/30 text-primary hover:bg-primary/5 hover:border-primary/50 rounded-full px-8 h-14 text-base backdrop-blur-sm transition-all duration-300 hover:scale-105"
                asChild
              >
                <a href="#pricing">
                  Ver planos e preços
                </a>
              </Button>
            </div>

            {/* Social Proof */}
            <div className="mt-10 flex items-center gap-8 text-sm text-muted-foreground animate-fade-in" style={{ animationDelay: '500ms' }}>
              <div className="flex items-center gap-2 hover:text-foreground transition-colors">
                <Users className="h-5 w-5 text-primary" />
                <span><strong className="text-foreground">+10.000</strong> clínicas</span>
              </div>
              <div className="flex items-center gap-2 hover:text-foreground transition-colors">
                <div className="flex -space-x-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 text-warning fill-warning animate-pulse-soft" style={{ animationDelay: `${i * 200}ms` }} />
                  ))}
                </div>
                <span><strong className="text-foreground">4.9</strong> no Google</span>
              </div>
              <div className="hidden sm:flex items-center gap-2 hover:text-foreground transition-colors">
                <Shield className="h-5 w-5 text-primary" />
                <span>LGPD</span>
              </div>
            </div>
          </div>

          {/* Right Column - Mockup */}
          <div className="order-1 lg:order-2 flex justify-center lg:justify-end">
            <div className="relative w-full max-w-2xl lg:max-w-3xl xl:max-w-4xl group">
              {/* Glow effect behind mockup */}
              <div className="absolute -inset-4 bg-gradient-to-br from-primary/20 via-primary/5 to-accent/20 rounded-3xl blur-2xl opacity-60 group-hover:opacity-80 transition-opacity duration-500" />
              
              <div className="relative animate-fade-in" style={{ animationDelay: '300ms' }}>
                <img 
                  src={heroMockupScreens}
                  alt="Múltiplas telas do sistema Eclini - Dashboard, agenda, teleconsulta e relatórios"
                  className="w-full h-auto object-contain drop-shadow-2xl transition-transform duration-700 group-hover:scale-[1.02]"
                />
                
                {/* Floating badges */}
                <div className="absolute -top-4 -right-4 bg-background/90 backdrop-blur-md rounded-xl px-4 py-2 shadow-lg border border-border/50 animate-float hidden lg:block">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-sm font-medium">Online 24h</span>
                  </div>
                </div>
                
                <div className="absolute -bottom-4 -left-4 bg-background/90 backdrop-blur-md rounded-xl px-4 py-2 shadow-lg border border-border/50 animate-float hidden lg:block" style={{ animationDelay: '1s' }}>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">100% Seguro</span>
                  </div>
                </div>
              </div>
              
              {/* Decorative elements */}
              <div className="absolute -z-10 inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10 rounded-3xl blur-3xl scale-110 animate-pulse-soft" />
            </div>
          </div>
        </div>
      </div>
      
      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
}