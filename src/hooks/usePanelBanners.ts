import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface PanelBanner {
  id: string;
  clinic_id: string;
  title: string | null;
  subtitle: string | null;
  description: string | null;
  image_url: string;
  button_text: string | null;
  button_link: string | null;
  order_index: number;
  is_active: boolean;
  background_color: string | null;
  text_color: string | null;
  overlay_opacity: number | null;
  duration_seconds: number | null;
  created_at: string;
  updated_at: string;
}

export function usePanelBanners(clinicId: string | null) {
  return useQuery({
    queryKey: ["panel-banners", clinicId],
    queryFn: async () => {
      if (!clinicId) return [];
      
      const { data, error } = await supabase
        .from("panel_banners" as any)
        .select("*")
        .eq("clinic_id", clinicId)
        .eq("is_active", true)
        .order("order_index", { ascending: true });

      if (error) {
        console.error("Error fetching panel banners:", error);
        return [];
      }

      return data as unknown as PanelBanner[];
    },
    enabled: !!clinicId,
  });
}

export function useAllPanelBanners(clinicId: string | null) {
  return useQuery({
    queryKey: ["panel-banners-admin", clinicId],
    queryFn: async () => {
      if (!clinicId) return [];
      
      const { data, error } = await supabase
        .from("panel_banners" as any)
        .select("*")
        .eq("clinic_id", clinicId)
        .order("order_index", { ascending: true });

      if (error) {
        console.error("Error fetching all panel banners:", error);
        throw error;
      }

      return data as unknown as PanelBanner[];
    },
    enabled: !!clinicId,
  });
}

export function useCreatePanelBanner() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (banner: Omit<PanelBanner, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("panel_banners" as any)
        .insert(banner)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["panel-banners", variables.clinic_id] });
      queryClient.invalidateQueries({ queryKey: ["panel-banners-admin", variables.clinic_id] });
      toast({
        title: "Sucesso",
        description: "Banner criado com sucesso!",
      });
    },
    onError: (error) => {
      console.error("Error creating banner:", error);
      toast({
        title: "Erro",
        description: "Erro ao criar banner",
        variant: "destructive",
      });
    },
  });
}

export function useUpdatePanelBanner() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, clinic_id, ...updates }: Partial<PanelBanner> & { id: string; clinic_id: string }) => {
      const { error } = await supabase
        .from("panel_banners" as any)
        .update(updates)
        .eq("id", id);

      if (error) throw error;
      return clinic_id;
    },
    onSuccess: (clinicId) => {
      queryClient.invalidateQueries({ queryKey: ["panel-banners", clinicId] });
      queryClient.invalidateQueries({ queryKey: ["panel-banners-admin", clinicId] });
      toast({
        title: "Sucesso",
        description: "Banner atualizado com sucesso!",
      });
    },
    onError: (error) => {
      console.error("Error updating banner:", error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar banner",
        variant: "destructive",
      });
    },
  });
}

export function useDeletePanelBanner() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, clinic_id }: { id: string; clinic_id: string }) => {
      const { error } = await supabase
        .from("panel_banners" as any)
        .delete()
        .eq("id", id);

      if (error) throw error;
      return clinic_id;
    },
    onSuccess: (clinicId) => {
      queryClient.invalidateQueries({ queryKey: ["panel-banners", clinicId] });
      queryClient.invalidateQueries({ queryKey: ["panel-banners-admin", clinicId] });
      toast({
        title: "Sucesso",
        description: "Banner removido com sucesso!",
      });
    },
    onError: (error) => {
      console.error("Error deleting banner:", error);
      toast({
        title: "Erro",
        description: "Erro ao remover banner",
        variant: "destructive",
      });
    },
  });
}

export function useUploadPanelBannerImage() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (file: File) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `panel-banner-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("panel-banners")
        .upload(fileName, file, {
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("panel-banners")
        .getPublicUrl(fileName);

      return urlData.publicUrl;
    },
    onError: (error) => {
      console.error("Error uploading banner image:", error);
      toast({
        title: "Erro",
        description: "Erro ao fazer upload da imagem",
        variant: "destructive",
      });
    },
  });
}
