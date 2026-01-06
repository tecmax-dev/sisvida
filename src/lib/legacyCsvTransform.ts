/**
 * Utilitário para transformar CSVs legados (PESSOA.csv e PRONTUARIO.csv)
 * para o formato esperado pelo sistema de importação inteligente.
 */

export interface LegacyPessoaRow {
  id: string;
  nome: string;
  email?: string;
  cnpj_cpf?: string;
  ie_rg?: string;
  sexo?: string;
  estado_civil?: string;
  nascimento?: string;
  CEP?: string;
  endereco?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  telefone?: string;
  celular?: string;
  profissao?: string;
  mae_nome?: string;
  pai_nome?: string;
  tipo?: string;
  tipo_sanguineo?: string;
  escolaridade?: string;
  observacao?: string;
}

export interface LegacyProntuarioRow {
  id: string;
  id_cliente: string;
  id_profissional: string;
  data: string;
  descricao: string;
}

export interface TransformedPatient {
  nome: string;
  cpf?: string;
  rg?: string;
  telefone?: string;
  telefone_fixo?: string;
  email?: string;
  data_nascimento?: string;
  sexo?: string;
  estado_civil?: string;
  profissao?: string;
  nome_mae?: string;
  nome_pai?: string;
  cep?: string;
  endereco?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  tipo_sanguineo?: string;
  escolaridade?: string;
  observacoes?: string;
}

export interface TransformedMedicalRecord {
  cpf_paciente?: string;
  nome_paciente: string;
  nome_profissional?: string;
  data_registro: string;
  queixa?: string;
  diagnostico?: string;
  tratamento?: string;
  prescricao?: string;
  observacoes?: string;
}

/**
 * Remove tags HTML e normaliza o texto
 */
export function cleanHtml(html: string | undefined | null): string {
  if (!html) return '';
  
  return html
    // Replace <br/>, <br>, <p> with newlines
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<p>/gi, '')
    // Remove all other HTML tags
    .replace(/<[^>]*>/g, '')
    // Decode HTML entities
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    // Clean up multiple newlines and spaces
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/**
 * Extrai seções específicas do conteúdo HTML do prontuário
 */
export function extractMedicalRecordSections(html: string): {
  queixa?: string;
  historia?: string;
  diagnostico?: string;
  tratamento?: string;
  prescricao?: string;
  observacoes?: string;
} {
  const result: Record<string, string> = {};
  
  // Patterns para extrair seções
  const patterns: { key: string; regex: RegExp }[] = [
    { key: 'queixa', regex: /<b>Queixa principal:<\/b>\s*(.*?)(?=<p>|<b>|$)/gi },
    { key: 'historia', regex: /<b>História:<\/b>\s*(.*?)(?=<p>|<b>|$)/gi },
    { key: 'diagnostico', regex: /<b>Diagnóstico:<\/b>\s*(.*?)(?=<p>|<b>|$)/gi },
    { key: 'tratamento', regex: /<b>Tratamento:<\/b>\s*(.*?)(?=<p>|<b>|$)/gi },
    { key: 'prescricao', regex: /<b>Prescrição:<\/b>\s*(.*?)(?=<p>|<b>|$)/gi },
  ];

  for (const { key, regex } of patterns) {
    const match = regex.exec(html);
    if (match && match[1]) {
      result[key] = cleanHtml(match[1]);
    }
  }

  // Se não encontrou seções específicas, coloca tudo em observações
  if (Object.keys(result).length === 0) {
    result.observacoes = cleanHtml(html);
  }

  return result;
}

/**
 * Converte data de YYYY-MM-DD para DD/MM/YYYY
 */
export function formatDateToBR(dateStr: string | undefined | null): string {
  if (!dateStr) return '';
  
  // Já está no formato DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    return dateStr;
  }
  
  // Formato YYYY-MM-DD
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (match) {
    return `${match[3]}/${match[2]}/${match[1]}`;
  }
  
  return dateStr;
}

/**
 * Normaliza CPF removendo formatação
 */
export function normalizeCPF(cpf: string | undefined | null): string {
  if (!cpf) return '';
  return cpf.replace(/\D/g, '');
}

/**
 * Formata CPF com pontuação
 */
