export interface ImportDetail {
  table: string;
  operation: string;
  status: "success" | "error" | "skipped";
  message?: string;
}

export interface ImportResult {
  success: boolean;
  executed: number;
  errors: string[];
  skipped: number;
  details: ImportDetail[];
  userMapping?: Record<string, string>;
  usersCreated?: number;
  usersSkipped?: number;
}

export type SqlImportPhase = "users" | "data";

export interface SqlImportProgress {
  phase: SqlImportPhase;
  processed: number;
  total?: number;
  percent?: number;
  message?: string;
}
