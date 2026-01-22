import { usePermissions, Permission } from "@/hooks/usePermissions";
import { useAuth } from "@/hooks/useAuth";

// Union-specific permission type
export type UnionPermission =
  // Acesso geral
  | "union_module_access"
  // Empresas
  | "union_view_employers"
  | "union_manage_employers"
  | "union_delete_employers"
  // Sócios
  | "union_view_members"
  | "union_manage_members"
  // Contribuições
  | "union_view_contributions"
  | "union_manage_contributions"
  | "union_generate_boletos"
  | "union_send_boleto_whatsapp"
  | "union_send_boleto_email"
  | "union_view_contribution_reports"
  // Financeiro
  | "union_view_financials"
  | "union_manage_financials"
  | "union_view_expenses"
  | "union_manage_expenses"
  | "union_view_income"
  | "union_manage_income"
  | "union_view_cash_flow"
  | "union_manage_cash_registers"
  | "union_manage_suppliers"
  | "union_generate_reports"
  | "union_reversal"
  | "union_manage_categories"
  | "union_manage_cost_centers"
  // Negociações
  | "union_view_negotiations"
  | "union_manage_negotiations"
  | "union_approve_negotiations"
  | "union_view_agreements"
  | "union_view_installments"
  // Auditoria
  | "union_view_audit";

export function useUnionPermissions() {
  const { hasPermission, isAdmin } = usePermissions();
  const { isSuperAdmin, userRoles } = useAuth();
  
  // Check if user has entidade_sindical_admin role (using type assertion for union entity role)
  const isUnionEntityAdmin = userRoles.some(r => (r.role as string) === "entidade_sindical_admin");

  const hasUnionPermission = (permission: UnionPermission): boolean => {
    // Super admins, clinic admins, and union entity admins have all union permissions
    if (isSuperAdmin || isAdmin || isUnionEntityAdmin) return true;
    return hasPermission(permission as Permission);
  };

  // Some union permissions must be explicitly granted (no implicit bypass for clinic admins).
  // This is especially important for sensitive/financial visibility.
  const hasStrictUnionPermission = (permission: UnionPermission): boolean => {
    if (isSuperAdmin || isUnionEntityAdmin) return true;
    return hasPermission(permission as Permission);
  };

  // Module access
  const hasUnionAccess = (): boolean => {
    return hasUnionPermission("union_module_access") || isAdmin || isSuperAdmin || isUnionEntityAdmin;
  };

  // Empresas
  const canViewEmployers = (): boolean => hasUnionPermission("union_view_employers");
  const canManageEmployers = (): boolean => hasUnionPermission("union_manage_employers");
  const canDeleteEmployers = (): boolean => hasUnionPermission("union_delete_employers");

  // Sócios
  const canViewMembers = (): boolean => hasUnionPermission("union_view_members");
  const canManageMembers = (): boolean => hasUnionPermission("union_manage_members");

  // Contribuições
  const canViewContributions = (): boolean => hasUnionPermission("union_view_contributions");
  const canManageContributions = (): boolean => hasUnionPermission("union_manage_contributions");
  const canGenerateBoletos = (): boolean => hasUnionPermission("union_generate_boletos");
  const canSendBoletoWhatsApp = (): boolean => hasUnionPermission("union_send_boleto_whatsapp");
  const canSendBoletoEmail = (): boolean => hasUnionPermission("union_send_boleto_email");
  const canViewContributionReports = (): boolean => hasUnionPermission("union_view_contribution_reports");

  // Financeiro
  const canViewFinancials = (): boolean => hasStrictUnionPermission("union_view_financials");
  const canManageFinancials = (): boolean => hasUnionPermission("union_manage_financials");
  const canViewExpenses = (): boolean => hasUnionPermission("union_view_expenses");
  const canManageExpenses = (): boolean => hasUnionPermission("union_manage_expenses");
  const canViewIncome = (): boolean => hasUnionPermission("union_view_income");
  const canManageIncome = (): boolean => hasUnionPermission("union_manage_income");
  const canViewCashFlow = (): boolean => hasUnionPermission("union_view_cash_flow");
  const canManageCashRegisters = (): boolean => hasUnionPermission("union_manage_cash_registers");
  const canManageSuppliers = (): boolean => hasUnionPermission("union_manage_suppliers");
  const canGenerateReports = (): boolean => hasUnionPermission("union_generate_reports");
  const canReverseTransactions = (): boolean => hasUnionPermission("union_reversal");
  const canManageCategories = (): boolean => hasUnionPermission("union_manage_categories");
  const canManageCostCenters = (): boolean => hasUnionPermission("union_manage_cost_centers");

  // Negociações
  const canViewNegotiations = (): boolean => hasUnionPermission("union_view_negotiations");
  const canManageNegotiations = (): boolean => hasUnionPermission("union_manage_negotiations");
  const canApproveNegotiations = (): boolean => hasUnionPermission("union_approve_negotiations");
  const canViewAgreements = (): boolean => hasUnionPermission("union_view_agreements");
  const canViewInstallments = (): boolean => hasUnionPermission("union_view_installments");

  // Auditoria
  const canViewAudit = (): boolean => hasUnionPermission("union_view_audit");

  return {
    // Main access check
    hasUnionAccess,
    hasUnionPermission,
    
    // Empresas
    canViewEmployers,
    canManageEmployers,
    canDeleteEmployers,
    
    // Sócios
    canViewMembers,
    canManageMembers,
    
    // Contribuições
    canViewContributions,
    canManageContributions,
    canGenerateBoletos,
    canSendBoletoWhatsApp,
    canSendBoletoEmail,
    canViewContributionReports,
    
    // Financeiro
    canViewFinancials,
    canManageFinancials,
    canViewExpenses,
    canManageExpenses,
    canViewIncome,
    canManageIncome,
    canViewCashFlow,
    canManageCashRegisters,
    canManageSuppliers,
    canGenerateReports,
    canReverseTransactions,
    canManageCategories,
    canManageCostCenters,
    
    // Negociações
    canViewNegotiations,
    canManageNegotiations,
    canApproveNegotiations,
    canViewAgreements,
    canViewInstallments,
    
    // Auditoria
    canViewAudit,
  };
}
