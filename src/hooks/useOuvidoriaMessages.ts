import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

export type OuvidoriaMessageType = 'sugestao' | 'elogio' | 'reclamacao' | 'denuncia';
export type OuvidoriaStatus = 'pending' | 'in_progress' | 'resolved' | 'archived';

export interface OuvidoriaMessage {
  id: string;
  clinic_id: string;
  patient_id: string | null;
  patient_name: string | null;
  patient_cpf: string | null;
  patient_phone: string | null;
  patient_email: string | null;
  message_type: OuvidoriaMessageType;
  message: string;
  status: OuvidoriaStatus;
  admin_notes: string | null;
  responded_by: string | null;
  responded_at: string | null;
  is_anonymous: boolean;
  created_at: string;
  updated_at: string;
}

export const MESSAGE_TYPE_LABELS: Record<OuvidoriaMessageType, { label: string; color: string }> = {
  sugestao: { label: 'Sugestão', color: 'bg-blue-100 text-blue-800' },
  elogio: { label: 'Elogio', color: 'bg-green-100 text-green-800' },
  reclamacao: { label: 'Reclamação', color: 'bg-amber-100 text-amber-800' },
  denuncia: { label: 'Denúncia', color: 'bg-red-100 text-red-800' },
};

export const STATUS_LABELS: Record<OuvidoriaStatus, { label: string; color: string }> = {
  pending: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800' },
  in_progress: { label: 'Em Andamento', color: 'bg-blue-100 text-blue-800' },
  resolved: { label: 'Resolvido', color: 'bg-green-100 text-green-800' },
  archived: { label: 'Arquivado', color: 'bg-gray-100 text-gray-800' },
};

export function useOuvidoriaMessages(status?: OuvidoriaStatus) {
  const { currentClinic } = useAuth();

  return useQuery({
    queryKey: ["ouvidoria-messages", currentClinic?.id, status],
    queryFn: async () => {
      if (!currentClinic?.id) return [];

      let query = supabase
        .from("ouvidoria_messages")
        .select("*")
        .eq("clinic_id", currentClinic.id)
        .order("created_at", { ascending: false });

      if (status) {
        query = query.eq("status", status);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching ouvidoria messages:", error);
        throw error;
      }

      return data as OuvidoriaMessage[];
    },
    enabled: !!currentClinic?.id,
  });
}

export function useUpdateOuvidoriaMessage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<OuvidoriaMessage> & { id: string }) => {
      const updateData: Record<string, unknown> = {};
      
      if (updates.status !== undefined) {
        updateData.status = updates.status;
        if (updates.status === 'resolved' || updates.status === 'archived') {
          updateData.responded_by = user?.id;
          updateData.responded_at = new Date().toISOString();
        }
      }
      if (updates.admin_notes !== undefined) updateData.admin_notes = updates.admin_notes;

      const { error } = await supabase
        .from("ouvidoria_messages")
        .update(updateData)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ouvidoria-messages"] });
      toast({
        title: "Sucesso",
        description: "Mensagem atualizada com sucesso!",
      });
    },
    onError: (error) => {
      console.error("Error updating ouvidoria message:", error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar mensagem",
        variant: "destructive",
      });
    },
  });
}

export function useDeleteOuvidoriaMessage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("ouvidoria_messages")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ouvidoria-messages"] });
      toast({
        title: "Sucesso",
        description: "Mensagem removida com sucesso!",
      });
    },
    onError: (error) => {
      console.error("Error deleting ouvidoria message:", error);
      toast({
        title: "Erro",
        description: "Erro ao remover mensagem",
        variant: "destructive",
      });
    },
  });
}
