import { Button } from "@/components/ui/button";
import { ArrowRight, MessageCircle, Shield, Headphones, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";

const badges = [
  { icon: Shield, text: "Dados Seguros" },
  { icon: Headphones, text: "Suporte Dedicado" },
  { icon: RefreshCw, text: "Migração Gratuita" },
];

export function CTASection() {
  return (
    <section id="contact" className="py-20 lg:py-28 relative overflow-hidden bg-primary">
      <div className="absolute top-0 left-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />

      <div className="container relative z-10">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-white/70 text-sm font-medium uppercase tracking-wider mb-4">
            Pronto para transformar sua gestão?
          </p>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-6">
            Comece a usar o ProsindWeb hoje mesmo
          </h2>
          <p className="text-lg md:text-xl text-white/80 mb-10 max-w-2xl mx-auto">
            Junte-se a mais de 200 sindicatos que já confiam em nossa solução
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-10">
            <Button
              size="lg"
              className="bg-card text-primary hover:bg-card/90 rounded-full px-8 h-14 text-base font-semibold shadow-xl transition-all duration-300 hover:scale-105"
              asChild
            >
              <Link to="/cadastro" className="flex items-center gap-2">
                Solicitar Apresentação
                <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-2 border-white/30 text-white hover:bg-white/10 rounded-full px-8 h-14 text-base font-semibold"
              asChild
            >
              <a
                href="https://wa.me/557332311784?text=Olá! Gostaria de saber mais sobre o ProsindWeb."
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2"
              >
                <MessageCircle className="h-5 w-5" />
                Falar no WhatsApp
              </a>
            </Button>
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap justify-center gap-6">
            {badges.map((badge, i) => (
              <div key={i} className="flex items-center gap-2 text-white/80">
                <badge.icon className="h-5 w-5" />
                <span className="text-sm font-medium">{badge.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
