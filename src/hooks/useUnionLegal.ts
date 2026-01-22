import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type {
  LegalCase,
  LegalCaseEvent,
  LegalCaseDocument,
  LegalDeadline,
  LegalExpense,
  LegalProvision,
  Lawyer,
  LawFirm,
} from "@/types/unionLegal";

// Helper para queries em tabelas novas (tipos ainda não regenerados)
const fromTable = (table: string) => supabase.from(table as any);

// =====================================================
// HOOK: ESCRITÓRIOS JURÍDICOS
// =====================================================
export function useUnionLawFirms(clinicId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: lawFirms, isLoading } = useQuery({
    queryKey: ["union-law-firms", clinicId],
    enabled: !!clinicId,
    queryFn: async () => {
      const { data, error } = await fromTable("union_law_firms")
        .select("*")
        .eq("clinic_id", clinicId)
        .order("name");

      if (error) throw error;
      return (data as unknown) as LawFirm[];
    },
  });

  const createLawFirm = useMutation({
    mutationFn: async (lawFirm: Partial<LawFirm>) => {
      const { data, error } = await fromTable("union_law_firms").insert(lawFirm).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["union-law-firms", clinicId] });
      toast.success("Escritório cadastrado com sucesso");
    },
    onError: (error: any) => toast.error("Erro ao cadastrar escritório: " + error.message),
  });

  const updateLawFirm = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<LawFirm> & { id: string }) => {
      const { data, error } = await fromTable("union_law_firms").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["union-law-firms", clinicId] });
      toast.success("Escritório atualizado com sucesso");
    },
    onError: (error: any) => toast.error("Erro ao atualizar escritório: " + error.message),
  });

  const deleteLawFirm = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await fromTable("union_law_firms").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["union-law-firms", clinicId] });
      toast.success("Escritório removido com sucesso");
    },
    onError: (error: any) => toast.error("Erro ao remover escritório: " + error.message),
  });

  return { lawFirms: lawFirms || [], isLoading, createLawFirm, updateLawFirm, deleteLawFirm };
}

// =====================================================
// HOOK: ADVOGADOS
// =====================================================
export function useUnionLawyers(clinicId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: lawyers, isLoading } = useQuery({
    queryKey: ["union-lawyers", clinicId],
    enabled: !!clinicId,
    queryFn: async () => {
      const { data, error } = await fromTable("union_lawyers")
        .select(`*, law_firm:union_law_firms(*)`)
        .eq("clinic_id", clinicId)
        .order("name");

      if (error) throw error;
      return (data as unknown) as Lawyer[];
    },
  });

  const createLawyer = useMutation({
    mutationFn: async (lawyer: Partial<Lawyer>) => {
      const { data, error } = await fromTable("union_lawyers").insert(lawyer).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["union-lawyers", clinicId] });
      toast.success("Advogado cadastrado com sucesso");
    },
    onError: (error: any) => toast.error("Erro ao cadastrar advogado: " + error.message),
  });

  const updateLawyer = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Lawyer> & { id: string }) => {
      const { data, error } = await fromTable("union_lawyers").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["union-lawyers", clinicId] });
      toast.success("Advogado atualizado com sucesso");
    },
    onError: (error: any) => toast.error("Erro ao atualizar advogado: " + error.message),
  });

  const deleteLawyer = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await fromTable("union_lawyers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["union-lawyers", clinicId] });
      toast.success("Advogado removido com sucesso");
    },
    onError: (error: any) => toast.error("Erro ao remover advogado: " + error.message),
  });

  return { lawyers: lawyers || [], isLoading, createLawyer, updateLawyer, deleteLawyer };
}

