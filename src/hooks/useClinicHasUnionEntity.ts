import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Hook to check if the current clinic has a linked union entity.
 * Used to conditionally show/hide the "Módulo Sindical" menu option.
 */
export function useClinicHasUnionEntity() {
  const { currentClinic } = useAuth();

  const { data: hasUnionEntity, isLoading } = useQuery({
    queryKey: ['clinic-has-union-entity', currentClinic?.id],
    queryFn: async () => {
      if (!currentClinic?.id) return false;

      const { data, error } = await supabase
        .from('union_entities')
        .select('id')
        .eq('clinic_id', currentClinic.id)
        .maybeSingle();

      if (error) {
        console.error('Error checking union entity:', error);
        return false;
      }

      return !!data;
    },
    enabled: !!currentClinic?.id,
    staleTime: 10 * 60 * 1000, // 10 minutes cache
    gcTime: 15 * 60 * 1000, // 15 minutes garbage collection
  });

  return { 
    hasUnionEntity: hasUnionEntity ?? false, 
    isLoading 
  };
}
