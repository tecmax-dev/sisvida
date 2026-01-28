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

interface AuditLogEntry {
  action: string;
  entity_type: string;
  entity_id?: string;
  details: Record<string, unknown>;
  timestamp: string;
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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout
    
    const { data, error } = await supabase.functions.invoke<CnpjLookupResult>('lookup-cnpj', {
      body: { cnpj }
    });
    
    clearTimeout(timeoutId);

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

// Batch lookup CNPJs in parallel with concurrency limit
async function batchLookupCnpjs(
  cnpjs: string[], 
  concurrency: number = 5
): Promise<Map<string, CnpjLookupResult | null>> {
  const results = new Map<string, CnpjLookupResult | null>();
  
  for (let i = 0; i < cnpjs.length; i += concurrency) {
    const batch = cnpjs.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(async (cnpj) => {
        const result = await lookupCnpjFromReceitaFederal(cnpj);
        return { cnpj, result };
      })
    );
    batchResults.forEach(({ cnpj, result }) => results.set(cnpj, result));
  }
  
  return results;
}

async function logAuditAction(
  userId: string | null,
  action: string,
  entityType: string,
  entityId: string | null,
  details: Record<string, unknown>
): Promise<void> {
  if (!userId) return;
  
  try {
    await supabase.from('audit_logs').insert({
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      details: JSON.parse(JSON.stringify(details)),
      user_agent: navigator.userAgent,
    });
  } catch (error) {
    console.error('Failed to log audit action:', error);
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
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);

  const addAuditEntry = useCallback((entry: Omit<AuditLogEntry, 'timestamp'>) => {
    const fullEntry: AuditLogEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
    };
    setAuditLog(prev => [...prev, fullEntry]);
    console.log(`[AUDIT] ${entry.action}:`, entry.details);
    return fullEntry;
  }, []);

  const executeImport = useCallback(async (previewData: PreviewData): Promise<ImportResult> => {
    if (!clinicId) {
      throw new Error("Clínica não identificada");
    }

    // Get current user for audit logging
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || null;

    setIsProcessing(true);
    setResult(null);
    setAuditLog([]);

    // Log import start
    addAuditEntry({
      action: 'import_started',
      entity_type: 'bulk_import',
      details: {
        clinic_id: clinicId,
        total_records: previewData.records.length,
        to_create: previewData.summary.toCreate,
        to_update: previewData.summary.toUpdate,
        to_skip: previewData.summary.toSkip,
        validation_errors: previewData.summary.errors,
      },
    });

    // Log to database
    await logAuditAction(userId, 'bulk_import_started', 'system', clinicId, {
      total_records: previewData.records.length,
      summary: previewData.summary,
    });

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
      setProgress({ current: 10, total: 100, phase: "importing_employers", message: "Identificando empresas..." });

      const uniqueCnpjs = [...new Set(recordsToProcess.map(r => normalizeDigits(r.cnpj)))];
      const employerIdMap = new Map<string, string>();
      const employerNameByCnpj = new Map<string, string>();
      const employerTradeNameByCnpj = new Map<string, string | null>();
      const rfCache = new Map<string, CnpjLookupResult | null>();

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

      // Create missing employers with Receita Federal data - BATCH PARALLEL
      const cnpjsToCreate = uniqueCnpjs.filter(cnpj => !employerIdMap.has(cnpj));
      
      if (cnpjsToCreate.length > 0) {
        setProgress({ current: 15, total: 100, phase: "importing_employers", message: `Consultando ${cnpjsToCreate.length} CNPJs na Receita Federal...` });
        
        // Batch lookup all CNPJs in parallel (5 concurrent requests)
        const rfResults = await batchLookupCnpjs(cnpjsToCreate, 5);
        rfResults.forEach((data, cnpj) => rfCache.set(cnpj, data));
        
        setProgress({ current: 20, total: 100, phase: "importing_employers", message: `Criando ${cnpjsToCreate.length} empresas...` });
        
        // Build employer data for batch upsert
        const employersToUpsert: any[] = [];
        const cnpjToRecordMap = new Map<string, ImportedMember>();
        
        for (const cnpj of cnpjsToCreate) {
          const record = recordsToProcess.find(r => normalizeDigits(r.cnpj) === cnpj);
          if (!record) continue;
          
          cnpjToRecordMap.set(cnpj, record);
          const rfData = rfCache.get(cnpj) ?? null;
          
          const resolvedEmployerName = pickEmployerName({
            rfData,
            fallbackFromPdf: record.empresa_nome,
          });
          
          employersToUpsert.push({
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
          });
          
          // Store resolved name for later use
          employerNameByCnpj.set(cnpj, resolvedEmployerName);
          employerTradeNameByCnpj.set(cnpj, rfData?.nome_fantasia || null);
        }
        
        // Batch upsert employers (chunks of 50)
        const EMPLOYER_BATCH_SIZE = 50;
        for (let i = 0; i < employersToUpsert.length; i += EMPLOYER_BATCH_SIZE) {
          const batch = employersToUpsert.slice(i, i + EMPLOYER_BATCH_SIZE);
          
          try {
            const { data: upsertedEmployers, error } = await supabase
              .from("employers")
              .upsert(batch, { 
                onConflict: "clinic_id,cnpj",
                ignoreDuplicates: false 
              })
              .select("id, cnpj");
            
            if (error) {
              console.error(`Batch employer upsert error:`, error);
              // Fall back to individual upserts for this batch
              for (const emp of batch) {
                const { data: single, error: singleError } = await supabase
                  .from("employers")
                  .upsert(emp, { onConflict: "clinic_id,cnpj", ignoreDuplicates: false })
                  .select("id")
                  .single();
                  
                if (singleError) {
                  const record = cnpjToRecordMap.get(emp.cnpj);
                  importResult.errors.push({
                    row: record ? recordsToProcess.indexOf(record) + 1 : 0,
                    field: "employer",
                    message: `Erro ao criar empresa: ${singleError.message}`,
                    data: { cnpj: emp.cnpj, name: emp.name },
                  });
                } else if (single) {
                  employerIdMap.set(emp.cnpj, single.id);
                  importResult.employersCreated++;
                }
              }
            } else if (upsertedEmployers) {
              upsertedEmployers.forEach(emp => {
                const normalizedCnpj = normalizeDigits(emp.cnpj);
                employerIdMap.set(normalizedCnpj, emp.id);
                importResult.employersCreated++;
              });
            }
          } catch (batchError) {
            console.error(`Batch employer error:`, batchError);
          }
        }
      }

      // Phase 2: Process members - BATCH OPTIMIZED
      setProgress({ current: 30, total: 100, phase: "importing_members", message: "Preparando sócios..." });

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
      
      // Separate into updates, creates, and skips
      const toUpdate: { cpfKey: string; firstRecord: ImportedMember; cnpjKey: string; employerName: string; employerId?: string }[] = [];
      const toCreate: { cpfKey: string; firstRecord: ImportedMember; cnpjKey: string; employerName: string; employerId?: string }[] = [];
      
      for (const [cpfKey, records] of cpfEntries) {
        const firstRecord = records[0];
        const cnpjKey = normalizeDigits(firstRecord.cnpj);
        const employerId = employerIdMap.get(cnpjKey);
        
        // Get employer name from cache
        let employerName = employerNameByCnpj.get(cnpjKey);
        if (!employerName) {
          const rfData = rfCache.get(cnpjKey) ?? null;
          employerName = pickEmployerName({
            rfData,
            fallbackFromDb: employerNameByCnpj.get(cnpjKey) ?? null,
            fallbackFromPdf: firstRecord.empresa_nome,
          });
          if (employerName) employerNameByCnpj.set(cnpjKey, employerName);
        }
        
        if (firstRecord.action === "skip" || firstRecord.status === "will_skip") {
          importResult.membersSkipped++;
          firstRecord.status = "skipped";
          importResult.processedRecords.push(firstRecord);
        } else if ((firstRecord.action === "update" || firstRecord.status === "will_update") && firstRecord.patient_id) {
          toUpdate.push({ cpfKey, firstRecord, cnpjKey, employerName: employerName || "Empresa", employerId });
        } else if (firstRecord.action === "create" || firstRecord.status === "will_create") {
          toCreate.push({ cpfKey, firstRecord, cnpjKey, employerName: employerName || "Empresa", employerId });
        }
      }

      // Batch create new members (chunks of 50)
      const MEMBER_BATCH_SIZE = 50;
      const importDate = new Date().toLocaleDateString("pt-BR");
      
      if (toCreate.length > 0) {
        setProgress({ current: 40, total: 100, phase: "importing_members", message: `Criando ${toCreate.length} novos sócios...` });
        
        for (let i = 0; i < toCreate.length; i += MEMBER_BATCH_SIZE) {
          const batch = toCreate.slice(i, i + MEMBER_BATCH_SIZE);
          
          // Update progress every batch
          if (i > 0) {
            setProgress({ 
              current: 40 + Math.floor((i / toCreate.length) * 25), 
              total: 100, 
              phase: "importing_members", 
              message: `Criando sócios ${i + 1}-${Math.min(i + MEMBER_BATCH_SIZE, toCreate.length)}/${toCreate.length}...` 
            });
          }
          
          const insertBatch = batch.map(({ firstRecord, cnpjKey, employerName }) => ({
            clinic_id: clinicId,
            name: firstRecord.nome,
            cpf: firstRecord.cpf.replace(/\D/g, ""),
            phone: firstRecord.celular?.replace(/\D/g, "") || firstRecord.telefone?.replace(/\D/g, "") || "00000000000",
            employer_cnpj: cnpjKey,
            employer_name: employerName,
            is_active: true,
            is_union_member: true,
            notes: `Importado em ${importDate}. Admissão: ${firstRecord.data_admissao || "-"}`,
            rg: firstRecord.rg || null,
            profession: firstRecord.funcao || null,
            union_joined_at: parseDate(firstRecord.data_inscricao),
            address: firstRecord.endereco || null,
            cep: firstRecord.cep?.replace(/\D/g, "") || null,
            city: firstRecord.cidade || null,
            state: firstRecord.uf || null,
            birth_date: parseDate(firstRecord.nascimento),
            gender: normalizeGender(firstRecord.sexo),
            marital_status: firstRecord.estado_civil || null,
            mother_name: firstRecord.nome_mae || null,
          }));
          
          try {
            // Use upsert to handle duplicates gracefully
            const { data: created, error } = await supabase
              .from("patients")
              .upsert(insertBatch as any, {
                onConflict: "cpf,clinic_id",
                ignoreDuplicates: false
              })
              .select("id, cpf");
            
            if (error) {
              // Fall back to individual upserts for this batch
              console.error(`Batch upsert error, falling back to individual:`, error);
              for (let j = 0; j < batch.length; j++) {
                const { cpfKey, firstRecord, employerId } = batch[j];
                const insertData = insertBatch[j];
                
                const { data: single, error: singleError } = await supabase
                  .from("patients")
                  .upsert(insertData as any, {
                    onConflict: "cpf,clinic_id",
                    ignoreDuplicates: false
                  })
                  .select("id")
                  .maybeSingle();
                
                if (singleError) {
                  importResult.errors.push({
                    row: recordsToProcess.indexOf(firstRecord) + 1,
                    field: "member",
                    message: `Erro ao criar: ${singleError.message}`,
                    data: firstRecord,
                  });
                  firstRecord.status = "error";
                  firstRecord.error_message = singleError.message;
                } else if (single) {
                  importResult.membersCreated++;
                  firstRecord.status = "created";
                  firstRecord.patient_id = single.id;
                  firstRecord.employer_id = employerId;
                }
                importResult.processedRecords.push(firstRecord);
              }
            } else if (created) {
              // Map created IDs back to records
              const cpfToIdMap = new Map(created.map(c => [normalizeDigits(c.cpf), c.id]));
              for (const { cpfKey, firstRecord, employerId } of batch) {
                const newId = cpfToIdMap.get(cpfKey);
                if (newId) {
                  importResult.membersCreated++;
                  firstRecord.status = "created";
                  firstRecord.patient_id = newId;
                  firstRecord.employer_id = employerId;
                }
                importResult.processedRecords.push(firstRecord);
              }
            }
          } catch (batchError) {
            console.error(`Batch create exception:`, batchError);
            // Mark all as error
            for (const { firstRecord } of batch) {
              firstRecord.status = "error";
              firstRecord.error_message = "Erro em lote";
              importResult.processedRecords.push(firstRecord);
            }
          }
        }
      }

      // Process updates (must be individual due to different IDs)
      if (toUpdate.length > 0) {
        setProgress({ current: 70, total: 100, phase: "importing_members", message: `Atualizando ${toUpdate.length} sócios existentes...` });
        
        // Process updates in parallel batches
        const UPDATE_CONCURRENCY = 10;
        for (let i = 0; i < toUpdate.length; i += UPDATE_CONCURRENCY) {
          const batch = toUpdate.slice(i, i + UPDATE_CONCURRENCY);
          
          if (i > 0 && i % 50 === 0) {
            setProgress({ 
              current: 70 + Math.floor((i / toUpdate.length) * 20), 
              total: 100, 
              phase: "importing_members", 
              message: `Atualizando sócios ${i + 1}/${toUpdate.length}...` 
            });
          }
          
          await Promise.all(batch.map(async ({ cpfKey, firstRecord, cnpjKey, employerName, employerId }) => {
            const updateData: Record<string, any> = {
              employer_cnpj: cnpjKey,
              employer_name: employerName,
              is_union_member: true,
            };
            
            if (firstRecord.funcao) updateData.profession = firstRecord.funcao;
            if (firstRecord.data_inscricao) updateData.union_joined_at = parseDate(firstRecord.data_inscricao);
            if (firstRecord.endereco) updateData.address = firstRecord.endereco;
            if (firstRecord.cep) updateData.cep = firstRecord.cep.replace(/\D/g, "");
            if (firstRecord.cidade) updateData.city = firstRecord.cidade;
            if (firstRecord.uf) updateData.state = firstRecord.uf;
            if (firstRecord.celular) updateData.phone = firstRecord.celular.replace(/\D/g, "");
            if (firstRecord.nascimento) updateData.birth_date = parseDate(firstRecord.nascimento);
            if (firstRecord.sexo) updateData.gender = normalizeGender(firstRecord.sexo);
            if (firstRecord.estado_civil) updateData.marital_status = firstRecord.estado_civil;
            if (firstRecord.nome_mae) updateData.mother_name = firstRecord.nome_mae;
            
            try {
              const { error } = await supabase
                .from("patients")
                .update(updateData)
                .eq("id", firstRecord.patient_id);
              
              if (error) {
                importResult.errors.push({
                  row: recordsToProcess.indexOf(firstRecord) + 1,
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
            } catch (err) {
              const errMsg = err instanceof Error ? err.message : "Erro desconhecido";
              firstRecord.status = "error";
              firstRecord.error_message = errMsg;
              importResult.errors.push({
                row: recordsToProcess.indexOf(firstRecord) + 1,
                field: "member",
                message: `Erro inesperado: ${errMsg}`,
                data: firstRecord,
              });
            }
            importResult.processedRecords.push(firstRecord);
          }));
        }
      }

      // Phase 3: Complete
      addAuditEntry({
        action: 'import_completed',
        entity_type: 'bulk_import',
        details: {
          clinic_id: clinicId,
          members_created: importResult.membersCreated,
          members_updated: importResult.membersUpdated,
          members_skipped: importResult.membersSkipped,
          employers_created: importResult.employersCreated,
          employers_skipped: importResult.employersSkipped,
          total_errors: importResult.errors.length,
        },
      });

      // Log completion to database
      await logAuditAction(userId, 'bulk_import_completed', 'system', clinicId, {
        members_created: importResult.membersCreated,
        members_updated: importResult.membersUpdated,
        members_skipped: importResult.membersSkipped,
        employers_created: importResult.employersCreated,
        employers_skipped: importResult.employersSkipped,
        errors_count: importResult.errors.length,
      });
      setProgress({ current: 100, total: 100, phase: "complete", message: "Importação concluída!" });
      setResult(importResult);

      return importResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      addAuditEntry({
        action: 'import_fatal_error',
        entity_type: 'bulk_import',
        details: { clinic_id: clinicId, error: errorMessage, stack: error instanceof Error ? error.stack : undefined },
      });
      
      // Log fatal error to database
      const { data: { user } } = await supabase.auth.getUser();
      await logAuditAction(user?.id || null, 'bulk_import_failed', 'system', clinicId, {
        error: errorMessage,
        partial_results: {
          members_created: importResult.membersCreated,
          members_updated: importResult.membersUpdated,
          employers_created: importResult.employersCreated,
        },
      });

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
    setAuditLog([]);
    setProgress({ current: 0, total: 100, phase: "importing_employers", message: "" });
  }, []);

  return {
    executeImport,
    isProcessing,
    progress,
    result,
    auditLog,
    reset,
  };
}
