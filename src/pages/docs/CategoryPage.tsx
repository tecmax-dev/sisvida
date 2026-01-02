import { Link, useParams, useLocation, Navigate } from "react-router-dom";
import { ArrowRight, FileText } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { docsCategories } from "./DocsLayout";

export default function CategoryPage() {
  const { categoryId: paramCategoryId } = useParams<{ categoryId: string }>();
  const location = useLocation();
  
  // Extract category from URL path if not provided as param
  // e.g., /ajuda/primeiros-passos -> "primeiros-passos"
  const pathParts = location.pathname.split('/').filter(Boolean);
  const categoryId = paramCategoryId || (pathParts.length >= 2 ? pathParts[1] : null);
  
  const category = docsCategories.find(c => c.id === categoryId);
  
  if (!category) {
    return <Navigate to="/ajuda" replace />;
  }

  const Icon = category.icon;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="h-7 w-7 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
            {category.title}
          </h1>
          <p className="text-muted-foreground mt-1">
            {category.description}
          </p>
        </div>
      </div>

      {/* Articles List */}
      <div className="space-y-3">
        {category.articles.map((article, index) => (
          <Link
            key={article.slug}
            to={`/ajuda/${category.id}/${article.slug}`}
          >
            <Card className="hover:border-primary/30 hover:shadow-md transition-all group cursor-pointer">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                  <span className="font-semibold">{index + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                    {article.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Tutorial passo a passo
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Related Categories */}
      <div className="pt-8 border-t border-border">
        <h2 className="text-lg font-semibold text-foreground mb-4">
          Outras categorias
        </h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {docsCategories
            .filter(c => c.id !== category.id)
            .slice(0, 4)
            .map((cat) => {
              const CatIcon = cat.icon;
              return (
                <Link
                  key={cat.id}
                  to={`/ajuda/${cat.id}`}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/30 hover:bg-muted/50 transition-all group"
                >
                  <CatIcon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                    {cat.title}
                  </span>
                </Link>
              );
            })}
        </div>
      </div>
    </div>
  );
}
