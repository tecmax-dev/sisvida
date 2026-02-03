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
 * Fetches all employer contributions for a clinic using pagination.
 * Returns the complete list bypassing the 1000 row default limit.
 *
 * Use this when you need ALL contributions for reporting/exports.
 */
export async function fetchAllEmployerContributions<T = any>(
  clinicId: string,
  options?: {
    select?: string;
    pageSize?: number;
  }
): Promise<{ data: T[]; error: Error | null }> {
  const PAGE_SIZE = options?.pageSize ?? 1000;
  const select =
    options?.select ??
    `*,
     employers:employers!employer_contributions_employer_id_fkey (id, name, cnpj, trade_name, email, phone, address, city, state, category_id, registration_number),
     contribution_types:contribution_types!employer_contributions_contribution_type_id_fkey (id, name, description, default_value, is_active)`;

  let allData: T[] = [];
  let from = 0;
  let hasMore = true;

  try {
    while (hasMore) {
      const { data, error } = await supabase
        .from("employer_contributions")
        .select(select)
        .eq("clinic_id", clinicId)
        .range(from, from + PAGE_SIZE - 1)
        .order("competence_year", { ascending: false })
        .order("competence_month", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;

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
    console.error("Error fetching all employer contributions:", error);
    return { data: [], error: error as Error };
  }
}
