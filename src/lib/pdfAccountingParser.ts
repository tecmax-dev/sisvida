/**
 * Parser para extrair escritórios de contabilidade e empresas vinculadas
 * do texto de relatórios de contribuição
 */

export interface ParsedOffice {
  legacyId: string;
  name: string;
  email: string;
  phone: string;
  linkedCompanyCnpjs: string[];
}

export interface ParsedCompany {
  name: string;
  cnpj: string;
}

export interface ParseResult {
  offices: ParsedOffice[];
  orphanCompanies: ParsedCompany[]; // Empresas sem escritório associado
  totalCompanies: number;
}

/**
 * Extrai CNPJs do texto
 */
function extractCnpjs(text: string): string[] {
  // Padrão: XX.XXX.XXX/XXXX-XX ou somente números (14 dígitos)
  const cnpjPattern = /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g;
  const matches = text.match(cnpjPattern) || [];
  return matches.map(cnpj => cnpj.replace(/\D/g, ""));
}

/**
 * Extrai linhas de escritório do texto
 * Formato: "Escritórios: <ID> - <NOME> / <EMAIL> / <TELEFONE>"
 */
function extractOfficeLines(text: string): Array<{ line: string; position: number }> {
  const lines: Array<{ line: string; position: number }> = [];
  const pattern = /Escritórios?:\s*(\d+)\s*-\s*([^/\n]+)\s*\/\s*([^/\n]+)\s*\/\s*([^\n]+)/gi;
  let match;
  
  while ((match = pattern.exec(text)) !== null) {
    lines.push({
      line: match[0],
      position: match.index
    });
  }
  
  return lines;
}

/**
 * Parse de uma linha de escritório
 */
function parseOfficeLine(line: string): Omit<ParsedOffice, 'linkedCompanyCnpjs'> | null {
  const pattern = /Escritórios?:\s*(\d+)\s*-\s*([^/]+)\s*\/\s*([^/]+)\s*\/\s*(.+)/i;
  const match = line.match(pattern);
  
  if (!match) return null;
  
  return {
    legacyId: match[1].trim(),
    name: match[2].trim(),
    email: match[3].trim().toLowerCase(),
    phone: match[4].trim()
  };
}

/**
 * Extrai todas as empresas (nome + CNPJ) de um bloco de texto
 */
