import { useAuth } from "@/hooks/useAuth";

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
  | "manage_prescriptions";

// Define permissions for each role
const rolePermissions: Record<string, Permission[] | "*"> = {
  owner: "*", // All permissions
  admin: "*", // All permissions
  receptionist: [
    "view_dashboard",
    "manage_calendar",
    "view_patients",
    "manage_patients",
    "view_anamnesis",
    "manage_anamnesis",
    "manage_waiting_list",
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
  ],
};

export function usePermissions() {
  const { userRoles, currentClinic, isSuperAdmin } = useAuth();

  // Get current role for the current clinic
  const currentUserRole = userRoles.find((r) => r.clinic_id === currentClinic?.id);
  const currentRole = currentUserRole?.role || null;

  const hasPermission = (permission: Permission): boolean => {
    // Super admins have all permissions
    if (isSuperAdmin) return true;

    // No role means no permissions
    if (!currentRole) return false;

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
  };
}
