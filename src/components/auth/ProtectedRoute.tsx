import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import { BlockedClinicOverlay } from "@/components/BlockedClinicOverlay";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireSuperAdmin?: boolean;
}

export function ProtectedRoute({ children, requireSuperAdmin = false }: ProtectedRouteProps) {
  const { user, loading, userRoles, isSuperAdmin, currentClinic } = useAuth();
  const location = useLocation();

  if (loading) {
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
  if (userRoles.length === 0 && !isSuperAdmin && location.pathname !== "/clinic-setup") {
    return <Navigate to="/clinic-setup" replace />;
  }

  return <>{children}</>;
}
