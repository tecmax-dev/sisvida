import { useEffect } from "react";
import { Outlet, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUnionPermissions } from "@/hooks/useUnionPermissions";
import { useUnionEntity } from "@/hooks/useUnionEntity";
import { useClinicHasUnionEntity } from "@/hooks/useClinicHasUnionEntity";
import { UserMenu } from "@/components/layout/UserMenu";
import prosingeLogo from "@/assets/prosinge-logo.png";
import { DashboardHeaderNav } from "@/components/dashboard/DashboardHeaderNav";
import { useMainNavCategories } from "@/components/dashboard/useMainNavCategories";
import { useUnionNavCategories } from "@/components/dashboard/useUnionNavCategories";

export function UnionModuleLayout() {
  const location = useLocation();
  const { user, profile, currentClinic, signOut } = useAuth();
  const { hasUnionAccess, permissionsLoading } = useUnionPermissions();
  const { isUnionEntityAdmin, loading: isLoadingUnionEntity } = useUnionEntity();
  const mainCategories = useMainNavCategories();
  const unionCategories = useUnionNavCategories();
  useClinicHasUnionEntity();

  // Dynamic SEO: favicon + title for SindiFlex
  useEffect(() => {
    const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    const originalHref = favicon?.href || '/favicon.ico';
    const originalTitle = document.title;
    if (favicon) favicon.href = '/favicon-sindiflex.png';
    document.title = 'Prosinge - Gestão Sindical';

    return () => {
      if (favicon) favicon.href = originalHref;
      document.title = originalTitle;
    };
  }, []);

  // Only block on permissions and entity admin checks — NOT on useClinicHasUnionEntity
  // which may never resolve when currentClinic is null in /sindicato routes.
  const isCheckingAccess = permissionsLoading || isLoadingUnionEntity;

  // Redirect if no access: user must have explicit union permissions OR be union entity admin
  // Having a clinic linked to a union entity is NOT enough - user must have specific permissions
  // Only redirect after all checks are complete to avoid premature redirects during loading
  if (!isCheckingAccess && !hasUnionAccess() && !isUnionEntityAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen h-[100dvh] flex flex-col bg-background overflow-hidden">
      <header className="min-h-14 border-b border-border/80 bg-card/95 backdrop-blur-md flex items-center justify-between px-3 sm:px-4 sticky top-0 z-30 gap-2 shadow-sm">
        <div className="flex items-center gap-2 shrink-0">
          <img src={prosingeLogo} alt="Prosinge" className="h-7 object-contain" />
          <h1 className="text-base font-semibold text-foreground hidden lg:block">Prosinge</h1>
        </div>
        <div className="flex-1 min-w-0 flex justify-center overflow-hidden px-1 sm:px-2">
          <DashboardHeaderNav
            categories={mainCategories}
            showUnionLink
            unionCategories={unionCategories}
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <UserMenu />
        </div>
      </header>
      <main className="flex-1 min-h-0 overflow-auto px-3 py-4 sm:p-5 lg:p-6">
        <div className="mx-auto w-full max-w-[1600px] animate-enter">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
