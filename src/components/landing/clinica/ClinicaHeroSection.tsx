import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, Play } from "lucide-react";
import { useState, useEffect } from "react";
import heroMockup from "@/assets/hero-dashboard-mockup-v2.jpg";

const typewriterWords = ["completa", "moderna", "humanizada", "sem papel"];

function useTypewriter(words: string[], speed = 100, pause = 2000) {
  const [text, setText] = useState("");
  const [wordIndex, setWordIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const current = words[wordIndex];
    const timeout = setTimeout(() => {
      if (!isDeleting) {
        setText(current.slice(0, text.length + 1));
        if (text.length + 1 === current.length) setTimeout(() => setIsDeleting(true), pause);
      } else {
        setText(current.slice(0, text.length - 1));
        if (text.length === 0) {
          setIsDeleting(false);
          setWordIndex((p) => (p + 1) % words.length);
        }
      }
    }, isDeleting ? speed / 2 : speed);
    return () => clearTimeout(timeout);
  }, [text, isDeleting, wordIndex, words, speed, pause]);

  return text;
}

export function ClinicaHeroSection() {
  const typedWord = useTypewriter(typewriterWords);

  return (
    <section className="relative min-h-screen flex items-center pt-20 pb-20 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] via-background to-primary/[0.06]" />
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-primary/[0.04] rounded-full blur-[120px] -translate-y-1/4 translate-x-1/4" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-primary/[0.03] rounded-full blur-[100px] translate-y-1/4 -translate-x-1/4" />

      <div className="container relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-12 items-center">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 bg-primary/8 border border-primary/15 text-primary text-xs font-semibold px-4 py-2 rounded-full mb-8 backdrop-blur-sm">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              Sistema completo para clínicas e consultórios
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.08] tracking-tight text-foreground mb-6">
              Gestão de clínica{" "}
              <span className="text-primary">
                {typedWord}
                <span className="animate-pulse font-light">|</span>
              </span>
            </h1>

            <p className="text-lg text-muted-foreground leading-relaxed mb-10 max-w-lg">
              Agenda inteligente, prontuário eletrônico, prescrição digital, financeiro e WhatsApp integrado.
              Tudo em uma plataforma feita para o dia a dia da sua clínica ou consultório.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mb-12">
              <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full px-8 h-14 text-base font-semibold shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300 hover:-translate-y-0.5" asChild>
                <a href="https://wa.me/5571982786864?text=Ol%C3%A1!%20Quero%20testar%20o%20Prosinge%20gratuitamente." target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                  Testar 7 dias grátis
                  <ArrowRight className="h-5 w-5" />
                </a>
              </Button>
              <Button size="lg" variant="outline" className="rounded-full px-8 h-14 text-base border-border/60 hover:border-primary/30 hover:bg-primary/5" asChild>
                <a href="https://wa.me/5571982786864?text=Olá! Quero ver uma demonstração do Prosinge Clínica." target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                  <Play className="h-4 w-4 fill-current" />
                  Ver demonstração
                </a>
              </Button>
            </div>

            <div className="flex items-center gap-6 text-sm text-muted-foreground flex-wrap">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-success" />
                Sem fidelidade
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-success" />
                Migração gratuita
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-success" />
                Suporte em português
              </div>
            </div>
          </div>

          <div className="relative flex justify-center lg:justify-end">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-primary/5 rounded-3xl blur-3xl scale-110" />
            <div className="relative bg-card/50 backdrop-blur-sm border border-border/40 rounded-2xl p-3 shadow-2xl shadow-primary/10">
              <img
                src={heroMockup}
                alt="Prosinge Clínica - Sistema de gestão para clínicas"
                className="w-full max-w-lg h-auto object-contain rounded-xl"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}