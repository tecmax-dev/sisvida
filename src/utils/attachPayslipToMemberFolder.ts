import { supabase } from "@/integrations/supabase/client";

const CONTRA_CHEQUES_FOLDER_NAME = "Contra cheques";
const APROVADOS_FOLDER_NAME = "Aprovados";
const REPROVADOS_FOLDER_NAME = "Reprovados";

/**
 * After a payslip is approved, copies/links the file from the contra-cheques bucket
 * into the member's "Contra cheques" attachment folder (patient_attachments table).
 * Files are organized into "Aprovados" or "Reprovados" subfolders for audit.
 */
export async function attachPayslipToMemberFolder({
  clinicId,
  patientId,
  attachmentPath,
  userId,
  status = "approved",
  rejectionReason,
}: {
  clinicId: string;
  patientId: string;
  attachmentPath: string;
  userId: string;
  status?: "approved" | "rejected";
  rejectionReason?: string;
}): Promise<void> {
  try {
    // 1. Find or create the root "Contra cheques" folder
    let rootFolderId: string | null = null;

    const { data: existingFolders } = await supabase
      .from("patient_folders")
      .select("id, name")
      .eq("clinic_id", clinicId)
      .eq("patient_id", patientId)
      .ilike("name", "%contra%cheque%")
      .is("parent_folder_id", null)
      .limit(1);

    if (existingFolders && existingFolders.length > 0) {
      rootFolderId = existingFolders[0].id;
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
      rootFolderId = newFolder.id;
    }

    // 1b. Find or create the "Aprovados" / "Reprovados" subfolder
    const subName = status === "approved" ? APROVADOS_FOLDER_NAME : REPROVADOS_FOLDER_NAME;
    let folderId: string | null = null;

    const { data: existingSub } = await supabase
      .from("patient_folders")
      .select("id")
      .eq("clinic_id", clinicId)
      .eq("patient_id", patientId)
      .eq("parent_folder_id", rootFolderId)
      .ilike("name", subName)
      .limit(1);

    if (existingSub && existingSub.length > 0) {
      folderId = existingSub[0].id;
    } else {
      const { data: newSub, error: subErr } = await supabase
        .from("patient_folders")
        .insert({
          clinic_id: clinicId,
          patient_id: patientId,
          name: subName,
          parent_folder_id: rootFolderId,
          created_by: userId,
        })
        .select("id")
        .single();
      if (subErr) {
        console.error("[attachPayslipToMemberFolder] Error creating subfolder:", subErr);
        folderId = rootFolderId; // fallback
      } else {
        folderId = newSub.id;
      }
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
    const label = status === "approved" ? "Aprovado" : "Reprovado";
    const description = status === "approved"
      ? "Contracheque aprovado automaticamente"
      : `Contracheque reprovado automaticamente${rejectionReason ? `: ${rejectionReason}` : ""}`;
    const { error: attachError } = await supabase
      .from("patient_attachments")
      .insert({
        clinic_id: clinicId,
        patient_id: patientId,
        folder_id: folderId,
        file_name: `Contracheque (${label}) - ${fileName}`,
        file_type: fileType,
        file_size: fileSize,
        file_path: `contra-cheques:${attachmentPath}`,
        description,
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
