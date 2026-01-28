import * as pdfjsLib from "pdfjs-dist";

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export interface ExtractedPdfData {
  rawText: string;
  pageCount: number;
}

/**
 * Extract text content from a PDF file
 */
export async function extractTextFromPdf(file: File): Promise<ExtractedPdfData> {
  const arrayBuffer = await file.arrayBuffer();
  
  const loadingTask = pdfjsLib.getDocument({
    data: arrayBuffer,
    useSystemFonts: true,
  });
  
  const pdf = await loadingTask.promise;
  const textParts: string[] = [];
  
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    
    // Group text items by their Y position to reconstruct lines
    const items = textContent.items as Array<{ str: string; transform: number[] }>;
    
    // Sort by Y position (descending) then X position (ascending)
    const sortedItems = items.sort((a, b) => {
      const yDiff = b.transform[5] - a.transform[5];
      if (Math.abs(yDiff) < 5) {
        return a.transform[4] - b.transform[4];
      }
      return yDiff;
    });
    
    // Group items by approximate Y position
    const lines: Map<number, string[]> = new Map();
    let currentY = -Infinity;
    let currentLine: string[] = [];
    
    for (const item of sortedItems) {
      const y = Math.round(item.transform[5]);
      
      if (Math.abs(y - currentY) > 5) {
        if (currentLine.length > 0) {
          lines.set(currentY, currentLine);
        }
        currentY = y;
        currentLine = [item.str];
      } else {
        currentLine.push(item.str);
      }
    }
    
    if (currentLine.length > 0) {
      lines.set(currentY, currentLine);
    }
    
    // Join lines
    const pageText = Array.from(lines.values())
      .map(line => line.join(" "))
      .join("\n");
    
    textParts.push(pageText);
  }
  
  return {
    rawText: textParts.join("\n\n"),
    pageCount: pdf.numPages,
  };
}

/**
 * Parse extracted PDF text into structured member records
 */
export interface ParsedMemberRecord {
  nome: string;
  cpf: string;
  rg: string | null;
  empresa_nome: string;
  cnpj: string;
  funcao: string | null;
  data_inscricao: string | null;
  data_admissao: string | null;
}

export function parseExtractedText(rawText: string): ParsedMemberRecord[] {
  const records: ParsedMemberRecord[] = [];
  const lines = rawText.split("\n").filter(line => line.trim());
  
  // Patterns
  const cpfPattern = /(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/;
  const cnpjPattern = /(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/;
  const datePattern = /(\d{2}\/\d{2}\/\d{4})/g;
  const rgPattern = /^(\d{1,2}\.?\d{3}\.?\d{3}-?[0-9Xx]?)$/;
  
  // Accumulator for multi-line records
  let currentRecord: Partial<ParsedMemberRecord> = {};
  let accumulatedText = "";
  
  for (const line of lines) {
    accumulatedText += " " + line;
    
    // Check if we have both CPF and CNPJ in the accumulated text
    const cpfMatch = accumulatedText.match(cpfPattern);
    const cnpjMatch = accumulatedText.match(cnpjPattern);
    
    if (cpfMatch && cnpjMatch) {
      const cpf = normalizeCpf(cpfMatch[1]);
      const cnpj = normalizeCnpj(cnpjMatch[1]);
      
      // Validate CPF and CNPJ
      if (cpf.replace(/\D/g, "").length !== 11 || cnpj.replace(/\D/g, "").length !== 14) {
        accumulatedText = "";
        continue;
      }
      
      // Skip placeholder CPFs
      if (cpf === "000.000.000-00" || cpf.replace(/\D/g, "") === "00000000000") {
        accumulatedText = "";
        continue;
      }
      
      // Extract name (text before CPF)
      const cpfIndex = accumulatedText.indexOf(cpfMatch[1]);
      const nome = accumulatedText.substring(0, cpfIndex).trim();
      
      if (!nome || nome.length < 3) {
        accumulatedText = "";
        continue;
      }
      
      // Extract text between CPF and CNPJ for RG and company name
      const cnpjIndex = accumulatedText.indexOf(cnpjMatch[1]);
      const middleText = accumulatedText.substring(cpfIndex + cpfMatch[1].length, cnpjIndex).trim();
      
      // Try to find RG in the middle text
      const middleParts = middleText.split(/\s+/);
      let rg: string | null = null;
      let empresaNome = middleText;
      
      // Check first part for RG pattern
      if (middleParts.length > 0) {
        const potentialRg = middleParts[0].replace(/[^\d\-Xx\.]/g, "");
        if (/^\d{6,12}[-.]?\d?[Xx]?$/.test(potentialRg) || rgPattern.test(potentialRg)) {
          rg = potentialRg;
          empresaNome = middleParts.slice(1).join(" ");
        }
      }
      
      // Extract text after CNPJ for function and dates
      const afterCnpj = accumulatedText.substring(cnpjIndex + cnpjMatch[1].length).trim();
      const dates = afterCnpj.match(datePattern) || [];
      
      // Function is text before dates
      let funcao: string | null = null;
      if (dates.length > 0) {
        const firstDateIndex = afterCnpj.indexOf(dates[0]);
        funcao = afterCnpj.substring(0, firstDateIndex).trim() || null;
      } else {
        funcao = afterCnpj.trim() || null;
      }
      
      // Clean up function
      if (funcao && funcao.length < 2) funcao = null;
      
      records.push({
        nome: cleanName(nome),
        cpf: cpf,
        rg: rg,
        empresa_nome: cleanName(empresaNome),
        cnpj: cnpj,
        funcao: funcao,
        data_inscricao: dates[0] ? parseDate(dates[0]) : null,
        data_admissao: dates[1] ? parseDate(dates[1]) : null,
      });
      
      // Reset accumulator
      accumulatedText = "";
    }
  }
  
  return records;
}

function cleanName(name: string): string {
  return name
    .replace(/\s+/g, " ")
    .replace(/^\s+|\s+$/g, "")
    .replace(/[^\w\sÀ-ÿ\-\.]/g, "");
}

function normalizeCpf(cpf: string): string {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return cpf;
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function normalizeCnpj(cnpj: string): string {
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14) return cnpj;
  return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}

function parseDate(dateStr: string): string | null {
  const match = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month}-${day}`;
  }
  return null;
}
