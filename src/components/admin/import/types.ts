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
  // Processing status
  status?: "pending" | "created" | "updated" | "error" | "skipped";
  error_message?: string;
  patient_id?: string;
  employer_id?: string;
}

export interface ImportResult {
  totalRecords: number;
  membersCreated: number;
  membersUpdated: number;
  membersSkipped: number;
  employersCreated: number;
  employersUpdated: number;
  employersSkipped: number;
  errors: Array<{
    row: number;
    field: string;
    message: string;
    data: any;
  }>;
  processedRecords: ImportedMember[];
}

export interface ProcessingProgress {
  current: number;
  total: number;
  phase: "parsing" | "validating" | "importing_employers" | "importing_members" | "linking" | "complete";
  message: string;
}