export function formatCPF(cpf: string | undefined | null): string {
  const clean = normalizeCPF(cpf);
  if (clean.length !== 11) return cpf || '';
  return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9)}`;
}

/**
 * Normaliza sexo para o formato esperado
 */
export function normalizeSexo(sexo: string | undefined | null): string {
  if (!sexo) return '';
  const s = sexo.toUpperCase().trim();
  if (s === 'M') return 'Masculino';
  if (s === 'F') return 'Feminino';
  return sexo;
}

/**
 * Normaliza estado civil
 */
export function normalizeEstadoCivil(estado: string | undefined | null): string {
  if (!estado) return '';
  const e = estado.toLowerCase().trim();
  
  const mapping: Record<string, string> = {
    'solteiro': 'Solteiro(a)',
    'casado': 'Casado(a)',
    'divorciado': 'Divorciado(a)',
    'viuvo': 'Viúvo(a)',
    'viúvo': 'Viúvo(a)',
    'separado': 'Separado(a)',
    'uniao estavel': 'União Estável',
    'união estável': 'União Estável',
  };
  
  return mapping[e] || estado;
}

/**
 * Normaliza telefone
 */
export function normalizePhone(phone: string | undefined | null): string {
  if (!phone) return '';
  // Remove caracteres não-numéricos exceto parênteses e hífen
  const clean = phone.replace(/[^\d()-\s]/g, '').trim();
  // Se for um número zerado, retorna vazio
  if (/^[\(\)0\-\s]+$/.test(clean)) return '';
  return clean;
}

/**
 * Parse de CSV com separador ponto-e-vírgula
 */
export function parseCSV(content: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length === 0) return { headers: [], rows: [] };
  
  // Remove BOM se presente
  let headerLine = lines[0];
  if (headerLine.charCodeAt(0) === 0xFEFF) {
    headerLine = headerLine.slice(1);
  }
  
  const headers = headerLine.split(';').map(h => h.trim());
  const rows: Record<string, string>[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(';');
    const row: Record<string, string> = {};
    
    headers.forEach((header, index) => {
      let value = values[index] || '';
      // Remove aspas do início e fim
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      // Substitui NULL por string vazia
      if (value === 'NULL' || value === 'null') {
        value = '';
      }
      row[header] = value.trim();
    });
    
    rows.push(row);
  }
  
  return { headers, rows };
}

/**
 * Transforma PESSOA.csv para o formato de pacientes do sistema
 * Filtra apenas clientes (exclui profissionais)
 */
export function transformPessoaToPatients(pessoaRows: Record<string, string>[]): TransformedPatient[] {
  return pessoaRows
    .filter(row => {
      // Exclui profissionais (tipo = "Profissional")
      const tipo = row.tipo?.toLowerCase() || '';
      return tipo !== 'profissional';
    })
    .map(row => ({
      nome: row.nome || '',
      cpf: formatCPF(row.cnpj_cpf),
      rg: row.ie_rg || '',
      telefone: normalizePhone(row.celular) || normalizePhone(row.telefone),
      telefone_fixo: normalizePhone(row.telefone),
      email: row.email || '',
      data_nascimento: formatDateToBR(row.nascimento),
      sexo: normalizeSexo(row.sexo),
      estado_civil: normalizeEstadoCivil(row.estado_civil),
      profissao: row.profissao || '',
      nome_mae: row.mae_nome || '',
      nome_pai: row.pai_nome || '',
      cep: row.CEP || '',
      endereco: row.endereco || '',
      numero: row.numero || '',
      complemento: row.complemento || '',
      bairro: row.bairro || '',
      tipo_sanguineo: row.tipo_sanguineo || '',
      escolaridade: row.escolaridade || '',
      observacoes: row.observacao || '',
    }))
    .filter(p => p.nome); // Remove linhas sem nome
}

/**
 * Cria um mapa de lookup de PESSOA por ID
 */
export function createPessoaLookup(pessoaRows: Record<string, string>[]): Map<string, { nome: string; cpf: string }> {
  const lookup = new Map<string, { nome: string; cpf: string }>();
  
  for (const row of pessoaRows) {
    if (row.id) {
      lookup.set(row.id, {
        nome: row.nome || '',
        cpf: formatCPF(row.cnpj_cpf),
      });
    }
  }
  
  return lookup;
}

/**
 * Transforma PRONTUARIO.csv para o formato de prontuários do sistema
 * Usa lookup da PESSOA para resolver id_cliente -> nome/cpf
 */
export function transformProntuarioToMedicalRecords(
  prontuarioRows: Record<string, string>[],
  pessoaLookup: Map<string, { nome: string; cpf: string }>
): TransformedMedicalRecord[] {
  return prontuarioRows
    .map(row => {
      // Busca dados do paciente pelo id_cliente
      const patient = pessoaLookup.get(row.id_cliente);
      if (!patient || !patient.nome) {
        return null; // Ignora prontuários sem paciente válido
      }
      
      // Busca nome do profissional pelo id_profissional
      const professional = pessoaLookup.get(row.id_profissional);
      
      // Extrai seções do HTML do prontuário
      const sections = extractMedicalRecordSections(row.descricao || '');
      
      // Se não conseguiu extrair seções, usa o texto limpo como observações
      const observacoes = sections.observacoes || 
        (sections.historia ? `História: ${sections.historia}` : cleanHtml(row.descricao));
      
      return {
        cpf_paciente: patient.cpf || '',
        nome_paciente: patient.nome,
        nome_profissional: professional?.nome || '',
        data_registro: formatDateToBR(row.data),
        queixa: sections.queixa || '',
        diagnostico: sections.diagnostico || '',
        tratamento: sections.tratamento || '',
        prescricao: sections.prescricao || '',
        observacoes: observacoes,
      } as TransformedMedicalRecord;
    })
    .filter((r): r is TransformedMedicalRecord => r !== null && !!r.data_registro);
}

/**
 * Converte array de objetos para CSV
 */
export function toCSV<T extends object>(data: T[], headers?: string[]): string {
  if (data.length === 0) return '';
  
  const keys = headers || Object.keys(data[0]);
  const lines: string[] = [];
  
  // Header
  lines.push(keys.join(';'));
  
  // Rows
  for (const row of data as Record<string, unknown>[]) {
    const values = keys.map((key: string) => {
      let value = String(row[key] ?? '');
      // Escape semicolons and quotes
      if (value.includes(';') || value.includes('"') || value.includes('\n')) {
        value = `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    });
    lines.push(values.join(';'));
  }
  
  return lines.join('\n');
}

