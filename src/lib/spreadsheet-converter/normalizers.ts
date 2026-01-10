/**
 * Normalizers for spreadsheet data conversion
 * Functions for CPF/CNPJ, dates, currency, and text normalization
 */

// CPF/CNPJ normalization result
export interface CpfCnpjResult {
  type: 'cpf' | 'cnpj' | 'invalid';
  value: string;
  formatted: string;
  isValid: boolean;
}

// Validate CPF checksum
function validateCpfChecksum(digits: string): boolean {
  if (digits.length !== 11) return false;
  if (/^(\d)\1+$/.test(digits)) return false;
  
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits[i]) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(digits[9])) return false;
  
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits[i]) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(digits[10])) return false;
  
  return true;
}

// Validate CNPJ checksum
function validateCnpjChecksum(digits: string): boolean {
  if (digits.length !== 14) return false;
  if (/^(\d)\1+$/.test(digits)) return false;
  
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(digits[i]) * weights1[i];
  }
  let remainder = sum % 11;
  const digit1 = remainder < 2 ? 0 : 11 - remainder;
  if (digit1 !== parseInt(digits[12])) return false;
  
  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(digits[i]) * weights2[i];
  }
  remainder = sum % 11;
  const digit2 = remainder < 2 ? 0 : 11 - remainder;
  if (digit2 !== parseInt(digits[13])) return false;
  
  return true;
}

// Format CPF: XXX.XXX.XXX-XX
function formatCpf(digits: string): string {
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

// Format CNPJ: XX.XXX.XXX/XXXX-XX
function formatCnpj(digits: string): string {
  return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

/**
 * Normalize CPF/CNPJ - detects type and validates
 */
export function normalizeCpfCnpj(value: unknown): CpfCnpjResult {
  if (value === null || value === undefined) {
    return { type: 'invalid', value: '', formatted: '', isValid: false };
  }
  
  const str = String(value).trim();
  const digits = str.replace(/\D/g, '');
  
  if (!digits) {
    return { type: 'invalid', value: '', formatted: '', isValid: false };
  }
  
  // Pad left with zeros if needed
  if (digits.length <= 11) {
    const paddedCpf = digits.padStart(11, '0');
    const isValid = validateCpfChecksum(paddedCpf);
    return {
      type: 'cpf',
      value: paddedCpf,
      formatted: formatCpf(paddedCpf),
      isValid,
    };
  }
  
  if (digits.length <= 14) {
    const paddedCnpj = digits.padStart(14, '0');
    const isValid = validateCnpjChecksum(paddedCnpj);
    return {
      type: 'cnpj',
      value: paddedCnpj,
      formatted: formatCnpj(paddedCnpj),
      isValid,
    };
  }
  
  return { type: 'invalid', value: digits, formatted: str, isValid: false };
}

/**
 * Parse date from various formats to YYYY-MM-DD
 * Supports: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, DD/MM/YY, Excel serial dates
 */
export function parseDate(value: unknown): string | null {
  if (value === null || value === undefined) return null;

  // If it's already a Date instance
  if (value instanceof Date && !isNaN(value.getTime())) {
    const y = value.getFullYear();
    if (y > 1900 && y < 2100) return value.toISOString().split('T')[0];
  }

  const trimmed = String(value).trim();
  if (!trimmed) return null;

  const to4DigitYear = (yy: string) => {
    const n = Number(yy);
    if (Number.isNaN(n)) return null;
    return n >= 70 ? 1900 + n : 2000 + n;
  };

  const formats = [
    { regex: /^(\d{4})-(\d{2})-(\d{2})$/, handler: (m: RegExpMatchArray) => `${m[1]}-${m[2]}-${m[3]}` },
    { regex: /^(\d{4})-(\d{2})-(\d{2})T/, handler: (m: RegExpMatchArray) => `${m[1]}-${m[2]}-${m[3]}` },
    { regex: /^(\d{4})-(\d{2})-(\d{2})\s/, handler: (m: RegExpMatchArray) => `${m[1]}-${m[2]}-${m[3]}` },
    { regex: /^(\d{4})\/(\d{1,2})\/(\d{1,2})(?:\D|$)/, handler: (m: RegExpMatchArray) => `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` },
    { regex: /^(\d{4})\.(\d{1,2})\.(\d{1,2})(?:\D|$)/, handler: (m: RegExpMatchArray) => `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` },
    { regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\D|$)/, handler: (m: RegExpMatchArray) => `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` },
    { regex: /^(\d{1,2})-(\d{1,2})-(\d{4})(?:\D|$)/, handler: (m: RegExpMatchArray) => `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` },
    { regex: /^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\D|$)/, handler: (m: RegExpMatchArray) => `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` },
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
    { regex: /^(\d{4})(\d{2})(\d{2})$/, handler: (m: RegExpMatchArray) => `${m[1]}-${m[2]}-${m[3]}` },
  ];

  for (const { regex, handler } of formats) {
    const match = trimmed.match(regex);
    if (match) {
      const result = handler(match);
      if (!result) continue;
      const parsed = new Date(result);
      if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 1900 && parsed.getFullYear() < 2100) {
        return result;
      }
    }
  }

  // Excel serial date
  const excelDate = parseFloat(trimmed.replace(',', '.'));
  if (!isNaN(excelDate) && excelDate > 1 && excelDate < 100000) {
    const date = new Date((excelDate - 25569) * 86400 * 1000);
    if (!isNaN(date.getTime()) && date.getFullYear() > 1900 && date.getFullYear() < 2100) {
      return date.toISOString().split('T')[0];
    }
  }

  // Native Date parsing as last resort
  const nativeDate = new Date(trimmed);
  if (!isNaN(nativeDate.getTime()) && nativeDate.getFullYear() > 1900 && nativeDate.getFullYear() < 2100) {
    return nativeDate.toISOString().split('T')[0];
  }

  return null;
}

