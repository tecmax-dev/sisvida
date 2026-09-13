import { supabase } from "@/integrations/supabase/client";

/**
 * Sincroniza um associado aprovado da tabela sindical_associados para a tabela patients.
 * Cria o registro em patients caso não exista, garantindo que o sócio apareça na listagem.
 */
export async function syncAssociadoToPatient(
  associadoId: string,
  clinicId: string
): Promise<void> {
  // Buscar dados do associado incluindo documentos
  const { data: associado, error: fetchError } = await supabase
    .from("sindical_associados")
    .select(
      "nome, cpf, email, telefone, data_nascimento, sexo, logradouro, numero, bairro, cidade, uf, cep, empresa_cnpj, empresa_razao_social, empresa_nome_fantasia, documento_foto_url, documento_rg_url, documento_rg_verso_url, documento_comprovante_url, nome_pai, nome_mae"
    )
    .eq("id", associadoId)
    .single();

  if (fetchError || !associado) {
    console.error("[syncAssociadoToPatient] Error fetching associado:", fetchError);
    return;
  }

  const cleanCpf = (associado.cpf || "").replace(/\D/g, "");
  if (!cleanCpf) return;

  // Buscar o convênio "Secmi - Titular" para atribuir automaticamente
  const { data: secmiPlan } = await supabase
    .from("insurance_plans")
    .select("id")
    .eq("clinic_id", clinicId)
    .ilike("name", "Secmi - Titular")
    .limit(1)
    .maybeSingle();

  const secmiPlanId = secmiPlan?.id || null;

  // Verificar se já existe paciente com esse CPF na clínica
  const { data: existing } = await supabase
    .from("patients")
    .select("id")
    .eq("clinic_id", clinicId)
    .or(`cpf.eq.${cleanCpf},cpf.eq.${cleanCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}`)
    .maybeSingle();

  if (existing) {
    // Já existe — garantir is_union_member = true e atribuir convênio Secmi-Titular
    const updateData: Record<string, unknown> = { is_union_member: true, is_active: true };
    if (secmiPlanId) {
      updateData.insurance_plan_id = secmiPlanId;
    }
    await supabase
      .from("patients")
      .update(updateData as any)
      .eq("id", existing.id);

    // Anexar documentos de filiação ao paciente existente
    await attachFiliacaoDocuments(clinicId, existing.id, associado);
    return;
  }

  // Validate birth_date: must be at least 18 years ago for titular members
  let validBirthDate: string | null = associado.data_nascimento || null;
  if (validBirthDate) {
    const birth = new Date(validBirthDate);
    const today = new Date();
    const age = today.getFullYear() - birth.getFullYear();
    if (isNaN(birth.getTime()) || age < 18 || birth > today) {
      console.warn("[syncAssociadoToPatient] Invalid birth_date detected, setting to null:", validBirthDate);
      validBirthDate = null;
    }
  }

  // Criar novo registro em patients
  const { data: newPatient, error: insertError } = await supabase.from("patients").insert({
    clinic_id: clinicId,
    name: associado.nome,
    cpf: cleanCpf,
    email: associado.email || null,
    phone: associado.telefone || null,
    birth_date: validBirthDate,
    gender: associado.sexo || null,
    street: associado.logradouro || null,
    street_number: associado.numero || null,
    neighborhood: associado.bairro || null,
    city: associado.cidade || null,
    state: associado.uf || null,
    cep: associado.cep || null,
    employer_cnpj: associado.empresa_cnpj || null,
    employer_name:
      associado.empresa_nome_fantasia || associado.empresa_razao_social || null,
    mother_name: associado.nome_mae || null,
    father_name: associado.nome_pai || null,
    is_active: true,
    is_union_member: true,
    insurance_plan_id: secmiPlanId,
    union_affiliation_date: new Date().toISOString().split('T')[0],
    notes: "Cadastrado automaticamente via aprovação de filiação pública",
  }).select("id").single();

  if (insertError || !newPatient) {
    console.error("[syncAssociadoToPatient] Error creating patient:", insertError);
    return;
  }

  // Anexar documentos de filiação ao novo paciente
  await attachFiliacaoDocuments(clinicId, newPatient.id, associado);
}

