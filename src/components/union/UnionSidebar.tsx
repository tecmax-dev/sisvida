import { useState, useCallback, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useUnionPermissions, UnionPermission } from "@/hooks/useUnionPermissions";
import { cn } from "@/lib/utils";
import {
  Building2,
  Users,
  Receipt,
  DollarSign,
  Handshake,
  FileText,
  ClipboardList,
  Wallet,
  Building,
  TrendingUp,
  ArrowLeftRight,
  ChevronDown,
  ChevronRight,
  Home,
  Gift,
  FileBarChart,
  History,
  ScrollText,
  UserPlus,
  Scale,
  Calendar,
  UserCircle,
  CalendarX,
  Settings,
  FolderTree,
  FileCheck2,
  HeartPulse,
  Smartphone,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface NavItem {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  permission?: UnionPermission;
}

interface NavCategory {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
  color: string;
}

const categoryColors: Record<string, { bg: string; text: string; border: string; accent: string }> = {
  empresas: {
    bg: "bg-amber-500/20",
    text: "text-amber-200",
    border: "border-amber-400/30",
    accent: "bg-amber-500/30"
  },
  socios: {
    bg: "bg-violet-500/20",
    text: "text-violet-200",
    border: "border-violet-400/30",
    accent: "bg-violet-500/30"
  },
  contribuicoes: {
    bg: "bg-emerald-500/20",
    text: "text-emerald-200",
    border: "border-emerald-400/30",
    accent: "bg-emerald-500/30"
  },
  financeiro: {
    bg: "bg-blue-500/20",
    text: "text-blue-200",
    border: "border-blue-400/30",
    accent: "bg-blue-500/30"
  },
  negociacoes: {
    bg: "bg-purple-500/20",
    text: "text-purple-200",
    border: "border-purple-400/30",
    accent: "bg-purple-500/30"
  },
  homologacao: {
    bg: "bg-teal-500/20",
    text: "text-teal-200",
    border: "border-teal-400/30",
    accent: "bg-teal-500/30"
  },
  conteudoapp: {
    bg: "bg-pink-500/20",
    text: "text-pink-200",
    border: "border-pink-400/30",
    accent: "bg-pink-500/30"
  },
  juridico: {
    bg: "bg-indigo-500/20",
    text: "text-indigo-200",
    border: "border-indigo-400/30",
    accent: "bg-indigo-500/30"
  }
};

const unionNavTree: NavCategory[] = [
  {
    id: "empresas",
    label: "Empresas",
    icon: Building2,
    color: "empresas",
    items: [
      { href: "/union/empresas", icon: Building2, label: "Cadastro", permission: "union_view_employers" },
      { href: "/union/escritorios", icon: Building, label: "Escritórios", permission: "union_view_employers" },
      { href: "/union/planos", icon: ScrollText, label: "Planos", permission: "union_module_access" },
    ]
  },
  {
    id: "socios",
    label: "Sócios",
    icon: Users,
    color: "socios",
    items: [
      { href: "/union/socios", icon: Users, label: "Gestão de Sócios", permission: "union_view_members" },
      { href: "/union/beneficios", icon: Gift, label: "Benefícios", permission: "union_view_members" },
      { href: "/union/autorizacoes", icon: FileCheck2, label: "Autorizações", permission: "union_view_members" },
      { href: "/union/associados", icon: UserPlus, label: "Filiações Públicas", permission: "union_view_members" },
      { href: "/union/filiacoes", icon: ClipboardList, label: "Aprovação de Filiações", permission: "union_view_members" },
    ]
  },
  {
    id: "contribuicoes",
    label: "Contribuições",
    icon: Receipt,
    color: "contribuicoes",
    items: [
      { href: "/union/contribuicoes", icon: Receipt, label: "Gerenciamento", permission: "union_view_contributions" },
      { href: "/union/contribuicoes/relatorios", icon: FileBarChart, label: "Relatórios", permission: "union_view_contribution_reports" },
    ]
  },
  {
    id: "financeiro",
    label: "Financeiro",
    icon: DollarSign,
    color: "financeiro",
    items: [
      { href: "/union/financeiro", icon: Home, label: "Visão Geral", permission: "union_view_financials" },
      { href: "/union/financeiro/orcamento", icon: FileBarChart, label: "Previsão Orçamentária", permission: "union_view_financials" },
      { href: "/union/financeiro/despesas", icon: TrendingUp, label: "Despesas", permission: "union_view_expenses" },
      { href: "/union/financeiro/receitas", icon: TrendingUp, label: "Receitas", permission: "union_view_income" },
      { href: "/union/financeiro/movimentacao", icon: FileText, label: "Movimentação", permission: "union_view_cash_flow" },
      { href: "/union/financeiro/fluxo-caixa", icon: ArrowLeftRight, label: "Fluxo de Caixa", permission: "union_view_cash_flow" },
      { href: "/union/financeiro/contas", icon: Wallet, label: "Contas Bancárias", permission: "union_manage_cash_registers" },
      { href: "/union/financeiro/fornecedores", icon: Building, label: "Fornecedores", permission: "union_manage_suppliers" },
      { href: "/union/financeiro/categorias", icon: ClipboardList, label: "Categorias", permission: "union_manage_categories" },
      { href: "/union/financeiro/plano-contas", icon: FolderTree, label: "Plano de Contas", permission: "union_manage_categories" },
      { href: "/union/financeiro/historico-pagamentos", icon: History, label: "Histórico Pagamentos", permission: "union_view_financials" },
      { href: "/union/financeiro/conciliacao", icon: FileBarChart, label: "Conciliação Lytex", permission: "union_view_financials" },
      { href: "/union/financeiro/conciliacao-bancaria", icon: FileCheck2, label: "Conciliação Bancária", permission: "union_view_financials" },
      { href: "/union/financeiro/relatorios-lytex", icon: FileBarChart, label: "Relatórios Lytex", permission: "union_generate_reports" },
      { href: "/union/financeiro/relatorios", icon: FileBarChart, label: "Relatórios", permission: "union_generate_reports" },
    ]
  },
  {
    id: "negociacoes",
    label: "Negociações",
    icon: Handshake,
    color: "negociacoes",
    items: [
      { href: "/union/negociacoes", icon: Handshake, label: "Acordos", permission: "union_view_negotiations" },
      { href: "/union/negociacoes/parcelamentos", icon: ScrollText, label: "Parcelamentos", permission: "union_view_installments" },
      { href: "/union/negociacoes/historico", icon: History, label: "Histórico", permission: "union_view_negotiations" },
    ]
  },
  {
    id: "homologacao",
    label: "Homologação",
    icon: Scale,
    color: "homologacao",
    items: [
      { href: "/union/homologacao", icon: Calendar, label: "Agenda", permission: "union_module_access" },
      { href: "/union/homologacao/profissionais", icon: UserCircle, label: "Profissionais", permission: "union_module_access" },
      { href: "/union/homologacao/servicos", icon: ClipboardList, label: "Serviços", permission: "union_module_access" },
      { href: "/union/homologacao/bloqueios", icon: CalendarX, label: "Bloqueios", permission: "union_module_access" },
      { href: "/union/homologacao/config", icon: Settings, label: "Configurações", permission: "union_module_access" },
    ]
  },
  {
    id: "conteudoapp",
    label: "Gestão de Conteúdo",
    icon: Smartphone,
    color: "conteudoapp",
    items: [
      { href: "/union/conteudo-app", icon: Smartphone, label: "Conteúdo do App", permission: "union_module_access" },
    ]
  },
  {
    id: "juridico",
    label: "Jurídico",
    icon: Scale,
    color: "juridico",
    items: [
      { href: "/union/juridico", icon: Scale, label: "Dashboard", permission: "union_module_access" },
      { href: "/union/juridico/casos", icon: FileText, label: "Processos", permission: "union_module_access" },
      { href: "/union/juridico/advogados", icon: Users, label: "Advogados", permission: "union_module_access" },
      { href: "/union/juridico/escritorios", icon: Building, label: "Escritórios", permission: "union_module_access" },
      { href: "/union/juridico/prazos", icon: Calendar, label: "Prazos", permission: "union_module_access" },
      { href: "/union/juridico/despesas", icon: DollarSign, label: "Despesas", permission: "union_module_access" },
    ]
  },
  {
    id: "configuracoes",
    label: "Configurações",
    icon: Settings,
    color: "homologacao",
    items: [
      { href: "/union/configuracoes", icon: Settings, label: "Geral", permission: "union_module_access" },
    ]
  }
];

export function UnionSidebar() {
  const location = useLocation();
  const { hasUnionPermission } = useUnionPermissions();
  const [openCategories, setOpenCategories] = useState<string[]>([]);

  const filteredCategories = unionNavTree
    .map(category => ({
      ...category,
      items: category.items.filter(item => 
        !item.permission || hasUnionPermission(item.permission)
      )
    }))
    .filter(category => category.items.length > 0);

  const isActive = (href: string) => {
    if (href === "/union") {
      return location.pathname === "/union";
    }
    return location.pathname.startsWith(href);
  };

  const isCategoryActive = (category: NavCategory) => {
    return category.items.some(item => isActive(item.href));
  };

  // Auto-expand category containing active route on navigation
  useEffect(() => {
    const activeCategories = filteredCategories
      .filter(cat => cat.items.some(item => isActive(item.href)))
      .map(cat => cat.id);
    
    if (activeCategories.length > 0) {
      setOpenCategories(prev => {
        const newCategories = [...new Set([...prev, ...activeCategories])];
        return newCategories;
      });
    }
  }, [location.pathname]);

  const toggleCategory = useCallback((categoryId: string) => {
    setOpenCategories(prev => {
      if (prev.includes(categoryId)) {
        return prev.filter(id => id !== categoryId);
      } else {
        return [...prev, categoryId];
      }
    });
  }, []);

  return (
    <nav className="flex-1 px-3 py-4 space-y-2 overflow-y-auto">
      {/* Dashboard link */}
      <Link
        to="/union"
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
          location.pathname === "/union"
            ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )}
      >
        <Home className="h-4 w-4 shrink-0" />
        <span>Dashboard</span>
      </Link>

      {/* Categories */}
      {filteredCategories.map((category) => {
        const isOpen = openCategories.includes(category.id);
        const hasActiveItem = isCategoryActive(category);
        const colors = categoryColors[category.color];

        return (
          <Collapsible 
            key={category.id} 
            open={isOpen} 
            onOpenChange={() => toggleCategory(category.id)}
          >
            <CollapsibleTrigger asChild>
              <button
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all duration-200 group",
                  colors?.border,
                  hasActiveItem || isOpen
                    ? cn(colors?.bg, colors?.text, "font-medium border-l-2")
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50 border-l-2 border-transparent"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-7 h-7 rounded-md flex items-center justify-center transition-colors",
                    hasActiveItem || isOpen
                      ? colors?.accent
                      : "bg-sidebar-accent"
                  )}>
                    <category.icon className="h-4 w-4 shrink-0" />
                  </div>
                  <span className="font-medium">{category.label}</span>
                </div>
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 text-sidebar-foreground/60 transition-transform" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-sidebar-foreground/60 transition-transform" />
                )}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="collapsible-content mt-1">
              <div className={cn("space-y-0.5 ml-4 pl-3 border-l", colors?.border || "border-sidebar-border")}>
                {category.items.map((item) => (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ml-3",
                      isActive(item.href)
                        ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}

      {/* Quick access card - Módulo Clínica */}
      <div className="mt-4 pt-4 border-t border-sidebar-border/50">
        <Link
          to="/dashboard"
          className={cn(
            "flex items-center gap-3 px-3 py-3 rounded-lg text-sm transition-all duration-200",
            "bg-gradient-to-r from-cyan-500/20 to-emerald-500/20 hover:from-cyan-500/30 hover:to-emerald-500/30",
            "border border-cyan-400/30 text-cyan-100 hover:text-white"
          )}
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center shadow-sm">
            <HeartPulse className="h-4 w-4 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="font-medium">Módulo Clínica</span>
            <span className="text-xs text-cyan-200/70">Acesso rápido</span>
          </div>
        </Link>
      </div>
    </nav>
  );
}
