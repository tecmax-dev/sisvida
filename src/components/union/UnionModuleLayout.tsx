import { useEffect } from "react";
import { Outlet, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUnionPermissions } from "@/hooks/useUnionPermissions";
import { useUnionEntity } from "@/hooks/useUnionEntity";
import { useClinicHasUnionEntity } from "@/hooks/useClinicHasUnionEntity";
import { UserMenu } from "@/components/layout/UserMenu";
import { AppShell } from "@/components/layout/AppShell";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
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

  const sections = [
    ...(unionCategories.length ? [{ id: "union", label: "Sindicato", categories: unionCategories }] : []),
    ...(mainCategories.length ? [{ id: "clinic", label: "Clínica", categories: mainCategories }] : []),
  ];

  return (
    <AppShell sections={sections} actions={<><ThemeToggle /><UserMenu /></>}>
      <Outlet />
    </AppShell>
  );
}
