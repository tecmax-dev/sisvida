import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Wand2 } from "lucide-react";
import { FieldMapper } from "./FieldMapper";
import { ConversionType, ConversionSubType } from "./ConversionTypeStep";
import { 
  LYTEX_LAYOUTS, 
  detectLytexLayout, 
  getLayoutMappings,
  getTargetFieldLabel,
} from "@/lib/spreadsheet-converter/lytex-layouts";

interface FieldMapping {
  sourceColumn: string;
  targetField: string;
  transform?: string;
}

interface MappingStepProps {
  headers: string[];
  conversionType: ConversionType;
  conversionSubType?: ConversionSubType | null;
  mappings: FieldMapping[];
  onMappingsChange: (mappings: FieldMapping[]) => void;
}

// Target fields by conversion type
const TARGET_FIELDS: Record<ConversionType, { key: string; label: string; required?: boolean }[]> = {
  contributions_paid: [
    { key: 'cnpj', label: 'CNPJ da Empresa', required: true },
    { key: 'name', label: 'Razão Social' },
    { key: 'value', label: 'Valor', required: true },
    { key: 'payment_date', label: 'Data Pagamento', required: true },
    { key: 'due_date', label: 'Vencimento' },
    { key: 'competence', label: 'Competência' },
    { key: 'contribution_type', label: 'Tipo Contribuição' },
    { key: 'description', label: 'Descrição' },
  ],
  contributions_pending: [
    { key: 'cnpj', label: 'CNPJ da Empresa', required: true },
    { key: 'name', label: 'Razão Social' },
    { key: 'value', label: 'Valor', required: true },
    { key: 'due_date', label: 'Vencimento', required: true },
    { key: 'competence', label: 'Competência' },
    { key: 'contribution_type', label: 'Tipo Contribuição' },
    { key: 'description', label: 'Descrição' },
  ],
  contributions_cancelled: [
    { key: 'cnpj', label: 'CNPJ da Empresa', required: true },
    { key: 'name', label: 'Razão Social' },
    { key: 'value', label: 'Valor', required: true },
    { key: 'due_date', label: 'Vencimento' },
    { key: 'competence', label: 'Competência' },
    { key: 'contribution_type', label: 'Tipo Contribuição' },
    { key: 'cancellation_reason', label: 'Motivo Cancelamento' },
  ],
  cadastro_pf: [
    { key: 'name', label: 'Nome Completo', required: true },
    { key: 'cpf', label: 'CPF', required: true },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Telefone' },
    { key: 'birth_date', label: 'Data Nascimento' },
    { key: 'address', label: 'Endereço' },
    { key: 'city', label: 'Cidade' },
    { key: 'state', label: 'UF' },
    { key: 'cep', label: 'CEP' },
  ],
  cadastro_pj: [
    { key: 'cnpj', label: 'CNPJ', required: true },
    { key: 'name', label: 'Razão Social', required: true },
    { key: 'trade_name', label: 'Nome Fantasia' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Telefone' },
    { key: 'address', label: 'Endereço' },
    { key: 'city', label: 'Cidade' },
    { key: 'state', label: 'UF' },
    { key: 'cep', label: 'CEP' },
    { key: 'segment', label: 'Segmento' },
  ],
  lytex: [], // Will be populated dynamically based on detected layout
};

export function MappingStep({
  headers,
  conversionType,
  conversionSubType,
  mappings,
  onMappingsChange,
}: MappingStepProps) {
  // For Lytex type, detect layout and get appropriate fields
  const { targetFields, autoDetectedMappings, detectedLayout } = useMemo(() => {
    // Protection against invalid headers
    if (!headers || headers.length === 0) {
      return {
        targetFields: TARGET_FIELDS[conversionType] || [],
        autoDetectedMappings: [],
        detectedLayout: null,
      };
    }

    try {
      if (conversionType === 'lytex') {
      // Try to detect layout from headers
      const detection = detectLytexLayout(headers);
      
      if (detection) {
        const layoutMappings = getLayoutMappings(detection.layout, headers);
        const fields = detection.layout.fields.map(f => ({
          key: f.targetField,
          label: getTargetFieldLabel(f.targetField),
          required: ['cnpj', 'value', 'due_date', 'name'].includes(f.targetField),
        }));
        
        return {
          targetFields: fields,
          autoDetectedMappings: layoutMappings,
          detectedLayout: detection,
        };
      }
      
      // If subtype is specified, use that layout
      if (conversionSubType && LYTEX_LAYOUTS[conversionSubType]) {
        const layout = LYTEX_LAYOUTS[conversionSubType];
        const layoutMappings = getLayoutMappings(layout, headers);
        const fields = layout.fields.map(f => ({
          key: f.targetField,
          label: getTargetFieldLabel(f.targetField),
          required: ['cnpj', 'value', 'due_date', 'name'].includes(f.targetField),
        }));
        
        return {
          targetFields: fields,
          autoDetectedMappings: layoutMappings,
          detectedLayout: { layout, key: conversionSubType, score: 0 },
        };
      }
      
      // Default to invoices layout
      const defaultLayout = LYTEX_LAYOUTS.invoices;
      const layoutMappings = getLayoutMappings(defaultLayout, headers);
      const fields = defaultLayout.fields.map(f => ({
        key: f.targetField,
        label: getTargetFieldLabel(f.targetField),
        required: ['cnpj', 'value', 'due_date'].includes(f.targetField),
      }));
      
      return {
        targetFields: fields,
        autoDetectedMappings: layoutMappings,
        detectedLayout: null,
      };
    }
    
    // For non-Lytex types, use predefined fields and auto-detect common mappings
    const fields = TARGET_FIELDS[conversionType] || [];
    const autoMappings: FieldMapping[] = [];
    
    // Simple auto-detection for common field names
    const commonMappings: Record<string, string[]> = {
      cnpj: ['cnpj', 'CNPJ', 'cnpj_cpf', 'documento'],
      cpf: ['cpf', 'CPF', 'documento'],
      name: ['nome', 'NOME', 'razao_social', 'Razão Social', 'name', 'empresas', 'EMPRESAS'],
      trade_name: ['fantasia', 'FANTASIA', 'nome_fantasia', 'NOME_FANTASIA'],
      value: ['valor', 'VALOR', 'value', 'total', 'montante'],
      due_date: ['vencimento', 'VENCIMENTO', 'dt_vencimento', 'data_vencimento'],
      payment_date: ['data_pagamento', 'DATA_PAGAMENTO', 'pagamento', 'dt_pagamento', 'pago_em', 'PAGO_EM'],
      email: ['email', 'EMAIL', 'e-mail'],
      phone: ['telefone', 'TELEFONE', 'fone', 'celular'],
      competence: ['competencia', 'COMPETENCIA', 'competência', 'COMPETÊNCIA', 'referencia', 'REFERENCIA'],
      contribution_type: ['tipo', 'TIPO', 'tipo_contribuicao', 'TIPO_CONTRIBUICAO'],
      description: [
        'descricao', 'DESCRICAO', 'descrição', 'DESCRIÇÃO', 'description', 
        'obs', 'OBS', 'observacao', 'OBSERVACAO', 'observações', 'observacoes',
        'notas', 'NOTAS', 'notes', 'historico', 'histórico', 'detalhes', 'details',
        'comentario', 'comentário', 'informacao', 'informação', 'info'
      ],
      status: ['situacao', 'SITUACAO', 'situação', 'SITUAÇÃO', 'status', 'STATUS'],
    };
    
    for (const field of fields) {
      const possibleColumns = commonMappings[field.key] || [];
      const matchedColumn = headers.find(h => 
        possibleColumns.some(p => h.toLowerCase() === p.toLowerCase())
      );
      
      if (matchedColumn) {
        autoMappings.push({ sourceColumn: matchedColumn, targetField: field.key });
      }
    }
    
      return {
        targetFields: fields,
        autoDetectedMappings: autoMappings,
        detectedLayout: null,
      };
    } catch (error) {
      console.error('Error in MappingStep useMemo:', error);
      return {
        targetFields: TARGET_FIELDS[conversionType] || [],
        autoDetectedMappings: [],
        detectedLayout: null,
      };
    }
  }, [conversionType, conversionSubType, headers]);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">Mapeamento de Campos</h3>
        <p className="text-sm text-muted-foreground">
          Configure a correspondência entre as colunas da planilha e os campos do sistema
        </p>
      </div>

      {detectedLayout && (
        <Card className="bg-emerald-500/10 border-emerald-500/30">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Wand2 className="h-4 w-4 text-emerald-500" />
              <span className="text-sm">
                Layout Lytex detectado: <strong>{detectedLayout.layout.name}</strong>
              </span>
              <Badge variant="secondary" className="ml-auto">
                {autoDetectedMappings.length} campos mapeados automaticamente
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <span>Colunas da Planilha</span>
            <ArrowRight className="h-4 w-4" />
            <span>Campos do Sistema</span>
          </CardTitle>
          <CardDescription>
            Arraste ou selecione para mapear cada coluna ao campo correspondente
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldMapper
            sourceColumns={headers}
            targetFields={targetFields}
            mappings={mappings}
            onMappingsChange={onMappingsChange}
            autoDetectedMappings={autoDetectedMappings}
          />
        </CardContent>
      </Card>
    </div>
  );
}