function extractCompaniesFromBlock(text: string): ParsedCompany[] {
  const companies: ParsedCompany[] = [];
  
  // Padrão para linhas que contêm CNPJ
  const lines = text.split('\n');
  
  for (const line of lines) {
    const cnpjMatch = line.match(/(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/);
    if (cnpjMatch) {
      const cnpj = cnpjMatch[1].replace(/\D/g, "");
      // Tenta extrair o nome da empresa (geralmente antes do CNPJ ou em uma coluna separada)
      const beforeCnpj = line.substring(0, line.indexOf(cnpjMatch[1])).trim();
      // Remove números de matrícula/sequência do início
      const name = beforeCnpj.replace(/^\d+\s+/, "").trim();
      
      if (name && cnpj.length === 14) {
        companies.push({ name, cnpj });
      }
    }
  }
  
  return companies;
}

/**
 * Parser principal - Escritório vem ANTES das empresas vinculadas
 */
export function parseAccountingReport(text: string): ParseResult {
  const officeLines = extractOfficeLines(text);
  const allCnpjs = extractCnpjs(text);
  const offices: ParsedOffice[] = [];
  
  if (officeLines.length === 0) {
    return {
      offices: [],
      orphanCompanies: extractCompaniesFromBlock(text),
      totalCompanies: allCnpjs.length
    };
  }
  
  // Ordena as linhas de escritório por posição
  officeLines.sort((a, b) => a.position - b.position);
  
  // Para cada escritório, pega as empresas que estão DEPOIS dele (até o próximo escritório)
  for (let i = 0; i < officeLines.length; i++) {
    const officeLine = officeLines[i];
    const parsed = parseOfficeLine(officeLine.line);
    
    if (!parsed) continue;
    
    // Bloco de texto DEPOIS deste escritório (até o próximo ou fim do texto)
    const startPos = officeLine.position + officeLine.line.length;
    const endPos = i < officeLines.length - 1 
      ? officeLines[i + 1].position 
      : text.length;
    const blockAfter = text.substring(startPos, endPos);
    
    // Extrai CNPJs do bloco
    const companiesInBlock = extractCompaniesFromBlock(blockAfter);
    
    offices.push({
      ...parsed,
      linkedCompanyCnpjs: companiesInBlock.map(c => c.cnpj)
    });
  }
  
  // Empresas órfãs: aquelas que aparecem ANTES do primeiro escritório
  const firstOffice = officeLines[0];
  const beforeFirst = text.substring(0, firstOffice.position);
  const orphanCompanies = extractCompaniesFromBlock(beforeFirst);
  
  return {
    offices,
    orphanCompanies,
    totalCompanies: allCnpjs.length
  };
}

/**
 * Parser para planilhas Excel - Escritório vem ANTES das empresas vinculadas
 */
export function parseExcelAccountingReport(rows: any[][]): ParseResult {
  const offices: ParsedOffice[] = [];
  const orphanCompanies: ParsedCompany[] = [];
  let currentOffice: Omit<ParsedOffice, 'linkedCompanyCnpjs'> | null = null;
  let currentCnpjs: string[] = [];
  let totalCompanies = 0;
  
  for (const row of rows) {
    if (!row || row.length === 0) continue;
    
    const firstCell = String(row[0] || '').trim();
    
    // Verifica se é linha de escritório
    if (firstCell.toLowerCase().includes('escritório') || firstCell.toLowerCase().includes('escritorios:')) {
      // Salva escritório anterior com suas empresas
      if (currentOffice) {
        offices.push({
          ...currentOffice,
          linkedCompanyCnpjs: [...new Set(currentCnpjs)] // Remove duplicatas
        });
      }
      
      // Parse do novo escritório
      currentOffice = parseOfficeLine(firstCell);
      currentCnpjs = [];
    } else {
      // Procura CNPJ em qualquer célula da linha
      const cnpj = extractCnpjFromExcelRow(row);
      if (cnpj) {
        totalCompanies++;
        if (currentOffice) {
          currentCnpjs.push(cnpj);
        } else {
          // Empresa antes do primeiro escritório (órfã)
          const name = extractCompanyNameFromRow(row);
          if (name) {
            orphanCompanies.push({ name, cnpj });
          }
        }
      }
    }
  }
  
  // Salva último escritório
  if (currentOffice) {
    offices.push({
      ...currentOffice,
      linkedCompanyCnpjs: [...new Set(currentCnpjs)]
    });
  }
  
  return {
    offices,
    orphanCompanies,
    totalCompanies
  };
}

/**
 * Extrai CNPJ de uma linha do Excel (procura em todas as células)
 */
function extractCnpjFromExcelRow(row: any[]): string | null {
  for (const cell of row) {
    if (cell == null) continue;
    
    let cellStr = String(cell);
    
    // Remove <br/> e outras tags HTML
    cellStr = cellStr.replace(/<br\s*\/?>/gi, '').replace(/<[^>]+>/g, '');
    
    // Procura padrão de CNPJ
    const match = cellStr.match(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/);
    if (match) {
      return match[0].replace(/\D/g, '');
    }
  }
  return null;
}

/**
 * Extrai nome da empresa de uma linha do Excel
 */
function extractCompanyNameFromRow(row: any[]): string {
  // Geralmente o nome está na segunda coluna (índice 1)
  if (row.length > 1 && row[1]) {
    return String(row[1]).trim();
  }
  // Fallback: primeira coluna que não seja número
  for (const cell of row) {
    const str = String(cell || '').trim();
    if (str && !/^\d+$/.test(str) && !str.includes('/')) {
      return str;
    }
  }
  return '';
}

/**
 * Remove duplicatas de CNPJs
 */
export function deduplicateCnpjs(cnpjs: string[]): string[] {
  return [...new Set(cnpjs)];
}

/**
 * Normaliza CNPJ (remove formatação)
 */
export function normalizeCnpj(cnpj: string): string {
  return cnpj.replace(/\D/g, "");
}

/**
 * Formata CNPJ para exibição
 */
export function formatCnpj(cnpj: string): string {
  const clean = cnpj.replace(/\D/g, "");
  if (clean.length !== 14) return cnpj;
  return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}
