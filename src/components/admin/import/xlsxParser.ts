import * as XLSX from "xlsx";

/**
 * Estrutura esperada do XLSX do SindSystem:
 * Nome Sócio | Endereço | CEP | Cidade | UF | CPF | RG | Telefone | Celular | Nascimento | Sexo | Estado civil | Empresas | CNPJ | Função | Data inscrição | Data admissão | Nome da Mãe
 */

export interface ParsedXlsxRecord {
  nome: string;
  cpf: string;
  rg: string | null;
  empresa_nome: string;
  cnpj: string;
  funcao: string | null;
  data_inscricao: string | null;
  data_admissao: string | null;
  // Campos adicionais do XLSX
  endereco: string | null;
  cep: string | null;
  cidade: string | null;
  uf: string | null;
  telefone: string | null;
  celular: string | null;
  nascimento: string | null;
  sexo: string | null;
  estado_civil: string | null;
  nome_mae: string | null;
}

interface ColumnMapping {
  nome: number;
  cpf: number;
  rg: number;
  empresa: number;
  cnpj: number;
  funcao: number;
  data_inscricao: number;
  data_admissao: number;
  endereco: number;
  cep: number;
  cidade: number;
  uf: number;
  telefone: number;
  celular: number;
  nascimento: number;
  sexo: number;
  estado_civil: number;
  nome_mae: number;
}

const COLUMN_KEYWORDS: Record<keyof ColumnMapping, string[]> = {
  nome: ["nome sócio", "nome socio", "nome", "sócio", "socio", "associado"],
  cpf: ["cpf"],
  rg: ["rg", "identidade"],
  empresa: ["empresa", "empresas", "empregador", "razão social", "razao social"],
  cnpj: ["cnpj"],
  funcao: ["função", "funcao", "cargo", "ocupação", "ocupacao"],
  data_inscricao: ["data inscrição", "data inscricao", "inscrição", "inscricao", "data de inscrição"],
  data_admissao: ["data admissão", "data admissao", "admissão", "admissao", "data de admissão"],
  endereco: ["endereço", "endereco", "rua", "logradouro"],
  cep: ["cep", "código postal", "codigo postal"],
  cidade: ["cidade", "município", "municipio"],
  uf: ["uf", "estado", "sigla estado"],
  telefone: ["telefone", "fone", "tel"],
  celular: ["celular", "cel", "whatsapp", "whats"],
  nascimento: ["nascimento", "data nascimento", "data de nascimento", "dt. nascimento"],
  sexo: ["sexo", "gênero", "genero"],
  estado_civil: ["estado civil", "situação civil", "situacao civil"],
  nome_mae: ["nome da mãe", "nome da mae", "mãe", "mae", "nome mãe", "nome mae"],
};

function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function detectColumnMapping(headers: string[]): ColumnMapping {
  const normalizedHeaders = headers.map(normalizeHeader);
  
  const mapping: ColumnMapping = {
    nome: -1,
    cpf: -1,
    rg: -1,
    empresa: -1,
    cnpj: -1,
    funcao: -1,
    data_inscricao: -1,
    data_admissao: -1,
    endereco: -1,
    cep: -1,
    cidade: -1,
    uf: -1,
    telefone: -1,
    celular: -1,
    nascimento: -1,
    sexo: -1,
    estado_civil: -1,
    nome_mae: -1,
  };

  for (const [field, keywords] of Object.entries(COLUMN_KEYWORDS) as [keyof ColumnMapping, string[]][]) {
    for (let i = 0; i < normalizedHeaders.length; i++) {
      const header = normalizedHeaders[i];
      for (const keyword of keywords) {
        const normalizedKeyword = normalizeHeader(keyword);
        if (header === normalizedKeyword || header.includes(normalizedKeyword)) {
          mapping[field] = i;
          break;
        }
      }
      if (mapping[field] !== -1) break;
    }
  }

  return mapping;
}

function getCellValue(row: any[], index: number): string | null {
  if (index === -1 || index >= row.length) return null;
  const value = row[index];
  if (value === undefined || value === null) return null;
  return String(value).trim() || null;
}

