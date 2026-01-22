import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { 
  BudgetExercise, 
  BudgetVersion, 
  BudgetRevenue, 
  BudgetExpense,
  BudgetApprover,
  BudgetExecution,
  BudgetSummary,
  BudgetExerciseStatus
} from "@/types/unionBudget";

// Temporary workaround until types are regenerated
const db = supabase as any;

export function useUnionBudget(clinicId: string | undefined) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: exercises, isLoading: loadingExercises, refetch: refetchExercises } = useQuery({
    queryKey: ["union-budget-exercises", clinicId],
    queryFn: async () => {
      if (!clinicId) return [];
      const { data, error } = await db
        .from("union_budget_exercises")
        .select("*")
        .eq("clinic_id", clinicId)
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data as BudgetExercise[];
    },
    enabled: !!clinicId,
  });

  const createExerciseMutation = useMutation({
    mutationFn: async (exercise: Partial<BudgetExercise>) => {
      const { data, error } = await db
        .from("union_budget_exercises")
        .insert({ ...exercise, clinic_id: clinicId, created_by: user?.id })
        .select()
        .single();
      if (error) throw error;
      
      await db.from("union_budget_versions").insert({
        budget_exercise_id: data.id,
        version_number: 1,
        version_name: "Versão Inicial",
        is_current: true,
        created_by: user?.id,
      });
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["union-budget-exercises"] });
      toast.success("Exercício orçamentário criado!");
    },
    onError: (error: Error) => toast.error("Erro: " + error.message),
  });

  const updateExerciseMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<BudgetExercise> & { id: string }) => {
      const { data, error } = await db
        .from("union_budget_exercises")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["union-budget-exercises"] });
      toast.success("Exercício atualizado!");
    },
    onError: (error: Error) => toast.error("Erro: " + error.message),
  });

  const deleteExerciseMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("union_budget_exercises").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["union-budget-exercises"] });
      toast.success("Exercício excluído!");
    },
    onError: (error: Error) => toast.error("Erro: " + error.message),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: BudgetExerciseStatus }) => {
      const updates: Partial<BudgetExercise> = { status };
      if (status === 'approved') updates.approved_at = new Date().toISOString();
      else if (status === 'closed') updates.closed_at = new Date().toISOString();
      
      const { data, error } = await db
        .from("union_budget_exercises")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["union-budget-exercises"] });
      toast.success("Status atualizado!");
    },
    onError: (error: Error) => toast.error("Erro: " + error.message),
  });

  return {
    exercises: exercises || [],
    loadingExercises,
    refetchExercises,
    createExercise: createExerciseMutation.mutate,
    updateExercise: updateExerciseMutation.mutate,
    deleteExercise: deleteExerciseMutation.mutate,
    updateStatus: updateStatusMutation.mutate,
    isCreating: createExerciseMutation.isPending,
    isUpdating: updateExerciseMutation.isPending,
    isDeleting: deleteExerciseMutation.isPending,
  };
}

