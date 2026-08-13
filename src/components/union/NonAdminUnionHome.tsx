import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight, Star, Compass, LifeBuoy, MessageCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useUnionNavCategories, type UnionNavItem } from "@/components/dashboard/useUnionNavCategories";

const STORAGE_KEY = "union.shortcut.usage.v1";
const MAX_MOST_USED = 6;

function readUsage(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

export function trackUnionShortcut(href: string) {
  try {
    const u = readUsage();
    u[href] = (u[href] || 0) + 1;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
  } catch {}
}

interface FlatItem extends UnionNavItem {
  categoryLabel: string;
  categoryColor?: string;
}

export function NonAdminUnionHome({ entityName }: { entityName: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const categories = useUnionNavCategories();
  const [usage, setUsage] = useState<Record<string, number>>(() => readUsage());

  useEffect(() => {
    const onFocus = () => setUsage(readUsage());
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const allItems: FlatItem[] = useMemo(
    () =>
      categories.flatMap((c) =>
        c.items.map((i) => ({ ...i, categoryLabel: c.label, categoryColor: c.color }))
      ),
    [categories]
  );

  const mostUsed = useMemo(() => {
    const scored = allItems
      .map((i) => ({ item: i, score: usage[i.href] || 0 }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_MOST_USED)
      .map((x) => x.item);
    return scored;
  }, [allItems, usage]);

  const firstName =
    (user?.user_metadata as any)?.full_name?.split(" ")[0] ||
    user?.email?.split("@")[0] ||
    "";

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Bom dia";
    if (h < 18) return "Boa tarde";
    return "Boa noite";
  })();

  const handleClick = (href: string) => {
    trackUnionShortcut(href);
    navigate(href);
  };

  const renderCard = (item: FlatItem, badge?: React.ReactNode) => {
    const Icon = item.icon;
    return (
      <button
        key={item.href}
        onClick={() => handleClick(item.href)}
        className="group text-left rounded-xl border bg-card hover:bg-accent/40 hover:border-primary/40 transition-all p-4 flex items-start gap-3 shadow-sm hover:shadow-md"
      >
        <div className="rounded-lg bg-primary/10 text-primary p-2.5 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm truncate">{item.label}</p>
            {badge}
          </div>
          <p className="text-xs text-muted-foreground truncate">{item.categoryLabel}</p>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-1" />
      </button>
    );
  };

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border p-6">
        <div className="flex items-center gap-2 text-primary text-sm font-medium mb-2">
          <Sparkles className="h-4 w-4" />
          {entityName}
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">
          {greeting}{firstName ? `, ${firstName}` : ""}!
        </h1>
        <p className="text-muted-foreground mt-1">
          Escolha um atalho abaixo para começar. Seus mais usados aparecem em destaque.
        </p>
      </div>

      {/* Mais usados */}
      {mostUsed.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Mais usados</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {mostUsed.map((i) => renderCard(i))}
          </div>
        </section>
      )}

      {/* Atalhos por categoria */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Compass className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
            {mostUsed.length > 0 ? "Explorar tudo" : "Atalhos disponíveis"}
          </h2>
        </div>
        <div className="space-y-4">
          {categories.map((cat) => {
            const Icon = cat.icon;
            return (
              <div key={cat.id}>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {cat.label}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {cat.items.map((i) =>
                    renderCard({ ...i, categoryLabel: cat.label, categoryColor: cat.color })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Ajuda */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <LifeBuoy className="h-5 w-5 text-primary" />
            Precisa de ajuda?
          </CardTitle>
          <CardDescription>
            Fale com o administrador da entidade ou com o suporte Prosinge.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <a
              href="https://wa.me/557332239980"
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle className="h-4 w-4 mr-1.5" />
              WhatsApp Suporte
            </a>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/docs">Central de Ajuda</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default NonAdminUnionHome;