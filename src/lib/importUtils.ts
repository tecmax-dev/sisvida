import * as XLSX from 'xlsx';

export interface PatientImportRow {
  nome: string;
  telefone: string;
  email?: string;
  cpf?: string;
  data_nascimento?: string;
  endereco?: string;
  observacoes?: string;
}

export interface MedicalRecordImportRow {
  cpf_paciente?: string;
  nome_paciente?: string;
  data_registro: string;
  queixa?: string;
  diagnostico?: string;
  tratamento?: string;
  prescricao?: string;
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

// Parse date from various formats
export function parseDate(dateStr: string): string | null {
  if (!dateStr) return null;
  
  // Try common formats
  const formats = [
    /^(\d{4})-(\d{2})-(\d{2})$/,           // YYYY-MM-DD
    /^(\d{2})\/(\d{2})\/(\d{4})$/,         // DD/MM/YYYY
    /^(\d{2})-(\d{2})-(\d{4})$/,           // DD-MM-YYYY
  ];
  
  for (const format of formats) {
    const match = dateStr.match(format);
    if (match) {
      if (format === formats[0]) {
        return dateStr; // Already in correct format
      } else {
        // Convert DD/MM/YYYY or DD-MM-YYYY to YYYY-MM-DD
        return `${match[3]}-${match[2]}-${match[1]}`;
      }
    }
  }
  
  // Try to parse as Excel date number
  const excelDate = parseFloat(dateStr);
  if (!isNaN(excelDate) && excelDate > 0) {
    const date = new Date((excelDate - 25569) * 86400 * 1000);
    return date.toISOString().split('T')[0];
  }
  
  return null;
}

// Validate patient row
export function validatePatientRow(row: PatientImportRow): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!row.nome?.trim()) {
    errors.push('Nome é obrigatório');
  }
  
  if (!row.telefone) {
    errors.push('Telefone é obrigatório');
  } else if (!validatePhone(row.telefone)) {
    errors.push('Telefone inválido (deve ter 10-11 dígitos)');
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

// Normalize column header for comparison (removes accents, converts to lowercase, replaces spaces with underscores)
function normalizeColumnHeader(header: string): string {
  return String(header)
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9]/g, '_') // Replace non-alphanumeric with underscore
    .replace(/_+/g, '_') // Remove duplicate underscores
    .replace(/^_|_$/g, ''); // Trim underscores at start/end
}

// Detect sheet type based on columns and sheet name
export function detectSheetType(columns: string[], sheetName?: string): DetectedSheetType {
  const normalizedColumns = columns.map(normalizeColumnHeader);
  const normalizedSheetName = sheetName ? normalizeColumnHeader(sheetName) : '';
  
  // First try to detect by sheet name (fallback)
  const patientSheetNames = ['pacientes', 'paciente', 'patients', 'patient', 'cadastro', 'clientes'];
  const recordSheetNames = ['prontuarios', 'prontuario', 'records', 'medical_records', 'evolucoes', 'atendimentos'];
  
  // Patient indicators - expanded list with many variations
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
    'fone', 'whatsapp', 'zap', 'contato', 'contact'
  ];
  const patientMatches = patientIndicators.filter(ind => 
    normalizedColumns.some(col => col.includes(ind))
  ).length;
  
  // Medical record indicators - expanded list
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
    // English
    'chief_complaint', 'complaint', 'reason',
    'diagnosis', 'disease', 'condition',
    'treatment', 'treatment_plan', 'plan',
    'prescription', 'medication', 'medicine',
    'record_date', 'visit_date', 'appointment_date',
    'evolution', 'progress', 'progress_note',
    'medical_record', 'chart', 'patient_name', 'patient_cpf'
  ];
  const recordMatches = recordIndicators.filter(ind => 
    normalizedColumns.some(col => col.includes(ind))
  ).length;
  
  // Strong record-specific columns (if any of these exist, it's likely records)
  const strongRecordIndicators = ['queixa', 'diagnostico', 'tratamento', 'prescricao', 'evolucao', 
    'chief_complaint', 'diagnosis', 'treatment', 'prescription', 'anamnese'];
  const hasStrongRecordColumn = strongRecordIndicators.some(ind =>
    normalizedColumns.some(col => col.includes(ind))
  );
  
  // If has strong record columns, it's definitely records
  if (hasStrongRecordColumn) return 'records';
  
  // If has 2+ record indicators, it's records
  if (recordMatches >= 2) return 'records';
  
  // If has patient columns but no record-specific ones
  if (patientMatches >= 2 && recordMatches < 2) return 'patients';
  
  // Fallback to sheet name detection
  if (patientSheetNames.some(n => normalizedSheetName.includes(n))) return 'patients';
  if (recordSheetNames.some(n => normalizedSheetName.includes(n))) return 'records';
  
  // Last resort: if has nome/name and telefone/phone but nothing record-specific
  const hasNameAndPhone = normalizedColumns.some(c => c.includes('nome') || c.includes('name')) &&
                          normalizedColumns.some(c => c.includes('telefone') || c.includes('phone') || c.includes('celular'));
  if (hasNameAndPhone && recordMatches === 0) return 'patients';
  
  return 'unknown';
}

