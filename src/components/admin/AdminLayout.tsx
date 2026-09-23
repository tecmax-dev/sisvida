import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, Suspense } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/layout/Logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { 
  LayoutDashboard, 
  Building2, 
  Users, 
  LogOut, 
  Shield,
  ChevronRight,
  ScrollText,
  CreditCard,
  Receipt,
  Layers,
  ArrowUpCircle,
  Upload,
  Mail,
  Lock,
  Bell,
  MessageCircle,
  Loader2,
  Image,
  Settings,
  MessageSquare,
  FileCode,
  Youtube,
  BookOpen,
  Sparkles,
  ClipboardList,
  Activity,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const SYSTEM_VERSION = "2026.01.2";

const adminNavItems = [
  { path: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { path: "/admin/clinics", label: "Clínicas", icon: Building2 },
  { path: "/admin/union-entities", label: "Entidades Sindicais", icon: Shield },
  { path: "/admin/users", label: "Usuários", icon: Users },
  { path: "/admin/plans", label: "Planos", icon: CreditCard },
  { path: "/admin/billing", label: "Boletos Assinatura", icon: Receipt },
  { path: "/admin/addons", label: "Add-ons", icon: Sparkles },
  { path: "/admin/features", label: "Recursos", icon: Layers },
  { path: "/admin/access-groups", label: "Grupos de Acesso", icon: Lock },
  { path: "/admin/notifications", label: "Notificações", icon: Bell },
  { path: "/admin/config", label: "Configuração", icon: Settings },
  { path: "/admin/hero", label: "Hero Landing", icon: Image },
  { path: "/admin/banners", label: "Banners Carrossel", icon: Image },
  { path: "/admin/chat", label: "Chat Suporte", icon: MessageCircle },
  { path: "/admin/whatsapp-templates", label: "Templates WhatsApp", icon: FileCode },
  { path: "/admin/whatsapp-status", label: "Status WhatsApp", icon: Sparkles },
  { path: "/admin/whatsapp-audit", label: "Auditoria WhatsApp", icon: ClipboardList },
  { path: "/admin/whatsapp-simulation", label: "Simulação Carteirinha", icon: ClipboardList },
  { path: "/admin/meta-webhook-health", label: "Saúde Webhook Meta", icon: Activity },
  { path: "/admin/upgrades", label: "Upgrades", icon: ArrowUpCircle, hasBadge: true },
  { path: "/admin/addon-requests", label: "Solicitações Add-ons", icon: Sparkles, hasBadge: true },
  { path: "/admin/dependent-approvals", label: "Aprovação Dependentes", icon: Users, hasBadge: true },
  { path: "/admin/import", label: "Importar Dados", icon: Upload },
  { path: "/admin/smtp", label: "Email SMTP", icon: Mail },
  { path: "/admin/audit", label: "Auditoria", icon: ScrollText },
];

// Format clinic ID: year prefix + sequential number
const formatClinicId = (createdAt: string | null | undefined, id: string) => {
  const date = createdAt ? new Date(createdAt) : new Date();
  const year = isNaN(date.getTime()) ? new Date().getFullYear() : date.getFullYear();
  // Use first 8 chars of UUID as numeric-like identifier
  const numericPart = parseInt(id.replace(/-/g, '').substring(0, 8), 16) % 100000000;
  return `${year}${String(numericPart).padStart(8, '0')}`;
};

export function AdminLayout() {
  const { profile, signOut, currentClinic } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [pendingUpgrades, setPendingUpgrades] = useState(0);
  const [pendingAddons, setPendingAddons] = useState(0);
  const [clinicInfo, setClinicInfo] = useState<{ id: string; createdAt: string } | null>(null);

  useEffect(() => {
    fetchPendingUpgrades();
    fetchPendingAddons();
    fetchClinicInfo();
    
    // Subscribe to realtime updates
    const channel = supabase
      .channel('pending-requests')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'upgrade_requests',
        },
        () => {
          fetchPendingUpgrades();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'addon_requests',
        },
        () => {
          fetchPendingAddons();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchPendingUpgrades = async () => {
    const { count } = await supabase
      .from('upgrade_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');
    
    setPendingUpgrades(count || 0);
  };

  const fetchPendingAddons = async () => {
    const { count } = await supabase
      .from('addon_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');
    
    setPendingAddons(count || 0);
  };

  const fetchClinicInfo = async () => {
    if (currentClinic?.id) {
      const { data } = await supabase
        .from('clinics')
        .select('id, created_at')
        .eq('id', currentClinic.id)
        .single();
      
      if (data) {
        setClinicInfo({ id: data.id, createdAt: data.created_at });
      }
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const formattedClinicId = clinicInfo 
    ? formatClinicId(clinicInfo.createdAt, clinicInfo.id)
    : null;

  return (
    <div className="min-h-screen h-[100dvh] flex flex-col bg-background overflow-hidden">
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <aside 
          className="hidden lg:flex w-64 border-r border-sidebar-border bg-sidebar flex-col shadow-lg"
        >
          <div className="p-4 border-b border-sidebar-border">
            <Logo size="sm" />
            <div className="mt-3 flex items-center gap-2 text-xs">
              <Shield className="h-3.5 w-3.5 text-warning" />
              <span className="text-warning font-medium">Super Admin</span>
            </div>
          </div>

          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {adminNavItems.map((item) => {
              const isActive =
                item.path === "/admin"
                  ? location.pathname === "/admin"
                  : location.pathname.startsWith(item.path);

              const showUpgradeBadge = item.path === '/admin/upgrades' && pendingUpgrades > 0;
              const showAddonBadge = item.path === '/admin/addon-requests' && pendingAddons > 0;
              const badgeCount = showUpgradeBadge ? pendingUpgrades : showAddonBadge ? pendingAddons : 0;

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {badgeCount > 0 && (
                    <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-xs">
                      {badgeCount}
                    </Badge>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="p-3 border-t border-sidebar-border space-y-2">
            <Link
              to="/dashboard"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
              Ir para Dashboard
            </Link>

            <div className="px-3 py-2 text-sm">
              <p className="text-sidebar-foreground font-medium truncate">
                {profile?.name || "Admin"}
              </p>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="w-full justify-start text-sidebar-foreground hover:text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {/* Top bar with theme toggle */}
          <header className="sticky top-0 z-30 flex items-center justify-between gap-3 px-3 sm:px-5 lg:px-6 min-h-14 bg-card/95 backdrop-blur-md supports-[backdrop-filter]:bg-card/85 border-b border-border/80 shadow-sm">
            <div className="flex items-center gap-2 lg:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="Abrir navegação administrativa">
                    <Menu className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-72">
                  <DropdownMenuLabel className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    Administração
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {adminNavItems.map((item) => (
                    <DropdownMenuItem key={item.path} asChild>
                      <Link to={item.path} className={cn("flex items-center gap-3", location.pathname === item.path && "bg-accent font-semibold")}>
                        <item.icon className="h-4 w-4 text-muted-foreground" />
                        <span>{item.label}</span>
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Logo size="sm" />
            </div>
            <ThemeToggle />
          </header>
          
          <main className="flex-1 overflow-y-auto px-3 py-4 sm:p-5 lg:p-6">
            <Suspense fallback={
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            }>
              <div className="mx-auto w-full max-w-[1600px] animate-enter">
                <Outlet />
              </div>
            </Suspense>
          </main>
        </div>
      </div>

      {/* Footer */}
      <footer className="min-h-10 bg-card border-t border-border/80 flex items-center justify-between px-3 sm:px-4 text-xs shrink-0">
        <div className="flex items-center gap-4">
          <Logo size="sm" />
          {formattedClinicId && (
            <span className="text-muted-foreground">
              ID <span className="font-semibold text-foreground">{formattedClinicId}</span>
            </span>
          )}
          <span className="text-muted-foreground hidden md:inline">
            © 2026 Prosinge - Todos os Direitos Reservados | VERSÃO <span className="font-semibold text-primary">{SYSTEM_VERSION}</span>
          </span>
        </div>

        <div className="hidden lg:flex items-center gap-4">
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
            href="/docs/getting-started" 
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Primeiros Passos
          </a>
          <a 
            href="/changelog" 
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Novidades
          </a>
        </div>
      </footer>
    </div>
  );
}
