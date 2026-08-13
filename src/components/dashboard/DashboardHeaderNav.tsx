import { Link, useLocation } from "react-router-dom";
import { ChevronDown, Building2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}

interface NavCategory {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
  color?: string;
}

const categoryAccent: Record<string, string> = {
  clinica: "text-cyan-600 dark:text-cyan-400",
  admin: "text-rose-600 dark:text-rose-400",
  empresas: "text-amber-600 dark:text-amber-400",
  socios: "text-purple-600 dark:text-purple-400",
  contribuicoes: "text-emerald-600 dark:text-emerald-400",
  financeiro: "text-green-600 dark:text-green-400",
  negociacoes: "text-orange-600 dark:text-orange-400",
  homologacao: "text-indigo-600 dark:text-indigo-400",
  conteudoapp: "text-pink-600 dark:text-pink-400",
  juridico: "text-slate-700 dark:text-slate-300",
  relatoriosSind: "text-blue-600 dark:text-blue-400",
  configSind: "text-zinc-600 dark:text-zinc-400",
};

const categoryBadge: Record<string, string> = {
  clinica: "bg-cyan-500/10 ring-cyan-500/20",
  admin: "bg-rose-500/10 ring-rose-500/20",
  empresas: "bg-amber-500/10 ring-amber-500/20",
  socios: "bg-purple-500/10 ring-purple-500/20",
  contribuicoes: "bg-emerald-500/10 ring-emerald-500/20",
  financeiro: "bg-green-500/10 ring-green-500/20",
  negociacoes: "bg-orange-500/10 ring-orange-500/20",
  homologacao: "bg-indigo-500/10 ring-indigo-500/20",
  conteudoapp: "bg-pink-500/10 ring-pink-500/20",
  juridico: "bg-slate-500/10 ring-slate-500/20",
  relatoriosSind: "bg-blue-500/10 ring-blue-500/20",
  configSind: "bg-zinc-500/10 ring-zinc-500/20",
};

interface Props {
  categories: NavCategory[];
  showUnionLink?: boolean;
  unionCategories?: NavCategory[];
}

export function DashboardHeaderNav({ categories, showUnionLink, unionCategories }: Props) {
  const { pathname } = useLocation();

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);

  return (
    <nav className="hidden md:flex items-center gap-1 flex-nowrap overflow-x-auto no-scrollbar">
      {showUnionLink && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "inline-flex items-center gap-2 h-9 px-3 rounded-md text-sm font-medium transition-colors border",
                "bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30",
                pathname.startsWith("/union") && "bg-amber-500/25"
              )}
            >
              <Building2 className="h-4 w-4" />
              <span>Módulo Sindical</span>
              <ChevronDown className="h-3.5 w-3.5 opacity-70" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
              <Building2 className="h-4 w-4" />
              Módulo Sindical
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/union" className="flex items-center gap-2 cursor-pointer font-medium">
                <Building2 className="h-4 w-4 opacity-70" />
                <span>Ir para o painel</span>
              </Link>
            </DropdownMenuItem>
            {unionCategories && unionCategories.length > 0 && (
              <>
                <DropdownMenuSeparator />
                {unionCategories.map((cat) => {
                  const CatIcon = cat.icon;
                  const catAccent = cat.color ? categoryAccent[cat.color] : "";
                  return (
                    <DropdownMenuSub key={cat.id}>
                      <DropdownMenuSubTrigger className="gap-2">
                        <CatIcon className={cn("h-4 w-4", catAccent)} />
                        <span>{cat.label}</span>
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="w-64">
                        {cat.items.map((item) => {
                          const ItemIcon = item.icon;
                          return (
                            <DropdownMenuItem key={item.href} asChild>
                              <Link
                                to={item.href}
                                className={cn(
                                  "flex items-center gap-2 cursor-pointer",
                                  isActive(item.href) && "bg-accent font-medium"
                                )}
                              >
                                <ItemIcon className="h-4 w-4 opacity-70" />
                                <span>{item.label}</span>
                              </Link>
                            </DropdownMenuItem>
                          );
                        })}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  );
                })}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {categories.map((category) => {
        const active = category.items.some((i) => isActive(i.href));
        const Icon = category.icon;
        const accent = category.color ? categoryAccent[category.color] : "";
        const badge = category.color ? categoryBadge[category.color] : "";

        return (
          <DropdownMenu key={category.id}>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "inline-flex items-center gap-2 h-9 pl-1.5 pr-3 rounded-md text-sm font-medium transition-colors",
                  "hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active && "bg-accent"
                )}
              >
                <span
                  className={cn(
                    "inline-flex items-center justify-center h-7 w-7 rounded-md ring-1",
                    badge || "bg-accent ring-border"
                  )}
                >
                  <Icon className={cn("h-4 w-4", accent)} />
                </span>
                <span>{category.label}</span>
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuLabel className={cn("flex items-center gap-2", accent)}>
                <Icon className="h-4 w-4" />
                {category.label}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {category.items.map((item) => {
                const ItemIcon = item.icon;
                return (
                  <DropdownMenuItem key={item.href} asChild>
                    <Link
                      to={item.href}
                      className={cn(
                        "flex items-center gap-2 cursor-pointer",
                        isActive(item.href) && "bg-accent font-medium"
                      )}
                    >
                      <ItemIcon className="h-4 w-4 opacity-70" />
                      <span>{item.label}</span>
                    </Link>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      })}
    </nav>
  );
}