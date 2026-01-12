import { useState, useEffect, Suspense, useRef, useCallback } from "react";
import { Link, useLocation, Outlet } from "react-router-dom";
import NotificationBell from "@/components/notifications/NotificationBell";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { MaintenanceClinicOverlay } from "@/components/MaintenanceClinicOverlay";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions, Permission } from "@/hooks/usePermissions";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import { Loader2 } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { UserMenu } from "@/components/layout/UserMenu";
import ecliniDashboardLogo from "@/assets/eclini-dashboard-logo.png";
import { UserAvatar } from "@/components/users/UserAvatar";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Calendar,
  Users,
  UserCircle,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Home,
  CreditCard,
  ChevronDown,
  ChevronRight,
  FileText,
  ClipboardList,
  Clock,
  UserCog,
  FileEdit,
  FilePlus2,
  DollarSign,
  Stethoscope,
  PanelLeftClose,
  Package,
  PanelLeft,
  Warehouse,
  ShoppingBag,
  FileSpreadsheet,
  Percent,
  Monitor,
  Megaphone,
  FileCheck2,
  CalendarOff,
  CalendarX,
  Image,
  FlaskConical,
  Building2,
  HeartPulse,
  Briefcase,
  Receipt,
  LayoutDashboard,
  MessageSquare,
  Youtube,
  BookOpen,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const SYSTEM_VERSION = "2026.01.2";

// Format clinic ID: year prefix + sequential number
const formatClinicId = (createdAt: string | null | undefined, id: string) => {
  const date = createdAt ? new Date(createdAt) : new Date();
  const year = isNaN(date.getTime()) ? new Date().getFullYear() : date.getFullYear();
  // Use first 8 chars of UUID as numeric-like identifier
  const numericPart = parseInt(id.replace(/-/g, '').substring(0, 8), 16) % 100000000;
  return `${year}${String(numericPart).padStart(8, '0')}`;
};
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  permission?: Permission;
  addonKey?: string; // Requires specific addon to be active
}

interface NavCategory {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
  color?: string; // Tailwind color class for parent category
  addonKey?: string; // Requires specific addon to show entire category
}

// Category color mapping for visual distinction
const categoryColors: Record<string, { bg: string; text: string; border: string; accent: string }> = {
  empresas: {
    bg: "bg-amber-500/20",
    text: "text-amber-200",
    border: "border-amber-400/30",
    accent: "bg-amber-500/30"
  },
  socios: {
    bg: "bg-purple-500/20",
    text: "text-purple-200",
    border: "border-purple-400/30",
    accent: "bg-purple-500/30"
  },
  clinica: {
    bg: "bg-cyan-500/20",
    text: "text-cyan-200",
    border: "border-cyan-400/30",
    accent: "bg-cyan-500/30"
  },
  admin: {
    bg: "bg-rose-500/20",
    text: "text-rose-200",
    border: "border-rose-400/30",
    accent: "bg-rose-500/30"
  }
};

const navCategories: NavCategory[] = [
  // CLÍNICA - Cyan/Teal (moved to top, Módulo Sindical moved to bottom and controlled by union_module_access)
  {
    id: "clinica",
    label: "Clínica",
    icon: HeartPulse,
    color: "clinica",
    items: [
      { href: "/dashboard", icon: LayoutDashboard, label: "Visão Geral", permission: "view_dashboard" },
      { href: "/dashboard/calendar", icon: Calendar, label: "Agenda", permission: "scheduling" },
      { href: "/dashboard/waiting-list", icon: Clock, label: "Lista de Espera", permission: "view_waiting_list" },
      { href: "/dashboard/queue", icon: Monitor, label: "Painel/Totem", permission: "view_queue" },
      { href: "/dashboard/professionals", icon: UserCircle, label: "Profissionais", permission: "view_professionals" },
      { href: "/dashboard/procedures", icon: Stethoscope, label: "Procedimentos", permission: "view_procedures" },
      { href: "/dashboard/exams", icon: FlaskConical, label: "Exames", permission: "view_procedures" },
      { href: "/dashboard/anamnesis", icon: ClipboardList, label: "Anamnese", permission: "view_anamnesis" },
      { href: "/dashboard/medical-records", icon: FileText, label: "Prontuário", permission: "view_medical_records" },
      { href: "/dashboard/patients", icon: Users, label: "Pacientes", permission: "view_patients" },
    ],
  },
  // ADMINISTRATIVO - Rose/Pink
  {
    id: "admin",
    label: "Administrativo",
    icon: Settings,
    color: "admin",
    items: [
      { href: "/dashboard/financials", icon: DollarSign, label: "Financeiro Clínica", permission: "view_financials" },
      { href: "/dashboard/repass", icon: Percent, label: "Repasse Médico", permission: "view_repass" },
      { href: "/dashboard/stock", icon: Warehouse, label: "Estoque", permission: "view_stock" },
      { href: "/dashboard/insurance", icon: CreditCard, label: "Convênios", permission: "insurance_plans" },
      { href: "/dashboard/reports", icon: BarChart3, label: "Relatórios", permission: "view_reports" },
      { href: "/dashboard/marketing", icon: Megaphone, label: "Marketing", permission: "view_marketing" },
      { href: "/dashboard/users", icon: UserCog, label: "Usuários", permission: "manage_users" },
      { href: "/dashboard/holidays", icon: CalendarOff, label: "Feriados", permission: "manage_settings" },
      { href: "/dashboard/subscription", icon: CreditCard, label: "Meu Plano", permission: "manage_subscription" },
      { href: "/dashboard/settings", icon: Settings, label: "Configurações", permission: "change_password" },
    ],
  },
  // MÓDULO SINDICAL - Visível apenas para contas com permissão union_module_access
  {
    id: "modulo-sindical",
    label: "Módulo Sindical",
    icon: Building2,
    color: "empresas",
    items: [
      { href: "/union", icon: Building2, label: "Acessar Módulo Sindical", permission: "union_module_access" as Permission },
    ],
  },
];