const FILIACAO_FOLDER_NAME = "Documentos de Filiação";

interface AssociadoDocuments {
  documento_foto_url?: string | null;
  documento_rg_url?: string | null;
  documento_rg_verso_url?: string | null;
  documento_comprovante_url?: string | null;
}

/**
 * Cria uma pasta "Documentos de Filiação" e anexa os documentos enviados
 * durante o processo de filiação ao cadastro do paciente.
 */
async function attachFiliacaoDocuments(
  clinicId: string,
  patientId: string,
  docs: AssociadoDocuments
): Promise<void> {
  const docEntries: { url: string; name: string }[] = [];

  if (docs.documento_rg_url) docEntries.push({ url: docs.documento_rg_url, name: "RG - Frente" });
  if (docs.documento_rg_verso_url) docEntries.push({ url: docs.documento_rg_verso_url, name: "RG - Verso" });
  if (docs.documento_foto_url) docEntries.push({ url: docs.documento_foto_url, name: "Foto 3x4" });
  if (docs.documento_comprovante_url) docEntries.push({ url: docs.documento_comprovante_url, name: "Comprovante de Residência" });

  if (docEntries.length === 0) return;

  try {
    // Buscar ou criar a pasta "Documentos de Filiação"
    const { data: existingFolders } = await supabase
      .from("patient_folders")
      .select("id")
      .eq("clinic_id", clinicId)
      .eq("patient_id", patientId)
      .eq("name", FILIACAO_FOLDER_NAME)
      .limit(1);

    let folderId: string;

    if (existingFolders && existingFolders.length > 0) {
      folderId = existingFolders[0].id;
    } else {
      const { data: newFolder, error: folderError } = await supabase
        .from("patient_folders")
        .insert({
          clinic_id: clinicId,
          patient_id: patientId,
          name: FILIACAO_FOLDER_NAME,
        })
        .select("id")
        .single();

      if (folderError || !newFolder) {
        console.error("[attachFiliacaoDocuments] Error creating folder:", folderError);
        return;
      }
      folderId = newFolder.id;
    }

    // Verificar quais documentos já foram anexados (evitar duplicatas)
    const { data: existingAttachments } = await supabase
      .from("patient_attachments")
      .select("file_path")
      .eq("clinic_id", clinicId)
      .eq("patient_id", patientId)
      .eq("folder_id", folderId);

    const existingPaths = new Set((existingAttachments || []).map(a => a.file_path));

    const toInsert = docEntries
      .filter(doc => !existingPaths.has(doc.url))
      .map(doc => {
        // Remove query string (ex.: ?token=JWT) ANTES de extrair a extensão.
        // O token assinado contém pontos internos que quebravam split(".").pop().
        const urlWithoutQuery = doc.url.split("?")[0];
        const rawExt = urlWithoutQuery.split(".").pop()?.toLowerCase() || "jpg";
        const ext = /^[a-z0-9]{2,5}$/.test(rawExt) ? rawExt : "jpg";
        const fileType = ext === "pdf" ? "application/pdf" : `image/${ext}`;
        return {
          clinic_id: clinicId,
          patient_id: patientId,
          folder_id: folderId,
          file_name: `${doc.name}.${ext}`,
          file_type: fileType,
          file_size: 0,
          file_path: doc.url,
          description: `Documento enviado na filiação: ${doc.name}`,
        };
      });

    if (toInsert.length > 0) {
      const { error: attachError } = await supabase
        .from("patient_attachments")
        .insert(toInsert);

      if (attachError) {
        console.error("[attachFiliacaoDocuments] Error attaching documents:", attachError);
      } else {
        console.log(`[attachFiliacaoDocuments] ${toInsert.length} documento(s) anexado(s) ao paciente ${patientId}`);
      }
    }
  } catch (err) {
    console.error("[attachFiliacaoDocuments] Unexpected error:", err);
  }
}
