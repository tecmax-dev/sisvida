import * as XLSX from 'xlsx';

export interface PatientImportRow {
  nome: string;
  telefone?: string;
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

export interface ContactImportRow {
  cpf?: string;
  nome?: string;
  telefone?: string;
  telefone_fixo?: string;
  email?: string;
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

// Parse date from various formats to YYYY-MM-DD
export function parseDate(dateStr: string): string | null {
  if (!dateStr) return null;
  
  const trimmed = String(dateStr).trim();
  if (!trimmed) return null;
  
  // Try common formats with regex
  const formats = [
    { regex: /^(\d{4})-(\d{2})-(\d{2})$/, handler: (m: RegExpMatchArray) => `${m[1]}-${m[2]}-${m[3]}` }, // YYYY-MM-DD
    { regex: /^(\d{4})-(\d{2})-(\d{2})T/, handler: (m: RegExpMatchArray) => `${m[1]}-${m[2]}-${m[3]}` }, // YYYY-MM-DDTHH:MM:SS (ISO)
    { regex: /^(\d{4})-(\d{2})-(\d{2})\s/, handler: (m: RegExpMatchArray) => `${m[1]}-${m[2]}-${m[3]}` }, // YYYY-MM-DD HH:MM:SS

    // DD/MM/YYYY with optional time or extra text (e.g., "29/12/2025 às 01:13")
    { regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\D|$)/, handler: (m: RegExpMatchArray) => `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` },
    { regex: /^(\d{1,2})-(\d{1,2})-(\d{4})(?:\D|$)/, handler: (m: RegExpMatchArray) => `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` },
    { regex: /^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\D|$)/, handler: (m: RegExpMatchArray) => `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` },

    { regex: /^(\d{4})(\d{2})(\d{2})$/, handler: (m: RegExpMatchArray) => `${m[1]}-${m[2]}-${m[3]}` }, // YYYYMMDD
  ];
  
  for (const { regex, handler } of formats) {
    const match = trimmed.match(regex);
    if (match) {
      const result = handler(match);
      // Validate the result is a valid date
      const parsed = new Date(result);
      if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 1900 && parsed.getFullYear() < 2100) {
        return result;
      }
    }
  }
  
  // Try to parse as Excel date number (serial date)
  const excelDate = parseFloat(trimmed);
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
      'telefones', 'Telefones', 'TELEFONES',
      'telefone(s)', 'Telefone(s)', 'TELEFONE(S)',
      'telefone_1', 'Telefone 1', 'Telefone1', 'Tel 1', 'Tel1',
      'telefone_principal', 'Telefone Principal',
      'celular', 'Celular', 'CELULAR',
      'celulares', 'Celulares',
      'celular(s)', 'Celular(s)',
      'celular_1', 'Celular 1', 'Celular1',
      'whatsapp', 'Whatsapp', 'WHATSAPP',
      'whats', 'Whats',
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

  return {
    cpf_paciente: getRowValue(row, [
      'cpf_paciente', 'CPF Paciente', 'cpf paciente', 'cpf do paciente',
      'CPF do Paciente', 'cpf', 'CPF', 'patient_cpf', 'Patient CPF',
      'documento_paciente', 'Documento Paciente', 'documento', 'Documento'
    ]) || undefined,
    nome_paciente: patientName,
    data_registro: recordDate,
    // Use iClinic data if available, otherwise fallback to standard columns
    queixa: iClinicData.queixa || getRowValue(row, [
      'queixa', 'Queixa', 'QUEIXA', 'Queixa Principal', 'queixa_principal',
      'queixa principal', 'motivo_consulta', 'Motivo Consulta', 'Motivo da Consulta',
      'chief_complaint', 'Chief Complaint', 'complaint', 'Complaint',
      'reason', 'Reason', 'motivo', 'Motivo'
    ]) || undefined,
    diagnostico: iClinicData.diagnostico || getRowValue(row, [
      'diagnostico', 'Diagnostico', 'DIAGNOSTICO', 'diagnóstico', 'Diagnóstico',
      'diagnosis', 'Diagnosis', 'DIAGNOSIS', 'cid', 'CID', 'hipotese', 'Hipótese',
      'doenca', 'Doença', 'disease', 'Disease', 'condition', 'Condition'
    ]) || undefined,
    tratamento: iClinicData.tratamento || getRowValue(row, [
      'tratamento', 'Tratamento', 'TRATAMENTO', 'Plano de Tratamento',
      'plano_de_tratamento', 'plano de tratamento', 'plano_tratamento',
      'treatment', 'Treatment', 'TREATMENT', 'treatment_plan', 'Treatment Plan',
      'conduta', 'Conduta', 'plan', 'Plan', 'plano', 'Plano'
    ]) || undefined,
    prescricao: iClinicData.prescricao || getRowValue(row, [
      'prescricao', 'Prescricao', 'PRESCRICAO', 'prescrição', 'Prescrição',
      'prescription', 'Prescription', 'PRESCRIPTION',
      'medicamentos', 'Medicamentos', 'medications', 'Medications',
      'receita', 'Receita', 'recipe', 'remedio', 'Remédio', 'remedios', 'Remédios'
    ]) || undefined,
    // For observacoes, use iClinic historia (História), exame_fisico, or standard columns, or mainContent
    observacoes: iClinicData.historia || iClinicData.exame_fisico || getRowValue(row, [
      'observacoes', 'Observacoes', 'OBSERVACOES', 'observações', 'Observações',
      'notas', 'Notas', 'NOTAS', 'obs', 'Obs', 'OBS',
      'notes', 'Notes', 'NOTES', 'comments', 'Comments',
      'anotacoes', 'Anotacoes', 'anotações', 'Anotações',
    ]) || mainContent || undefined,
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

export function downloadTemplate(type: 'patients' | 'records' | 'combined' | 'contacts') {
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
