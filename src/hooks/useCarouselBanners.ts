import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface CarouselBanner {
  id: string;
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
  created_at: string;
  updated_at: string;
}

export function useCarouselBanners() {
  return useQuery({
    queryKey: ["carousel-banners"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("carousel_banners")
        .select("*")
        .eq("is_active", true)
        .order("order_index", { ascending: true });

      if (error) {
        console.error("Error fetching carousel banners:", error);
        return [];
      }

      return data as CarouselBanner[];
    },
  });
}

export function useAllCarouselBanners() {
  return useQuery({
    queryKey: ["carousel-banners-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("carousel_banners")
        .select("*")
        .order("order_index", { ascending: true });

      if (error) {
        console.error("Error fetching all carousel banners:", error);
        throw error;
      }

      return data as CarouselBanner[];
    },
  });
}

export function useCreateCarouselBanner() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (banner: Omit<CarouselBanner, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("carousel_banners")
        .insert(banner)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["carousel-banners"] });
      queryClient.invalidateQueries({ queryKey: ["carousel-banners-admin"] });
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

export function useUpdateCarouselBanner() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CarouselBanner> & { id: string }) => {
      const { error } = await supabase
        .from("carousel_banners")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["carousel-banners"] });
      queryClient.invalidateQueries({ queryKey: ["carousel-banners-admin"] });
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

export function useDeleteCarouselBanner() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("carousel_banners")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["carousel-banners"] });
      queryClient.invalidateQueries({ queryKey: ["carousel-banners-admin"] });
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

export function useUploadBannerImage() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (file: File) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `banner-${Date.now()}.${fileExt}`;

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
      console.error("Error uploading banner image:", error);
      toast({
        title: "Erro",
        description: "Erro ao fazer upload da imagem",
        variant: "destructive",
      });
    },
  });
}
