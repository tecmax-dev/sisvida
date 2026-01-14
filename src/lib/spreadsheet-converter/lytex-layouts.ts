/**
 * Pre-configured layouts for Lytex reports
 */

export interface LytexLayoutField {
  sourceColumns: string[];
  targetField: string;
  transform?: 'currency' | 'date' | 'cpfcnpj' | 'status' | 'text' | 'phone' | 'competence';
}

export interface LytexLayout {
  name: string;
  description: string;
  detectionColumns: string[];
  minMatchScore: number;
  fields: LytexLayoutField[];
  outputType: 'contributions' | 'employers' | 'financial';
}

// Common column name variations
const CNPJ_COLUMNS = [
  'cnpj', 'CNPJ', 'cnpj_cpf', 'CNPJ/CPF', 'documento', 'DOCUMENTO',
  'cpf_cnpj', 'CPF/CNPJ', 'inscricao', 'INSCRICAO', 'doc', 'DOC',
  'nr_cnpj', 'NR_CNPJ', 'num_documento', 'NUM_DOCUMENTO'
];

// Specific CPF columns for individual (pessoa física) reports
const CPF_COLUMNS = [
  'cpf', 'CPF', 'pagador cpf/cnpj', 'Pagador CPF/CNPJ', 'PAGADOR CPF/CNPJ',
  'cpf_cnpj', 'CPF/CNPJ', 'documento', 'DOCUMENTO', 'doc', 'DOC',
  'cpf pagador', 'CPF Pagador', 'CPF_PAGADOR'
];

const NAME_COLUMNS = [
  'razao_social', 'RAZAO_SOCIAL', 'razão social', 'Razão Social', 'RAZÃO SOCIAL',
  'nome', 'NOME', 'name', 'NAME', 'empresa', 'EMPRESA', 'cliente', 'CLIENTE',
  'nm_empresa', 'NM_EMPRESA', 'razao', 'RAZAO', 'nome_empresa', 'NOME_EMPRESA',
  'pagador', 'Pagador', 'PAGADOR', 'nome_pagador', 'Nome Pagador', 'NOME_PAGADOR'
];

const VALUE_COLUMNS = [
  'valor', 'VALOR', 'value', 'VALUE', 'montante', 'MONTANTE', 'total', 'TOTAL',
  'vl_total', 'VL_TOTAL', 'valor_total', 'VALOR_TOTAL', 'vl_cobranca', 'VL_COBRANCA',
  'valor_fatura', 'VALOR_FATURA', 'vlr', 'VLR', 'amount', 'AMOUNT',
  'valor original', 'Valor Original', 'VALOR ORIGINAL', 'valor_original', 'VALOR_ORIGINAL',
  'valor pago', 'Valor Pago', 'VALOR PAGO', 'valor_pago', 'VALOR_PAGO'
];

const DUE_DATE_COLUMNS = [
  'vencimento', 'VENCIMENTO', 'dt_vencimento', 'DT_VENCIMENTO', 'data_vencimento',
  'DATA_VENCIMENTO', 'due_date', 'DUE_DATE', 'prazo', 'PRAZO', 'data_vcto', 'DATA_VCTO',
  'vcto', 'VCTO', 'vecto', 'VECTO',
  'data de vencimento', 'Data de vencimento', 'DATA DE VENCIMENTO'
];

const PAYMENT_DATE_COLUMNS = [
  'data_pagamento', 'DATA_PAGAMENTO', 'dt_pagamento', 'DT_PAGAMENTO', 'pagamento',
  'PAGAMENTO', 'payment_date', 'PAYMENT_DATE', 'dt_pgto', 'DT_PGTO', 'data_pgto',
  'DATA_PGTO', 'pago_em', 'PAGO_EM',
  'data de pagamento', 'Data de pagamento', 'DATA DE PAGAMENTO'
];

