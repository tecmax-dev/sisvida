import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Calendar, Clock, Users, Bell } from "lucide-react";

const stats = [
  { value: "50%", label: "menos faltas" },
  { value: "24/7", label: "agendamento online" },
  { value: "2min", label: "tempo médio de marcação" },
];

const floatingIcons = [
  { Icon: Calendar, position: "top-20 left-10", delay: "0s" },
  { Icon: Clock, position: "top-32 right-16", delay: "0.5s" },
  { Icon: Users, position: "bottom-24 left-20", delay: "1s" },
  { Icon: Bell, position: "bottom-32 right-24", delay: "1.5s" },
];

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-hero min-h-[90vh] flex items-center">
      {/* Background Effects */}
      <div className="absolute inset-0">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-primary/5 rounded-full blur-3xl" />
      </div>

      {/* Floating Icons */}
      {floatingIcons.map(({ Icon, position, delay }, i) => (
        <div
          key={i}
          className={`absolute ${position} hidden lg:flex items-center justify-center w-14 h-14 rounded-2xl bg-sidebar-accent/80 backdrop-blur-sm border border-sidebar-border animate-float`}
          style={{ animationDelay: delay }}
        >
          <Icon className="w-6 h-6 text-primary" />
        </div>
      ))}

      <div className="container relative z-10 py-20 lg:py-32">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-sm text-primary-foreground/90 mb-6 animate-fade-in">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            Gestão de clínicas simplificada
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-primary-foreground leading-tight tracking-tight animate-slide-up">
            Agenda inteligente para{" "}
            <span className="bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
              clínicas modernas
            </span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-sidebar-foreground/80 max-w-2xl mx-auto animate-slide-up" style={{ animationDelay: "0.1s" }}>
            Reduza faltas, automatize lembretes via WhatsApp e ofereça 
            agendamento online 24/7. Tudo em uma plataforma feita para a 
            realidade das clínicas brasileiras.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center animate-slide-up" style={{ animationDelay: "0.2s" }}>
            <Button variant="hero" size="xl" asChild>
              <Link to="/auth?tab=signup">
                Começar grátis
              </Link>
            </Button>
            <Button variant="hero-outline" size="xl" asChild>
              <Link to="/auth">
                Ver demonstração
              </Link>
            </Button>
          </div>

          <div className="mt-16 grid grid-cols-3 gap-8 max-w-lg mx-auto animate-slide-up" style={{ animationDelay: "0.3s" }}>
            {stats.map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-2xl sm:text-3xl font-bold text-primary">
                  {stat.value}
                </div>
                <div className="text-sm text-sidebar-foreground/70 mt-1">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Gradient */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
}
