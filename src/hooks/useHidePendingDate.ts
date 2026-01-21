import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { parseDateOnlyToLocalNoon } from "@/lib/date";

/**
 * Hook para buscar a configuração de ocultação de pendências antigas
 * Retorna a data limite e uma função para verificar se uma contribuição deve ser ocultada
 */
export function useHidePendingDate() {
  const { currentClinic } = useAuth();
  const [hidePendingBeforeDate, setHidePendingBeforeDate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSetting = async () => {
      if (!currentClinic?.id) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("clinics")
          .select("hide_pending_before_date")
          .eq("id", currentClinic.id)
          .single();

        if (!error && data?.hide_pending_before_date) {
          setHidePendingBeforeDate(parseDateOnlyToLocalNoon(data.hide_pending_before_date));
        } else {
          setHidePendingBeforeDate(null);
        }
      } catch (error) {
        console.error("[useHidePendingDate] Error:", error);
        setHidePendingBeforeDate(null);
      } finally {
        setLoading(false);
      }
    };

    fetchSetting();
  }, [currentClinic?.id]);

  /**
   * Verifica se uma contribuição deve ser ocultada com base na configuração
   * @param status Status da contribuição
   * @param dueDate Data de vencimento (string ou Date)
   * @returns true se deve ser exibida, false se deve ser ocultada
   */
  const shouldShowContribution = (status: string, dueDate: string | Date | null): boolean => {
    // Se não há data configurada, mostrar tudo
    if (!hidePendingBeforeDate || !dueDate) return true;

    // Apenas ocultar pendentes e vencidas
    if (status !== "pending" && status !== "overdue") return true;

    const dueDateObj = typeof dueDate === "string" ? parseDateOnlyToLocalNoon(dueDate) : dueDate;
    return dueDateObj >= hidePendingBeforeDate;
  };

  return {
    hidePendingBeforeDate,
    loading,
    shouldShowContribution,
  };
}
