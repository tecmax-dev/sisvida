import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import {
  Building2,
  Users,
  Receipt,
  PiggyBank,
  FileBarChart,
  Shield,
  Handshake,
  ArrowRight,
  MessageCircle,
  CheckCircle2,
  BarChart3,
  Globe,
  HeadphonesIcon,
  Layers,
  Scale,
  Phone,
  Mail,
  MapPin,
  Star,
  Menu,
  X,
  ChevronRight,
  Zap,
  TrendingUp,
  Lock,
  ClipboardCheck,
  Stethoscope,
} from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { PublicPageWrapper } from "@/components/layout/PublicLayout";
import prosindwebLogo from "@/assets/prosindweb-logo.png";
import sindicalHeroDashboard from "@/assets/sindical-dashboard-blurred.png";
import sindicalContribuicoes from "@/assets/sindical-contribuicoes.jpg";
import sindicalRelatorios from "@/assets/sindical-relatorios.jpg";

/* ═══════════════════════════════════════════════════════════════
   DESIGN SYSTEM — Cores sólidas (sem gradientes)
   Azul Royal: hsl(215,85%,25%)  →  hsl(215,85%,50%)
   Vermelho CTA: hsl(0,85%,50%)
   ═══════════════════════════════════════════════════════════════ */

// ─── Animated Counter ───────────────────────────────────────────
function AnimatedCounter({ end, suffix = "", prefix = "" }: { end: number; suffix?: string; prefix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          const startTime = Date.now();
          const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / 2000, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.floor(eased * end));
            if (progress < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [end]);

  return <div ref={ref}>{prefix}{count}{suffix}</div>;
}

