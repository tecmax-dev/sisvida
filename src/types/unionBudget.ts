// Tipos para o módulo de Previsão Orçamentária Sindical

export type BudgetExerciseStatus = 
  | 'draft' 
  | 'pending_review' 
  | 'pending_approval' 
  | 'approved' 
  | 'revised' 
  | 'closed' 
  | 'cancelled';

export type ApproverRole = 'elaborator' | 'reviewer' | 'approver';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'abstained';

export type RevenueType = 
  | 'contribution' 
  | 'fee' 
  | 'service' 
  | 'rental' 
  | 'investment' 
  | 'grant' 
  | 'donation' 
  | 'other';

export type ExpenseType = 
  | 'fixed' 
  | 'variable' 
  | 'recurring' 
  | 'eventual' 
  | 'investment' 
  | 'personnel' 
  | 'administrative' 
  | 'operational' 
  | 'other';

export type ExpenseNature = 'essential' | 'strategic' | 'optional';

export type AlertType = 'percentage' | 'absolute' | 'category';
export type AlertLevel = 'info' | 'warning' | 'critical';

export type ReplanningStatus = 'pending' | 'approved' | 'rejected';

export interface BudgetExercise {
  id: string;
  clinic_id: string;
  name: string;
  description?: string;
  fiscal_year_start_month: number;
  fiscal_year_start_day: number;
  start_date: string;
  end_date: string;
  status: BudgetExerciseStatus;
  base_year?: number;
  growth_rate_revenue?: number;
  growth_rate_expense?: number;
  inflation_rate?: number;
  base_member_count?: number;
  projected_member_count?: number;
  created_by?: string;
  approved_at?: string;
  closed_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface BudgetApprover {
  id: string;
  budget_exercise_id: string;
  user_id: string;
  role: ApproverRole;
  is_required: boolean;
  approval_status: ApprovalStatus;
  approved_at?: string;
  rejection_reason?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  // Joined data
  user_name?: string;
  user_email?: string;
}

export interface BudgetVersion {
  id: string;
  budget_exercise_id: string;
  version_number: number;
  version_name?: string;
  is_current: boolean;
  created_by?: string;
  notes?: string;
  created_at: string;
}

export interface BudgetRevenue {
  id: string;
  budget_version_id: string;
  clinic_id: string;
  category_id?: string;
  chart_account_id?: string;
  cost_center_id?: string;
  description: string;
  revenue_type: RevenueType;
  month_01: number;
  month_02: number;
  month_03: number;
  month_04: number;
  month_05: number;
  month_06: number;
  month_07: number;
  month_08: number;
  month_09: number;
  month_10: number;
  month_11: number;
  month_12: number;
  total_amount: number;
  premise_description?: string;
  historical_basis_start_date?: string;
  historical_basis_end_date?: string;
  growth_rate_applied?: number;
  is_recurring: boolean;
  is_locked: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
  // Joined data
  category_name?: string;
  chart_account_name?: string;
  cost_center_name?: string;
}

export interface BudgetExpense {
  id: string;
  budget_version_id: string;
  clinic_id: string;
  category_id?: string;
  chart_account_id?: string;
  cost_center_id?: string;
  supplier_id?: string;
  description: string;
  expense_type: ExpenseType;
  expense_nature?: ExpenseNature;
  month_01: number;
  month_02: number;
  month_03: number;
  month_04: number;
  month_05: number;
  month_06: number;
  month_07: number;
  month_08: number;
  month_09: number;
  month_10: number;
  month_11: number;
  month_12: number;
  total_amount: number;
  budget_limit?: number;
  requires_approval_above?: number;
  premise_description?: string;
  historical_basis_start_date?: string;
  historical_basis_end_date?: string;
  growth_rate_applied?: number;
  is_recurring: boolean;
  is_locked: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
  // Joined data
  category_name?: string;
  chart_account_name?: string;
  cost_center_name?: string;
  supplier_name?: string;
}

export interface BudgetAlert {
  id: string;
  budget_exercise_id: string;
  clinic_id: string;
  alert_type: AlertType;
  alert_level: AlertLevel;
  threshold_percentage?: number;
  threshold_amount?: number;
  category_id?: string;
  cost_center_id?: string;
  notify_by_email: boolean;
  notify_by_system: boolean;
  notify_users?: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BudgetAlertLog {
  id: string;
  alert_id: string;
  budget_exercise_id: string;
  clinic_id: string;
  triggered_at: string;
  alert_level: string;
  message: string;
  budget_item_type?: string;
  budget_item_id?: string;
  current_value?: number;
  threshold_value?: number;
  deviation_percentage?: number;
  acknowledged_at?: string;
  acknowledged_by?: string;
  justification?: string;
}

export interface BudgetExecution {
  id: string;
  budget_version_id: string;
  clinic_id: string;
  reference_month: number;
  reference_year: number;
  total_revenue_budgeted: number;
  total_revenue_realized: number;
  revenue_deviation: number;
  revenue_deviation_percentage?: number;
  total_expense_budgeted: number;
  total_expense_realized: number;
  expense_deviation: number;
  expense_deviation_percentage?: number;
  result_budgeted: number;
  result_realized: number;
  is_closed: boolean;
  closed_at?: string;
  closed_by?: string;
  notes?: string;
  calculated_at: string;
  updated_at: string;
}

export interface BudgetReplanning {
  id: string;
  budget_exercise_id: string;
  clinic_id: string;
  item_type: 'revenue' | 'expense';
  revenue_id?: string;
  expense_id?: string;
  original_month: number;
  original_value: number;
  new_value: number;
  difference: number;
  justification: string;
  requested_by: string;
  requested_at: string;
  approved_by?: string;
  approved_at?: string;
  status: ReplanningStatus;
  rejection_reason?: string;
}

export interface BudgetAuditLog {
  id: string;
  budget_exercise_id?: string;
  clinic_id: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  old_data?: Record<string, unknown>;
  new_data?: Record<string, unknown>;
  performed_by: string;
  performed_at: string;
  ip_address?: string;
  user_agent?: string;
}

// UI Helper types
export interface BudgetSummary {
  totalRevenuesBudgeted: number;
  totalExpensesBudgeted: number;
  projectedResult: number;
  totalRevenuesRealized: number;
  totalExpensesRealized: number;
  actualResult: number;
  revenueDeviation: number;
  expenseDeviation: number;
}

export interface MonthlyData {
  month: number;
  monthName: string;
  revenueBudgeted: number;
  revenueRealized: number;
  expenseBudgeted: number;
  expenseRealized: number;
  resultBudgeted: number;
  resultRealized: number;
}

// Status labels
export const budgetStatusLabels: Record<BudgetExerciseStatus, string> = {
  draft: 'Rascunho',
  pending_review: 'Em Revisão',
  pending_approval: 'Aguardando Aprovação',
  approved: 'Aprovado',
  revised: 'Revisado',
  closed: 'Encerrado',
  cancelled: 'Cancelado',
};

export const budgetStatusColors: Record<BudgetExerciseStatus, string> = {
  draft: 'bg-slate-100 text-slate-700',
  pending_review: 'bg-yellow-100 text-yellow-700',
  pending_approval: 'bg-orange-100 text-orange-700',
  approved: 'bg-green-100 text-green-700',
  revised: 'bg-blue-100 text-blue-700',
  closed: 'bg-gray-100 text-gray-700',
  cancelled: 'bg-red-100 text-red-700',
};

export const revenueTypeLabels: Record<RevenueType, string> = {
  contribution: 'Contribuição Sindical',
  fee: 'Taxa',
  service: 'Serviço',
  rental: 'Aluguel',
  investment: 'Investimento',
  grant: 'Subvenção',
  donation: 'Doação',
  other: 'Outros',
};

export const expenseTypeLabels: Record<ExpenseType, string> = {
  fixed: 'Fixa',
  variable: 'Variável',
  recurring: 'Recorrente',
  eventual: 'Eventual',
  investment: 'Investimento',
  personnel: 'Pessoal',
  administrative: 'Administrativa',
  operational: 'Operacional',
  other: 'Outros',
};

export const expenseNatureLabels: Record<ExpenseNature, string> = {
  essential: 'Essencial',
  strategic: 'Estratégica',
  optional: 'Opcional',
};

export const alertLevelLabels: Record<AlertLevel, string> = {
  info: 'Informativo',
  warning: 'Atenção',
  critical: 'Crítico',
};

export const alertLevelColors: Record<AlertLevel, string> = {
  info: 'bg-blue-100 text-blue-700',
  warning: 'bg-yellow-100 text-yellow-700',
  critical: 'bg-red-100 text-red-700',
};

export const monthNames = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];
