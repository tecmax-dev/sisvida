import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Check, Loader2 } from "lucide-react";
import heroMockupScreens from "@/assets/hero-mockup-screens.png";
import { useHeroSettings } from "@/hooks/useHeroSettings";

export function HeroSection() {
  const { data: settings, isLoading } = useHeroSettings();

  const title = settings?.title || "Gestão automatizada";
  const subtitle = settings?.subtitle || "para clínicas";
  const description = settings?.description || "Elimine processos manuais e veja os resultados crescerem";
  const primaryButtonText = settings?.primary_button_text || "Começar agora";
  const primaryButtonLink = settings?.primary_button_link || "/cadastro";
  const heroImage = settings?.hero_image_url || heroMockupScreens;
  const showSocialProof = settings?.show_social_proof ?? true;
  const socialProofUsers = settings?.social_proof_users || 70000;

  if (isLoading) {
    return (
      <section className="relative min-h-[90vh] flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </section>
    );
  }

  return (
    <section className="relative min-h-[90vh] flex items-center pt-20 lg:pt-24 pb-16 bg-background overflow-hidden">
      <div className="container relative z-10">
        {/* Social proof badge */}
        {showSocialProof && (
          <div className="flex justify-center mb-8 animate-fade-in">
            <div className="section-badge">
              <div className="flex -space-x-2 mr-2">
                <div className="w-7 h-7 rounded-full bg-primary/20 border-2 border-card flex items-center justify-center">
                  <span className="text-xs">👩‍⚕️</span>
                </div>
                <div className="w-7 h-7 rounded-full bg-cta/20 border-2 border-card flex items-center justify-center">
                  <span className="text-xs">👨‍⚕️</span>
                </div>
                <div className="w-7 h-7 rounded-full bg-primary/20 border-2 border-card flex items-center justify-center">
                  <span className="text-xs">👩‍⚕️</span>
                </div>
              </div>
              <span className="text-sm font-medium">
                Junte-se a <span className="font-bold">{socialProofUsers.toLocaleString('pt-BR')}+</span> profissionais da saúde
              </span>
            </div>
          </div>
        )}

        {/* Main headline */}
        <div className="text-center max-w-4xl mx-auto mb-8">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold leading-[1.1] text-foreground animate-fade-in">
            {title}
            {subtitle && (
              <>
                <br />
                <span className="gradient-text">{subtitle}</span>
              </>
            )}
          </h1>
          
          <p className="mt-6 text-lg lg:text-xl text-muted-foreground max-w-2xl mx-auto animate-fade-in" style={{ animationDelay: '100ms' }}>
            {description}
          </p>

          {/* CTA Button */}
          <div className="mt-8 animate-fade-in" style={{ animationDelay: '200ms' }}>
            <Button 
              size="lg" 
              className="btn-eclini px-10 h-14 text-base shadow-lg"
              asChild
            >
              <Link to={primaryButtonLink}>
                {primaryButtonText}
              </Link>
            </Button>
          </div>
        </div>

        {/* Hero Mockup */}
        <div className="relative mt-12 lg:mt-16 animate-fade-in" style={{ animationDelay: '300ms' }}>
          <div className="relative max-w-6xl mx-auto">
            {/* Main mockup image */}
            <div className="relative">
              <img 
                src={heroImage}
                alt="Múltiplas telas do sistema Eclini - Dashboard, agenda, teleconsulta e prontuário"
                className="w-full h-auto object-contain drop-shadow-2xl"
              />
              
              {/* Floating cards overlay - left side */}
              <div className="absolute left-0 top-1/4 -translate-x-1/2 hidden xl:block animate-float">
                <div className="bg-card border border-border rounded-2xl p-4 shadow-xl w-48">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="feature-card-icon w-8 h-8 rounded-lg">
                      <span>💰</span>
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">Controle financeiro</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between py-2 px-3 bg-success/10 rounded-lg">
                      <span className="text-xs">Convênio</span>
                      <span className="text-xs font-semibold text-success">R$ 500,00</span>
                    </div>
                    <div className="flex items-center justify-between py-2 px-3 bg-primary/10 rounded-lg">
                      <span className="text-xs">Particular</span>
                      <span className="text-xs font-semibold text-primary">R$ 450,00</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating cards overlay - right side */}
              <div className="absolute right-0 top-1/3 translate-x-1/3 hidden xl:block animate-float" style={{ animationDelay: '1s' }}>
                <div className="bg-card border border-border rounded-2xl p-4 shadow-xl w-56">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-success flex items-center justify-center">
                      <Check className="h-3 w-3 text-success-foreground" />
                    </div>
                    <span className="text-xs font-medium">Integração com WhatsApp</span>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Eclini</span>: Olá! Lembramos que você possui um agendamento...
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}