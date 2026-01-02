import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, Suspense } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/layout/Logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  LayoutDashboard, 
  Building2, 
  Users, 
  LogOut, 
  Shield,
  ChevronRight,
  ScrollText,
  CreditCard,
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
  Youtube,
  BookOpen,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

const SYSTEM_VERSION = "2026.01.2";

const adminNavItems = [
  { path: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { path: "/admin/clinics", label: "Clínicas", icon: Building2 },
  { path: "/admin/users", label: "Usuários", icon: Users },
  { path: "/admin/plans", label: "Planos", icon: CreditCard },
  { path: "/admin/features", label: "Recursos", icon: Layers },
  { path: "/admin/access-groups", label: "Grupos de Acesso", icon: Lock },
  { path: "/admin/notifications", label: "Notificações", icon: Bell },
  { path: "/admin/config", label: "Configuração", icon: Settings },
  { path: "/admin/hero", label: "Hero Landing", icon: Image },
  { path: "/admin/banners", label: "Banners Carrossel", icon: Image },
  { path: "/admin/chat", label: "Chat Suporte", icon: MessageCircle },
  { path: "/admin/upgrades", label: "Upgrades", icon: ArrowUpCircle, hasBadge: true },
  { path: "/admin/addon-requests", label: "Add-ons", icon: Sparkles, hasBadge: true },
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
  const [clinicInfo, setClinicInfo] = useState<{ id: string; createdAt: string } | null>(null);

  useEffect(() => {
    fetchPendingUpgrades();
    fetchClinicInfo();
    
    // Subscribe to realtime updates
    const channel = supabase
      .channel('pending-upgrades')
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
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
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

              const showBadge = (item as any).hasBadge && pendingUpgrades > 0;

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
                  {showBadge && (
                    <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-xs">
                      {pendingUpgrades}
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
        <main className="flex-1 overflow-auto p-6">
          <Suspense fallback={
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          }>
            <Outlet />
          </Suspense>
        </main>
      </div>

      {/* Footer */}
      <footer className="h-10 bg-muted/50 border-t border-border flex items-center justify-between px-4 text-xs shrink-0">
        <div className="flex items-center gap-4">
          <Logo size="sm" />
          {formattedClinicId && (
            <span className="text-muted-foreground">
              ID <span className="font-semibold text-foreground">{formattedClinicId}</span>
            </span>
          )}
          <span className="text-muted-foreground">
            VERSÃO <span className="font-semibold text-primary">{SYSTEM_VERSION}</span>
          </span>
        </div>

        <div className="flex items-center gap-4">
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
