import { Button } from "@/components/ui/button";
import { ArrowRight, MessageCircle, Shield, Headphones, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";

const badges = [
  { icon: Shield, text: "LGPD e CFM" },
  { icon: Headphones, text: "Suporte humano" },
  { icon: RefreshCw, text: "Migração gratuita" },
];

export function ClinicaCTASection() {
  return (
    <section id="contact" className="relative py-24 lg:py-32 overflow-hidden">
      <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(220, 80%, 35%))' }} />
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-white/5 rounded-full blur-[120px]" />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-white/5 rounded-full blur-[100px]" />

      <div className="container relative z-10">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-6 tracking-tight">
            Pronto para modernizar sua clínica?
          </h2>
          <p className="text-lg text-white/80 mb-10 max-w-lg mx-auto leading-relaxed">
            Teste grátis por 7 dias. Sem cartão de crédito, sem fidelidade. Migração gratuita do seu sistema atual.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Button size="lg" className="bg-white text-primary hover:bg-white/90 rounded-full px-8 h-14 text-base font-bold shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-0.5" asChild>
              <Link to="/cadastro" className="flex items-center gap-2">
                Começar teste grátis
                <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="border-2 border-white/30 text-white hover:bg-white/10 rounded-full px-8 h-14 text-base font-semibold backdrop-blur-sm" asChild>
              <a href="https://wa.me/551151943839?text=Olá! Quero saber mais sobre o Prosinge Clínica." target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                Falar com especialista
              </a>
            </Button>
          </div>

          <div className="flex flex-wrap justify-center gap-8">
            {badges.map((b, i) => (
              <div key={i} className="flex items-center gap-2 text-white/80">
                <b.icon className="h-4 w-4" />
                <span className="text-sm font-medium">{b.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}