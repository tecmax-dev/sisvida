// SindicalLandingPage — layout inspirado em progess.com.br, identidade Prosinge.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PublicPageWrapper } from "@/components/layout/PublicLayout";
import prosingeLogo from "@/assets/prosinge-logo.png";
import heroPerson from "@/assets/sindical-hero-person.jpg";
import devicesImg from "@/assets/sindical-devices.jpg";
import { useTrialSignupEnabled } from "@/hooks/useTrialSignupEnabled";
import {
  ArrowRight,
  LogIn,
  Menu,
  X,
  Phone,
  Mail,
  MapPin,
  Users,
  Laptop,
  IdCard,
  Wallet,
  FileText,
  Check,
  ChevronLeft,
  ChevronRight,
  Building2,
  Landmark,
  Fish,
  Facebook,
  Instagram,
  Zap,
  AlertCircle,
  XCircle,
  ShieldCheck,
  Send,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════
   TOKENS (Progess-like palette)
   navy   #1f2a3a   |   orange #f5871f   |   teal #2aa5b8
   ═══════════════════════════════════════════════════════════════ */
const NAVY = "#1f2a3a";
const ORANGE = "#f5871f";
const TEAL = "#2aa5b8";

const NAV = [
  { href: "#inicio", label: "Início" },
  { href: "#plataforma", label: "Plataforma" },
  { href: "#solucoes", label: "Soluções" },
  { href: "#depoimentos", label: "Depoimentos" },
  { href: "#contato", label: "Contato" },
];

const FEATURES = [
  { icon: Laptop,   title: "100% online", desc: "O Prosinge não necessita de instalação. Acesse de qualquer computador ou celular com internet." },
  { icon: IdCard,   title: "Ficha & Carteirinha", desc: "Ficha de inscrição sindical com confecção automática da carteira digital ou física." },
  { icon: Wallet,   title: "Financeiro completo", desc: "Módulo financeiro com contas a pagar e a receber, saldos atuais e conciliação bancária." },
  { icon: FileText, title: "Relatórios", desc: "Diversos relatórios personalizados, gerados em tempo real, prontos para impressão." },
];

const CHECKLIST = [
  "Ficha de afiliados com impressão automática do formulário de desconto",
  "Atendimento de afiliados com protocolo",
  "Recibo de contribuições e prestação de serviços",
  "Lista de presença em reuniões online ou presenciais",
  "Cobranças automáticas e remessa/retorno bancário (CNAB)",
  "Portal do associado e carteirinha digital com QR Code",
];

const SOLUCOES = [
  { icon: Building2, title: "Associação",         desc: "Mais praticidade no dia a dia da sua associação." },
  { icon: Landmark,  title: "Sindicatos",         desc: "Agilize a gestão do seu sindicato com processos digitais." },
  { icon: Fish,      title: "Entidades de pesca", desc: "Facilite a gestão dos seus afiliados e colônias." },
];

const DEPOIMENTOS = [
  { nome: "Maria Rios",   cargo: "Pres. Sinspum — Riachão do Jacuípe/BA", texto: "O Prosinge é excelente, usamos há muitos anos, o pessoal está sempre atualizando o sistema com novidades." },
  { nome: "Antônio",      cargo: "Pres. do Sindpesca — Chapadinha/MA",     texto: "O Prosinge faz parte do nosso sindicato. Emitimos todos os documentos pelo sistema e o suporte é ótimo." },
  { nome: "Genival",      cargo: "Pres. do Sindsmur — Retirolândia/BA",    texto: "Usamos o sistema há mais de 10 anos, ele oferece tudo que precisamos para gerenciar o sindicato." },
  { nome: "Maria Roseane",cargo: "Pres. do SindVargem — Vargem Grande/MT", texto: "Temos o Prosinge há vários anos, o suporte é presente e o sistema é simples, completo e seguro." },
];

const WHATSAPP_URL = "https://wa.me/551151943839?text=Ol%C3%A1!%20Gostaria%20de%20conhecer%20o%20Sindexa.";

/* ═══════════════════════════════════════════════════════════════
   HEADER
   ═══════════════════════════════════════════════════════════════ */
function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 20);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm" : "bg-transparent"
      }`}
    >
      <div className="container flex h-16 md:h-20 items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <img
            src={prosingeLogo}
            alt="Prosinge"
            className={`h-8 md:h-10 w-auto ${scrolled ? "" : "brightness-0 invert"}`}
          />
        </Link>

        <nav className="hidden lg:flex items-center gap-8">
          {NAV.map((n) => (
            <a
              key={n.href}
              href={n.href}
              className={`text-sm font-semibold transition-colors ${
                scrolled ? "text-slate-700 hover:text-[color:var(--pw-orange)]" : "text-white/85 hover:text-white"
              }`}
              style={{ ["--pw-orange" as any]: ORANGE }}
            >
              {n.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 md:gap-3">
          <a
            href="tel:+551151943839"
            className={`hidden md:inline-flex items-center gap-2 text-sm font-semibold ${
              scrolled ? "text-slate-700" : "text-white"
            }`}
          >
            <Phone className="h-4 w-4" style={{ color: ORANGE }} />
            (11) 5194-3839
          </a>
          <Button
            asChild
            size="sm"
            className="rounded-md font-semibold text-white"
            style={{ backgroundColor: ORANGE }}
          >
            <Link to="/entidade-sindical" className="flex items-center gap-2">
              <LogIn className="h-4 w-4" /> Entrar
            </Link>
          </Button>
          <button
            className={`lg:hidden p-2 rounded-md ${scrolled ? "text-slate-700" : "text-white"}`}
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="lg:hidden border-t border-slate-200 bg-white">
          <div className="container py-4 flex flex-col gap-1">
            {NAV.map((n) => (
              <a
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-3 text-base font-semibold text-slate-700 hover:bg-slate-100"
              >
                {n.label}
              </a>
            ))}
            <a
              href="tel:+551151943839"
              className="mt-2 flex items-center gap-2 rounded-md px-3 py-3 text-base font-semibold text-slate-700"
            >
              <Phone className="h-4 w-4" style={{ color: ORANGE }} /> (11) 5194-3839
            </a>
          </div>
        </div>
      )}
    </header>
  );
}

/* ═══════════════════════════════════════════════════════════════
   HERO
   ═══════════════════════════════════════════════════════════════ */
function Hero() {
  const { enabled: trialEnabled } = useTrialSignupEnabled();
  return (
    <section id="inicio" className="relative pt-24 md:pt-28 pb-12 md:pb-20 overflow-hidden" style={{ background: NAVY }}>
      <div className="container grid gap-10 md:gap-12 lg:grid-cols-2 items-center">
        {/* Texto */}
        <div className="text-white">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight">
            Gestão moderna para <br className="hidden md:block" />
            <span style={{ color: ORANGE }}>entidades sindicais</span>
          </h1>
          <p className="mt-6 text-lg text-slate-300 max-w-lg leading-relaxed">
            Uma plataforma completa, 100% online e integrada para automatizar a rotina administrativa e financeira do seu sindicato ou associação.
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            {trialEnabled && (
              <Button
                asChild
                size="lg"
                className="h-12 rounded-full px-8 text-base font-bold text-white shadow-lg"
                style={{ backgroundColor: ORANGE }}
              >
                <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">Começar agora</a>
              </Button>
            )}
            <Button
              variant="outline"
              size="lg"
              className="h-12 rounded-full px-8 text-base font-bold text-white border-white/20 hover:bg-white/10"
            >
              <a href="#plataforma">Conhecer mais</a>
            </Button>
          </div>
        </div>

        {/* Imagem / Mockup */}
        <div className="relative hidden lg:block">
          <div
            className="absolute -right-20 top-0 h-[500px] w-[500px] rounded-full blur-[120px]"
            style={{ backgroundColor: TEAL, opacity: 0.15 }}
          />
          <div className="relative z-10 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
            <img
              src={heroPerson}
              alt="Gestão Sindical"
              className="rounded-xl shadow-2xl w-full h-auto object-cover aspect-[4/3]"
              width={800}
              height={600}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PLATAFORMA COMPLETA
   ═══════════════════════════════════════════════════════════════ */
function Plataforma() {
  return (
    <section id="plataforma" className="py-16 md:py-24 bg-white">
      <div className="container">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl md:text-4xl font-extrabold" style={{ color: NAVY }}>
            Uma plataforma completa
          </h2>
          <p className="mt-4 text-base md:text-lg text-slate-600">
            O Prosinge foi arquitetado por profissionais capacitados que entendem
            as necessidades dos sindicatos e associações.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl border border-slate-200 bg-white p-6 md:p-7 text-center transition-all hover:-translate-y-1 hover:shadow-xl"
            >
              <div
                className="mx-auto grid h-16 w-16 place-items-center rounded-full border-2 transition-colors"
                style={{ borderColor: TEAL, color: TEAL }}
              >
                <f.icon className="h-7 w-7" strokeWidth={1.5} />
              </div>
              <h3 className="mt-5 font-bold text-lg" style={{ color: NAVY }}>
                {f.title}
              </h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CREDIBILIDADE (split checklist + imagem)
   ═══════════════════════════════════════════════════════════════ */
function Credibilidade() {
  const { enabled: trialEnabled } = useTrialSignupEnabled();
  return (
    <section className="py-16 md:py-24 bg-slate-50">
      <div className="container grid gap-12 lg:grid-cols-2 items-center">
        <div>
          <h2 className="text-3xl md:text-4xl font-extrabold" style={{ color: NAVY }}>
            Mais credibilidade e profissionalismo
          </h2>
          <p className="mt-4 text-slate-600">
            Ferramentas pensadas para dar mais confiança e agilidade aos processos
            do seu sindicato ou associação.
          </p>
          <ul className="mt-8 space-y-4">
            {CHECKLIST.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span
                  className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-white"
                  style={{ backgroundColor: TEAL }}
                >
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
                <span className="text-slate-700">{item}</span>
              </li>
            ))}
          </ul>
          <div className="mt-9">
            {trialEnabled && (
              <Button
                asChild
                size="lg"
                className="h-12 rounded-full px-8 text-base font-bold text-white"
                style={{ backgroundColor: ORANGE }}
              >
                <a href="https://wa.me/551151943839?text=Ol%C3%A1!%20Quero%20testar%20o%20Sindexa%20gratuitamente." target="_blank" rel="noopener noreferrer">Teste gratuitamente</a>
              </Button>
            )}
          </div>
        </div>

        <div className="relative">
          <div
            className="absolute -left-4 top-6 hidden md:block h-3 w-40 rounded-full rotate-[-20deg]"
            style={{ backgroundColor: TEAL, opacity: 0.35 }}
          />
          <div className="relative rounded-3xl overflow-hidden shadow-2xl bg-white">
            <img
              src={devicesImg}
              alt="Painel do Prosinge em laptop e celular"
              className="w-full h-auto"
              width={1280}
              height={960}
              loading="lazy"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SOLUÇÕES
   ═══════════════════════════════════════════════════════════════ */
function Solucoes() {
  return (
    <section id="solucoes" className="py-16 md:py-24 bg-white">
      <div className="container">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl md:text-4xl font-extrabold" style={{ color: NAVY }}>
            Gestão simples e intuitiva
          </h2>
          <p className="mt-4 text-slate-600">
            Temos ótimas soluções para diversos tipos de instituição.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {SOLUCOES.map((s) => (
            <div
              key={s.title}
              className="rounded-2xl border border-slate-200 bg-white p-8 text-center transition-all hover:-translate-y-1 hover:shadow-xl"
            >
              <div
                className="mx-auto grid h-20 w-20 place-items-center rounded-2xl"
                style={{ backgroundColor: `${TEAL}15`, color: TEAL }}
              >
                <s.icon className="h-10 w-10" strokeWidth={1.5} />
              </div>
              <h3 className="mt-6 text-xl font-bold" style={{ color: NAVY }}>
                {s.title}
              </h3>
              <p className="mt-3 text-sm text-slate-600">{s.desc}</p>
              <a
                href="#contato"
                className="mt-5 inline-flex items-center gap-2 text-sm font-bold"
                style={{ color: ORANGE }}
              >
                Saiba mais <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   REFERÊNCIA (stats dark)
   ═══════════════════════════════════════════════════════════════ */
function Referencia() {
  const { enabled: trialEnabled } = useTrialSignupEnabled();
  return (
    <section className="relative py-20 md:py-28 overflow-hidden" style={{ background: NAVY }}>
      <div
        className="absolute -top-16 -left-16 h-72 w-72 rounded-full blur-3xl opacity-30"
        style={{ backgroundColor: TEAL }}
      />
      <div
        className="absolute -bottom-16 -right-16 h-72 w-72 rounded-full blur-3xl opacity-20"
        style={{ backgroundColor: ORANGE }}
      />
      <div className="container relative text-center text-white">
        <p className="text-xs md:text-sm font-bold tracking-[0.25em] uppercase" style={{ color: TEAL }}>
          Referência em gestão sindical
        </p>
        <h2 className="mt-4 text-3xl md:text-5xl font-extrabold">
          Presente em centenas de <br className="hidden md:block" />
          instituições pelo Brasil
        </h2>
        <p className="mt-5 mx-auto max-w-2xl text-white/75">
          O Sindexa tem ajudado milhares de instituições por todo o Brasil a aumentarem
          sua produtividade e controle sobre seus processos.
        </p>
        <div className="mt-10">
          {trialEnabled && (
            <Button
              asChild
              size="lg"
              className="h-12 md:h-14 rounded-full px-8 md:px-10 text-base font-bold text-white"
              style={{ backgroundColor: ORANGE }}
            >
              <a href="https://wa.me/551151943839?text=Ol%C3%A1!%20Quero%20testar%20o%20Sindexa%20gratuitamente." target="_blank" rel="noopener noreferrer">Teste gratuitamente</a>
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DEPOIMENTOS (carousel simples)
   ═══════════════════════════════════════════════════════════════ */
function Depoimentos() {
  const [i, setI] = useState(0);
  const prev = () => setI((n) => (n - 1 + DEPOIMENTOS.length) % DEPOIMENTOS.length);
  const next = () => setI((n) => (n + 1) % DEPOIMENTOS.length);
  const d = DEPOIMENTOS[i];

  return (
    <section id="depoimentos" className="py-16 md:py-24 bg-slate-50">
      <div className="container">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl md:text-4xl font-extrabold" style={{ color: NAVY }}>
            Veja o que nossos clientes falam sobre nós
          </h2>
          <p className="mt-4 text-slate-600">
            Depois experimente também a nossa plataforma de forma gratuita.
          </p>
        </div>

        <div className="mt-12 mx-auto max-w-3xl">
          <div className="relative rounded-3xl bg-white shadow-xl p-8 md:p-12 text-center">
            <div
              className="mx-auto grid h-20 w-20 place-items-center rounded-full text-white text-2xl font-bold"
              style={{ backgroundColor: TEAL }}
            >
              {d.nome.charAt(0)}
            </div>
            <p className="mt-6 text-lg md:text-xl italic text-slate-700 leading-relaxed">"{d.texto}"</p>
            <p className="mt-6 font-bold" style={{ color: NAVY }}>{d.nome}</p>
            <p className="text-sm text-slate-500">{d.cargo}</p>

            <button
              onClick={prev}
              aria-label="Anterior"
              className="absolute left-2 md:-left-6 top-1/2 -translate-y-1/2 grid h-11 w-11 place-items-center rounded-full bg-white shadow-md border border-slate-200 hover:bg-slate-50"
              style={{ color: NAVY }}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={next}
              aria-label="Próximo"
              className="absolute right-2 md:-right-6 top-1/2 -translate-y-1/2 grid h-11 w-11 place-items-center rounded-full bg-white shadow-md border border-slate-200 hover:bg-slate-50"
              style={{ color: NAVY }}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-6 flex justify-center gap-2">
            {DEPOIMENTOS.map((_, k) => (
              <button
                key={k}
                onClick={() => setI(k)}
                aria-label={`Depoimento ${k + 1}`}
                className="h-2.5 rounded-full transition-all"
                style={{
                  width: k === i ? 28 : 10,
                  backgroundColor: k === i ? ORANGE : "#cbd5e1",
                }}
              />
            ))}
          </div>
        </div>

        <div className="mt-12 text-center">
          <Button
            asChild
            size="lg"
            className="h-12 rounded-full px-8 text-base font-bold text-white"
            style={{ backgroundColor: ORANGE }}
          >
            <a href="https://wa.me/551151943839?text=Ol%C3%A1!%20Quero%20testar%20o%20Sindexa%20gratuitamente." target="_blank" rel="noopener noreferrer">Testar gratuitamente</a>
          </Button>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CONTATO
   ═══════════════════════════════════════════════════════════════ */
function Contato() {
  const [sent, setSent] = useState(false);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const nome = fd.get("nome");
    const email = fd.get("email");
    const tel = fd.get("telefone");
    const msg = fd.get("mensagem");
    const text =
      `Olá! Gostaria de mais informações sobre o Sindexa.%0A%0A` +
      `Nome: ${nome}%0AE-mail: ${email}%0ATelefone: ${tel}%0A%0A${msg}`;
    window.open(`https://wa.me/551151943839?text=${text}`, "_blank");
    setSent(true);
  };

  return (
    <section id="contato" className="py-16 md:py-24 bg-white">
      <div className="container grid gap-12 lg:grid-cols-2">
        <div>
          <h2 className="text-3xl md:text-4xl font-extrabold" style={{ color: NAVY }}>
            Precisa de mais informações <br /> sobre o nosso sistema?
          </h2>
          <p className="mt-4 text-slate-600 max-w-md">
            Preencha o formulário ao lado e nossa equipe entrará em contato o mais breve possível.
            Ou fale conosco pelos canais abaixo.
          </p>

          <ul className="mt-8 space-y-4">
            <li className="flex items-center gap-3 text-slate-700">
              <span className="grid h-10 w-10 place-items-center rounded-full text-white" style={{ backgroundColor: TEAL }}>
                <Phone className="h-4 w-4" />
              </span>
              <div>
                <p className="text-xs uppercase font-bold tracking-wider text-slate-500">Telefone</p>
                <a href="tel:+551151943839" className="font-semibold">(11) 5194-3839</a>
              </div>
            </li>
            <li className="flex items-center gap-3 text-slate-700">
              <span className="grid h-10 w-10 place-items-center rounded-full text-white" style={{ backgroundColor: TEAL }}>
                <Mail className="h-4 w-4" />
              </span>
              <div>
                <p className="text-xs uppercase font-bold tracking-wider text-slate-500">E-mail</p>
                <a href="mailto:contato@sindexa.com.br" className="font-semibold">contato@sindexa.com.br</a>
              </div>
            </li>
            <li className="flex items-center gap-3 text-slate-700">
              <span className="grid h-10 w-10 place-items-center rounded-full text-white" style={{ backgroundColor: TEAL }}>
                <MapPin className="h-4 w-4" />
              </span>
              <div>
                <p className="text-xs uppercase font-bold tracking-wider text-slate-500">Atendimento</p>
                <span className="font-semibold">Segunda a sexta · 8h às 18h</span>
              </div>
            </li>
          </ul>
        </div>

        <form
          onSubmit={onSubmit}
          className="rounded-3xl bg-slate-50 border border-slate-200 p-6 md:p-8 shadow-sm"
        >
          {sent && (
            <div
              className="mb-4 rounded-lg p-3 text-sm font-semibold text-white"
              style={{ backgroundColor: TEAL }}
            >
              Obrigado! Abrimos o WhatsApp para finalizar seu contato.
            </div>
          )}
          <div className="grid gap-4">
            <div>
              <label className="text-sm font-semibold text-slate-700">Nome</label>
              <input
                name="nome"
                required
                className="mt-1 w-full h-12 rounded-lg border border-slate-300 bg-white px-4 outline-none focus:border-[color:var(--pw-teal)] focus:ring-2 focus:ring-[color:var(--pw-teal)]/20"
                style={{ ["--pw-teal" as any]: TEAL }}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-semibold text-slate-700">E-mail</label>
                <input
                  type="email"
                  name="email"
                  required
                  className="mt-1 w-full h-12 rounded-lg border border-slate-300 bg-white px-4 outline-none focus:border-[color:var(--pw-teal)] focus:ring-2 focus:ring-[color:var(--pw-teal)]/20"
                  style={{ ["--pw-teal" as any]: TEAL }}
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700">Telefone</label>
                <input
                  name="telefone"
                  className="mt-1 w-full h-12 rounded-lg border border-slate-300 bg-white px-4 outline-none focus:border-[color:var(--pw-teal)] focus:ring-2 focus:ring-[color:var(--pw-teal)]/20"
                  style={{ ["--pw-teal" as any]: TEAL }}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700">Mensagem</label>
              <textarea
                name="mensagem"
                rows={4}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 outline-none focus:border-[color:var(--pw-teal)] focus:ring-2 focus:ring-[color:var(--pw-teal)]/20"
                style={{ ["--pw-teal" as any]: TEAL }}
              />
            </div>
            <Button
              type="submit"
              size="lg"
              className="h-12 rounded-full text-base font-bold text-white"
              style={{ backgroundColor: ORANGE }}
            >
              Enviar mensagem
            </Button>
          </div>
        </form>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   FOOTER
   ═══════════════════════════════════════════════════════════════ */
function SiteFooter() {
  return (
    <footer className="text-white" style={{ background: NAVY }}>
      <div className="container grid gap-10 py-14 md:grid-cols-4">
        <div>
          <img src={prosingeLogo} alt="Sindexa" className="h-10 w-auto brightness-0 invert" />
          <p className="mt-4 text-sm text-white/70 max-w-xs">
            Sistema completo de gestão para sindicatos, associações e federações de todo o Brasil.
          </p>
          <div className="mt-5 flex gap-2">
            <a
              href="https://facebook.com"
              target="_blank"
              rel="noreferrer"
              aria-label="Facebook"
              className="grid h-9 w-9 place-items-center rounded-full bg-white/10 hover:bg-white/20"
            >
              <Facebook className="h-4 w-4" />
            </a>
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noreferrer"
              aria-label="Instagram"
              className="grid h-9 w-9 place-items-center rounded-full bg-white/10 hover:bg-white/20"
            >
              <Instagram className="h-4 w-4" />
            </a>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-bold uppercase tracking-wider">Institucional</h4>
          <ul className="mt-4 space-y-2 text-sm text-white/75">
            <li><a href="#plataforma" className="hover:text-white">A plataforma</a></li>
            <li><a href="#solucoes" className="hover:text-white">Soluções</a></li>
            <li><a href="#depoimentos" className="hover:text-white">Depoimentos</a></li>
            <li><Link to="/lgpd" className="hover:text-white">LGPD</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-bold uppercase tracking-wider">Contato</h4>
          <ul className="mt-4 space-y-2 text-sm text-white/75">
            <li className="flex items-center gap-2"><Phone className="h-4 w-4" style={{ color: ORANGE }} />(11) 5194-3839</li>
            <li className="flex items-center gap-2"><Mail className="h-4 w-4" style={{ color: ORANGE }} />contato@sindexa.com.br</li>
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-bold uppercase tracking-wider">Comece agora</h4>
          <p className="mt-4 text-sm text-white/75">
            Solicite uma demonstração e conheça todas as funcionalidades do Sindexa.
          </p>
          <Button
            asChild
            className="mt-4 h-11 rounded-full px-6 text-sm font-bold text-white"
            style={{ backgroundColor: ORANGE }}
          >
            <a href="https://wa.me/551151943839?text=Ol%C3%A1!%20Quero%20testar%20o%20Sindexa%20gratuitamente." target="_blank" rel="noopener noreferrer">Testar gratuitamente</a>
          </Button>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-3 py-5 text-xs text-white/60">
          <p>© {new Date().getFullYear()} Sindexa — Todos os direitos reservados</p>
          <p>CNPJ oculto · Em conformidade com a LGPD</p>
        </div>
      </div>

      {/* WhatsApp flutuante */}
      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noreferrer"
        aria-label="Fale no WhatsApp"
        className="fixed bottom-6 right-6 z-50 grid h-14 w-14 place-items-center rounded-full bg-[#25d366] text-white shadow-2xl hover:scale-105 transition-transform"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" className="h-7 w-7" fill="currentColor">
          <path d="M19.11 17.29c-.29-.14-1.7-.84-1.96-.93-.26-.1-.45-.14-.64.14-.19.29-.74.93-.9 1.12-.16.19-.33.21-.62.07-.29-.14-1.22-.45-2.33-1.44-.86-.77-1.44-1.72-1.61-2.01-.17-.29-.02-.45.12-.59.13-.13.29-.33.43-.5.14-.16.19-.29.29-.48.1-.19.05-.36-.02-.5-.07-.14-.64-1.54-.88-2.11-.23-.55-.47-.48-.64-.49l-.55-.01a1.05 1.05 0 0 0-.76.36c-.26.29-1 1-1 2.43s1.02 2.83 1.16 3.02c.14.19 2 3.06 4.85 4.29.68.29 1.21.47 1.62.6.68.22 1.3.19 1.79.11.55-.08 1.7-.7 1.94-1.37.24-.67.24-1.24.17-1.37-.07-.13-.26-.21-.55-.35zM16 4C9.37 4 4 9.37 4 16c0 2.11.55 4.1 1.6 5.86L4 28l6.28-1.55A11.94 11.94 0 0 0 16 28c6.63 0 12-5.37 12-12S22.63 4 16 4zm0 21.86a9.83 9.83 0 0 1-5.02-1.38l-.36-.21-3.73.92 1-3.63-.24-.37A9.86 9.86 0 1 1 16 25.86z"/>
        </svg>
      </a>
    </footer>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PAGE
   ═══════════════════════════════════════════════════════════════ */
export default function SindicalLandingPage() {
  return (
    <PublicPageWrapper>
      <div className="min-h-screen bg-white antialiased">
        <SiteHeader />
        <main>
          <Hero />
          <Plataforma />
          <Credibilidade />
          <Solucoes />
          <Referencia />
          <Depoimentos />
          <Contato />
        </main>
        <SiteFooter />
      </div>
    </PublicPageWrapper>
  );
}
