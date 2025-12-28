import { useState, useEffect, Suspense } from "react";
import { Link, useLocation, Outlet } from "react-router-dom";
import NotificationBell from "@/components/notifications/NotificationBell";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { MaintenanceBanner } from "@/components/MaintenanceBanner";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions, Permission } from "@/hooks/usePermissions";
import { Loader2 } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import ecliniDashboardLogo from "@/assets/eclini-dashboard-logo.png";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  Bell,
  CreditCard,
  ChevronDown,
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
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  permission?: Permission;
}

const navItems: NavItem[] = [
  { href: "/dashboard", icon: Home, label: "Visão Geral", permission: "view_dashboard" },
  { href: "/dashboard/calendar", icon: Calendar, label: "Agenda", permission: "scheduling" },
  { href: "/dashboard/patients", icon: Users, label: "Pacientes", permission: "view_patients" },
  { href: "/dashboard/professionals", icon: UserCircle, label: "Profissionais", permission: "view_professionals" },
  { href: "/dashboard/medical-records", icon: FileText, label: "Prontuário", permission: "view_medical_records" },
  { href: "/dashboard/anamnesis", icon: ClipboardList, label: "Anamnese", permission: "view_anamnesis" },
  { href: "/dashboard/anamnesis-dynamic", icon: FilePlus2, label: "Anamnese Dinâmica", permission: "anamnesis_forms" },
  { href: "/dashboard/anamnesis-templates", icon: FileEdit, label: "Templates de Anamnese", permission: "manage_anamnesis_templates" },
  { href: "/dashboard/waiting-list", icon: Clock, label: "Lista de Espera", permission: "view_waiting_list" },
  { href: "/dashboard/insurance", icon: CreditCard, label: "Convênios", permission: "insurance_plans" },
  { href: "/dashboard/procedures", icon: Stethoscope, label: "Procedimentos", permission: "view_procedures" },
  { href: "/dashboard/catalog", icon: ShoppingBag, label: "Catálogo", permission: "view_catalog" },
  { href: "/dashboard/quotes", icon: FileSpreadsheet, label: "Orçamentos", permission: "view_budgets" },
  { href: "/dashboard/packages", icon: Package, label: "Pacotes", permission: "view_packages" },
  { href: "/dashboard/stock", icon: Warehouse, label: "Estoque", permission: "view_stock" },
  { href: "/dashboard/financials", icon: DollarSign, label: "Financeiro", permission: "view_financials" },
  { href: "/dashboard/repass", icon: Percent, label: "Repasse Médico", permission: "view_repass" },
  { href: "/dashboard/queue", icon: Monitor, label: "Painel/Totem", permission: "view_queue" },
  { href: "/dashboard/marketing", icon: Megaphone, label: "Marketing", permission: "view_marketing" },
  { href: "/dashboard/tiss", icon: FileCheck2, label: "TISS", permission: "view_tiss" },
  { href: "/dashboard/reports", icon: BarChart3, label: "Relatórios", permission: "view_reports" },
  { href: "/dashboard/subscription", icon: CreditCard, label: "Meu Plano", permission: "manage_subscription" },
  // Intencionalmente sem permission aqui: o controle fino fica dentro da página
  // (ex.: usuários sem manage_settings podem entrar só para alterar a própria senha)
  { href: "/dashboard/settings", icon: Settings, label: "Configurações" },
];

const adminNavItems: NavItem[] = [
  { href: "/dashboard/users", icon: UserCog, label: "Usuários", permission: "manage_users" },
];

export function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("sidebar-collapsed") === "true";
    }
    return false;
  });
  const location = useLocation();
  const { user, profile, currentClinic, userRoles, signOut, setCurrentClinic } = useAuth();
  const { hasPermission, isAdmin } = usePermissions();

  useEffect(() => {
    localStorage.setItem("sidebar-collapsed", String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  // Filter navigation items based on permissions
  const filteredNavItems = navItems.filter((item) =>
    !item.permission || hasPermission(item.permission)
  );

  const filteredAdminNavItems = adminNavItems.filter((item) =>
    !item.permission || hasPermission(item.permission)
  );

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return location.pathname === "/dashboard";
    }
    return location.pathname.startsWith(href);
  };

  const displayName = profile?.name || user?.user_metadata?.name || "Usuário";

  const NavItemLink = ({ item }: { item: NavItem }) => {
    const linkContent = (
      <Link
        to={item.href}
        onClick={() => setSidebarOpen(false)}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
          isActive(item.href)
            ? "bg-sidebar-primary text-sidebar-primary-foreground"
            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          sidebarCollapsed && "justify-center px-2"
        )}
      >
        <item.icon className="h-5 w-5 shrink-0" />
        {!sidebarCollapsed && item.label}
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
          "fixed inset-y-0 left-0 z-50 bg-sidebar border-r border-sidebar-border shadow-sm transform transition-all duration-300 lg:translate-x-0 lg:static",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
          sidebarCollapsed ? "w-16" : "w-64"
        )}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
            {!sidebarCollapsed && <Logo size="md" customSrc={ecliniDashboardLogo} />}
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
              className="lg:hidden text-sidebar-foreground hover:bg-sidebar-accent"
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

          <nav className={cn("flex-1 p-4 space-y-1 overflow-y-auto", sidebarCollapsed && "p-2")}>
            {filteredNavItems.map((item) => (
              <NavItemLink key={item.href} item={item} />
            ))}
            
            {/* Admin only navigation items */}
            {isAdmin && filteredAdminNavItems.map((item) => (
              <NavItemLink key={item.href} item={item} />
            ))}
          </nav>

          <div className={cn("p-4 border-t border-sidebar-border bg-sidebar-accent/30", sidebarCollapsed && "p-2")}>
            {!sidebarCollapsed && (
              <div className="flex items-center gap-3 mb-4 px-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center ring-2 ring-primary/20">
                  <span className="text-sm font-medium text-primary-foreground">
                    {displayName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {displayName}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
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
        {/* Maintenance Banner */}
        {currentClinic?.is_blocked && (
          <MaintenanceBanner reason={currentClinic.blocked_reason} />
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
                : filteredNavItems.find(item => location.pathname.startsWith(item.href) && item.href !== "/dashboard")?.label || ""}
            </span>
          </div>

          <div className="flex-1" />

          <NotificationBell />
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6">
          <Suspense fallback={
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          }>
            <Outlet />
          </Suspense>
        </main>
      </div>

      {/* Chat Widget */}
      <ChatWidget />
    </div>
  );
}