// =====================================================
// HOOK: PROCESSOS JURÍDICOS
// =====================================================
export function useUnionLegalCases(clinicId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: cases, isLoading } = useQuery({
    queryKey: ["union-legal-cases", clinicId],
    enabled: !!clinicId,
    queryFn: async () => {
      const { data, error } = await fromTable("union_legal_cases")
        .select(`*, lawyer:union_lawyers(*), law_firm:union_law_firms(*)`)
        .eq("clinic_id", clinicId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data as unknown) as LegalCase[];
    },
  });

  const createCase = useMutation({
    mutationFn: async (legalCase: Partial<LegalCase>) => {
      const { data, error } = await fromTable("union_legal_cases").insert(legalCase).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["union-legal-cases", clinicId] });
      toast.success("Processo cadastrado com sucesso");
    },
    onError: (error: any) => toast.error("Erro ao cadastrar processo: " + error.message),
  });

  const updateCase = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<LegalCase> & { id: string }) => {
      const { data, error } = await fromTable("union_legal_cases").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["union-legal-cases", clinicId] });
      toast.success("Processo atualizado com sucesso");
    },
    onError: (error: any) => toast.error("Erro ao atualizar processo: " + error.message),
  });

  const deleteCase = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await fromTable("union_legal_cases").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["union-legal-cases", clinicId] });
      toast.success("Processo removido com sucesso");
    },
    onError: (error: any) => toast.error("Erro ao remover processo: " + error.message),
  });

  return { cases: cases || [], isLoading, createCase, updateCase, deleteCase };
}

// =====================================================
// HOOK: DETALHES DO PROCESSO
// =====================================================
export function useUnionLegalCaseDetail(caseId: string | undefined, clinicId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: legalCase, isLoading: isLoadingCase } = useQuery({
    queryKey: ["union-legal-case", caseId],
    enabled: !!caseId,
    queryFn: async () => {
      const { data, error } = await fromTable("union_legal_cases")
        .select(`*, lawyer:union_lawyers(*), law_firm:union_law_firms(*)`)
        .eq("id", caseId)
        .single();
      if (error) throw error;
      return (data as unknown) as LegalCase;
    },
  });

  const { data: events } = useQuery({
    queryKey: ["union-legal-case-events", caseId],
    enabled: !!caseId,
    queryFn: async () => {
      const { data, error } = await fromTable("union_legal_case_events")
        .select("*").eq("legal_case_id", caseId).order("event_date", { ascending: false });
      if (error) throw error;
      return (data as unknown) as LegalCaseEvent[];
    },
  });

  const { data: documents } = useQuery({
    queryKey: ["union-legal-case-documents", caseId],
    enabled: !!caseId,
    queryFn: async () => {
      const { data, error } = await fromTable("union_legal_case_documents")
        .select("*").eq("legal_case_id", caseId).order("uploaded_at", { ascending: false });
      if (error) throw error;
      return (data as unknown) as LegalCaseDocument[];
    },
  });

  const { data: deadlines } = useQuery({
    queryKey: ["union-legal-case-deadlines", caseId],
    enabled: !!caseId,
    queryFn: async () => {
      const { data, error } = await fromTable("union_legal_deadlines")
        .select(`*, responsible_lawyer:union_lawyers(*)`).eq("legal_case_id", caseId).order("deadline_date");
      if (error) throw error;
      return (data as unknown) as LegalDeadline[];
    },
  });

  const { data: expenses } = useQuery({
    queryKey: ["union-legal-case-expenses", caseId],
    enabled: !!caseId,
    queryFn: async () => {
      const { data, error } = await fromTable("union_legal_expenses")
        .select("*").eq("legal_case_id", caseId).order("expense_date", { ascending: false });
      if (error) throw error;
      return (data as unknown) as LegalExpense[];
    },
  });

  const { data: provisions } = useQuery({
    queryKey: ["union-legal-case-provisions", caseId],
    enabled: !!caseId,
    queryFn: async () => {
      const { data, error } = await fromTable("union_legal_provisions")
        .select("*").eq("legal_case_id", caseId).order("provision_date", { ascending: false });
      if (error) throw error;
      return (data as unknown) as LegalProvision[];
    },
  });

  const createEvent = useMutation({
    mutationFn: async (event: Partial<LegalCaseEvent>) => {
      const { data, error } = await fromTable("union_legal_case_events").insert(event).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["union-legal-case-events", caseId] });
      toast.success("Andamento registrado");
    },
    onError: (error: any) => toast.error("Erro: " + error.message),
  });

  const createDocument = useMutation({
    mutationFn: async (doc: Partial<LegalCaseDocument>) => {
      const { data, error } = await fromTable("union_legal_case_documents").insert(doc).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["union-legal-case-documents", caseId] });
      toast.success("Documento adicionado");
    },
    onError: (error: any) => toast.error("Erro: " + error.message),
  });

  const createDeadline = useMutation({
    mutationFn: async (deadline: Partial<LegalDeadline>) => {
      const { data, error } = await fromTable("union_legal_deadlines").insert(deadline).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["union-legal-case-deadlines", caseId] });
      queryClient.invalidateQueries({ queryKey: ["union-legal-deadlines", clinicId] });
      toast.success("Prazo cadastrado");
    },
    onError: (error: any) => toast.error("Erro: " + error.message),
  });

  const createExpense = useMutation({
    mutationFn: async (expense: Partial<LegalExpense>) => {
      const { data, error } = await fromTable("union_legal_expenses").insert(expense).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["union-legal-case-expenses", caseId] });
      toast.success("Despesa registrada");
    },
    onError: (error: any) => toast.error("Erro: " + error.message),
  });

  return {
    legalCase,
    events: events || [],
    documents: documents || [],
    deadlines: deadlines || [],
    expenses: expenses || [],
    provisions: provisions || [],
    isLoading: isLoadingCase,
    createEvent, createDocument, createDeadline, createExpense,
  };
}

