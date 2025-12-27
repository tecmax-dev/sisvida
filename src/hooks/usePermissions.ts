import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// All permission keys from the database
export type Permission =
  // Dashboard
  | "view_dashboard"
  // Calendar/Scheduling
  | "scheduling"
  | "view_calendar"
  | "manage_calendar"
  | "manage_waiting_list"
  // Patients
  | "patients"
  | "view_patients"
  | "manage_patients"
  // Medical Records
  | "medical_records"
  | "view_medical_records"
  | "manage_medical_records"
  // Anamnesis
  | "anamnesis"
  | "view_anamnesis"
  | "manage_anamnesis"
  | "manage_anamnesis_templates"
  // Prescriptions
  | "prescriptions"
  | "view_prescriptions"
  | "manage_prescriptions"
  // Procedures
  | "procedures"
  | "view_procedures"
  | "manage_procedures"
  // Packages
  | "packages"
  | "view_packages"
  | "manage_packages"
  // Professionals
  | "professionals"
  | "view_professionals"
  | "manage_professionals"
  // Reports
  | "reports"
  | "view_reports"
  // Financial
  | "financials"
  | "view_financials"
  | "manage_financials"
  | "cash_flow_monthly"
  | "cash_flow_annual"
  | "manage_cash_registers"
  | "manage_categories"
  | "manage_commissions"
  | "manage_receivables"
  | "manage_recurring"
  | "manage_transfers"
  | "reconciliation"
  // Insurance
  | "insurance"
  | "view_insurance"
  | "manage_insurance"
  // Stock
  | "stock"
  | "view_stock"
  | "manage_stock"
  // Settings
  | "settings"
  | "manage_settings"
  | "manage_users"
  | "manage_subscription"
  | "manage_integrations"
  | "manage_api_keys"
  | "manage_webhooks";

// Legacy role permissions for backward compatibility (used when access_group_id is not set)
const rolePermissions: Record<string, Permission[] | "*"> = {
  owner: "*",
  admin: "*",
  receptionist: [
    "view_dashboard",
    "scheduling",
    "view_calendar",
    "manage_calendar",
    "patients",
    "view_patients",
    "manage_patients",
    "anamnesis",
    "view_anamnesis",
    "manage_anamnesis",
    "manage_waiting_list",
    "procedures",
    "view_procedures",
  ],
  professional: [
    "view_dashboard",
    "scheduling",
    "view_calendar",
    "manage_calendar",
    "patients",
    "view_patients",
    "medical_records",
    "view_medical_records",
    "manage_medical_records",
    "anamnesis",
    "view_anamnesis",
    "manage_anamnesis",
    "prescriptions",
    "view_prescriptions",
    "manage_prescriptions",
    "procedures",
    "view_procedures",
  ],
  administrative: [
    "view_dashboard",
    "scheduling",
    "view_calendar",
    "manage_calendar",
    "patients",
    "view_patients",
    "manage_patients",
    "anamnesis",
    "view_anamnesis",
    "manage_anamnesis",
    "manage_waiting_list",
    "insurance",
    "view_insurance",
    "manage_insurance",
    "reports",
    "view_reports",
    "procedures",
    "view_procedures",
  ],
};

export function usePermissions() {
  const { user, userRoles, currentClinic, isSuperAdmin } = useAuth();

  // Get current role for the current clinic
  const currentUserRole = userRoles.find((r) => r.clinic_id === currentClinic?.id);
  const currentRole = currentUserRole?.role || null;
  const accessGroupId = currentUserRole?.access_group_id || null;

  // Fetch permissions from database when user has an access_group_id
  const { data: dbPermissions, isLoading: permissionsLoading } = useQuery({
    queryKey: ['user-permissions', user?.id, currentClinic?.id, accessGroupId],
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
    enabled: !!user?.id && !!currentClinic?.id && !!accessGroupId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const hasPermission = (permission: Permission): boolean => {
    // Super admins have all permissions
    if (isSuperAdmin) return true;

    // No role means no permissions
    if (!currentRole) return false;

    // If user has an access_group_id, ALWAYS use database permissions
    if (accessGroupId) {
      // While loading, deny access to prevent flickering
      if (permissionsLoading) return false;
      return dbPermissions?.has(permission) || false;
    }

    // Fallback to legacy role-based permissions for users without access_group_id
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

  // Check if user is admin (owner or admin role without access_group_id restriction)
  // Fixed operator precedence with explicit parentheses
  const isAdmin = ((currentRole === "owner" || currentRole === "admin") && !accessGroupId) || isSuperAdmin;

  // Check if user is a professional (professional role only)
  const isProfessionalOnly = currentRole === "professional" && !isSuperAdmin;

  return {
    currentRole,
    accessGroupId,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    isAdmin,
    isProfessionalOnly,
    permissionsLoading,
    dbPermissions, // Expose for debugging if needed
  };
}
