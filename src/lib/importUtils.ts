import * as XLSX from 'xlsx';

export interface PatientImportRow {
  nome: string;
  telefone?: string;
  telefone_fixo?: string;
  email?: string;
  cpf?: string;
  rg?: string;
  data_nascimento?: string;
  sexo?: string;
  estado_civil?: string;
  naturalidade?: string;
  profissao?: string;
  escolaridade?: string;
  nome_mae?: string;
  nome_pai?: string;
  cep?: string;
  rua?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  endereco?: string;
  convenio?: string;
  tipo_sanguineo?: string;
  indicacao?: string;
  observacoes?: string;
}


export interface MedicalRecordImportRow {
  cpf_paciente?: string;
  nome_paciente?: string;
  nome_profissional?: string;
  data_registro: string;
  queixa?: string;
  diagnostico?: string;
  tratamento?: string;
  prescricao?: string;
  observacoes?: string;
}

export interface ContactImportRow {
  cpf?: string;
  nome?: string;
  telefone?: string;
  telefone_fixo?: string;
  email?: string;
}

export interface DependentImportRow {
  nome_dependente: string;
  cpf_titular?: string;
  nome_titular?: string;
  cpf_dependente?: string;
  data_nascimento?: string;
  parentesco?: string;
  observacoes?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ImportRow<T> {
  rowNumber: number;
  data: T;
  validation: ValidationResult;
}

// CPF validation
export function validateCPF(cpf: string): boolean {
  if (!cpf) return true; // CPF is optional
  
  const cleanCPF = cpf.replace(/\D/g, '');
  
  if (cleanCPF.length !== 11) return false;
  if (/^(\d)\1+$/.test(cleanCPF)) return false;
  
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleanCPF[i]) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF[9])) return false;
  
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleanCPF[i]) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF[10])) return false;
  
  return true;
}

// Normalize name for comparison (removes accents, extra spaces, converts to lowercase)
export function normalizeNameForComparison(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9\s]/g, ' ') // Remove punctuation/symbols (keep letters/numbers/spaces)
    .replace(/\s+/g, ' ') // Normalize multiple spaces to single
    .trim();
}

// Phone validation (Brazilian format)
export function validatePhone(phone: string): boolean {
  if (!phone) return false;
  const cleanPhone = phone.replace(/\D/g, '');
  return cleanPhone.length >= 10 && cleanPhone.length <= 11;
}

// Format phone to standard format
export function formatPhone(phone: string): string {
  const cleanPhone = phone.replace(/\D/g, '');
  return cleanPhone;
}

// Format CPF to standard format
export function formatCPF(cpf: string): string {
  if (!cpf) return '';
  const cleanCPF = cpf.replace(/\D/g, '');
  if (cleanCPF.length !== 11) return cpf;
  return cleanCPF.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

// Parse date from various formats to YYYY-MM-DD
export function parseDate(dateStr: unknown): string | null {
  if (dateStr === null || dateStr === undefined) return null;

  // If it's already a Date instance
  if (dateStr instanceof Date && !isNaN(dateStr.getTime())) {
    const y = dateStr.getFullYear();
    if (y > 1900 && y < 2100) return dateStr.toISOString().split('T')[0];
  }

  const trimmed = String(dateStr).trim();
  if (!trimmed) return null;

  const to4DigitYear = (yy: string) => {
    const n = Number(yy);
    if (Number.isNaN(n)) return null;
    // Assume 00-69 => 2000-2069, 70-99 => 1970-1999
    return n >= 70 ? 1900 + n : 2000 + n;
  };

  // Try common formats with regex
  const formats = [
    { regex: /^(\d{4})-(\d{2})-(\d{2})$/, handler: (m: RegExpMatchArray) => `${m[1]}-${m[2]}-${m[3]}` }, // YYYY-MM-DD
    { regex: /^(\d{4})-(\d{2})-(\d{2})T/, handler: (m: RegExpMatchArray) => `${m[1]}-${m[2]}-${m[3]}` }, // YYYY-MM-DDTHH:MM:SS (ISO)
    { regex: /^(\d{4})-(\d{2})-(\d{2})\s/, handler: (m: RegExpMatchArray) => `${m[1]}-${m[2]}-${m[3]}` }, // YYYY-MM-DD HH:MM:SS

    // YYYY/MM/DD or YYYY.MM.DD
    { regex: /^(\d{4})\/(\d{1,2})\/(\d{1,2})(?:\D|$)/, handler: (m: RegExpMatchArray) => `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` },
    { regex: /^(\d{4})\.(\d{1,2})\.(\d{1,2})(?:\D|$)/, handler: (m: RegExpMatchArray) => `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` },

    // DD/MM/YYYY with optional time or extra text (e.g., "29/12/2025 às 01:13")
    { regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\D|$)/, handler: (m: RegExpMatchArray) => `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` },
    { regex: /^(\d{1,2})-(\d{1,2})-(\d{4})(?:\D|$)/, handler: (m: RegExpMatchArray) => `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` },
    { regex: /^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\D|$)/, handler: (m: RegExpMatchArray) => `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` },

    // DD/MM/YY (common in legacy exports)
    {
      regex: /^(\d{1,2})\/(\d{1,2})\/(\d{2})(?:\D|$)/,
      handler: (m: RegExpMatchArray) => {
        const year = to4DigitYear(m[3]);
        if (!year) return '';
        return `${String(year)}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
      },
    },
    {
      regex: /^(\d{1,2})-(\d{1,2})-(\d{2})(?:\D|$)/,
      handler: (m: RegExpMatchArray) => {
        const year = to4DigitYear(m[3]);
        if (!year) return '';
        return `${String(year)}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
      },
    },

    { regex: /^(\d{4})(\d{2})(\d{2})$/, handler: (m: RegExpMatchArray) => `${m[1]}-${m[2]}-${m[3]}` }, // YYYYMMDD
  ];

  for (const { regex, handler } of formats) {
    const match = trimmed.match(regex);
    if (match) {
      const result = handler(match);
      if (!result) continue;
      // Validate the result is a valid date
      const parsed = new Date(result);
      if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 1900 && parsed.getFullYear() < 2100) {
        return result;
      }
    }
  }

  // Try to parse as Excel date number (serial date)
  const excelDate = parseFloat(trimmed.replace(',', '.'));
  if (!isNaN(excelDate) && excelDate > 1 && excelDate < 100000) {
    // Excel serial date: days since 1899-12-30 (with Excel bug for 1900)
    const date = new Date((excelDate - 25569) * 86400 * 1000);
    if (!isNaN(date.getTime()) && date.getFullYear() > 1900 && date.getFullYear() < 2100) {
      return date.toISOString().split('T')[0];
    }
  }

  // Try native Date parsing as last resort
  const nativeDate = new Date(trimmed);
  if (!isNaN(nativeDate.getTime()) && nativeDate.getFullYear() > 1900 && nativeDate.getFullYear() < 2100) {
    return nativeDate.toISOString().split('T')[0];
  }

  return null;
}

