import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Logo } from "@/components/layout/Logo";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

const adminNavItems = [
  { path: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { path: "/admin/clinics", label: "Clínicas", icon: Building2 },
  { path: "/admin/users", label: "Usuários", icon: Users },
  { path: "/admin/plans", label: "Planos", icon: CreditCard },
  { path: "/admin/features", label: "Recursos", icon: Layers },
  { path: "/admin/upgrades", label: "Upgrades", icon: ArrowUpCircle },
  { path: "/admin/audit", label: "Auditoria", icon: ScrollText },
];

export function AdminLayout() {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar-background border-r border-sidebar-border flex flex-col">
        <div className="p-4 border-b border-sidebar-border">
          <Logo size="sm" />
          <div className="mt-3 flex items-center gap-2 text-xs">
            <Shield className="h-3.5 w-3.5 text-warning" />
            <span className="text-warning font-medium">Super Admin</span>
          </div>
        </div>
        
        <nav className="flex-1 p-3 space-y-1">
          {adminNavItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-sidebar-border space-y-2">
          <Link
            to="/dashboard"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
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
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
