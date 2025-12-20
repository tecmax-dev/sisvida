import { Button } from "@/components/ui/button";
import { ArrowRight, MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";

export function CTASection() {
  return (
    <section id="contact" className="py-20 lg:py-28 bg-gradient-to-br from-primary via-primary to-primary-dark relative overflow-hidden">
      <div className="absolute top-0 left-0 w-96 h-96 bg-white/5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
      
      <div className="container relative z-10">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-6">
            Pronto para transformar sua clínica?
          </h2>
          <p className="text-lg md:text-xl text-white/80 mb-10 max-w-2xl mx-auto">
            Junte-se a milhares de profissionais de saúde que já simplificaram sua gestão com o Eclini.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg"
              className="bg-white text-primary hover:bg-white/90 rounded-full px-8 h-14 text-base font-semibold shadow-xl transition-all duration-300 hover:scale-105"
              asChild
            >
              <Link to="/auth?tab=signup" className="flex items-center gap-2">
                Começar grátis agora
                <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
            <Button 
              size="lg"
              variant="outline"
              className="border-2 border-white text-white hover:bg-white/10 rounded-full px-8 h-14 text-base font-semibold"
              asChild
            >
              <a 
                href="https://wa.me/5571982786864?text=Olá! Gostaria de saber mais sobre o Eclini."
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2"
              >
                <MessageCircle className="h-5 w-5" />
                Falar pelo WhatsApp
              </a>
            </Button>
          </div>

          <p className="mt-8 text-white/60 text-sm">
            7 dias grátis • Sem cartão de crédito • Suporte em português
          </p>
        </div>
      </div>
    </section>
  );
}
