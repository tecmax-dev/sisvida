import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

export function CTASection() {
  return (
    <section id="contact" className="py-20 lg:py-28 bg-gradient-hero relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/10 rounded-full blur-3xl" />
      </div>

      <div className="container relative z-10">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-primary-foreground">
            Pronto para transformar a gestão da sua clínica?
          </h2>
          <p className="mt-6 text-lg text-sidebar-foreground/80">
            Junte-se a centenas de clínicas que já reduziram faltas e melhoraram 
            a experiência dos pacientes com o Eclini.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="hero" size="xl" asChild>
              <Link to="/auth?tab=signup" className="group">
                Começar agora
                <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
          </div>

          <p className="mt-6 text-sm text-sidebar-foreground/60">
            Teste grátis por 14 dias. Sem cartão de crédito.
          </p>
        </div>
      </div>
    </section>
  );
}
