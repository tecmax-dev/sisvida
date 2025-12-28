import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface HeroSettings {
  id: string;
  title: string;
  subtitle: string;
  description: string | null;
  primary_button_text: string | null;
  primary_button_link: string | null;
  secondary_button_text: string | null;
  secondary_button_link: string | null;
  highlights: string[];
  hero_image_url: string | null;
  background_effect: string | null;
  show_floating_badges: boolean | null;
  show_social_proof: boolean | null;
  social_proof_users: number | null;
  social_proof_rating: number | null;
  badge_1_text: string | null;
  badge_2_text: string | null;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
}

export function useHeroSettings() {
  return useQuery({
    queryKey: ["hero-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hero_settings")
        .select("*")
        .eq("is_active", true)
        .limit(1)
        .single();

      if (error) {
        console.error("Error fetching hero settings:", error);
        return null;
      }

      return {
        ...data,
        highlights: Array.isArray(data.highlights) ? data.highlights : []
      } as HeroSettings;
    },
  });
}

export function useUpdateHeroSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: Partial<HeroSettings>) => {
      const { data: existing } = await supabase
        .from("hero_settings")
        .select("id")
        .eq("is_active", true)
        .limit(1)
        .single();

      if (!existing) {
        throw new Error("No active hero settings found");
      }

      const { error } = await supabase
        .from("hero_settings")
        .update(updates)
        .eq("id", existing.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hero-settings"] });
      toast({
        title: "Sucesso",
        description: "Configurações da hero atualizadas com sucesso!",
      });
    },
    onError: (error) => {
      console.error("Error updating hero settings:", error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar configurações da hero",
        variant: "destructive",
      });
    },
  });
}

export function useUploadHeroImage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `hero-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("clinic-assets")
        .upload(fileName, file, {
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("clinic-assets")
        .getPublicUrl(fileName);

      return urlData.publicUrl;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hero-settings"] });
    },
    onError: (error) => {
      console.error("Error uploading hero image:", error);
      toast({
        title: "Erro",
        description: "Erro ao fazer upload da imagem",
        variant: "destructive",
      });
    },
  });
}
