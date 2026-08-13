import { Button } from "@/components/ui/button";
import { ArrowRight, MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";

export function CTASection() {
  return (
    <section id="contact" className="bg-prosinge-cream px-6 py-20 font-body">
      <div className="mx-auto max-w-5xl overflow-hidden rounded-3xl bg-prosinge-emerald shadow-2xl">
        <div className="grid gap-8 p-10 md:p-14 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="mb-4 font-display text-3xl font-bold text-prosinge-cream md:text-4xl">
              Pronto para elevar o nível da sua gestão?
            </h2>
            <p className="text-prosinge-cream/70">
              Fale com nossos especialistas e descubra como a Prosinge pode
              otimizar o dia a dia do seu sindicato.
            </p>
          </div>
          <div className="flex flex-col items-stretch gap-6 lg:items-end">
            <div className="text-center lg:text-right">
              <p className="text-xs font-bold uppercase tracking-widest text-prosinge-gold">
                Ligue agora
              </p>
              <p className="font-display text-2xl font-bold text-prosinge-cream">
                (71) 98278-6864
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
              <Button
                asChild
                className="h-14 rounded-xl bg-prosinge-gold px-8 font-bold text-prosinge-emerald shadow-xl hover:bg-prosinge-gold/90"
              >
                <a href="https://wa.me/5571982786864?text=Ol%C3%A1!%20Quero%20testar%20o%20Prosinge%20gratuitamente." target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                  Solicitar Orçamento
                  <ArrowRight className="h-5 w-5" />
                </a>
              </Button>
              <Button
                asChild
                variant="outline"
                className="h-14 rounded-xl border-prosinge-cream/20 bg-transparent px-8 font-bold text-prosinge-cream hover:bg-prosinge-cream/10 hover:text-prosinge-cream"
              >
                <a
                  href="https://wa.me/5571982786864?text=Olá! Gostaria de saber mais sobre o Prosinge."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2"
                >
                  <MessageCircle className="h-5 w-5" />
                  WhatsApp
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
