import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const FOLDER_NAME = "Doc Dependentes";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function extractStoragePath(input: string): string {
  // Accept full public/signed URLs or raw storage paths
  if (!input) return input;
  const m = input.match(/\/object\/(?:public|sign)\/(?:dependent-documents|dependent-cpf-photos)\/([^?]+)/);
  if (m) {
    try {
      return decodeURIComponent(m[1]);
    } catch {
      return m[1];
    }
  }
  return input;
}

function inferSourceBucket(input: string): string {
  return input.includes("/dependent-documents/") ? "dependent-documents" : "dependent-cpf-photos";
}

function guessContentType(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization") || "";
    if (!authHeader) return json(401, { error: "Not authenticated" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Authenticate caller
    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) return json(401, { error: "Not authenticated" });

    const body = await req.json();
    const {
      clinic_id,
      patient_id, // titular's patients.id
      dependent_name,
      cpf_photo_url, // path or full URL in dependent-documents bucket
    } = body;

    if (!clinic_id || !patient_id || !cpf_photo_url) {
      return json(400, { error: "clinic_id, patient_id e cpf_photo_url são obrigatórios" });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Verify caller has access to this clinic
    const { data: hasAccess } = await admin.rpc("has_clinic_access", {
      _user_id: user.id,
      _clinic_id: clinic_id,
    });
    if (!hasAccess) {
      // Fallback: check user_roles existence
      const { data: roles } = await admin
        .from("user_roles")
        .select("id")
        .eq("user_id", user.id)
        .limit(1);
      if (!roles || roles.length === 0) return json(403, { error: "Forbidden" });
    }

    const sourcePath = extractStoragePath(cpf_photo_url);

    const sourceBucket = inferSourceBucket(cpf_photo_url);

    let { data: fileBlob, error: dlError } = await admin.storage
      .from(sourceBucket)
      .download(sourcePath);

    if (dlError || !fileBlob) {
      const fallbackBucket = sourceBucket === "dependent-documents" ? "dependent-cpf-photos" : "dependent-documents";
      const fallback = await admin.storage.from(fallbackBucket).download(sourcePath);
      fileBlob = fallback.data;
      dlError = fallback.error;
    }

    if (dlError || !fileBlob) {
      console.error("[copy-dependent-doc] download error:", dlError);
      return json(404, { error: "Documento original não encontrado", details: dlError?.message });
    }

    // Find or create the "Doc Dependentes" folder for this titular
    let folderId: string | null = null;
    const { data: existingFolders } = await admin
      .from("patient_folders")
      .select("id, name")
      .eq("clinic_id", clinic_id)
      .eq("patient_id", patient_id);

    const found = (existingFolders || []).find(
      (f) => f.name.trim().toLowerCase() === FOLDER_NAME.toLowerCase()
    );

    if (found) {
      folderId = found.id;
    } else {
      const { data: newFolder, error: folderError } = await admin
        .from("patient_folders")
        .insert({
          clinic_id,
          patient_id,
          name: FOLDER_NAME,
          created_by: user.id,
        })
        .select("id")
        .single();
      if (folderError) {
        console.error("[copy-dependent-doc] folder error:", folderError);
        return json(500, { error: "Erro ao criar pasta", details: folderError.message });
      }
      folderId = newFolder.id;
    }

    // Build destination filename
    const origName = sourcePath.split("/").pop() || "documento.jpg";
    const ext = origName.includes(".") ? origName.split(".").pop() : "jpg";
    const safeDepName = (dependent_name || "dependente")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9.-]/g, "_")
      .slice(0, 80);
    const timestamp = Date.now();
    const destFileName = `${safeDepName}_${timestamp}.${ext}`;
    const destPath = `${clinic_id}/${patient_id}/${timestamp}_${destFileName}`;

    const arrayBuf = await fileBlob.arrayBuffer();
    const contentType = fileBlob.type || guessContentType(destFileName);

    const { error: upError } = await admin.storage
      .from("patient-attachments")
      .upload(destPath, new Uint8Array(arrayBuf), {
        contentType,
        upsert: false,
      });

    if (upError) {
      console.error("[copy-dependent-doc] upload error:", upError);
      return json(500, { error: "Erro ao salvar anexo", details: upError.message });
    }

    const fileSize = arrayBuf.byteLength;
    const description = `Documento de inclusão do dependente: ${dependent_name || "(sem nome)"}`;

    const { data: attachment, error: insError } = await admin
      .from("patient_attachments")
      .insert({
        clinic_id,
        patient_id,
        folder_id: folderId,
        file_name: destFileName,
        file_type: contentType,
        file_size: fileSize,
        file_path: destPath,
        description,
        uploaded_by: user.id,
      })
      .select()
      .single();

    if (insError) {
      console.error("[copy-dependent-doc] insert error:", insError);
      return json(500, { error: "Erro ao registrar anexo", details: insError.message });
    }

    return json(200, { success: true, attachment, folder_id: folderId });
  } catch (err) {
    console.error("[copy-dependent-doc] unexpected:", err);
    return json(500, { error: "Erro interno", details: String(err) });
  }
});
