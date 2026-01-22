import { useState, useEffect } from "react";
import { Link, Outlet, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUnionPermissions } from "@/hooks/useUnionPermissions";
import { useUnionEntity } from "@/hooks/useUnionEntity";
import { useClinicHasUnionEntity } from "@/hooks/useClinicHasUnionEntity";
import { UnionSidebar } from "./UnionSidebar";
import { Logo } from "@/components/layout/Logo";
import { UserMenu } from "@/components/layout/UserMenu";
import { UserAvatar } from "@/components/users/UserAvatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import ecliniDashboardLogo from "@/assets/eclini-dashboard-logo.png";
import {
  Menu,
  X,
  PanelLeftClose,
  PanelLeft,
  LayoutDashboard,
  Building2,
  ArrowLeft,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const SYSTEM_VERSION = "2026.01.2";

export function UnionModuleLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("union-sidebar-collapsed") === "true";
    }
    return false;
  });
  const location = useLocation();
  const { user, profile, currentClinic, signOut } = useAuth();
  const { hasUnionAccess } = useUnionPermissions();
  const { isUnionEntityAdmin } = useUnionEntity();
  const { hasUnionEntity, isLoading: isLoadingUnionEntity } = useClinicHasUnionEntity();

  useEffect(() => {
    localStorage.setItem("union-sidebar-collapsed", String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  // Redirect if no access: user must have explicit union permissions OR be union entity admin
  // Having a clinic linked to a union entity is NOT enough - user must have specific permissions
  if (!isLoadingUnionEntity && !hasUnionAccess() && !isUnionEntityAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

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
          "fixed inset-y-0 left-0 z-50 border-r border-sidebar-border shadow-sm transform transition-all duration-300 lg:translate-x-0 lg:static",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
          sidebarCollapsed ? "w-16" : "w-64"
        )}
        style={{
          background: 'linear-gradient(180deg, hsl(210 60% 30%) 0%, hsl(220 55% 25%) 45%, hsl(240 45% 20%) 100%)'
        }}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div 
            className="flex items-center justify-center p-4 border-b border-sidebar-border relative"
            style={{
              background: 'linear-gradient(180deg, hsl(210 50% 15%) 0%, hsl(220 55% 20%) 100%)'
            }}
          >
            {!sidebarCollapsed && (
              <div className="flex-1 flex flex-col items-center gap-1">
                <Logo size="md" customSrc={ecliniDashboardLogo} />
                <div className="flex items-center gap-1.5 mt-1">
                  <Building2 className="h-3.5 w-3.5 text-purple-300" />
                  <span className="text-xs font-medium text-purple-200">Módulo Sindical</span>
                </div>
              </div>
            )}
            {sidebarCollapsed && (
              <div className="w-full flex flex-col items-center">
                <Building2 className="h-6 w-6 text-purple-300" />
              </div>
            )}
            {/* Mobile close button */}
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md hover:bg-sidebar-accent lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5 text-sidebar-foreground" />
            </button>
          </div>

          {/* Navigation */}
          {!sidebarCollapsed && <UnionSidebar />}

          {/* Footer */}
          <div className="p-3 border-t border-sidebar-border space-y-2">
            {/* Back to Dashboard link */}
            <Link
              to="/dashboard"
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                sidebarCollapsed && "justify-center px-2"
              )}
            >
              <ArrowLeft className="h-4 w-4 shrink-0" />
              {!sidebarCollapsed && <span>Voltar ao Dashboard</span>}
            </Link>

            {/* Collapse toggle */}
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "w-full text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                sidebarCollapsed && "justify-center"
              )}
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            >
              {sidebarCollapsed ? (
                <PanelLeft className="h-4 w-4" />
              ) : (
                <>
                  <PanelLeftClose className="h-4 w-4 mr-2" />
                  <span className="text-xs">Recolher</span>
                </>
              )}
            </Button>
            
            {!sidebarCollapsed && (
              <p className="text-[10px] text-sidebar-foreground/50 text-center">
                v{SYSTEM_VERSION}
              </p>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* Header */}
        <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            {/* Mobile menu button */}
            <button
              className="p-2 rounded-md hover:bg-accent lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>
            
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-purple-500" />
              <h1 className="text-lg font-semibold text-foreground">
                Módulo Sindical
              </h1>
              {currentClinic && (
                <span className="text-sm text-muted-foreground hidden sm:inline">
                  • {currentClinic.name}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <UserMenu />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
