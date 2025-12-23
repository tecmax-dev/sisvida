import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface PatientFolder {
  id: string;
  clinic_id: string;
  patient_id: string;
  name: string;
  parent_folder_id: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
}

export interface PatientAttachment {
  id: string;
  clinic_id: string;
  patient_id: string;
  folder_id: string | null;
  file_name: string;
  file_type: string;
  file_size: number;
  file_path: string;
  description: string | null;
  uploaded_at: string;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
  uploader_name?: string;
}

export interface AttachmentAccessLog {
  id: string;
  attachment_id: string;
  user_id: string;
  action: string;
  accessed_at: string;
  ip_address: string | null;
  user_agent: string | null;
  user_name?: string;
}

export function usePatientAttachments(patientId: string) {
  const { user, currentClinic } = useAuth();
  const [folders, setFolders] = useState<PatientFolder[]>([]);
  const [attachments, setAttachments] = useState<PatientAttachment[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchFolders = useCallback(async () => {
    if (!currentClinic?.id || !patientId) return;

    const { data, error } = await supabase
      .from("patient_folders")
      .select("*")
      .eq("clinic_id", currentClinic.id)
      .eq("patient_id", patientId)
      .order("name");

    if (error) {
      console.error("Error fetching folders:", error);
      return;
    }

    setFolders(data || []);
  }, [currentClinic?.id, patientId]);

  const fetchAttachments = useCallback(async (folderId?: string | null) => {
    if (!currentClinic?.id || !patientId) return;

    setLoading(true);
    try {
      let query = supabase
        .from("patient_attachments")
        .select("*")
        .eq("clinic_id", currentClinic.id)
        .eq("patient_id", patientId)
        .order("uploaded_at", { ascending: false });

      if (folderId === null) {
        query = query.is("folder_id", null);
      } else if (folderId) {
        query = query.eq("folder_id", folderId);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching attachments:", error);
        return;
      }

      // Fetch uploader names
      const uploaderIds = [...new Set((data || []).map(a => a.uploaded_by).filter(Boolean))];
      let uploaderNames: Record<string, string> = {};

      if (uploaderIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, name")
          .in("user_id", uploaderIds);

        uploaderNames = (profiles || []).reduce((acc, p) => {
          acc[p.user_id] = p.name;
          return acc;
        }, {} as Record<string, string>);
      }

      setAttachments((data || []).map(a => ({
        ...a,
        uploader_name: a.uploaded_by ? uploaderNames[a.uploaded_by] || "Usuário" : undefined
      })));
    } finally {
      setLoading(false);
    }
  }, [currentClinic?.id, patientId]);

  const createFolder = async (name: string, parentFolderId?: string | null) => {
    if (!currentClinic?.id || !patientId || !user?.id) return null;

    const { data, error } = await supabase
      .from("patient_folders")
      .insert({
        clinic_id: currentClinic.id,
        patient_id: patientId,
        name,
        parent_folder_id: parentFolderId || null,
        created_by: user.id
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating folder:", error);
      toast.error("Erro ao criar pasta");
      return null;
    }

    await fetchFolders();
    toast.success("Pasta criada com sucesso");
    return data;
  };

  const renameFolder = async (folderId: string, newName: string) => {
    const { error } = await supabase
      .from("patient_folders")
      .update({ name: newName })
      .eq("id", folderId);

    if (error) {
      console.error("Error renaming folder:", error);
      toast.error("Erro ao renomear pasta");
      return false;
    }

    await fetchFolders();
    toast.success("Pasta renomeada");
    return true;
  };

  const deleteFolder = async (folderId: string) => {
    // Check if folder has attachments
    const { count } = await supabase
      .from("patient_attachments")
      .select("id", { count: "exact", head: true })
      .eq("folder_id", folderId);

    if (count && count > 0) {
      toast.error("Não é possível excluir pasta com anexos");
      return false;
    }

    const { error } = await supabase
      .from("patient_folders")
      .delete()
      .eq("id", folderId);

    if (error) {
      console.error("Error deleting folder:", error);
      toast.error("Erro ao excluir pasta");
      return false;
    }

    await fetchFolders();
    toast.success("Pasta excluída");
    return true;
  };

  const uploadFiles = async (files: File[], folderId?: string | null, description?: string) => {
    if (!currentClinic?.id || !patientId || !user?.id) return [];

    const uploadedFiles: PatientAttachment[] = [];

    for (const file of files) {
      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const filePath = `${currentClinic.id}/${patientId}/${timestamp}_${safeName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("patient-attachments")
        .upload(filePath, file);

      if (uploadError) {
        console.error("Error uploading file:", uploadError);
        toast.error(`Erro ao enviar ${file.name}`);
        continue;
      }

      // Create attachment record
      const { data, error } = await supabase
        .from("patient_attachments")
        .insert({
          clinic_id: currentClinic.id,
          patient_id: patientId,
          folder_id: folderId || null,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
          file_path: filePath,
          description: description || null,
          uploaded_by: user.id
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating attachment record:", error);
        continue;
      }

      uploadedFiles.push(data);
    }

    if (uploadedFiles.length > 0) {
      toast.success(`${uploadedFiles.length} arquivo(s) enviado(s)`);
      await fetchAttachments(folderId);
    }

    return uploadedFiles;
  };

  const deleteAttachment = async (attachment: PatientAttachment) => {
    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from("patient-attachments")
      .remove([attachment.file_path]);

    if (storageError) {
      console.error("Error deleting from storage:", storageError);
    }

    // Delete record
    const { error } = await supabase
      .from("patient_attachments")
      .delete()
      .eq("id", attachment.id);

    if (error) {
      console.error("Error deleting attachment:", error);
      toast.error("Erro ao excluir anexo");
      return false;
    }

    toast.success("Anexo excluído");
    await fetchAttachments(attachment.folder_id);
    return true;
  };

  const moveAttachment = async (attachmentId: string, newFolderId: string | null) => {
    const { error } = await supabase
      .from("patient_attachments")
      .update({ folder_id: newFolderId })
      .eq("id", attachmentId);

    if (error) {
      console.error("Error moving attachment:", error);
      toast.error("Erro ao mover anexo");
      return false;
    }

    toast.success("Anexo movido");
    return true;
  };

  const logAccess = async (attachmentId: string, action: "view" | "download") => {
    if (!user?.id) return;

    await supabase.from("attachment_access_logs").insert({
      attachment_id: attachmentId,
      user_id: user.id,
      action,
      user_agent: navigator.userAgent
    });
  };

  const getAccessLogs = async (attachmentId: string): Promise<AttachmentAccessLog[]> => {
    const { data: logs, error } = await supabase
      .from("attachment_access_logs")
      .select("*")
      .eq("attachment_id", attachmentId)
      .order("accessed_at", { ascending: false });

    if (error) {
      console.error("Error fetching access logs:", error);
      return [];
    }

    // Fetch user names
    const userIds = [...new Set((logs || []).map(l => l.user_id))];
    let userNames: Record<string, string> = {};

    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, name")
        .in("user_id", userIds);

      userNames = (profiles || []).reduce((acc, p) => {
        acc[p.user_id] = p.name;
        return acc;
      }, {} as Record<string, string>);
    }

    return (logs || []).map(l => ({
      ...l,
      user_name: userNames[l.user_id] || "Usuário"
    }));
  };

  const getFileUrl = async (attachment: PatientAttachment): Promise<string | null> => {
    const { data } = await supabase.storage
      .from("patient-attachments")
      .createSignedUrl(attachment.file_path, 60 * 60); // 1 hour

    return data?.signedUrl || null;
  };

  return {
    folders,
    attachments,
    loading,
    fetchFolders,
    fetchAttachments,
    createFolder,
    renameFolder,
    deleteFolder,
    uploadFiles,
    deleteAttachment,
    moveAttachment,
    logAccess,
    getAccessLogs,
    getFileUrl
  };
}
