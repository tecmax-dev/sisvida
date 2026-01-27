import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Check, Loader2 } from "lucide-react";
import heroMockupScreens from "@/assets/hero-mockup-screens.png";
import { useHeroSettings } from "@/hooks/useHeroSettings";

export function HeroSection() {
  const { data: settings, isLoading } = useHeroSettings();

  const title = settings?.title || "O software que resolve a gestão da clínica";
  const subtitle = settings?.subtitle || "";
  const description = settings?.description || "O Eclini é um sistema para clínicas com prontuário eletrônico, agenda médica online, controle financeiro e mais de 200 outros recursos.";
  const primaryButtonText = settings?.primary_button_text || "Solicite uma demonstração";
  const primaryButtonLink = settings?.primary_button_link || "/cadastro";
  const heroImage = settings?.hero_image_url || heroMockupScreens;

  const benefits = [
    "Reduza em até 50% a falta de pacientes",
    "Aumente em até 20% a receita com agendamentos online",
    "Mais de 70 mil profissionais"
  ];

  if (isLoading) {
    return (
      <section className="relative min-h-[90vh] flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </section>
    );
  }

  return (
    <section className="relative min-h-[85vh] flex items-center pt-24 lg:pt-28 pb-16 bg-background overflow-hidden">
      <div className="container relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
          {/* Left Column - Content */}
          <div className="text-left">
            {/* Badge */}
            <span className="text-muted-foreground text-sm font-medium tracking-wide mb-4 block">
              Sistema para clínicas
            </span>

            {/* Main headline - Clinica nas Nuvens style */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.1] mb-6">
              <span className="gradient-text">{title}</span>
              {subtitle && (
                <>
                  <br />
                  <span className="text-foreground">{subtitle}</span>
                </>
              )}
            </h1>
            
            <p className="text-lg text-muted-foreground max-w-xl mb-8 leading-relaxed">
              {description}
            </p>

            {/* Benefits List */}
            <ul className="space-y-3 mb-8">
              {benefits.map((benefit, index) => (
                <li key={index} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Check className="h-3 w-3 text-primary" />
                  </div>
                  <span className="text-foreground">{benefit}</span>
                </li>
              ))}
            </ul>

            {/* CTA Button - Outlined style like Clinica nas Nuvens */}
            <Button 
              size="lg" 
              variant="outline"
              className="btn-eclini-outline px-8 h-14 text-base"
              asChild
            >
              <Link to={primaryButtonLink}>
                {primaryButtonText}
              </Link>
            </Button>
          </div>

          {/* Right Column - Hero Image with floating cards */}
          <div className="relative flex justify-center lg:justify-end">
            {/* Background decorative circle */}
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-gradient-to-br from-primary/5 via-transparent to-cta/5 blur-3xl" />
            
            {/* Main image container */}
            <div className="relative">
              <img 
                src={heroImage}
                alt="Múltiplas telas do sistema Eclini - Dashboard, agenda e prontuário"
                className="w-full max-w-lg h-auto object-contain drop-shadow-xl animate-fade-in"
              />
              
              {/* Floating Card - Agendamentos */}
              <div className="absolute -left-4 top-1/4 bg-card border border-border rounded-xl p-3 shadow-lg animate-float hidden lg:block">
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Agendamentos</p>
                    <p className="text-lg font-bold text-foreground">450</p>
                  </div>
                  <div className="w-12 h-8 flex items-end gap-0.5">
                    <div className="w-2 h-4 bg-primary/40 rounded-t" />
                    <div className="w-2 h-6 bg-primary/60 rounded-t" />
                    <div className="w-2 h-5 bg-primary/50 rounded-t" />
                    <div className="w-2 h-8 bg-primary rounded-t" />
                  </div>
                </div>
              </div>

              {/* Floating Card - Resumo financeiro */}
              <div className="absolute -left-8 top-1/2 bg-card border border-border rounded-xl p-3 shadow-lg animate-float hidden lg:block" style={{ animationDelay: '0.5s' }}>
                <p className="text-xs text-muted-foreground mb-2">Resumo financeiro</p>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs text-muted-foreground">Total a receber</span>
                    <span className="text-xs font-semibold text-success">R$ 2.000,00</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs text-muted-foreground">A vencer</span>
                    <span className="text-xs font-medium">R$ 1.000,00</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs text-muted-foreground">Vencidos</span>
                    <span className="text-xs font-medium text-destructive">R$ 1.000,00</span>
                  </div>
                </div>
              </div>

              {/* Floating Card - Atendimentos */}
              <div className="absolute right-0 top-1/3 bg-card border border-border rounded-xl p-3 shadow-lg animate-float hidden lg:block" style={{ animationDelay: '1s' }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-muted-foreground">Atendimentos</span>
                  <span className="text-xs text-primary">→</span>
                </div>
                <div className="flex items-center gap-3">
                  <div>
                    <p className="text-sm font-bold">Total</p>
                    <p className="text-lg font-bold gradient-text">1500</p>
                  </div>
                  <div className="flex gap-1 items-center">
                    <div className="w-3 h-3 rounded-full bg-primary" />
                    <span className="text-xs">Particular</span>
                  </div>
                </div>
              </div>

              {/* Floating Card - Últimos 12 meses */}
              <div className="absolute right-4 bottom-1/4 bg-card border border-border rounded-xl p-3 shadow-lg animate-float hidden lg:block" style={{ animationDelay: '1.5s' }}>
                <p className="text-xs text-muted-foreground mb-2">Atendimentos últ. 12 meses</p>
                <div className="w-24 h-10">
                  <svg viewBox="0 0 100 40" className="w-full h-full">
                    <polyline
                      fill="none"
                      stroke="hsl(var(--primary))"
                      strokeWidth="2"
                      points="0,35 15,30 30,20 45,25 60,15 75,10 90,5 100,8"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
