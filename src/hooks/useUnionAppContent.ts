import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

function getErrorMessage(err: unknown): string {
  if (!err) return "Erro desconhecido";
  if (typeof err === "string") return err;

  // Supabase PostgrestError / StorageError shapes
  const anyErr = err as any;
  const message = typeof anyErr?.message === "string" ? anyErr.message : undefined;
  const details = typeof anyErr?.details === "string" ? anyErr.details : undefined;
  const hint = typeof anyErr?.hint === "string" ? anyErr.hint : undefined;
  const code = typeof anyErr?.code === "string" ? anyErr.code : undefined;

  const parts = [
    message,
    code ? `código: ${code}` : undefined,
    details ? `detalhes: ${details}` : undefined,
    hint ? `dica: ${hint}` : undefined,
  ].filter(Boolean);

  return parts.join(" • ") || "Erro desconhecido";
}

export type ContentType = 'banner' | 'convenio' | 'convencao' | 'declaracao' | 'diretoria' | 'documento' | 'galeria' | 'jornal' | 'radio' | 'video' | 'faq' | 'atendimento' | 'sobre';

export interface UnionAppContent {
  id: string;
  clinic_id: string;
  content_type: ContentType;
  title: string;
  description: string | null;
  image_url: string | null;
  file_url: string | null;
  external_link: string | null;
  order_index: number;
  is_active: boolean;
  metadata: Record<string, unknown> | null;
  cct_category_id: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  banner: 'Banners',
  convenio: 'Convênios',
  convencao: 'Convenções',
  declaracao: 'Declarações',
  diretoria: 'Diretoria',
  documento: 'Documentos',
  galeria: 'Galeria de Fotos',
  jornal: 'Jornais',
  radio: 'Rádios/Podcasts',
  video: 'Vídeos',
  faq: 'Perguntas Frequentes',
  atendimento: 'Atendimentos',
  sobre: 'Sobre',
};

export const CONTENT_TYPE_ICONS: Record<ContentType, string> = {
  banner: 'Image',
  convenio: 'Handshake',
  convencao: 'FileText',
  declaracao: 'FileCheck',
  diretoria: 'Users',
  documento: 'File',
  galeria: 'Images',
  jornal: 'Newspaper',
  radio: 'Radio',
  video: 'Video',
  faq: 'HelpCircle',
  atendimento: 'Headphones',
  sobre: 'Info',
};

export function useUnionAppContent(contentType?: ContentType) {
  const { currentClinic } = useAuth();

  return useQuery({
    queryKey: ["union-app-content", currentClinic?.id, contentType],
    queryFn: async () => {
      if (!currentClinic?.id) return [];

      let query = supabase
        .from("union_app_content")
        .select("*")
        .eq("clinic_id", currentClinic.id)
        .order("order_index", { ascending: true });

      if (contentType) {
        query = query.eq("content_type", contentType);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching union app content:", error);
        throw error;
      }

      return data as UnionAppContent[];
    },
    enabled: !!currentClinic?.id,
  });
}

export function useCreateUnionAppContent() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, currentClinic } = useAuth();

  return useMutation({
    mutationFn: async (content: Omit<UnionAppContent, "id" | "created_at" | "updated_at" | "created_by" | "updated_by" | "clinic_id">) => {
      if (!currentClinic?.id) throw new Error("Clínica não encontrada");

      const { data, error } = await supabase
        .from("union_app_content")
        .insert({
          content_type: content.content_type,
          title: content.title,
          description: content.description || null,
          image_url: content.image_url || null,
          file_url: content.file_url || null,
          external_link: content.external_link || null,
          order_index: content.order_index,
          is_active: content.is_active,
          metadata: content.metadata ? JSON.parse(JSON.stringify(content.metadata)) : null,
          cct_category_id: content.cct_category_id || null,
          clinic_id: currentClinic.id,
          created_by: user?.id || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["union-app-content"] });
      toast({
        title: "Sucesso",
        description: "Conteúdo criado com sucesso!",
      });
    },
    onError: (error) => {
      console.error("Error creating content:", error);
      toast({
        title: "Erro",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });
}

export function useUpdateUnionAppContent() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<UnionAppContent> & { id: string }) => {
      const updateData: Record<string, unknown> = {
        updated_by: user?.id,
      };
      
      if (updates.content_type !== undefined) updateData.content_type = updates.content_type;
      if (updates.title !== undefined) updateData.title = updates.title;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.image_url !== undefined) updateData.image_url = updates.image_url;
      if (updates.file_url !== undefined) updateData.file_url = updates.file_url;
      if (updates.external_link !== undefined) updateData.external_link = updates.external_link;
      if (updates.order_index !== undefined) updateData.order_index = updates.order_index;
      if (updates.is_active !== undefined) updateData.is_active = updates.is_active;
      if (updates.metadata !== undefined) updateData.metadata = updates.metadata;
      if (updates.cct_category_id !== undefined) updateData.cct_category_id = updates.cct_category_id;

      const { error } = await supabase
        .from("union_app_content")
        .update(updateData)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["union-app-content"] });
      toast({
        title: "Sucesso",
        description: "Conteúdo atualizado com sucesso!",
      });
    },
    onError: (error) => {
      console.error("Error updating content:", error);
      toast({
        title: "Erro",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });
}

export function useDeleteUnionAppContent() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("union_app_content")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["union-app-content"] });
      toast({
        title: "Sucesso",
        description: "Conteúdo removido com sucesso!",
      });
    },
    onError: (error) => {
      console.error("Error deleting content:", error);
      toast({
        title: "Erro",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });
}

export function useUploadContentFile() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ file, folder }: { file: File; folder: string }) => {
      // Check if user is authenticated before attempting upload
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Usuário não autenticado. Faça login novamente.");
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      console.log("[useUploadContentFile] Uploading to union-app-content:", fileName);

      const { error: uploadError, data: uploadData } = await supabase.storage
        .from("union-app-content")
        .upload(fileName, file, {
          upsert: true,
        });

      if (uploadError) {
        console.error("[useUploadContentFile] Upload error:", uploadError);
        throw new Error(uploadError.message || "Erro ao fazer upload do arquivo");
      }

      console.log("[useUploadContentFile] Upload success:", uploadData);

      const { data: urlData } = supabase.storage
        .from("union-app-content")
        .getPublicUrl(fileName);

      return urlData.publicUrl;
    },
    onError: (error: unknown) => {
      console.error("Error uploading file:", error);
      toast({
        title: "Erro no upload",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    },
  });
}
