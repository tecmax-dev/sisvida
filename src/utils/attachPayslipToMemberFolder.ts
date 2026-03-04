import { supabase } from "@/integrations/supabase/client";

const CONTRA_CHEQUES_FOLDER_NAME = "Contra cheques";

/**
 * After a payslip is approved, copies/links the file from the contra-cheques bucket
 * into the member's "Contra cheques" attachment folder (patient_attachments table).
 */
export async function attachPayslipToMemberFolder({
  clinicId,
  patientId,
  attachmentPath,
  userId,
}: {
  clinicId: string;
  patientId: string;
  attachmentPath: string;
  userId: string;
}): Promise<void> {
  try {
    // 1. Find or create the "Contra cheques" folder
    let folderId: string | null = null;

    const { data: existingFolders } = await supabase
      .from("patient_folders")
      .select("id, name")
      .eq("clinic_id", clinicId)
      .eq("patient_id", patientId)
      .ilike("name", "%contra%cheque%")
      .limit(1);

    if (existingFolders && existingFolders.length > 0) {
      folderId = existingFolders[0].id;
    } else {
      const { data: newFolder, error: folderError } = await supabase
        .from("patient_folders")
        .insert({
          clinic_id: clinicId,
          patient_id: patientId,
          name: CONTRA_CHEQUES_FOLDER_NAME,
          created_by: userId,
        })
        .select("id")
        .single();

      if (folderError) {
        console.error("[attachPayslipToMemberFolder] Error creating folder:", folderError);
        return;
      }
      folderId = newFolder.id;
    }

    // 2. Check if this attachment_path is already linked (avoid duplicates)
    const { data: existing } = await supabase
      .from("patient_attachments")
      .select("id")
      .eq("clinic_id", clinicId)
      .eq("patient_id", patientId)
      .eq("file_path", attachmentPath)
      .limit(1);

    if (existing && existing.length > 0) {
      console.log("[attachPayslipToMemberFolder] Attachment already exists, skipping");
      return;
    }

    // 3. Determine file info from the path
    const fileName = attachmentPath.split("/").pop() || "contracheque";
    const ext = fileName.split(".").pop()?.toLowerCase() || "";
    const fileType = ext === "pdf" ? "application/pdf" : `image/${ext === "jpg" ? "jpeg" : ext}`;

    // 4. Get the file size from storage metadata
    let fileSize = 0;
    try {
      // List files to get size - the path format is clinic_id/patient_id/filename
      const parts = attachmentPath.split("/");
      const folder = parts.slice(0, -1).join("/");
      const file = parts[parts.length - 1];
      
      const { data: files } = await supabase.storage
        .from("contra-cheques")
        .list(folder, { search: file });

      if (files && files.length > 0) {
        fileSize = files[0].metadata?.size || 0;
      }
    } catch {
      // Not critical
    }

    // 5. Create the attachment record pointing to the contra-cheques bucket
    const { error: attachError } = await supabase
      .from("patient_attachments")
      .insert({
        clinic_id: clinicId,
        patient_id: patientId,
        folder_id: folderId,
        file_name: `Contracheque - ${fileName}`,
        file_type: fileType,
        file_size: fileSize,
        file_path: `contra-cheques:${attachmentPath}`,
        description: "Contracheque aprovado automaticamente",
        uploaded_by: userId,
      });

    if (attachError) {
      console.error("[attachPayslipToMemberFolder] Error creating attachment:", attachError);
      return;
    }

    console.log("[attachPayslipToMemberFolder] Successfully attached payslip to member folder");
  } catch (error) {
    console.error("[attachPayslipToMemberFolder] Unexpected error:", error);
    // Don't throw - this should not block the approval flow
  }
}
