import { Link, Outlet, useLocation } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { 
  BookOpen, 
  Calendar, 
  Users, 
  FileText, 
  Settings, 
  CreditCard, 
  MessageSquare, 
  Stethoscope,
  Play,
  ChevronRight,
  Search,
  Home
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { cn } from "@/lib/utils";

const docsCategories = [
  {
    id: "primeiros-passos",
    title: "Primeiros Passos",
    icon: Play,
    description: "Configure sua clínica rapidamente",
    articles: [
      { slug: "configuracao-inicial", title: "Configuração Inicial" },
      { slug: "personalizando-clinica", title: "Personalizando sua Clínica" },
      { slug: "cadastrando-profissionais", title: "Cadastrando Profissionais" },
      { slug: "configurando-horarios", title: "Configurando Horários de Atendimento" },
    ]
  },
  {
    id: "agenda",
    title: "Agenda",
    icon: Calendar,
    description: "Gerencie seus agendamentos",
    articles: [
      { slug: "visao-geral-agenda", title: "Visão Geral da Agenda" },
      { slug: "criando-agendamentos", title: "Criando Agendamentos" },
      { slug: "confirmacao-whatsapp", title: "Confirmação via WhatsApp" },
      { slug: "lista-espera", title: "Lista de Espera" },
    ]
  },
  {
    id: "pacientes",
    title: "Pacientes",
    icon: Users,
    description: "Cadastro e prontuário",
    articles: [
      { slug: "cadastro-pacientes", title: "Cadastro de Pacientes" },
      { slug: "prontuario-eletronico", title: "Prontuário Eletrônico" },
      { slug: "anamnese", title: "Anamnese Digital" },
      { slug: "anexos-documentos", title: "Anexos e Documentos" },
    ]
  },
  {
    id: "financeiro",
    title: "Financeiro",
    icon: CreditCard,
    description: "Controle financeiro completo",
    articles: [
      { slug: "lancamentos", title: "Lançamentos Financeiros" },
      { slug: "contas-pagar-receber", title: "Contas a Pagar e Receber" },
      { slug: "comissoes", title: "Comissões de Profissionais" },
      { slug: "relatorios-financeiros", title: "Relatórios Financeiros" },
    ]
  },
  {
    id: "atendimento",
    title: "Atendimento",
    icon: Stethoscope,
    description: "Fluxo de atendimento clínico",
    articles: [
      { slug: "painel-atendimento", title: "Painel de Atendimento" },
      { slug: "prescricoes", title: "Prescrições Digitais" },
      { slug: "atestados-declaracoes", title: "Atestados e Declarações" },
      { slug: "telemedicina", title: "Telemedicina" },
    ]
  },
  {
    id: "whatsapp",
    title: "WhatsApp",
    icon: MessageSquare,
    description: "Integração com WhatsApp",
    articles: [
      { slug: "configurando-whatsapp", title: "Configurando WhatsApp" },
      { slug: "agendamento-automatico", title: "Agendamento Automático" },
      { slug: "lembretes-automaticos", title: "Lembretes Automáticos" },
      { slug: "mensagens-aniversario", title: "Mensagens de Aniversário" },
    ]
  },
  {
    id: "configuracoes",
    title: "Configurações",
    icon: Settings,
    description: "Personalize o sistema",
    articles: [
      { slug: "usuarios-permissoes", title: "Usuários e Permissões" },
      { slug: "documentos-impressos", title: "Documentos Impressos" },
      { slug: "convenios", title: "Convênios e Planos" },
      { slug: "procedimentos", title: "Procedimentos e Valores" },
    ]
  },
];

export default function DocsLayout() {
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  
  const isActive = (path: string) => location.pathname.includes(path);

  const filteredCategories = searchTerm
    ? docsCategories.map(cat => ({
        ...cat,
        articles: cat.articles.filter(art => 
          art.title.toLowerCase().includes(searchTerm.toLowerCase())
        )
      })).filter(cat => cat.articles.length > 0)
    : docsCategories;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <div className="flex-1 pt-16 lg:pt-20">
        <div className="container py-8">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
            <Link to="/" className="hover:text-primary transition-colors">
              <Home className="h-4 w-4" />
            </Link>
            <ChevronRight className="h-4 w-4" />
            <Link to="/ajuda" className="hover:text-primary transition-colors">
              Central de Ajuda
            </Link>
            {location.pathname !== "/ajuda" && (
              <>
                <ChevronRight className="h-4 w-4" />
                <span className="text-foreground font-medium">Tutorial</span>
              </>
            )}
          </nav>

          <div className="flex flex-col lg:flex-row gap-8">
            {/* Sidebar */}
            <aside className="w-full lg:w-72 shrink-0">
              <div className="sticky top-24 space-y-6">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar tutoriais..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {/* Navigation */}
                <nav className="space-y-2">
                  {filteredCategories.map((category) => {
                    const Icon = category.icon;
                    const isCategoryActive = isActive(`/ajuda/${category.id}`);
                    
                    return (
                      <div key={category.id} className="space-y-1">
                        <Link
                          to={`/ajuda/${category.id}`}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium",
                            isCategoryActive
                              ? "bg-primary/10 text-primary"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          )}
                        >
                          <Icon className="h-4 w-4" />
                          {category.title}
                        </Link>
                        
                        {isCategoryActive && (
                          <div className="ml-7 pl-3 border-l-2 border-border space-y-1">
                            {category.articles.map((article) => (
                              <Link
                                key={article.slug}
                                to={`/ajuda/${category.id}/${article.slug}`}
                                className={cn(
                                  "block py-1.5 text-sm transition-colors",
                                  isActive(article.slug)
                                    ? "text-primary font-medium"
                                    : "text-muted-foreground hover:text-foreground"
                                )}
                              >
                                {article.title}
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </nav>
              </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 min-w-0">
              <Outlet />
            </main>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}

export { docsCategories };
