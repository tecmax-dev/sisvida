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
  Lock, 
  Layers,
  Building,
  UserCheck,
  Scale,
  Globe,
  Sparkles,
  Phone,
  Mail,
  MapPin,
  Play,
  TrendingUp,
  Clock,
  HeadphonesIcon,
  Monitor,
  Briefcase,
  FileText,
  ChevronRight,
  Star,
  Menu,
  X
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { PublicPageWrapper } from "@/components/layout/PublicLayout";
import prosindwebLogo from "@/assets/prosindweb-logo.png"; // ProsindWeb branding
import sindicalHeroDashboard from "@/assets/sindical-dashboard-blurred.png";

// ─── Animated Counter ───────────────────────────────────────────────
function AnimatedCounter({ end, suffix = "", prefix = "", duration = 2000 }: { end: number; suffix?: string; prefix?: string; duration?: number }) {
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
            const progress = Math.min(elapsed / duration, 1);
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
  }, [end, duration]);

  return <div ref={ref}>{prefix}{count}{suffix}</div>;
}

// ─── Hero Section ───────────────────────────────────────────────────
function HeroSection() {
  return (
    <section className="relative min-h-[100vh] flex items-center overflow-hidden">
      {/* Light gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(215,60%,97%)] via-white to-[hsl(120,40%,97%)]" />
      
      {/* Subtle grid pattern */}
      <div className="absolute inset-0 opacity-[0.04]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h40v40H0z' fill='none' stroke='%23336699' stroke-width='0.3'/%3E%3C/svg%3E")`,
        backgroundSize: '40px 40px'
      }} />

      {/* Gradient orbs */}
      <div className="absolute top-20 left-[-200px] w-[600px] h-[600px] rounded-full blur-[120px] opacity-[0.08]"
        style={{ background: 'hsl(215 85% 50%)' }}
      />
      <div className="absolute bottom-0 right-[-100px] w-[500px] h-[500px] rounded-full blur-[120px] opacity-[0.06]"
        style={{ background: 'hsl(120 65% 45%)' }}
      />

      <div className="container relative z-10 py-24 lg:py-32">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left - Content */}
          <div className="order-2 lg:order-1">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[hsl(215,85%,50%,0.15)] bg-[hsl(215,85%,50%,0.06)] mb-8">
              <span className="w-2 h-2 rounded-full bg-[hsl(30,90%,55%)] animate-pulse" />
              <span className="text-sm text-[hsl(215,50%,35%)] font-medium">Plataforma de Gestão Integrada</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold leading-[0.95] text-gray-900 mb-4 tracking-tight">
              <span className="block text-gray-400 text-2xl sm:text-3xl lg:text-4xl font-medium mb-2">GESTÃO SINDICAL</span>
              <span style={{
                background: 'linear-gradient(135deg, hsl(215 85% 50%), hsl(30 90% 55%), hsl(120 65% 45%))',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>
                ProsindWeb
              </span>
            </h1>

            <p className="text-lg lg:text-xl text-gray-500 font-medium mt-6 max-w-xl leading-relaxed">
              Solução completa em gestão para Entidades Sindicais do Brasil. Controle financeiro, associados, contribuições e negociações em um único sistema.
            </p>

            {/* Trust badges */}
            <div className="flex flex-wrap gap-6 mt-8 text-sm text-gray-400">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-[hsl(120,65%,45%)]" />
                <span>Dados protegidos</span>
              </div>
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-[hsl(215,85%,50%)]" />
                <span>100% na nuvem</span>
              </div>
              <div className="flex items-center gap-2">
                <HeadphonesIcon className="h-4 w-4 text-[hsl(30,90%,55%)]" />
                <span>Suporte dedicado</span>
              </div>
            </div>

            <div className="mt-10 flex flex-col sm:flex-row gap-4">
              <Button 
                size="lg" 
                className="h-14 px-8 text-base font-semibold rounded-full shadow-2xl transition-all hover:scale-105"
                style={{
                  background: 'linear-gradient(135deg, hsl(215 85% 50%), hsl(120 65% 45%))',
                  color: 'white',
                }}
                asChild
              >
                <a href="#contato" className="flex items-center gap-2">
                  Solicitar Demonstração
                  <ArrowRight className="h-5 w-5" />
                </a>
              </Button>
              <Button 
                size="lg"
                variant="outline"
                className="h-14 px-8 text-base font-semibold rounded-full border-[hsl(215,85%,50%,0.3)] text-[hsl(215,85%,45%)] hover:bg-[hsl(215,85%,50%,0.08)]"
                asChild
              >
                <a 
                  href="https://wa.me/551151943839?text=Olá! Gostaria de agendar uma reunião sobre o ProsindWeb."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2"
                >
                  <MessageCircle className="h-5 w-5" />
                  Agendar Reunião
                </a>
              </Button>
            </div>
          </div>

          {/* Right - Dashboard Image */}
          <div className="order-1 lg:order-2 relative">
            <div className="relative z-10">
              <img 
                src={sindicalHeroDashboard} 
                alt="ProsindWeb - Dashboard de Gestão Sindical mostrando gráficos, relatórios e controle de associados" 
                className="w-full h-auto drop-shadow-2xl transform lg:scale-110 lg:translate-x-8"
                loading="eager"
              />
            </div>
            {/* Glow behind image */}
            <div className="absolute inset-0 -z-10 scale-90 blur-[60px] opacity-20 rounded-3xl"
              style={{ background: 'linear-gradient(135deg, hsl(215 85% 50%), hsl(120 65% 45%))' }}
            />
          </div>
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white to-transparent" />
    </section>
  );
}

// ─── About Section ──────────────────────────────────────────────────
function AboutSection() {
  return (
    <section id="sobre" className="py-24 lg:py-32 bg-white">
      <div className="container">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 text-xs font-bold tracking-wider mb-6">
              SOBRE O SISTEMA
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6 leading-tight">
            O que é o{" "}
            <span style={{
               background: 'linear-gradient(135deg, hsl(215 85% 50%), hsl(120 65% 45%))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              ProsindWeb
            </span>?
            </h2>
            <p className="text-lg text-gray-600 mb-6 leading-relaxed">
              O <strong className="text-gray-900">ProsindWeb é um software desenvolvido para Gerenciamento de Entidades</strong>, com a proposta de informatizar e facilitar o dia a dia com tecnologia avançada. <strong className="text-gray-900">Incorporando todos os departamentos, subsedes e escritórios regionais</strong>.
            </p>
            <p className="text-lg text-gray-600 mb-6 leading-relaxed">
              O <strong className="text-gray-900">ProsindWeb é composto por Módulos completos</strong> e configuráveis, integrados entre si. Novas versões são disponibilizadas sem custos adicionais.
            </p>
            <p className="text-lg text-gray-600 mb-8 leading-relaxed">
              O ProsindWeb é um software que <strong className="text-gray-900">aumenta, em média, 45% da sua arrecadação</strong> através da redução de custos operacionais e economia de tempo em processos.
            </p>
            <Button 
              size="lg"
              className="h-14 px-8 rounded-full font-semibold"
              style={{
                 background: 'linear-gradient(135deg, hsl(215 85% 50%), hsl(120 65% 45%))',
                color: 'white',
              }}
              asChild
            >
              <a href="#contato" className="flex items-center gap-2">
                Agendar Reunião
                <ArrowRight className="h-5 w-5" />
              </a>
            </Button>
          </div>

          <div className="relative">
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-3xl p-10 border border-gray-200 shadow-xl">
              <div className="grid grid-cols-2 gap-5">
                {[
                   { icon: Building2, label: "Gestão de Empresas", desc: "Cadastro completo", color: "from-[hsl(30,90%,55%)] to-[hsl(30,85%,45%)]" },
                   { icon: Users, label: "Cadastro de Sócios", desc: "Associados e dependentes", color: "from-[hsl(215,85%,50%)] to-[hsl(215,80%,40%)]" },
                   { icon: Receipt, label: "Contribuições", desc: "Boletos e cobranças", color: "from-[hsl(120,65%,45%)] to-[hsl(120,60%,35%)]" },
                   { icon: PiggyBank, label: "Financeiro", desc: "Receitas e despesas", color: "from-[hsl(215,70%,40%)] to-[hsl(215,85%,30%)]" },
                   { icon: Handshake, label: "Negociações", desc: "Acordos e parcelamentos", color: "from-[hsl(30,80%,50%)] to-[hsl(15,75%,45%)]" },
                   { icon: FileBarChart, label: "Relatórios", desc: "Gerenciais e fiscais", color: "from-[hsl(120,55%,40%)] to-[hsl(160,60%,35%)]" },
                ].map((item, i) => (
                  <div key={i} className="flex flex-col items-center p-5 rounded-2xl bg-white shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 border border-gray-100">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center mb-3`}>
                      <item.icon className="h-6 w-6 text-white" />
                    </div>
                    <span className="text-sm font-bold text-gray-900 text-center">{item.label}</span>
                    <span className="text-xs text-gray-500 text-center mt-1">{item.desc}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full blur-2xl opacity-40"
              style={{ background: 'hsl(215 85% 50%)' }}
            />
            <div className="absolute -bottom-4 -left-4 w-24 h-24 rounded-full blur-2xl opacity-30"
              style={{ background: 'hsl(120 65% 45%)' }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Modules Section (Alternating Layout like GERSIN) ───────────────
const modules = [
  {
    icon: Receipt,
    title: "Arrecadação",
    description: "Cadastros, emissão de boletos e controle financeiro. Crucial para a transformação de resultados da Entidade. Geração em lote, integração bancária e controle de inadimplência automatizado.",
    color: "from-[hsl(120,65%,45%)] to-[hsl(120,60%,35%)]",
    highlights: ["Emissão de boletos em lote", "Integração bancária", "Controle de inadimplência", "Relatórios de arrecadação"],
  },
  {
    icon: PiggyBank,
    title: "Contas a Pagar e Receber",
    description: "Controle eficaz de convênios, guias e pagamentos, proporcionando gestão financeira mais precisa e transparente para toda a entidade.",
    color: "from-[hsl(215,85%,50%)] to-[hsl(215,80%,40%)]",
    highlights: ["Controle de vencimentos", "Categorização automática", "Fluxo de aprovações", "Alertas de pagamento"],
  },
  {
    icon: BarChart3,
    title: "Fluxo de Caixa",
    description: "Controle total das entradas e saídas financeiras, com relatórios comparativos e ferramentas de análise para tomada de decisão.",
    color: "from-[hsl(215,70%,40%)] to-[hsl(215,85%,30%)]",
    highlights: ["Visão consolidada", "Relatórios comparativos", "Projeções financeiras", "Múltiplos portadores"],
  },
  {
    icon: Building2,
    title: "Gestão de Empresas",
    description: "Cadastro completo de empresas contribuintes com dados fiscais, documentos, histórico de contribuições e relacionamento com escritórios contábeis.",
    color: "from-[hsl(30,90%,55%)] to-[hsl(30,85%,45%)]",
    highlights: ["Cadastro com CNPJ", "Portal do contador", "Portal da empresa", "Histórico completo"],
  },
  {
    icon: Users,
    title: "Gestão de Sócios e Dependentes",
    description: "Administre o cadastro de associados com dependentes, carteirinhas digitais, controle de benefícios e comunicação direta.",
    color: "from-[hsl(30,80%,50%)] to-[hsl(15,75%,45%)]",
    highlights: ["Carteirinha digital", "Dependentes e benefícios", "Portal do sócio", "Comunicação por WhatsApp"],
  },
  {
    icon: Handshake,
    title: "Negociações e Acordos",
    description: "Facilite agendamentos e controle de negociações, parcelamentos de débitos e acordos de pagamento com empresas inadimplentes.",
    color: "from-[hsl(160,60%,40%)] to-[hsl(120,55%,35%)]",
    highlights: ["Parcelamento de débitos", "Acordos automatizados", "Controle de parcelas", "Histórico de negociações"],
  },
  {
    icon: FileBarChart,
    title: "Relatórios Gerenciais",
    description: "Relatórios profissionais para gestão interna, assembleias, auditorias e órgãos fiscalizadores. Exportação em PDF e Excel.",
    color: "from-[hsl(215,50%,35%)] to-[hsl(215,60%,25%)]",
    highlights: ["Relatórios de assembleias", "Exportação PDF/Excel", "Dashboards visuais", "Indicadores de desempenho"],
  },
  {
    icon: Shield,
    title: "Auditoria e Segurança",
    description: "Todas as ações são registradas com rastreabilidade completa. Controle de permissões granular por perfil de usuário.",
    color: "from-[hsl(215,30%,30%)] to-[hsl(215,40%,20%)]",
    highlights: ["Log de auditoria", "Permissões por perfil", "Rastreabilidade total", "Segurança de dados"],
  },
];

function ModulesSection() {
  return (
    <section id="modulos" className="py-24 lg:py-32 bg-gray-50">
      <div className="container">
        <div className="text-center mb-20">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-200 text-gray-600 text-xs font-bold tracking-wider mb-6">
            MÓDULOS DO SISTEMA
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Módulos de Gestão{" "}
            <span style={{
               background: 'linear-gradient(135deg, hsl(215 85% 50%), hsl(120 65% 45%))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              Integrados
            </span>
          </h2>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            Conheça cada módulo que compõe o sistema mais completo para gestão de entidades sindicais.
          </p>
        </div>

        <div className="space-y-8">
          {modules.map((mod, i) => (
            <div
              key={i}
              className={`flex flex-col ${i % 2 === 0 ? 'lg:flex-row' : 'lg:flex-row-reverse'} gap-8 bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-500 group`}
            >
              {/* Icon/Visual side */}
              <div className={`lg:w-2/5 bg-gradient-to-br ${mod.color} p-10 lg:p-16 flex flex-col items-center justify-center text-center min-h-[280px]`}>
                <mod.icon className="h-16 w-16 text-white mb-4 group-hover:scale-110 transition-transform duration-500" />
                <h3 className="text-2xl lg:text-3xl font-bold text-white">{mod.title}</h3>
              </div>

              {/* Content side */}
              <div className="lg:w-3/5 p-8 lg:p-12 flex flex-col justify-center">
                <p className="text-lg text-gray-600 mb-6 leading-relaxed">
                  {mod.description}
                </p>
                <div className="grid grid-cols-2 gap-3 mb-6">
                  {mod.highlights.map((h, j) => (
                    <div key={j} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-[hsl(120,65%,45%)] flex-shrink-0" />
                      <span className="text-gray-700">{h}</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-3">
                  <Button 
                    size="sm"
                    className="rounded-full font-semibold"
                    style={{
                       background: 'linear-gradient(135deg, hsl(215 85% 50%), hsl(120 65% 45%))',
                      color: 'white',
                    }}
                    asChild
                  >
                    <a href="#contato" className="flex items-center gap-2">
                      Agendar Reunião
                      <ChevronRight className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Stats Section ──────────────────────────────────────────────────
function StatsSection() {
  return (
    <section className="py-24 lg:py-32 bg-white">
      <div className="container">
        <div className="grid lg:grid-cols-2 gap-16">
          {/* Left: counter stats */}
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 text-xs font-bold tracking-wider mb-6">
              NÚMEROS QUE IMPRESSIONAM
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-12">
              Resultados que{" "}
              <span style={{
                 background: 'linear-gradient(135deg, hsl(215 85% 50%), hsl(120 65% 45%))',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>
                comprovam
              </span>
            </h2>

            <div className="grid grid-cols-2 gap-8">
              {[
                { end: 500, suffix: "+", label: "Entidades Atendidas", desc: "Sindicatos, federações e confederações confiam no sistema." },
                { end: 98, suffix: "%", label: "Retenção de Clientes", desc: "Satisfação contínua e fidelidade de nossos parceiros." },
                { end: 45, suffix: "%", label: "Aumento na Arrecadação", desc: "Média de crescimento na arrecadação das entidades." },
                { end: 10, suffix: "+", label: "Anos de Experiência", desc: "Expertise consolidada em gestão sindical digital." },
              ].map((stat, i) => (
                <div key={i} className="text-left">
                  <div className="text-4xl md:text-5xl font-bold mb-2" style={{
                     background: 'linear-gradient(135deg, hsl(215 85% 50%), hsl(120 65% 45%))',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}>
                    <AnimatedCounter end={stat.end} suffix={stat.suffix} prefix={stat.end > 100 ? "+" : ""} />
                  </div>
                  <div className="font-bold text-gray-900 mb-1">{stat.label}</div>
                  <div className="text-sm text-gray-500">{stat.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: coverage map stats */}
          <div className="bg-gradient-to-br from-[hsl(215,60%,97%)] to-[hsl(120,40%,97%)] rounded-3xl p-10 border border-gray-200 shadow-lg flex flex-col justify-center">
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Nossa Abrangência</h3>
            <p className="text-gray-500 mb-10">
              Presentes em todo o território nacional, atendendo diversas Confederações, Federações, Sindicatos e Associações.
            </p>
            <div className="space-y-8">
              {[
                { label: "Estados Brasileiros", pct: 99 },
                { label: "Aumento de Arrecadação", pct: 48 },
                { label: "Participação de Mercado", pct: 74 },
              ].map((bar, i) => (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">{bar.label}</span>
                    <span className="font-bold text-gray-900">{bar.pct}%</span>
                  </div>
                  <div className="h-3 rounded-full bg-gray-200 overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-1000"
                      style={{
                        width: `${bar.pct}%`,
                        background: 'linear-gradient(90deg, hsl(215 85% 50%), hsl(120 65% 45%))',
                      }}
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

// ─── Testimonials Section ───────────────────────────────────────────
const testimonials = [
  {
    quote: "O ProsindWeb revolucionou nossa gestão. A arrecadação aumentou significativamente e temos controle total sobre as finanças. O suporte é excepcional e sempre disponível.",
    name: "Maria Santos",
    role: "Diretora Administrativa",
    org: "SINDICOMÉRCIO",
  },
  {
    quote: "Encontramos neste sistema uma forma de inovar com a arrecadação das contribuições. Um software que além de proporcionar economia de tempo e dinheiro, conta com equipe especializada na segurança dos dados sindicais.",
    name: "Carlos Oliveira",
    role: "Assessor Técnico",
    org: "FECOMÉRCIO",
  },
  {
    quote: "O sistema estabeleceu qualidade nas informações e padronização no atendimento. Contamos com um suporte competente e prestativo, que nos orienta inclusive na questão financeira.",
    name: "Ana Ramos",
    role: "Gerente Administrativa",
    org: "SINCOMERCIÁRIOS",
  },
];

function TestimonialsSection() {
  return (
    <section id="depoimentos" className="py-24 lg:py-32 bg-gray-50">
      <div className="container">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-200 text-gray-600 text-xs font-bold tracking-wider mb-6">
            DEPOIMENTOS
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            O que dizem nossos{" "}
            <span style={{
               background: 'linear-gradient(135deg, hsl(215 85% 50%), hsl(120 65% 45%))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              clientes
            </span>
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((t, i) => (
            <div key={i} className="bg-white rounded-3xl p-8 border border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col">
              <div className="flex gap-1 mb-6">
                {[...Array(5)].map((_, j) => (
                  <Star key={j} className="h-5 w-5 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="text-gray-600 leading-relaxed mb-8 flex-1 italic">
                "{t.quote}"
              </p>
              <div className="flex items-center gap-4 pt-6 border-t border-gray-100">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
                   style={{ background: 'linear-gradient(135deg, hsl(215 85% 50%), hsl(120 65% 45%))' }}
                >
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

// ─── Audience Section ───────────────────────────────────────────────
function AudienceSection() {
  return (
    <section id="publico" className="py-24 lg:py-32 bg-white">
      <div className="container">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 text-xs font-bold tracking-wider mb-6">
            PARA QUEM É
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Desenvolvido para{" "}
            <span style={{
               background: 'linear-gradient(135deg, hsl(215 85% 50%), hsl(120 65% 45%))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              entidades sindicais
            </span>
          </h2>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { icon: Users, title: "Sindicatos de Trabalhadores", desc: "Sindicatos de todas as categorias profissionais." },
            { icon: Building2, title: "Federações", desc: "Federações estaduais e regionais." },
            { icon: Layers, title: "Confederações", desc: "Gestão de grande escala e múltiplas entidades." },
            { icon: Scale, title: "Associações de Classe", desc: "Entidades representativas que buscam modernização." },
          ].map((a, i) => (
            <div key={i} className="group text-center p-8 bg-gray-50 rounded-3xl border border-gray-200 hover:border-transparent hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
              style={{ '--hover-bg': 'linear-gradient(135deg, hsl(215 85% 50%), hsl(120 65% 45%))' } as any}
            >
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 transition-colors duration-300"
                style={{ background: 'linear-gradient(135deg, hsl(215 85% 50% / 0.1), hsl(120 65% 45% / 0.1))' }}
              >
                <a.icon className="h-8 w-8" style={{ color: 'hsl(215 85% 50%)' }} />
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

// ─── CTA Section ────────────────────────────────────────────────────
function CTASection() {
  return (
    <section id="contato" className="py-24 lg:py-32 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(215,60%,96%)] via-white to-[hsl(120,40%,96%)]" />
      <div className="absolute inset-0 opacity-[0.05]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0L60 15V45L30 60L0 45V15Z' fill='none' stroke='%23336699' stroke-width='0.5'/%3E%3C/svg%3E")`,
        backgroundSize: '60px 60px'
      }} />

      <div className="container relative z-10">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Pronto para modernizar a gestão da sua entidade?
          </h2>
          <p className="text-lg md:text-xl text-gray-500 mb-10 max-w-2xl mx-auto">
            Solicite uma demonstração gratuita e descubra como o ProsindWeb pode transformar a sua entidade.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg"
              className="h-14 px-8 rounded-full text-base font-semibold shadow-2xl hover:scale-105 transition-all"
              style={{
                background: 'linear-gradient(135deg, hsl(215 85% 50%), hsl(120 65% 45%))',
                color: 'white',
              }}
              asChild
            >
              <a href="mailto:contato@prosindweb.com.br?subject=Demonstração ProsindWeb" className="flex items-center gap-2">
                Solicitar demonstração
                <ArrowRight className="h-5 w-5" />
              </a>
            </Button>
            <Button 
              size="lg"
              variant="outline"
              className="h-14 px-8 rounded-full text-base font-semibold border-[hsl(215,85%,50%,0.3)] text-[hsl(215,85%,45%)] hover:bg-[hsl(215,85%,50%,0.08)]"
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

          <p className="mt-8 text-gray-400 text-sm">
            Demonstração gratuita • Sem compromisso • Suporte em português
          </p>
        </div>
      </div>
    </section>
  );
}

// ─── Header ─────────────────────────────────────────────────────────
function SindicalHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-200/80 shadow-sm">
      <div className="container">
        <div className="flex items-center justify-between h-16">
          <Link to="/sindical" className="flex items-center">
            <img src={prosindwebLogo} alt="ProsindWeb - Sistema Web para Gestão Sindical" className="h-10 w-auto" />
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            {[
              { href: "#sobre", label: "Sobre" },
              { href: "#modulos", label: "Módulos" },
              { href: "#depoimentos", label: "Depoimentos" },
              { href: "#publico", label: "Para quem" },
              { href: "#contato", label: "Contato" },
            ].map((l) => (
              <a key={l.href} href={l.href} className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">
                {l.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild className="hidden sm:flex text-gray-500 hover:text-gray-900">
              <Link to="/entidade-sindical">Área da Entidade</Link>
            </Button>
            <Button size="sm" className="rounded-full font-semibold" style={{
              background: 'linear-gradient(135deg, hsl(215 85% 50%), hsl(120 65% 45%))',
              color: 'white',
            }} asChild>
              <a href="#contato">Demonstração</a>
            </Button>
            <Button variant="ghost" size="icon" className="md:hidden text-gray-700" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden py-4 border-t border-gray-200">
            <nav className="flex flex-col gap-3">
              {["Sobre", "Módulos", "Depoimentos", "Para quem", "Contato"].map((l) => (
                <a key={l} href={`#${l.toLowerCase().replace(/\s/g, '')}`} 
                  className="text-gray-500 hover:text-gray-900 px-3 py-2"
                  onClick={() => setMobileOpen(false)}
                >
                  {l}
                </a>
              ))}
              <Link to="/entidade-sindical" className="text-gray-500 hover:text-gray-900 px-3 py-2">
                Área da Entidade
              </Link>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}

// ─── Footer ─────────────────────────────────────────────────────────
function SindicalFooter() {
  return (
    <footer className="bg-gray-50 text-gray-700 py-16 border-t border-gray-200">
      <div className="container">
        <div className="grid md:grid-cols-4 gap-12">
          <div className="md:col-span-2">
            <div className="mb-4">
              <img src={prosindwebLogo} alt="ProsindWeb - Sistema Web para Gestão Sindical" className="h-12 w-auto" />
            </div>
            <p className="text-gray-500 mb-6 max-w-md">
              Solução completa para gestão de entidades sindicais. Transparência, organização e eficiência.
            </p>
            <div className="flex gap-3">
              <a href="https://wa.me/551151943839" target="_blank" rel="noopener noreferrer"
                className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300 transition-colors text-gray-600">
                <MessageCircle className="h-5 w-5" />
              </a>
              <a href="mailto:contato@prosindweb.com.br"
                className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300 transition-colors text-gray-600">
                <Mail className="h-5 w-5" />
              </a>
            </div>
          </div>

          <div>
            <h4 className="font-bold text-gray-900 mb-4">Contato</h4>
            <ul className="space-y-3 text-gray-500">
              <li className="flex items-center gap-2"><Phone className="h-4 w-4" />(71) 98278-6864</li>
              <li className="flex items-center gap-2"><Mail className="h-4 w-4" />contato@prosindweb.com.br</li>
              <li className="flex items-start gap-2"><MapPin className="h-4 w-4 mt-1 flex-shrink-0" />Salvador, Bahia - Brasil</li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-gray-900 mb-4">Links</h4>
            <ul className="space-y-3 text-gray-500">
              <li><a href="#sobre" className="hover:text-gray-900 transition-colors">Sobre o Sistema</a></li>
              <li><a href="#modulos" className="hover:text-gray-900 transition-colors">Módulos</a></li>
              <li><a href="#depoimentos" className="hover:text-gray-900 transition-colors">Depoimentos</a></li>
              <li><Link to="/politica-privacidade" className="hover:text-gray-900 transition-colors">Privacidade</Link></li>
              <li><Link to="/termos-uso" className="hover:text-gray-900 transition-colors">Termos de Uso</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-200 mt-12 pt-8 text-center text-gray-400 text-sm">
          <p>© {new Date().getFullYear()} ProsindWeb - Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────
export default function SindicalLandingPage() {
  // Set ProsindWeb favicon only on this page
  useEffect(() => {
    const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    const originalHref = favicon?.href || '/favicon.ico';
    if (favicon) {
      favicon.href = '/favicon-prosindweb.png';
    }
    document.title = 'ProsindWeb - Sistema de Gestão Sindical';
    return () => {
      if (favicon) favicon.href = originalHref;
      document.title = 'ProSindWeb - Sistema de Gestão Sindical';
    };
  }, []);

  return (
    <PublicPageWrapper>
      <SindicalHeader />
      <main>
        <HeroSection />
        <AboutSection />
        <ModulesSection />
        <StatsSection />
        <TestimonialsSection />
        <AudienceSection />
        <CTASection />
      </main>
      <SindicalFooter />
    </PublicPageWrapper>
  );
}
