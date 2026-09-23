import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import {
  ArrowRight,
  Building2,
  Stethoscope,
  CheckCircle2,
  ShieldCheck,
  Headphones,
  Sparkles,
} from "lucide-react";
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
    <div className="min-h-screen flex flex-col bg-prosinge-cream font-body">
      <Header />

      <main className="flex-1">
        {/* HERO ESMERALDA */}
        <section className="relative overflow-hidden bg-prosinge-emerald px-6 pt-28 pb-24 lg:pt-32">
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

          <div className="relative z-10 mx-auto max-w-5xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-prosinge-gold/30 bg-prosinge-gold/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-prosinge-gold">
              <Sparkles className="h-3.5 w-3.5" />
              +200 entidades confiam no Prosinge
            </div>
            <h1 className="mb-6 font-display text-4xl font-bold leading-[1.05] tracking-tight text-prosinge-cream md:text-5xl lg:text-6xl">
              Qual módulo do{" "}
              <span className="text-prosinge-gold">Prosinge</span>
              <br className="hidden sm:block" /> é para você?
            </h1>
            <p className="mx-auto mb-2 max-w-2xl text-lg leading-relaxed text-prosinge-cream/80">
              Uma plataforma, dois módulos especializados. Escolha a solução
              ideal para a sua entidade e comece agora mesmo.
            </p>
          </div>
        </section>

        {/* CARDS BENTO */}
        <section className="relative -mt-16 px-6 pb-20">
          <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-2">
            {/* Clínica */}
            <Link
              to="/clinica"
              className="group relative flex flex-col overflow-hidden rounded-3xl border border-prosinge-emerald/10 bg-white p-8 shadow-xl shadow-prosinge-emerald/5 transition-all hover:-translate-y-1 hover:shadow-2xl lg:p-10"
            >
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-prosinge-cream text-prosinge-emerald-mid">
                <Stethoscope className="h-7 w-7" />
              </div>
              <div className="mb-3 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-prosinge-emerald-mid">
                Módulo Clínica
              </div>
              <h2 className="mb-3 font-display text-2xl font-bold text-prosinge-emerald lg:text-3xl">
                Prosinge Clínica
              </h2>
              <p className="mb-6 leading-relaxed text-prosinge-emerald/70">
                Sistema completo para clínicas, consultórios e centros médicos.
                Agenda, prontuário, financeiro e muito mais.
              </p>
              <ul className="mb-8 space-y-3">
                {clinicaFeatures.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-3 text-sm text-prosinge-emerald/85"
                  >
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-prosinge-gold" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-auto flex items-center gap-2 font-bold text-prosinge-emerald transition-all group-hover:gap-3">
                Conhecer o módulo Clínica
                <ArrowRight className="h-4 w-4" />
              </div>
            </Link>

            {/* Sindicato - destaque esmeralda */}
            <Link
              to="/sindicato-saas"
              className="group relative flex flex-col overflow-hidden rounded-3xl bg-prosinge-emerald p-8 text-prosinge-cream shadow-xl shadow-prosinge-emerald/20 transition-all hover:-translate-y-1 hover:shadow-2xl lg:p-10"
            >
              <div
                aria-hidden
                className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-prosinge-gold/15 blur-3xl"
              />
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-prosinge-gold text-prosinge-emerald">
                <Building2 className="h-7 w-7" />
              </div>
              <div className="mb-3 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-prosinge-gold">
                Módulo Sindicato
              </div>
              <h2 className="mb-3 font-display text-2xl font-bold lg:text-3xl">
                Prosinge Sindicato
              </h2>
              <p className="mb-6 leading-relaxed text-prosinge-cream/75">
                Plataforma completa para sindicatos, associações e federações.
                Gestão sindical + app do associado.
              </p>
              <ul className="mb-8 space-y-3">
                {sindicatoFeatures.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-3 text-sm text-prosinge-cream/90"
                  >
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-prosinge-gold" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-auto flex items-center gap-2 font-bold text-prosinge-gold transition-all group-hover:gap-3">
                Conhecer o módulo Sindicato
                <ArrowRight className="h-4 w-4" />
              </div>
            </Link>
          </div>

          {/* Faixa de confiança */}
          <div className="mx-auto mt-12 grid max-w-6xl grid-cols-1 gap-4 md:grid-cols-3">
            {[
              { icon: ShieldCheck, title: "100% LGPD", desc: "Dados seguros em nuvem" },
              { icon: Headphones, title: "Suporte Premium", desc: "Atendimento dedicado" },
              { icon: Sparkles, title: "Migração Gratuita", desc: "Implantação acompanhada" },
            ].map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="flex items-center gap-4 rounded-2xl border border-prosinge-emerald/10 bg-white p-5"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-prosinge-cream text-prosinge-emerald-mid">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-display text-base font-bold text-prosinge-emerald">
                    {title}
                  </p>
                  <p className="text-xs text-prosinge-emerald/65">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA FINAL */}
        <section className="bg-prosinge-cream px-6 pb-24">
          <div className="mx-auto max-w-5xl overflow-hidden rounded-3xl bg-prosinge-emerald shadow-2xl">
            <div className="grid gap-8 p-10 md:p-14 lg:grid-cols-2 lg:items-center">
              <div>
                <h2 className="mb-4 font-display text-3xl font-bold text-prosinge-cream md:text-4xl">
                  Não tem certeza qual módulo escolher?
                </h2>
                <p className="text-prosinge-cream/70">
                  Fale com um especialista e descubra a melhor combinação para a
                  sua entidade.
                </p>
              </div>
              <div className="flex flex-col items-stretch gap-4 lg:items-end">
                <div className="text-center lg:text-right">
                  <p className="text-xs font-bold uppercase tracking-widest text-prosinge-gold">
                    Central de Atendimento
                  </p>
                  <p className="font-display text-2xl font-bold text-prosinge-cream">
                    (11) 5194-3839
                  </p>
                </div>
                <Button
                  asChild
                  className="h-14 rounded-xl bg-prosinge-gold px-8 font-bold text-prosinge-emerald shadow-xl hover:bg-prosinge-gold/90"
                >
                  <a href="https://wa.me/551151943839?text=Ol%C3%A1!%20Quero%20testar%20o%20Prosinge%20gratuitamente." target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                    Solicitar uma demonstração
                    <ArrowRight className="h-5 w-5" />
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}