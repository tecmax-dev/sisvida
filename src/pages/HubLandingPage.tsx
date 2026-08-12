import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ArrowRight, Building2, Stethoscope, CheckCircle2 } from "lucide-react";
import { useEffect } from "react";

const clinicaFeatures = [
  "Agenda inteligente e prontuário eletrônico",
  "Gestão financeira e faturamento TISS",
  "WhatsApp integrado e marketing",
  "Telemedicina e anamnese digital",
];

const sindicatoFeatures = [
  "Filiação, contribuições e jurídico",
  "App do associado (PWA) com benefícios",
  "Homologação e contracheques digitais",
  "Portal do contador e portal empresa",
];

export default function HubLandingPage() {
  useEffect(() => {
    document.title = "Prosinge — Sistema completo para Clínicas e Sindicatos";
    const meta = document.querySelector('meta[name="description"]');
    const content =
      "Escolha o módulo ideal: Prosinge Clínica para gestão de clínicas e consultórios, ou Prosinge Sindicato para sindicatos, associações e federações.";
    if (meta) meta.setAttribute("content", content);
    else {
      const m = document.createElement("meta");
      m.name = "description";
      m.content = content;
      document.head.appendChild(m);
    }
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1">
        <section className="relative min-h-screen flex items-center pt-24 pb-20 overflow-hidden">
          {/* Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.04] via-background to-primary/[0.06]" />
          <div className="absolute top-0 right-0 w-[700px] h-[700px] bg-primary/[0.05] rounded-full blur-[120px] -translate-y-1/4 translate-x-1/4" />

          <div className="container relative z-10">
            {/* Heading */}
            <div className="max-w-3xl mx-auto text-center mb-16">
              <div className="inline-flex items-center gap-2 bg-primary/8 border border-primary/15 text-primary text-xs font-semibold px-4 py-2 rounded-full mb-8 backdrop-blur-sm">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                +200 entidades confiam no Prosinge
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.08] tracking-tight text-foreground mb-6">
                Qual módulo do <span className="text-primary">Prosinge</span> é para você?
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
                Uma plataforma, dois módulos especializados. Escolha a solução ideal para o seu negócio e comece agora mesmo.
              </p>
            </div>

            {/* Cards */}
            <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              {/* Clínica */}
              <Link
                to="/clinica"
                className="group relative bg-card border border-border/60 rounded-3xl p-8 lg:p-10 hover:border-primary/40 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-300 hover:-translate-y-1"
              >
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/15 transition-colors">
                  <Stethoscope className="w-7 h-7 text-primary" />
                </div>
                <div className="inline-flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider mb-3">
                  Módulo Clínica
                </div>
                <h2 className="text-2xl lg:text-3xl font-bold text-foreground mb-3">
                  Prosinge Clínica
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-6">
                  Sistema completo para clínicas, consultórios e centros médicos. Agenda, prontuário, financeiro e muito mais.
                </p>
                <ul className="space-y-3 mb-8">
                  {clinicaFeatures.map((feature) => (
                    <li key={feature} className="flex items-start gap-3 text-sm text-foreground/80">
                      <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex items-center gap-2 text-primary font-semibold text-sm group-hover:gap-3 transition-all">
                  Conhecer o módulo Clínica
                  <ArrowRight className="w-4 h-4" />
                </div>
              </Link>

              {/* Sindicato */}
              <Link
                to="/sindicato-saas"
                className="group relative bg-card border border-border/60 rounded-3xl p-8 lg:p-10 hover:border-primary/40 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-300 hover:-translate-y-1"
              >
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/15 transition-colors">
                  <Building2 className="w-7 h-7 text-primary" />
                </div>
                <div className="inline-flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider mb-3">
                  Módulo Sindicato
                </div>
                <h2 className="text-2xl lg:text-3xl font-bold text-foreground mb-3">
                  Prosinge Sindicato
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-6">
                  Plataforma completa para sindicatos, associações e federações. Gestão sindical + app do associado.
                </p>
                <ul className="space-y-3 mb-8">
                  {sindicatoFeatures.map((feature) => (
                    <li key={feature} className="flex items-start gap-3 text-sm text-foreground/80">
                      <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex items-center gap-2 text-primary font-semibold text-sm group-hover:gap-3 transition-all">
                  Conhecer o módulo Sindicato
                  <ArrowRight className="w-4 h-4" />
                </div>
              </Link>
            </div>

            {/* CTA secundário */}
            <div className="text-center mt-16">
              <p className="text-sm text-muted-foreground mb-4">
                Não tem certeza qual escolher? Fale com um especialista.
              </p>
              <Button
                variant="outline"
                className="rounded-full px-8 h-12"
                asChild
              >
                <Link to="/cadastro">Solicitar uma demonstração</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}