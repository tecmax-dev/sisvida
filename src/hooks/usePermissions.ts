import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Legacy permission types for backward compatibility
export type Permission =
  | "view_dashboard"
  | "manage_calendar"
  | "view_patients"
  | "manage_patients"
  | "manage_professionals"
  | "view_medical_records"
  | "manage_medical_records"
  | "view_anamnesis"
  | "manage_anamnesis"
  | "manage_anamnesis_templates"
  | "manage_waiting_list"
  | "manage_insurance"
  | "view_reports"
  | "manage_subscription"
  | "manage_settings"
  | "manage_users"
  | "view_prescriptions"
  | "manage_prescriptions"
  | "view_financials"
  | "manage_financials"
  | "view_procedures"
  | "manage_procedures";

// Legacy role permissions for backward compatibility (used when access_group_id is not set)
const rolePermissions: Record<string, Permission[] | "*"> = {
  owner: "*",
  admin: "*",
  receptionist: [
    "view_dashboard",
    "manage_calendar",
    "view_patients",
    "manage_patients",
    "view_anamnesis",
    "manage_anamnesis",
    "manage_waiting_list",
    "view_procedures",
  ],
  professional: [
    "view_dashboard",
    "manage_calendar",
    "view_patients",
    "view_medical_records",
    "manage_medical_records",
    "view_anamnesis",
    "manage_anamnesis",
    "view_prescriptions",
    "manage_prescriptions",
    "view_procedures",
  ],
  administrative: [
    "view_dashboard",
    "manage_calendar",
    "view_patients",
    "manage_patients",
    "view_anamnesis",
    "manage_anamnesis",
    "manage_waiting_list",
    "manage_insurance",
    "view_reports",
    "view_procedures",
  ],
};

export function usePermissions() {
  const { user, userRoles, currentClinic, isSuperAdmin } = useAuth();

  // Get current role for the current clinic
  const currentUserRole = userRoles.find((r) => r.clinic_id === currentClinic?.id);
  const currentRole = currentUserRole?.role || null;
  const accessGroupId = (currentUserRole as any)?.access_group_id || null;

  // Fetch permissions from database when user has an access_group_id
  const { data: dbPermissions } = useQuery({
    queryKey: ['user-permissions', user?.id, currentClinic?.id],
    queryFn: async () => {
      if (!user?.id || !currentClinic?.id) return null;
      
      const { data, error } = await supabase.rpc('get_user_permissions', {
        _user_id: user.id,
        _clinic_id: currentClinic.id
      });

      if (error) {
        console.error('Error fetching user permissions:', error);
        return null;
      }

      return new Set(data?.map((p: { permission_key: string }) => p.permission_key) || []);
    },
    enabled: !!user?.id && !!currentClinic?.id && (!!accessGroupId || isSuperAdmin || currentRole === 'owner' || currentRole === 'admin'),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const hasPermission = (permission: Permission): boolean => {
    // Super admins have all permissions
    if (isSuperAdmin) return true;

    // No role means no permissions
    if (!currentRole) return false;

    // If using database permissions (access group or owner/admin)
    if (dbPermissions) {
      return dbPermissions.has(permission);
    }

    // Fallback to legacy role-based permissions
    const permissions = rolePermissions[currentRole];

    // If permissions is "*", user has all permissions
    if (permissions === "*") return true;

    // Check if the permission is in the role's permission list
    return permissions?.includes(permission) || false;
  };

  const hasAnyPermission = (permissions: Permission[]): boolean => {
    return permissions.some((p) => hasPermission(p));
  };

  const hasAllPermissions = (permissions: Permission[]): boolean => {
    return permissions.every((p) => hasPermission(p));
  };

  // Check if user is admin (owner or admin role)
  const isAdmin = currentRole === "owner" || currentRole === "admin" || isSuperAdmin;

  // Check if user is a professional (professional role only)
  const isProfessionalOnly = currentRole === "professional" && !isSuperAdmin;

  return {
    currentRole,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    isAdmin,
    isProfessionalOnly,
    dbPermissions, // Expose for debugging if needed
  };
}