// Get detected columns info for debugging
export function getDetectedColumnsInfo(columns: string[]): string {
  const first5 = columns.slice(0, 5).join(', ');
  const remaining = columns.length > 5 ? ` (+${columns.length - 5} mais)` : '';
  return first5 + remaining;
}

// Parse single sheet
function parseSheet<T>(
  worksheet: XLSX.WorkSheet,
  validateRow: (row: T) => ValidationResult,
  mapRow: (row: Record<string, unknown>) => T
): ImportRow<T>[] {
  const jsonData = XLSX.utils.sheet_to_json(worksheet) as Record<string, unknown>[];
  
  return jsonData.map((row, index) => {
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
    const jsonData = XLSX.utils.sheet_to_json(worksheet) as Record<string, unknown>[];
    
    if (jsonData.length === 0) continue;
    
    // Get columns from first row
    const columns = Object.keys(jsonData[0]);
    const sheetType = detectSheetType(columns, sheetName);
    
    sheets.push({
      name: sheetName,
      type: sheetType,
      columns,
      rowCount: jsonData.length,
    });
    
    // Parse based on detected type
    if (sheetType === 'patients') {
      const parsed = parseSheet(worksheet, validatePatientRow, mapPatientRow);
      patients = [...patients, ...parsed];
    } else if (sheetType === 'records') {
      const parsed = parseSheet(worksheet, validateMedicalRecordRow, mapMedicalRecordRow);
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
  } else {
    const parsed = parseSheet(worksheet, validateMedicalRecordRow, mapMedicalRecordRow);
    return { patients: [], records: parsed };
  }
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
    const jsonData = XLSX.utils.sheet_to_json(worksheet) as Record<string, unknown>[];
    
    if (jsonData.length === 0) continue;
    
    const columns = Object.keys(jsonData[0]);
    let sheetType = detectSheetType(columns, sheetName);
    
    // Force unknown sheets to the specified type
    if (sheetType === 'unknown') {
      sheetType = forceUnknownAs;
    }
    
    sheets.push({
      name: sheetName,
      type: sheetType,
      columns,
      rowCount: jsonData.length,
    });
    
    if (sheetType === 'patients') {
      const parsed = parseSheet(worksheet, validatePatientRow, mapPatientRow);
      patients = [...patients, ...parsed];
    } else if (sheetType === 'records') {
      const parsed = parseSheet(worksheet, validateMedicalRecordRow, mapMedicalRecordRow);
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
      email: 'joao@email.com',
      cpf: '000.000.000-00',
      data_nascimento: '1990-01-15',
      endereco: 'Rua Exemplo, 123',
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
      // Portuguese
      'telefone', 'Telefone', 'TELEFONE',
      'telefone_1', 'Telefone 1', 'Telefone1', 'Tel 1', 'Tel1',
      'telefone_principal', 'Telefone Principal',
      'celular', 'Celular', 'CELULAR',
      'celular_1', 'Celular 1', 'Celular1',
      'whatsapp', 'Whatsapp', 'WHATSAPP',
      'fone', 'Fone', 'FONE',
      'tel', 'Tel', 'TEL', 'telefone_contato', 'Telefone Contato',
      // English
      'phone', 'Phone', 'PHONE',
      'mobile', 'Mobile', 'MOBILE',
      'cell', 'Cell',
      // Other
      'zap', 'Zap', 'contato', 'Contato', 'contact', 'Contact',
    ]),
    email: getRowValue(row, [
      'email', 'Email', 'EMAIL', 'e-mail', 'E-mail', 'E-MAIL',
      'correio', 'Correio', 'mail', 'Mail'
    ]) || undefined,
    cpf: getRowValue(row, [
      'cpf', 'CPF', 'Cpf', 'documento', 'Documento', 'DOCUMENTO',
      'document', 'Document', 'tax_id', 'Tax ID'
    ]) || undefined,
    data_nascimento: getRowValue(row, [
      'data_nascimento', 'Data de Nascimento', 'Data Nascimento', 'nascimento',
      'Nascimento', 'DATA_NASCIMENTO', 'datanascimento', 'DataNascimento',
      'birth_date', 'Birth Date', 'birthdate', 'Birthdate', 'BIRTH_DATE',
      'data_nasc', 'Data Nasc', 'dt_nascimento', 'Dt Nascimento',
      'aniversario', 'Aniversario', 'birthday', 'Birthday'
    ]) || undefined,
    endereco: getRowValue(row, [
      'endereco', 'Endereco', 'ENDERECO', 'endereço', 'Endereço',
      'endereco_completo', 'Endereço Completo', 'logradouro', 'Logradouro',
      'address', 'Address', 'ADDRESS', 'full_address', 'Full Address',
      'rua', 'Rua', 'street', 'Street'
    ]) || undefined,
    observacoes: getRowValue(row, [
      'observacoes', 'Observacoes', 'OBSERVACOES', 'observações', 'Observações',
      'notas', 'Notas', 'NOTAS', 'obs', 'Obs', 'OBS',
      'notes', 'Notes', 'NOTES', 'comments', 'Comments',
      'anotacoes', 'Anotacoes', 'anotações', 'Anotações'
    ]) || undefined,
  };
}

