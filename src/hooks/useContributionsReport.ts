import { useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ContributionReportFilters {
  startDate: string;
  endDate: string;
  dateFilterType: "competence" | "due_date" | "paid_at";
  status: string; // "all" | "hide_cancelled" | "paid" | "pending" | "overdue" | "cancelled"
  employerId?: string;
  contributionTypeIds?: string[]; // Array de IDs de tipos de contribuição
  origin?: string; // "all" | "pj" | "pf"
  searchTerm?: string;
}

export interface ContributionReportItem {
  id: string;
  employer_id: string;
  contribution_type_id: string;
  competence_month: number;
  competence_year: number;
  value: number;
  due_date: string;
  status: string;
  paid_at: string | null;
  paid_value: number | null;
  payment_method: string | null;
  origin: string | null;
  lytex_fee_amount: number | null;
  net_value: number | null;
  is_reconciled: boolean | null;
  has_divergence: boolean | null;
  lytex_invoice_id: string | null;
  member_id: string | null;
  employers: {
    id: string;
    name: string;
    cnpj: string;
    trade_name: string | null;
    registration_number: string | null;
  } | null;
  contribution_types: {
    id: string;
    name: string;
  } | null;
}

export interface ReportSummary {
  total: number;
  paid: number;
  pending: number;
  overdue: number;
  cancelled: number;
  count: number;
  totalFees: number;
  totalNet: number;
}

export interface ByEmployerReportItem {
  employer: {
    id: string;
    name: string;
    cnpj: string;
    trade_name: string | null;
    registration_number: string | null;
  };
  total: number;
  paid: number;
  pending: number;
  overdue: number;
  count: number;
}

const PAGE_SIZE = 1000;

/**
 * Hook para buscar contribuições com filtros aplicados diretamente no banco.
 * Resolve o problema de filtragem apenas no frontend que não escala com alto volume de dados.
 */
export function useContributionsReport(clinicId: string | undefined) {
  const [contributions, setContributions] = useState<ContributionReportItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFilters, setLastFilters] = useState<ContributionReportFilters | null>(null);

  const fetchContributions = useCallback(async (filters: ContributionReportFilters) => {
    if (!clinicId) {
      setError("Clínica não selecionada");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log("[useContributionsReport] Fetching with filters:", JSON.stringify(filters, null, 2));
      console.log("[useContributionsReport] Date range:", filters.startDate, "to", filters.endDate);

      let allData: ContributionReportItem[] = [];
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        // Construir query base
        let query = supabase
          .from("employer_contributions")
          .select(`
            id, employer_id, contribution_type_id,
            competence_month, competence_year, value, due_date,
            status, paid_at, paid_value, payment_method,
            origin, lytex_fee_amount, net_value, is_reconciled,
            has_divergence, lytex_invoice_id, member_id,
            employers (id, name, cnpj, trade_name, registration_number),
            contribution_types (id, name)
          `)
          .eq("clinic_id", clinicId)
          .range(from, from + PAGE_SIZE - 1);

        // Aplicar filtro de status NO BANCO (não no frontend)
        // Statuses válidos para relatório: paid, pending, overdue, cancelled
        // Statuses especiais (não devem aparecer no relatório geral): awaiting_value, negotiated
        if (filters.status === "hide_cancelled") {
          // Mostrar apenas paid, pending, overdue (ocultar cancelled, awaiting_value, negotiated)
          query = query.in("status", ["paid", "pending", "overdue"]);
        } else if (filters.status === "all") {
          // Mostrar todos os status principais (ocultar apenas awaiting_value e negotiated)
          query = query.in("status", ["paid", "pending", "overdue", "cancelled"]);
        } else if (filters.status === "defaulting") {
          // Relatório de inadimplência: mostrar apenas pending e overdue
          query = query.in("status", ["pending", "overdue"]);
        } else {
          query = query.eq("status", filters.status);
        }

        // Filtro de origem (PJ vs PF)
        if (filters.origin === "pj") {
          query = query.is("member_id", null);
        } else if (filters.origin === "pf") {
          query = query.not("member_id", "is", null);
        }

        // Filtro por empresa
        if (filters.employerId) {
          query = query.eq("employer_id", filters.employerId);
        }

        // Filtro por tipos de contribuição (múltiplos)
        if (filters.contributionTypeIds && filters.contributionTypeIds.length > 0) {
          query = query.in("contribution_type_id", filters.contributionTypeIds);
        }

        // Aplicar filtro de data conforme o tipo selecionado
        if (filters.dateFilterType === "competence") {
          // Para competência, precisamos filtrar por mês/ano
          const startD = new Date(filters.startDate + "T12:00:00");
          const endD = new Date(filters.endDate + "T12:00:00");
          
          // Filtro: (competence_year > startYear) OR (competence_year = startYear AND competence_month >= startMonth)
          // AND (competence_year < endYear) OR (competence_year = endYear AND competence_month <= endMonth)
          const startYear = startD.getFullYear();
          const startMonth = startD.getMonth() + 1;
          const endYear = endD.getFullYear();
          const endMonth = endD.getMonth() + 1;

          query = query
            .gte("competence_year", startYear)
            .lte("competence_year", endYear);

          // Para filtros mais precisos em meses, aplicamos lógica no fetch
          // (Supabase não suporta OR complexo facilmente)
        } else if (filters.dateFilterType === "due_date") {
          query = query
            .gte("due_date", filters.startDate)
            .lte("due_date", filters.endDate);
        } else if (filters.dateFilterType === "paid_at") {
          query = query
            .not("paid_at", "is", null)
            .gte("paid_at", filters.startDate + "T00:00:00")
            .lte("paid_at", filters.endDate + "T23:59:59");
        }

        // Ordenação
        query = query
          .order("competence_year", { ascending: false })
          .order("competence_month", { ascending: false });

        const { data, error: queryError } = await query;

        if (queryError) {
          throw queryError;
        }

        if (data && data.length > 0) {
          // Filtro adicional para competência preciso (mês específico)
          let filtered = data as ContributionReportItem[];
          
          if (filters.dateFilterType === "competence") {
            const startD = new Date(filters.startDate + "T12:00:00");
            const endD = new Date(filters.endDate + "T12:00:00");
            const startYear = startD.getFullYear();
            const startMonth = startD.getMonth() + 1;
            const endYear = endD.getFullYear();
            const endMonth = endD.getMonth() + 1;

            filtered = filtered.filter(c => {
              const cy = c.competence_year;
              const cm = c.competence_month;
              
              // Início: cy > startYear OU (cy === startYear E cm >= startMonth)
              const afterStart = cy > startYear || (cy === startYear && cm >= startMonth);
              
              // Fim: cy < endYear OU (cy === endYear E cm <= endMonth)
              const beforeEnd = cy < endYear || (cy === endYear && cm <= endMonth);
              
              return afterStart && beforeEnd;
            });
          }

          allData = [...allData, ...filtered];
          from += PAGE_SIZE;
          hasMore = data.length === PAGE_SIZE;
        } else {
          hasMore = false;
        }
      }

      console.log(`[useContributionsReport] Total found: ${allData.length} contributions`);
      if (filters.employerId) {
        console.log(`[useContributionsReport] Filtered by employer: ${filters.employerId}`);
      }
      console.log("[useContributionsReport] Status filter used:", filters.status);
      
      setContributions(allData);
      setLastFilters(filters);
    } catch (err) {
      console.error("[useContributionsReport] Erro:", err);
      setError(err instanceof Error ? err.message : "Erro ao buscar contribuições");
    } finally {
      setLoading(false);
    }
  }, [clinicId]);

  // Calcular sumário
  const summary = useMemo((): ReportSummary => {
    const total = contributions.reduce((acc, c) => acc + c.value, 0);
    const paid = contributions
      .filter((c) => c.status === "paid")
      .reduce((acc, c) => acc + (c.paid_value || c.value), 0);
    const pending = contributions
      .filter((c) => c.status === "pending")
      .reduce((acc, c) => acc + c.value, 0);
    const overdue = contributions
      .filter((c) => c.status === "overdue")
      .reduce((acc, c) => acc + c.value, 0);
    const cancelled = contributions
      .filter((c) => c.status === "cancelled")
      .reduce((acc, c) => acc + c.value, 0);
    
    const totalFees = contributions.reduce((acc, c) => acc + (c.lytex_fee_amount || 0), 0);
    const totalNet = contributions
      .filter((c) => c.status === "paid")
      .reduce((acc, c) => acc + (c.net_value || c.paid_value || c.value), 0);

    return { 
      total, 
      paid, 
      pending, 
      overdue, 
      cancelled,
      count: contributions.length, 
      totalFees, 
      totalNet 
    };
  }, [contributions]);

  // Relatório por empresa
  const byEmployerReport = useMemo((): ByEmployerReportItem[] => {
    const data = new Map<string, ByEmployerReportItem>();

    contributions.forEach((c) => {
      if (!c.employers) return;
      
      const existing = data.get(c.employer_id) || {
        employer: c.employers,
        total: 0,
        paid: 0,
        pending: 0,
        overdue: 0,
        count: 0,
      };

      existing.total += c.value;
      existing.count += 1;
      
      if (c.status === "paid") {
        existing.paid += c.paid_value || c.value;
      } else if (c.status === "pending") {
        existing.pending += c.value;
      } else if (c.status === "overdue") {
        existing.overdue += c.value;
      }

      data.set(c.employer_id, existing);
    });

    return Array.from(data.values()).sort((a, b) => b.total - a.total);
  }, [contributions]);

  return {
    contributions,
    loading,
    error,
    fetchContributions,
    summary,
    byEmployerReport,
    lastFilters,
  };
}
