// =====================================================
// TIPOS DO MÓDULO JURÍDICO SINDICAL
// =====================================================

// Enums
export type LegalCaseType = 'trabalhista' | 'civel' | 'tributario' | 'administrativo' | 'coletivo_sindical' | 'outro';
export type LegalCaseStatus = 'ativo' | 'suspenso' | 'arquivado' | 'encerrado_favoravel' | 'encerrado_desfavoravel' | 'acordo';
export type LegalRiskLevel = 'baixo' | 'medio' | 'alto' | 'critico';
export type DeadlineCriticality = 'baixa' | 'media' | 'alta' | 'urgente';
export type DeadlineStatus = 'pendente' | 'cumprido' | 'descumprido' | 'cancelado';

// Interfaces
export interface LawFirm {
  id: string;
  clinic_id: string;
  name: string;
  cnpj: string | null;
  oab_number: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  cep: string | null;
  contract_start_date: string | null;
  contract_end_date: string | null;
  contract_value: number | null;
  payment_type: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface Lawyer {
  id: string;
  clinic_id: string;
  law_firm_id: string | null;
  name: string;
  cpf: string | null;
  oab_number: string;
  oab_state: string;
  email: string | null;
  phone: string | null;
  specialty: string | null;
  hourly_rate: number | null;
  is_internal: boolean;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  law_firm?: LawFirm;
}

export interface LegalCase {
  id: string;
  clinic_id: string;
  case_number: string;
  case_type: LegalCaseType;
  subject: string;
  description: string | null;
  court: string | null;
  instance: string | null;
  tribunal: string | null;
  jurisdiction: string | null;
  plaintiff: string;
  plaintiff_document: string | null;
  defendant: string;
  defendant_document: string | null;
  union_role: string;
  cause_value: number | null;
  estimated_liability: number | null;
  risk_level: LegalRiskLevel;
  risk_notes: string | null;
  status: LegalCaseStatus;
  filing_date: string | null;
  service_date: string | null;
  last_update_date: string | null;
  closure_date: string | null;
  closure_reason: string | null;
  lawyer_id: string | null;
  law_firm_id: string | null;
  employer_id: string | null;
  member_id: string | null;
  priority: number;
  tags: string[] | null;
  external_reference: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  lawyer?: Lawyer;
  law_firm?: LawFirm;
}

export interface LegalCaseParty {
  id: string;
  legal_case_id: string;
  party_type: string;
  name: string;
  document: string | null;
  document_type: string | null;
  role_description: string | null;
  is_union: boolean;
  created_at: string;
}

export interface LegalCaseEvent {
  id: string;
  legal_case_id: string;
  event_date: string;
  event_type: string;
  title: string;
  description: string | null;
  phase: string | null;
  is_milestone: boolean;
  created_at: string;
  created_by: string | null;
}

export interface LegalCaseDocument {
  id: string;
  legal_case_id: string;
  event_id: string | null;
  document_type: string;
  name: string;
  description: string | null;
  storage_path: string | null;
  external_url: string | null;
  file_size: number | null;
  file_type: string | null;
  uploaded_at: string;
  uploaded_by: string | null;
}

export interface LegalDeadline {
  id: string;
  clinic_id: string;
  legal_case_id: string;
  title: string;
  description: string | null;
  deadline_date: string;
  deadline_time: string | null;
  criticality: DeadlineCriticality;
  status: DeadlineStatus;
  responsible_lawyer_id: string | null;
  responsible_user_id: string | null;
  alert_days_before: number[];
  last_alert_sent_at: string | null;
  completed_at: string | null;
  completed_by: string | null;
  completion_notes: string | null;
  missed_reason: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  legal_case?: LegalCase;
  responsible_lawyer?: Lawyer;
}

export interface LegalExpense {
  id: string;
  clinic_id: string;
  legal_case_id: string | null;
  law_firm_id: string | null;
  lawyer_id: string | null;
  expense_type: string;
  description: string;
  amount: number;
  expense_date: string;
  financial_transaction_id: string | null;
  is_paid: boolean;
  paid_at: string | null;
  payment_reference: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  legal_case?: LegalCase;
}

export interface LegalProvision {
  id: string;
  clinic_id: string;
  legal_case_id: string;
  provision_date: string;
  amount: number;
  probability_percentage: number | null;
  calculated_amount: number | null;
  reason: string | null;
  review_date: string | null;
  is_current: boolean;
  created_at: string;
  created_by: string | null;
}

export interface LegalAuditLog {
  id: string;
  clinic_id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  performed_at: string;
  performed_by: string | null;
}

// Labels e cores
export const caseTypeLabels: Record<LegalCaseType, string> = {
  trabalhista: 'Trabalhista',
  civel: 'Cível',
  tributario: 'Tributário',
  administrativo: 'Administrativo',
  coletivo_sindical: 'Coletivo Sindical',
  outro: 'Outro',
};

export const caseStatusLabels: Record<LegalCaseStatus, string> = {
  ativo: 'Ativo',
  suspenso: 'Suspenso',
  arquivado: 'Arquivado',
  encerrado_favoravel: 'Encerrado (Favorável)',
  encerrado_desfavoravel: 'Encerrado (Desfavorável)',
  acordo: 'Acordo',
};

export const caseStatusColors: Record<LegalCaseStatus, string> = {
  ativo: 'bg-blue-100 text-blue-800',
  suspenso: 'bg-yellow-100 text-yellow-800',
  arquivado: 'bg-gray-100 text-gray-800',
  encerrado_favoravel: 'bg-green-100 text-green-800',
  encerrado_desfavoravel: 'bg-red-100 text-red-800',
  acordo: 'bg-purple-100 text-purple-800',
};

export const riskLevelLabels: Record<LegalRiskLevel, string> = {
  baixo: 'Baixo',
  medio: 'Médio',
  alto: 'Alto',
  critico: 'Crítico',
};

export const riskLevelColors: Record<LegalRiskLevel, string> = {
  baixo: 'bg-green-100 text-green-800',
  medio: 'bg-yellow-100 text-yellow-800',
  alto: 'bg-orange-100 text-orange-800',
  critico: 'bg-red-100 text-red-800',
};

export const deadlineCriticalityLabels: Record<DeadlineCriticality, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  urgente: 'Urgente',
};

