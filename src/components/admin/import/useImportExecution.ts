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

      const uniqueCnpjs = [...new Set(recordsToProcess.map(r => r.cnpj.replace(/\D/g, "")))];
      const employerIdMap = new Map<string, string>();

      // Get existing employers - fetch all and filter by normalized CNPJ
      const { data: allEmployers } = await supabase
        .from("employers")
        .select("id, cnpj")
        .eq("clinic_id", clinicId);

      (allEmployers || []).forEach(e => {
        if (e.cnpj) {
          const normalizedCnpj = e.cnpj.replace(/\D/g, "");
          if (uniqueCnpjs.includes(normalizedCnpj)) {
            employerIdMap.set(normalizedCnpj, e.id);
            importResult.employersSkipped++;
          }
        }
      });

      // Create missing employers with Receita Federal data
      const cnpjsToCreate = uniqueCnpjs.filter(cnpj => !employerIdMap.has(cnpj));
      
      for (let i = 0; i < cnpjsToCreate.length; i++) {
        const cnpj = cnpjsToCreate[i];
        const record = recordsToProcess.find(r => r.cnpj.replace(/\D/g, "") === cnpj);
        
        if (!record) continue;

        setProgress({
          current: 10 + Math.floor((i / cnpjsToCreate.length) * 20),
          total: 100,
          phase: "importing_employers",
          message: `Consultando CNPJ ${i + 1}/${cnpjsToCreate.length} na Receita Federal...`,
        });

        // Lookup CNPJ in Receita Federal
        const rfData = await lookupCnpjFromReceitaFederal(cnpj);

        // Build employer data - prioritize Receita Federal data, fallback to PDF data
        const employerData = {
          clinic_id: clinicId,
          cnpj: cnpj,
          name: rfData?.razao_social || record.empresa_nome,
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
          importResult.errors.push({
            row: recordsToProcess.indexOf(record) + 1,
            field: "employer",
            message: `Erro ao criar empresa: ${error.message}`,
            data: { cnpj, name: record.empresa_nome },
          });
        } else if (newEmployer) {
          employerIdMap.set(cnpj, newEmployer.id);
          importResult.employersCreated++;
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

        setProgress({
          current: 30 + Math.floor((i / cpfEntries.length) * 60),
          total: 100,
          phase: "importing_members",
          message: `Processando sócio ${i + 1}/${cpfEntries.length}...`,
        });

        const cnpjKey = firstRecord.cnpj.replace(/\D/g, "");
        const employerId = employerIdMap.get(cnpjKey);

        if (firstRecord.action === "skip" || firstRecord.status === "will_skip") {
          importResult.membersSkipped++;
          firstRecord.status = "skipped";
          importResult.processedRecords.push(firstRecord);
          continue;
        }

        if ((firstRecord.action === "update" || firstRecord.status === "will_update") && firstRecord.patient_id) {
          // Update existing patient
          const { error } = await supabase
            .from("patients")
            .update({
              employer_cnpj: cnpjKey,
              profession: firstRecord.funcao || undefined,
              is_union_member: true,
              union_joined_at: firstRecord.data_inscricao || undefined,
            })
            .eq("id", firstRecord.patient_id);

          if (error) {
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
          // Create new patient
          const { data: newPatient, error } = await supabase
            .from("patients")
            .insert({
              clinic_id: clinicId,
              name: firstRecord.nome,
              cpf: cpfKey,
              rg: firstRecord.rg || undefined,
              phone: "00000000000", // Required field - placeholder
              employer_cnpj: cnpjKey,
              profession: firstRecord.funcao || undefined,
              is_active: true,
              is_union_member: true,
              union_joined_at: firstRecord.data_inscricao || undefined,
              notes: `Importado em ${new Date().toLocaleDateString("pt-BR")}. Admissão: ${firstRecord.data_admissao || "-"}`,
            })
            .select("id")
            .single();

          if (error) {
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