const adminNavItems: NavItem[] = [];

export function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("sidebar-collapsed") === "true";
    }
    return false;
  });
  // Accordion mode: only keep track of the single open category
  const [openCategories, setOpenCategories] = useState<string[]>([]);
  const autoCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const AUTO_CLOSE_DELAY = 5000; // 5 seconds
  const location = useLocation();
  const { user, profile, currentClinic, userRoles, signOut, setCurrentClinic } = useAuth();
  const { hasPermission, isAdmin } = usePermissions();
  const { hasAddon } = usePlanFeatures();

  useEffect(() => {
    localStorage.setItem("sidebar-collapsed", String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  // No longer persisting open categories - accordion resets on page load

  // Cleanup auto-close timeout on unmount
  useEffect(() => {
    return () => {
      if (autoCloseTimeoutRef.current) {
        clearTimeout(autoCloseTimeoutRef.current);
      }
    };
  }, []);

  // Filter categories based on permissions and addons
  const filteredCategories = navCategories
    .filter(category => {
      // If category has addonKey requirement, check addon first
      if (category.addonKey && !hasAddon(category.addonKey)) return false;
      return true;
    })
    .map(category => ({
      ...category,
      items: category.items.filter(item => {
        // Check permission
        if (item.permission && !hasPermission(item.permission)) return false;
        // Check addon requirement
        if (item.addonKey && !hasAddon(item.addonKey)) return false;
        return true;
      })
    }))
    .filter(category => category.items.length > 0);

  const filteredAdminNavItems = adminNavItems.filter((item) =>
    !item.permission || hasPermission(item.permission)
  );

  // Flatten items for breadcrumb
  const allNavItems = filteredCategories.flatMap(cat => cat.items);

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return location.pathname === "/dashboard";
    }
    return location.pathname.startsWith(href);
  };

  const isCategoryActive = (category: NavCategory) => {
    return category.items.some(item => isActive(item.href));
  };

  const toggleCategory = useCallback((categoryId: string) => {
    // Clear any existing auto-close timeout
    if (autoCloseTimeoutRef.current) {
      clearTimeout(autoCloseTimeoutRef.current);
      autoCloseTimeoutRef.current = null;
    }

    setOpenCategories(prev => {
      const isOpening = !prev.includes(categoryId);
      
      // Accordion effect: only one category open at a time
      if (isOpening) {
        // Set auto-close timeout when opening a category
        autoCloseTimeoutRef.current = setTimeout(() => {
          setOpenCategories(current => 
            current.filter(id => id !== categoryId)
          );
        }, AUTO_CLOSE_DELAY);
        
        return [categoryId]; // Close all others, open only this one
      }
      
      return []; // Close if clicking the same open category
    });
  }, []);

  const displayName = profile?.name || user?.user_metadata?.name || "Usuário";

  const NavItemLink = ({ item, isSubItem = false }: { item: NavItem; isSubItem?: boolean }) => {
    const linkContent = (
      <Link
        to={item.href}
        onClick={() => setSidebarOpen(false)}
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
          isActive(item.href)
            ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          sidebarCollapsed && "justify-center px-2",
          isSubItem && !sidebarCollapsed && "ml-6"
        )}
      >
        <item.icon className="h-4 w-4 shrink-0" />
        {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
      </Link>
    );

    if (sidebarCollapsed) {
      return (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
          <TooltipContent side="right" className="font-medium">
            {item.label}
          </TooltipContent>
        </Tooltip>
      );
    }

    return linkContent;
  };

  const CategoryGroup = ({ category }: { category: NavCategory }) => {
    const isOpen = openCategories.includes(category.id);
    const hasActiveItem = isCategoryActive(category);
    const isSingleItem = category.items.length === 1;
    const colors = category.color ? categoryColors[category.color] : null;

    // For single item categories, render just the link
    if (isSingleItem) {
      return <NavItemLink item={category.items[0]} />;
    }

    if (sidebarCollapsed) {
      return (
        <DropdownMenu>
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "w-full flex items-center justify-center p-2 rounded-lg transition-colors",
                    hasActiveItem
                      ? colors?.accent || "bg-sidebar-primary/20"
                      : "text-sidebar-foreground hover:bg-sidebar-accent",
                    colors?.text
                  )}
                >
                  <category.icon className="h-5 w-5" />
                </button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="right">{category.label}</TooltipContent>
          </Tooltip>
          <DropdownMenuContent side="right" align="start" className="min-w-48">
            {category.items.map((item) => (
              <DropdownMenuItem key={item.href} asChild>
                <Link
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-2 cursor-pointer",
                    isActive(item.href) && "bg-accent"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }

    return (
      <Collapsible open={isOpen} onOpenChange={() => toggleCategory(category.id)}>
        <CollapsibleTrigger asChild>
          <button
            className={cn(
              "w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all duration-200 group",
              colors?.border,
              hasActiveItem || isOpen
                ? cn(colors?.bg || "bg-sidebar-accent", colors?.text || "text-sidebar-accent-foreground", "font-medium border-l-2")
                : cn("text-sidebar-foreground hover:bg-sidebar-accent/50 border-l-2 border-transparent")
            )}
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-7 h-7 rounded-md flex items-center justify-center transition-colors",
                hasActiveItem || isOpen
                  ? colors?.accent || "bg-sidebar-primary/20"
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
          <div className={cn("collapsible-inner space-y-0.5 ml-4 pl-3 border-l", colors?.border || "border-sidebar-border")}>
            {category.items.map((item) => (
              <NavItemLink key={item.href} item={item} isSubItem />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 border-r border-sidebar-border shadow-sm transform transition-all duration-300 lg:translate-x-0 lg:static",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
          sidebarCollapsed ? "w-16" : "w-64"
        )}
        style={{
          background: 'linear-gradient(180deg, hsl(200 85% 38%) 0%, hsl(175 70% 36%) 45%, hsl(145 55% 40%) 100%)'
        }}
      >
        <div className="flex flex-col h-full">
          {/* Header com fundo escuro para melhor contraste da logo */}
          <div 
            className="flex items-center justify-center p-4 border-b border-sidebar-border relative"
            style={{
              background: 'linear-gradient(180deg, hsl(210 50% 20%) 0%, hsl(200 60% 25%) 100%)'
            }}
          >
            {!sidebarCollapsed && (
              <div className="flex-1 flex justify-center">
                <Logo size="md" customSrc={ecliniDashboardLogo} />
              </div>
            )}
            {sidebarCollapsed && (
              <div className="w-full flex justify-center">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center shadow-sm">
                  <span className="text-primary-foreground font-bold text-sm">E</span>
                </div>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden text-sidebar-foreground hover:bg-sidebar-accent absolute right-2 top-1/2 -translate-y-1/2"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Collapse Toggle Button - Desktop only */}
          <div className="hidden lg:flex justify-end px-2 py-2 border-b border-sidebar-border">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            >
              {sidebarCollapsed ? (
                <PanelLeft className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Clinic Selector */}
          {userRoles.length > 0 && currentClinic && !sidebarCollapsed && (
            <div className="p-4 border-b border-sidebar-border">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-sidebar-accent hover:bg-sidebar-accent/80 transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-sidebar-primary/20 flex items-center justify-center">
                        <span className="text-xs font-semibold text-sidebar-primary">
                          {currentClinic.name.charAt(0)}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-sidebar-foreground truncate">
                        {currentClinic.name}
                      </span>
                    </div>
                    <ChevronDown className="h-4 w-4 text-sidebar-foreground/60 shrink-0" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  {userRoles.map((role) => (
                    <DropdownMenuItem
                      key={role.clinic_id}
                      onClick={() => setCurrentClinic(role.clinic)}
                      className={cn(
                        currentClinic.id === role.clinic_id && "bg-accent"
                      )}
                    >
                      {role.clinic.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          {/* Collapsed Clinic Icon */}
          {userRoles.length > 0 && currentClinic && sidebarCollapsed && (
            <div className="p-2 border-b border-sidebar-border flex justify-center">
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <div className="w-10 h-10 rounded-lg bg-sidebar-accent flex items-center justify-center cursor-default">
                    <span className="text-sm font-semibold text-sidebar-foreground">
                      {currentClinic.name.charAt(0)}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">{currentClinic.name}</TooltipContent>
              </Tooltip>
            </div>
          )}

          <nav className={cn("flex-1 p-3 space-y-1 overflow-y-auto", sidebarCollapsed && "p-2 space-y-2")}>
            {filteredCategories.map((category) => (
              <CategoryGroup key={category.id} category={category} />
            ))}
            
            {/* Admin only navigation items */}
            {isAdmin && filteredAdminNavItems.length > 0 && (
              <div className={cn("pt-2 mt-2 border-t border-sidebar-border", sidebarCollapsed && "pt-1 mt-1")}>
                {filteredAdminNavItems.map((item) => (
                  <NavItemLink key={item.href} item={item} />
                ))}
              </div>
            )}
          </nav>

          <div className={cn("p-4 border-t border-sidebar-border bg-sidebar-accent/30", sidebarCollapsed && "p-2")}>
            {!sidebarCollapsed && (
              <div className="flex items-center gap-3 mb-4 px-3">
                <UserAvatar 
                  avatarUrl={profile?.avatar_url} 
                  name={displayName} 
                  size="md"
                  className="ring-2 ring-primary/20"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-sidebar-foreground truncate">
                    {displayName}
                  </p>
                  <p className="text-xs text-sidebar-foreground/70 truncate">
                    {user?.email}
                  </p>
                </div>
              </div>
            )}
            
            {sidebarCollapsed ? (
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-full text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    onClick={signOut}
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Sair</TooltipContent>
              </Tooltip>
            ) : (
              <Button
                variant="ghost"
                className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                onClick={signOut}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sair
              </Button>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Maintenance Overlay - blocks access when in maintenance mode */}
        {currentClinic?.is_maintenance && !currentClinic?.is_blocked && (
          <MaintenanceClinicOverlay reason={currentClinic.maintenance_reason} />
        )}
        
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center gap-4 px-4 lg:px-6 h-14 bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/80 border-b border-border/50">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>

          {/* Breadcrumb / Page indicator */}
          <div className="hidden md:flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Dashboard</span>
            <span className="text-muted-foreground/50">/</span>
            <span className="font-medium text-foreground">
              {location.pathname === "/dashboard" 
                ? "Visão Geral" 
                : allNavItems.find(item => location.pathname.startsWith(item.href) && item.href !== "/dashboard")?.label || ""}
            </span>
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-2">
            <NotificationBell />
            <UserMenu compact showName={false} />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6 pb-16">
          <Suspense fallback={
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          }>
            <Outlet />
          </Suspense>
        </main>

        {/* Footer */}
        <footer className="h-10 bg-muted/50 border-t border-border flex items-center justify-between px-4 text-xs shrink-0">
          <div className="flex items-center gap-4">
            <Logo size="sm" />
            {currentClinic && (
              <span className="text-muted-foreground">
                ID <span className="font-semibold text-foreground">{formatClinicId(currentClinic.created_at, currentClinic.id)}</span>
              </span>
            )}
            <span className="text-muted-foreground hidden sm:inline">
              VERSÃO <span className="font-semibold text-primary">{SYSTEM_VERSION}</span>
            </span>
          </div>

          <div className="hidden md:flex items-center gap-4">
            <a 
              href="https://wa.me/5500000000000" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Fale Conosco
            </a>
            <a 
              href="https://youtube.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Youtube className="h-3.5 w-3.5" />
              YouTube
            </a>
            <a 
              href="/ajuda" 
              className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <BookOpen className="h-3.5 w-3.5" />
              Ajuda
            </a>
          </div>
        </footer>
      </div>

      {/* Chat Widget */}
      <ChatWidget />
    </div>
  );
}
