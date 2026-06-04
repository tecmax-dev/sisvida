import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Loader2, ArrowRight, Play } from "lucide-react";
import { useHeroSettings } from "@/hooks/useHeroSettings";
import { useState, useEffect } from "react";
 import heroMockupScreens from "@/assets/sindical-hero-dashboard.png";

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

const clients = [
  "SECMI", "SINPRO", "SINDPREV", "SINDILOJAS", "SINTRACON"
];

export function HeroSection() {
  const heroSettingsQuery = useHeroSettings();
  const settings = heroSettingsQuery?.data ?? null;
  const isLoading = heroSettingsQuery?.isLoading ?? false;
  const typedWord = useTypewriter(typewriterWords);

  const title = settings?.title || "Gestão sindical";
  const description = settings?.description || "Plataforma completa para sindicatos, associações e federações. Automatize processos, gerencie associados e impulsione resultados com tecnologia de ponta.";
  const primaryButtonText = settings?.primary_button_text || "Começar agora";
  const primaryButtonLink = settings?.primary_button_link || "/cadastro";
  const heroImage = settings?.hero_image_url || heroMockupScreens;

  if (isLoading) {
    return (
      <section className="relative min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </section>
    );
  }

  return (
    <section className="relative min-h-screen flex items-center pt-20 pb-20 overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] via-background to-primary/[0.06]" />
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-primary/[0.04] rounded-full blur-[120px] -translate-y-1/4 translate-x-1/4" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-primary/[0.03] rounded-full blur-[100px] translate-y-1/4 -translate-x-1/4" />

      <div className="container relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-12 items-center">
          {/* Left Column */}
          <div className="max-w-xl">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-primary/8 border border-primary/15 text-primary text-xs font-semibold px-4 py-2 rounded-full mb-8 backdrop-blur-sm">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              +200 entidades confiam no ProsindWeb
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.08] tracking-tight text-foreground mb-6">
              {title}{" "}
              <span className="text-primary">
                {typedWord}
                <span className="animate-pulse font-light">|</span>
              </span>
            </h1>

            <p className="text-lg text-muted-foreground leading-relaxed mb-10 max-w-lg">
              {description}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mb-12">
              <Button
                size="lg"
                className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full px-8 h-14 text-base font-semibold shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300 hover:-translate-y-0.5"
                asChild
              >
                <Link to={primaryButtonLink} className="flex items-center gap-2">
                  {primaryButtonText}
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="rounded-full px-8 h-14 text-base border-border/60 hover:border-primary/30 hover:bg-primary/5"
                asChild
              >
                <Link to="/cadastro" className="flex items-center gap-2">
                  <Play className="h-4 w-4 fill-current" />
                  Ver demonstração
                </Link>
              </Button>
            </div>

            {/* Social proof */}
            <div className="flex items-center gap-4">
              <div className="flex -space-x-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="w-9 h-9 rounded-full bg-primary/10 border-2 border-background flex items-center justify-center">
                    <span className="text-xs font-bold text-primary">{clients[i]?.[0]}</span>
                  </div>
                ))}
              </div>
              <div>
                <div className="flex items-center gap-1 mb-0.5">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="w-3.5 h-3.5 text-warning fill-warning" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">Avaliado por <span className="font-semibold text-foreground">+200 sindicatos</span></p>
              </div>
            </div>
          </div>

          {/* Right Column - Hero Image */}
          <div className="relative flex justify-center lg:justify-end">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-primary/5 rounded-3xl blur-3xl scale-110" />
            <div className="relative bg-card/50 backdrop-blur-sm border border-border/40 rounded-2xl p-3 shadow-2xl shadow-primary/10">
              <img
                src={heroImage}
                alt="ProsindWeb - Sistema de Gestão Sindical"
                className="w-full max-w-lg h-auto object-contain rounded-xl"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
