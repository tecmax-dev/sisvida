import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ImportedMember, PreviewData, ProcessingProgress } from "./types";
import { extractTextFromPdf, parseExtractedText } from "./pdfTextExtractor";

export function useImportPreview(clinicId: string | undefined) {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<ProcessingProgress>({
    current: 0,
    total: 100,
    phase: "extracting",
    message: "",
  });
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generatePreview = useCallback(async (file: File): Promise<PreviewData | null> => {
    if (!clinicId) {
      setError("Clínica não identificada");
      return null;
    }

    // Validate file type
    if (!file.type.includes("pdf") && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("Apenas arquivos PDF são aceitos");
      return null;
    }

    setIsLoading(true);
    setError(null);
    setPreviewData(null);

    try {
      // Phase 1: Extract text from PDF
      setProgress({ current: 10, total: 100, phase: "extracting", message: "Extraindo texto do PDF..." });
      
      const { rawText, pageCount } = await extractTextFromPdf(file);
      
      if (!rawText || rawText.trim().length < 50) {
        throw new Error("Não foi possível extrair texto do PDF. Verifique se o arquivo contém texto selecionável.");
      }

      // Phase 2: Parse extracted text
      setProgress({ current: 30, total: 100, phase: "parsing", message: `Analisando ${pageCount} páginas...` });
      
      const parsedRecords = parseExtractedText(rawText);
      
      if (parsedRecords.length === 0) {
        throw new Error("Nenhum registro válido encontrado no PDF. Verifique se o formato está correto (Nome, CPF, Empresa, CNPJ).");
      }

      // Phase 3: Validate against database
      setProgress({ current: 50, total: 100, phase: "validating", message: "Validando dados..." });

      // Get unique CPFs and CNPJs
      const uniqueCpfs = [...new Set(parsedRecords.map(r => r.cpf.replace(/\D/g, "")))];
      const uniqueCnpjs = [...new Set(parsedRecords.map(r => r.cnpj.replace(/\D/g, "")))];

      // Check existing patients
      const { data: existingPatients } = await supabase
        .from("patients")
        .select("id, cpf, name, employer_cnpj")
        .eq("clinic_id", clinicId)
        .in("cpf", uniqueCpfs);

      const patientMap = new Map<string, { id: string; name: string; employer_cnpj: string | null }>();
      (existingPatients || []).forEach(p => {
        if (p.cpf) {
          patientMap.set(p.cpf.replace(/\D/g, ""), { 
            id: p.id, 
            name: p.name, 
            employer_cnpj: p.employer_cnpj 
          });
        }
      });

      // Check existing employers
      const { data: existingEmployers } = await supabase
        .from("employers")
        .select("id, cnpj, name")
        .eq("clinic_id", clinicId)
        .in("cnpj", uniqueCnpjs);

      const employerMap = new Map<string, { id: string; name: string }>();
      (existingEmployers || []).forEach(e => {
        employerMap.set(e.cnpj.replace(/\D/g, ""), { id: e.id, name: e.name });
      });

      // Phase 4: Determine actions for each record
      setProgress({ current: 70, total: 100, phase: "validating", message: "Determinando ações..." });

      const records: ImportedMember[] = parsedRecords.map((record, index) => {
        const cpfKey = record.cpf.replace(/\D/g, "");
        const cnpjKey = record.cnpj.replace(/\D/g, "");
        
        const existingPatient = patientMap.get(cpfKey);
        const existingEmployer = employerMap.get(cnpjKey);

        let status: ImportedMember["status"] = "pending";
        let action: ImportedMember["action"] = "create";
        let errorMessage: string | undefined;

        // Validate CPF format
        if (cpfKey.length !== 11) {
          status = "error";
          errorMessage = "CPF inválido";
        } 
        // Validate CNPJ format
        else if (cnpjKey.length !== 14) {
          status = "error";
          errorMessage = "CNPJ inválido";
        }
        // Validate name
        else if (!record.nome || record.nome.length < 3) {
          status = "error";
          errorMessage = "Nome inválido";
        }
        // Determine action
        else if (existingPatient) {
          // Check if needs update (different employer)
          if (existingPatient.employer_cnpj !== cnpjKey) {
            status = "will_update";
            action = "update";
          } else {
            status = "will_skip";
            action = "skip";
          }
        } else {
          status = "will_create";
          action = "create";
        }

        return {
          ...record,
          status,
          action,
          error_message: errorMessage,
          patient_id: existingPatient?.id,
          employer_id: existingEmployer?.id,
          existing_patient_name: existingPatient?.name,
          existing_employer_name: existingEmployer?.name,
        };
      });

      // Calculate summary
      const summary = {
        total: records.length,
        toCreate: records.filter(r => r.status === "will_create").length,
        toUpdate: records.filter(r => r.status === "will_update").length,
        toSkip: records.filter(r => r.status === "will_skip").length,
        errors: records.filter(r => r.status === "error").length,
      };

      setProgress({ current: 100, total: 100, phase: "validating", message: "Preview pronto!" });

      const result: PreviewData = { records, summary };
      setPreviewData(result);
      
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Erro ao processar o arquivo";
      setError(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [clinicId]);

  const reset = useCallback(() => {
    setPreviewData(null);
    setError(null);
    setProgress({ current: 0, total: 100, phase: "extracting", message: "" });
  }, []);

  return {
    generatePreview,
    isLoading,
    progress,
    previewData,
    error,
    reset,
  };
}