export const deadlineCriticalityColors: Record<DeadlineCriticality, string> = {
  baixa: 'bg-gray-100 text-gray-800',
  media: 'bg-blue-100 text-blue-800',
  alta: 'bg-orange-100 text-orange-800',
  urgente: 'bg-red-100 text-red-800',
};

export const deadlineStatusLabels: Record<DeadlineStatus, string> = {
  pendente: 'Pendente',
  cumprido: 'Cumprido',
  descumprido: 'Descumprido',
  cancelado: 'Cancelado',
};

export const deadlineStatusColors: Record<DeadlineStatus, string> = {
  pendente: 'bg-yellow-100 text-yellow-800',
  cumprido: 'bg-green-100 text-green-800',
  descumprido: 'bg-red-100 text-red-800',
  cancelado: 'bg-gray-100 text-gray-800',
};

export const expenseTypeLabels: Record<string, string> = {
  honorarios: 'Honorários',
  custas: 'Custas Processuais',
  pericia: 'Perícia',
  deslocamento: 'Deslocamento',
  acordo: 'Acordo',
  condenacao: 'Condenação',
  outros: 'Outros',
};

export const documentTypeLabels: Record<string, string> = {
  peticao_inicial: 'Petição Inicial',
  contestacao: 'Contestação',
  recurso: 'Recurso',
  sentenca: 'Sentença',
  acordao: 'Acórdão',
  procuracao: 'Procuração',
  contrato: 'Contrato',
  parecer: 'Parecer',
  outros: 'Outros',
};

export const eventTypeLabels: Record<string, string> = {
  peticao: 'Petição',
  audiencia: 'Audiência',
  decisao: 'Decisão',
  sentenca: 'Sentença',
  recurso: 'Recurso',
  citacao: 'Citação',
  intimacao: 'Intimação',
  pericia: 'Perícia',
  acordo: 'Acordo',
  outros: 'Outros',
};
