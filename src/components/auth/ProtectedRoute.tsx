import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { Loader2 } from "lucide-react";
import { BlockedClinicOverlay } from "@/components/BlockedClinicOverlay";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireSuperAdmin?: boolean;
}

export function ProtectedRoute({ children, requireSuperAdmin = false }: ProtectedRouteProps) {
  const { user, loading, userRoles, isSuperAdmin, currentClinic, rolesLoaded } = useAuth();
  const { isProfessionalOnly } = usePermissions();
  const location = useLocation();

  // Wait for both auth loading AND roles to be loaded before making decisions
  if (loading || (!rolesLoaded && user)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // If route requires super admin and user is not super admin
  if (requireSuperAdmin && !isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  // Super admins can access admin routes without clinic
  if (isSuperAdmin && location.pathname.startsWith("/admin")) {
    return <>{children}</>;
  }

  // Check if clinic is blocked (only for non-super-admins)
  if (currentClinic?.is_blocked && !isSuperAdmin && !location.pathname.startsWith("/admin")) {
    return <BlockedClinicOverlay reason={currentClinic.blocked_reason || undefined} />;
  }

  // If user has no clinic, redirect to setup (unless super admin)
  // Super admin without clinic should go to /admin, not /clinic-setup
  if (userRoles.length === 0 && !isSuperAdmin && location.pathname !== "/clinic-setup") {
    return <Navigate to="/clinic-setup" replace />;
  }

  // Super admin without clinic trying to access non-admin routes should go to admin
  if (isSuperAdmin && userRoles.length === 0 && !location.pathname.startsWith("/admin")) {
    return <Navigate to="/admin" replace />;
  }

  // Redirect professional-only users directly to their calendar
  if (isProfessionalOnly && location.pathname.startsWith("/dashboard")) {
    // If professional lands on /dashboard, redirect to calendar
    if (location.pathname === "/dashboard") {
      return <Navigate to="/dashboard/calendar" replace />;
    }

    // Allow access to specific routes that professionals can use
    const allowedProfessionalPaths = [
      "/dashboard/calendar",
      "/dashboard/atendimento",
      "/dashboard/patients",
      "/dashboard/medical-records",
      "/dashboard/anamnesis",
      "/dashboard/anamnesis-dynamic",
      "/dashboard/prescription",
    ];

    const isAllowedPath = allowedProfessionalPaths.some(
      (path) => location.pathname === path || location.pathname.startsWith(path + "/")
    );

    if (!isAllowedPath) {
      return <Navigate to="/dashboard/calendar" replace />;
    }
  }

  return <>{children}</>;
}
