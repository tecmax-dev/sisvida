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
    <section className="bg-prosinge-cream px-6 py-24 font-body">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <span className="mb-3 block text-xs font-bold uppercase tracking-[0.2em] text-prosinge-emerald-mid">
              Diferenciais
            </span>
            <h2 className="font-display text-4xl font-bold tracking-tight text-prosinge-emerald md:text-5xl">
              Por que escolher o{" "}
              <span className="text-prosinge-gold">Prosinge</span>?
            </h2>
          </div>

          <div className="mb-14 grid gap-6 sm:grid-cols-2">
            {reasons.map((reason, index) => (
              <div key={index} className="group flex gap-5 rounded-2xl border border-prosinge-emerald/10 bg-card p-7 transition-all hover:-translate-y-0.5 hover:shadow-xl">
                <div className="w-14 h-14 rounded-2xl flex flex-shrink-0 items-center justify-center bg-prosinge-emerald">
                  <reason.icon className="h-7 w-7 text-prosinge-gold" />
                </div>
                <div>
                  <h3 className="mb-2 font-display text-lg font-bold text-prosinge-emerald">{reason.title}</h3>
                  <p className="leading-relaxed text-prosinge-emerald-mid/80">
                    {reason.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center">
            <Button
              size="lg"
              className="h-14 rounded-xl bg-prosinge-emerald px-8 text-base font-bold text-prosinge-cream shadow-xl hover:bg-prosinge-emerald/90"
              asChild
            >
              <a
                href="https://wa.me/551151943839?text=Olá! Gostaria de saber mais sobre o Prosinge."
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
