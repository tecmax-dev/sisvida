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
      "nome, cpf, email, telefone, data_nascimento, sexo, logradouro, numero, bairro, cidade, uf, cep, empresa_cnpj, empresa_razao_social, empresa_nome_fantasia, documento_foto_url, documento_rg_url, documento_rg_verso_url, documento_comprovante_url"
    )
    .eq("id", associadoId)
    .single();

  if (fetchError || !associado) {
    console.error("[syncAssociadoToPatient] Error fetching associado:", fetchError);
    return;
  }

  const cleanCpf = (associado.cpf || "").replace(/\D/g, "");
  if (!cleanCpf) return;

  // Verificar se já existe paciente com esse CPF na clínica
  const { data: existing } = await supabase
    .from("patients")
    .select("id")
    .eq("clinic_id", clinicId)
    .or(`cpf.eq.${cleanCpf},cpf.eq.${cleanCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}`)
    .maybeSingle();

  if (existing) {
    // Já existe — apenas garantir que is_union_member = true
    await supabase
      .from("patients")
      .update({ is_union_member: true, is_active: true })
      .eq("id", existing.id);
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
  const { error: insertError } = await supabase.from("patients").insert({
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
    is_active: true,
    is_union_member: true,
    notes: "Cadastrado automaticamente via aprovação de filiação pública",
  });

  if (insertError) {
    console.error("[syncAssociadoToPatient] Error creating patient:", insertError);
  }
}
