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
  Menu,
  X,
  ChevronRight,
  ChevronDown,
  Zap,
  ClipboardCheck,
  Stethoscope,
  AlertTriangle,
  RefreshCw,
  Database,
  CalendarCheck,
  Check,
  Star,
} from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { PublicPageWrapper } from "@/components/layout/PublicLayout";
const prosindwebLogo = "https://i.postimg.cc/nLVrgjcp/da68c6ad-24bb-45c7-9bf3-810bd718c71e.png";
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

// ─── FAQ Accordion Item ─────────────────────────────────────────
function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-6 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="font-bold text-gray-900 pr-4">{question}</span>
        <ChevronDown className={`h-5 w-5 text-gray-400 flex-shrink-0 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-6 pb-6 text-gray-500 leading-relaxed border-t border-gray-100 pt-4">
          {answer}
        </div>
      )}
    </div>
  );
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
    { href: "#recursos", label: "Recursos" },
    { href: "#modulos", label: "Módulos" },
    { href: "#resultados", label: "Resultados" },
    { href: "#depoimentos", label: "Clientes" },
    { href: "#planos", label: "Planos" },
    { href: "#contato", label: "Contato" },
  ];

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled
        ? "bg-white border-b border-gray-200 shadow-sm"
        : "bg-white"
    }`}>
      <div className="container">
        <div className="flex items-center justify-between h-16">
          <Link to="/sindical" className="flex items-center">
            <img src={prosindwebLogo} alt="Prosinge" className="h-9 w-auto" />
          </Link>

          <nav className="hidden lg:flex items-center gap-7">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-sm font-medium text-gray-600 hover:text-[hsl(215,85%,35%)] transition-colors"
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              asChild
              className="hidden sm:flex font-semibold text-gray-600 border-gray-300 hover:border-[hsl(215,85%,50%)] hover:text-[hsl(215,85%,35%)]"
            >
              <Link to="/entidade-sindical">Entrar</Link>
            </Button>
            <Button
              size="sm"
              className="font-bold bg-[hsl(215,85%,35%)] hover:bg-[hsl(215,85%,28%)] text-white"
              asChild
            >
              <a href="#contato">Solicite uma demonstração</a>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden text-gray-700"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {mobileOpen && (
          <div className="lg:hidden py-4 border-t border-gray-100">
            <nav className="flex flex-col gap-1">
              {links.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  className="text-gray-600 hover:text-[hsl(215,85%,35%)] px-4 py-3 rounded-lg hover:bg-gray-50 font-medium"
                  onClick={() => setMobileOpen(false)}
                >
                  {l.label}
                </a>
              ))}
              <Link
                to="/entidade-sindical"
                className="text-gray-600 hover:text-[hsl(215,85%,35%)] px-4 py-3 rounded-lg hover:bg-gray-50 font-medium"
                onClick={() => setMobileOpen(false)}
              >
                Entrar
              </Link>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}

