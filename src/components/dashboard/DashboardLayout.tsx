import { useState, useEffect, Suspense, useRef, useCallback } from "react";
import { Link, useLocation, Outlet, useNavigate } from "react-router-dom";
import NotificationBell from "@/components/notifications/NotificationBell";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { MaintenanceClinicOverlay } from "@/components/MaintenanceClinicOverlay";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions, Permission } from "@/hooks/usePermissions";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import { useClinicHasUnionEntity } from "@/hooks/useClinicHasUnionEntity";
import { useSessionControl } from "@/hooks/useSessionControl";
import { Loader2 } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { UserMenu } from "@/components/layout/UserMenu";
import prosingeClinicaLogo from "@/assets/modulo-clinica-logo.png";
import { UserAvatar } from "@/components/users/UserAvatar";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AppShell } from "@/components/layout/AppShell";
import { useUnionNavCategories } from "@/components/dashboard/useUnionNavCategories";
import { SINDICATO_CLINIC_ID } from "@/constants/sindicato";
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
  featureKey?: string; // Requires specific plan feature to be active
  highlight?: boolean; // Highlight with badge
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
  // CLÍNICA - Cyan/Teal
  {
    id: "clinica",
    label: "Módulo Clínica",
    icon: HeartPulse,
    color: "clinica",
    items: [
      { href: "/dashboard", icon: LayoutDashboard, label: "Visão Geral", permission: "view_dashboard" },
      { href: "/dashboard/patients", icon: Users, label: "Pacientes", permission: "view_patients", highlight: true },
      { href: "/dashboard/calendar", icon: Calendar, label: "Agenda", permission: "scheduling" },
      { href: "/dashboard/waiting-list", icon: Clock, label: "Lista de Espera", permission: "view_waiting_list" },
      { href: "/dashboard/queue", icon: Monitor, label: "Painel/Totem", permission: "view_queue" },
      { href: "/dashboard/professionals", icon: UserCircle, label: "Profissionais", permission: "view_professionals" },
      { href: "/dashboard/procedures", icon: Stethoscope, label: "Procedimentos", permission: "view_procedures" },
      { href: "/dashboard/exams", icon: FlaskConical, label: "Exames", permission: "view_procedures" },
      { href: "/dashboard/anamnesis", icon: ClipboardList, label: "Anamnese", permission: "view_anamnesis" },
      { href: "/dashboard/anamnesis-templates", icon: FileEdit, label: "Templates Anamnese", permission: "view_anamnesis", featureKey: "dynamic_anamnesis" },
       { href: "/dashboard/anamnesis-dynamic", icon: FilePlus2, label: "Anamnese Dinâmica", permission: "view_anamnesis", featureKey: "dynamic_anamnesis" },
       { href: "/dashboard/medical-records", icon: FileText, label: "Prontuário", permission: "view_medical_records" },
       { href: "/dashboard/whatsapp-atendimento", icon: MessageSquare, label: "Atendimento WhatsApp", permission: "view_dashboard" },
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
      { href: "/dashboard/reports/appointments", icon: Calendar, label: "Relatório Consultas", permission: "view_reports" },
      { href: "/dashboard/marketing", icon: Megaphone, label: "Marketing", permission: "view_marketing" },
      { href: "/dashboard/users", icon: UserCog, label: "Usuários", permission: "manage_users" },
      { href: "/dashboard/holidays", icon: CalendarOff, label: "Feriados", permission: "manage_settings" },
      { href: "/dashboard/subscription", icon: CreditCard, label: "Meu Plano", permission: "manage_subscription" },
      { href: "/dashboard/settings", icon: Settings, label: "Configurações", permission: "change_password" },
    ],
  },
];

const adminNavItems: NavItem[] = [];

