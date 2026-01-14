/**
 * Utility functions for search/filter operations
 * Provides consistent and performant search across CNPJ, CPF, names, etc.
 */

/**
 * Normalizes a string for comparison by removing all non-alphanumeric characters
 * and converting to lowercase
 */
export function normalizeForSearch(value: string | null | undefined): string {
  if (!value) return "";
  return value.toLowerCase().replace(/[^a-z0-9]/gi, "");
}

/**
 * Normalizes a document (CNPJ/CPF) by removing all non-digit characters
 */
export function normalizeDocument(value: string | null | undefined): string {
  if (!value) return "";
  return value.replace(/\D/g, "");
}

/**
 * Checks if a search term matches a value using flexible matching
 * Handles CNPJ/CPF with or without formatting
 */
export function matchesSearch(
  searchTerm: string,
  ...values: (string | null | undefined)[]
): boolean {
  if (!searchTerm.trim()) return true;
  
  const searchLower = searchTerm.toLowerCase().trim();
  const searchClean = normalizeDocument(searchTerm);
  
  return values.some(value => {
    if (!value) return false;
    
    const valueLower = value.toLowerCase();
    const valueClean = normalizeDocument(value);
    
    // Check direct text match
    if (valueLower.includes(searchLower)) return true;
    
    // Check cleaned document match (for CNPJ/CPF)
    if (searchClean.length >= 3 && valueClean.includes(searchClean)) return true;
    
    return false;
  });
}

/**
 * Checks if a CNPJ matches a search term (handles both formatted and unformatted)
 */
export function matchesCnpj(
  searchTerm: string,
  cnpj: string | null | undefined
): boolean {
  if (!searchTerm.trim() || !cnpj) return false;
  
  const searchClean = normalizeDocument(searchTerm);
  const cnpjClean = normalizeDocument(cnpj);
  
  if (searchClean.length < 3) return false;
  
  // Match from start or anywhere
  return cnpjClean.includes(searchClean);
}

/**
 * Checks if a CPF matches a search term
 */
export function matchesCpf(
  searchTerm: string,
  cpf: string | null | undefined
): boolean {
  if (!searchTerm.trim() || !cpf) return false;
  
  const searchClean = normalizeDocument(searchTerm);
  const cpfClean = normalizeDocument(cpf);
  
  if (searchClean.length < 3) return false;
  
  return cpfClean.includes(searchClean);
}

/**
 * Checks if a name matches a search term (case-insensitive partial match)
 */
export function matchesName(
  searchTerm: string,
  name: string | null | undefined
): boolean {
  if (!searchTerm.trim() || !name) return false;
  
  const searchLower = searchTerm.toLowerCase().trim();
  const nameLower = name.toLowerCase();
  
  return nameLower.includes(searchLower);
}

/**
 * Combined employer search - matches by name, trade_name, cnpj, or registration_number
 */
export function matchesEmployer(
  searchTerm: string,
  employer: {
    name?: string | null;
    trade_name?: string | null;
    cnpj?: string | null;
    registration_number?: string | null;
  } | null | undefined
): boolean {
  if (!searchTerm.trim() || !employer) return false;
  
  const searchLower = searchTerm.toLowerCase().trim();
  const searchClean = normalizeDocument(searchTerm);
  
  // Name match
  if (employer.name?.toLowerCase().includes(searchLower)) return true;
  
  // Trade name match
  if (employer.trade_name?.toLowerCase().includes(searchLower)) return true;
  
  // CNPJ match (normalized)
  const cnpjClean = normalizeDocument(employer.cnpj);
  if (searchClean.length >= 3 && cnpjClean.includes(searchClean)) return true;
  
  // Registration number match
  if (employer.registration_number?.toLowerCase().includes(searchLower)) return true;
  
  return false;
}

/**
 * Combined patient/member search - matches by name or cpf
 */
export function matchesMember(
  searchTerm: string,
  member: {
    name?: string | null;
    cpf?: string | null;
  } | null | undefined
): boolean {
  if (!searchTerm.trim() || !member) return false;
  
  const searchLower = searchTerm.toLowerCase().trim();
  const searchClean = normalizeDocument(searchTerm);
  
  // Name match
  if (member.name?.toLowerCase().includes(searchLower)) return true;
  
  // CPF match (normalized)
  const cpfClean = normalizeDocument(member.cpf);
  if (searchClean.length >= 3 && cpfClean.includes(searchClean)) return true;
  
  return false;
}
