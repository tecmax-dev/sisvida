import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function usePendingFiliacoes() {
  const { currentClinic } = useAuth();
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentClinic?.id) return;

    const fetchCount = async () => {
      try {
        const { data: ue } = await supabase
          .from("union_entities")
          .select("id")
          .eq("clinic_id", currentClinic.id)
          .eq("status", "ativa")
          .limit(1)
          .maybeSingle();

        if (!ue) {
          setCount(0);
          setLoading(false);
          return;
        }

        const { count: pendingCount } = await supabase
          .from("sindical_associados")
          .select("id", { count: "exact", head: true })
          .eq("sindicato_id", ue.id)
          .eq("status", "pendente");

        setCount(pendingCount || 0);
      } catch (err) {
        console.error("Error fetching pending filiacoes count:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchCount();

    // Refresh every 60 seconds
    const interval = setInterval(fetchCount, 60000);
    return () => clearInterval(interval);
  }, [currentClinic?.id]);

  return { count, loading };
}
