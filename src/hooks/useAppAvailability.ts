import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SINDICATO_CLINIC_ID } from "@/constants/sindicato";
import { getPreloadedAvailability, getAvailabilityPromise } from "@/mobileBootstrap";

interface AppAvailabilityData {
  isUnavailable: boolean;
  message: string | null;
  clinicName: string;
  clinicPhone: string | null;
  loading: boolean;
}

/**
 * Hook para verificar se o app está disponível para uso.
 * Usa dados pré-carregados do bootstrap para evitar loading extra.
 * Re-verifica ao focar no app para capturar mudanças.
 */
export function useAppAvailability(): AppAvailabilityData {
  const [data, setData] = useState<AppAvailabilityData>(() => {
    // Tentar usar resultado pré-carregado do bootstrap (sem loading!)
    const preloaded = getPreloadedAvailability();
    if (preloaded) {
      return {
        isUnavailable: preloaded.isUnavailable,
        message: preloaded.message,
        clinicName: preloaded.clinicName,
        clinicPhone: preloaded.clinicPhone,
        loading: false,
      };
    }
    return {
      isUnavailable: false,
      message: null,
      clinicName: "Sindicato",
      clinicPhone: null,
      loading: true,
    };
  });

  const fetchAvailability = useCallback(async () => {
    try {
      const clinicId = localStorage.getItem('mobile_clinic_id') || SINDICATO_CLINIC_ID;
      const { data: clinic, error } = await supabase
        .from("clinics")
        .select("name, phone, app_unavailable, app_unavailable_message, is_maintenance, maintenance_reason")
        .eq("id", clinicId)
        .single();

      if (error) {
        console.error("[useAppAvailability] Error:", error);
        setData(prev => ({ ...prev, loading: false }));
        return;
      }

      setData({
        isUnavailable: !!(clinic?.app_unavailable || (clinic? as any)?.is_maintenance),
        message: clinic?.app_unavailable_message || (clinic? as any)?.maintenance_reason || null,
        clinicName: clinic?.name || "Sindicato",
        clinicPhone: clinic?.phone || null,
        loading: false,
      });
    } catch (err) {
      console.error("[useAppAvailability] Error:", err);
      setData(prev => ({ ...prev, loading: false }));
    }
  }, []);

  // Na montagem: usar promise pré-carregada se ainda loading, senão já temos dados
  useEffect(() => {
    if (data.loading) {
      // Usar a promise já em andamento do bootstrap (não faz nova query)
      getAvailabilityPromise().then(result => {
        setData({
          isUnavailable: result.isUnavailable,
          message: result.message,
          clinicName: result.clinicName,
          clinicPhone: result.clinicPhone,
          loading: false,
        });
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-verificar quando o app ganha foco (útil para PWA)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchAvailability();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [fetchAvailability]);

  return data;
}