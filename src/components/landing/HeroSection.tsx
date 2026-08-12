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
    <section className="relative min-h-screen flex items-center pt-32 pb-20 overflow-hidden">
      {/* Background elements */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(16,185,129,0.08),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_70%,rgba(59,130,246,0.05),transparent_50%)]" />
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
      
      <div className="absolute top-0 right-0 w-[1000px] h-[1000px] bg-primary/5 rounded-full blur-[140px] -translate-y-1/2 translate-x-1/2 animate-pulse" style={{ animationDuration: '8s' }} />
      <div className="absolute bottom-0 left-0 w-[800px] h-[800px] bg-emerald-500/5 rounded-full blur-[120px] translate-y-1/2 -translate-x-1/2 animate-pulse" style={{ animationDuration: '12s' }} />

      <div className="container relative z-10">
        <div className="grid lg:grid-cols-2 gap-20 items-center">
          {/* Left Column */}
          <div className="max-w-2xl">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 text-primary text-xs font-bold px-5 py-2.5 rounded-full mb-10 backdrop-blur-md shadow-xl transition-all hover:border-primary/30">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              +200 entidades confiam no Prosinge
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-[1.05] tracking-tight text-foreground mb-8">
              {title}{" "}
              <span className="relative inline-block">
                <span className="relative z-10 text-primary">
                  {typedWord}
                  <span className="animate-pulse font-light">|</span>
                </span>
                <span className="absolute -bottom-2 left-0 w-full h-3 bg-primary/10 -rotate-1 rounded-full" />
              </span>
            </h1>

            <p className="text-xl text-muted-foreground leading-relaxed mb-12 max-w-xl font-medium">
              {description}
            </p>

            <div className="flex flex-col sm:flex-row gap-5 mb-16">
              <Button
                size="lg"
                className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full px-10 h-16 text-lg font-bold shadow-[0_20px_40px_-12px_rgba(var(--primary-rgb),0.35)] hover:shadow-[0_25px_50px_-12px_rgba(var(--primary-rgb),0.45)] transition-all duration-300 hover:-translate-y-1 active:scale-95"
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
                className="rounded-full px-10 h-16 text-lg font-bold border-border/60 hover:border-primary/30 hover:bg-primary/5 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 active:scale-95"
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
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/30 to-emerald-500/20 rounded-[2rem] blur-[80px] scale-110 group-hover:scale-125 transition-transform duration-700 opacity-60" />
            
            <div className="relative rounded-[2.5rem] p-4 bg-gradient-to-b from-white/10 to-white/5 backdrop-blur-md border border-white/20 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.3)] transition-all duration-700 hover:-rotate-2 hover:scale-[1.02]">
              <div className="relative rounded-[1.8rem] overflow-hidden">
                <img
                  src={heroImage}
                  alt="Prosinge - Sistema de Gestão Sindical"
                  className="w-full max-w-2xl h-auto object-cover transform transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 ring-1 ring-inset ring-white/20 rounded-[1.8rem]" />
              </div>
              
              {/* Floating element 1 */}
              <div className="absolute -top-10 -right-10 bg-card/80 backdrop-blur-xl border border-border/50 p-6 rounded-3xl shadow-2xl animate-bounce" style={{ animationDuration: '4s' }}>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
                    <ArrowRight className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">+R$ 2.4M</div>
                    <div className="text-xs text-muted-foreground font-medium">Recuperados este mês</div>
                  </div>
                </div>
              </div>

              {/* Floating element 2 */}
              <div className="absolute -bottom-8 -left-12 bg-card/80 backdrop-blur-xl border border-border/50 p-5 rounded-2xl shadow-2xl animate-float" style={{ animationDuration: '6s' }}>
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="w-8 h-8 rounded-full border-2 border-card bg-primary/10 flex items-center justify-center text-[10px] font-bold">U{i}</div>
                    ))}
                  </div>
                  <div className="text-sm font-bold">+120 Novos Sócios</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
