import { Award, ShieldCheck, MonitorSmartphone, HeartPulse, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const reasons = [
  { icon: Award, title: "Especialistas em saúde", description: "Mais de 10 anos desenvolvendo soluções para clínicas e consultórios em todo o Brasil." },
  { icon: HeartPulse, title: "Foco no atendimento", description: "Sistema desenhado para deixar o profissional focado no paciente, não na burocracia." },
  { icon: ShieldCheck, title: "Segurança LGPD e CFM", description: "Dados criptografados, controle de acesso por perfil e conformidade total com a legislação." },
  { icon: MonitorSmartphone, title: "Acesso de qualquer lugar", description: "100% em nuvem, funciona no computador, tablet e celular sem instalar nada." },
];

export function ClinicaProblemsSection() {
  return (
    <section className="py-20 lg:py-28 bg-background">
      <div className="container">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-primary font-semibold text-sm uppercase tracking-widest mb-3 block">Diferenciais</span>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground tracking-tight">
              Por que clínicas escolhem o <span className="text-primary">Prosinge</span>?
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 gap-10 mb-14">
            {reasons.map((r, i) => (
              <div key={i} className="flex gap-5 group">
                <div className="w-14 h-14 rounded-2xl bg-primary/8 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/15 transition-colors">
                  <r.icon className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground mb-2 text-lg">{r.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{r.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center">
            <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full px-8 h-14 text-base font-semibold shadow-lg shadow-primary/20" asChild>
              <a href="https://wa.me/551151943839?text=Olá! Quero saber mais sobre o Prosinge Clínica." target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                Falar com um especialista
                <ArrowRight className="h-5 w-5" />
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}