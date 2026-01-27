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
