import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface PopupNotice {
  id: string;
  clinic_id: string;
  title: string;
  message: string | null;
  image_url: string | null;
  button_text: string | null;
  button_link: string | null;
  is_active: boolean;
  show_once_per_session: boolean;
  priority: number;
  starts_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export type PopupNoticeInput = Omit<PopupNotice, "id" | "created_at" | "updated_at" | "created_by">;

// Hook para buscar avisos ativos (para o app mobile)
export function useActivePopupNotices(clinicId: string | null) {
  return useQuery({
    queryKey: ["popup-notices-active", clinicId],
    queryFn: async () => {
      if (!clinicId) return [];
      
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("popup_notices")
        .select("*")
        .eq("clinic_id", clinicId)
        .eq("is_active", true)
        .or(`starts_at.is.null,starts_at.lte.${now}`)
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching active popup notices:", error);
        return [];
      }

      return data as PopupNotice[];
    },
    enabled: !!clinicId,
    staleTime: 1000 * 60 * 5, // Cache por 5 minutos
  });
}

// Hook para buscar todos os avisos (para o painel admin)
export function useAllPopupNotices(clinicId: string | null) {
  return useQuery({
    queryKey: ["popup-notices-admin", clinicId],
    queryFn: async () => {
      if (!clinicId) return [];
      
      const { data, error } = await supabase
        .from("popup_notices")
        .select("*")
        .eq("clinic_id", clinicId)
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching all popup notices:", error);
        throw error;
      }

      return data as PopupNotice[];
    },
    enabled: !!clinicId,
  });
}

// Hook para criar aviso
export function useCreatePopupNotice() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notice: PopupNoticeInput) => {
      const { data, error } = await supabase
        .from("popup_notices")
        .insert(notice)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["popup-notices-admin", variables.clinic_id] });
      queryClient.invalidateQueries({ queryKey: ["popup-notices-active", variables.clinic_id] });
      toast({
        title: "Sucesso",
        description: "Aviso pop-up criado com sucesso!",
      });
    },
    onError: (error) => {
      console.error("Error creating popup notice:", error);
      toast({
        title: "Erro",
        description: "Erro ao criar aviso pop-up",
        variant: "destructive",
      });
    },
  });
}

// Hook para atualizar aviso
export function useUpdatePopupNotice() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, clinicId, ...updates }: Partial<PopupNotice> & { id: string; clinicId: string }) => {
      const { error } = await supabase
        .from("popup_notices")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["popup-notices-admin", variables.clinicId] });
      queryClient.invalidateQueries({ queryKey: ["popup-notices-active", variables.clinicId] });
      toast({
        title: "Sucesso",
        description: "Aviso pop-up atualizado com sucesso!",
      });
    },
    onError: (error) => {
      console.error("Error updating popup notice:", error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar aviso pop-up",
        variant: "destructive",
      });
    },
  });
}

// Hook para deletar aviso
export function useDeletePopupNotice() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, clinicId }: { id: string; clinicId: string }) => {
      const { error } = await supabase
        .from("popup_notices")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["popup-notices-admin", variables.clinicId] });
      queryClient.invalidateQueries({ queryKey: ["popup-notices-active", variables.clinicId] });
      toast({
        title: "Sucesso",
        description: "Aviso pop-up removido com sucesso!",
      });
    },
    onError: (error) => {
      console.error("Error deleting popup notice:", error);
      toast({
        title: "Erro",
        description: "Erro ao remover aviso pop-up",
        variant: "destructive",
      });
    },
  });
}

// Hook para upload de imagem
export function useUploadPopupImage() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (file: File) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `popup-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("carousel-images")
        .upload(fileName, file, {
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("carousel-images")
        .getPublicUrl(fileName);

      return urlData.publicUrl;
    },
    onError: (error) => {
      console.error("Error uploading popup image:", error);
      toast({
        title: "Erro",
        description: "Erro ao fazer upload da imagem",
        variant: "destructive",
      });
    },
  });
}
