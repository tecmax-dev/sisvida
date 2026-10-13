import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, Suspense } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/layout/Logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { AppShell } from "@/components/layout/AppShell";
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
  { path: "/admin/storage-export", label: "Exportar Arquivos", icon: Upload },
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

  const badgeFor = (path: string) =>
    path === "/admin/upgrades" ? pendingUpgrades : path === "/admin/addon-requests" ? pendingAddons : 0;
  const pick = (paths: string[]) =>
    adminNavItems.filter((i) => paths.includes(i.path)).map((i) => ({ href: i.path, icon: i.icon, label: i.label, badge: badgeFor(i.path) }));
  const groupDefs: { id: string; label: string; icon: any; paths: string[] }[] = [
    { id: "geral", label: "Dashboard", icon: LayoutDashboard, paths: ["/admin"] },
    { id: "contas", label: "Contas e usuários", icon: Building2, paths: ["/admin/clinics", "/admin/union-entities", "/admin/users", "/admin/access-groups", "/admin/dependent-approvals"] },
    { id: "planos", label: "Planos e cobrança", icon: CreditCard, paths: ["/admin/plans", "/admin/billing", "/admin/addons", "/admin/features", "/admin/upgrades", "/admin/addon-requests"] },
    { id: "whatsapp", label: "WhatsApp", icon: MessageCircle, paths: ["/admin/whatsapp-templates", "/admin/whatsapp-status", "/admin/whatsapp-audit", "/admin/whatsapp-simulation", "/admin/meta-webhook-health"] },
    { id: "site", label: "Site e comunicação", icon: Image, paths: ["/admin/hero", "/admin/banners", "/admin/notifications", "/admin/chat"] },
    { id: "sistema", label: "Sistema", icon: Settings, paths: ["/admin/config", "/admin/import", "/admin/smtp", "/admin/audit"] },
  ];
  const grouped = new Set(groupDefs.flatMap((g) => g.paths));
  const leftovers = adminNavItems.filter((i) => !grouped.has(i.path)).map((i) => i.path);
  if (leftovers.length) groupDefs.push({ id: "outros", label: "Outros", icon: Layers, paths: leftovers });
  const adminSections = [{
    id: "admin",
    label: "Administração",
    categories: groupDefs.map((g) => ({ id: g.id, label: g.label, icon: g.icon, items: pick(g.paths) })).filter((c) => c.items.length),
  }];

  return (
    <AppShell
      sections={adminSections}
      actions={<>
        <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex"><Link to="/dashboard"><ChevronRight className="h-4 w-4 mr-1" />Ir para Dashboard</Link></Button>
        <ThemeToggle />
        <span className="hidden md:inline text-sm font-medium truncate max-w-[160px]">{profile?.name || "Admin"}</span>
        <Button variant="ghost" size="sm" onClick={handleSignOut} className="hover:text-destructive hover:bg-destructive/10"><LogOut className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Sair</span></Button>
      </>}
      footer={
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
      }
    >
      <Suspense fallback={
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }>
        <Outlet />
      </Suspense>
    </AppShell>
  );
}
