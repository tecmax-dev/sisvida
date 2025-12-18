import { useState } from "react";
import { Link, useLocation, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Logo } from "@/components/layout/Logo";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", icon: Home, label: "Visão Geral" },
  { href: "/dashboard/calendar", icon: Calendar, label: "Agenda" },
  { href: "/dashboard/patients", icon: Users, label: "Pacientes" },
  { href: "/dashboard/professionals", icon: UserCircle, label: "Profissionais" },
  { href: "/dashboard/medical-records", icon: FileText, label: "Prontuário" },
  { href: "/dashboard/anamnesis", icon: ClipboardList, label: "Anamnese" },
  { href: "/dashboard/waiting-list", icon: Clock, label: "Lista de Espera" },
  { href: "/dashboard/insurance", icon: CreditCard, label: "Convênios" },
  { href: "/dashboard/reports", icon: BarChart3, label: "Relatórios" },
  { href: "/dashboard/settings", icon: Settings, label: "Configurações" },
];

const adminNavItems = [
  { href: "/dashboard/users", icon: UserCog, label: "Usuários" },
];

export function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { user, profile, currentClinic, userRoles, signOut, setCurrentClinic } = useAuth();

  // Check if current user is admin of the clinic
  const currentUserRole = userRoles.find(r => r.clinic_id === currentClinic?.id);
  const isAdmin = currentUserRole?.role === 'owner' || currentUserRole?.role === 'admin';

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return location.pathname === "/dashboard";
    }
    return location.pathname.startsWith(href);
  };

  const displayName = profile?.name || user?.user_metadata?.name || "Usuário";

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
          "fixed inset-y-0 left-0 z-50 w-64 bg-sidebar border-r border-sidebar-border transform transition-transform duration-300 lg:translate-x-0 lg:static",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
            <Logo variant="light" size="md" />
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden text-sidebar-foreground hover:bg-sidebar-accent"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Clinic Selector */}
          {userRoles.length > 0 && currentClinic && (
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

          <nav className="flex-1 p-4 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive(item.href)
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            ))}
            
            {/* Admin only navigation items */}
            {isAdmin && adminNavItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive(item.href)
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="p-4 border-t border-sidebar-border">
            <div className="flex items-center gap-3 mb-4 px-3">
              <div className="w-9 h-9 rounded-full bg-sidebar-accent flex items-center justify-center">
                <span className="text-sm font-medium text-sidebar-foreground">
                  {displayName.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">
                  {displayName}
                </p>
                <p className="text-xs text-sidebar-foreground/60 truncate">
                  {user?.email}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              onClick={signOut}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center gap-4 px-4 lg:px-6 h-16 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="flex-1" />

          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full" />
          </Button>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
