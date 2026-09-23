import { ArrowRight, Check, CheckCircle2, ChevronRight, Play, ShieldCheck, Users, BarChart3, MessageCircle, Menu, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PublicPageWrapper } from "@/components/layout/PublicLayout";
import prosingeLogo from "@/assets/prosinge-logo.png";
import heroPerson from "@/assets/sindical-hero-person.jpg";
import devicesImg from "@/assets/sindical-devices.jpg";
import { useTrialSignupEnabled } from "@/hooks/useTrialSignupEnabled";

const NAVY = "#06356f";
const BLUE = "#094798";
const RED = "#e31925";

const solutions = [
  { icon: Users, title: "Gestão de associados", text: "Tenha cadastros, dependentes e histórico sempre organizados em um só lugar." },
  { icon: BarChart3, title: "Relatórios inteligentes", text: "Transforme dados da entidade em decisões melhores com indicadores claros." },
  { icon: MessageCircle, title: "Comunicação direta", text: "Aproxime sua entidade dos associados por canais digitais simples e eficientes." },
];

export default function SindicalLandingPage() {
  const { enabled, loading } = useTrialSignupEnabled();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <PublicPageWrapper>
      <div className="min-h-screen bg-background text-foreground">
        <header className="sticky top-0 z-50 border-b border-border bg-white/95 shadow-sm backdrop-blur-sm">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <Link to="/" aria-label="Prosinge - início" className="shrink-0">
              <img src={prosingeLogo} alt="Prosinge" className="h-10 w-auto object-contain" />
            </Link>
            <nav className="hidden items-center gap-8 md:flex" aria-label="Navegação principal">
              <a href="#plataforma" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">Plataforma</a>
              <a href="#solucoes" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">Soluções</a>
              <a href="#sobre" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">Sobre a Prosinge</a>
              <Link to="/auth" className="text-sm font-semibold text-primary hover:underline">Entrar</Link>
              {enabled && <Button asChild className="bg-primary hover:bg-primary/90"><a href="https://wa.me/551151943839?text=Ol%C3%A1%2C%20quero%20testar%20gratuitamente%20o%20Prosinge." target="_blank" rel="noopener noreferrer">Teste gratuitamente</a></Button>}
            </nav>
            <button type="button" aria-label={menuOpen ? "Fechar menu" : "Abrir menu"} onClick={() => setMenuOpen(!menuOpen)} className="rounded-lg p-2 text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden">
              {menuOpen ? <X /> : <Menu />}
            </button>
          </div>
          {menuOpen && <nav className="border-t border-border bg-white px-6 py-4 md:hidden"><div className="flex flex-col gap-4"><a href="#plataforma" onClick={() => setMenuOpen(false)}>Plataforma</a><a href="#solucoes" onClick={() => setMenuOpen(false)}>Soluções</a><Link to="/auth">Entrar</Link></div></nav>}
        </header>

        <main>
          <section className="relative overflow-hidden bg-muted/40 py-20 md:py-28">
            <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
            <div className="mx-auto grid max-w-6xl items-center gap-14 px-6 lg:grid-cols-[1.08fr_.92fr]">
              <div className="relative z-10">
                <span className="mb-6 inline-flex rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-primary">Tecnologia para entidades fortes</span>
                <h1 className="max-w-2xl text-4xl font-bold leading-tight tracking-tight text-[#06356f] md:text-6xl">A gestão da sua entidade em um novo nível.</h1>
                <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">O Prosinge simplifica a rotina sindical e aproxima sua entidade dos associados com segurança, eficiência e inteligência.</p>
                <div className="mt-8 flex flex-wrap gap-4">
                  {enabled && <Button disabled={loading} asChild size="lg" className="bg-primary px-6 hover:bg-primary/90"><a href="https://wa.me/551151943839?text=Ol%C3%A1%2C%20quero%20come%C3%A7ar%20a%20usar%20o%20Prosinge." target="_blank" rel="noopener noreferrer">Comece agora <ArrowRight className="ml-2 h-4 w-4" /></a></Button>}
                  <Button asChild variant="outline" size="lg" className="border-primary text-primary hover:bg-primary/5"><a href="#plataforma"><Play className="mr-2 h-4 w-4" /> Conheça a plataforma</a></Button>
                </div>
                <ul className="mt-10 grid gap-3 text-sm text-foreground sm:grid-cols-3">
                  {["Dados protegidos", "Acesso de qualquer lugar", "Suporte especializado"].map((item) => <li key={item} className="flex items-center gap-2"><Check className="h-4 w-4 text-[#e31925]" />{item}</li>)}
                </ul>
              </div>
              <div className="relative lg:translate-x-6">
                <div className="absolute -inset-4 rounded-3xl bg-primary/10" />
                <img src={heroPerson} alt="Profissional utilizando a plataforma Prosinge" className="relative aspect-[4/3] w-full rounded-2xl object-cover shadow-xl" />
              </div>
            </div>
          </section>

          <section id="plataforma" className="py-20 md:py-28">
            <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 lg:grid-cols-[.9fr_1.1fr]">
              <img src={devicesImg} alt="Plataforma Prosinge em diferentes dispositivos" className="rounded-2xl border border-border shadow-lg" />
              <div><span className="section-badge">Uma plataforma completa</span><h2 className="mt-5 text-3xl font-bold tracking-tight text-[#06356f] md:text-4xl">Mais tempo para cuidar do que realmente importa</h2><p className="mt-5 leading-relaxed text-muted-foreground">Centralize processos, reduza tarefas manuais e entregue uma experiência moderna para associados, empresas e equipe.</p><div className="mt-8 grid gap-4 sm:grid-cols-2">{["Cadastro e atendimento", "Financeiro e contribuições", "Portal do associado", "Gestão de documentos"].map((item) => <div key={item} className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 shrink-0 text-primary" /><span className="font-medium">{item}</span></div>)}</div></div>
            </div>
          </section>

          <section id="solucoes" className="bg-muted/40 py-20 md:py-28"><div className="mx-auto max-w-6xl px-6"><div className="mb-12 max-w-2xl"><span className="section-badge">Soluções para sua realidade</span><h2 className="mt-5 text-3xl font-bold tracking-tight text-[#06356f] md:text-4xl">Tudo conectado, do atendimento à gestão</h2></div><div className="grid gap-6 md:grid-cols-3">{solutions.map(({ icon: Icon, title, text }) => <article key={title} className="rounded-xl border border-border bg-card p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-md"><div className="mb-6 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div><h3 className="text-lg font-semibold">{title}</h3><p className="mt-3 text-sm leading-relaxed text-muted-foreground">{text}</p><a href="https://wa.me/551151943839?text=Ol%C3%A1%2C%20quero%20saber%20mais%20sobre%20as%20solu%C3%A7%C3%B5es%20do%20Prosinge." target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex items-center text-sm font-semibold text-primary">Saiba mais <ChevronRight className="ml-1 h-4 w-4" /></a></article>)}</div></div></section>

          <section id="sobre" className="py-20 md:py-28"><div className="mx-auto max-w-4xl px-6 text-center"><ShieldCheck className="mx-auto h-12 w-12 text-primary" /><h2 className="mt-6 text-3xl font-bold tracking-tight text-[#06356f] md:text-4xl">Tecnologia que gera confiança</h2><p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">A Prosinge combina experiência em gestão com tecnologia segura para ajudar entidades a crescerem de forma sustentável.</p></div></section>

          <section id="contato" className="bg-primary py-20 text-primary-foreground md:py-24"><div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-8 px-6 md:flex-row md:items-center"><div><h2 className="text-3xl font-bold tracking-tight md:text-4xl">Pronto para transformar sua gestão?</h2><p className="mt-3 max-w-xl text-primary-foreground/80">Converse com nosso time e descubra como o Prosinge pode ajudar sua entidade.</p></div><Button asChild size="lg" className="bg-white text-primary hover:bg-white/90"><a href="https://wa.me/551151943839?text=Ol%C3%A1%2C%20quero%20falar%20com%20a%20Prosinge%20sobre%20a%20contrata%C3%A7%C3%A3o." target="_blank" rel="noopener noreferrer">Fale com a Prosinge <ArrowRight className="ml-2 h-4 w-4" /></a></Button></div></section>
        </main>

        <footer className="border-t border-border bg-white py-12"><div className="mx-auto grid max-w-6xl gap-8 px-6 md:grid-cols-4"><div><img src={prosingeLogo} alt="Prosinge" className="h-9 w-auto" /><p className="mt-4 text-sm leading-relaxed text-muted-foreground">Tecnologia para uma gestão mais simples, humana e eficiente.</p></div><div><h3 className="font-semibold text-[#06356f]">Plataforma</h3><div className="mt-4 space-y-3 text-sm text-muted-foreground"><a className="block hover:text-primary" href="#plataforma">Recursos</a><a className="block hover:text-primary" href="#solucoes">Soluções</a></div></div><div><h3 className="font-semibold text-[#06356f]">Acesso rápido</h3><div className="mt-4 space-y-3 text-sm text-muted-foreground"><Link className="block hover:text-primary" to="/auth">Entrar</Link><a className="block hover:text-primary" href="https://wa.me/551151943839?text=Ol%C3%A1%2C%20quero%20contratar%20o%20Prosinge%20para%20minha%20entidade." target="_blank" rel="noopener noreferrer">Criar conta</a></div></div><div><h3 className="font-semibold text-[#06356f]">Fale conosco</h3><p className="mt-4 text-sm text-muted-foreground">Nossa equipe está pronta para ajudar.</p></div></div><div className="mx-auto mt-10 max-w-6xl border-t border-border px-6 pt-6 text-xs text-muted-foreground">© {new Date().getFullYear()} Prosinge. Todos os direitos reservados.</div></footer>
      </div>
    </PublicPageWrapper>
  );
}
