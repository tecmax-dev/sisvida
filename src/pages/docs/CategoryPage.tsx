import { Link, useParams, useLocation, Navigate } from "react-router-dom";
import { ArrowRight, Clock, BookOpen } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { docsCategories } from "./DocsLayout";

// Import tutorial images for categories
import tutorialAgenda from "@/assets/docs/tutorial-agenda-pt.png";
import tutorialPacientes from "@/assets/docs/tutorial-pacientes-pt.png";
import tutorialFinanceiro from "@/assets/docs/tutorial-financeiro-pt.png";
import tutorialWhatsapp from "@/assets/docs/tutorial-whatsapp-pt.png";
import tutorialAtendimento from "@/assets/docs/tutorial-atendimento-pt.png";
import tutorialConfiguracoes from "@/assets/docs/tutorial-configuracoes-pt.png";
import tutorialLogin from "@/assets/docs/tutorial-login-pt.png";

const categoryImages: Record<string, string> = {
  "primeiros-passos": tutorialLogin,
  "agenda": tutorialAgenda,
  "pacientes": tutorialPacientes,
  "financeiro": tutorialFinanceiro,
  "atendimento": tutorialAtendimento,
  "whatsapp": tutorialWhatsapp,
  "configuracoes": tutorialConfiguracoes,
};

const articleReadTimes: Record<string, string> = {
  "configuracao-inicial": "5 min",
  "personalizando-clinica": "4 min",
  "cadastrando-profissionais": "6 min",
  "configurando-horarios": "5 min",
  "visao-geral-agenda": "4 min",
  "criando-agendamentos": "5 min",
  "confirmacao-whatsapp": "4 min",
  "lista-espera": "3 min",
  "cadastrando-pacientes": "4 min",
  "prontuario-eletronico": "5 min",
  "anexos-documentos": "4 min",
  "historico-atendimentos": "3 min",
};

export default function CategoryPage() {
  const { categoryId: paramCategoryId } = useParams<{ categoryId: string }>();
  const location = useLocation();
  
  const pathParts = location.pathname.split('/').filter(Boolean);
  const categoryId = paramCategoryId || (pathParts.length >= 2 ? pathParts[1] : null);
  
  const category = docsCategories.find(c => c.id === categoryId);
  
  if (!category) {
    return <Navigate to="/ajuda" replace />;
  }

  const Icon = category.icon;
  const categoryImage = categoryImages[category.id] || tutorialLogin;

  return (
    <div className="space-y-8">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-background border border-primary/20">
        <div className="absolute top-0 right-0 w-1/2 h-full opacity-20 hidden lg:block">
          <img 
            src={categoryImage} 
            alt={category.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background to-transparent" />
        </div>
        
        <div className="relative z-10 p-6 lg:p-8">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <Icon className="h-7 w-7 text-primary" />
            </div>
            <div>
              <Badge variant="outline" className="mb-2">
                {category.articles.length} artigos
              </Badge>
              <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
                {category.title}
              </h1>
              <p className="text-muted-foreground mt-2 max-w-xl">
                {category.description}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Articles List */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          Tutoriais disponíveis
        </h2>
        <div className="space-y-3">
          {category.articles.map((article, index) => (
            <Card
              key={article.slug}
              asChild
              className="hover:border-primary/30 hover:shadow-lg transition-all group cursor-pointer overflow-hidden"
            >
              <Link to={`/ajuda/${category.id}/${article.slug}`} className="block">
                <CardContent className="flex items-center gap-4 p-0">
                  {/* Number indicator */}
                  <div className="w-16 h-full bg-primary/5 flex items-center justify-center py-5 border-r border-border">
                    <span className="text-2xl font-bold text-primary/60 group-hover:text-primary transition-colors">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0 py-4 pr-4">
                    <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors mb-1">
                      {article.title}
                    </h3>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {articleReadTimes[article.slug] || "4 min"}
                      </span>
                      <span>•</span>
                      <span>Tutorial passo a passo</span>
                    </div>
                  </div>
                  
                  {/* Arrow */}
                  <div className="pr-4">
                    <div className="w-10 h-10 rounded-full bg-muted group-hover:bg-primary/10 flex items-center justify-center transition-colors">
                      <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>
                </CardContent>
              </Link>
            </Card>
          ))}
        </div>
      </div>

      {/* Start Learning CTA */}
      <div className="bg-muted/50 rounded-xl p-6 text-center">
        <h3 className="font-semibold text-foreground mb-2">
          Pronto para começar?
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Clique no primeiro tutorial para iniciar seu aprendizado
        </p>
        <Link
          to={`/ajuda/${category.id}/${category.articles[0]?.slug}`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
        >
          Começar agora
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Related Categories */}
      <div className="pt-8 border-t border-border">
        <h2 className="text-lg font-semibold text-foreground mb-4">
          Explore outras categorias
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {docsCategories
            .filter(c => c.id !== category.id)
            .slice(0, 6)
            .map((cat) => {
              const CatIcon = cat.icon;
              return (
                <Link
                  key={cat.id}
                  to={`/ajuda/${cat.id}`}
                  className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:border-primary/30 hover:shadow-md transition-all group"
                >
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                    <CatIcon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-foreground group-hover:text-primary transition-colors block">
                      {cat.title}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {cat.articles.length} artigos
                    </span>
                  </div>
                </Link>
              );
            })}
        </div>
      </div>
    </div>
  );
}
