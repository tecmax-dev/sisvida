import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ImportedMember, ImportResult, ProcessingProgress } from "./types";
import { parsePdfTableData, groupByCnpj, groupByCpf } from "./parsePdfData";

export function useImportMembersEmployers(clinicId: string | undefined) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<ProcessingProgress>({
    current: 0,
    total: 0,
    phase: "parsing",
    message: "",
  });
  const [result, setResult] = useState<ImportResult | null>(null);

  const processImport = useCallback(async (markdownContent: string): Promise<ImportResult> => {
    if (!clinicId) {
      throw new Error("Clinic ID não encontrado");
    }

    setIsProcessing(true);
    setResult(null);

    const importResult: ImportResult = {
      totalRecords: 0,
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
      // Phase 1: Parse the data
      setProgress({ current: 0, total: 100, phase: "parsing", message: "Analisando dados do PDF..." });
      const records = parsePdfTableData(markdownContent);
      importResult.totalRecords = records.length;
      
      if (records.length === 0) {
        throw new Error("Nenhum registro válido encontrado no arquivo");
      }

      // Phase 2: Group by CNPJ to get unique companies
      setProgress({ current: 10, total: 100, phase: "validating", message: "Validando empresas..." });
      const companiesByCnpj = groupByCnpj(records);
      const uniqueCnpjs = Array.from(companiesByCnpj.keys());

      // Phase 3: Check existing employers
      const { data: existingEmployers } = await supabase
        .from("employers")
        .select("id, cnpj, name")
        .eq("clinic_id", clinicId)
        .in("cnpj", uniqueCnpjs.map(c => c.replace(/\D/g, "")));

      const existingEmployerMap = new Map<string, { id: string; name: string }>();
      (existingEmployers || []).forEach(e => {
        existingEmployerMap.set(e.cnpj.replace(/\D/g, ""), { id: e.id, name: e.name });
      });

      // Phase 4: Create missing employers
      setProgress({ current: 20, total: 100, phase: "importing_employers", message: "Importando empresas..." });
      const employerIdMap = new Map<string, string>();
      let employerIndex = 0;

      for (const [cnpjKey, companyRecords] of companiesByCnpj) {
        employerIndex++;
        setProgress({
          current: 20 + Math.floor((employerIndex / uniqueCnpjs.length) * 20),
          total: 100,
          phase: "importing_employers",
          message: `Processando empresa ${employerIndex}/${uniqueCnpjs.length}...`,
        });

        const existing = existingEmployerMap.get(cnpjKey);
        if (existing) {
          employerIdMap.set(cnpjKey, existing.id);
          importResult.employersSkipped++;
        } else {
          // Create new employer
          const firstRecord = companyRecords[0];
          const { data: newEmployer, error } = await supabase
            .from("employers")
            .insert({
              clinic_id: clinicId,
              cnpj: cnpjKey,
              name: firstRecord.empresa_nome,
              is_active: true,
            })
            .select("id")
            .single();

          if (error) {
            importResult.errors.push({
              row: employerIndex,
              field: "employer",
              message: `Erro ao criar empresa ${firstRecord.empresa_nome}: ${error.message}`,
              data: { cnpj: cnpjKey, name: firstRecord.empresa_nome },
            });
          } else if (newEmployer) {
            employerIdMap.set(cnpjKey, newEmployer.id);
            importResult.employersCreated++;
          }
        }
      }

      // Phase 5: Group by CPF to get unique members
      setProgress({ current: 40, total: 100, phase: "validating", message: "Validando sócios..." });
      const membersByCpf = groupByCpf(records);
      const uniqueCpfs = Array.from(membersByCpf.keys());

      // Phase 6: Check existing patients
      const { data: existingPatients } = await supabase
        .from("patients")
        .select("id, cpf, name, employer_cnpj")
        .eq("clinic_id", clinicId)
        .in("cpf", uniqueCpfs);

      const existingPatientMap = new Map<string, { id: string; name: string; employer_cnpj: string | null }>();
      (existingPatients || []).forEach(p => {
        if (p.cpf) {
          existingPatientMap.set(p.cpf.replace(/\D/g, ""), { 
            id: p.id, 
            name: p.name, 
            employer_cnpj: p.employer_cnpj 
          });
        }
      });

      // Phase 7: Create/Update members
      setProgress({ current: 50, total: 100, phase: "importing_members", message: "Importando sócios..." });
      let memberIndex = 0;

      for (const [cpfKey, memberRecords] of membersByCpf) {
        memberIndex++;
        setProgress({
          current: 50 + Math.floor((memberIndex / uniqueCpfs.length) * 40),
          total: 100,
          phase: "importing_members",
          message: `Processando sócio ${memberIndex}/${uniqueCpfs.length}...`,
        });

        const firstRecord = memberRecords[0];
        const primaryCnpj = firstRecord.cnpj.replace(/\D/g, "");
        const employerId = employerIdMap.get(primaryCnpj);
        
        // Get existing patient
        const existing = existingPatientMap.get(cpfKey);

        if (existing) {
          // Update if employer_cnpj is different (link to new company)
          if (existing.employer_cnpj !== primaryCnpj && employerId) {
            const { error } = await supabase
              .from("patients")
              .update({
                employer_cnpj: primaryCnpj,
                profession: firstRecord.funcao || undefined,
                is_union_member: true,
                union_joined_at: firstRecord.data_inscricao || undefined,
              })
              .eq("id", existing.id);

            if (error) {
              importResult.errors.push({
                row: memberIndex,
                field: "member",
                message: `Erro ao atualizar ${firstRecord.nome}: ${error.message}`,
                data: firstRecord,
              });
              firstRecord.status = "error";
              firstRecord.error_message = error.message;
            } else {
              importResult.membersUpdated++;
              firstRecord.status = "updated";
              firstRecord.patient_id = existing.id;
              firstRecord.employer_id = employerId;
            }
          } else {
            importResult.membersSkipped++;
            firstRecord.status = "skipped";
            firstRecord.patient_id = existing.id;
          }
        } else {
          // Create new patient
          const { data: newPatient, error } = await supabase
            .from("patients")
            .insert({
              clinic_id: clinicId,
              name: firstRecord.nome,
              cpf: cpfKey,
              rg: firstRecord.rg || undefined,
              phone: "00000000000", // Required field - placeholder
              employer_cnpj: primaryCnpj,
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
              row: memberIndex,
              field: "member",
              message: `Erro ao criar ${firstRecord.nome}: ${error.message}`,
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

      // Phase 8: Complete
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

  return {
    processImport,
    isProcessing,
    progress,
    result,
  };
}
