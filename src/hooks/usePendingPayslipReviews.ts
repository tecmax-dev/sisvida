import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SINDICATO_CLINIC_ID } from "@/constants/sindicato";

/**
 * Returns the count of payslip requests waiting for evaluation
 * (status = 'received') in the union module's clinic.
 */
export function usePendingPayslipReviews() {
  const { currentClinic, userRoles } = useAuth();
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const resolvedClinic = useMemo(
    () => userRoles.find((role) => role.clinic_id === SINDICATO_CLINIC_ID)?.clinic || currentClinic,
    [currentClinic, userRoles]
  );
  const clinicId = resolvedClinic?.id;

  useEffect(() => {
    if (!clinicId) {
      setCount(0);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchCount = async () => {
      try {
        const { count: pending } = await supabase
          .from("payslip_requests")
          .select("id", { count: "exact", head: true })
          .eq("clinic_id", clinicId)
          .eq("status", "received");

        if (!cancelled) setCount(pending || 0);
      } catch (err) {
        console.error("Error fetching pending payslip reviews count:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchCount();
    const interval = setInterval(fetchCount, 30000);

    // Realtime: atualiza contagem assim que houver mudanças nos pedidos
    const channel = supabase
      .channel(`payslip-reviews-${clinicId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "payslip_requests",
          filter: `clinic_id=eq.${clinicId}`,
        },
        () => fetchCount()
      )
      .subscribe();

    return () => {
      cancelled = true;
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [clinicId]);

  return { count, loading };
}
