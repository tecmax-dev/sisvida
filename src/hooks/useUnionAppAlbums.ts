import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface UnionAppAlbum {
  id: string;
  clinic_id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  is_active: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
  photos_count?: number;
}

export interface UnionAppAlbumPhoto {
  id: string;
  album_id: string;
  image_url: string;
  title: string | null;
  description: string | null;
  order_index: number;
  created_at: string;
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return "Ocorreu um erro desconhecido";
}

// Fetch all albums
export function useUnionAppAlbums() {
  const { currentClinic } = useAuth();

  return useQuery({
    queryKey: ["union-app-albums", currentClinic?.id],
    queryFn: async () => {
      if (!currentClinic?.id) return [];
      
      const { data, error } = await supabase
        .from("union_app_albums")
        .select("*")
        .eq("clinic_id", currentClinic.id)
        .order("order_index", { ascending: true });

      if (error) throw error;
      
      // Get photo counts for each album
      const albumsWithCounts = await Promise.all(
        (data || []).map(async (album) => {
          const { count } = await supabase
            .from("union_app_album_photos")
            .select("*", { count: "exact", head: true })
            .eq("album_id", album.id);
          
          return { ...album, photos_count: count || 0 };
        })
      );

      return albumsWithCounts as UnionAppAlbum[];
    },
    enabled: !!currentClinic?.id,
  });
}

// Create album
export function useCreateUnionAppAlbum() {
  const queryClient = useQueryClient();
  const { currentClinic } = useAuth();

  return useMutation({
    mutationFn: async (data: Omit<UnionAppAlbum, "id" | "clinic_id" | "created_at" | "updated_at">) => {
      if (!currentClinic?.id) throw new Error("Clinic not found");

      const { data: result, error } = await supabase
        .from("union_app_albums")
        .insert({
          ...data,
          clinic_id: currentClinic.id,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["union-app-albums"] });
      toast.success("Álbum criado com sucesso!");
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });
}

// Update album
export function useUpdateUnionAppAlbum() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<UnionAppAlbum> & { id: string }) => {
      const { data: result, error } = await supabase
        .from("union_app_albums")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["union-app-albums"] });
      toast.success("Álbum atualizado com sucesso!");
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });
}

// Delete album
export function useDeleteUnionAppAlbum() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("union_app_albums")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["union-app-albums"] });
      toast.success("Álbum excluído com sucesso!");
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });
}

// Fetch photos for an album
export function useUnionAppAlbumPhotos(albumId: string | null) {
  return useQuery({
    queryKey: ["union-app-album-photos", albumId],
    queryFn: async () => {
      if (!albumId) return [];

      const { data, error } = await supabase
        .from("union_app_album_photos")
        .select("*")
        .eq("album_id", albumId)
        .order("order_index", { ascending: true });

      if (error) throw error;
      return data as UnionAppAlbumPhoto[];
    },
    enabled: !!albumId,
  });
}

// Add photo to album
export function useAddAlbumPhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<UnionAppAlbumPhoto, "id" | "created_at">) => {
      const { data: result, error } = await supabase
        .from("union_app_album_photos")
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["union-app-album-photos", variables.album_id] });
      queryClient.invalidateQueries({ queryKey: ["union-app-albums"] });
      toast.success("Foto adicionada ao álbum!");
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });
}

// Update photo
export function useUpdateAlbumPhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, album_id, ...data }: Partial<UnionAppAlbumPhoto> & { id: string; album_id: string }) => {
      const { data: result, error } = await supabase
        .from("union_app_album_photos")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return { ...result, album_id };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["union-app-album-photos", result.album_id] });
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });
}

// Delete photo
export function useDeleteAlbumPhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, albumId }: { id: string; albumId: string }) => {
      const { error } = await supabase
        .from("union_app_album_photos")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return { albumId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["union-app-album-photos", result.albumId] });
      queryClient.invalidateQueries({ queryKey: ["union-app-albums"] });
      toast.success("Foto excluída do álbum!");
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });
}

// Upload photo file
export function useUploadAlbumPhoto() {
  return useMutation({
    mutationFn: async ({ file }: { file: File }) => {
      const fileExt = file.name.split(".").pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `album-photos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("union-app-content")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("union-app-content")
        .getPublicUrl(filePath);

      return publicUrl;
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });
}