// Format date from YYYY-MM-DD to DD/MM/YYYY for display
export function formatDateBR(dateStr: string | null): string {
  if (!dateStr) return '';
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[3]}/${match[2]}/${match[1]}`;
  }
  return dateStr;
}

// Validate patient row
// Observação: na importação, telefone pode estar ausente (algumas bases legadas não possuem contato).
// Mantemos como *warning* para permitir importar e completar depois.
export function validatePatientRow(row: PatientImportRow): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!row.nome?.trim()) {
    errors.push('Nome é obrigatório');
  }

  const phone = row.telefone?.trim() || '';
  if (!phone) {
    warnings.push('Telefone ausente (opcional na importação)');
  } else if (!validatePhone(phone)) {
    warnings.push('Telefone inválido (deve ter 10-11 dígitos)');
  }

  if (row.cpf && !validateCPF(row.cpf)) {
    errors.push('CPF inválido');
  }

  if (row.data_nascimento) {
    const parsed = parseDate(row.data_nascimento);
    if (!parsed) {
      warnings.push('Data de nascimento em formato não reconhecido');
    }
  }

  if (row.email && !row.email.includes('@')) {
    warnings.push('Email parece inválido');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}


// Validate medical record row
export function validateMedicalRecordRow(row: MedicalRecordImportRow): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!row.cpf_paciente && !row.nome_paciente) {
    errors.push('CPF ou Nome do paciente é obrigatório');
  }
  
  if (row.cpf_paciente && !validateCPF(row.cpf_paciente)) {
    errors.push('CPF do paciente inválido');
  }
  
  if (!row.data_registro) {
    errors.push('Data do registro é obrigatória');
  } else {
    const parsed = parseDate(row.data_registro);
    if (!parsed) {
      errors.push('Data do registro em formato inválido');
    }
  }
  
  if (!row.queixa && !row.diagnostico && !row.tratamento) {
    warnings.push('Prontuário sem informações clínicas');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// Validate contact row
export function validateContactRow(row: ContactImportRow): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!row.cpf && !row.nome) {
    errors.push('CPF ou Nome é obrigatório para vincular o contato');
  }
  
  if (row.cpf && !validateCPF(row.cpf)) {
    errors.push('CPF inválido');
  }
  
  if (!row.telefone && !row.telefone_fixo && !row.email) {
    errors.push('Pelo menos um contato (telefone, fixo ou email) é obrigatório');
  }
  
  if (row.telefone && !validatePhone(row.telefone)) {
    warnings.push('Telefone celular inválido (deve ter 10-11 dígitos)');
  }
  
  if (row.telefone_fixo && !validatePhone(row.telefone_fixo)) {
    warnings.push('Telefone fixo inválido (deve ter 10-11 dígitos)');
  }
  
  if (row.email && !row.email.includes('@')) {
    warnings.push('Email parece inválido');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// Validate dependent row
export function validateDependentRow(row: DependentImportRow): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!row.nome_dependente?.trim()) {
    errors.push('Nome do dependente é obrigatório');
  }
  
  if (!row.cpf_titular && !row.nome_titular) {
    errors.push('CPF ou Nome do titular é obrigatório para vincular');
  }
  
  if (row.cpf_titular && !validateCPF(row.cpf_titular)) {
    errors.push('CPF do titular inválido');
  }
  
  if (row.cpf_dependente && !validateCPF(row.cpf_dependente)) {
    warnings.push('CPF do dependente inválido');
  }
  
  if (row.data_nascimento) {
    const parsed = parseDate(row.data_nascimento);
    if (!parsed) {
      warnings.push('Data de nascimento em formato não reconhecido');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// Map contact row from spreadsheet
export function mapContactRow(row: Record<string, unknown>): ContactImportRow {
  return {
    cpf: getRowValue(row, [
      'cpf', 'CPF', 'documento', 'Documento', 'DOCUMENTO',
      'cpf_paciente', 'CPF Paciente', 'patient_cpf'
    ]) || undefined,
    nome: getRowValue(row, [
      'nome', 'Nome', 'NOME', 'name', 'Name', 'NAME',
      'nome_paciente', 'Nome Paciente', 'patient_name',
      'paciente', 'Paciente', 'cliente', 'Cliente'
    ]) || undefined,
    telefone: getRowValue(row, [
      'telefone', 'Telefone', 'TELEFONE', 'celular', 'Celular', 'CELULAR',
      'phone', 'Phone', 'PHONE', 'mobile', 'Mobile', 'MOBILE',
      'whatsapp', 'WhatsApp', 'Whatsapp', 'WHATSAPP',
      'tel', 'Tel', 'TEL', 'fone', 'Fone', 'FONE'
    ]) || undefined,
    telefone_fixo: getRowValue(row, [
      'telefone_fixo', 'Telefone Fixo', 'TELEFONE FIXO',
      'fixo', 'Fixo', 'FIXO', 'landline', 'Landline', 'LANDLINE',
      'tel_fixo', 'Tel Fixo', 'residencial', 'Residencial'
    ]) || undefined,
    email: getRowValue(row, [
      'email', 'Email', 'EMAIL', 'e-mail', 'E-mail', 'E-MAIL',
      'correio', 'Correio', 'mail', 'Mail', 'MAIL'
    ]) || undefined,
  };
}

// Map dependent row from spreadsheet
export function mapDependentRow(row: Record<string, unknown>): DependentImportRow {
  return {
    nome_dependente: getRowValue(row, [
      'nome_dependente', 'Nome Dependente', 'NOME_DEPENDENTE', 'nome do dependente',
      'dependente', 'Dependente', 'DEPENDENTE', 'nome', 'Nome', 'NOME',
      'dependent_name', 'Dependent Name'
    ]),
    cpf_titular: getRowValue(row, [
      'cpf_titular', 'CPF Titular', 'CPF_TITULAR', 'cpf do titular',
      'cpf_paciente', 'CPF Paciente', 'cpf paciente', 'titular_cpf',
      'patient_cpf', 'cpf_responsavel', 'CPF Responsável'
    ]) || undefined,
    nome_titular: getRowValue(row, [
      'nome_titular', 'Nome Titular', 'NOME_TITULAR', 'nome do titular',
      'titular', 'Titular', 'TITULAR', 'nome_paciente', 'Nome Paciente',
      'paciente', 'Paciente', 'responsavel', 'Responsável', 'Responsavel',
      'patient_name', 'Patient Name'
    ]) || undefined,
    cpf_dependente: getRowValue(row, [
      'cpf_dependente', 'CPF Dependente', 'CPF_DEPENDENTE', 'cpf do dependente',
      'cpf', 'CPF', 'documento_dependente', 'Documento Dependente'
    ]) || undefined,
    data_nascimento: getRowValue(row, [
      'data_nascimento', 'Data Nascimento', 'Data de Nascimento', 'DATA_NASCIMENTO',
      'nascimento', 'Nascimento', 'birth_date', 'birthdate',
      'data_nasc', 'dt_nascimento'
    ]) || undefined,
    parentesco: getRowValue(row, [
      'parentesco', 'Parentesco', 'PARENTESCO', 'grau_parentesco', 'Grau Parentesco',
      'relacao', 'Relação', 'Relacao', 'relationship', 'Relationship',
      'tipo', 'Tipo', 'vinculo', 'Vínculo', 'Vinculo'
    ]) || undefined,
    observacoes: getRowValue(row, [
      'observacoes', 'Observações', 'Observacoes', 'OBSERVACOES',
      'notas', 'Notas', 'notes', 'Notes', 'obs', 'Obs'
    ]) || undefined,
  };
}

// Detected sheet types
export type DetectedSheetType = 'patients' | 'records' | 'unknown';

export interface DetectedSheet {
  name: string;
  type: DetectedSheetType;
  columns: string[];
  rowCount: number;
}

export interface MultiSheetParseResult {
  sheets: DetectedSheet[];
  patients: ImportRow<PatientImportRow>[];
  records: ImportRow<MedicalRecordImportRow>[];
}

// Header mapping for legacy/alternative column names to standard names
const HEADER_MAPPINGS: Record<string, string> = {
  // CPF variations
  'nrcpf': 'cpf',
  'nr_cpf': 'cpf',
  'cpf_numero': 'cpf',
  'num_cpf': 'cpf',
  
  // Nome variations
  'nmsocio': 'nome',
  'nm_socio': 'nome',
  'nmpaciente': 'nome',
  'nm_paciente': 'nome',
  'nmcliente': 'nome',
  'nm_cliente': 'nome',
  'nmnome': 'nome',
  'nm_nome': 'nome',
  
  // Sindicalização (pode ser usado como indicação ou observação)
  'cdsindicalizacao': 'indicacao',
  'cd_sindicalizacao': 'indicacao',
  
  // Endereço variations
  'nmendereco': 'endereco',
  'nm_endereco': 'endereco',
  'dsendereco': 'endereco',
  'ds_endereco': 'endereco',
  
  // Bairro variations
  'nmbairro': 'bairro',
  'nm_bairro': 'bairro',
  'dsbairro': 'bairro',
  'ds_bairro': 'bairro',
  
  // Email variations
  'nmemail': 'email',
  'nm_email': 'email',
  'dsemail': 'email',
  'ds_email': 'email',
  
  // Telefone variations
  'nrfone': 'telefone',
  'nr_fone': 'telefone',
  'nrtelefone': 'telefone',
  'nr_telefone': 'telefone',
  'nrcel': 'telefone',
  'nr_cel': 'telefone',
  'nrcelular': 'telefone',
  'nr_celular': 'telefone',
  
  // Data nascimento variations
  'dtnascimento': 'data_nascimento',
  'dt_nascimento': 'data_nascimento',
  'dtnasc': 'data_nascimento',
  'dt_nasc': 'data_nascimento',
  
  // Nome dependente variations
  'nmdependente': 'nome_dependente',
  'nm_dependente': 'nome_dependente',
  'dsdependente': 'nome_dependente',
  'ds_dependente': 'nome_dependente',
  
  // Nome pai variations
  'nmpai': 'nome_pai',
  'nm_pai': 'nome_pai',
  'dspai': 'nome_pai',
  'ds_pai': 'nome_pai',
  
  // Nome mãe variations
  'nmmae': 'nome_mae',
  'nm_mae': 'nome_mae',
  'dsmae': 'nome_mae',
  'ds_mae': 'nome_mae',
  
  // RG variations
  'nrrg': 'rg',
  'nr_rg': 'rg',
  'dsrg': 'rg',
  'ds_rg': 'rg',
  
  // Sexo variations
  'cdsexo': 'sexo',
  'cd_sexo': 'sexo',
  'dssexo': 'sexo',
  'ds_sexo': 'sexo',
  
  // Estado civil variations
  'cdestadocivil': 'estado_civil',
  'cd_estado_civil': 'estado_civil',
  'dsestadocivil': 'estado_civil',
  'ds_estado_civil': 'estado_civil',
  
  // Cidade variations
  'nmcidade': 'cidade',
  'nm_cidade': 'cidade',
  'dscidade': 'cidade',
  'ds_cidade': 'cidade',
  
  // Estado/UF variations
  'cduf': 'estado',
  'cd_uf': 'estado',
  'sguf': 'estado',
  'sg_uf': 'estado',
  'nmestado': 'estado',
  'nm_estado': 'estado',
  
  // CEP variations
  'nrcep': 'cep',
  'nr_cep': 'cep',
  'cdcep': 'cep',
  'cd_cep': 'cep',
  
  // Observações variations
  'dsobservacao': 'observacoes',
  'ds_observacao': 'observacoes',
  'dsobservacoes': 'observacoes',
  'ds_observacoes': 'observacoes',
  'txobservacao': 'observacoes',
  'tx_observacao': 'observacoes',
  
  // Convênio variations
  'nmconvenio': 'convenio',
  'nm_convenio': 'convenio',
  'dsconvenio': 'convenio',
  'ds_convenio': 'convenio',
  'cdconvenio': 'convenio',
  'cd_convenio': 'convenio',
  
  // Profissão variations
  'nmprofissao': 'profissao',
  'nm_profissao': 'profissao',
  'dsprofissao': 'profissao',
  'ds_profissao': 'profissao',
  
  // Data registro (para prontuários)
  'dtregistro': 'data_registro',
  'dt_registro': 'data_registro',
  'dtatendimento': 'data_registro',
  'dt_atendimento': 'data_registro',
  'dtconsulta': 'data_registro',
  'dt_consulta': 'data_registro',
};

// Normalize column header for comparison (removes accents, converts to lowercase, replaces spaces with underscores)
function normalizeColumnHeader(header: string): string {
  const normalized = String(header)
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9]/g, '_') // Replace non-alphanumeric with underscore
    .replace(/_+/g, '_') // Remove duplicate underscores
    .replace(/^_|_$/g, ''); // Trim underscores at start/end
  
  // Check if there's a mapping for this header
  return HEADER_MAPPINGS[normalized] || normalized;
}

// Convert headers in a row object to standard format
export function convertRowHeaders(row: Record<string, unknown>): Record<string, unknown> {
  const converted: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(row)) {
    const normalizedKey = normalizeColumnHeader(key);
    // If key was converted, use the new key; otherwise keep original
    const newKey = HEADER_MAPPINGS[normalizedKey] ? normalizedKey : key;
    converted[newKey] = value;
  }
  
  return converted;
}

// Get list of recognized header mappings for UI display
export function getHeaderMappings(): { original: string; converted: string }[] {
  const uniqueMappings = new Map<string, string>();
  
  for (const [original, converted] of Object.entries(HEADER_MAPPINGS)) {
    if (!uniqueMappings.has(converted)) {
      uniqueMappings.set(converted, original.toUpperCase());
    }
  }
  
  return Array.from(uniqueMappings.entries()).map(([converted, original]) => ({
    original,
    converted,
  }));
}

// Detect sheet type based on columns and sheet name
export function detectSheetType(columns: string[], sheetName?: string): DetectedSheetType {
  const normalizedColumns = columns.map(normalizeColumnHeader);
  const normalizedSheetName = sheetName ? normalizeColumnHeader(sheetName) : '';

  // Sheet name signals (highest priority)
  const patientSheetNames = ['pacientes', 'paciente', 'patients', 'patient', 'cadastro', 'clientes', 'clientes_pacientes'];
  const recordSheetNames = [
    'prontuarios',
    'prontuario',
    'records',
    'medical_records',
    'medicalrecord',
    'evolucoes',
    'evolucao',
    'atendimentos',
    'consultas',
    'event_record', // iClinic format
    'eventrecord',
  ];

  if (recordSheetNames.some((n) => normalizedSheetName.includes(n))) return 'records';
  if (patientSheetNames.some((n) => normalizedSheetName.includes(n))) return 'patients';

  // iClinic format detection - if has eventblock_pack column, it's medical records
  const iClinicRecordColumns = ['eventblock_pack', 'event_block_pack', 'eventblockpack'];
  if (iClinicRecordColumns.some((col) => normalizedColumns.some((c) => c.includes(col)))) {
    return 'records';
  }

  // Patient indicators
  const patientIndicators = [
    // Portuguese
    'nome', 'telefone', 'celular', 'cpf', 'email',
    'nascimento', 'data_nascimento', 'data_de_nascimento',
    'endereco', 'observacoes', 'notas', 'criado', 'criado_em',
    'convenio', 'plano', 'rg', 'sexo', 'genero',
    // English
    'name', 'phone', 'cell', 'mobile', 'birth', 'birthdate', 'date_of_birth',
    'address', 'notes', 'created', 'created_at', 'insurance', 'gender',
    // Common variations
    'fone', 'whatsapp', 'zap', 'contato', 'contact',
  ];
  const patientMatches = patientIndicators.filter((ind) =>
    normalizedColumns.some((col) => col.includes(ind))
  ).length;

  // Medical record indicators
  const recordIndicators = [
    // Portuguese
    'queixa', 'queixa_principal', 'motivo_consulta',
    'diagnostico', 'cid', 'doenca',
    'tratamento', 'plano_de_tratamento', 'conduta',
    'prescricao', 'receita', 'medicamento',
    'data_registro', 'data_do_registro', 'data_atendimento', 'data_consulta',
    'evolucao', 'anamnese', 'exame_fisico',
    'prontuario', 'registro_medico', 'ficha',
    'cpf_paciente', 'cpf_do_paciente',
    'nome_paciente', 'nome_do_paciente',
    // iClinic specific columns
    'patient_name', 'patient_id', 'physician_name', 'physician_id',
    'healthinsurance_pack', 'procedure_pack', 'extra_pack',
    // English
    'chief_complaint', 'complaint', 'reason',
    'diagnosis', 'disease', 'condition',
    'treatment', 'treatment_plan',
    'prescription', 'medication', 'medicine',
    'record_date', 'visit_date', 'appointment_date',
    'evolution', 'progress', 'progress_note',
    'medical_record', 'chart', 'patient_name', 'patient_cpf',
  ];
  const recordMatches = recordIndicators.filter((ind) =>
    normalizedColumns.some((col) => col.includes(ind))
  ).length;

  // Strong record-specific columns (if any of these exist, it's likely records)
  const strongRecordIndicators = [
    'queixa', 'diagnostico', 'tratamento', 'prescricao', 'evolucao', 'anamnese',
    'chief_complaint', 'diagnosis', 'treatment', 'prescription',
    // Common single-column record patterns from legacy systems
    'descricao_do_registro', 'descricao_registro', 'registro_medico',
    'historico_clinico', 'prontuario_medico', 'ficha_clinica',
    // iClinic specific
    'eventblock_pack', 'procedure_pack', 'physician_id',
  ];
  const hasStrongRecordColumn = strongRecordIndicators.some((ind) =>
    normalizedColumns.some((col) => col.includes(ind))
  );
  if (hasStrongRecordColumn) return 'records';

  // If has 2+ record indicators, it's records
  if (recordMatches >= 2) return 'records';

  // If has patient columns but no record-specific ones
  if (patientMatches >= 2 && recordMatches < 2) return 'patients';

  // Last resort: if has nome/name and telefone/phone but nothing record-specific
  const hasNameAndPhone =
    normalizedColumns.some((c) => c.includes('nome') || c.includes('name')) &&
    normalizedColumns.some((c) => c.includes('telefone') || c.includes('phone') || c.includes('celular'));
  if (hasNameAndPhone && recordMatches === 0) return 'patients';

  return 'unknown';
}

// Get detected columns info for debugging
export function getDetectedColumnsInfo(columns: string[]): string {
  const first5 = columns.slice(0, 5).join(', ');
  const remaining = columns.length > 5 ? ` (+${columns.length - 5} mais)` : '';
  return first5 + remaining;
}

// Extract rows from a worksheet even when the header is not on the first row
function extractSheetRows(worksheet: XLSX.WorkSheet): { rows: Record<string, unknown>[]; columns: string[] } {
  // Read as matrix (rows/cols), keeping blanks
  const matrix = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: '',
    blankrows: false,
  }) as unknown[][];

  const nonEmptyCount = (r: unknown[]) => r.filter((c) => String(c ?? '').trim() !== '').length;

  // Pick header row: first row with enough cells OR the densest row
  let headerRowIndex = -1;
  let bestIdx = -1;
  let bestScore = 0;

  for (let i = 0; i < matrix.length; i++) {
    const row = matrix[i] as unknown[];
    const score = nonEmptyCount(row);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
    if (score >= 2) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) headerRowIndex = bestIdx;
  if (headerRowIndex === -1) return { rows: [], columns: [] };

  const rawHeader = (matrix[headerRowIndex] as unknown[]).map((c) => String(c ?? '').trim());
  const columns = rawHeader.filter((h) => h !== '');

  // If headers are empty/meaningless, we can't map reliably
  if (columns.length === 0) return { rows: [], columns: [] };

  const rows: Record<string, unknown>[] = [];

  for (let i = headerRowIndex + 1; i < matrix.length; i++) {
    const rowArr = matrix[i] as unknown[];
    // stop at fully empty row blocks
    if (nonEmptyCount(rowArr) === 0) continue;

    const obj: Record<string, unknown> = {};
    for (let c = 0; c < rawHeader.length; c++) {
      const key = rawHeader[c];
      if (!key) continue;
      obj[key] = rowArr[c];
    }

    // Ignore rows that are empty after mapping
    if (Object.values(obj).every((v) => String(v ?? '').trim() === '')) continue;

    rows.push(obj);
  }

  return { rows, columns };
}

// Parse single sheet
function parseSheet<T>(
  worksheet: XLSX.WorkSheet,
  validateRow: (row: T) => ValidationResult,
  mapRow: (row: Record<string, unknown>) => T
): ImportRow<T>[] {
  const { rows } = extractSheetRows(worksheet);

  return rows.map((row, index) => {
    const mappedData = mapRow(row);
    const validation = validateRow(mappedData);
    return {
      rowNumber: index + 2,
      data: mappedData,
      validation,
    };
  });
}

// Parse Excel/CSV file (single sheet - legacy)
export function parseSpreadsheet<T>(
  file: ArrayBuffer,
  validateRow: (row: T) => ValidationResult,
  mapRow: (row: Record<string, unknown>) => T
): ImportRow<T>[] {
  const workbook = XLSX.read(file, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  return parseSheet(worksheet, validateRow, mapRow);
}

// Parse multi-sheet Excel file with auto-detection
export function parseMultiSheetSpreadsheet(file: ArrayBuffer): MultiSheetParseResult {
  const workbook = XLSX.read(file, { type: 'array' });

  const sheets: DetectedSheet[] = [];
  let patients: ImportRow<PatientImportRow>[] = [];
  let records: ImportRow<MedicalRecordImportRow>[] = [];

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const { rows, columns } = extractSheetRows(worksheet);

    if (rows.length === 0 || columns.length === 0) continue;

    const sheetType = detectSheetType(columns, sheetName);

    sheets.push({
      name: sheetName,
      type: sheetType,
      columns,
      rowCount: rows.length,
    });

    if (sheetType === 'patients') {
      const parsed = rows.map((row, index) => {
        const mappedData = mapPatientRow(row);
        const validation = validatePatientRow(mappedData);
        return { rowNumber: index + 2, data: mappedData, validation };
      });
      patients = [...patients, ...parsed];
    } else if (sheetType === 'records') {
      const parsed = rows.map((row, index) => {
        const mappedData = mapMedicalRecordRow(row);
        const validation = validateMedicalRecordRow(mappedData);
        return { rowNumber: index + 2, data: mappedData, validation };
      });
      records = [...records, ...parsed];
    }
  }

  return { sheets, patients, records };
}

// Force parse a specific sheet as a specific type
export function forceParseSheetAsType(
  file: ArrayBuffer,
  sheetIndex: number,
  forceType: 'patients' | 'records'
): { patients: ImportRow<PatientImportRow>[]; records: ImportRow<MedicalRecordImportRow>[] } {
  const workbook = XLSX.read(file, { type: 'array' });

  if (sheetIndex >= workbook.SheetNames.length) {
    return { patients: [], records: [] };
  }

  const sheetName = workbook.SheetNames[sheetIndex];
  const worksheet = workbook.Sheets[sheetName];

  if (forceType === 'patients') {
    const parsed = parseSheet(worksheet, validatePatientRow, mapPatientRow);
    return { patients: parsed, records: [] };
  }

  const parsed = parseSheet(worksheet, validateMedicalRecordRow, mapMedicalRecordRow);
  return { patients: [], records: parsed };
}

// Parse all sheets forcing all unknown ones as a specific type
export function parseWithForcedType(
  file: ArrayBuffer,
  forceUnknownAs: 'patients' | 'records'
): MultiSheetParseResult {
  const workbook = XLSX.read(file, { type: 'array' });

  const sheets: DetectedSheet[] = [];
  let patients: ImportRow<PatientImportRow>[] = [];
  let records: ImportRow<MedicalRecordImportRow>[] = [];

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const { rows, columns } = extractSheetRows(worksheet);

    if (rows.length === 0 || columns.length === 0) continue;

    let sheetType = detectSheetType(columns, sheetName);
    if (sheetType === 'unknown') sheetType = forceUnknownAs;

    sheets.push({
      name: sheetName,
      type: sheetType,
      columns,
      rowCount: rows.length,
    });

    if (sheetType === 'patients') {
      const parsed = rows.map((row, index) => {
        const mappedData = mapPatientRow(row);
        const validation = validatePatientRow(mappedData);
        return { rowNumber: index + 2, data: mappedData, validation };
      });
      patients = [...patients, ...parsed];
    } else if (sheetType === 'records') {
      const parsed = rows.map((row, index) => {
        const mappedData = mapMedicalRecordRow(row);
        const validation = validateMedicalRecordRow(mappedData);
        return { rowNumber: index + 2, data: mappedData, validation };
      });
      records = [...records, ...parsed];
    }
  }

  return { sheets, patients, records };
}

// Generate combined template with both sheets
export function generateCombinedTemplate(): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  
  // Patients sheet
  const patientsData = [
    {
      nome: 'João Silva',
      telefone: '71999999999',
      telefone_fixo: '7133334444',
      email: 'joao@email.com',
      cpf: '000.000.000-00',
      rg: '1234567890',
      data_nascimento: '1990-01-15',
      sexo: 'Masculino',
      estado_civil: 'Casado',
      naturalidade: 'Salvador - BA',
      profissao: 'Engenheiro',
      escolaridade: 'Superior Completo',
      nome_mae: 'Maria Silva',
      nome_pai: 'José Silva',
      cep: '40000-000',
      rua: 'Rua Exemplo',
      numero: '123',
      complemento: 'Apto 101',
      bairro: 'Centro',
      cidade: 'Salvador',
      estado: 'BA',
      convenio: 'Unimed',
      indicacao: 'Google',
      observacoes: 'Paciente VIP',
    },
  ];
  const wsPatients = XLSX.utils.json_to_sheet(patientsData);
  XLSX.utils.book_append_sheet(wb, wsPatients, 'Pacientes');
  
  // Medical records sheet
  const recordsData = [
    {
      cpf_paciente: '000.000.000-00',
      nome_paciente: 'João Silva',
      profissional: 'Dr. Carlos Andrade',
      data_registro: '2024-01-15',
      queixa: 'Dor de cabeça persistente',
      diagnostico: 'Cefaleia tensional',
      tratamento: 'Repouso e hidratação',
      prescricao: 'Dipirona 500mg 8/8h por 3 dias',
      observacoes: 'Retorno em 15 dias',
    },
  ];
  const wsRecords = XLSX.utils.json_to_sheet(recordsData);
  XLSX.utils.book_append_sheet(wb, wsRecords, 'Prontuarios');
  
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
}

// Helper to get value from row with multiple possible keys
function coerceCellToString(value: unknown): string {
  if (value === null || value === undefined) return '';

  // Excel can yield Date objects when cells are typed as dates
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().split('T')[0];
  }

  // Excel sometimes yields numbers (or scientific notation strings)
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(Math.trunc(value));
  }

  const str = String(value).trim();

  // Handle scientific notation like "7.1999999999E10"
  if (/^[+-]?(\d+\.?\d*|\d*\.?\d+)[eE][+-]?\d+$/.test(str)) {
    const n = Number(str);
    if (Number.isFinite(n)) return String(Math.trunc(n));
  }

  return str;
}

function isEmptyLike(value: string): boolean {
  const v = value.trim().toLowerCase();
  return (
    v === '' ||
    v === '-' ||
    v === '—' ||
    v === 'null' ||
    v === 'undefined' ||
    v === 'n/a' ||
    v === 'na' ||
    v === 'sem' ||
    v === 'sem telefone' ||
    v === 'sem celular'
  );
}

// Normalize line breaks in text content for proper display
function normalizeLineBreaks(text: string): string {
  if (!text) return text;
  
  return text
    // Convert HTML line breaks to newlines
    .replace(/<br\s*\/?>/gi, '\n')
    // Convert HTML paragraphs to double newlines
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<\/p>/gi, '\n')
    // Convert Windows line breaks (CRLF) to Unix (LF)
    .replace(/\r\n/g, '\n')
    // Convert old Mac line breaks (CR) to Unix (LF)
    .replace(/\r/g, '\n')
    // Convert escaped newlines
    .replace(/\\n/g, '\n')
    // Convert double backslash-n (from some exports)
    .replace(/\\\\n/g, '\n')
    // Remove other HTML tags but preserve content
    .replace(/<[^>]+>/g, '')
    // Normalize multiple consecutive newlines (max 2)
    .replace(/\n{3,}/g, '\n\n')
    // Trim whitespace from each line
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    // Final trim
    .trim();
}

// Helper to get value from row with multiple possible keys
function getRowValue(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    // Try exact match first
    if (row[key] !== undefined && row[key] !== null) {
      const raw = coerceCellToString(row[key]);
      if (!isEmptyLike(raw)) return raw;
    }

    // Try case-insensitive/normalized match
    const foundKey = Object.keys(row).find(
      (k) => normalizeColumnHeader(k) === normalizeColumnHeader(key)
    );
    if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null) {
      const raw = coerceCellToString(row[foundKey]);
      if (!isEmptyLike(raw)) return raw;
    }
  }
  return '';
}

// Map raw row to PatientImportRow
export function mapPatientRow(row: Record<string, unknown>): PatientImportRow {
  return {
    nome: getRowValue(row, [
      'nome', 'Nome', 'NOME', 'Paciente', 'paciente', 'PACIENTE',
      'name', 'Name', 'NAME', 'patient', 'Patient', 'PATIENT',
      'nome_completo', 'Nome Completo', 'full_name', 'Full Name',
      'cliente', 'Cliente', 'CLIENTE', 'client', 'Client'
    ]),
    telefone: getRowValue(row, [
      'telefone', 'Telefone', 'TELEFONE',
      'telefones', 'Telefones', 'TELEFONES',
      'telefone_1', 'Telefone 1', 'Telefone1', 'Tel 1', 'Tel1',
      'telefone_principal', 'Telefone Principal',
      'celular', 'Celular', 'CELULAR',
      'celulares', 'Celulares',
      'celular_1', 'Celular 1', 'Celular1',
      'whatsapp', 'Whatsapp', 'WHATSAPP',
      'whats', 'Whats',
      'fone', 'Fone', 'FONE',
      'tel', 'Tel', 'TEL', 'telefone_contato', 'Telefone Contato',
      'phone', 'Phone', 'PHONE',
      'mobile', 'Mobile', 'MOBILE',
      'cell', 'Cell',
      'zap', 'Zap', 'contato', 'Contato', 'contact', 'Contact',
    ]),
    telefone_fixo: getRowValue(row, [
      'telefone_fixo', 'Telefone Fixo', 'TELEFONE_FIXO',
      'fixo', 'Fixo', 'FIXO', 'landline', 'Landline',
      'residencial', 'Residencial', 'tel_fixo', 'Tel Fixo',
      'telefone_residencial', 'Telefone Residencial',
      'telefone_2', 'Telefone 2', 'Telefone2', 'Tel 2', 'Tel2',
    ]) || undefined,
    email: getRowValue(row, [
      'email', 'Email', 'EMAIL', 'e-mail', 'E-mail', 'E-MAIL',
      'correio', 'Correio', 'mail', 'Mail'
    ]) || undefined,
    cpf: getRowValue(row, [
      'cpf', 'CPF', 'Cpf', 'documento', 'Documento', 'DOCUMENTO',
      'document', 'Document', 'tax_id', 'Tax ID'
    ]) || undefined,
    rg: getRowValue(row, [
      'rg', 'RG', 'Rg', 'identidade', 'Identidade', 'IDENTIDADE',
      'documento_identidade', 'Documento Identidade'
    ]) || undefined,
    data_nascimento: getRowValue(row, [
      'data_nascimento', 'Data de Nascimento', 'Data Nascimento', 'nascimento',
      'Nascimento', 'DATA_NASCIMENTO', 'datanascimento', 'DataNascimento',
      'birth_date', 'Birth Date', 'birthdate', 'Birthdate', 'BIRTH_DATE',
      'data_nasc', 'Data Nasc', 'dt_nascimento', 'Dt Nascimento',
      'aniversario', 'Aniversario', 'birthday', 'Birthday'
    ]) || undefined,
    sexo: getRowValue(row, [
      'sexo', 'Sexo', 'SEXO', 'genero', 'Genero', 'Gênero', 'gênero',
      'gender', 'Gender', 'GENDER', 'sex', 'Sex'
    ]) || undefined,
    estado_civil: getRowValue(row, [
      'estado_civil', 'Estado Civil', 'ESTADO_CIVIL', 'estadocivil',
      'marital_status', 'Marital Status', 'situacao_conjugal'
    ]) || undefined,
    naturalidade: getRowValue(row, [
      'naturalidade', 'Naturalidade', 'NATURALIDADE',
      'birthplace', 'Birthplace', 'local_nascimento', 'Local Nascimento'
    ]) || undefined,
    profissao: getRowValue(row, [
      'profissao', 'Profissão', 'Profissao', 'PROFISSAO',
      'profession', 'Profession', 'ocupacao', 'Ocupação', 'Ocupacao',
      'occupation', 'Occupation', 'trabalho', 'Trabalho'
    ]) || undefined,
    escolaridade: getRowValue(row, [
      'escolaridade', 'Escolaridade', 'ESCOLARIDADE',
      'education', 'Education', 'grau_instrucao', 'Grau Instrução'
    ]) || undefined,
    nome_mae: getRowValue(row, [
      'nome_mae', 'Nome Mãe', 'Nome Mae', 'NOME_MAE', 'mae', 'Mãe', 'Mae',
      'mother_name', 'Mother Name', 'nome_da_mae', 'Nome da Mãe'
    ]) || undefined,
    nome_pai: getRowValue(row, [
      'nome_pai', 'Nome Pai', 'NOME_PAI', 'pai', 'Pai',
      'father_name', 'Father Name', 'nome_do_pai', 'Nome do Pai'
    ]) || undefined,
    cep: getRowValue(row, [
      'cep', 'CEP', 'Cep', 'codigo_postal', 'Código Postal',
      'zip', 'ZIP', 'zip_code', 'Zip Code', 'postal_code'
    ]) || undefined,
    rua: getRowValue(row, [
      'rua', 'Rua', 'RUA', 'logradouro', 'Logradouro', 'LOGRADOURO',
      'street', 'Street', 'STREET', 'endereco_rua', 'Endereço Rua'
    ]) || undefined,
    numero: getRowValue(row, [
      'numero', 'Numero', 'Número', 'NUMERO', 'num', 'Num', 'NUM',
      'number', 'Number', 'NUMBER', 'numero_endereco', 'Número Endereço',
      'n', 'nº', 'Nº'
    ]) || undefined,
    complemento: getRowValue(row, [
      'complemento', 'Complemento', 'COMPLEMENTO',
      'complement', 'Complement', 'apto', 'Apto', 'apartamento', 'Apartamento'
    ]) || undefined,
    bairro: getRowValue(row, [
      'bairro', 'Bairro', 'BAIRRO',
      'neighborhood', 'Neighborhood', 'district', 'District'
    ]) || undefined,
    cidade: getRowValue(row, [
      'cidade', 'Cidade', 'CIDADE', 'municipio', 'Município', 'Municipio',
      'city', 'City', 'CITY'
    ]) || undefined,
    estado: getRowValue(row, [
      'estado', 'Estado', 'ESTADO', 'uf', 'UF', 'Uf',
      'state', 'State', 'STATE'
    ]) || undefined,
    endereco: getRowValue(row, [
      'endereco', 'Endereco', 'ENDERECO', 'endereço', 'Endereço',
      'endereco_completo', 'Endereço Completo',
      'address', 'Address', 'ADDRESS', 'full_address', 'Full Address'
    ]) || undefined,
    convenio: getRowValue(row, [
      'convenio', 'Convênio', 'Convenio', 'CONVENIO',
      'plano', 'Plano', 'PLANO', 'plano_saude', 'Plano de Saúde',
      'insurance', 'Insurance', 'health_plan', 'Health Plan'
    ]) || undefined,
    tipo_sanguineo: getRowValue(row, [
      'tipo_sanguineo', 'Tipo Sanguíneo', 'Tipo Sanguineo', 'TIPO_SANGUINEO',
      'sangue', 'Sangue', 'blood_type', 'Blood Type', 'grupo_sanguineo'
    ]) || undefined,
    indicacao: getRowValue(row, [
      'indicacao', 'Indicação', 'Indicacao', 'INDICACAO',
      'referral', 'Referral', 'como_conheceu', 'Como Conheceu',
      'origem', 'Origem', 'source', 'Source'
    ]) || undefined,
    observacoes: getRowValue(row, [
      'observacoes', 'Observacoes', 'OBSERVACOES', 'observações', 'Observações',
      'notas', 'Notas', 'NOTAS', 'obs', 'Obs', 'OBS',
      'notes', 'Notes', 'NOTES', 'comments', 'Comments',
      'anotacoes', 'Anotacoes', 'anotações', 'Anotações'
    ]) || undefined,
  };
}

// Helper to parse iClinic JSON format from eventblock_pack or similar columns
function parseIClinicEventBlock(value: unknown): {
  queixa?: string;
  historia?: string;
  prescricao?: string;
  diagnostico?: string;
  tratamento?: string;
  exame_fisico?: string;
} {
  if (!value) return {};
  
  let jsonStr = String(value).trim();
  
  // Handle "json::" prefix from iClinic exports
  if (jsonStr.startsWith('json::')) {
    jsonStr = jsonStr.slice(6);
  }
  
  // If it doesn't look like JSON, return empty
  if (!jsonStr.startsWith('{') && !jsonStr.startsWith('[')) {
    return {};
  }
  
  try {
    const parsed = JSON.parse(jsonStr);
    const result: { 
      queixa?: string; 
      historia?: string; 
      prescricao?: string;
      diagnostico?: string;
      tratamento?: string;
      exame_fisico?: string;
    } = {};
    
    // Collect all content by tab/category
    const contentByTab: Record<string, string[]> = {};
    
    // Extract from "block" array
    if (parsed.block && Array.isArray(parsed.block)) {
      for (const item of parsed.block) {
        const name = String(item.name || '').toLowerCase();
        const tab = String(item.tab || '').toLowerCase();
        const val = String(item.value || '')
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<[^>]+>/g, '')
          .trim();
        
        if (!val) continue;
        
        // Map iClinic field names to our structure
        if (name.includes('queixa') || name.includes('motivo')) {
          result.queixa = result.queixa ? `${result.queixa}\n${val}` : val;
        } else if (name.includes('história') || name.includes('historia') || name.includes('hda') || name.includes('hmp')) {
          result.historia = result.historia ? `${result.historia}\n${val}` : val;
        } else if (name.includes('diagnóstico') || name.includes('diagnostico') || name.includes('hipótese') || name.includes('hipotese') || name.includes('cid')) {
          result.diagnostico = result.diagnostico ? `${result.diagnostico}\n${val}` : val;
        } else if (name.includes('conduta') || name.includes('tratamento') || name.includes('plano')) {
          result.tratamento = result.tratamento ? `${result.tratamento}\n${val}` : val;
        } else if (name.includes('exame') || name.includes('físico') || name.includes('fisico')) {
          result.exame_fisico = result.exame_fisico ? `${result.exame_fisico}\n${val}` : val;
        } else {
          // Group by tab for fallback content
          const tabKey = tab || 'geral';
          if (!contentByTab[tabKey]) contentByTab[tabKey] = [];
          contentByTab[tabKey].push(`${item.name || 'Nota'}: ${val}`);
        }
      }
    }
    
    // If we have ungrouped content, add to historia
    const allContent = Object.values(contentByTab).flat();
    if (allContent.length > 0 && !result.historia) {
      result.historia = allContent.join('\n\n');
    }
    
    // Extract from "recipe" array (prescriptions)
    if (parsed.recipe && Array.isArray(parsed.recipe)) {
      const prescriptions = parsed.recipe
        .map((r: { value?: string; name?: string; dosage?: string }) => {
          const value = String(r.value || r.name || '')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<[^>]+>/g, '')
            .trim();
          const dosage = r.dosage ? ` - ${r.dosage}` : '';
          return value ? `${value}${dosage}` : '';
        })
        .filter(Boolean);
      if (prescriptions.length > 0) {
        result.prescricao = prescriptions.join('\n');
      }
    }
    
    return result;
  } catch (e) {
    console.warn('[iClinic Parse Error]', e);
    return {};
  }
}

// Map raw row to MedicalRecordImportRow
export function mapMedicalRecordRow(row: Record<string, unknown>): MedicalRecordImportRow {
  // Check if this is iClinic format (has eventblock_pack column)
  const eventBlockRaw = row['eventblock_pack'] || row['eventBlock_pack'] || row['event_block_pack'];
  const iClinicData = parseIClinicEventBlock(eventBlockRaw);
  
  // First, try to get the main record content from various possible column names
  // Many legacy systems store everything in a single "description" or "evolution" column
  const mainContent = getRowValue(row, [
    'evolucao', 'Evolução', 'evolution', 'Evolution', 'EVOLUCAO', 'EVOLUÇÃO',
    'descricao', 'Descrição', 'descrição', 'Descricao', 'DESCRICAO', 'DESCRIÇÃO',
    'descricao_do_registro', 'descricao_registro', 'Descrição do Registro',
    'registro', 'Registro', 'REGISTRO', 'record', 'Record',
    'texto', 'Texto', 'TEXTO', 'text', 'Text',
    'conteudo', 'Conteúdo', 'conteudo_registro', 'Conteúdo do Registro',
    'historico', 'Histórico', 'HISTORICO', 'history', 'History',
    'resumo', 'Resumo', 'RESUMO', 'summary', 'Summary',
    'anamnese', 'Anamnese', 'ANAMNESE', 'anotacao', 'Anotação', 'anotações',
    'prontuario', 'Prontuário', 'PRONTUARIO',
    'atendimento', 'Atendimento', 'ATENDIMENTO',
    'consulta', 'Consulta', 'CONSULTA',
    'ficha', 'Ficha', 'FICHA',
  ]) || undefined;

  // For iClinic format, use patient_name column
  const patientName = getRowValue(row, [
    'patient_name', 'Patient Name', 'patient', 'Patient',
    'nome_paciente', 'Nome Paciente', 'nome paciente', 'nome do paciente',
    'Nome do Paciente', 'Paciente', 'paciente', 'nome', 'Nome',
    'cliente', 'Cliente', 'client', 'Client', 'nome_completo', 'Nome Completo'
  ]) || undefined;

  // For iClinic format, use date column
  const recordDate = getRowValue(row, [
    'date', 'Date', 'DATE',
    'data_registro', 'Data do Registro', 'data do registro', 'Data Registro',
    'data', 'Data', 'DATA', 'data_consulta', 'Data Consulta',
    'data_atendimento', 'Data Atendimento', 'Data do Atendimento',
    'record_date', 'Record Date', 'visit_date', 'Visit Date',
    'appointment_date', 'Appointment Date',
    'criado_em', 'Criado em', 'Criado Em', 'created_at', 'Created At',
    'date_added'
  ]);

  // Extract professional name - include iClinic column names (physician_name first for priority)
  const professionalName = getRowValue(row, [
    // iClinic specific - highest priority
    'physician_name', 'Physician_Name', 'PHYSICIAN_NAME', 'Physician Name', 'physician name',
    'physician_Name', 'Physician_name', 'physicianName', 'PhysicianName',
    // Portuguese variations
    'profissional', 'Profissional', 'PROFISSIONAL', 'professional', 'Professional',
    'medico', 'Medico', 'MEDICO', 'médico', 'Médico', 'doctor', 'Doctor',
    'physician', 'Physician', 'PHYSICIAN',
    'responsavel', 'Responsavel', 'RESPONSAVEL', 'responsável', 'Responsável',
    'atendente', 'Atendente', 'ATENDENTE',
    'nome_profissional', 'Nome Profissional', 'nome_medico', 'Nome Médico',
    'dr', 'Dr', 'dra', 'Dra', 'doutor', 'Doutor', 'doutora', 'Doutora',
    // Other iClinic columns
    'user_name', 'User Name', 'userName', 'user name',
    'created_by', 'Created By', 'createdBy', 'criado_por', 'Criado Por',
    'author', 'Author', 'autor', 'Autor',
    'attendant', 'Attendant', 'attendant_name', 'Attendant Name',
    'provider', 'Provider', 'provider_name', 'Provider Name',
    'staff', 'Staff', 'staff_name', 'Staff Name',
    'clinician', 'Clinician', 'clinician_name', 'Clinician Name'
  ]) || undefined;

  // Helper to normalize and get value
  const getTextValue = (keys: string[]): string | undefined => {
    const raw = getRowValue(row, keys);
    return raw ? normalizeLineBreaks(raw) : undefined;
  };

  // Normalize iClinic data fields
  const normalizedIClinic = {
    queixa: iClinicData.queixa ? normalizeLineBreaks(iClinicData.queixa) : undefined,
    diagnostico: iClinicData.diagnostico ? normalizeLineBreaks(iClinicData.diagnostico) : undefined,
    tratamento: iClinicData.tratamento ? normalizeLineBreaks(iClinicData.tratamento) : undefined,
    prescricao: iClinicData.prescricao ? normalizeLineBreaks(iClinicData.prescricao) : undefined,
    historia: iClinicData.historia ? normalizeLineBreaks(iClinicData.historia) : undefined,
    exame_fisico: iClinicData.exame_fisico ? normalizeLineBreaks(iClinicData.exame_fisico) : undefined,
  };

  return {
    cpf_paciente: getRowValue(row, [
      'cpf_paciente', 'CPF Paciente', 'cpf paciente', 'cpf do paciente',
      'CPF do Paciente', 'cpf', 'CPF', 'patient_cpf', 'Patient CPF',
      'documento_paciente', 'Documento Paciente', 'documento', 'Documento'
    ]) || undefined,
    nome_paciente: patientName,
    nome_profissional: professionalName,
    data_registro: recordDate,
    // Use iClinic data if available, otherwise fallback to standard columns (with line break normalization)
    queixa: normalizedIClinic.queixa || getTextValue([
      'queixa', 'Queixa', 'QUEIXA', 'Queixa Principal', 'queixa_principal',
      'queixa principal', 'motivo_consulta', 'Motivo Consulta', 'Motivo da Consulta',
      'chief_complaint', 'Chief Complaint', 'complaint', 'Complaint',
      'reason', 'Reason', 'motivo', 'Motivo'
    ]),
    diagnostico: normalizedIClinic.diagnostico || getTextValue([
      'diagnostico', 'Diagnostico', 'DIAGNOSTICO', 'diagnóstico', 'Diagnóstico',
      'diagnosis', 'Diagnosis', 'DIAGNOSIS', 'cid', 'CID', 'hipotese', 'Hipótese',
      'doenca', 'Doença', 'disease', 'Disease', 'condition', 'Condition'
    ]),
    tratamento: normalizedIClinic.tratamento || getTextValue([
      'tratamento', 'Tratamento', 'TRATAMENTO', 'Plano de Tratamento',
      'plano_de_tratamento', 'plano de tratamento', 'plano_tratamento',
      'treatment', 'Treatment', 'TREATMENT', 'treatment_plan', 'Treatment Plan',
      'conduta', 'Conduta', 'plan', 'Plan', 'plano', 'Plano'
    ]),
    prescricao: normalizedIClinic.prescricao || getTextValue([
      'prescricao', 'Prescricao', 'PRESCRICAO', 'prescrição', 'Prescrição',
      'prescription', 'Prescription', 'PRESCRIPTION',
      'medicamentos', 'Medicamentos', 'medications', 'Medications',
      'receita', 'Receita', 'recipe', 'remedio', 'Remédio', 'remedios', 'Remédios'
    ]),
    // For observacoes, use iClinic historia (História), exame_fisico, or standard columns, or mainContent
    observacoes: normalizedIClinic.historia || normalizedIClinic.exame_fisico || getTextValue([
      'observacoes', 'Observacoes', 'OBSERVACOES', 'observações', 'Observações',
      'notas', 'Notas', 'NOTAS', 'obs', 'Obs', 'OBS',
      'notes', 'Notes', 'NOTES', 'comments', 'Comments',
      'anotacoes', 'Anotacoes', 'anotações', 'Anotações',
    ]) || (mainContent ? normalizeLineBreaks(mainContent) : undefined),
  };
}

// Generate template files
export function generatePatientTemplate(): ArrayBuffer {
  const template = [
    {
      nome: 'João Silva',
      telefone: '71999999999',
      telefone_fixo: '7133334444',
      email: 'joao@email.com',
      cpf: '000.000.000-00',
      rg: '1234567890',
      data_nascimento: '1990-01-15',
      sexo: 'Masculino',
      estado_civil: 'Casado',
      naturalidade: 'Salvador - BA',
      profissao: 'Engenheiro',
      escolaridade: 'Superior Completo',
      nome_mae: 'Maria Silva',
      nome_pai: 'José Silva',
      cep: '40000-000',
      rua: 'Rua Exemplo',
      numero: '123',
      complemento: 'Apto 101',
      bairro: 'Centro',
      cidade: 'Salvador',
      estado: 'BA',
      convenio: 'Unimed',
      indicacao: 'Google',
      observacoes: 'Paciente VIP',
    },
  ];
  
  const ws = XLSX.utils.json_to_sheet(template);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Pacientes');
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
}

export function generateMedicalRecordTemplate(): ArrayBuffer {
  const template = [
    {
      cpf_paciente: '000.000.000-00',
      nome_paciente: 'João Silva',
      profissional: 'Dr. Carlos Andrade',
      data_registro: '2024-01-15',
      queixa: 'Dor de cabeça persistente',
      diagnostico: 'Cefaleia tensional',
      tratamento: 'Repouso e hidratação',
      prescricao: 'Dipirona 500mg 8/8h por 3 dias',
      observacoes: 'Retorno em 15 dias',
    },
  ];
  
  const ws = XLSX.utils.json_to_sheet(template);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Prontuarios');
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
}

export function generateContactTemplate(): ArrayBuffer {
  const template = [
    {
      cpf: '000.000.000-00',
      nome: 'João Silva',
      telefone: '71999999999',
      telefone_fixo: '7133334444',
      email: 'joao@email.com',
    },
  ];
  
  const ws = XLSX.utils.json_to_sheet(template);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Contatos');
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
}

export function generateDependentTemplate(): ArrayBuffer {
  const template = [
    {
      nome_dependente: 'Maria Silva',
      cpf_titular: '000.000.000-00',
      nome_titular: 'João Silva',
      cpf_dependente: '111.111.111-11',
      data_nascimento: '2015-05-20',
      parentesco: 'Filho(a)',
      observacoes: 'Menor de idade',
    },
    {
      nome_dependente: 'Pedro Silva',
      cpf_titular: '000.000.000-00',
      nome_titular: 'João Silva',
      cpf_dependente: '',
      data_nascimento: '2018-08-10',
      parentesco: 'Filho(a)',
      observacoes: '',
    },
  ];
  
  const ws = XLSX.utils.json_to_sheet(template);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Dependentes');
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
}

export function downloadTemplate(type: 'patients' | 'records' | 'combined' | 'contacts' | 'dependents') {
  let buffer: ArrayBuffer;
  let filename: string;
  
  if (type === 'combined') {
    buffer = generateCombinedTemplate();
    filename = 'modelo_importacao_completa.xlsx';
  } else if (type === 'patients') {
    buffer = generatePatientTemplate();
    filename = 'modelo_pacientes.xlsx';
  } else if (type === 'contacts') {
    buffer = generateContactTemplate();
    filename = 'modelo_contatos.xlsx';
  } else if (type === 'dependents') {
    buffer = generateDependentTemplate();
    filename = 'modelo_dependentes.xlsx';
  } else {
    buffer = generateMedicalRecordTemplate();
    filename = 'modelo_prontuarios.xlsx';
  }
  
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
