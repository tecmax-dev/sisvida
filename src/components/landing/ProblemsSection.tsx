import { Award, Users, MonitorSmartphone, MapPin, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const reasons = [
  {
    icon: Award,
    title: "Tecnologia Especializada no Terceiro Setor",
    description:
      "Mais de 28 módulos integrados, criados especialmente para a realidade de sindicatos e associações.",
  },
  {
    icon: Users,
    title: "Especialistas em Gestão Sindical e Financeira",
    description:
      "Equipe experiente em processos administrativos, financeiros e jurídicos, com foco em compliance e segurança.",
  },
  {
    icon: MonitorSmartphone,
    title: "Experiência do Usuário em Primeiro Lugar",
    description:
      "Interface moderna, intuitiva, responsiva e com suporte técnico dedicado.",
  },
  {
    icon: MapPin,
    title: "Presença em Todo o Brasil",
    description:
      "Sindicatos e federações de todas as regiões já confiam no ProsindWeb para transformar sua gestão.",
  },
];

export function ProblemsSection() {
  return (
    <section className="py-16 lg:py-24 bg-background">
      <div className="container">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            Por Que Escolher o <span className="gradient-text">ProsindWeb?</span>
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 gap-8 max-w-4xl mx-auto mb-12">
          {reasons.map((reason, index) => (
            <div key={index} className="flex gap-4">
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <reason.icon className="h-7 w-7 text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-foreground mb-2">{reason.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {reason.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center">
          <Button
            size="lg"
            className="btn-eclini px-8 h-14 text-base font-semibold"
            asChild
          >
            <a
              href="https://wa.me/557332311784?text=Olá! Gostaria de saber mais sobre o ProsindWeb."
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
    </section>
  );
}
