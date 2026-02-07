import { useState, useEffect } from "react";
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
 */
export function useAppAvailability(): AppAvailabilityData {
  const [data, setData] = useState<AppAvailabilityData>({
    isUnavailable: false,
    message: null,
    clinicName: "Sindicato",
    clinicPhone: null,
    loading: true,
  });

  useEffect(() => {
    const checkAvailability = async () => {
      try {
        const clinicId = localStorage.getItem('mobile_clinic_id') || SINDICATO_CLINIC_ID;

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
    };

    checkAvailability();
  }, []);

  return data;
}
