import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, MessageCircle } from "lucide-react";

export function CTASection() {
  return (
    <section id="contact" className="py-20 lg:py-28 bg-primary">
      <div className="container">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-primary-foreground">
            Pronto para transformar sua clínica?
          </h2>
          <p className="mt-4 text-lg text-primary-foreground/80 max-w-xl mx-auto">
            Junte-se a milhares de profissionais que já otimizaram sua gestão com o Eclini. 
            Comece gratuitamente hoje.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mt-10">
            <Button
              size="lg"
              className="bg-white text-primary hover:bg-white/90 rounded-full px-8 h-14 text-base"
              asChild
            >
              <Link to="/auth?tab=signup" className="flex items-center gap-2">
                Criar conta grátis
                <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="border-white text-white hover:bg-white/10 rounded-full px-8 h-14 text-base"
              asChild
            >
              <a 
                href="https://wa.me/5571982386864?text=Olá! Gostaria de saber mais sobre o Eclini." 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2"
              >
                <MessageCircle className="h-5 w-5" />
                Falar pelo WhatsApp
              </a>
            </Button>
          </div>

          <div className="mt-12 pt-8 border-t border-white/20">
            <p className="text-primary-foreground/70 text-sm">
              Desenvolvido por{" "}
              <a 
                href="https://tecmax.com.br" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary-foreground underline hover:no-underline"
              >
                Tecmax Tecnologia
              </a>
            </p>
            <p className="text-primary-foreground/50 text-xs mt-2">
              CNPJ: 03.025.212/0001-11 | Contato: (71) 98238-6864
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
