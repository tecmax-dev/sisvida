import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Loader2, ArrowRight } from "lucide-react";
import { useHeroSettings } from "@/hooks/useHeroSettings";
import heroMockupScreens from "@/assets/landing/admin-dashboard-mockup.jpg";

export function HeroSection() {
  const heroSettingsQuery = useHeroSettings();
  const settings = heroSettingsQuery?.data ?? null;
  const isLoading = heroSettingsQuery?.isLoading ?? false;

  const title = settings?.title || "Gestão sindical de alta performance";
  const description = settings?.description || "Plataforma completa para sindicatos, associações e federações. Automatize processos, gerencie associados e impulsione resultados com tecnologia de ponta.";
  const primaryButtonText = settings?.primary_button_text || "Começar agora";
  const WA_URL = "https://wa.me/5571982786864?text=Ol%C3%A1!%20Quero%20testar%20o%20Prosinge%20gratuitamente.";
  const primaryButtonLink = WA_URL;
  const heroImage = settings?.hero_image_url || heroMockupScreens;

  if (isLoading) {
    return (
      <section className="relative min-h-[60vh] flex items-center justify-center bg-prosinge-emerald">
        <Loader2 className="h-8 w-8 animate-spin text-prosinge-gold" />
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden bg-prosinge-emerald px-6 pt-28 pb-20 lg:py-32 font-body">
      {/* Pontilhado dourado de fundo */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 2px 2px, hsl(var(--prosinge-gold)) 1px, transparent 0)",
          backgroundSize: "40px 40px",
        }}
      />
      <div className="absolute -top-32 -right-32 h-[500px] w-[500px] rounded-full bg-prosinge-emerald-mid/40 blur-[120px]" />

      <div className="relative z-10 mx-auto max-w-7xl">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <div className="mb-6 inline-flex items-center rounded-full border border-prosinge-gold/30 bg-prosinge-gold/10 px-4 py-1 text-xs font-semibold uppercase tracking-widest text-prosinge-gold">
              SaaS Especialista em Sindicatos
            </div>
            <h1 className="mb-6 font-display text-4xl font-bold leading-[1.1] tracking-tight text-prosinge-cream md:text-5xl lg:text-6xl">
              {title.split(" ").slice(0, -2).join(" ")}{" "}
              <span className="text-prosinge-gold">
                {title.split(" ").slice(-2).join(" ")}
              </span>
            </h1>
            <p className="mb-10 max-w-xl text-lg leading-relaxed text-prosinge-cream/80">
              {description}
            </p>
            <div className="flex flex-wrap gap-4">
              <Button
                asChild
                className="h-14 rounded-xl bg-prosinge-gold px-8 text-base font-bold text-prosinge-emerald shadow-xl shadow-prosinge-emerald/30 hover:bg-prosinge-gold/90 hover:shadow-2xl"
              >
                <a href={primaryButtonLink} target="_blank" rel="noopener noreferrer">{primaryButtonText}</a>
              </Button>
              <Button
                asChild
                variant="outline"
                className="group h-14 rounded-xl border-prosinge-cream/20 bg-transparent px-8 text-base font-bold text-prosinge-cream hover:bg-prosinge-cream/10 hover:text-prosinge-cream"
              >
                <a href="#features" className="flex items-center gap-2">
                  Conhecer Funcionalidades
                  <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                </a>
              </Button>
            </div>
          </div>

          <div className="relative">
            <div className="overflow-hidden rounded-2xl border border-prosinge-cream/15 bg-prosinge-emerald-mid/30 p-2 shadow-2xl backdrop-blur-sm">
              <img
                src={heroImage}
                alt="Painel administrativo Prosinge com dados sensíveis embaçados"
                width={1600}
                height={1024}
                className="w-full rounded-xl object-cover"
              />
            </div>
            {/* Selo de privacidade */}
            <div className="absolute -top-4 -right-4 hidden rounded-full border border-prosinge-cream/20 bg-prosinge-emerald px-4 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-prosinge-cream shadow-xl sm:block">
              Dados reais embaçados · LGPD
            </div>
            <div className="absolute -bottom-6 -left-6 hidden rounded-lg bg-prosinge-gold p-6 shadow-xl sm:block">
              <p className="text-xs font-bold uppercase tracking-widest text-prosinge-cream">
                Sindicatos Atendidos
              </p>
              <p className="font-display text-3xl font-bold text-prosinge-cream">
                +200
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
