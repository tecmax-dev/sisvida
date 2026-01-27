import { useQuery } from "@tanstack/react-query";
import { parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

/**
 * Retorna a data limite (inclusive) para agendamentos da clínica.
 * - `null` = sem restrição
 * - parseISO evita shift de timezone em strings YYYY-MM-DD
 */
export function useClinicBookingWindowEndDate(clinicId?: string | null) {
  return useQuery({
    queryKey: ["clinic-booking-window-end-date", clinicId],
    enabled: !!clinicId,
    queryFn: async (): Promise<Date | null> => {
      if (!clinicId) return null;

      const { data, error } = await supabase.rpc("get_booking_window_end_date", {
        p_clinic_id: clinicId,
      });

      if (error) throw error;
      if (!data) return null;

      return parseISO(String(data));
    },
    staleTime: 60_000,
  });
}