// ─── Header ─────────────────────────────────────────────────────
function SindicalHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { href: "#sobre", label: "Sobre" },
    { href: "#modulos", label: "Módulos" },
    { href: "#resultados", label: "Resultados" },
    { href: "#depoimentos", label: "Clientes" },
    { href: "#contato", label: "Contato" },
  ];

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled
        ? "bg-white/95 backdrop-blur-lg border-b border-gray-200 shadow-sm"
        : "bg-transparent"
    }`}>
      <div className="container">
        <div className="flex items-center justify-between h-18 py-4">
          <Link to="/sindical" className="flex items-center">
            <img src={prosindwebLogo} alt="ProsindWeb" className="h-10 w-auto" />
          </Link>

          <nav className="hidden lg:flex items-center gap-8">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className={`text-sm font-semibold transition-colors ${
                  scrolled ? "text-gray-600 hover:text-gray-900" : "text-white/70 hover:text-white"
                }`}
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              asChild
              className={`hidden sm:flex font-semibold ${
                scrolled ? "text-gray-600 hover:text-gray-900" : "text-white/70 hover:text-white hover:bg-white/10"
              }`}
            >
              <Link to="/entidade-sindical">Área da Entidade</Link>
            </Button>
            <Button
              size="sm"
              className="rounded-full font-bold bg-[hsl(0,85%,50%)] hover:bg-[hsl(0,85%,42%)] text-white shadow-lg"
              asChild
            >
              <a href="#contato">Demonstração</a>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={`lg:hidden ${scrolled ? "text-gray-700" : "text-white"}`}
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {mobileOpen && (
          <div className="lg:hidden py-4 border-t border-white/10 bg-[hsl(215,85%,15%)]">
            <nav className="flex flex-col gap-1">
              {links.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  className="text-white/80 hover:text-white px-4 py-3 rounded-lg hover:bg-white/5 font-medium"
                  onClick={() => setMobileOpen(false)}
                >
                  {l.label}
                </a>
              ))}
              <Link
                to="/entidade-sindical"
                className="text-white/80 hover:text-white px-4 py-3 rounded-lg hover:bg-white/5 font-medium"
                onClick={() => setMobileOpen(false)}
              >
                Área da Entidade
              </Link>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}

// ─── Hero Section — Dark Navy ───────────────────────────────────
function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center bg-[hsl(215,85%,12%)] overflow-hidden">
      {/* Decorative shapes */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full bg-[hsl(215,85%,20%)] opacity-30 -translate-y-1/2 translate-x-1/3" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-[hsl(0,85%,50%)] opacity-[0.06] translate-y-1/2 -translate-x-1/3" />

      <div className="container relative z-10 py-32 lg:py-40">
        <div className="grid lg:grid-cols-12 gap-12 items-center">
          {/* Content — 5 cols */}
          <div className="lg:col-span-5 order-2 lg:order-1">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 mb-8">
              <Zap className="h-3.5 w-3.5 text-[hsl(0,85%,55%)]" />
              <span className="text-xs font-bold text-white/60 tracking-wider uppercase">
                Plataforma Líder em Gestão Sindical
              </span>
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black leading-[0.92] tracking-tight text-white mb-6">
              Gestão
              <br />
              <span className="text-[hsl(0,85%,55%)]">Sindical</span>
              <br />
              Inteligente.
            </h1>

            <p className="text-lg text-white/50 max-w-md leading-relaxed mb-10">
              Arrecadação, associados, contribuições e finanças. Tudo integrado em uma plataforma
              que já transformou mais de 500 entidades no Brasil.
            </p>

            {/* CTA row */}
            <div className="flex flex-col sm:flex-row gap-4 mb-12">
              <Button
                size="lg"
                className="h-14 px-8 text-base font-bold rounded-full bg-[hsl(0,85%,50%)] hover:bg-[hsl(0,85%,42%)] text-white shadow-2xl hover:scale-105 transition-all"
                asChild
              >
                <a href="#contato" className="flex items-center gap-2">
                  Solicitar Demonstração
                  <ArrowRight className="h-5 w-5" />
                </a>
              </Button>
              <Button
                size="lg"
                className="h-14 px-8 text-base font-bold rounded-full border border-white/30 bg-transparent text-white hover:bg-white/10"
                asChild
              >
                <a
                  href="https://wa.me/551151943839?text=Olá! Gostaria de agendar uma reunião sobre o ProsindWeb."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2"
                >
                  <MessageCircle className="h-5 w-5" />
                  Falar no WhatsApp
                </a>
              </Button>
            </div>

            {/* Trust badges */}
            <div className="flex flex-wrap gap-6 text-sm text-white/40">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-[hsl(0,85%,55%)]" />
                <span>Dados protegidos</span>
              </div>
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-[hsl(215,85%,60%)]" />
                <span>100% na nuvem</span>
              </div>
              <div className="flex items-center gap-2">
                <HeadphonesIcon className="h-4 w-4 text-[hsl(0,70%,55%)]" />
                <span>Suporte dedicado</span>
              </div>
            </div>
          </div>

          {/* Dashboard Image — 7 cols */}
          <div className="lg:col-span-7 order-1 lg:order-2 relative">
            <div className="relative">
              {/* Glow behind image */}
              <div className="absolute inset-0 bg-[hsl(215,85%,40%)] opacity-10 blur-3xl rounded-3xl scale-110" />
              <img
                src={sindicalHeroDashboard}
                alt="ProsindWeb - Dashboard de Gestão Sindical"
                className="relative w-full h-auto rounded-2xl shadow-2xl border border-white/10"
                loading="eager"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Social Proof Bar ───────────────────────────────────────────
function SocialProofBar() {
  const stats = [
    { value: "500+", label: "Entidades" },
    { value: "98%", label: "Retenção" },
    { value: "45%", label: "Mais Arrecadação" },
    { value: "10+", label: "Anos no Mercado" },
  ];

  return (
    <section className="bg-white border-b border-gray-100">
      <div className="container py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((s, i) => (
            <div key={i} className="text-center">
              <div className="text-3xl md:text-4xl font-black text-[hsl(215,85%,25%)]">
                {s.value}
              </div>
              <div className="text-sm text-gray-500 font-medium mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── About Section ──────────────────────────────────────────────
function AboutSection() {
  const features = [
    { icon: Building2, title: "Gestão de Empresas", desc: "Cadastro completo com CNPJ" },
    { icon: Users, title: "Sócios e Dependentes", desc: "Carteirinha digital e portal" },
    { icon: Receipt, title: "Contribuições", desc: "Boletos e cobranças em lote" },
    { icon: PiggyBank, title: "Financeiro", desc: "Receitas, despesas e fluxo" },
    { icon: Handshake, title: "Negociações", desc: "Acordos e parcelamentos" },
    { icon: ClipboardCheck, title: "Homologação", desc: "Agendamento e protocolos" },
    { icon: Stethoscope, title: "Clínica Integrada", desc: "Agenda e prontuário eletrônico" },
    { icon: FileBarChart, title: "Relatórios", desc: "Gerenciais e fiscais" },
  ];

  return (
    <section id="sobre" className="py-24 lg:py-32 bg-white">
      <div className="container">
        <div className="max-w-3xl mx-auto text-center mb-20">
          <span className="inline-block px-4 py-1.5 rounded-full bg-[hsl(215,85%,95%)] text-[hsl(215,85%,35%)] text-xs font-bold tracking-wider uppercase mb-6">
            Sobre o Sistema
          </span>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-black text-gray-900 leading-tight mb-6">
            Tudo que sua entidade precisa.{" "}
            <span className="text-[hsl(0,85%,50%)]">Num só lugar.</span>
          </h2>
          <p className="text-lg text-gray-500 leading-relaxed">
            O ProsindWeb é um software completo para{" "}
            <strong className="text-gray-800">gerenciamento de entidades sindicais</strong>,
            incorporando todos os departamentos, subsedes e escritórios regionais.
            Em média, nossos clientes aumentam <strong className="text-gray-800">45% da arrecadação</strong>.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f, i) => (
            <div
              key={i}
              className="group relative p-8 rounded-2xl border border-gray-200 bg-white hover:border-[hsl(215,85%,50%)] hover:shadow-xl transition-all duration-300"
            >
              <div className="w-14 h-14 rounded-2xl bg-[hsl(215,85%,25%)] flex items-center justify-center mb-5 group-hover:bg-[hsl(0,85%,50%)] transition-colors duration-300">
                <f.icon className="h-7 w-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">{f.title}</h3>
              <p className="text-gray-500">{f.desc}</p>
              <ChevronRight className="absolute top-8 right-8 h-5 w-5 text-gray-300 group-hover:text-[hsl(0,85%,50%)] transition-colors" />
            </div>
          ))}
        </div>

        <div className="text-center mt-12">
          <Button
            size="lg"
            className="h-14 px-10 rounded-full font-bold bg-[hsl(215,85%,25%)] hover:bg-[hsl(215,85%,20%)] text-white"
            asChild
          >
            <a href="#contato" className="flex items-center gap-2">
              Agendar Reunião
              <ArrowRight className="h-5 w-5" />
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}

// ─── Modules Section — Stacked Cards ────────────────────────────
const modules = [
  {
    icon: Receipt,
    title: "Arrecadação",
    description:
      "Emissão de boletos em lote, integração bancária, controle de inadimplência automatizado e relatórios detalhados de arrecadação.",
    highlights: ["Boletos em lote", "Integração bancária", "Inadimplência", "Relatórios"],
    accent: "bg-[hsl(0,85%,50%)]",
  },
  {
    icon: PiggyBank,
    title: "Contas a Pagar e Receber",
    description:
      "Controle de convênios, guias e pagamentos com categorização automática e alertas de vencimento.",
    highlights: ["Vencimentos", "Categorização", "Aprovações", "Alertas"],
    accent: "bg-[hsl(215,85%,50%)]",
  },
  {
    icon: BarChart3,
    title: "Fluxo de Caixa",
    description:
      "Visão consolidada de entradas e saídas com relatórios comparativos e projeções financeiras.",
    highlights: ["Consolidado", "Comparativos", "Projeções", "Portadores"],
    accent: "bg-[hsl(215,85%,25%)]",
  },
  {
    icon: Building2,
    title: "Gestão de Empresas",
    description:
      "Cadastro completo de empresas contribuintes com dados fiscais, portal do contador e histórico.",
    highlights: ["CNPJ", "Portal contador", "Portal empresa", "Histórico"],
    accent: "bg-[hsl(0,75%,45%)]",
  },
  {
    icon: Users,
    title: "Sócios e Dependentes",
    description:
      "Carteirinhas digitais, dependentes, benefícios, portal do sócio e comunicação via WhatsApp.",
    highlights: ["Carteirinha", "Dependentes", "Portal sócio", "WhatsApp"],
    accent: "bg-[hsl(0,85%,50%)]",
  },
  {
    icon: Handshake,
    title: "Negociações e Acordos",
    description:
      "Parcelamento de débitos, acordos automatizados, controle de parcelas e histórico completo.",
    highlights: ["Parcelamento", "Acordos", "Parcelas", "Histórico"],
    accent: "bg-[hsl(215,70%,40%)]",
  },
  {
    icon: FileBarChart,
    title: "Relatórios Gerenciais",
    description:
      "Relatórios para assembleias, auditorias e órgãos fiscalizadores. Exportação PDF e Excel.",
    highlights: ["Assembleias", "PDF/Excel", "Dashboards", "KPIs"],
    accent: "bg-[hsl(215,85%,30%)]",
  },
  {
    icon: Shield,
    title: "Auditoria e Segurança",
    description:
      "Log completo de auditoria, permissões por perfil, rastreabilidade total e proteção de dados.",
    highlights: ["Auditoria", "Permissões", "Rastreabilidade", "Segurança"],
    accent: "bg-[hsl(215,50%,20%)]",
  },
  {
    icon: ClipboardCheck,
    title: "Homologação",
    description:
      "Agendamento online de homologações com calendário exclusivo, notificações automáticas via WhatsApp para associado, gestor e profissional, e controle completo de protocolos.",
    highlights: ["Agendamento online", "Notificações WhatsApp", "Protocolos", "Calendário"],
    accent: "bg-[hsl(0,85%,50%)]",
  },
  {
    icon: Stethoscope,
    title: "Módulo Clínica",
    description:
      "Gestão completa de atendimentos clínicos integrados à entidade: agenda de profissionais, prontuário eletrônico, anamnese digital, procedimentos e controle de convênios.",
    highlights: ["Agenda médica", "Prontuário eletrônico", "Anamnese digital", "Convênios"],
    accent: "bg-[hsl(215,85%,50%)]",
  },
];

function ModulesSection() {
  return (
    <section id="modulos" className="py-24 lg:py-32 bg-[hsl(215,30%,97%)]">
      <div className="container">
        <div className="max-w-3xl mb-16">
          <span className="inline-block px-4 py-1.5 rounded-full bg-[hsl(0,85%,95%)] text-[hsl(0,85%,45%)] text-xs font-bold tracking-wider uppercase mb-6">
            Módulos do Sistema
          </span>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-black text-gray-900 leading-tight mb-4">
            10 módulos.{" "}
            <span className="text-[hsl(215,85%,50%)]">Uma plataforma.</span>
          </h2>
          <p className="text-lg text-gray-500">
            Cada módulo foi projetado para resolver um problema real da gestão sindical.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {modules.map((mod, i) => (
            <div
              key={i}
              className="group bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-xl transition-all duration-300"
            >
              <div className="p-8">
                <div className="flex items-start gap-5 mb-5">
                  <div className={`w-12 h-12 rounded-xl ${mod.accent} flex items-center justify-center flex-shrink-0`}>
                    <mod.icon className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{mod.title}</h3>
                    <p className="text-gray-500 text-sm leading-relaxed">{mod.description}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {mod.highlights.map((h, j) => (
                    <span
                      key={j}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-100 text-xs font-semibold text-gray-600"
                    >
                      <CheckCircle2 className="h-3 w-3 text-[hsl(0,85%,50%)]" />
                      {h}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Results Section — Dark ─────────────────────────────────────
function ResultsSection() {
  return (
    <section id="resultados" className="py-24 lg:py-32 bg-[hsl(215,85%,12%)] text-white">
      <div className="container">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <span className="inline-block px-4 py-1.5 rounded-full border border-white/10 bg-white/5 text-white/60 text-xs font-bold tracking-wider uppercase mb-6">
              Resultados Comprovados
            </span>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-black leading-tight mb-6">
              Números que
              <br />
              <span className="text-[hsl(0,85%,55%)]">falam por si.</span>
            </h2>
            <p className="text-lg text-white/50 mb-12 max-w-md">
              Mais de uma década transformando a gestão de entidades sindicais em todo o Brasil.
            </p>

            <div className="grid grid-cols-2 gap-10">
              {[
                { end: 500, suffix: "+", label: "Entidades", desc: "em todo o Brasil" },
                { end: 98, suffix: "%", label: "Retenção", desc: "de clientes" },
                { end: 45, suffix: "%", label: "Mais Receita", desc: "em média" },
                { end: 10, suffix: "+", label: "Anos", desc: "de experiência" },
              ].map((s, i) => (
                <div key={i}>
                  <div className="text-4xl md:text-5xl font-black text-white mb-1">
                    <AnimatedCounter end={s.end} suffix={s.suffix} />
                  </div>
                  <div className="font-bold text-white/80">{s.label}</div>
                  <div className="text-sm text-white/40">{s.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Coverage bars */}
          <div className="bg-white/5 border border-white/10 rounded-3xl p-10">
            <h3 className="text-2xl font-bold text-white mb-2">Abrangência Nacional</h3>
            <p className="text-white/40 mb-10 text-sm">
              Confederações, Federações, Sindicatos e Associações.
            </p>
            <div className="space-y-8">
              {[
                { label: "Cobertura Nacional", pct: 99, color: "bg-[hsl(0,85%,50%)]" },
                { label: "Aumento de Arrecadação", pct: 48, color: "bg-[hsl(215,85%,50%)]" },
                { label: "Participação de Mercado", pct: 74, color: "bg-white" },
              ].map((bar, i) => (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-white/60">{bar.label}</span>
                    <span className="font-bold text-white">{bar.pct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${bar.color}`}
                      style={{ width: `${bar.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Testimonials ───────────────────────────────────────────────
const testimonials = [
  {
    quote:
      "O ProsindWeb revolucionou nossa gestão. A arrecadação aumentou significativamente e temos controle total sobre as finanças.",
    name: "Maria Santos",
    role: "Diretora Administrativa",
    org: "SINDICOMÉRCIO",
  },
  {
    quote:
      "Encontramos uma forma de inovar com a arrecadação. Um software que proporciona economia de tempo e conta com equipe especializada.",
    name: "Carlos Oliveira",
    role: "Assessor Técnico",
    org: "FECOMÉRCIO",
  },
  {
    quote:
      "O sistema estabeleceu qualidade nas informações e padronização no atendimento. Suporte competente e prestativo.",
    name: "Ana Ramos",
    role: "Gerente Administrativa",
    org: "SINCOMERCIÁRIOS",
  },
];

function TestimonialsSection() {
  return (
    <section id="depoimentos" className="py-24 lg:py-32 bg-white">
      <div className="container">
        <div className="text-center mb-16">
          <span className="inline-block px-4 py-1.5 rounded-full bg-[hsl(215,85%,95%)] text-[hsl(215,85%,35%)] text-xs font-bold tracking-wider uppercase mb-6">
            Depoimentos
          </span>
          <h2 className="text-4xl md:text-5xl font-black text-gray-900">
            Quem usa, <span className="text-[hsl(0,85%,50%)]">recomenda.</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((t, i) => (
            <div
              key={i}
              className="relative p-8 rounded-2xl border border-gray-200 bg-white hover:shadow-xl transition-all duration-300"
            >
              {/* Quote mark */}
              <div className="text-6xl font-serif text-[hsl(0,85%,50%)] opacity-20 leading-none mb-4">
                "
              </div>
              <p className="text-gray-600 leading-relaxed mb-8">{t.quote}</p>
              <div className="flex items-center gap-4 pt-6 border-t border-gray-100">
                <div className="w-12 h-12 rounded-full bg-[hsl(215,85%,25%)] flex items-center justify-center text-white font-bold text-lg">
                  {t.name.charAt(0)}
                </div>
                <div>
                  <div className="font-bold text-gray-900">{t.name}</div>
                  <div className="text-sm text-gray-500">
                    {t.role} · {t.org}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Audience Section ───────────────────────────────────────────
function AudienceSection() {
  const audiences = [
    { icon: Users, title: "Sindicatos", desc: "De todas as categorias profissionais." },
    { icon: Building2, title: "Federações", desc: "Estaduais e regionais." },
    { icon: Layers, title: "Confederações", desc: "Gestão de grande escala." },
    { icon: Scale, title: "Associações", desc: "Entidades que buscam modernização." },
  ];

  return (
    <section className="py-24 lg:py-32 bg-[hsl(215,30%,97%)]">
      <div className="container">
        <div className="text-center mb-16">
          <span className="inline-block px-4 py-1.5 rounded-full bg-[hsl(0,85%,95%)] text-[hsl(0,85%,45%)] text-xs font-bold tracking-wider uppercase mb-6">
            Para quem é
          </span>
          <h2 className="text-4xl md:text-5xl font-black text-gray-900">
            Feito para{" "}
            <span className="text-[hsl(215,85%,50%)]">entidades sindicais.</span>
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {audiences.map((a, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl p-8 border border-gray-200 text-center hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
            >
              <div className="w-16 h-16 rounded-2xl bg-[hsl(215,85%,25%)] mx-auto mb-5 flex items-center justify-center">
                <a.icon className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{a.title}</h3>
              <p className="text-sm text-gray-500">{a.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── CTA Section ────────────────────────────────────────────────
function CTASection() {
  return (
    <section id="contato" className="py-24 lg:py-32 bg-[hsl(215,85%,12%)] relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-[hsl(0,85%,50%)] opacity-[0.05] -translate-y-1/2 translate-x-1/3" />

      <div className="container relative z-10">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-black text-white leading-tight mb-6">
            Pronto para
            <br />
            <span className="text-[hsl(0,85%,55%)]">transformar</span> sua entidade?
          </h2>
          <p className="text-lg text-white/50 mb-10 max-w-xl mx-auto">
            Solicite uma demonstração gratuita e veja na prática como o ProsindWeb pode aumentar
            sua arrecadação e simplificar a gestão.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="h-14 px-10 rounded-full text-base font-bold shadow-2xl hover:scale-105 transition-all bg-[hsl(0,85%,50%)] hover:bg-[hsl(0,85%,42%)] text-white"
              asChild
            >
              <a
                href="mailto:contato@prosindweb.com.br?subject=Demonstração ProsindWeb"
                className="flex items-center gap-2"
              >
                Solicitar Demonstração
                <ArrowRight className="h-5 w-5" />
              </a>
            </Button>
            <Button
              size="lg"
              className="h-14 px-10 rounded-full text-base font-bold border border-white/30 bg-transparent text-white hover:bg-white/10"
              asChild
            >
              <a
                href="https://wa.me/551151943839?text=Olá! Gostaria de agendar uma demonstração do ProsindWeb."
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2"
              >
                <MessageCircle className="h-5 w-5" />
                Falar pelo WhatsApp
              </a>
            </Button>
          </div>

          <p className="mt-8 text-white/30 text-sm">
            Demonstração gratuita · Sem compromisso · Suporte em português
          </p>
        </div>
      </div>
    </section>
  );
}

// ─── Footer ─────────────────────────────────────────────────────
function SindicalFooter() {
  return (
    <footer className="bg-[hsl(215,85%,8%)] text-white/60 py-16">
      <div className="container">
        <div className="grid md:grid-cols-4 gap-12">
          <div className="md:col-span-2">
            <img src={prosindwebLogo} alt="ProsindWeb" className="h-12 w-auto mb-4 brightness-0 invert" />
            <p className="text-white/40 mb-6 max-w-sm">
              Solução completa para gestão de entidades sindicais. Transparência, organização e eficiência.
            </p>
            <div className="flex gap-3">
              <a
                href="https://wa.me/551151943839"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
              >
                <MessageCircle className="h-5 w-5" />
              </a>
              <a
                href="mailto:contato@prosindweb.com.br"
                className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
              >
                <Mail className="h-5 w-5" />
              </a>
            </div>
          </div>

          <div>
            <h4 className="font-bold text-white mb-4">Contato</h4>
            <ul className="space-y-3 text-white/40">
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                (11) 5194-3839
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                contato@prosindweb.com.br
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="h-4 w-4 mt-1 flex-shrink-0" />
                Salvador, Bahia - Brasil
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-white mb-4">Links</h4>
            <ul className="space-y-3 text-white/40">
              <li>
                <a href="#sobre" className="hover:text-white transition-colors">Sobre</a>
              </li>
              <li>
                <a href="#modulos" className="hover:text-white transition-colors">Módulos</a>
              </li>
              <li>
                <a href="#depoimentos" className="hover:text-white transition-colors">Depoimentos</a>
              </li>
              <li>
                <Link to="/politica-privacidade" className="hover:text-white transition-colors">Privacidade</Link>
              </li>
              <li>
                <Link to="/termos-uso" className="hover:text-white transition-colors">Termos de Uso</Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 mt-12 pt-8 text-center text-white/30 text-sm">
          <p>© {new Date().getFullYear()} ProsindWeb - Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  );
}

// ─── Main Page ──────────────────────────────────────────────────
export default function SindicalLandingPage() {
  useEffect(() => {
    const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    const originalHref = favicon?.href || "/favicon.ico";
    if (favicon) favicon.href = "/favicon-prosindweb.png";
    document.title = "ProsindWeb - Sistema de Gestão Sindical";
    return () => {
      if (favicon) favicon.href = originalHref;
      document.title = "ProSindWeb - Sistema de Gestão Sindical";
    };
  }, []);

  return (
    <PublicPageWrapper>
      <SindicalHeader />
      <main>
        <HeroSection />
        <SocialProofBar />
        <AboutSection />
        <ModulesSection />
        <ResultsSection />
        <TestimonialsSection />
        <AudienceSection />
        <CTASection />
      </main>
      <SindicalFooter />
    </PublicPageWrapper>
  );
}
