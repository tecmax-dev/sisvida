import { useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";


export interface HomologacaoAppointment {
  id: string;
  clinic_id: string;
  employee_name: string;
  employee_cpf?: string | null;
  company_name: string;
  company_cnpj?: string | null;
  company_phone: string;
  company_email?: string | null;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: string;
  notes?: string | null;
  protocol_number?: string | null;
  professional_id?: string | null;
  service_type_id?: string | null;
  cancellation_reason?: string | null;
  cancelled_at?: string | null;
  confirmed_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  professional?: {
    id: string;
    name: string;
  } | null;
  service_type?: {
    id: string;
    name: string;
    duration_minutes: number;
  } | null;
}

export function useHomologacaoAppointments() {
  const { currentClinic } = useAuth();
  const queryClient = useQueryClient();
  const [isUpdating, setIsUpdating] = useState(false);

  const queryKey = ["homologacao-appointments", currentClinic?.id];

  const { data: appointments, isLoading, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!currentClinic?.id) return [];
      const { data, error } = await supabase
        .from("homologacao_appointments")
        .select(`
          *,
          professional:homologacao_professionals(id, name),
          service_type:homologacao_service_types(id, name, duration_minutes)
        `)
        .eq("clinic_id", currentClinic.id)
        .order("appointment_date", { ascending: true })
        .order("start_time", { ascending: true });
      
      if (error) throw error;
      return (data || []) as HomologacaoAppointment[];
    },
    enabled: !!currentClinic?.id,
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey]);

  const updateAppointment = useCallback(async (
    id: string, 
    updates: Partial<HomologacaoAppointment>
  ): Promise<boolean> => {
    if (!currentClinic?.id) return false;
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from("homologacao_appointments")
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("clinic_id", currentClinic.id);
      
      if (error) throw error;
      
      invalidate();
      return true;
    } catch (err: any) {
      console.error("Error updating appointment:", err);
      toast.error("Erro ao atualizar agendamento: " + err.message);
      return false;
    } finally {
      setIsUpdating(false);
    }
  }, [currentClinic?.id, invalidate]);

  const cancelAppointment = useCallback(async (
    id: string, 
    reason?: string
  ): Promise<boolean> => {
    return updateAppointment(id, {
      status: "cancelled",
      cancellation_reason: reason || null,
      cancelled_at: new Date().toISOString(),
    });
  }, [updateAppointment]);

  const completeAppointment = useCallback(async (id: string): Promise<boolean> => {
    if (!currentClinic?.id) return false;
    setIsUpdating(true);
    try {
      const appointment = appointments?.find(a => a.id === id);
      if (!appointment) throw new Error("Agendamento não encontrado");

      // Use status 'attended' to trigger automatic protocol generation via database trigger
      const { data, error } = await supabase
        .from("homologacao_appointments")
        .update({
          status: "attended",
          confirmed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("clinic_id", currentClinic.id)
        .select("protocol_number")
        .single();
      
      if (error) throw error;
      
      invalidate();
      toast.success(`Atendimento concluído! Protocolo: ${data?.protocol_number || "Gerado"}`);
      return true;
    } catch (err: any) {
      console.error("Error completing appointment:", err);
      toast.error("Erro ao concluir atendimento: " + err.message);
      return false;
    } finally {
      setIsUpdating(false);
    }
  }, [currentClinic?.id, appointments, invalidate]);

  const deleteAppointment = useCallback(async (id: string): Promise<boolean> => {
    if (!currentClinic?.id) return false;
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from("homologacao_appointments")
        .delete()
        .eq("id", id)
        .eq("clinic_id", currentClinic.id);
      
      if (error) throw error;
      
      invalidate();
      toast.success("Agendamento excluído com sucesso");
      return true;
    } catch (err: any) {
      console.error("Error deleting appointment:", err);
      toast.error("Erro ao excluir agendamento: " + err.message);
      return false;
    } finally {
      setIsUpdating(false);
    }
  }, [currentClinic?.id, invalidate]);

  return {
    appointments,
    isLoading,
    isUpdating,
    refetch,
    invalidate,
    updateAppointment,
    cancelAppointment,
    completeAppointment,
    deleteAppointment,
  };
}
