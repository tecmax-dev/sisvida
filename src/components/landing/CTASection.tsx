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
    <section id="contact" className="relative py-24 lg:py-32 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-slate-950" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_-20%,rgba(16,185,129,0.3),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_120%,rgba(59,130,246,0.2),transparent_50%)]" />
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-emerald-500/10 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '2s' }} />

      <div className="container relative z-10">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl lg:text-7xl font-extrabold text-white mb-8 tracking-tighter leading-tight">
            Pronto para transformar a <span className="text-primary italic">sua gestão?</span>
          </h2>
          <p className="text-xl text-white/70 mb-12 max-w-xl mx-auto leading-relaxed font-medium">
            Junte-se a centenas de entidades que elevaram sua administração para o próximo nível com o Prosinge.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Button
              size="lg"
              className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full px-12 h-16 text-lg font-bold shadow-2xl shadow-primary/20 hover:shadow-primary/30 transition-all duration-300 hover:-translate-y-1"
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
              className="border-2 border-white/30 text-white hover:bg-white/10 rounded-full px-8 h-14 text-base font-semibold backdrop-blur-sm"
              asChild
            >
              <a
                href="https://wa.me/551151943839?text=Olá! Gostaria de saber mais sobre o Prosinge."
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2"
              >
                <MessageCircle className="h-5 w-5" />
                Falar no WhatsApp
              </a>
            </Button>
          </div>

          <div className="flex flex-wrap justify-center gap-8">
            {badges.map((badge, i) => (
              <div key={i} className="flex items-center gap-2 text-white/80">
                <badge.icon className="h-4 w-4" />
                <span className="text-sm font-medium">{badge.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