// =====================================================
// HOOK: PRAZOS (VISÃO GERAL)
// =====================================================
export function useUnionLegalDeadlines(clinicId: string | undefined) {
  const { data: deadlines, isLoading } = useQuery({
    queryKey: ["union-legal-deadlines", clinicId],
    enabled: !!clinicId,
    queryFn: async () => {
      const { data, error } = await fromTable("union_legal_deadlines")
        .select(`*, legal_case:union_legal_cases(case_number, subject), responsible_lawyer:union_lawyers(name)`)
        .eq("clinic_id", clinicId).order("deadline_date");
      if (error) throw error;
      return (data as unknown) as LegalDeadline[];
    },
  });

  return { deadlines: deadlines || [], isLoading };
}

// =====================================================
// HOOK: DESPESAS (VISÃO GERAL)
// =====================================================
export function useUnionLegalExpenses(clinicId: string | undefined) {
  const { data: expenses, isLoading } = useQuery({
    queryKey: ["union-legal-expenses", clinicId],
    enabled: !!clinicId,
    queryFn: async () => {
      const { data, error } = await fromTable("union_legal_expenses")
        .select(`*, legal_case:union_legal_cases(case_number, subject)`)
        .eq("clinic_id", clinicId).order("expense_date", { ascending: false });
      if (error) throw error;
      return (data as unknown) as LegalExpense[];
    },
  });

  return { expenses: expenses || [], isLoading };
}

// =====================================================
// HOOK: ESTATÍSTICAS
// =====================================================
export function useUnionLegalStats(clinicId: string | undefined) {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["union-legal-stats", clinicId],
    enabled: !!clinicId,
    queryFn: async () => {
      const { data: cases } = await fromTable("union_legal_cases")
        .select("status, risk_level, cause_value, estimated_liability").eq("clinic_id", clinicId);

      const today = new Date().toISOString().split("T")[0];
      const { data: pendingDeadlines } = await fromTable("union_legal_deadlines")
        .select("deadline_date, criticality").eq("clinic_id", clinicId).eq("status", "pendente").gte("deadline_date", today);

      const { data: expenses } = await fromTable("union_legal_expenses")
        .select("amount, is_paid").eq("clinic_id", clinicId);

      const casesList = (cases || []) as any[];
      const deadlinesList = (pendingDeadlines || []) as any[];
      const expensesList = (expenses || []) as any[];

      return {
        activeCases: casesList.filter((c) => c.status === "ativo").length,
        totalCases: casesList.length,
        highRiskCases: casesList.filter((c) => c.risk_level === "alto" || c.risk_level === "critico").length,
        totalCauseValue: casesList.reduce((sum, c) => sum + (c.cause_value || 0), 0),
        totalEstimatedLiability: casesList.reduce((sum, c) => sum + (c.estimated_liability || 0), 0),
        pendingDeadlines: deadlinesList.length,
        urgentDeadlines: deadlinesList.filter((d) => {
          const daysUntil = Math.ceil((new Date(d.deadline_date).getTime() - Date.now()) / 86400000);
          return daysUntil <= 7;
        }).length,
        totalExpenses: expensesList.reduce((sum, e) => sum + (e.amount || 0), 0),
        paidExpenses: expensesList.filter((e) => e.is_paid).reduce((sum, e) => sum + (e.amount || 0), 0),
        pendingExpenses: expensesList.filter((e) => !e.is_paid).reduce((sum, e) => sum + (e.amount || 0), 0),
      };
    },
  });

  return { stats, isLoading };
}