const STATUS_COLUMNS = [
  'status', 'STATUS', 'situacao', 'SITUACAO', 'situação', 'SITUAÇÃO', 'estado',
  'ESTADO', 'state', 'STATE', 'st_cobranca', 'ST_COBRANCA', 'status_fatura'
];

const COMPETENCE_COLUMNS = [
  'competencia', 'COMPETENCIA', 'competência', 'COMPETÊNCIA', 'mes_ref', 'MES_REF',
  'referencia', 'REFERENCIA', 'período', 'PERÍODO', 'periodo', 'PERIODO',
  'mes_ano', 'MES_ANO', 'ref', 'REF'
];

const EMAIL_COLUMNS = [
  'email', 'EMAIL', 'e-mail', 'E-MAIL', 'e_mail', 'E_MAIL', 'correio', 'CORREIO',
  'mail', 'MAIL', 'ds_email', 'DS_EMAIL',
  'e-mail pagador', 'E-mail Pagador', 'E-MAIL PAGADOR'
];

const PHONE_COLUMNS = [
  'telefone', 'TELEFONE', 'phone', 'PHONE', 'tel', 'TEL', 'fone', 'FONE',
  'celular', 'CELULAR', 'whatsapp', 'WHATSAPP', 'contato', 'CONTATO',
  'nr_telefone', 'NR_TELEFONE',
  'telefone pagador', 'Telefone Pagador', 'TELEFONE PAGADOR'
];

const ADDRESS_COLUMNS = [
  'endereco', 'ENDERECO', 'endereço', 'ENDEREÇO', 'address', 'ADDRESS',
  'logradouro', 'LOGRADOURO', 'rua', 'RUA', 'ds_endereco', 'DS_ENDERECO',
  'endereço pagador', 'Endereço Pagador', 'ENDEREÇO PAGADOR'
];

const CITY_COLUMNS = [
  'cidade', 'CIDADE', 'city', 'CITY', 'municipio', 'MUNICIPIO', 'município',
  'MUNICÍPIO', 'nm_cidade', 'NM_CIDADE'
];

const STATE_COLUMNS = [
  'uf', 'UF', 'estado', 'ESTADO', 'state', 'STATE', 'sg_uf', 'SG_UF',
  'sigla_uf', 'SIGLA_UF'
];

const DESCRIPTION_COLUMNS = [
  'descricao', 'DESCRICAO', 'descrição', 'DESCRIÇÃO', 'description', 'DESCRIPTION',
  'obs', 'OBS', 'observacao', 'OBSERVACAO', 'observações', 'OBSERVAÇÕES', 'observacoes', 'OBSERVACOES',
  'historico', 'HISTORICO', 'histórico', 'HISTÓRICO', 'ds_item', 'DS_ITEM',
  'notas', 'NOTAS', 'notes', 'NOTES', 'nota', 'NOTA',
  'detalhes', 'DETALHES', 'details', 'DETAILS', 'detalhe', 'DETALHE',
  'comentario', 'COMENTARIO', 'comentário', 'COMENTÁRIO', 'comentarios', 'COMENTARIOS',
  'informacao', 'INFORMACAO', 'informação', 'INFORMAÇÃO', 'info', 'INFO',
  'tipo', 'TIPO', // Muitas planilhas usam "Tipo" para descrição
];

// Invoice code columns specific to Lytex
const INVOICE_CODE_COLUMNS = [
  'cód. fatura', 'Cód. Fatura', 'CÓD. FATURA', 'cod_fatura', 'COD_FATURA',
  'codigo_fatura', 'CODIGO_FATURA', 'invoice_id', 'INVOICE_ID', 
  'cod fatura', 'Cod Fatura', 'COD FATURA', 'id_fatura', 'ID_FATURA'
];

const TYPE_COLUMNS = [
  'tipo', 'TIPO', 'type', 'TYPE', 'categoria', 'CATEGORIA', 'tp_cobranca',
  'TP_COBRANCA', 'tipo_contribuicao', 'TIPO_CONTRIBUICAO', 'ds_tipo', 'DS_TIPO'
];

