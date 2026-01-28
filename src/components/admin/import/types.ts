/**
 * Tipos para importação em massa de sócios e empresas
 */

export interface ImportedMember {
  nome: string;
  cpf: string;
  rg: string | null;
  empresa_nome: string;
  cnpj: string;
  funcao: string | null;
  data_inscricao: string | null;
  data_admissao: string | null;
  // Status after validation
  status: "pending" | "will_create" | "will_update" | "will_skip" | "error" | "created" | "updated" | "skipped";
  action?: "create" | "update" | "skip";
  error_message?: string;
  // IDs after processing
  patient_id?: string;
  employer_id?: string;
  // Existing data for comparison
  existing_patient_name?: string;
  existing_employer_name?: string;
}

export interface ImportResult {
  totalRecords: number;
  membersCreated: number;
  membersUpdated: number;
  membersSkipped: number;
  employersCreated: number;
  employersUpdated: number;
  employersSkipped: number;
  errors: ImportError[];
  processedRecords: ImportedMember[];
}

export interface ImportError {
  row: number;
  field: string;
  message: string;
  data: any;
}

export interface ProcessingProgress {
  current: number;
  total: number;
  phase: "extracting" | "parsing" | "validating" | "importing_employers" | "importing_members" | "complete";
  message: string;
}

export interface PreviewData {
  records: ImportedMember[];
  summary: {
    total: number;
    toCreate: number;
    toUpdate: number;
    toSkip: number;
    errors: number;
  };
}
