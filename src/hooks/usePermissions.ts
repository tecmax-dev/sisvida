import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// All permission keys from the database (permission_definitions table)
export type Permission =
  // Dashboard
  | "view_dashboard"
  | "dashboard_default"
  | "dashboard_financial"
  | "dashboard_charts"
  // Calendar/Scheduling
  | "scheduling"
  | "view_calendar"
  | "manage_calendar"
  | "manage_waiting_list"
  | "view_schedules"
  | "view_professional_schedule"
  // Patients/Clients
  | "patients"
  | "view_patients"
  | "manage_patients"
  | "delete_patients"
  // Medical Records
  | "medical_records"
  | "view_medical_records"
  | "manage_medical_records"
  // Anamnesis
  | "anamnesis"
  | "view_anamnesis"
  | "manage_anamnesis"
  | "manage_anamnesis_templates"
  | "anamnesis_forms"
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
  | "cashier"
  | "manage_cashier"
  | "financial_categories"
  | "financial_accounts"
  | "payables"
  | "receivables"
  | "recurring_transactions"
  | "view_commissions"
  // Insurance
  | "insurance"
  | "view_insurance"
  | "manage_insurance"
  | "insurance_plans"
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
  | "manage_webhooks"
  | "company_data"
  | "email_settings"
  | "whatsapp_settings"
  | "change_password"
  // Access/Permissions
  | "access_groups"
  // Cadastros Gerais
  | "custom_fields"
  | "holidays"
  | "rooms"
  | "service_groups"
  | "sms_templates"
  | "tags"
  // Consulta
  | "view_audit"
  | "view_budgets"
  // Legacy aliases (for backward compatibility)
  | "manage_cash_registers"
  | "manage_categories"
  | "manage_commissions"
  | "manage_receivables"
  | "manage_recurring"
  | "manage_transfers"
  | "reconciliation";

/**
 * Permission alias mapping: maps legacy/incorrect keys to correct database keys.
 * This ensures backward compatibility with existing code that uses old permission names.
 */
const permissionAliases: Record<string, string> = {
  // Insurance aliases
  "manage_insurance": "insurance_plans",
  "view_insurance": "insurance_plans",
  "insurance": "insurance_plans",
  
  // Stock aliases
  "stock": "view_stock",
  
  // Financial aliases
  "manage_cash_registers": "manage_cashier",
  "manage_categories": "financial_categories",
  "manage_commissions": "view_commissions",
  "manage_receivables": "receivables",
  "manage_recurring": "recurring_transactions",
  "manage_transfers": "manage_financials",
  "reconciliation": "manage_financials",
  
  // Patients aliases
  "patients": "view_patients",
  
  // Medical records aliases
  "medical_records": "view_medical_records",
  
  // Anamnesis aliases
  "anamnesis": "view_anamnesis",
  
  // Prescriptions aliases
  "prescriptions": "view_prescriptions",
  
  // Procedures aliases
  "procedures": "view_procedures",
  
  // Packages aliases
  "packages": "view_stock", // Packages typically require stock view permission
  "view_packages": "view_stock",
  "manage_packages": "manage_stock",
  
  // Professionals aliases
  "professionals": "manage_professionals",
  "view_professionals": "manage_professionals",
  
  // Reports aliases
  "reports": "view_reports",
  
  // Financials aliases
  "financials": "view_financials",
  
  // Settings aliases
  "settings": "manage_settings",
  "manage_integrations": "manage_settings",
  "manage_api_keys": "manage_settings",
  "manage_webhooks": "manage_settings",
};

/**
 * Resolves a permission key to its canonical form using aliases.
 */
function resolvePermission(permission: string): string {
  return permissionAliases[permission] || permission;
}

// Legacy role permissions for backward compatibility (used when access_group_id is not set)
const rolePermissions: Record<string, Permission[] | "*"> = {
  owner: "*",
  admin: "*",
  receptionist: [
    "view_dashboard",
    "scheduling",
    "view_calendar",
    "manage_calendar",
    "view_patients",
    "manage_patients",
    "view_anamnesis",
    "manage_anamnesis",
    "manage_waiting_list",
    "view_procedures",
    "insurance_plans",
  ],
  professional: [
    "view_dashboard",
    "scheduling",
    "view_calendar",
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
    "scheduling",
    "view_calendar",
    "manage_calendar",
    "view_patients",
    "manage_patients",
    "view_anamnesis",
    "manage_anamnesis",
    "manage_waiting_list",
    "insurance_plans",
    "view_reports",
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

    // Resolve the permission to its canonical form
    const resolvedPermission = resolvePermission(permission);

    // If user has an access_group_id, ALWAYS use database permissions
    if (accessGroupId) {
      // While loading, deny access to prevent flickering
      if (permissionsLoading) return false;
      
      // Check both the original permission and the resolved one
      return dbPermissions?.has(permission) || dbPermissions?.has(resolvedPermission) || false;
    }

    // Fallback to legacy role-based permissions for users without access_group_id
    const permissions = rolePermissions[currentRole];

    // If permissions is "*", user has all permissions
    if (permissions === "*") return true;

    // Check if the permission is in the role's permission list (check both original and resolved)
    return permissions?.includes(permission) || permissions?.includes(resolvedPermission as Permission) || false;
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
