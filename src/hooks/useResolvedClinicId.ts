import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Resolve clinicId in scenarios where the session contains patientId but clinicId
 * is missing (common in mobile/PWA flows after storage cleanup or token refresh).
 * 
 * @param patientId - ID do paciente (opcional)
 * @param clinicId - ID da clínica já conhecido (opcional)
 * @param fallbackClinicId - ID da clínica a usar se não conseguir resolver de outras formas (opcional)
 */
export function useResolvedClinicId(
  patientId: string | null, 
  clinicId: string | null,
  fallbackClinicId?: string | null
) {
  const [effectiveClinicId, setEffectiveClinicId] = useState<string | null>(clinicId ?? null);
  const [isResolvingClinicId, setIsResolvingClinicId] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const resolve = async () => {
      // Prefer explicit clinicId
      if (clinicId) {
        setEffectiveClinicId(clinicId);
        setIsResolvingClinicId(false);
        return;
      }

      // Try to resolve from patientId
      if (patientId) {
        setIsResolvingClinicId(true);
        try {
          const { data, error } = await supabase
            .from("patients")
            .select("clinic_id")
            .eq("id", patientId)
            .maybeSingle();

          if (cancelled) return;

          if (!error && data?.clinic_id) {
            setEffectiveClinicId(data.clinic_id);
            setIsResolvingClinicId(false);
            return;
          }
        } catch (e) {
          console.warn("[Push] Could not resolve clinicId from patientId:", e);
        } finally {
          if (!cancelled) setIsResolvingClinicId(false);
        }
      }

      // Use fallback if available
      if (fallbackClinicId) {
        setEffectiveClinicId(fallbackClinicId);
        setIsResolvingClinicId(false);
        return;
      }

      // Nothing resolved
      setEffectiveClinicId(null);
      setIsResolvingClinicId(false);
    };

    resolve();
    return () => {
      cancelled = true;
    };
  }, [patientId, clinicId, fallbackClinicId]);

  return { effectiveClinicId, isResolvingClinicId };
}
