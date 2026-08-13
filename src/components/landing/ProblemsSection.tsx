import { Award, Users, MonitorSmartphone, MapPin, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const reasons = [
  {
    icon: Award,
    title: "Especialistas no Terceiro Setor",
    description: "+28 módulos integrados, criados para a realidade de sindicatos e associações.",
  },
  {
    icon: Users,
    title: "Equipe Experiente",
    description: "Profissionais com expertise em processos administrativos, financeiros e jurídicos.",
  },
  {
    icon: MonitorSmartphone,
    title: "Interface Moderna",
    description: "Design intuitivo, responsivo e com suporte técnico dedicado para sua equipe.",
  },
  {
    icon: MapPin,
    title: "Presença Nacional",
    description: "Sindicatos de todas as regiões do Brasil confiam no Prosinge.",
  },
];

export function ProblemsSection() {
  return (
    <section className="py-20 lg:py-28 bg-background">
      <div className="container">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-primary font-semibold text-sm uppercase tracking-widest mb-3 block">
              Diferenciais
            </span>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground tracking-tight">
              Por que escolher o{" "}
              <span className="text-primary">Prosinge</span>?
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 gap-10 mb-14">
            {reasons.map((reason, index) => (
              <div key={index} className="flex gap-5 group">
                <div className="w-14 h-14 rounded-2xl bg-primary/8 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/15 transition-colors">
                  <reason.icon className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground mb-2 text-lg">{reason.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {reason.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center">
            <Button
              size="lg"
              className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full px-8 h-14 text-base font-semibold shadow-lg shadow-primary/20"
              asChild
            >
              <a
                href="https://wa.me/5571982786864?text=Olá! Gostaria de saber mais sobre o Prosinge."
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2"
              >
                Converse com um Especialista
                <ArrowRight className="h-5 w-5" />
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