/**
 * Processa os dois arquivos CSV e retorna os dados transformados
 */
export async function processLegacyFiles(
  pessoaContent: string,
  prontuarioContent: string
): Promise<{
  patients: TransformedPatient[];
  medicalRecords: TransformedMedicalRecord[];
  patientsCSV: string;
  medicalRecordsCSV: string;
  stats: {
    totalPessoas: number;
    totalPacientes: number;
    totalProfissionais: number;
    totalProntuarios: number;
    prontuariosVinculados: number;
  };
}> {
  // Parse CSVs
  const pessoaData = parseCSV(pessoaContent);
  const prontuarioData = parseCSV(prontuarioContent);
  
  // Create lookup
  const pessoaLookup = createPessoaLookup(pessoaData.rows);
  
  // Count profissionais
  const totalProfissionais = pessoaData.rows.filter(
    r => r.tipo?.toLowerCase() === 'profissional'
  ).length;
  
  // Transform
  const patients = transformPessoaToPatients(pessoaData.rows);
  const medicalRecords = transformProntuarioToMedicalRecords(prontuarioData.rows, pessoaLookup);
  
  // Convert to CSV
  const patientHeaders = [
    'nome', 'cpf', 'rg', 'telefone', 'telefone_fixo', 'email', 
    'data_nascimento', 'sexo', 'estado_civil', 'profissao',
    'nome_mae', 'nome_pai', 'cep', 'endereco', 'numero', 
    'complemento', 'bairro', 'tipo_sanguineo', 'escolaridade', 'observacoes'
  ];
  
  const recordHeaders = [
    'cpf_paciente', 'nome_paciente', 'nome_profissional', 
    'data_registro', 'queixa', 'diagnostico', 'tratamento', 
    'prescricao', 'observacoes'
  ];
  
  const patientsCSV = toCSV(patients, patientHeaders);
  const medicalRecordsCSV = toCSV(medicalRecords, recordHeaders);
  
  return {
    patients,
    medicalRecords,
    patientsCSV,
    medicalRecordsCSV,
    stats: {
      totalPessoas: pessoaData.rows.length,
      totalPacientes: patients.length,
      totalProfissionais,
      totalProntuarios: prontuarioData.rows.length,
      prontuariosVinculados: medicalRecords.length,
    },
  };
}

/**
 * Faz download de um conteúdo como arquivo CSV
 */
export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}
