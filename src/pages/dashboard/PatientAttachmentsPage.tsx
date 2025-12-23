import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Upload, Paperclip, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePatientAttachments, PatientAttachment } from "@/hooks/usePatientAttachments";
import { FolderTree } from "@/components/attachments/FolderTree";
import { AttachmentsList } from "@/components/attachments/AttachmentsList";
import { UploadDialog } from "@/components/attachments/UploadDialog";
import { AccessLogsModal } from "@/components/attachments/AccessLogsModal";
import { FilePreviewModal } from "@/components/attachments/FilePreviewModal";

interface Patient {
  id: string;
  name: string;
  phone: string;
}

export default function PatientAttachmentsPage() {
  const { id: patientId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentClinic } = useAuth();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loadingPatient, setLoadingPatient] = useState(true);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<PatientAttachment | null>(null);
  const [logsAttachment, setLogsAttachment] = useState<PatientAttachment | null>(null);

  const {
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
  } = usePatientAttachments(patientId || "");

  useEffect(() => {
    async function loadPatient() {
      if (!patientId || !currentClinic?.id) return;

      setLoadingPatient(true);
      const { data, error } = await supabase
        .from("patients")
        .select("id, name, phone")
        .eq("id", patientId)
        .eq("clinic_id", currentClinic.id)
        .single();

      if (error) {
        console.error("Error loading patient:", error);
        navigate("/dashboard/patients");
        return;
      }

      setPatient(data);
      setLoadingPatient(false);
    }

    loadPatient();
  }, [patientId, currentClinic?.id, navigate]);

  useEffect(() => {
    if (patientId && currentClinic?.id) {
      fetchFolders();
      fetchAttachments(selectedFolderId);
    }
  }, [patientId, currentClinic?.id, selectedFolderId, fetchFolders, fetchAttachments]);

  const handleFolderSelect = useCallback((folderId: string | null) => {
    setSelectedFolderId(folderId);
  }, []);

  const handleUpload = async (files: File[], folderId: string | null, description?: string) => {
    await uploadFiles(files, folderId, description);
    await fetchAttachments(selectedFolderId);
  };

  const handleView = async (attachment: PatientAttachment) => {
    await logAccess(attachment.id, "view");
    setPreviewAttachment(attachment);
  };

  const handleDownload = async (attachment: PatientAttachment) => {
    await logAccess(attachment.id, "download");
    const url = await getFileUrl(attachment);
    if (url) {
      const a = document.createElement("a");
      a.href = url;
      a.download = attachment.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const handleMove = async (attachmentId: string, folderId: string | null) => {
    const success = await moveAttachment(attachmentId, folderId);
    if (success) {
      await fetchAttachments(selectedFolderId);
    }
    return success;
  };

  if (loadingPatient) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!patient) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Paperclip className="h-6 w-6 text-primary" />
            Anexos do Paciente
          </h1>
          <p className="text-muted-foreground">{patient.name}</p>
        </div>
        <Button onClick={() => setShowUploadDialog(true)}>
          <Upload className="h-4 w-4 mr-2" />
          Enviar Arquivo
        </Button>
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar - Folders */}
        <Card className="p-4 lg:col-span-1">
          <FolderTree
            folders={folders}
            selectedFolderId={selectedFolderId}
            onSelectFolder={handleFolderSelect}
            onCreateFolder={createFolder}
            onRenameFolder={renameFolder}
            onDeleteFolder={deleteFolder}
          />
        </Card>

        {/* Main - Attachments */}
        <div className="lg:col-span-3">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">
              {selectedFolderId
                ? folders.find(f => f.id === selectedFolderId)?.name || "Pasta"
                : "Todos os Arquivos"
              }
            </h2>
            <p className="text-sm text-muted-foreground">
              {attachments.length} arquivo(s)
            </p>
          </div>

          <AttachmentsList
            attachments={attachments}
            folders={folders}
            loading={loading}
            onView={handleView}
            onDownload={handleDownload}
            onDelete={deleteAttachment}
            onMove={handleMove}
            onViewLogs={(attachment) => setLogsAttachment(attachment)}
          />
        </div>
      </div>

      {/* Dialogs */}
      <UploadDialog
        open={showUploadDialog}
        onOpenChange={setShowUploadDialog}
        onUpload={handleUpload}
        folders={folders}
        currentFolderId={selectedFolderId}
        onCreateFolder={createFolder}
      />

      <FilePreviewModal
        open={!!previewAttachment}
        onOpenChange={() => setPreviewAttachment(null)}
        attachment={previewAttachment}
        onGetUrl={getFileUrl}
        onDownload={handleDownload}
      />

      <AccessLogsModal
        open={!!logsAttachment}
        onOpenChange={() => setLogsAttachment(null)}
        attachment={logsAttachment}
        onFetchLogs={getAccessLogs}
      />
    </div>
  );
}