export function useUnionBudgetDetail(exerciseId: string | undefined, clinicId: string | undefined) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: exercise, isLoading: loadingExercise } = useQuery({
    queryKey: ["union-budget-exercise", exerciseId],
    queryFn: async () => {
      if (!exerciseId) return null;
      const { data, error } = await db.from("union_budget_exercises").select("*").eq("id", exerciseId).single();
      if (error) throw error;
      return data as BudgetExercise;
    },
    enabled: !!exerciseId,
  });

  const { data: currentVersion, isLoading: loadingVersion } = useQuery({
    queryKey: ["union-budget-current-version", exerciseId],
    queryFn: async () => {
      if (!exerciseId) return null;
      const { data, error } = await db.from("union_budget_versions").select("*").eq("budget_exercise_id", exerciseId).eq("is_current", true).single();
      if (error) throw error;
      return data as BudgetVersion;
    },
    enabled: !!exerciseId,
  });

  const { data: versions } = useQuery({
    queryKey: ["union-budget-versions", exerciseId],
    queryFn: async () => {
      if (!exerciseId) return [];
      const { data, error } = await db.from("union_budget_versions").select("*").eq("budget_exercise_id", exerciseId).order("version_number", { ascending: false });
      if (error) throw error;
      return data as BudgetVersion[];
    },
    enabled: !!exerciseId,
  });

  const { data: revenues, isLoading: loadingRevenues, refetch: refetchRevenues } = useQuery({
    queryKey: ["union-budget-revenues", currentVersion?.id],
    queryFn: async () => {
      if (!currentVersion?.id) return [];
      const { data, error } = await db.from("union_budget_revenues").select("*").eq("budget_version_id", currentVersion.id).order("description");
      if (error) throw error;
      return data as BudgetRevenue[];
    },
    enabled: !!currentVersion?.id,
  });

  const { data: expenses, isLoading: loadingExpenses, refetch: refetchExpenses } = useQuery({
    queryKey: ["union-budget-expenses", currentVersion?.id],
    queryFn: async () => {
      if (!currentVersion?.id) return [];
      const { data, error } = await db.from("union_budget_expenses").select("*").eq("budget_version_id", currentVersion.id).order("description");
      if (error) throw error;
      return data as BudgetExpense[];
    },
    enabled: !!currentVersion?.id,
  });

  const { data: approvers, refetch: refetchApprovers } = useQuery({
    queryKey: ["union-budget-approvers", exerciseId],
    queryFn: async () => {
      if (!exerciseId) return [];
      const { data, error } = await db.from("union_budget_approvers").select("*").eq("budget_exercise_id", exerciseId).order("role");
      if (error) throw error;
      return data as BudgetApprover[];
    },
    enabled: !!exerciseId,
  });

  const { data: execution, refetch: refetchExecution } = useQuery({
    queryKey: ["union-budget-execution", currentVersion?.id],
    queryFn: async () => {
      if (!currentVersion?.id) return [];
      const { data, error } = await db.from("union_budget_execution").select("*").eq("budget_version_id", currentVersion.id).order("reference_year").order("reference_month");
      if (error) throw error;
      return data as BudgetExecution[];
    },
    enabled: !!currentVersion?.id,
  });

  const summary: BudgetSummary = {
    totalRevenuesBudgeted: revenues?.reduce((sum, r) => sum + Number(r.total_amount || 0), 0) || 0,
    totalExpensesBudgeted: expenses?.reduce((sum, e) => sum + Number(e.total_amount || 0), 0) || 0,
    projectedResult: 0,
    totalRevenuesRealized: execution?.reduce((sum, e) => sum + Number(e.total_revenue_realized || 0), 0) || 0,
    totalExpensesRealized: execution?.reduce((sum, e) => sum + Number(e.total_expense_realized || 0), 0) || 0,
    actualResult: 0,
    revenueDeviation: 0,
    expenseDeviation: 0,
  };
  summary.projectedResult = summary.totalRevenuesBudgeted - summary.totalExpensesBudgeted;
  summary.actualResult = summary.totalRevenuesRealized - summary.totalExpensesRealized;
  summary.revenueDeviation = summary.totalRevenuesRealized - summary.totalRevenuesBudgeted;
  summary.expenseDeviation = summary.totalExpensesRealized - summary.totalExpensesBudgeted;

  const createRevenueMutation = useMutation({
    mutationFn: async (revenue: Partial<BudgetRevenue>) => {
      const { data, error } = await db.from("union_budget_revenues").insert({ ...revenue, budget_version_id: currentVersion?.id, clinic_id: clinicId, created_by: user?.id }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["union-budget-revenues"] }); toast.success("Receita adicionada!"); },
    onError: (error: Error) => toast.error("Erro: " + error.message),
  });

  const updateRevenueMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<BudgetRevenue> & { id: string }) => {
      const { data, error } = await db.from("union_budget_revenues").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["union-budget-revenues"] }); toast.success("Receita atualizada!"); },
    onError: (error: Error) => toast.error("Erro: " + error.message),
  });

  const deleteRevenueMutation = useMutation({
    mutationFn: async (id: string) => { const { error } = await db.from("union_budget_revenues").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["union-budget-revenues"] }); toast.success("Receita removida!"); },
    onError: (error: Error) => toast.error("Erro: " + error.message),
  });

  const createExpenseMutation = useMutation({
    mutationFn: async (expense: Partial<BudgetExpense>) => {
      const { data, error } = await db.from("union_budget_expenses").insert({ ...expense, budget_version_id: currentVersion?.id, clinic_id: clinicId, created_by: user?.id }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["union-budget-expenses"] }); toast.success("Despesa adicionada!"); },
    onError: (error: Error) => toast.error("Erro: " + error.message),
  });

  const updateExpenseMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<BudgetExpense> & { id: string }) => {
      const { data, error } = await db.from("union_budget_expenses").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["union-budget-expenses"] }); toast.success("Despesa atualizada!"); },
    onError: (error: Error) => toast.error("Erro: " + error.message),
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: async (id: string) => { const { error } = await db.from("union_budget_expenses").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["union-budget-expenses"] }); toast.success("Despesa removida!"); },
    onError: (error: Error) => toast.error("Erro: " + error.message),
  });

  const createVersionMutation = useMutation({
    mutationFn: async (versionName: string) => {
      if (!exerciseId || !currentVersion) throw new Error("Exercício ou versão não encontrada");
      const newVersionNumber = (versions?.length || 0) + 1;
      const { data: newVersion, error } = await db.from("union_budget_versions").insert({ budget_exercise_id: exerciseId, version_number: newVersionNumber, version_name: versionName, is_current: true, created_by: user?.id }).select().single();
      if (error) throw error;
      return newVersion;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["union-budget-versions"] });
      queryClient.invalidateQueries({ queryKey: ["union-budget-current-version"] });
      toast.success("Nova versão criada!");
    },
    onError: (error: Error) => toast.error("Erro: " + error.message),
  });

  return {
    exercise, currentVersion, versions: versions || [], revenues: revenues || [], expenses: expenses || [],
    approvers: approvers || [], execution: execution || [], summary,
    loading: loadingExercise || loadingVersion || loadingRevenues || loadingExpenses,
    createRevenue: createRevenueMutation.mutate, updateRevenue: updateRevenueMutation.mutate, deleteRevenue: deleteRevenueMutation.mutate,
    createExpense: createExpenseMutation.mutate, updateExpense: updateExpenseMutation.mutate, deleteExpense: deleteExpenseMutation.mutate,
    createVersion: createVersionMutation.mutate, refetchRevenues, refetchExpenses, refetchApprovers, refetchExecution,
  };
}