/**
 * Pre-configured Lytex layouts
 */
export const LYTEX_LAYOUTS: Record<string, LytexLayout> = {
  invoices: {
    name: 'Relatório de Faturas',
    description: 'Faturas/cobranças do Lytex com CNPJ, valor, vencimento e status',
    detectionColumns: ['cnpj', 'valor', 'vencimento', 'status'],
    minMatchScore: 3,
    fields: [
      { sourceColumns: CNPJ_COLUMNS, targetField: 'cnpj', transform: 'cpfcnpj' },
      { sourceColumns: NAME_COLUMNS, targetField: 'name', transform: 'text' },
      { sourceColumns: VALUE_COLUMNS, targetField: 'value', transform: 'currency' },
      { sourceColumns: DUE_DATE_COLUMNS, targetField: 'due_date', transform: 'date' },
      { sourceColumns: PAYMENT_DATE_COLUMNS, targetField: 'payment_date', transform: 'date' },
      { sourceColumns: STATUS_COLUMNS, targetField: 'status', transform: 'status' },
      { sourceColumns: COMPETENCE_COLUMNS, targetField: 'competence', transform: 'competence' },
      { sourceColumns: TYPE_COLUMNS, targetField: 'contribution_type', transform: 'text' },
      { sourceColumns: DESCRIPTION_COLUMNS, targetField: 'description', transform: 'text' },
    ],
    outputType: 'contributions',
  },
  
  clients: {
    name: 'Cadastro de Clientes',
    description: 'Clientes/empresas do Lytex com dados cadastrais completos',
    detectionColumns: ['cnpj', 'razao_social', 'email', 'telefone'],
    minMatchScore: 2,
    fields: [
      { sourceColumns: CNPJ_COLUMNS, targetField: 'cnpj', transform: 'cpfcnpj' },
      { sourceColumns: NAME_COLUMNS, targetField: 'name', transform: 'text' },
      { sourceColumns: EMAIL_COLUMNS, targetField: 'email', transform: 'text' },
      { sourceColumns: PHONE_COLUMNS, targetField: 'phone', transform: 'phone' },
      { sourceColumns: ADDRESS_COLUMNS, targetField: 'address', transform: 'text' },
      { sourceColumns: CITY_COLUMNS, targetField: 'city', transform: 'text' },
      { sourceColumns: STATE_COLUMNS, targetField: 'state', transform: 'text' },
    ],
    outputType: 'employers',
  },
  
  financial: {
    name: 'Extrato Financeiro',
    description: 'Movimentações financeiras do Lytex com data, valor e descrição',
    detectionColumns: ['data', 'valor', 'descricao', 'tipo'],
    minMatchScore: 3,
    fields: [
      { sourceColumns: ['data', 'DATA', 'date', 'DATE', 'dt_movimento', 'DT_MOVIMENTO'], targetField: 'date', transform: 'date' },
      { sourceColumns: VALUE_COLUMNS, targetField: 'value', transform: 'currency' },
      { sourceColumns: DESCRIPTION_COLUMNS, targetField: 'description', transform: 'text' },
      { sourceColumns: TYPE_COLUMNS, targetField: 'type', transform: 'text' },
      { sourceColumns: CNPJ_COLUMNS, targetField: 'cnpj', transform: 'cpfcnpj' },
    ],
    outputType: 'financial',
  },
  
  payments: {
    name: 'Relatório de Pagamentos',
    description: 'Pagamentos recebidos com data de pagamento e confirmação',
    detectionColumns: ['cnpj', 'valor', 'data_pagamento'],
    minMatchScore: 3,
    fields: [
      { sourceColumns: CNPJ_COLUMNS, targetField: 'cnpj', transform: 'cpfcnpj' },
      { sourceColumns: NAME_COLUMNS, targetField: 'name', transform: 'text' },
      { sourceColumns: VALUE_COLUMNS, targetField: 'value', transform: 'currency' },
      { sourceColumns: PAYMENT_DATE_COLUMNS, targetField: 'payment_date', transform: 'date' },
      { sourceColumns: DUE_DATE_COLUMNS, targetField: 'due_date', transform: 'date' },
      { sourceColumns: COMPETENCE_COLUMNS, targetField: 'competence', transform: 'competence' },
      { sourceColumns: TYPE_COLUMNS, targetField: 'contribution_type', transform: 'text' },
    ],
    outputType: 'contributions',
  },
  
  payments_individual: {
    name: 'Pagamentos Pessoa Física',
    description: 'Pagamentos de contribuições individuais (CPF - sócios)',
    detectionColumns: ['cpf', 'valor', 'data_pagamento'],
    minMatchScore: 2,
    fields: [
      { sourceColumns: CPF_COLUMNS, targetField: 'cpf', transform: 'cpfcnpj' },
      { sourceColumns: NAME_COLUMNS, targetField: 'name', transform: 'text' },
      { sourceColumns: VALUE_COLUMNS, targetField: 'value', transform: 'currency' },
      { sourceColumns: PAYMENT_DATE_COLUMNS, targetField: 'payment_date', transform: 'date' },
      { sourceColumns: DUE_DATE_COLUMNS, targetField: 'due_date', transform: 'date' },
      { sourceColumns: COMPETENCE_COLUMNS, targetField: 'competence', transform: 'competence' },
      { sourceColumns: DESCRIPTION_COLUMNS, targetField: 'description', transform: 'text' },
      { sourceColumns: TYPE_COLUMNS, targetField: 'contribution_type', transform: 'text' },
    ],
    outputType: 'contributions',
  },
  
  // NEW: Full Lytex individual report with all columns
  lytex_individual_full: {
    name: 'Relatório Lytex Pessoa Física',
    description: 'Relatório completo da Lytex com CPF, status, valores e datas',
    detectionColumns: ['pagador cpf/cnpj', 'valor original', 'data de pagamento', 'status', 'cód. fatura'],
    minMatchScore: 3,
    fields: [
      { sourceColumns: CPF_COLUMNS, targetField: 'cpf', transform: 'cpfcnpj' },
      { sourceColumns: NAME_COLUMNS, targetField: 'name', transform: 'text' },
      { sourceColumns: VALUE_COLUMNS, targetField: 'value', transform: 'currency' },
      { sourceColumns: PAYMENT_DATE_COLUMNS, targetField: 'payment_date', transform: 'date' },
      { sourceColumns: DUE_DATE_COLUMNS, targetField: 'due_date', transform: 'date' },
      { sourceColumns: STATUS_COLUMNS, targetField: 'status', transform: 'status' },
      { sourceColumns: DESCRIPTION_COLUMNS, targetField: 'description', transform: 'text' },
      { sourceColumns: INVOICE_CODE_COLUMNS, targetField: 'lytex_invoice_id', transform: 'text' },
      { sourceColumns: EMAIL_COLUMNS, targetField: 'email', transform: 'text' },
      { sourceColumns: PHONE_COLUMNS, targetField: 'phone', transform: 'phone' },
    ],
    outputType: 'contributions',
  },
  
  overdue: {
    name: 'Relatório de Inadimplência',
    description: 'Contribuições vencidas/atrasadas',
    detectionColumns: ['cnpj', 'valor', 'vencimento', 'dias_atraso'],
    minMatchScore: 3,
    fields: [
      { sourceColumns: CNPJ_COLUMNS, targetField: 'cnpj', transform: 'cpfcnpj' },
      { sourceColumns: NAME_COLUMNS, targetField: 'name', transform: 'text' },
      { sourceColumns: VALUE_COLUMNS, targetField: 'value', transform: 'currency' },
      { sourceColumns: DUE_DATE_COLUMNS, targetField: 'due_date', transform: 'date' },
      { sourceColumns: COMPETENCE_COLUMNS, targetField: 'competence', transform: 'competence' },
      { sourceColumns: ['dias_atraso', 'DIAS_ATRASO', 'atraso', 'ATRASO'], targetField: 'days_overdue', transform: 'text' },
      { sourceColumns: TYPE_COLUMNS, targetField: 'contribution_type', transform: 'text' },
    ],
    outputType: 'contributions',
  },
};

