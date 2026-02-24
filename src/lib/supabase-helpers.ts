import { supabase } from "@/integrations/supabase/client";

/**
 * Fetches all employers for a clinic using pagination.
 * Returns the complete list bypassing the 1000 row default limit.
 * 
 * Use this when you need ALL employers (reports, imports, validations).
 * For search/autocomplete, use server-side search with .limit(50) instead.
 */
export async function fetchAllEmployers<T = {
  id: string;
  name: string;
  cnpj: string;
  trade_name?: string | null;
  registration_number?: string | null;
}>(
  clinicId: string,
  options?: {
    select?: string;
    activeOnly?: boolean;
  }
): Promise<{ data: T[]; error: Error | null }> {
  const PAGE_SIZE = 1000;
  const select = options?.select || "id, name, cnpj, trade_name, registration_number";
  const activeOnly = options?.activeOnly !== false;
  
  let allData: T[] = [];
  let from = 0;
  let hasMore = true;

  try {
    while (hasMore) {
      let queryBuilder = supabase
        .from("employers")
        .select(select)
        .eq("clinic_id", clinicId)
        .range(from, from + PAGE_SIZE - 1)
        .order("name");

      if (activeOnly) {
        queryBuilder = queryBuilder.eq("is_active", true);
      }

      const { data, error } = await queryBuilder;

      if (error) {
        throw error;
      }

      if (data && data.length > 0) {
        allData = [...allData, ...(data as T[])];
        from += PAGE_SIZE;
        hasMore = data.length === PAGE_SIZE;
      } else {
        hasMore = false;
      }
    }

    return { data: allData, error: null };
  } catch (error) {
    console.error("Error fetching all employers:", error);
    return { data: [], error: error as Error };
  }
}

/**
 * Fetches all employer contributions for a clinic and year using pagination.
 * Returns the complete list bypassing the 1000 row default limit.
 */
export async function fetchAllContributions<T = Record<string, unknown>>(
  clinicId: string,
  yearFilter?: number | null,
  options?: {
    select?: string;
  }
): Promise<{ data: T[]; error: Error | null }> {
  const PAGE_SIZE = 1000;
  const select = options?.select || `
    *,
    employers (id, name, cnpj, trade_name, email, phone, address, city, state, category_id, registration_number),
    contribution_types (id, name, description, default_value, is_active),
    patients:member_id (id, name, cpf)
  `;

  let allData: T[] = [];
  let from = 0;
  let hasMore = true;

  try {
    while (hasMore) {
      let query = supabase
        .from("employer_contributions")
        .select(select)
        .eq("clinic_id", clinicId);

      if (yearFilter != null) {
        query = query.eq("competence_year", yearFilter);
      }

      query = query
        .order("competence_year", { ascending: false })
        .order("competence_month", { ascending: false })
        .order("created_at", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      if (data && data.length > 0) {
        allData = [...allData, ...(data as T[])];
        from += PAGE_SIZE;
        hasMore = data.length === PAGE_SIZE;
      } else {
        hasMore = false;
      }
    }

    return { data: allData, error: null };
  } catch (error) {
    console.error("Error fetching all contributions:", error);
    return { data: [], error: error as Error };
  }
}

/**
 * Fetches all patients for a clinic using pagination.
 * Returns the complete list bypassing the 1000 row default limit.
 *
 * Use this when you need ALL patients (imports, audits, validations).
 */
export async function fetchAllPatients<T = {
  id: string;
  name: string;
  cpf: string | null;
  employer_cnpj?: string | null;
  employer_name?: string | null;
  is_active?: boolean | null;
  is_union_member?: boolean | null;
}>(
  clinicId: string,
  options?: {
    select?: string;
    activeOnly?: boolean;
  }
): Promise<{ data: T[]; error: Error | null }> {
  const PAGE_SIZE = 1000;
  const select = options?.select || "id, name, cpf, employer_cnpj, employer_name, is_active, is_union_member";
  const activeOnly = options?.activeOnly === true;

  let allData: T[] = [];
  let from = 0;
  let hasMore = true;

  try {
    while (hasMore) {
      let queryBuilder = supabase
        .from("patients")
        .select(select)
        .eq("clinic_id", clinicId)
        .range(from, from + PAGE_SIZE - 1)
        .order("name");

      if (activeOnly) {
        queryBuilder = queryBuilder.eq("is_active", true);
      }

      const { data, error } = await queryBuilder;

      if (error) {
        throw error;
      }

      if (data && data.length > 0) {
        allData = [...allData, ...(data as T[])];
        from += PAGE_SIZE;
        hasMore = data.length === PAGE_SIZE;
      } else {
        hasMore = false;
      }
    }

    return { data: allData, error: null };
  } catch (error) {
    console.error("Error fetching all patients:", error);
    return { data: [], error: error as Error };
  }
}
/**
 * Fetches negotiation installments for a clinic and year.
 */
export async function fetchNegotiationInstallments<T = Record<string, unknown>>(
  clinicId: string,
  yearFilter?: number | null,
): Promise<{ data: T[]; error: Error | null }> {
  const PAGE_SIZE = 1000;
  
  let allData: T[] = [];
  let from = 0;
  let hasMore = true;

  try {
    while (hasMore) {
      // Join with debt_negotiations to filter by clinic_id and get employer info
      let query = supabase
        .from("negotiation_installments")
        .select(`
          *,
          negotiation:debt_negotiations!inner (
            id,
            clinic_id,
            negotiation_code,
            employer_id,
            employers (id, name, cnpj, trade_name, email, phone, address, city, state, registration_number)
          )
        `)
        .eq("negotiation.clinic_id", clinicId);

      // Filter by due date year if provided
      if (yearFilter != null) {
        // This is an approximation as Supabase doesn't support filtering by year on date column directly in simple query
        // We'll filter in memory or use date range
        const startDate = `${yearFilter}-01-01`;
        const endDate = `${yearFilter}-12-31`;
        query = query.gte("due_date", startDate).lte("due_date", endDate);
      }

      query = query
        .order("due_date", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      if (data && data.length > 0) {
        allData = [...allData, ...(data as T[])];
        from += PAGE_SIZE;
        hasMore = data.length === PAGE_SIZE;
      } else {
        hasMore = false;
      }
    }

    return { data: allData, error: null };
  } catch (error) {
    console.error("Error fetching negotiation installments:", error);
    return { data: [], error: error as Error };
  }
}
