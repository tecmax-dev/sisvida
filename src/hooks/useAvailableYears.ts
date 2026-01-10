import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook that returns available years for contribution filters.
 * Fetches distinct years from employer_contributions and ensures
 * at least the current year and next year are included.
 */
export function useAvailableYears() {
  const [years, setYears] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchYears = async () => {
      try {
        const { data, error } = await supabase
          .from("employer_contributions")
          .select("competence_year")
          .order("competence_year", { ascending: true });

        if (error) throw error;

        // Get unique years from database
        const dbYears = [...new Set(data?.map(d => d.competence_year) || [])];
        
        // Ensure current year and next year are always included
        const currentYear = new Date().getFullYear();
        const nextYear = currentYear + 1;
        
        const allYears = new Set([...dbYears, currentYear, nextYear]);
        
        // Sort descending (newest first)
        const sortedYears = Array.from(allYears).sort((a, b) => b - a);
        
        setYears(sortedYears);
      } catch (error) {
        console.error("Error fetching available years:", error);
        // Fallback to default range
        const currentYear = new Date().getFullYear();
        setYears([currentYear + 1, currentYear, currentYear - 1, currentYear - 2, currentYear - 3]);
      } finally {
        setLoading(false);
      }
    };

    fetchYears();
  }, []);

  return { years, loading };
}

/**
 * Returns a static list of years for forms that don't need database data.
 * Includes years from 2020 to next year.
 */
export function getStaticYearRange(): number[] {
  const currentYear = new Date().getFullYear();
  const startYear = 2020;
  const endYear = currentYear + 1;
  
  const years: number[] = [];
  for (let year = endYear; year >= startYear; year--) {
    years.push(year);
  }
  return years;
}
