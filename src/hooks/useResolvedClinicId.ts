import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Resolve clinicId in scenarios where the session contains patientId but clinicId
 * is missing (common in mobile/PWA flows after storage cleanup or token refresh).
 */
export function useResolvedClinicId(patientId: string | null, clinicId: string | null) {
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

      // If we can't resolve, clear state
      if (!patientId) {
        setEffectiveClinicId(null);
        setIsResolvingClinicId(false);
        return;
      }

      setIsResolvingClinicId(true);
      try {
        const { data, error } = await supabase
          .from("patients")
          .select("clinic_id")
          .eq("id", patientId)
          .maybeSingle();

        if (cancelled) return;

        if (error) {
          console.warn("[Push] Could not resolve clinicId from patientId:", error);
          setEffectiveClinicId(null);
        } else {
          setEffectiveClinicId(data?.clinic_id ?? null);
        }
      } finally {
        if (!cancelled) setIsResolvingClinicId(false);
      }
    };

    resolve();
    return () => {
      cancelled = true;
    };
  }, [patientId, clinicId]);

  return { effectiveClinicId, isResolvingClinicId };
}
