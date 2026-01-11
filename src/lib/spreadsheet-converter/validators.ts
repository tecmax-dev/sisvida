/**
 * Validators for spreadsheet data conversion
 */

import { normalizeCpfCnpj, parseDate, parseCurrency, normalizePhone } from './normalizers';

export type ConversionType = 
  | 'contributions_paid' 
  | 'contributions_pending' 
  | 'contributions_cancelled'
  | 'cadastro_pf'
  | 'cadastro_pj'
  | 'cadastro_fornecedores'
  | 'lytex_invoices'
  | 'lytex_clients'
  | 'lytex_financial';

export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

export interface ValidationWarning {
  field: string;
  message: string;
  value?: unknown;
}

export interface RowValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  row: number;
}

// Field requirements by conversion type
const REQUIRED_FIELDS: Record<ConversionType, string[]> = {
  contributions_paid: ['cnpj', 'value', 'payment_date'],
  contributions_pending: ['cnpj', 'value', 'due_date'],
  contributions_cancelled: ['cnpj', 'value'],
  cadastro_pf: ['name', 'cpf'],
  cadastro_pj: ['name', 'cnpj'],
  cadastro_fornecedores: ['name'],
  lytex_invoices: ['cnpj', 'value', 'due_date'],
  lytex_clients: ['cnpj', 'name'],
  lytex_financial: ['date', 'value', 'description'],
};

// Field validators
const FIELD_VALIDATORS: Record<string, (value: unknown) => { valid: boolean; error?: string }> = {
  cpf: (value) => {
    if (!value) return { valid: true }; // Optional
    const result = normalizeCpfCnpj(value);
    if (result.type !== 'cpf') {
      return { valid: false, error: 'CPF inválido' };
    }
    if (!result.isValid) {
      return { valid: false, error: 'CPF com dígitos verificadores incorretos' };
    }
    return { valid: true };
  },
  
  cnpj: (value) => {
    if (!value) return { valid: false, error: 'CNPJ é obrigatório' };
    const result = normalizeCpfCnpj(value);
    if (result.type !== 'cnpj') {
      return { valid: false, error: 'CNPJ inválido' };
    }
    if (!result.isValid) {
      return { valid: false, error: 'CNPJ com dígitos verificadores incorretos' };
    }
    return { valid: true };
  },
  
  value: (value) => {
    if (value === null || value === undefined || value === '') {
      return { valid: false, error: 'Valor é obrigatório' };
    }
    const parsed = parseCurrency(value);
    // Accept R$ 0,00 - only reject if parseCurrency returns NaN or negative
    if (isNaN(parsed)) {
      return { valid: false, error: 'Valor inválido' };
    }
    if (parsed < 0) {
      return { valid: false, error: 'Valor negativo não permitido' };
    }
    return { valid: true };
  },
  
  date: (value) => {
    if (!value) return { valid: false, error: 'Data é obrigatória' };
    const parsed = parseDate(value);
    if (!parsed) {
      return { valid: false, error: 'Data em formato não reconhecido' };
    }
    return { valid: true };
  },
  
  due_date: (value) => {
    if (!value) return { valid: false, error: 'Data de vencimento é obrigatória' };
    const parsed = parseDate(value);
    if (!parsed) {
      return { valid: false, error: 'Data de vencimento em formato não reconhecido' };
    }
    return { valid: true };
  },
  
  payment_date: (value) => {
    if (!value) return { valid: false, error: 'Data de pagamento é obrigatória' };
    const parsed = parseDate(value);
    if (!parsed) {
      return { valid: false, error: 'Data de pagamento em formato não reconhecido' };
    }
    return { valid: true };
  },
  
  name: (value) => {
    if (!value || String(value).trim().length < 2) {
      return { valid: false, error: 'Nome é obrigatório (mínimo 2 caracteres)' };
    }
    return { valid: true };
  },
  
  email: (value) => {
    if (!value) return { valid: true }; // Optional
    const str = String(value).trim();
    if (!str.includes('@') || !str.includes('.')) {
      return { valid: false, error: 'Email inválido' };
    }
    return { valid: true };
  },
  
  phone: (value) => {
    if (!value) return { valid: true }; // Optional
    const normalized = normalizePhone(value);
    if (!normalized) {
      return { valid: false, error: 'Telefone inválido (deve ter 10-11 dígitos)' };
    }
    return { valid: true };
  },
  
  description: (value) => {
    if (!value || String(value).trim().length < 1) {
      return { valid: false, error: 'Descrição é obrigatória' };
    }
    return { valid: true };
  },
};

/**
 * Validate a single row based on conversion type
 */
export function validateRow(
  row: Record<string, unknown>,
  type: ConversionType,
  rowNumber: number
): RowValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  
  const requiredFields = REQUIRED_FIELDS[type] || [];
  
  // Check required fields
  for (const field of requiredFields) {
    const value = row[field];
    
    // Field is missing
    if (value === undefined || value === null || value === '') {
      errors.push({
        field,
        message: `Campo obrigatório: ${field}`,
        value,
      });
      continue;
    }
    
    // Validate field if validator exists
    const validator = FIELD_VALIDATORS[field];
    if (validator) {
      const result = validator(value);
      if (!result.valid && result.error) {
        errors.push({
          field,
          message: result.error,
          value,
        });
      }
    }
  }
  
  // Validate optional fields that are present
  for (const [field, value] of Object.entries(row)) {
    if (requiredFields.includes(field)) continue; // Already validated
    if (value === undefined || value === null || value === '') continue;
    
    const validator = FIELD_VALIDATORS[field];
    if (validator) {
      const result = validator(value);
      if (!result.valid && result.error) {
        warnings.push({
          field,
          message: result.error,
          value,
        });
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    row: rowNumber,
  };
}

/**
 * Validate all rows and return summary
 */
export function validateAllRows(
  rows: Record<string, unknown>[],
  type: ConversionType
): {
  validRows: Record<string, unknown>[];
  invalidRows: { row: Record<string, unknown>; validation: RowValidationResult }[];
  totalValid: number;
  totalInvalid: number;
  totalWarnings: number;
  errorsByField: Record<string, number>;
} {
  const validRows: Record<string, unknown>[] = [];
  const invalidRows: { row: Record<string, unknown>; validation: RowValidationResult }[] = [];
  const errorsByField: Record<string, number> = {};
  let totalWarnings = 0;
  
  rows.forEach((row, index) => {
    const validation = validateRow(row, type, index + 1);
    
    if (validation.isValid) {
      validRows.push(row);
    } else {
      invalidRows.push({ row, validation });
    }
    
    // Count errors by field
    for (const error of validation.errors) {
      errorsByField[error.field] = (errorsByField[error.field] || 0) + 1;
    }
    
    totalWarnings += validation.warnings.length;
  });
  
  return {
    validRows,
    invalidRows,
    totalValid: validRows.length,
    totalInvalid: invalidRows.length,
    totalWarnings,
    errorsByField,
  };
}

/**
 * Get human-readable field name
 */
export function getFieldLabel(field: string): string {
  const labels: Record<string, string> = {
    cnpj: 'CNPJ',
    cpf: 'CPF',
    name: 'Nome',
    value: 'Valor',
    due_date: 'Vencimento',
    payment_date: 'Data Pagamento',
    date: 'Data',
    email: 'Email',
    phone: 'Telefone',
    description: 'Descrição',
    status: 'Status',
    competence: 'Competência',
  };
  
  return labels[field] || field;
}
