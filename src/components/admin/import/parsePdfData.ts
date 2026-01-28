import { ImportedMember } from "./types";

/**
 * Parse a markdown table (from PDF parsing) into structured data
 * Expected format:
 * | Nome Sócio | CPF | RG | Empresas | CNPJ | Função | Data inscrição | Data admissão |
 */
export function parsePdfTableData(markdownContent: string): ImportedMember[] {
  const lines = markdownContent.split("\n");
  const records: ImportedMember[] = [];
  
  let inTable = false;
  let headerPassed = false;
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Skip empty lines
    if (!trimmedLine) {
      inTable = false;
      headerPassed = false;
      continue;
    }
    
    // Skip non-table lines and page markers
    if (!trimmedLine.startsWith("|") || trimmedLine.includes("### Images")) {
      continue;
    }
    
    // Check if this is a separator line (header divider)
    if (trimmedLine.includes("---")) {
      headerPassed = true;
      continue;
    }
    
    // Check if this is the header line
    if (trimmedLine.toLowerCase().includes("nome s") || 
        trimmedLine.toLowerCase().includes("nome sócio")) {
      inTable = true;
      continue;
    }
    
    // Skip if we haven't passed the header yet
    if (!inTable || !headerPassed) {
      continue;
    }
    
    // Parse the data row
    const cells = trimmedLine
      .split("|")
      .map(c => c.trim())
      .filter(c => c !== "");
    
    // Expected columns: Nome, CPF, RG, Empresas, CNPJ, Função, Data inscrição, Data admissão
    if (cells.length >= 5) {
      const cpf = normalizeCpf(cells[1]);
      const cnpj = normalizeCnpj(cells[4]);
      
      // Skip invalid CPF or CNPJ
      if (!cpf || cpf === "000.000.000-00" || cpf.replace(/\D/g, "").length !== 11) {
        continue;
      }
      
      if (!cnpj || cnpj.replace(/\D/g, "").length !== 14) {
        continue;
      }
      
      records.push({
        nome: cells[0] || "",
        cpf: cpf,
        rg: cells[2] || null,
        empresa_nome: cells[3] || "",
        cnpj: cnpj,
        funcao: cells[5] || null,
        data_inscricao: parseDate(cells[6]),
        data_admissao: parseDate(cells[7]),
        status: "pending",
      });
    }
  }
  
  return records;
}

function normalizeCpf(cpf: string): string {
  if (!cpf) return "";
  return cpf.replace(/\D/g, "").replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function normalizeCnpj(cnpj: string): string {
  if (!cnpj) return "";
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14) return cnpj;
  return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}

function parseDate(dateStr: string | undefined): string | null {
  if (!dateStr || dateStr.trim() === "") return null;
  
  // Try DD/MM/YYYY format
  const match = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month}-${day}`;
  }
  
  return null;
}

/**
 * Group records by unique member (CPF) - a member may work at multiple companies
 */
export function groupByCpf(records: ImportedMember[]): Map<string, ImportedMember[]> {
  const grouped = new Map<string, ImportedMember[]>();
  
  for (const record of records) {
    const cpfKey = record.cpf.replace(/\D/g, "");
    if (!grouped.has(cpfKey)) {
      grouped.set(cpfKey, []);
    }
    grouped.get(cpfKey)!.push(record);
  }
  
  return grouped;
}

/**
 * Group records by unique company (CNPJ)
 */
export function groupByCnpj(records: ImportedMember[]): Map<string, ImportedMember[]> {
  const grouped = new Map<string, ImportedMember[]>();
  
  for (const record of records) {
    const cnpjKey = record.cnpj.replace(/\D/g, "");
    if (!grouped.has(cnpjKey)) {
      grouped.set(cnpjKey, []);
    }
    grouped.get(cnpjKey)!.push(record);
  }
  
  return grouped;
}
