import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMobileAuth } from "@/contexts/MobileAuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export interface WaitingListOffer {
  id: string;
  patient_id: string;
  clinic_id: string;
  offered_appointment_date: string;
  offered_appointment_time: string;
  offered_professional_name: string;
  offered_professional_id: string;
  notification_status: string;
  slot_offered_at: string;
}

export function useWaitingListOffer() {
  const { patientId } = useMobileAuth();
  const queryClient = useQueryClient();

  const { data: offer, isLoading } = useQuery({
    queryKey: ["waiting-list-offer", patientId],
    queryFn: async () => {
      if (!patientId) return null;
      
      console.log("[useWaitingListOffer] Buscando ofertas para:", patientId);

      const { data, error } = await supabase
        .from("waiting_list")
        .select(`
          id, 
          patient_id, 
          clinic_id, 
          offered_appointment_date, 
          offered_appointment_time, 
          offered_professional_name,
          offered_professional_id,
          notification_status,
          slot_offered_at
        `)
        .eq("patient_id", patientId)
        .in("notification_status", ["notified", "notifying"])
        .eq("is_active", true)
        .order("slot_offered_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("[useWaitingListOffer] Erro ao buscar oferta:", error);
        return null;
      }

      if (data) {
        console.log("[useWaitingListOffer] Oferta encontrada:", data.id, "status:", data.notification_status);
        
        // Check if offer is still valid (within 2 hours of slot_offered_at)
        if (data.slot_offered_at) {
          const offeredAt = new Date(data.slot_offered_at).getTime();
          const now = new Date().getTime();
          const twoHoursInMs = 2 * 60 * 60 * 1000;
          
          if (now - offeredAt > twoHoursInMs) {
            console.log("[useWaitingListOffer] Oferta expirada pelo tempo");
            return null;
          }
        }
      } else {
        console.log("[useWaitingListOffer] Nenhuma oferta pendente encontrada");
      }

      return data as WaitingListOffer | null;
    },
    enabled: !!patientId,
    staleTime: 10000,
  });

  // Realtime subscription
  useEffect(() => {
    if (!patientId) return;

    console.log("[useWaitingListOffer] Inscrevendo em tempo real para:", patientId);

    const channel = supabase
      .channel(`waiting-list-offers-${patientId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "waiting_list",
          filter: `patient_id=eq.${patientId}`,
        },
        (payload) => {
          console.log("[useWaitingListOffer] Mudança detectada na waiting_list:", payload.eventType);
          queryClient.invalidateQueries({ queryKey: ["waiting-list-offer", patientId] });
        }
      )
      .subscribe((status) => {
        console.log("[useWaitingListOffer] Status da inscrição realtime:", status);
      });

    return () => {
      console.log("[useWaitingListOffer] Cancelando inscrição realtime");
      supabase.removeChannel(channel);
    };
  }, [patientId, queryClient]);

  const respondToOffer = async (status: "confirmed" | "declined") => {
    if (!offer) return;

    try {
      console.log(`[useWaitingListOffer] Respondendo oferta ${offer.id} com ${status}`);
      const { error } = await supabase
        .from("waiting_list")
        .update({ 
          notification_status: status,
          confirmed_at: status === "confirmed" ? new Date().toISOString() : null
        })
        .eq("id", offer.id);

      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: ["waiting-list-offer", patientId] });
      return { success: true };
    } catch (error) {
      console.error("[useWaitingListOffer] Erro ao responder oferta:", error);
      return { success: false, error };
    }
  };

  return {
    offer,
    isLoading,
    respondToOffer
  };
}
