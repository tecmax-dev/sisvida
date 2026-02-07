import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SINDICATO_CLINIC_ID } from "@/constants/sindicato";

interface AppAvailabilityData {
  isUnavailable: boolean;
  message: string | null;
  clinicName: string;
  clinicPhone: string | null;
  loading: boolean;
}

/**
 * Hook para verificar se o app está disponível para uso.
 * Usado no MobileAppLayout para mostrar tela de indisponibilidade.
 * 
 * IMPORTANTE: Verifica novamente ao focar no app para capturar mudanças.
 */
export function useAppAvailability(): AppAvailabilityData {
  const [data, setData] = useState<AppAvailabilityData>({
    isUnavailable: false,
    message: null,
    clinicName: "Sindicato",
    clinicPhone: null,
    loading: true,
  });

  const checkAvailability = useCallback(async () => {
    try {
      const clinicId = localStorage.getItem('mobile_clinic_id') || SINDICATO_CLINIC_ID;

      // Adicionar timestamp para evitar cache
      const timestamp = Date.now();
      console.log(`[useAppAvailability] Checking availability at ${timestamp}`);

      const { data: clinic, error } = await supabase
        .from("clinics")
        .select("name, phone, app_unavailable, app_unavailable_message")
        .eq("id", clinicId)
        .single();

      if (error) {
        console.error("[useAppAvailability] Error fetching clinic:", error);
        setData(prev => ({ ...prev, loading: false }));
        return;
      }

      console.log("[useAppAvailability] Result:", { 
        app_unavailable: clinic?.app_unavailable,
        message: clinic?.app_unavailable_message 
      });

      setData({
        isUnavailable: clinic?.app_unavailable || false,
        message: clinic?.app_unavailable_message || null,
        clinicName: clinic?.name || "Sindicato",
        clinicPhone: clinic?.phone || null,
        loading: false,
      });
    } catch (err) {
      console.error("[useAppAvailability] Error:", err);
      setData(prev => ({ ...prev, loading: false }));
    }
  }, []);

  // Verificar na montagem
  useEffect(() => {
    checkAvailability();
  }, [checkAvailability]);

  // Verificar quando o app ganha foco (útil para PWA)
  useEffect(() => {
    const handleFocus = () => {
      console.log("[useAppAvailability] Window focused, re-checking...");
      checkAvailability();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log("[useAppAvailability] Page visible, re-checking...");
        checkAvailability();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [checkAvailability]);

  return data;
}
