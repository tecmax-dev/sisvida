import { Button } from "@/components/ui/button";
import { ArrowRight, MessageCircle } from "lucide-react";

export function CTASection() {
  return (
    <section id="contact" className="bg-prosinge-cream px-6 py-20 font-body">
      <div className="mx-auto max-w-5xl overflow-hidden rounded-3xl bg-prosinge-emerald shadow-2xl">
        <div className="grid gap-8 p-10 md:p-14 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="mb-4 font-display text-3xl font-bold text-prosinge-cream md:text-4xl">
              Pronto para elevar o nível da sua gestão?
            </h2>
            <p className="mb-6 text-prosinge-cream/70">
              Fale com nossos especialistas e descubra como a Prosinge pode
              otimizar o dia a dia do seu sindicato.
            </p>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-semibold uppercase tracking-widest text-prosinge-cream/60">
              <span>Migração gratuita</span>
              <span className="hidden h-1 w-1 rounded-full bg-prosinge-gold sm:block" />
              <span>Implantação acompanhada</span>
              <span className="hidden h-1 w-1 rounded-full bg-prosinge-gold sm:block" />
              <span>Suporte dedicado</span>
            </div>
          </div>
          <div className="flex flex-col items-stretch gap-4 lg:items-end">
            <Button
              asChild
              className="group h-14 min-w-[240px] rounded-xl bg-prosinge-gold px-8 font-bold text-prosinge-emerald shadow-xl hover:bg-prosinge-gold/90"
            >
              <a
                href="https://wa.me/5571982786864?text=Ol%C3%A1!%20Quero%20solicitar%20um%20or%C3%A7amento%20do%20Prosinge."
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2"
              >
                <MessageCircle className="h-5 w-5" />
                Falar com um especialista
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </a>
            </Button>
            <p className="text-center text-sm text-prosinge-cream/70 lg:text-right">
              Ou ligue agora:{" "}
              <a
                href="tel:+5571982786864"
                className="font-bold text-prosinge-cream underline-offset-4 hover:underline"
              >
                (71) 98278-6864
              </a>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
