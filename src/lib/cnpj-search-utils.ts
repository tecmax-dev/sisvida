/**
 * Centralized CNPJ search utilities for consistent matching across the system.
 * Handles leading zeros, partial matches, and normalized comparisons.
 */

/**
 * Normalize a CNPJ string by removing all non-digit characters
 */
export function normalizeCnpj(cnpj: string | null | undefined): string {
  if (!cnpj) return "";
  return cnpj.replace(/\D/g, "");
}

/**
 * Format a normalized CNPJ string with proper punctuation
 */
export function formatCnpj(cnpj: string | null | undefined): string {
  if (!cnpj) return "";
  const cleaned = normalizeCnpj(cnpj);
  if (cleaned.length !== 14) return cnpj;
  return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}

/**
 * Check if a CNPJ matches a search term.
 * Handles:
 * - Partial matches from any position
 * - Leading zeros in both search term and CNPJ
 * - Minimum character requirements for performance
 * 
 * @param cnpj The CNPJ to check (can be formatted or raw)
 * @param searchTerm The search term entered by user
 * @param minChars Minimum characters required for search (default: 2)
 * @returns true if the CNPJ matches the search term
 */
export function cnpjMatchesSearch(
  cnpj: string | null | undefined,
  searchTerm: string,
  minChars: number = 2
): boolean {
  const cnpjClean = normalizeCnpj(cnpj);
  const searchClean = normalizeCnpj(searchTerm);
  
  if (!cnpjClean || searchClean.length < minChars) return false;
  
  // Direct match - search term appears anywhere in CNPJ
  if (cnpjClean.includes(searchClean)) return true;
  
  // Starts with match
  if (cnpjClean.startsWith(searchClean)) return true;
  
  // Handle leading zeros mismatch
  // Case 1: User searches "3025212" but CNPJ is "03025212000111"
  const searchNoLeadingZeros = searchClean.replace(/^0+/, "");
  const cnpjNoLeadingZeros = cnpjClean.replace(/^0+/, "");
  
  if (searchNoLeadingZeros.length >= minChars) {
    if (cnpjNoLeadingZeros.includes(searchNoLeadingZeros)) return true;
    if (cnpjClean.includes(searchNoLeadingZeros)) return true;
  }
  
  // Case 2: User searches "03025212" and it should match "3025212..." (rare case)
  if (searchClean.length >= minChars && cnpjNoLeadingZeros.includes(searchClean)) {
    return true;
  }
  
  // Case 3: Full CNPJ comparison with padding
  if (searchClean.length === 14) {
    return cnpjClean === searchClean;
  }
  
  return false;
}

/**
 * Create a filter function for employer-like objects with CNPJ
 * Searches across name, trade_name, cnpj, and registration_number
 */
export function createEmployerSearchFilter<T extends {
  name?: string | null;
  trade_name?: string | null;
  cnpj?: string | null;
  registration_number?: string | null;
}>(searchTerm: string): (item: T) => boolean {
  const trimmed = searchTerm.trim();
  if (!trimmed) return () => true;
  
  const searchLower = trimmed.toLowerCase();
  
  return (item: T) => {
    // Name match
    if (item.name?.toLowerCase().includes(searchLower)) return true;
    
    // Trade name match
    if (item.trade_name?.toLowerCase().includes(searchLower)) return true;
    
    // CNPJ match with normalization
    if (cnpjMatchesSearch(item.cnpj, trimmed)) return true;
    
    // Registration number match
    if (item.registration_number?.toLowerCase().includes(searchLower)) return true;
    
    return false;
  };
}
