import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, Check, Star } from "lucide-react";
import heroMockup from "@/assets/dashboard-mockup.png";

const highlights = [
  "Agenda online 24h",
  "Lembretes WhatsApp",
  "Prontuário digital",
  "Assinatura digital",
];

export function HeroSection() {
  return (
    <section className="relative bg-card py-12 lg:py-16 overflow-hidden">
      <div className="container">
        <div className="grid lg:grid-cols-12 gap-8 lg:gap-6 items-center">
          {/* Left Column - Content (5 cols) */}
          <div className="lg:col-span-5 order-2 lg:order-1">
            <h1 className="opacity-0 animate-slide-up-fade text-3xl sm:text-4xl lg:text-[2.75rem] font-bold leading-tight text-foreground">
              Sistema para clínicas
              <br />
              <span className="text-primary">de multi especialidades</span>
            </h1>

            <p className="opacity-0 animate-slide-up-fade-delay-1 mt-5 text-base lg:text-lg text-muted-foreground leading-relaxed">
              Junte-se a profissionais da saúde de todo o Brasil e melhore sua gestão com o{" "}
              <Link to="/" className="text-primary font-medium hover:underline">
                Eclini
              </Link>
              . Ganhe tempo ao organizar sua agenda e economize gerenciando melhor sua clínica.
            </p>

            {/* Highlights */}
            <div className="opacity-0 animate-slide-up-fade-delay-2 mt-6 grid grid-cols-2 gap-3">
              {highlights.map((item, i) => (
                <div 
                  key={i} 
                  className="flex items-center gap-2 text-sm text-foreground transition-transform duration-200 hover:translate-x-1"
                >
                  <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Check className="h-3 w-3 text-primary" />
                  </div>
                  <span>{item}</span>
                </div>
              ))}
            </div>

            {/* CTA Button */}
            <div className="opacity-0 animate-slide-up-fade-delay-3 mt-8">
              <Button 
                size="lg" 
                className="bg-cta hover:bg-cta-hover text-cta-foreground rounded-full px-8 h-12 shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-xl"
                asChild
              >
                <Link to="/auth?tab=signup" className="flex items-center gap-2">
                  Quero testar agora
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>

          {/* Center Column - Mockup Image (4 cols) */}
          <div className="lg:col-span-4 order-1 lg:order-2 flex justify-center">
            <div className="relative opacity-0 animate-scale-in-fade">
              <img 
                src={heroMockup} 
                alt="Eclini - Sistema de gestão para clínicas" 
                className="w-full max-w-sm lg:max-w-md h-auto object-contain drop-shadow-2xl animate-float"
              />
              {/* Decorative gradient */}
              <div className="absolute -z-10 inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 rounded-3xl blur-3xl scale-110" />
            </div>
          </div>

          {/* Right Column - Price Card (3 cols) */}
          <div className="lg:col-span-3 order-3 flex justify-center lg:justify-end">
            <div className="relative w-full max-w-xs opacity-0 animate-slide-in-right-fade">
              {/* Badge */}
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                <div className="bg-cta text-cta-foreground text-xs font-semibold px-4 py-1.5 rounded-full flex items-center gap-1 shadow-md animate-bounce-soft">
                  <Star className="h-3 w-3 fill-current" />
                  Mais vendido
                </div>
              </div>

              {/* Card */}
              <div className="bg-card border-2 border-primary/30 rounded-2xl p-6 shadow-float transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
                <div className="text-center pt-4">
                  <p className="text-sm text-muted-foreground mb-1">Apenas</p>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-sm text-muted-foreground">R$</span>
                    <span className="text-4xl font-bold text-foreground">49,90</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    por profissional/mês
                  </p>
                </div>

                <div className="mt-6 space-y-3">
                  {["Agenda ilimitada", "Assinatura digital", "Prontuário digital", "Suporte dedicado"].map((feature, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-foreground">
                      <Check className="h-4 w-4 text-primary flex-shrink-0" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>

                <Button 
                  className="w-full mt-6 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full transition-transform duration-200 hover:scale-[1.02]"
                  asChild
                >
                  <Link to="/auth?tab=signup">
                    Começar teste grátis
                  </Link>
                </Button>

                <p className="text-xs text-center text-muted-foreground mt-3">
                  7 dias grátis • Sem cartão
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