/**
 * Format date from YYYY-MM-DD to DD/MM/YYYY
 */
export function formatDateBR(dateStr: string | null): string {
  if (!dateStr) return '';
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[3]}/${match[2]}/${match[1]}`;
  }
  return dateStr;
}

/**
 * Parse currency from various formats to number
 * Supports: "R$ 1.234,56", "1234.56", "1.234,56", "-R$ 100,00"
 */
export function parseCurrency(value: unknown): number {
  if (value === null || value === undefined) return 0;
  
  if (typeof value === 'number') return value;
  
  let str = String(value).trim();
  
  // Check if negative
  const isNegative = str.startsWith('-') || str.includes('(') || str.toLowerCase().includes('débito');
  
  // Remove currency symbols and text
  str = str.replace(/[R$\s()]/gi, '').replace(/débito|crédito/gi, '').trim();
  
  // Remove negative sign for processing
  str = str.replace(/^-/, '');
  
  // Determine decimal separator
  // If has both . and ,, the last one is decimal
  const lastDot = str.lastIndexOf('.');
  const lastComma = str.lastIndexOf(',');
  
  let result: number;
  
  if (lastComma > lastDot) {
    // Brazilian format: 1.234,56
    str = str.replace(/\./g, '').replace(',', '.');
    result = parseFloat(str);
  } else if (lastDot > lastComma) {
    // American format: 1,234.56
    str = str.replace(/,/g, '');
    result = parseFloat(str);
  } else if (lastComma >= 0) {
    // Only comma: could be decimal
    str = str.replace(',', '.');
    result = parseFloat(str);
  } else {
    result = parseFloat(str);
  }
  
  if (isNaN(result)) return 0;
  
  return isNegative ? -Math.abs(result) : result;
}

/**
 * Format currency to Brazilian format
 */
export function formatCurrencyBR(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Normalize text - trim, fix casing, remove extra spaces
 */
export function normalizeText(value: unknown, options: { toUpperCase?: boolean; toLowerCase?: boolean; titleCase?: boolean } = {}): string {
  if (value === null || value === undefined) return '';
  
  let str = String(value).trim().replace(/\s+/g, ' ');
  
  if (options.toUpperCase) {
    return str.toUpperCase();
  }
  
  if (options.toLowerCase) {
    return str.toLowerCase();
  }
  
  if (options.titleCase) {
    return str
      .toLowerCase()
      .split(' ')
      .map(word => {
        // Keep small words lowercase (de, da, do, dos, das, e)
        if (['de', 'da', 'do', 'dos', 'das', 'e', 'em', 'na', 'no', 'nas', 'nos'].includes(word)) {
          return word;
        }
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(' ');
  }
  
  return str;
}

/**
 * Normalize name for comparison
 */
export function normalizeNameForComparison(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Status keywords mapping
const STATUS_KEYWORDS: Record<string, string[]> = {
  paid: ['pago', 'paid', 'quitado', 'liquidado', 'confirmado', 'ok', 'sim', 'yes', 'true', '1', 'settled'],
  pending: ['pendente', 'pending', 'aberto', 'open', 'aguardando', 'waiting', 'em aberto', 'a pagar'],
  overdue: ['vencido', 'overdue', 'atrasado', 'late', 'atraso', 'inadimplente', 'em atraso'],
  cancelled: ['cancelado', 'cancelled', 'canceled', 'estornado', 'devolvido', 'anulado', 'void'],
  processing: ['processando', 'processing', 'em processamento', 'aguardando confirmação'],
};

/**
 * Identify status from text
 */
export function identifyStatus(value: unknown): 'paid' | 'pending' | 'overdue' | 'cancelled' | 'processing' | 'unknown' {
  if (value === null || value === undefined) return 'unknown';
  
  const str = String(value).toLowerCase().trim();
  
  if (!str) return 'unknown';
  
  for (const [status, keywords] of Object.entries(STATUS_KEYWORDS)) {
    if (keywords.some(keyword => str.includes(keyword))) {
      return status as 'paid' | 'pending' | 'overdue' | 'cancelled' | 'processing';
    }
  }
  
  return 'unknown';
}

/**
 * Normalize phone number
 */
export function normalizePhone(value: unknown): string {
  if (value === null || value === undefined) return '';
  
  const digits = String(value).replace(/\D/g, '');
  
  // Brazilian phone validation (10-11 digits)
  if (digits.length < 10 || digits.length > 11) return '';
  
  return digits;
}

/**
 * Format phone to Brazilian display format
 */
export function formatPhoneBR(phone: string): string {
  if (!phone) return '';
  
  const digits = phone.replace(/\D/g, '');
  
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  
  return phone;
}

/**
 * Extract competence (month/year) from text
 * Returns { month: number, year: number } or null
 */
export function extractCompetence(value: unknown): { month: number; year: number } | null {
  if (value === null || value === undefined) return null;
  
  const str = String(value).trim();
  
  const monthNames: Record<string, number> = {
    'janeiro': 1, 'jan': 1,
    'fevereiro': 2, 'fev': 2,
    'março': 3, 'mar': 3, 'marco': 3,
    'abril': 4, 'abr': 4,
    'maio': 5, 'mai': 5,
    'junho': 6, 'jun': 6,
    'julho': 7, 'jul': 7,
    'agosto': 8, 'ago': 8,
    'setembro': 9, 'set': 9,
    'outubro': 10, 'out': 10,
    'novembro': 11, 'nov': 11,
    'dezembro': 12, 'dez': 12,
  };
  
  // Try "Janeiro/2024" or "Jan/2024" format
  const monthYearMatch = str.toLowerCase().match(/([a-záéíóú]+)\s*[\/\-]?\s*(\d{4})/);
  if (monthYearMatch) {
    const monthName = monthYearMatch[1];
    const year = parseInt(monthYearMatch[2]);
    const month = monthNames[monthName];
    if (month && year >= 2000 && year <= 2100) {
      return { month, year };
    }
  }
  
  // Try "01/2024" or "1/2024" format
  const numericMatch = str.match(/(\d{1,2})\s*[\/\-]\s*(\d{4})/);
  if (numericMatch) {
    const month = parseInt(numericMatch[1]);
    const year = parseInt(numericMatch[2]);
    if (month >= 1 && month <= 12 && year >= 2000 && year <= 2100) {
      return { month, year };
    }
  }
  
  // Try "2024-01" format
  const isoMatch = str.match(/(\d{4})\s*[\/\-]\s*(\d{1,2})/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1]);
    const month = parseInt(isoMatch[2]);
    if (month >= 1 && month <= 12 && year >= 2000 && year <= 2100) {
      return { month, year };
    }
  }
  
  return null;
}

/**
 * Format competence to display string
 */
export function formatCompetence(month: number, year: number): string {
  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  
  if (month < 1 || month > 12) return '';
  
  return `${monthNames[month - 1]}/${year}`;
}
