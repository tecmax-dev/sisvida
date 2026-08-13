import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Global flag (controlled in Super Admin → Configuração Global) that
 * enables/disables the "Teste gratuitamente" CTA on the public landing.
 * Defaults to true if the row/column can't be read.
 */
export function useTrialSignupEnabled() {
  const [enabled, setEnabled] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await supabase
          .from("global_config")
          .select("trial_signup_enabled")
          .maybeSingle();
        if (mounted && data && typeof (data as any).trial_signup_enabled === "boolean") {
          setEnabled((data as any).trial_signup_enabled);
        }
      } catch {
        // keep default true
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return { enabled, loading };
}