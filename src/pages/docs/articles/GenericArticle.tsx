import { Link, useParams, Navigate } from "react-router-dom";
import { ArrowLeft, Clock, Lightbulb, Construction } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { docsCategories } from "../DocsLayout";

export default function GenericArticle() {
  const { categoryId, articleSlug } = useParams<{ categoryId: string; articleSlug: string }>();
  
  const category = docsCategories.find(c => c.id === categoryId);
  const article = category?.articles.find(a => a.slug === articleSlug);
  
  if (!category || !article) {
    return <Navigate to="/ajuda" replace />;
  }

  const Icon = category.icon;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <Link 
          to={`/ajuda/${categoryId}`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para {category.title}
        </Link>
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
          {article.title}
        </h1>
        <p className="text-muted-foreground mt-2">
          Tutorial passo a passo
        </p>
        <div className="flex items-center gap-2 mt-4 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>Tempo de leitura: 5 min</span>
        </div>
      </div>

      {/* Content */}
      <div className="bg-card rounded-xl border border-border p-6 lg:p-8">
        <div className="prose prose-slate max-w-none">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <Construction className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              Conteúdo em desenvolvimento
            </h2>
            <p className="text-muted-foreground max-w-md">
              Este tutorial está sendo preparado por nossa equipe. 
              Em breve você terá acesso ao conteúdo completo com imagens e exemplos práticos.
            </p>
          </div>

          <Alert className="my-6">
            <Lightbulb className="h-4 w-4" />
            <AlertTitle>Precisa de ajuda agora?</AlertTitle>
            <AlertDescription>
              Entre em contato com nosso suporte via WhatsApp: 
              <a 
                href="https://wa.me/5571982786864" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline ml-1"
              >
                (71) 98278-6864
              </a>
            </AlertDescription>
          </Alert>
        </div>
      </div>

      {/* Related in same category */}
      <div className="pt-6 border-t border-border">
        <h3 className="font-semibold text-foreground mb-4">
          Outros tutoriais em {category.title}
        </h3>
        <div className="grid sm:grid-cols-2 gap-3">
          {category.articles
            .filter(a => a.slug !== articleSlug)
            .map((art) => (
              <Link
                key={art.slug}
                to={`/ajuda/${categoryId}/${art.slug}`}
                className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/30 hover:bg-muted/50 transition-all group"
              >
                <Icon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                  {art.title}
                </span>
              </Link>
            ))}
        </div>
      </div>
    </div>
  );
}