/**
 * Detect which Lytex layout best matches the given columns
 */
export function detectLytexLayout(columns: string[]): { layout: LytexLayout; key: string; score: number } | null {
  const normalizedColumns = columns.map(c => c.toLowerCase().trim().replace(/[\s_-]+/g, '_'));
  
  let bestMatch: { layout: LytexLayout; key: string; score: number } | null = null;
  
  for (const [key, layout] of Object.entries(LYTEX_LAYOUTS)) {
    let score = 0;
    
    for (const detectionCol of layout.detectionColumns) {
      const normalizedDetection = detectionCol.toLowerCase().replace(/[\s_-]+/g, '_');
      
      // Check if any column contains this detection keyword
      const found = normalizedColumns.some(col => 
        col.includes(normalizedDetection) || normalizedDetection.includes(col)
      );
      
      if (found) score++;
    }
    
    if (score >= layout.minMatchScore && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { layout, key, score };
    }
  }
  
  return bestMatch;
}

/**
 * Get all fields from a layout that can map to the given columns
 */
export function getLayoutMappings(
  layout: LytexLayout,
  columns: string[]
): { sourceColumn: string; targetField: string; transform?: string }[] {
  const mappings: { sourceColumn: string; targetField: string; transform?: string }[] = [];
  const normalizedColumns = columns.map(c => c.toLowerCase().trim());
  
  for (const field of layout.fields) {
    // Find the first matching source column
    for (const sourceCol of field.sourceColumns) {
      const normalizedSource = sourceCol.toLowerCase().trim();
      const columnIndex = normalizedColumns.findIndex(c => 
        c === normalizedSource || 
        c.includes(normalizedSource) || 
        normalizedSource.includes(c)
      );
      
      if (columnIndex !== -1) {
        mappings.push({
          sourceColumn: columns[columnIndex],
          targetField: field.targetField,
          transform: field.transform,
        });
        break;
      }
    }
  }
  
  return mappings;
}