// Map raw row to MedicalRecordImportRow
export function mapMedicalRecordRow(row: Record<string, unknown>): MedicalRecordImportRow {
  return {
    cpf_paciente: getRowValue(row, [
      'cpf_paciente', 'CPF Paciente', 'cpf paciente', 'cpf do paciente',
      'CPF do Paciente', 'cpf', 'CPF', 'patient_cpf', 'Patient CPF',
      'documento_paciente', 'Documento Paciente'
    ]) || undefined,
    nome_paciente: getRowValue(row, [
      'nome_paciente', 'Nome Paciente', 'nome paciente', 'nome do paciente',
      'Nome do Paciente', 'Paciente', 'paciente', 'nome', 'Nome',
      'patient_name', 'Patient Name', 'patient', 'Patient',
      'cliente', 'Cliente', 'client', 'Client'
    ]) || undefined,
    data_registro: getRowValue(row, [
      'data_registro', 'Data do Registro', 'data do registro', 'Data Registro',
      'data', 'Data', 'DATA', 'data_consulta', 'Data Consulta',
      'data_atendimento', 'Data Atendimento', 'Data do Atendimento',
      'record_date', 'Record Date', 'visit_date', 'Visit Date',
      'appointment_date', 'Appointment Date', 'date', 'Date',
      'criado_em', 'Criado em', 'Criado Em', 'created_at', 'Created At'
    ]),
    queixa: getRowValue(row, [
      'queixa', 'Queixa', 'QUEIXA', 'Queixa Principal', 'queixa_principal',
      'queixa principal', 'motivo_consulta', 'Motivo Consulta', 'Motivo da Consulta',
      'chief_complaint', 'Chief Complaint', 'complaint', 'Complaint',
      'reason', 'Reason', 'motivo', 'Motivo'
    ]) || undefined,
    diagnostico: getRowValue(row, [
      'diagnostico', 'Diagnostico', 'DIAGNOSTICO', 'diagnóstico', 'Diagnóstico',
      'diagnosis', 'Diagnosis', 'DIAGNOSIS', 'cid', 'CID', 'hipotese', 'Hipótese',
      'doenca', 'Doença', 'disease', 'Disease', 'condition', 'Condition'
    ]) || undefined,
    tratamento: getRowValue(row, [
      'tratamento', 'Tratamento', 'TRATAMENTO', 'Plano de Tratamento',
      'plano_de_tratamento', 'plano de tratamento', 'plano_tratamento',
      'treatment', 'Treatment', 'TREATMENT', 'treatment_plan', 'Treatment Plan',
      'conduta', 'Conduta', 'plan', 'Plan', 'plano', 'Plano'
    ]) || undefined,
    prescricao: getRowValue(row, [
      'prescricao', 'Prescricao', 'PRESCRICAO', 'prescrição', 'Prescrição',
      'prescription', 'Prescription', 'PRESCRIPTION',
      'medicamentos', 'Medicamentos', 'medications', 'Medications',
      'receita', 'Receita', 'recipe', 'remedio', 'Remédio', 'remedios', 'Remédios'
    ]) || undefined,
    observacoes: getRowValue(row, [
      'observacoes', 'Observacoes', 'OBSERVACOES', 'observações', 'Observações',
      'notas', 'Notas', 'NOTAS', 'obs', 'Obs', 'OBS',
      'notes', 'Notes', 'NOTES', 'comments', 'Comments',
      'anotacoes', 'Anotacoes', 'anotações', 'Anotações',
      'evolucao', 'Evolução', 'evolution', 'Evolution'
    ]) || undefined,
  };
}

// Generate template files
export function generatePatientTemplate(): ArrayBuffer {
  const template = [
    {
      nome: 'João Silva',
      telefone: '71999999999',
      email: 'joao@email.com',
      cpf: '000.000.000-00',
      data_nascimento: '1990-01-15',
      endereco: 'Rua Exemplo, 123',
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

export function downloadTemplate(type: 'patients' | 'records' | 'combined') {
  let buffer: ArrayBuffer;
  let filename: string;
  
  if (type === 'combined') {
    buffer = generateCombinedTemplate();
    filename = 'modelo_importacao_completa.xlsx';
  } else if (type === 'patients') {
    buffer = generatePatientTemplate();
    filename = 'modelo_pacientes.xlsx';
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