// ─── Hero Section — Clean White ─────────────────────────────────
function HeroSection() {
  const [current, setCurrent] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heroSlides = [
    { src: sindicalHeroDashboard, alt: "Painel Intuitivo - Dashboard completo" },
    { src: sindicalContribuicoes, alt: "Contribuições Sindicais" },
    { src: sindicalRelatorios, alt: "Relatórios Financeiros" },
  ];

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setCurrent((p) => (p + 1) % heroSlides.length), 5000);
  }, []);

  useEffect(() => {
    startTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [startTimer]);

  return (
    <section className="pt-32 pb-16 lg:pt-40 lg:pb-24 bg-white relative overflow-hidden">
      {/* Subtle background pattern */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full bg-[hsl(215,85%,96%)] -translate-y-1/3 translate-x-1/4" />

      <div className="container relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left content */}
          <div>
            <span className="text-sm font-semibold text-[hsl(215,85%,45%)] tracking-wide mb-4 block">
              Sistema para gestão sindical
            </span>

            <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-black leading-[1.1] tracking-tight text-gray-900 mb-6">
              Simplifique a gestão{" "}
              <span className="text-[hsl(215,85%,45%)]">da sua entidade</span>
            </h1>

            <p className="text-lg text-gray-500 leading-relaxed max-w-lg mb-8">
              Simplifique sua rotina com arrecadação inteligente, gestão de associados,
              financeiro integrado e WhatsApp automatizado.
            </p>

            {/* Benefit list */}
            <div className="space-y-3 mb-10">
              {[
                "Aumente em até 45% a arrecadação",
                "Reduza inadimplência com cobrança automatizada",
                "Mais de 500 entidades atendidas",
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-[hsl(215,85%,45%)] flex-shrink-0" />
                  <span className="text-gray-700 font-medium">{item}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                size="lg"
                className="h-13 px-8 text-base font-bold bg-[hsl(215,85%,35%)] hover:bg-[hsl(215,85%,28%)] text-white shadow-lg"
                asChild
              >
                <a href="#contato" className="flex items-center gap-2">
                  Começar Grátis
                  <ArrowRight className="h-5 w-5" />
                </a>
              </Button>
            </div>
          </div>

          {/* Right — Hero mockup carousel */}
          <div className="relative">
            <div className="relative overflow-hidden rounded-2xl shadow-2xl border border-gray-200">
              {heroSlides.map((slide, i) => (
                <img
                  key={i}
                  src={slide.src}
                  alt={slide.alt}
                  className={`w-full h-auto transition-opacity duration-700 ${
                    i === current ? "opacity-100 relative" : "opacity-0 absolute inset-0"
                  }`}
                  loading={i === 0 ? "eager" : "lazy"}
                />
              ))}
            </div>

            {/* Floating cards */}
            <div className="absolute -left-4 top-1/4 bg-white rounded-xl shadow-xl border border-gray-100 p-4 hidden lg:block">
              <div className="text-xs text-gray-400 mb-1">Agendamentos</div>
              <div className="text-2xl font-black text-gray-900">450</div>
              <div className="flex gap-0.5 mt-1">
                {[1, 2, 3, 4].map(i => <div key={i} className="w-2 h-6 rounded-sm bg-[hsl(215,85%,50%)]" style={{ height: `${12 + i * 6}px` }} />)}
              </div>
            </div>

            <div className="absolute -right-4 bottom-1/4 bg-white rounded-xl shadow-xl border border-gray-100 p-4 hidden lg:block">
              <div className="text-xs text-gray-400 mb-1">Resumo financeiro</div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-500">Total a receber</span>
                <span className="font-bold text-[hsl(0,85%,45%)]">R$ 2.000,00</span>
              </div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-500">A vencer</span>
                <span className="font-semibold">R$ 1.000,00</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Vencidos</span>
                <span className="font-semibold text-[hsl(0,85%,45%)]">R$ 1.000,00</span>
              </div>
            </div>

            {/* Dots */}
            <div className="flex justify-center gap-2 mt-4">
              {heroSlides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => { setCurrent(i); startTimer(); }}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    i === current ? "w-8 bg-[hsl(215,85%,45%)]" : "w-2 bg-gray-300"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Testimonials Section ───────────────────────────────────────
const testimonials = [
  {
    quote: "O Prosinge revolucionou nossa gestão. A arrecadação aumentou significativamente e temos controle total sobre as finanças da entidade.",
    name: "Maria Santos",
    role: "Diretora Administrativa",
    org: "SINDICOMÉRCIO",
    stars: 5,
  },
  {
    quote: "Encontramos uma forma de inovar com a arrecadação. Um software que proporciona economia de tempo e conta com equipe especializada.",
    name: "Carlos Oliveira",
    role: "Assessor Técnico",
    org: "FECOMÉRCIO",
    stars: 5,
  },
  {
    quote: "O sistema estabeleceu qualidade nas informações e padronização no atendimento. Suporte competente e prestativo em todos os momentos.",
    name: "Ana Ramos",
    role: "Gerente Administrativa",
    org: "SINCOMERCIÁRIOS",
    stars: 5,
  },
  {
    quote: "A praticidade do sistema é incrível. O controle de contribuições ficou muito mais eficiente e a gestão dos associados simplificada.",
    name: "Roberto Lima",
    role: "Presidente",
    org: "SINDMETAL",
    stars: 5,
  },
];

function TestimonialsSection() {
  return (
    <section id="depoimentos" className="py-20 lg:py-28 bg-white">
      <div className="container">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-gray-900 mb-4">
            Opiniões reais de quem usa nosso software
          </h2>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {testimonials.map((t, i) => (
            <div
              key={i}
              className="p-8 rounded-2xl border border-gray-200 bg-white hover:shadow-lg transition-all duration-300"
            >
              <div className="flex gap-1 mb-4">
                {Array.from({ length: t.stars }).map((_, j) => (
                  <Star key={j} className="h-4 w-4 fill-[hsl(45,90%,50%)] text-[hsl(45,90%,50%)]" />
                ))}
              </div>
              <p className="text-gray-600 leading-relaxed mb-6 italic">"{t.quote}"</p>
              <div className="flex items-center gap-4 pt-4 border-t border-gray-100">
                <div className="w-12 h-12 rounded-full bg-[hsl(215,85%,25%)] flex items-center justify-center text-white font-bold text-lg">
                  {t.name.charAt(0)}
                </div>
                <div>
                  <div className="font-bold text-gray-900">{t.name}</div>
                  <div className="text-sm text-gray-500">{t.role} · {t.org}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Problem Section — What happens with wrong software ─────────
function ProblemSection() {
  return (
    <section className="py-20 lg:py-28 bg-[hsl(215,30%,97%)]">
      <div className="container">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left — Problem card */}
          <div className="bg-white rounded-2xl border border-gray-200 p-8 lg:p-10 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[hsl(0,85%,95%)] flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-[hsl(0,85%,50%)]" />
              </div>
              <h3 className="font-bold text-gray-900 text-lg">Software inadequado</h3>
            </div>
            <p className="text-sm text-gray-500 mb-4">Pode causar prejuízos</p>
            <div className="flex flex-wrap gap-2">
              {["Agenda duplicada", "Dados perdidos", "Falta de suporte"].map((item, i) => (
                <span key={i} className="px-3 py-1.5 bg-[hsl(0,85%,97%)] text-[hsl(0,85%,45%)] text-xs font-semibold rounded-full">
                  {item}
                </span>
              ))}
            </div>
          </div>

          {/* Right — Description */}
          <div>
            <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-6">
              O que pode acontecer se você utilizar o software errado?
            </h2>
            <ul className="space-y-4">
              {[
                "A entidade fica desorganizada, faltam processos padronizados",
                "Alto índice de inadimplência e perda de receita",
                "Controlar contribuições e cobranças é complicado",
                "Dificuldade na tomada de decisão e excesso de planilhas",
                "Prejuízos financeiros por falta de controle nos repasses",
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <X className="h-5 w-5 text-[hsl(0,85%,50%)] flex-shrink-0 mt-0.5" />
                  <span className="text-gray-600">{item}</span>
                </li>
              ))}
            </ul>
            <Button
              size="lg"
              className="mt-8 h-13 px-8 font-bold bg-[hsl(215,85%,35%)] hover:bg-[hsl(215,85%,28%)] text-white"
              asChild
            >
              <a href="#contato">Solicite uma demonstração</a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Migration Section ──────────────────────────────────────────
function MigrationSection() {
  return (
    <section className="py-20 lg:py-28 bg-white">
      <div className="container">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-4">
              Migrar para o Prosinge é fácil e seguro!
            </h2>
            <p className="text-gray-500 leading-relaxed mb-8">
              Muitas entidades já trouxeram seus dados para o Prosinge. O processo de{" "}
              <strong className="text-gray-800">migração de sistema</strong> é feito com total segurança,
              agilidade e sem interferir na rotina da equipe!
            </p>
            <div className="space-y-4 mb-8">
              {[
                "Migração com total segurança",
                "Processo ágil e sem interrupções",
                "Seus dados preservados 100%",
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-[hsl(145,60%,40%)]" />
                  <span className="text-gray-700 font-medium">{item}</span>
                </div>
              ))}
            </div>
            <Button
              size="lg"
              className="h-13 px-8 font-bold bg-[hsl(0,85%,50%)] hover:bg-[hsl(0,85%,42%)] text-white"
              asChild
            >
              <a href="#contato">Solicitar migração</a>
            </Button>
          </div>

          {/* Migration card */}
          <div className="bg-[hsl(215,30%,97%)] rounded-2xl border border-gray-200 p-8 lg:p-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[hsl(215,85%,25%)] flex items-center justify-center">
                <RefreshCw className="h-5 w-5 text-white" />
              </div>
              <h3 className="font-bold text-gray-900">Migração completa</h3>
            </div>
            <p className="text-sm text-gray-500 mb-6">Transferência segura</p>
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: Users, label: "Associados" },
                { icon: Receipt, label: "Contribuições" },
                { icon: PiggyBank, label: "Financeiro" },
                { icon: CalendarCheck, label: "Agendamentos" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 bg-white rounded-xl p-4 border border-gray-100">
                  <item.icon className="h-5 w-5 text-[hsl(215,85%,45%)]" />
                  <span className="text-sm font-semibold text-gray-700">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Feature Tabs Section ───────────────────────────────────────
const featureTabs = [
  {
    tag: "GESTÃO DE ASSOCIADOS",
    title: "Gestão de Associados",
    description: "Chega de fichas de papel. Com o cadastro digital, sua entidade torna todo o processo muito mais rápido, organizado e eficiente.",
    benefits: [
      "Carteirinhas digitais com QR Code",
      "Portal do associado com autoatendimento",
      "Comunicação automática via WhatsApp",
      "Gestão de dependentes e benefícios",
      "Controle de filiação e desfiliação",
    ],
  },
  {
    tag: "ARRECADAÇÃO",
    title: "Arrecadação Inteligente",
    description: "Todos os seus boletos, cobranças e contribuições podem ser gerenciados de maneira rápida e prática com a arrecadação automatizada.",
    benefits: [
      "Emissão de boletos em lote",
      "Integração bancária automática",
      "Controle de inadimplência",
      "Relatórios detalhados de arrecadação",
      "Cobranças recorrentes automatizadas",
    ],
  },
  {
    tag: "FINANCEIRO",
    title: "Controle Financeiro",
    description: "Nunca mais perca dinheiro! Nosso sistema proporciona visão completa do financeiro. Saiba quem pagou, quem está pendente e o fluxo de caixa.",
    benefits: [
      "Controle total de fluxo de caixa",
      "Contas a pagar e receber",
      "Relatórios gerenciais e fiscais",
      "Conciliação bancária",
      "Exportação para contabilidade",
    ],
  },
  {
    tag: "HOMOLOGAÇÃO",
    title: "Homologação Online",
    description: "Agendamento de homologações com calendário exclusivo, notificações automáticas e controle completo de protocolos e documentos.",
    benefits: [
      "Agendamento online para associados",
      "Notificações via WhatsApp",
      "Protocolos automáticos",
      "Calendário exclusivo por profissional",
      "Portal do empregador",
    ],
  },
];

function FeaturesSection() {
  const [activeTab, setActiveTab] = useState(0);
  const tab = featureTabs[activeTab];

  return (
    <section id="recursos" className="py-20 lg:py-28 bg-white">
      <div className="container">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-gray-900 mb-4">
            Simplifique a gestão da sua entidade com funcionalidades inteligentes.
          </h2>
        </div>

        {/* Tab nav */}
        <div className="flex flex-wrap justify-center gap-2 mb-12">
          {featureTabs.map((t, i) => (
            <button
              key={i}
              onClick={() => setActiveTab(i)}
              className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all ${
                i === activeTab
                  ? "bg-[hsl(215,85%,25%)] text-white shadow-lg"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {t.tag}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          <div>
            <span className="text-xs font-bold text-[hsl(215,85%,45%)] tracking-wider uppercase mb-3 block">
              {tab.tag}
            </span>
            <h3 className="text-3xl md:text-4xl font-black text-gray-900 mb-4">{tab.title}</h3>
            <p className="text-gray-500 leading-relaxed mb-8">{tab.description}</p>
            <ul className="space-y-3 mb-8">
              {tab.benefits.map((b, i) => (
                <li key={i} className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-[hsl(215,85%,45%)]" />
                  <span className="text-gray-700">{b}</span>
                </li>
              ))}
            </ul>
            <Button
              size="lg"
              className="h-13 px-8 font-bold bg-[hsl(215,85%,35%)] hover:bg-[hsl(215,85%,28%)] text-white"
              asChild
            >
              <a href="#contato">Conheça todos os recursos</a>
            </Button>
          </div>

          {/* Feature image placeholder with dashboard screenshot */}
          <div className="relative">
            <div className="rounded-2xl overflow-hidden shadow-xl border border-gray-200">
              <img
                src={activeTab === 0 ? sindicalHeroDashboard : activeTab === 1 ? sindicalContribuicoes : activeTab === 2 ? sindicalRelatorios : sindicalHeroDashboard}
                alt={tab.title}
                className="w-full h-auto"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Modules Section — Grid Cards ───────────────────────────────
const modules = [
  { icon: Receipt, title: "Arrecadação", desc: "Emissão de boletos em lote, integração bancária e controle de inadimplência.", highlights: ["Boletos em lote", "Inadimplência", "Relatórios"] },
  { icon: PiggyBank, title: "Contas a Pagar e Receber", desc: "Controle de convênios, guias e pagamentos com alertas de vencimento.", highlights: ["Vencimentos", "Categorização", "Alertas"] },
  { icon: BarChart3, title: "Fluxo de Caixa", desc: "Visão consolidada de entradas e saídas com relatórios comparativos.", highlights: ["Consolidado", "Comparativos", "Projeções"] },
  { icon: Building2, title: "Gestão de Empresas", desc: "Cadastro completo com dados fiscais, portal do contador e histórico.", highlights: ["CNPJ", "Portal contador", "Portal empresa"] },
  { icon: Users, title: "Sócios e Dependentes", desc: "Carteirinhas digitais, portal do sócio e comunicação via WhatsApp.", highlights: ["Carteirinha", "Portal sócio", "WhatsApp"] },
  { icon: Handshake, title: "Negociações e Acordos", desc: "Parcelamento de débitos, acordos automatizados e histórico completo.", highlights: ["Parcelamento", "Acordos", "Parcelas"] },
  { icon: FileBarChart, title: "Relatórios Gerenciais", desc: "Relatórios para assembleias, auditorias. Exportação PDF e Excel.", highlights: ["Assembleias", "PDF/Excel", "KPIs"] },
  { icon: Shield, title: "Auditoria e Segurança", desc: "Log de auditoria, permissões por perfil e proteção de dados.", highlights: ["Auditoria", "Permissões", "Segurança"] },
  { icon: ClipboardCheck, title: "Homologação", desc: "Agendamento online com notificações WhatsApp e controle de protocolos.", highlights: ["Agendamento", "WhatsApp", "Protocolos"] },
  { icon: Stethoscope, title: "Módulo Clínica", desc: "Agenda médica, prontuário eletrônico, anamnese digital e convênios.", highlights: ["Agenda médica", "Prontuário", "Anamnese"] },
];

function ModulesSection() {
  return (
    <section id="modulos" className="py-20 lg:py-28 bg-[hsl(215,30%,97%)]">
      <div className="container">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-gray-900 mb-4">
            10 módulos. <span className="text-[hsl(215,85%,45%)]">Uma plataforma.</span>
          </h2>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            Cada módulo foi projetado para resolver um problema real da gestão sindical.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {modules.map((mod, i) => (
            <div
              key={i}
              className="group bg-white rounded-2xl border border-gray-200 p-7 hover:shadow-lg hover:border-[hsl(215,85%,80%)] transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-xl bg-[hsl(215,85%,25%)] flex items-center justify-center mb-4 group-hover:bg-[hsl(0,85%,50%)] transition-colors duration-300">
                <mod.icon className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{mod.title}</h3>
              <p className="text-sm text-gray-500 mb-4 leading-relaxed">{mod.desc}</p>
              <div className="flex flex-wrap gap-1.5">
                {mod.highlights.map((h, j) => (
                  <span key={j} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 text-xs font-medium text-gray-600">
                    <CheckCircle2 className="h-3 w-3 text-[hsl(215,85%,45%)]" />
                    {h}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Stats Section ──────────────────────────────────────────────
function StatsSection() {
  return (
    <section id="resultados" className="py-20 lg:py-28 bg-white">
      <div className="container">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-8 text-center">
          {[
            { end: 500, suffix: "+", label: "Entidades" },
            { end: 98, suffix: "%", label: "Satisfação" },
            { end: 45, suffix: "%", label: "Mais arrecadação" },
            { end: 10, suffix: "+", label: "Anos de experiência" },
            { end: 99, suffix: "%", label: "Uptime" },
          ].map((s, i) => (
            <div key={i}>
              <div className="text-3xl md:text-4xl lg:text-5xl font-black text-[hsl(215,85%,35%)]">
                <AnimatedCounter end={s.end} suffix={s.suffix} />
              </div>
              <div className="text-sm text-gray-500 font-medium mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Mini Features Grid ─────────────────────────────────────────
function MiniFeatures() {
  const items = [
    { icon: Receipt, title: "Faturamento", desc: "Controle de contribuições automatizado com relatórios detalhados." },
    { icon: Building2, title: "Gestão de Empresas", desc: "Cadastro completo de empresas contribuintes e portal do contador." },
    { icon: Users, title: "Atendimento de Associados", desc: "Portal de autoatendimento e comunicação via WhatsApp." },
    { icon: MessageCircle, title: "WhatsApp Integrado", desc: "Ferramentas para comunicação direta com associados e empresas." },
  ];

  return (
    <section className="py-20 lg:py-28 bg-[hsl(215,30%,97%)]">
      <div className="container">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {items.map((item, i) => (
            <div key={i} className="bg-white rounded-2xl p-7 border border-gray-200 hover:shadow-lg transition-all">
              <div className="w-12 h-12 rounded-xl bg-[hsl(215,85%,93%)] flex items-center justify-center mb-4">
                <item.icon className="h-6 w-6 text-[hsl(215,85%,40%)]" />
              </div>
              <h3 className="font-bold text-gray-900 mb-2">{item.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Pricing Section ────────────────────────────────────────────
function PricingSection() {
  return (
    <section id="planos" className="py-20 lg:py-28 bg-white">
      <div className="container">
        <div className="text-center mb-16">
          <span className="text-sm font-semibold text-[hsl(215,85%,45%)] mb-2 block">Planos e preços</span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-gray-900 mb-4">
            Escolha o plano ideal
          </h2>
          <p className="text-gray-500">Sem fidelidade, cancele quando quiser. Todos os planos incluem suporte técnico.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {/* Essence */}
          <div className="rounded-2xl border border-gray-200 p-8 bg-white">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Essence</h3>
            <p className="text-sm text-gray-500 mb-6">Recursos essenciais para sua entidade</p>
            <div className="mb-6">
              <span className="text-4xl font-black text-gray-900">R$299</span>
              <span className="text-gray-500">/mês</span>
            </div>
            <ul className="space-y-3 mb-8">
              {[
                "Gestão de associados",
                "Arrecadação de contribuições",
                "Relatórios básicos",
                "3 usuários inclusos",
                "Carteirinha digital",
                "Portal do associado",
                "WhatsApp básico",
                "Exportação de relatórios",
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-sm">
                  <Check className="h-4 w-4 text-[hsl(215,85%,45%)]" />
                  <span className="text-gray-600">{item}</span>
                </li>
              ))}
            </ul>
            <Button
              className="w-full h-12 font-bold bg-white border-2 border-[hsl(215,85%,35%)] text-[hsl(215,85%,35%)] hover:bg-[hsl(215,85%,97%)]"
              asChild
            >
              <a href="#contato">Testar grátis</a>
            </Button>
          </div>

          {/* Sob Medida */}
          <div className="rounded-2xl border-2 border-[hsl(215,85%,45%)] p-8 bg-white relative">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-[hsl(215,85%,45%)] text-white text-xs font-bold rounded-full">
              Mais Popular
            </span>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Sob Medida</h3>
            <p className="text-sm text-gray-500 mb-6">Personalizado para sua necessidade</p>
            <div className="mb-6">
              <span className="text-4xl font-black text-[hsl(215,85%,35%)]">Sob Medida</span>
            </div>
            <ul className="space-y-3 mb-8">
              {[
                "Tudo do plano Essencial, mais:",
                "Preços sob medida",
                "Suporte personalizado exclusivo",
                "Consultoria e recursos avançados",
                "Módulo de Homologação",
                "Módulo Clínica integrado",
                "API para integrações",
                "IA Assistente WhatsApp",
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-sm">
                  <Check className="h-4 w-4 text-[hsl(215,85%,45%)]" />
                  <span className="text-gray-600">{item}</span>
                </li>
              ))}
            </ul>
            <Button
              className="w-full h-12 font-bold bg-[hsl(215,85%,35%)] hover:bg-[hsl(215,85%,28%)] text-white"
              asChild
            >
              <a href="https://wa.me/551151943839" target="_blank" rel="noopener noreferrer">
                Vamos conversar
              </a>
            </Button>
          </div>
        </div>

        {/* Trust badges */}
        <div className="flex flex-wrap justify-center gap-6 mt-12 text-sm text-gray-400">
          {["Sem taxas ocultas", "Suporte à migração", "Dados seguros (LGPD)"].map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <Check className="h-4 w-4" />
              {item}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── FAQ Section ────────────────────────────────────────────────
function FAQSection() {
  const faqs = [
    { q: "Como funciona o período de teste gratuito?", a: "Oferecemos um período de teste gratuito para que você conheça todas as funcionalidades do sistema. Durante esse período, você tem acesso completo a todas as ferramentas sem compromisso." },
    { q: "Preciso instalar algum software?", a: "Não! O Prosinge é 100% na nuvem. Basta acessar pelo navegador de qualquer dispositivo — computador, tablet ou celular." },
    { q: "Meus dados estão seguros?", a: "Sim. Utilizamos criptografia de ponta e seguimos todas as normas da LGPD para garantir a segurança e privacidade dos seus dados." },
    { q: "Posso cancelar a qualquer momento?", a: "Sim, não há fidelidade. Você pode cancelar seu plano a qualquer momento sem multas ou taxas adicionais." },
    { q: "Como funciona o suporte técnico?", a: "Oferecemos suporte técnico por WhatsApp, e-mail e telefone em horário comercial. Nosso time é especializado em gestão sindical." },
    { q: "O sistema funciona no celular?", a: "Sim! O Prosinge é totalmente responsivo e funciona em qualquer dispositivo. Além disso, oferecemos um aplicativo PWA para acesso rápido." },
  ];

  return (
    <section className="py-20 lg:py-28 bg-[hsl(215,30%,97%)]">
      <div className="container">
        <div className="text-center mb-12">
          <span className="text-sm font-semibold text-[hsl(215,85%,45%)] mb-2 block">Tire suas dúvidas</span>
          <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-4">
            Perguntas Frequentes
          </h2>
          <p className="text-gray-500">Encontre respostas para as dúvidas mais comuns sobre o Prosinge</p>
        </div>

        <div className="max-w-3xl mx-auto space-y-3">
          {faqs.map((faq, i) => (
            <FAQItem key={i} question={faq.q} answer={faq.a} />
          ))}
        </div>

        <div className="text-center mt-10">
          <p className="text-gray-500 mb-4">Ainda tem dúvidas? Fale com nossa equipe</p>
          <Button
            variant="outline"
            className="font-bold border-[hsl(215,85%,35%)] text-[hsl(215,85%,35%)] hover:bg-[hsl(215,85%,97%)]"
            asChild
          >
            <a href="https://wa.me/551151943839?text=Olá! Tenho uma dúvida sobre o Prosinge" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              Falar no WhatsApp
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}

// ─── CTA Section ────────────────────────────────────────────────
function CTASection() {
  return (
    <section id="contato" className="py-20 lg:py-28 bg-[hsl(215,85%,25%)]">
      <div className="container">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-white leading-tight mb-6">
            Pronto para transformar sua entidade?
          </h2>
          <p className="text-lg text-white/60 mb-10 max-w-xl mx-auto">
            Junte-se a centenas de entidades sindicais que já simplificaram sua gestão com o Prosinge.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="h-14 px-10 text-base font-bold shadow-lg bg-[hsl(0,85%,50%)] hover:bg-[hsl(0,85%,42%)] text-white"
              asChild
            >
              <a href="mailto:contato@prosinge.com.br?subject=Demonstração Prosinge" className="flex items-center gap-2">
                Começar grátis agora
                <ArrowRight className="h-5 w-5" />
              </a>
            </Button>
            <Button
              size="lg"
              className="h-14 px-10 text-base font-bold border border-white/30 bg-transparent text-white hover:bg-white/10"
              asChild
            >
              <a
                href="https://wa.me/551151943839?text=Olá! Gostaria de saber mais sobre o Prosinge."
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2"
              >
                <MessageCircle className="h-5 w-5" />
                Falar pelo WhatsApp
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Footer ─────────────────────────────────────────────────────
function SindicalFooter() {
  return (
    <footer className="bg-[hsl(215,85%,10%)] text-white/60 py-16">
      <div className="container">
        <div className="grid md:grid-cols-4 gap-12">
          <div className="md:col-span-2">
            <img src={prosindwebLogo} alt="Prosinge" className="h-10 w-auto mb-4 brightness-0 invert" />
            <p className="text-white/40 mb-6 max-w-sm text-sm leading-relaxed">
              Solução completa para gestão de entidades sindicais. Transparência, organização e eficiência.
            </p>
            <div className="flex gap-3">
              <a href="https://wa.me/551151943839" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
                <MessageCircle className="h-5 w-5" />
              </a>
              <a href="mailto:contato@prosinge.com.br" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
                <Mail className="h-5 w-5" />
              </a>
            </div>
          </div>

          <div>
            <h4 className="font-bold text-white mb-4 text-sm">Contato</h4>
            <ul className="space-y-3 text-white/40 text-sm">
              <li className="flex items-center gap-2"><Phone className="h-4 w-4" />(11) 5194-3839</li>
              <li className="flex items-center gap-2"><Mail className="h-4 w-4" />contato@prosinge.com.br</li>
              <li className="flex items-start gap-2"><MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />São Paulo, SP - Brasil</li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-white mb-4 text-sm">Links</h4>
            <ul className="space-y-3 text-white/40 text-sm">
              <li><a href="#recursos" className="hover:text-white transition-colors">Recursos</a></li>
              <li><a href="#modulos" className="hover:text-white transition-colors">Módulos</a></li>
              <li><a href="#depoimentos" className="hover:text-white transition-colors">Depoimentos</a></li>
              <li><Link to="/politica-privacidade" className="hover:text-white transition-colors">Privacidade</Link></li>
              <li><Link to="/termos-uso" className="hover:text-white transition-colors">Termos de Uso</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 mt-12 pt-8 text-center text-white/30 text-sm">
          <p>© {new Date().getFullYear()} Prosinge - Todos os direitos reservados.</p>
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
    if (favicon) favicon.href = "/favicon.png?v=prosinge-final-20260517c";
    document.title = "Prosinge - Sistema de Gestão Sindical";
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
        <StatsSection />
        <TestimonialsSection />
        <ProblemSection />
        <MigrationSection />
        <FeaturesSection />
        <ModulesSection />
        <MiniFeatures />
        <FAQSection />
        <CTASection />
      </main>
      <SindicalFooter />
    </PublicPageWrapper>
  );
}
