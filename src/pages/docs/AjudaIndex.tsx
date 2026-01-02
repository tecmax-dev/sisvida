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
  FileQuestion
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const categories = [
  {
    id: "primeiros-passos",
    title: "Primeiros Passos",
    description: "Aprenda a configurar sua clínica do zero",
    icon: Play,
    color: "bg-emerald-500/10 text-emerald-600",
    articles: 4,
  },
  {
    id: "agenda",
    title: "Agenda",
    description: "Domine o agendamento de consultas",
    icon: Calendar,
    color: "bg-blue-500/10 text-blue-600",
    articles: 4,
  },
  {
    id: "pacientes",
    title: "Pacientes",
    description: "Gerencie cadastros e prontuários",
    icon: Users,
    color: "bg-violet-500/10 text-violet-600",
    articles: 4,
  },
  {
    id: "financeiro",
    title: "Financeiro",
    description: "Controle suas finanças",
    icon: CreditCard,
    color: "bg-amber-500/10 text-amber-600",
    articles: 4,
  },
  {
    id: "atendimento",
    title: "Atendimento",
    description: "Fluxo de atendimento clínico",
    icon: Stethoscope,
    color: "bg-rose-500/10 text-rose-600",
    articles: 4,
  },
  {
    id: "whatsapp",
    title: "WhatsApp",
    description: "Integração e automações",
    icon: MessageSquare,
    color: "bg-green-500/10 text-green-600",
    articles: 4,
  },
  {
    id: "configuracoes",
    title: "Configurações",
    description: "Personalize o sistema",
    icon: Settings,
    color: "bg-slate-500/10 text-slate-600",
    articles: 4,
  },
];

const quickLinks = [
  {
    title: "Primeiros passos",
    description: "Comece a usar o Eclini em minutos",
    icon: Play,
    href: "/ajuda/primeiros-passos/configuracao-inicial",
  },
  {
    title: "Agendar consulta",
    description: "Aprenda a criar agendamentos",
    icon: Calendar,
    href: "/ajuda/agenda/criando-agendamentos",
  },
  {
    title: "Configurar WhatsApp",
    description: "Integre o WhatsApp à sua clínica",
    icon: MessageSquare,
    href: "/ajuda/whatsapp/configurando-whatsapp",
  },
];

export default function AjudaIndex() {
  return (
    <div className="space-y-12">
      {/* Hero */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
          <BookOpen className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-3xl lg:text-4xl font-bold text-foreground">
          Central de Ajuda
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Tutoriais completos para você aproveitar ao máximo todas as funcionalidades do Eclini
        </p>
      </div>

      {/* Quick Links */}
      <div className="grid md:grid-cols-3 gap-4">
        {quickLinks.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              to={link.href}
              className="group flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:border-primary/30 hover:shadow-md transition-all"
            >
              <div className="shrink-0 w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <Icon className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                  {link.title}
                </h3>
                <p className="text-sm text-muted-foreground truncate">
                  {link.description}
                </p>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
            </Link>
          );
        })}
      </div>

      {/* Categories Grid */}
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-6">
          Categorias de Tutoriais
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((category) => {
            const Icon = category.icon;
            return (
              <Link key={category.id} to={`/ajuda/${category.id}`} className="block h-full">
                <Card className="h-full hover:border-primary/30 hover:shadow-md transition-all group cursor-pointer">
                  <CardHeader className="pb-3">
                    <div className={`w-10 h-10 rounded-lg ${category.color} flex items-center justify-center mb-2`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-lg group-hover:text-primary transition-colors">
                      {category.title}
                    </CardTitle>
                    <CardDescription>
                      {category.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <span className="text-sm text-muted-foreground">
                      {category.articles} artigos
                    </span>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Help Options */}
      <div className="bg-muted/50 rounded-2xl p-6 lg:p-8">
        <h2 className="text-xl font-semibold text-foreground mb-6 text-center">
          Precisa de mais ajuda?
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Headphones className="h-7 w-7 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground mb-2">Suporte via Chat</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Fale com nossa equipe em tempo real
            </p>
            <Button variant="outline" size="sm" asChild>
              <a href="https://wa.me/5571982786864" target="_blank" rel="noopener noreferrer">
                Iniciar conversa
              </a>
            </Button>
          </div>
          
          <div className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Video className="h-7 w-7 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground mb-2">Vídeos Tutoriais</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Aprenda com demonstrações práticas
            </p>
            <Button variant="outline" size="sm">
              Ver vídeos
            </Button>
          </div>
          
          <div className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <FileQuestion className="h-7 w-7 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground mb-2">Perguntas Frequentes</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Respostas para dúvidas comuns
            </p>
            <Button variant="outline" size="sm" asChild>
              <Link to="/#faq">Ver FAQ</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
