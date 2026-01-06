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
 * Parser principal
 */
export function parseAccountingReport(text: string): ParseResult {
  const officeLines = extractOfficeLines(text);
  const allCnpjs = extractCnpjs(text);
  const offices: ParsedOffice[] = [];
  const orphanCompanies: ParsedCompany[] = [];
  
  if (officeLines.length === 0) {
    // Sem escritórios encontrados
    return {
      offices: [],
      orphanCompanies: extractCompaniesFromBlock(text),
      totalCompanies: allCnpjs.length
    };
  }
  
  // Ordena as linhas de escritório por posição
  officeLines.sort((a, b) => a.position - b.position);
  
  // Para cada bloco antes de um escritório, associa as empresas ao escritório seguinte
  for (let i = 0; i < officeLines.length; i++) {
    const officeLine = officeLines[i];
    const parsed = parseOfficeLine(officeLine.line);
    
    if (!parsed) continue;
    
    // Encontra o bloco de texto antes deste escritório
    const startPos = i === 0 ? 0 : officeLines[i - 1].position + officeLines[i - 1].line.length;
    const endPos = officeLine.position;
    const blockBefore = text.substring(startPos, endPos);
    
    // Extrai CNPJs do bloco
    const companiesInBlock = extractCompaniesFromBlock(blockBefore);
    const cnpjsInBlock = companiesInBlock.map(c => c.cnpj);
    
    // Se este é o primeiro escritório e não há empresas antes, pega as empresas depois
    if (i === 0 && cnpjsInBlock.length === 0) {
      // Verifica se há empresas após o último escritório
      const afterLastOffice = text.substring(officeLines[officeLines.length - 1].position);
      const companiesAfter = extractCompaniesFromBlock(afterLastOffice);
      
      offices.push({
        ...parsed,
        linkedCompanyCnpjs: companiesAfter.map(c => c.cnpj)
      });
    } else {
      offices.push({
        ...parsed,
        linkedCompanyCnpjs: cnpjsInBlock
      });
    }
  }
  
  // Verifica empresas órfãs (após o último escritório)
  const lastOffice = officeLines[officeLines.length - 1];
  const afterLast = text.substring(lastOffice.position + lastOffice.line.length);
  const orphans = extractCompaniesFromBlock(afterLast);
  
  // Se há escritórios mas nenhum tem empresas associadas, distribui de forma alternativa
  const totalLinked = offices.reduce((sum, o) => sum + o.linkedCompanyCnpjs.length, 0);
  if (totalLinked === 0 && allCnpjs.length > 0) {
    // Tenta uma abordagem diferente: associa todas as empresas ao primeiro escritório
    const allCompanies = extractCompaniesFromBlock(text);
    if (offices.length > 0 && allCompanies.length > 0) {
      offices[0].linkedCompanyCnpjs = allCompanies.map(c => c.cnpj);
    }
  }
  
  return {
    offices,
    orphanCompanies: orphans,
    totalCompanies: allCnpjs.length
  };
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