export function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Sidebar lateral sempre colapsada; navegação principal é o menu no header
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  // Accordion mode: only keep track of the single open category
  const [openCategories, setOpenCategories] = useState<string[]>([]);
  const autoCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const AUTO_CLOSE_DELAY = 5000; // 5 seconds
  const location = useLocation();
  const { user, profile, currentClinic, userRoles, signOut, setCurrentClinic } = useAuth();
  const { hasPermission, isAdmin, isProfessionalOnly } = usePermissions();
  const { hasAddon, hasFeature } = usePlanFeatures();
  const { hasUnionEntity } = useClinicHasUnionEntity();
  const unionCategories = useUnionNavCategories();

  // Session control - register session on mount and poll for validity
  const { registerSession, deactivateSession } = useSessionControl();
  const sessionRegisteredRef = useRef(false);

  const navigate = useNavigate();

  useEffect(() => {
    if (user?.id && currentClinic?.id && !sessionRegisteredRef.current) {
      sessionRegisteredRef.current = true;
      registerSession(currentClinic.id);
    }
  }, [user?.id, currentClinic?.id, registerSession]);

  useEffect(() => {
    // Redirecionamento automático para Sócios se for clínica Sindicato ao entrar no dashboard
    // RESTRITO APENAS A USUÁRIOS DE GESTÃO (não aplicado a secretárias/médicos da clínica)
    if (location.pathname === "/dashboard" || location.pathname === "/dashboard/") {
      const isUnionClinic = currentClinic?.id === SINDICATO_CLINIC_ID;
      const isManagementUser = !isProfessionalOnly && (userRoles.some(r => r.clinic_id === SINDICATO_CLINIC_ID && (r.role === 'owner' || r.role === 'admin' || r.role === 'administrative')));
      
      if (isUnionClinic && isManagementUser) {
        console.info("[DashboardLayout] Sindicato management user detected, redirecting to /union/socios");
        navigate("/union/socios", { replace: true });
      }
    }
  }, [currentClinic?.id, location.pathname, navigate, isProfessionalOnly, userRoles]);

  useEffect(() => {
    document.title = "Prosinge - Gestão Sindical e Clínica";
  }, []);

  useEffect(() => {
    localStorage.setItem("sidebar-collapsed", "true");
  }, []);

  // No longer persisting open categories - accordion resets on page load

  // Cleanup auto-close timeout on unmount
  useEffect(() => {
    return () => {
      if (autoCloseTimeoutRef.current) {
        clearTimeout(autoCloseTimeoutRef.current);
      }
    };
  }, []);

  // Filter categories based on permissions, addons, and union entity linkage
  const filteredCategories = navCategories
    .filter(category => {
      // Módulo Sindical only appears if the clinic has a linked union entity
      if (category.id === "modulo-sindical" && !hasUnionEntity) return false;
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
        // Check plan feature requirement
        if (item.featureKey && !hasFeature(item.featureKey)) return false;
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
          "flex items-center gap-3 px-3 rounded-lg transition-colors",
          item.highlight ? "py-2.5 text-base" : "py-2 text-sm",
          isActive(item.href)
            ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          sidebarCollapsed && "justify-center px-2",
          isSubItem && !sidebarCollapsed && "ml-6"
        )}
      >
        <item.icon className={cn("shrink-0", item.highlight ? "h-5 w-5" : "h-4 w-4")} />
        {!sidebarCollapsed && (
          <span className={cn("truncate flex items-center gap-2", item.highlight && "font-semibold")}>
            {item.label}
            {item.highlight && (
              <Badge variant="secondary" className="bg-white/20 text-white text-[10px] px-1.5 py-0 h-4">
                Destaque
              </Badge>
            )}
          </span>
        )}
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
              <DropdownMenuItem key={item.href} asChild className={item.highlight ? "py-2.5" : ""}>
                <Link
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-2 cursor-pointer",
                    item.highlight && "text-base font-semibold",
                    isActive(item.href) && "bg-accent"
                  )}
                >
                  <item.icon className={item.highlight ? "h-5 w-5" : "h-4 w-4"} />
                  {item.label}
                  {item.highlight && (
                    <Badge variant="default" className="ml-1 text-[10px] px-1.5 py-0 h-4">
                      Destaque
                    </Badge>
                  )}
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

  const shellSections = [
    ...(filteredCategories.length ? [{ id: "clinic", label: "Clínica", categories: filteredCategories }] : []),
    ...(hasUnionEntity && unionCategories.length ? [{ id: "union", label: "Sindicato", categories: unionCategories }] : []),
  ];

  return (
    <AppShell
      sections={shellSections}
      before={currentClinic?.is_maintenance && !currentClinic?.is_blocked ? (
        <MaintenanceClinicOverlay reason={currentClinic.maintenance_reason} />
      ) : null}
      actions={<><ThemeToggle /><NotificationBell /><UserMenu compact showName={false} /></>}
      footer={<>
        {/* Footer */}
        <footer className="min-h-10 bg-card border-t border-border/80 flex items-center justify-between px-3 sm:px-4 text-xs shrink-0">
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
              href="https://wa.me/557331982161" 
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
      </>}
    >
      <Suspense fallback={
        <div className="flex items-center justify-center h-64" role="status" aria-label="Carregando conteúdo">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
        </div>
      }>
        <Outlet />
      </Suspense>
      <div className="hidden">
      </div>

      {/* Chat Widget */}
      <ChatWidget />
    </div>
  );
}
