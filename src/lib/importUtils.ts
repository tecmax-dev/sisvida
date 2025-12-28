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

// Detect sheet type based on columns
function detectSheetType(columns: string[]): DetectedSheetType {
  const lowerColumns = columns.map(c => String(c).toLowerCase().trim());
  
  // Patient indicators
  const patientIndicators = ['nome', 'telefone', 'celular', 'cpf', 'nascimento', 'data_nascimento', 'email'];
  const patientMatches = patientIndicators.filter(ind => 
    lowerColumns.some(col => col.includes(ind))
  ).length;
  
  // Medical record indicators
  const recordIndicators = ['queixa', 'diagnostico', 'diagnóstico', 'tratamento', 'prescricao', 'prescrição', 
    'data_registro', 'evolucao', 'evolução', 'prontuario', 'prontuário', 'cpf_paciente', 'nome_paciente'];
  const recordMatches = recordIndicators.filter(ind => 
    lowerColumns.some(col => col.includes(ind))
  ).length;
  
  // If has specific record columns, it's records
  if (recordMatches >= 2) return 'records';
  // If has patient columns but no record-specific ones
  if (patientMatches >= 2 && recordMatches < 2) return 'patients';
  
  return 'unknown';
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
    const sheetType = detectSheetType(columns);
    
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

// Map raw row to PatientImportRow
export function mapPatientRow(row: Record<string, unknown>): PatientImportRow {
  return {
    nome: String(row.nome || row.Nome || row.NOME || '').trim(),
    telefone: String(row.telefone || row.Telefone || row.TELEFONE || row.celular || row.Celular || '').trim(),
    email: String(row.email || row.Email || row.EMAIL || '').trim() || undefined,
    cpf: String(row.cpf || row.CPF || row.Cpf || '').trim() || undefined,
    data_nascimento: String(row.data_nascimento || row.nascimento || row.Nascimento || row.DATA_NASCIMENTO || '').trim() || undefined,
    endereco: String(row.endereco || row.Endereco || row.ENDERECO || row.endereço || '').trim() || undefined,
    observacoes: String(row.observacoes || row.Observacoes || row.OBSERVACOES || row.notas || row.Notas || '').trim() || undefined,
  };
}

// Map raw row to MedicalRecordImportRow
export function mapMedicalRecordRow(row: Record<string, unknown>): MedicalRecordImportRow {
  return {
    cpf_paciente: String(row.cpf_paciente || row.cpf || row.CPF || '').trim() || undefined,
    nome_paciente: String(row.nome_paciente || row.paciente || row.Paciente || row.nome || row.Nome || '').trim() || undefined,
    data_registro: String(row.data_registro || row.data || row.Data || row.DATA || '').trim(),
    queixa: String(row.queixa || row.Queixa || row.QUEIXA || '').trim() || undefined,
    diagnostico: String(row.diagnostico || row.Diagnostico || row.DIAGNOSTICO || row.diagnóstico || '').trim() || undefined,
    tratamento: String(row.tratamento || row.Tratamento || row.TRATAMENTO || '').trim() || undefined,
    prescricao: String(row.prescricao || row.Prescricao || row.PRESCRICAO || row.prescrição || '').trim() || undefined,
    observacoes: String(row.observacoes || row.Observacoes || row.OBSERVACOES || row.notas || '').trim() || undefined,
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
