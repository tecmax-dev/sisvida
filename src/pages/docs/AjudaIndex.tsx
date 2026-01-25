import { Link } from "react-router-dom";
import { 
  Play, 
  Calendar, 
  Users, 
  CreditCard, 
  MessageSquare, 
  Stethoscope,
  Settings,
  ArrowRight,
  BookOpen,
  Headphones,
  Video,
  Search,
  Clock,
  CheckCircle2,
  Sparkles
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

// Import tutorial images
import tutorialAgenda from "@/assets/docs/tutorial-agenda-pt.png";
import tutorialPacientes from "@/assets/docs/tutorial-pacientes-pt.png";
import tutorialFinanceiro from "@/assets/docs/tutorial-financeiro-pt.png";
import tutorialWhatsapp from "@/assets/docs/tutorial-whatsapp-pt.png";
import tutorialProntuario from "@/assets/docs/tutorial-prontuario-pt.png";
import tutorialAtendimento from "@/assets/docs/tutorial-atendimento-pt.png";
import tutorialConfiguracoes from "@/assets/docs/tutorial-configuracoes-pt.png";
import tutorialLogin from "@/assets/docs/tutorial-login-pt.png";

interface TutorialCategory {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  articles: number;
  image: string;
  featured?: boolean;
}

const categories: TutorialCategory[] = [
  {
    id: "primeiros-passos",
    title: "Primeiros Passos",
    description: "Configure sua clínica do zero e comece a usar o Eclini em minutos",
    icon: Play,
    color: "text-emerald-600",
    bgColor: "bg-emerald-500/10 border-emerald-500/20",
    articles: 4,
    image: tutorialLogin,
    featured: true,
  },
  {
    id: "agenda",
    title: "Agenda e Agendamentos",
    description: "Domine todas as funcionalidades da agenda e otimize seus horários",
    icon: Calendar,
    color: "text-blue-600",
    bgColor: "bg-blue-500/10 border-blue-500/20",
    articles: 4,
    image: tutorialAgenda,
    featured: true,
  },
  {
    id: "pacientes",
    title: "Gestão de Pacientes",
    description: "Cadastros completos, prontuários eletrônicos e histórico médico",
    icon: Users,
    color: "text-violet-600",
    bgColor: "bg-violet-500/10 border-violet-500/20",
    articles: 4,
    image: tutorialPacientes,
  },
  {
    id: "atendimento",
    title: "Fluxo de Atendimento",
    description: "Consultas, prescrições digitais, atestados e documentos",
    icon: Stethoscope,
    color: "text-rose-600",
    bgColor: "bg-rose-500/10 border-rose-500/20",
    articles: 4,
    image: tutorialAtendimento,
  },
  {
    id: "financeiro",
    title: "Módulo Financeiro",
    description: "Controle receitas, despesas, fluxo de caixa e relatórios",
    icon: CreditCard,
    color: "text-amber-600",
    bgColor: "bg-amber-500/10 border-amber-500/20",
    articles: 4,
    image: tutorialFinanceiro,
  },
  {
    id: "whatsapp",
    title: "Integração WhatsApp",
    description: "Lembretes automáticos, confirmações e mensagens de aniversário",
    icon: MessageSquare,
    color: "text-green-600",
    bgColor: "bg-green-500/10 border-green-500/20",
    articles: 4,
    image: tutorialWhatsapp,
  },
  {
    id: "configuracoes",
    title: "Configurações do Sistema",
    description: "Personalize o Eclini de acordo com as necessidades da sua clínica",
    icon: Settings,
    color: "text-slate-600",
    bgColor: "bg-slate-500/10 border-slate-500/20",
    articles: 4,
    image: tutorialConfiguracoes,
  },
];

const quickStartSteps = [
  {
    step: 1,
    title: "Crie sua conta",
    description: "Acesse o sistema e cadastre sua clínica",
    time: "2 min",
    link: "/ajuda/primeiros-passos/configuracao-inicial",
  },
  {
    step: 2,
    title: "Configure os profissionais",
    description: "Adicione médicos e defina seus horários",
    time: "5 min",
    link: "/ajuda/primeiros-passos/cadastrando-profissionais",
  },
  {
    step: 3,
    title: "Comece a agendar",
    description: "Crie seu primeiro agendamento",
    time: "3 min",
    link: "/ajuda/agenda/criando-agendamentos",
  },
  {
    step: 4,
    title: "Integre o WhatsApp",
    description: "Ative lembretes automáticos",
    time: "5 min",
    link: "/ajuda/whatsapp/configurando-whatsapp",
  },
];

export default function AjudaIndex() {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredCategories = categories.filter(
    (cat) =>
      cat.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cat.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const featuredCategories = filteredCategories.filter((cat) => cat.featured);
  const otherCategories = filteredCategories.filter((cat) => !cat.featured);

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/10 via-primary/5 to-background border border-primary/20 p-8 lg:p-12">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative z-10 max-w-2xl">
          <Badge className="mb-4 bg-primary/20 text-primary border-0">
            <Sparkles className="h-3 w-3 mr-1" />
            Central de Tutoriais
          </Badge>
          <h1 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
            Aprenda a usar o Eclini
          </h1>
          <p className="text-lg text-muted-foreground mb-6">
            Tutoriais passo a passo para você aproveitar todas as funcionalidades do sistema. 
            Encontre respostas rápidas e torne-se um expert no Eclini.
          </p>
          
          {/* Search Bar */}
          <div className="relative max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar tutoriais..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 h-12 text-base bg-background/80 backdrop-blur-sm border-border/50"
            />
          </div>
        </div>
      </div>

      {/* Quick Start Guide */}
      <div>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <Play className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              Guia de Início Rápido
            </h2>
            <p className="text-sm text-muted-foreground">
              Configure sua clínica em menos de 15 minutos
            </p>
          </div>
        </div>
        
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickStartSteps.map((step) => (
            <Link
              key={step.step}
              to={step.link}
              className="group relative bg-card rounded-xl border border-border p-5 hover:border-primary/30 hover:shadow-lg transition-all duration-300"
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                  {step.step}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors mb-1">
                    {step.title}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                    {step.description}
                  </p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>{step.time}</span>
                  </div>
                </div>
              </div>
              <ArrowRight className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
            </Link>
          ))}
        </div>
      </div>

      {/* Featured Categories */}
      {featuredCategories.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">
                Tutoriais em Destaque
              </h2>
              <p className="text-sm text-muted-foreground">
                Os módulos mais importantes do sistema
              </p>
            </div>
          </div>
          
          <div className="grid lg:grid-cols-2 gap-6">
            {featuredCategories.map((category) => {
              const Icon = category.icon;
              return (
                <Link
                  key={category.id}
                  to={`/ajuda/${category.id}`}
                  className="group relative overflow-hidden bg-card rounded-2xl border border-border hover:border-primary/30 hover:shadow-xl transition-all duration-300"
                >
                  <div className="flex flex-col lg:flex-row">
                    {/* Image */}
                    <div className="lg:w-2/5 h-48 lg:h-auto relative overflow-hidden bg-muted">
                      <img
                        src={category.image}
                        alt={category.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t lg:bg-gradient-to-r from-background/60 to-transparent" />
                    </div>
                    
                    {/* Content */}
                    <div className="lg:w-3/5 p-6">
                      <div className={`w-12 h-12 rounded-xl ${category.bgColor} border flex items-center justify-center mb-4`}>
                        <Icon className={`h-6 w-6 ${category.color}`} />
                      </div>
                      <h3 className="text-xl font-semibold text-foreground group-hover:text-primary transition-colors mb-2">
                        {category.title}
                      </h3>
                      <p className="text-muted-foreground mb-4">
                        {category.description}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          {category.articles} artigos
                        </span>
                        <span className="inline-flex items-center gap-1 text-sm font-medium text-primary group-hover:gap-2 transition-all">
                          Ver tutoriais
                          <ArrowRight className="h-4 w-4" />
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* All Categories Grid */}
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-6">
          Todas as Categorias
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {otherCategories.map((category) => {
            const Icon = category.icon;
            return (
              <Link
                key={category.id}
                to={`/ajuda/${category.id}`}
                className="group bg-card rounded-xl border border-border overflow-hidden hover:border-primary/30 hover:shadow-lg transition-all duration-300"
              >
                {/* Image */}
                <div className="h-40 relative overflow-hidden bg-muted">
                  <img
                    src={category.image}
                    alt={category.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
                  <div className={`absolute bottom-3 left-3 w-10 h-10 rounded-lg ${category.bgColor} border backdrop-blur-sm flex items-center justify-center`}>
                    <Icon className={`h-5 w-5 ${category.color}`} />
                  </div>
                </div>
                
                {/* Content */}
                <div className="p-4">
                  <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors mb-1">
                    {category.title}
                  </h3>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                    {category.description}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {category.articles} artigos
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* What You'll Learn Section */}
      <div className="bg-muted/30 rounded-2xl border border-border p-8">
        <h2 className="text-xl font-semibold text-foreground mb-6 text-center">
          O que você vai aprender
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: Calendar, text: "Gerenciar agendamentos de forma eficiente" },
            { icon: Users, text: "Cadastrar e organizar pacientes" },
            { icon: Stethoscope, text: "Realizar atendimentos completos" },
            { icon: CreditCard, text: "Controlar as finanças da clínica" },
            { icon: MessageSquare, text: "Automatizar comunicações via WhatsApp" },
            { icon: Settings, text: "Personalizar o sistema" },
            { icon: CheckCircle2, text: "Gerar documentos e relatórios" },
            { icon: Video, text: "Usar recursos avançados" },
          ].map((item, index) => {
            const Icon = item.icon;
            return (
              <div
                key={index}
                className="flex items-center gap-3 p-3 bg-background rounded-lg border border-border"
              >
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <span className="text-sm text-foreground">{item.text}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Help Options */}
      <div className="bg-gradient-to-br from-primary/5 to-background rounded-2xl border border-primary/20 p-8">
        <h2 className="text-xl font-semibold text-foreground mb-2 text-center">
          Precisa de mais ajuda?
        </h2>
        <p className="text-muted-foreground text-center mb-8">
          Nossa equipe está pronta para te ajudar
        </p>
        <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
          <Card className="text-center p-6 hover:shadow-lg transition-shadow">
            <CardContent className="p-0">
              <div className="w-14 h-14 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                <Headphones className="h-7 w-7 text-green-600" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">Suporte via WhatsApp</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Fale diretamente com nossa equipe de suporte
              </p>
              <Button variant="outline" size="sm" className="w-full" asChild>
                <a href="https://wa.me/5571982786864" target="_blank" rel="noopener noreferrer">
                  Iniciar conversa
                </a>
              </Button>
            </CardContent>
          </Card>
          
          <Card className="text-center p-6 hover:shadow-lg transition-shadow">
            <CardContent className="p-0">
              <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
                <Video className="h-7 w-7 text-blue-600" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">Vídeos Tutoriais</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Aprenda assistindo demonstrações práticas
              </p>
              <Button variant="outline" size="sm" className="w-full">
                Em breve
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