/**
 * Get the target field label for display
 */
export function getTargetFieldLabel(targetField: string): string {
  const labels: Record<string, string> = {
    cnpj: 'CNPJ',
    cpf: 'CPF',
    name: 'Nome/Razão Social',
    value: 'Valor',
    due_date: 'Vencimento',
    payment_date: 'Data Pagamento',
    status: 'Status',
    competence: 'Competência',
    contribution_type: 'Tipo Contribuição',
    description: 'Descrição',
    email: 'Email',
    phone: 'Telefone',
    address: 'Endereço',
    city: 'Cidade',
    state: 'UF',
    date: 'Data',
    type: 'Tipo',
    days_overdue: 'Dias em Atraso',
    lytex_invoice_id: 'Cód. Fatura Lytex',
  };
  
  return labels[targetField] || targetField;
}

/**
 * Get the conversion type to use for the import based on the layout
 */
export function getConversionType(layout: LytexLayout, layoutKey: string): string {
  // Check if it's an individual (CPF) layout - both simple and full Lytex report
  if (layoutKey === 'payments_individual' || layoutKey === 'lytex_individual_full') {
    return 'contributions_individual_paid';
  }
  
  // Check if it's a payments layout
  if (layoutKey === 'payments') {
    return 'contributions_paid';
  }
  
  // Default based on output type
  switch (layout.outputType) {
    case 'contributions':
      return 'contributions_pending';
    case 'employers':
      return 'lytex_clients';
    case 'financial':
      return 'financial';
    default:
      return 'contributions_pending';
  }
}
