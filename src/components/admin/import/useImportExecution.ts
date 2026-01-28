import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ImportedMember, ImportResult, ProcessingProgress, PreviewData } from "./types";

interface CnpjLookupResult {
  ok: boolean;
  error?: string;
  razao_social?: string;
  nome_fantasia?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
  telefone?: string;
  email?: string;
  cnae_fiscal?: number | null;
  cnae_fiscal_descricao?: string;
}

function normalizeDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function parseDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  // Expect DD/MM/YYYY format, convert to YYYY-MM-DD for database
  const match = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month}-${day}`;
  }
  // Try ISO format
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    return dateStr.slice(0, 10);
  }
  return null;
}

function normalizeGender(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.toUpperCase().trim();
  if (normalized.startsWith("M") || normalized === "MASCULINO") return "M";
  if (normalized.startsWith("F") || normalized === "FEMININO") return "F";
  return null;
}

function pickEmployerName(params: {
  rfData?: CnpjLookupResult | null;
  fallbackFromPdf?: string;
  fallbackFromDb?: string | null;
}): string {
  const fromRf = params.rfData?.razao_social || params.rfData?.nome_fantasia || "";
  const fromDb = params.fallbackFromDb || "";
  const fromPdf = params.fallbackFromPdf || "";
  return (fromRf || fromDb || fromPdf || "Empresa").trim();
}

async function lookupCnpjFromReceitaFederal(cnpj: string): Promise<CnpjLookupResult | null> {
  try {
    const { data, error } = await supabase.functions.invoke<CnpjLookupResult>('lookup-cnpj', {
      body: { cnpj }
    });

    if (error || !data?.ok) {
      console.warn(`CNPJ lookup failed for ${cnpj}:`, data?.error || error?.message);
      return null;
    }

    return data;
  } catch (err) {
    console.error(`Error looking up CNPJ ${cnpj}:`, err);
    return null;
  }
}

export function useImportExecution(clinicId: string | undefined) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<ProcessingProgress>({
    current: 0,
    total: 100,
    phase: "importing_employers",
    message: "",
  });
  const [result, setResult] = useState<ImportResult | null>(null);

  const executeImport = useCallback(async (previewData: PreviewData): Promise<ImportResult> => {
    if (!clinicId) {
      throw new Error("Clínica não identificada");
    }

    setIsProcessing(true);
    setResult(null);

    const importResult: ImportResult = {
      totalRecords: previewData.records.length,
      membersCreated: 0,
      membersUpdated: 0,
      membersSkipped: 0,
      employersCreated: 0,
      employersUpdated: 0,
      employersSkipped: 0,
      errors: [],
      processedRecords: [],
    };

    try {
      // Filter records that should be processed (not errors)
      const recordsToProcess = previewData.records.filter(r => r.status !== "error");
      const errorRecords = previewData.records.filter(r => r.status === "error");
      
      // Add error records to result
      errorRecords.forEach((record, index) => {
        importResult.errors.push({
          row: index + 1,
          field: "validation",
          message: record.error_message || "Erro de validação",
          data: record,
        });
        importResult.processedRecords.push(record);
      });

      // Phase 1: Create missing employers (with Receita Federal lookup)
      setProgress({ current: 10, total: 100, phase: "importing_employers", message: "Criando empresas..." });

      const uniqueCnpjs = [...new Set(recordsToProcess.map(r => normalizeDigits(r.cnpj)))];
      const employerIdMap = new Map<string, string>();
      const employerNameByCnpj = new Map<string, string>();
      const employerTradeNameByCnpj = new Map<string, string | null>();
      const rfCache = new Map<string, CnpjLookupResult | null>();

      const getRfData = async (cnpjDigits: string): Promise<CnpjLookupResult | null> => {
        if (rfCache.has(cnpjDigits)) return rfCache.get(cnpjDigits) ?? null;
        const data = await lookupCnpjFromReceitaFederal(cnpjDigits);
        rfCache.set(cnpjDigits, data);
        return data;
      };

      // Get existing employers - fetch all and filter by normalized CNPJ
      const { data: allEmployers } = await supabase
        .from("employers")
        .select("id, cnpj, name, trade_name")
        .eq("clinic_id", clinicId);

      (allEmployers || []).forEach(e => {
        if (e.cnpj) {
          const normalizedCnpj = normalizeDigits(e.cnpj);
          if (uniqueCnpjs.includes(normalizedCnpj)) {
            employerIdMap.set(normalizedCnpj, e.id);
            if (e.name) employerNameByCnpj.set(normalizedCnpj, e.name);
            employerTradeNameByCnpj.set(normalizedCnpj, (e as any).trade_name ?? null);
            importResult.employersSkipped++;
          }
        }
      });

      // Create missing employers with Receita Federal data
      const cnpjsToCreate = uniqueCnpjs.filter(cnpj => !employerIdMap.has(cnpj));
      
      for (let i = 0; i < cnpjsToCreate.length; i++) {
        const cnpj = cnpjsToCreate[i];
        const record = recordsToProcess.find(r => normalizeDigits(r.cnpj) === cnpj);
        
        if (!record) continue;

        try {
          setProgress({
            current: 10 + Math.floor((i / cnpjsToCreate.length) * 20),
            total: 100,
            phase: "importing_employers",
            message: `Consultando CNPJ ${i + 1}/${cnpjsToCreate.length} na Receita Federal...`,
          });

          // Lookup CNPJ in Receita Federal (with timeout protection)
          let rfData: CnpjLookupResult | null = null;
          try {
            rfData = await getRfData(cnpj);
          } catch (rfError) {
            console.warn(`RF lookup failed for ${cnpj}, continuing without RF data:`, rfError);
          }

          // Build employer data - prioritize Receita Federal data, fallback to PDF data
          const resolvedEmployerName = pickEmployerName({
            rfData,
            fallbackFromPdf: record.empresa_nome,
          });
          const employerData = {
            clinic_id: clinicId,
            cnpj: cnpj,
            name: resolvedEmployerName,
            trade_name: rfData?.nome_fantasia || null,
            is_active: true,
            cep: rfData?.cep ? rfData.cep.replace(/\D/g, "").replace(/^(\d{5})(\d{3})$/, "$1-$2") : null,
            address: rfData?.logradouro 
              ? (rfData.numero ? `${rfData.logradouro}, ${rfData.numero}` : rfData.logradouro)
              : null,
            neighborhood: rfData?.bairro || null,
            city: rfData?.municipio || null,
            state: rfData?.uf || null,
            phone: rfData?.telefone || null,
            email: rfData?.email?.toLowerCase() || null,
            cnae_code: rfData?.cnae_fiscal ? String(rfData.cnae_fiscal) : null,
            cnae_description: rfData?.cnae_fiscal_descricao || null,
          };

          const { data: newEmployer, error } = await supabase
            .from("employers")
            .insert(employerData)
            .select("id")
            .single();

          if (error) {
            console.error(`Error creating employer ${cnpj}:`, error);
            importResult.errors.push({
              row: recordsToProcess.indexOf(record) + 1,
              field: "employer",
              message: `Erro ao criar empresa: ${error.message}`,
              data: { cnpj, name: record.empresa_nome },
            });
          } else if (newEmployer) {
            employerIdMap.set(cnpj, newEmployer.id);
            employerNameByCnpj.set(cnpj, resolvedEmployerName);
            employerTradeNameByCnpj.set(cnpj, rfData?.nome_fantasia || null);
            importResult.employersCreated++;
          }
        } catch (employerError) {
          console.error(`Unhandled error processing employer ${cnpj}:`, employerError);
          importResult.errors.push({
            row: recordsToProcess.indexOf(record) + 1,
            field: "employer",
            message: `Erro inesperado: ${employerError instanceof Error ? employerError.message : "Erro desconhecido"}`,
            data: { cnpj, name: record.empresa_nome },
          });
          // Continue to next employer instead of stopping
        }
      }

      // Phase 2: Process members
      setProgress({ current: 30, total: 100, phase: "importing_members", message: "Processando sócios..." });

      // Group by CPF to handle duplicates
      const membersByCpf = new Map<string, ImportedMember[]>();
      recordsToProcess.forEach(record => {
        const cpfKey = record.cpf.replace(/\D/g, "");
        if (!membersByCpf.has(cpfKey)) {
          membersByCpf.set(cpfKey, []);
        }
        membersByCpf.get(cpfKey)!.push(record);
      });

      const cpfEntries = Array.from(membersByCpf.entries());
      
      for (let i = 0; i < cpfEntries.length; i++) {
        const [cpfKey, records] = cpfEntries[i];
        const firstRecord = records[0];

        try {
          setProgress({
            current: 30 + Math.floor((i / cpfEntries.length) * 60),
            total: 100,
            phase: "importing_members",
            message: `Processando sócio ${i + 1}/${cpfEntries.length}...`,
          });

          const cnpjKey = normalizeDigits(firstRecord.cnpj);
          const employerId = employerIdMap.get(cnpjKey);

          // Ensure we have a name to persist on the member record (patients.employer_name)
          let employerName = employerNameByCnpj.get(cnpjKey);
          if (!employerName) {
            try {
              const rfData = await getRfData(cnpjKey);
              employerName = pickEmployerName({
                rfData,
                fallbackFromDb: employerNameByCnpj.get(cnpjKey) ?? null,
                fallbackFromPdf: firstRecord.empresa_nome,
              });
              if (employerName) employerNameByCnpj.set(cnpjKey, employerName);
            } catch (rfError) {
              console.warn(`RF lookup failed for member ${cpfKey}, using fallback:`, rfError);
              employerName = firstRecord.empresa_nome || "Empresa";
            }
          }

          if (firstRecord.action === "skip" || firstRecord.status === "will_skip") {
            importResult.membersSkipped++;
            firstRecord.status = "skipped";
            importResult.processedRecords.push(firstRecord);
            continue;
          }

          if ((firstRecord.action === "update" || firstRecord.status === "will_update") && firstRecord.patient_id) {
            // Update existing patient with all available fields
            const updateData: Record<string, any> = {
              employer_cnpj: cnpjKey,
              employer_name: employerName || null,
              is_union_member: true,
            };
            
            // Add optional fields if present
            if (firstRecord.funcao) updateData.profession = firstRecord.funcao;
            if (firstRecord.data_inscricao) updateData.union_joined_at = firstRecord.data_inscricao;
            if (firstRecord.endereco) updateData.address = firstRecord.endereco;
            if (firstRecord.cep) updateData.zip_code = firstRecord.cep.replace(/\D/g, "");
            if (firstRecord.cidade) updateData.city = firstRecord.cidade;
            if (firstRecord.uf) updateData.state = firstRecord.uf;
            if (firstRecord.celular) updateData.phone = firstRecord.celular.replace(/\D/g, "");
            if (firstRecord.nascimento) updateData.birth_date = parseDate(firstRecord.nascimento);
            if (firstRecord.sexo) updateData.gender = normalizeGender(firstRecord.sexo);
            if (firstRecord.estado_civil) updateData.marital_status = firstRecord.estado_civil;
            if (firstRecord.nome_mae) updateData.mother_name = firstRecord.nome_mae;
            
            const { error } = await supabase
              .from("patients")
              .update(updateData)
              .eq("id", firstRecord.patient_id);

            if (error) {
              console.error(`Error updating member ${cpfKey}:`, error);
              importResult.errors.push({
                row: i + 1,
                field: "member",
                message: `Erro ao atualizar: ${error.message}`,
                data: firstRecord,
              });
              firstRecord.status = "error";
              firstRecord.error_message = error.message;
            } else {
              importResult.membersUpdated++;
              firstRecord.status = "updated";
              firstRecord.employer_id = employerId;
            }
          } else if (firstRecord.action === "create" || firstRecord.status === "will_create") {
            // Create new patient with all available fields
            const insertData: Record<string, any> = {
              clinic_id: clinicId,
              name: firstRecord.nome,
              cpf: cpfKey,
              phone: firstRecord.celular?.replace(/\D/g, "") || firstRecord.telefone?.replace(/\D/g, "") || "00000000000",
              employer_cnpj: cnpjKey,
              employer_name: employerName || null,
              is_active: true,
              is_union_member: true,
              notes: `Importado em ${new Date().toLocaleDateString("pt-BR")}. Admissão: ${firstRecord.data_admissao || "-"}`,
            };
            
            // Add optional fields if present
            if (firstRecord.rg) insertData.rg = firstRecord.rg;
            if (firstRecord.funcao) insertData.profession = firstRecord.funcao;
            if (firstRecord.data_inscricao) insertData.union_joined_at = firstRecord.data_inscricao;
            if (firstRecord.endereco) insertData.address = firstRecord.endereco;
            if (firstRecord.cep) insertData.zip_code = firstRecord.cep.replace(/\D/g, "");
            if (firstRecord.cidade) insertData.city = firstRecord.cidade;
            if (firstRecord.uf) insertData.state = firstRecord.uf;
            if (firstRecord.nascimento) insertData.birth_date = parseDate(firstRecord.nascimento);
            if (firstRecord.sexo) insertData.gender = normalizeGender(firstRecord.sexo);
            if (firstRecord.estado_civil) insertData.marital_status = firstRecord.estado_civil;
            if (firstRecord.nome_mae) insertData.mother_name = firstRecord.nome_mae;
            
            const { data: newPatient, error } = await supabase
              .from("patients")
              .insert(insertData as any)
              .select("id")
              .single();

            if (error) {
              console.error(`Error creating member ${cpfKey}:`, error);
              importResult.errors.push({
                row: i + 1,
                field: "member",
                message: `Erro ao criar: ${error.message}`,
                data: firstRecord,
              });
              firstRecord.status = "error";
              firstRecord.error_message = error.message;
            } else if (newPatient) {
              importResult.membersCreated++;
              firstRecord.status = "created";
              firstRecord.patient_id = newPatient.id;
              firstRecord.employer_id = employerId;
            }
          }

          importResult.processedRecords.push(firstRecord);
        } catch (memberError) {
          console.error(`Unhandled error processing member ${cpfKey}:`, memberError);
          importResult.errors.push({
            row: i + 1,
            field: "member",
            message: `Erro inesperado: ${memberError instanceof Error ? memberError.message : "Erro desconhecido"}`,
            data: firstRecord,
          });
          firstRecord.status = "error";
          firstRecord.error_message = memberError instanceof Error ? memberError.message : "Erro desconhecido";
          importResult.processedRecords.push(firstRecord);
          // Continue to next member instead of stopping
        }
      }

      // Phase 3: Complete
      setProgress({ current: 100, total: 100, phase: "complete", message: "Importação concluída!" });
      setResult(importResult);

      return importResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      importResult.errors.push({
        row: 0,
        field: "general",
        message: errorMessage,
        data: null,
      });
      setResult(importResult);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, [clinicId]);

  const reset = useCallback(() => {
    setResult(null);
    setProgress({ current: 0, total: 100, phase: "importing_employers", message: "" });
  }, []);

  return {
    executeImport,
    isProcessing,
    progress,
    result,
    reset,
  };
}
