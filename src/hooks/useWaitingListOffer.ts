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
        .eq("notification_status", "notified")
        .eq("is_active", true)
        .order("slot_offered_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Error fetching waiting list offer:", error);
        return null;
      }

      // Check if offer is still valid (within 2 hours of slot_offered_at)
      if (data && data.slot_offered_at) {
        const offeredAt = new Date(data.slot_offered_at).getTime();
        const now = new Date().getTime();
        const twoHoursInMs = 2 * 60 * 60 * 1000;
        
        if (now - offeredAt > twoHoursInMs) {
          return null;
        }
      }

      return data as WaitingListOffer | null;
    },
    enabled: !!patientId,
    staleTime: 30000,
  });

  // Realtime subscription
  useEffect(() => {
    if (!patientId) return;

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
        () => {
          queryClient.invalidateQueries({ queryKey: ["waiting-list-offer", patientId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [patientId, queryClient]);

  const respondToOffer = async (status: "confirmed" | "declined") => {
    if (!offer) return;

    try {
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
      console.error("Error responding to offer:", error);
      return { success: false, error };
    }
  };

  return {
    offer,
    isLoading,
    respondToOffer
  };
}