function formatDate(value: any): string | null {
  if (!value) return null;
  
  // If it's already a string in DD/MM/YYYY format
  if (typeof value === "string") {
    const cleaned = value.trim();
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(cleaned)) {
      return cleaned;
    }
    // Try parsing other formats
    const date = new Date(cleaned);
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString("pt-BR");
    }
    return cleaned;
  }
  
  // If it's a number (Excel serial date)
  if (typeof value === "number") {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      const day = String(date.d).padStart(2, "0");
      const month = String(date.m).padStart(2, "0");
      const year = date.y;
      return `${day}/${month}/${year}`;
    }
  }
  
  // If it's a Date object
  if (value instanceof Date) {
    return value.toLocaleDateString("pt-BR");
  }
  
  return String(value);
}

function normalizeCpf(cpf: string | null): string {
  if (!cpf) return "";
  return cpf.replace(/\D/g, "");
}

function normalizeCnpj(cnpj: string | null): string {
  if (!cnpj) return "";
  return cnpj.replace(/\D/g, "");
}

export async function parseXlsxFile(file: File): Promise<{ records: ParsedXlsxRecord[]; rowCount: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          reject(new Error("Não foi possível ler o arquivo"));
          return;
        }

        const workbook = XLSX.read(data, { type: "array", cellDates: true });
        
        if (workbook.SheetNames.length === 0) {
          reject(new Error("Arquivo XLSX não contém planilhas"));
          return;
        }

        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json<any[]>(firstSheet, { header: 1, raw: false, dateNF: "DD/MM/YYYY" });
        
        if (jsonData.length < 2) {
          reject(new Error("Planilha vazia ou sem dados suficientes"));
          return;
        }

        // Find header row (first row with "CPF" or "Nome" in it)
        let headerRowIndex = 0;
        for (let i = 0; i < Math.min(5, jsonData.length); i++) {
          const row = jsonData[i] as string[];
          if (row && row.some(cell => {
            const normalized = normalizeHeader(String(cell || ""));
            return normalized.includes("cpf") || normalized.includes("nome socio");
          })) {
            headerRowIndex = i;
            break;
          }
        }

        const headers = (jsonData[headerRowIndex] as string[]).map(h => String(h || ""));
        const mapping = detectColumnMapping(headers);

        // Validate required columns
        if (mapping.nome === -1) {
          reject(new Error("Coluna 'Nome' não encontrada na planilha"));
          return;
        }
        if (mapping.cpf === -1) {
          reject(new Error("Coluna 'CPF' não encontrada na planilha"));
          return;
        }
        if (mapping.cnpj === -1) {
          reject(new Error("Coluna 'CNPJ' não encontrada na planilha"));
          return;
        }

        const records: ParsedXlsxRecord[] = [];
        
        for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
          const row = jsonData[i] as any[];
          if (!row || row.length === 0) continue;

          const nome = getCellValue(row, mapping.nome);
          const cpf = normalizeCpf(getCellValue(row, mapping.cpf));
          const cnpj = normalizeCnpj(getCellValue(row, mapping.cnpj));

          // Skip empty rows or rows without essential data
          if (!nome || !cpf || cpf.length < 11) continue;

          records.push({
            nome,
            cpf,
            rg: getCellValue(row, mapping.rg),
            empresa_nome: getCellValue(row, mapping.empresa) || "",
            cnpj,
            funcao: getCellValue(row, mapping.funcao),
            data_inscricao: formatDate(getCellValue(row, mapping.data_inscricao)),
            data_admissao: formatDate(getCellValue(row, mapping.data_admissao)),
            endereco: getCellValue(row, mapping.endereco),
            cep: getCellValue(row, mapping.cep),
            cidade: getCellValue(row, mapping.cidade),
            uf: getCellValue(row, mapping.uf),
            telefone: getCellValue(row, mapping.telefone),
            celular: getCellValue(row, mapping.celular),
            nascimento: formatDate(getCellValue(row, mapping.nascimento)),
            sexo: getCellValue(row, mapping.sexo),
            estado_civil: getCellValue(row, mapping.estado_civil),
            nome_mae: getCellValue(row, mapping.nome_mae),
          });
        }

        resolve({ records, rowCount: jsonData.length - headerRowIndex - 1 });
      } catch (error) {
        reject(new Error(`Erro ao processar arquivo XLSX: ${error instanceof Error ? error.message : "Erro desconhecido"}`));
      }
    };

    reader.onerror = () => {
      reject(new Error("Erro ao ler arquivo"));
    };

    reader.readAsArrayBuffer(file);
  });
}
