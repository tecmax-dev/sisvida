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
  MapPin
} from "lucide-react";

// Hero Section
function SindicalHeroSection() {
  return (
    <section className="relative min-h-[90vh] flex items-center pt-20 lg:pt-24 pb-16 bg-background overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl -translate-y-1/3 translate-x-1/3" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-cta/5 rounded-full blur-3xl translate-y-1/3 -translate-x-1/3" />
      
      <div className="container relative z-10">
        {/* Badge */}
        <div className="flex justify-center mb-8 animate-fade-in">
          <div className="section-badge">
            <Scale className="h-4 w-4" />
            <span className="text-sm font-medium">
              Solução completa para <span className="font-bold">gestão sindical</span>
            </span>
          </div>
        </div>

        {/* Main headline */}
        <div className="text-center max-w-4xl mx-auto mb-8">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold leading-[1.1] text-foreground animate-fade-in">
            Sistema completo de gestão
            <br />
            <span className="gradient-text">para sindicatos laborais</span>
          </h1>
          
          <p className="mt-6 text-lg lg:text-xl text-muted-foreground max-w-2xl mx-auto animate-fade-in" style={{ animationDelay: '100ms' }}>
            Organize contribuições, gerencie empresas e sócios, controle financeiro e tenha transparência total na prestação de contas da sua entidade sindical.
          </p>

          {/* CTA Buttons */}
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center animate-fade-in" style={{ animationDelay: '200ms' }}>
            <Button 
              size="lg" 
              className="btn-eclini px-10 h-14 text-base shadow-lg"
              asChild
            >
              <a href="#contato" className="flex items-center gap-2">
                Solicitar demonstração
                <ArrowRight className="h-5 w-5" />
              </a>
            </Button>
            <Button 
              size="lg"
              variant="outline"
              className="btn-eclini-outline h-14 text-base"
              asChild
            >
              <a 
                href="https://wa.me/5571982786864?text=Olá! Gostaria de saber mais sobre o Sistema Sindical."
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2"
              >
                <MessageCircle className="h-5 w-5" />
                Falar com consultor
              </a>
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto animate-fade-in" style={{ animationDelay: '300ms' }}>
          {[
            { value: "500+", label: "Sindicatos atendidos" },
            { value: "50k+", label: "Empresas cadastradas" },
            { value: "99%", label: "Uptime garantido" },
            { value: "24/7", label: "Suporte disponível" },
          ].map((stat, i) => (
            <div key={i} className="text-center p-4 rounded-2xl bg-card border border-border/50">
              <div className="stat-value text-2xl md:text-3xl">{stat.value}</div>
              <div className="stat-label">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// About Section
function AboutSection() {
  return (
    <section id="sobre" className="py-20 lg:py-28 bg-muted/30">
      <div className="container">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="section-badge mb-4">
              SOBRE O SISTEMA
            </span>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6">
              O que é o <span className="gradient-text">Sistema Sindical</span>?
            </h2>
            <p className="text-lg text-muted-foreground mb-6">
              O Sistema Sindical é uma plataforma completa desenvolvida especialmente para atender às necessidades de sindicatos de trabalhadores, federações e confederações laborais.
            </p>
            <p className="text-lg text-muted-foreground mb-6">
              Nossa solução resolve os principais desafios da gestão sindical: controle de contribuições, gestão financeira transparente, cadastro de empresas e sócios, negociações de débitos e prestação de contas institucional.
            </p>
            <div className="space-y-4">
              {[
                "Elimine planilhas e processos manuais",
                "Tenha controle total sobre as finanças",
                "Gere relatórios institucionais automaticamente",
                "Acompanhe inadimplências em tempo real",
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-cta/20 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="h-4 w-4 text-cta" />
                  </div>
                  <span className="text-foreground">{item}</span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="relative">
            <div className="bg-card border border-border rounded-3xl p-8 shadow-xl">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { icon: Building2, label: "Gestão de Empresas", color: "text-warning" },
                  { icon: Users, label: "Cadastro de Sócios", color: "text-info" },
                  { icon: Receipt, label: "Contribuições", color: "text-success" },
                  { icon: PiggyBank, label: "Financeiro", color: "text-destructive" },
                ].map((item, i) => (
                  <div key={i} className="flex flex-col items-center p-6 rounded-2xl bg-muted/50 hover:bg-muted transition-colors">
                    <item.icon className={`h-10 w-10 ${item.color} mb-3`} />
                    <span className="text-sm font-medium text-center">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Decorative elements */}
            <div className="absolute -top-6 -right-6 w-24 h-24 bg-primary/10 rounded-full blur-2xl" />
            <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-cta/10 rounded-full blur-2xl" />
          </div>
        </div>
      </div>
    </section>
  );
}

// Features Section
const features = [
  { 
    icon: Building2, 
    category: "CADASTROS",
    title: "Cadastro de Empresas e Sócios", 
    description: "Gerencie todas as empresas contribuintes e associados com dados completos, documentos e histórico.",
  },
  { 
    icon: Receipt, 
    category: "CONTRIBUIÇÕES",
    title: "Gestão de Contribuições Sindicais", 
    description: "Controle contribuições mensais, anuais e especiais. Emissão de boletos e integração bancária.",
  },
  { 
    icon: PiggyBank, 
    category: "FINANCEIRO",
    title: "Financeiro Sindical Independente", 
    description: "Módulo financeiro completo com receitas, despesas, categorias e controle de portadores.",
  },
  { 
    icon: BarChart3, 
    category: "FLUXO DE CAIXA",
    title: "Fluxo de Caixa e Prestação de Contas", 
    description: "Acompanhe o fluxo de caixa mensal e anual. Gere relatórios para assembleias e auditorias.",
  },
  { 
    icon: Handshake, 
    category: "NEGOCIAÇÕES",
    title: "Negociações e Parcelamentos", 
    description: "Negocie débitos em atraso com facilidade. Crie acordos de parcelamento automatizados.",
  },
  { 
    icon: FileBarChart, 
    category: "RELATÓRIOS",
    title: "Relatórios Gerenciais e Institucionais", 
    description: "Relatórios profissionais para gestão, assembleias e órgãos fiscalizadores.",
  },
  { 
    icon: Shield, 
    category: "PERMISSÕES",
    title: "Controle de Permissões por Perfil", 
    description: "Defina níveis de acesso para cada usuário. Controle granular de funcionalidades.",
  },
  { 
    icon: Lock, 
    category: "AUDITORIA",
    title: "Auditoria e Rastreabilidade", 
    description: "Todas as ações são registradas. Histórico completo para transparência e conformidade.",
  },
  { 
    icon: Layers, 
    category: "MULTIEMPRESA",
    title: "Multiempresa e Multisindicato", 
    description: "Gerencie múltiplos sindicatos e federações em uma única plataforma centralizada.",
  },
];

function FeaturesSection() {
  return (
    <section id="recursos" className="py-20 lg:py-28 bg-background">
      <div className="container">
        {/* Section Header */}
        <div className="text-center mb-16">
          <span className="section-badge mb-4">
            RECURSOS DO SISTEMA
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            Tudo que sua entidade precisa<br />
            <span className="gradient-text">em uma única plataforma</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Conheça os principais recursos que vão transformar a gestão do seu sindicato.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <div
              key={i}
              className="feature-card group cursor-pointer"
            >
              <div className="feature-card-icon mb-4">
                <feature.icon className="h-6 w-6" />
              </div>
              <span className="text-xs font-bold tracking-wider mb-3 block gradient-text">
                {feature.category}
              </span>
              <h3 className="text-xl font-bold text-foreground mb-3 group-hover:text-primary transition-colors">
                {feature.title}
              </h3>
              <p className="text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// Benefits Section
const benefits = [
  {
    icon: Sparkles,
    title: "Transparência Financeira",
    description: "Tenha visibilidade total das receitas e despesas. Relatórios claros para prestação de contas.",
  },
  {
    icon: Building,
    title: "Organização Administrativa",
    description: "Centralize todas as informações em um só lugar. Acabe com papéis e planilhas dispersas.",
  },
  {
    icon: FileBarChart,
    title: "Facilidade na Prestação de Contas",
    description: "Gere relatórios profissionais para assembleias, auditorias e órgãos fiscalizadores.",
  },
  {
    icon: Shield,
    title: "Segurança das Informações",
    description: "Dados criptografados e backups automáticos. Sua informação protegida 24 horas.",
  },
  {
    icon: Globe,
    title: "Escalabilidade e Crescimento",
    description: "Sistema que cresce com sua entidade. De pequenos sindicatos a grandes federações.",
  },
  {
    icon: UserCheck,
    title: "Facilidade de Uso",
    description: "Interface intuitiva que qualquer pessoa consegue usar. Treinamento rápido e suporte contínuo.",
  },
];

function BenefitsSection() {
  return (
    <section id="beneficios" className="py-20 lg:py-28 bg-muted/30">
      <div className="container">
        <div className="text-center mb-16">
          <span className="section-badge mb-4">
            BENEFÍCIOS
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            Por que escolher o<br />
            <span className="gradient-text">Sistema Sindical</span>?
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Descubra como nossa solução pode transformar a gestão da sua entidade.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {benefits.map((benefit, i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{
                background: 'linear-gradient(135deg, hsl(200 100% 45% / 0.15) 0%, hsl(95 70% 50% / 0.15) 100%)'
              }}>
                <benefit.icon className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-3">{benefit.title}</h3>
              <p className="text-muted-foreground">{benefit.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// Target Audience Section
const audiences = [
  {
    icon: Users,
    title: "Sindicatos de Trabalhadores",
    description: "Sindicatos de todas as categorias profissionais que precisam de organização e controle.",
  },
  {
    icon: Building2,
    title: "Federações",
    description: "Federações estaduais e regionais que representam múltiplos sindicatos.",
  },
  {
    icon: Layers,
    title: "Confederações",
    description: "Confederações nacionais com gestão de grande escala e múltiplas entidades.",
  },
  {
    icon: Scale,
    title: "Entidades Sindicais Laborais",
    description: "Qualquer entidade representativa de trabalhadores que busca modernização.",
  },
];

function AudienceSection() {
  return (
    <section id="publico" className="py-20 lg:py-28 bg-background">
      <div className="container">
        <div className="text-center mb-16">
          <span className="section-badge mb-4">
            PÚBLICO ATENDIDO
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            Desenvolvido para<br />
            <span className="gradient-text">entidades sindicais</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Nossa solução atende a diferentes tipos de organizações sindicais laborais.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {audiences.map((audience, i) => (
            <div key={i} className="text-center p-8 bg-card border border-border rounded-2xl hover:border-primary/30 transition-all duration-300 hover:shadow-lg">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{
                background: 'linear-gradient(135deg, hsl(200 100% 45%) 0%, hsl(180 80% 45%) 50%, hsl(95 70% 50%) 100%)'
              }}>
                <audience.icon className="h-8 w-8 text-primary-foreground" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">{audience.title}</h3>
              <p className="text-sm text-muted-foreground">{audience.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// CTA Section
function SindicalCTASection() {
  return (
    <section id="contato" className="py-20 lg:py-28 relative overflow-hidden" style={{
      background: 'linear-gradient(135deg, hsl(200 100% 45%) 0%, hsl(180 80% 45%) 50%, hsl(95 70% 50%) 100%)'
    }}>
      {/* Decorative shapes */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/5 rounded-full blur-3xl" />
      
      <div className="container relative z-10">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-primary-foreground mb-6">
            Pronto para modernizar seu sindicato?
          </h2>
          <p className="text-lg md:text-xl text-primary-foreground/80 mb-10 max-w-2xl mx-auto">
            Solicite uma demonstração gratuita e veja como o Sistema Sindical pode transformar a gestão da sua entidade.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg"
              className="bg-card text-primary hover:bg-card/90 rounded-full px-8 h-14 text-base font-semibold shadow-xl transition-all duration-300 hover:scale-105"
              asChild
            >
              <a href="mailto:contato@eclini.com.br?subject=Demonstração Sistema Sindical" className="flex items-center gap-2">
                Solicitar demonstração
                <ArrowRight className="h-5 w-5" />
              </a>
            </Button>
            <Button 
              size="lg"
              variant="outline"
              className="border-2 border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 rounded-full px-8 h-14 text-base font-semibold"
              asChild
            >
              <a 
                href="https://wa.me/5571982786864?text=Olá! Gostaria de agendar uma demonstração do Sistema Sindical."
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2"
              >
                <MessageCircle className="h-5 w-5" />
                Falar pelo WhatsApp
              </a>
            </Button>
          </div>

          <p className="mt-8 text-primary-foreground/60 text-sm">
            Demonstração gratuita • Sem compromisso • Suporte em português
          </p>
        </div>
      </div>
    </section>
  );
}

// Header/Navbar
function SindicalHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-b border-border">
      <div className="container">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/sindical" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{
              background: 'linear-gradient(135deg, hsl(200 100% 45%) 0%, hsl(95 70% 50%) 100%)'
            }}>
              <Scale className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">
              <span className="gradient-text">Sistema</span> Sindical
            </span>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            <a href="#sobre" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Sobre
            </a>
            <a href="#recursos" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Recursos
            </a>
            <a href="#beneficios" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Benefícios
            </a>
            <a href="#publico" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Para quem
            </a>
            <a href="#contato" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Contato
            </a>
          </nav>

          {/* CTA */}
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild className="hidden sm:flex">
              <Link to="/auth">Entrar</Link>
            </Button>
            <Button size="sm" className="btn-eclini" asChild>
              <a href="#contato">Demonstração</a>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}

// Footer
function SindicalFooter() {
  return (
    <footer className="bg-foreground text-background py-16">
      <div className="container">
        <div className="grid md:grid-cols-4 gap-12">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{
                background: 'linear-gradient(135deg, hsl(200 100% 45%) 0%, hsl(95 70% 50%) 100%)'
              }}>
                <Scale className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold text-background">
                Sistema Sindical
              </span>
            </div>
            <p className="text-background/70 mb-6 max-w-md">
              Solução completa para gestão de sindicatos laborais. Transparência, organização e eficiência para sua entidade.
            </p>
            <div className="flex gap-4">
              <a 
                href="https://wa.me/5571982786864" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full bg-background/10 flex items-center justify-center hover:bg-background/20 transition-colors"
              >
                <MessageCircle className="h-5 w-5" />
              </a>
              <a 
                href="mailto:contato@eclini.com.br" 
                className="w-10 h-10 rounded-full bg-background/10 flex items-center justify-center hover:bg-background/20 transition-colors"
              >
                <Mail className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-bold text-background mb-4">Contato</h4>
            <ul className="space-y-3">
              <li className="flex items-center gap-2 text-background/70">
                <Phone className="h-4 w-4" />
                <span>(71) 98278-6864</span>
              </li>
              <li className="flex items-center gap-2 text-background/70">
                <Mail className="h-4 w-4" />
                <span>contato@eclini.com.br</span>
              </li>
              <li className="flex items-start gap-2 text-background/70">
                <MapPin className="h-4 w-4 mt-1 flex-shrink-0" />
                <span>Salvador, Bahia - Brasil</span>
              </li>
            </ul>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-bold text-background mb-4">Links</h4>
            <ul className="space-y-3">
              <li>
                <a href="#sobre" className="text-background/70 hover:text-background transition-colors">
                  Sobre o Sistema
                </a>
              </li>
              <li>
                <a href="#recursos" className="text-background/70 hover:text-background transition-colors">
                  Recursos
                </a>
              </li>
              <li>
                <a href="#beneficios" className="text-background/70 hover:text-background transition-colors">
                  Benefícios
                </a>
              </li>
              <li>
                <Link to="/politica-privacidade" className="text-background/70 hover:text-background transition-colors">
                  Política de Privacidade
                </Link>
              </li>
              <li>
                <Link to="/termos-uso" className="text-background/70 hover:text-background transition-colors">
                  Termos de Uso
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-background/10 mt-12 pt-8 text-center text-background/50 text-sm">
          <p>© {new Date().getFullYear()} Sistema Sindical. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  );
}

// Main Landing Page Component
export default function SindicalLandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <SindicalHeader />
      <main>
        <SindicalHeroSection />
        <AboutSection />
        <FeaturesSection />
        <BenefitsSection />
        <AudienceSection />
        <SindicalCTASection />
      </main>
      <SindicalFooter />
    </div>
  );
}
