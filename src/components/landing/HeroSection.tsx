import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Loader2, Monitor, CheckCircle, Shield, Headphones } from "lucide-react";
import { useHeroSettings } from "@/hooks/useHeroSettings";
import { useState, useEffect } from "react";
import heroMockupScreens from "@/assets/hero-mockup-screens.png";

const typewriterWords = ["humanizado", "eficiente", "completo", "inovador"];

function useTypewriter(words: string[], speed = 100, pause = 2000) {
  const [text, setText] = useState("");
  const [wordIndex, setWordIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const current = words[wordIndex];
    const timeout = setTimeout(() => {
      if (!isDeleting) {
        setText(current.slice(0, text.length + 1));
        if (text.length + 1 === current.length) {
          setTimeout(() => setIsDeleting(true), pause);
        }
      } else {
        setText(current.slice(0, text.length - 1));
        if (text.length === 0) {
          setIsDeleting(false);
          setWordIndex((prev) => (prev + 1) % words.length);
        }
      }
    }, isDeleting ? speed / 2 : speed);

    return () => clearTimeout(timeout);
  }, [text, isDeleting, wordIndex, words, speed, pause]);

  return text;
}

const highlights = [
  { icon: Monitor, title: "Simples e Moderno", desc: "Interface intuitiva e design atualizado" },
  { icon: CheckCircle, title: "Fácil e Customizável", desc: "Adaptamos às suas necessidades" },
  { icon: Shield, title: "Rápido e Seguro", desc: "Dados protegidos com criptografia" },
  { icon: Headphones, title: "Excelente Suporte", desc: "Atendimento dedicado e humanizado" },
];

export function HeroSection() {
  const { data: settings, isLoading } = useHeroSettings();
  const typedWord = useTypewriter(typewriterWords);

  const title = settings?.title || "Nosso atendimento é";
  const description = settings?.description || "Mais resultados para seu sindicato. Agende uma apresentação online ou uma visita presencial.";
  const primaryButtonText = settings?.primary_button_text || "Peça seu orçamento";
  const primaryButtonLink = settings?.primary_button_link || "/cadastro";
  const heroImage = settings?.hero_image_url || heroMockupScreens;

  if (isLoading) {
    return (
      <section className="relative min-h-[90vh] flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </section>
    );
  }

  return (
    <>
      <section className="relative min-h-[85vh] flex items-center pt-24 lg:pt-28 pb-16 bg-background overflow-hidden">
        {/* Subtle background pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, hsl(var(--primary)) 1px, transparent 0)',
          backgroundSize: '40px 40px'
        }} />

        <div className="container relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
            {/* Left Column - Content */}
            <div className="text-left">
              {/* Trust badge */}
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-sm font-semibold px-4 py-2 rounded-full mb-6 border border-primary/20">
                <span className="text-base">⭐</span>
                +200 Sindicatos confiam em nós
              </div>

              {/* Main headline with typewriter */}
              <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-bold leading-[1.1] mb-6 text-foreground">
                {title}{" "}
                <span className="gradient-text">
                  {typedWord}
                  <span className="animate-pulse">|</span>
                </span>
              </h1>

              <p className="text-lg text-muted-foreground max-w-xl mb-8 leading-relaxed">
                {description}
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  size="lg"
                  className="btn-eclini px-8 h-14 text-base font-semibold"
                  asChild
                >
                  <Link to={primaryButtonLink}>
                    {primaryButtonText}
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="btn-eclini-outline px-8 h-14 text-base"
                  asChild
                >
                  <Link to="/cadastro">
                    Agende uma demo
                  </Link>
                </Button>
              </div>
            </div>

            {/* Right Column - Hero Image */}
            <div className="relative flex justify-center lg:justify-end">
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-primary/5 blur-3xl" />
              <div className="relative">
                <img
                  src={heroImage}
                  alt="ProsindWeb - Sistema de Gestão Sindical"
                  className="w-full max-w-lg h-auto object-contain drop-shadow-2xl animate-fade-in"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Highlight Cards - Below hero like SindSystem */}
      <section className="py-12 bg-card border-y border-border">
        <div className="container">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {highlights.map((item, i) => (
              <div key={i} className="flex flex-col items-center text-center group">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <item.icon className="h-7 w-7 text-primary" />
                </div>
                <h3 className="font-bold text-foreground mb-1 text-sm lg:text-base">{item.title}</h3>
                <p className="text-xs lg:text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
