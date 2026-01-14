import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle, 
  FileWarning,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ConversionType } from "./ConversionTypeStep";
import { 
  validateRow, 
  validateAllRows, 
  getFieldLabel,
  ConversionType as ValidatorConversionType,
} from "@/lib/spreadsheet-converter/validators";
import {
  normalizeCpfCnpj,
  parseDate,
  parseCurrency,
  normalizeText,
  identifyStatus,
  formatDateBR,
  formatCurrencyBR,
  extractCompetence,
  formatCompetence,
} from "@/lib/spreadsheet-converter/normalizers";

interface FieldMapping {
  sourceColumn: string;
  targetField: string;
  transform?: string;
}

interface ValidationStepProps {
  rows: Record<string, unknown>[];
  mappings: FieldMapping[];
  conversionType: ConversionType;
  onValidationComplete: (validRows: Record<string, unknown>[], invalidRows: number) => void;
}

// Map UI conversion type to validator type
function mapConversionType(type: ConversionType): ValidatorConversionType {
  const mapping: Record<ConversionType, ValidatorConversionType> = {
    contributions_paid: 'contributions_paid',
    contributions_pending: 'contributions_pending',
    contributions_cancelled: 'contributions_cancelled',
    contributions_individual: 'contributions_paid', // Use same validator
    contributions_individual_paid: 'contributions_paid', // Use same validator
    cadastro_pf: 'cadastro_pf',
    cadastro_pj: 'cadastro_pj',
    cadastro_fornecedores: 'cadastro_fornecedores',
    lytex: 'lytex_invoices',
  };
  return mapping[type];
}

export function ValidationStep({
  rows,
  mappings,
  conversionType,
  onValidationComplete,
}: ValidationStepProps) {
  // Transform rows according to mappings
  const transformedRows = useMemo(() => {
    return rows.map(row => {
      const transformed: Record<string, unknown> = {};
      
      for (const mapping of mappings) {
        const sourceValue = row[mapping.sourceColumn];
        let targetValue: unknown = sourceValue;
        
        // Apply transformations
        switch (mapping.transform) {
          case 'cpfcnpj':
            const cpfCnpjResult = normalizeCpfCnpj(sourceValue);
            targetValue = cpfCnpjResult.value;
            break;
          case 'date':
            targetValue = parseDate(sourceValue);
            break;
          case 'currency':
            targetValue = parseCurrency(sourceValue);
            break;
          case 'status':
            targetValue = identifyStatus(sourceValue);
            break;
          case 'competence':
            const comp = extractCompetence(sourceValue);
            targetValue = comp ? formatCompetence(comp.month, comp.year) : sourceValue;
            break;
          case 'text':
            targetValue = normalizeText(sourceValue, { titleCase: true });
            break;
          case 'phone':
            targetValue = String(sourceValue || '').replace(/\D/g, '');
            break;
        }
        
        transformed[mapping.targetField] = targetValue;
      }
      
      return transformed;
    });
  }, [rows, mappings]);

  // Validate all rows
  const validationResult = useMemo(() => {
    const validatorType = mapConversionType(conversionType);
    return validateAllRows(transformedRows, validatorType);
  }, [transformedRows, conversionType]);

  // Notify parent
  useMemo(() => {
    onValidationComplete(validationResult.validRows, validationResult.totalInvalid);
  }, [validationResult, onValidationComplete]);

  const exportErrors = () => {
    const errorData = validationResult.invalidRows.map(({ row, validation }) => ({
      linha: validation.row,
      ...row,
      erros: validation.errors.map(e => `${e.field}: ${e.message}`).join('; '),
    }));
    
    const blob = new Blob([JSON.stringify(errorData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'erros_validacao.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">Validação dos Dados</h3>
        <p className="text-sm text-muted-foreground">
          Verifique os dados convertidos e corrija erros antes de prosseguir
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <FileWarning className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{transformedRows.length}</p>
                <p className="text-sm text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/20">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{validationResult.totalValid}</p>
                <p className="text-sm text-muted-foreground">Válidos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/20">
                <AlertCircle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">{validationResult.totalInvalid}</p>
                <p className="text-sm text-muted-foreground">Com Erros</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/20">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-600">{validationResult.totalWarnings}</p>
                <p className="text-sm text-muted-foreground">Avisos</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Error Summary by Field */}
      {Object.keys(validationResult.errorsByField).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resumo de Erros por Campo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(validationResult.errorsByField)
                .sort((a, b) => b[1] - a[1])
                .map(([field, count]) => (
                  <Badge key={field} variant="destructive" className="text-sm">
                    {getFieldLabel(field)}: {count}
                  </Badge>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invalid Rows Detail */}
      {validationResult.invalidRows.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Linhas com Erros</CardTitle>
              <CardDescription>
                Revise e corrija os dados antes de continuar
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={exportErrors}>
              <Download className="h-4 w-4 mr-2" />
              Exportar Erros
            </Button>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Linha</TableHead>
                    <TableHead>Dados</TableHead>
                    <TableHead>Erros</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {validationResult.invalidRows.slice(0, 50).map(({ row, validation }) => (
                    <TableRow key={validation.row} className="bg-red-500/5">
                      <TableCell className="font-mono">{validation.row}</TableCell>
                      <TableCell className="max-w-[300px]">
                        <div className="text-xs text-muted-foreground truncate">
                          {Object.entries(row)
                            .slice(0, 3)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(' | ')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {validation.errors.map((error, i) => (
                            <Badge key={i} variant="destructive" className="text-xs">
                              {error.field}: {error.message}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {validationResult.invalidRows.length > 50 && (
                <p className="text-center text-sm text-muted-foreground mt-4">
                  + {validationResult.invalidRows.length - 50} linhas com erros não exibidas
                </p>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Valid Rows Preview */}
      {validationResult.validRows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              Dados Válidos para Conversão
            </CardTitle>
            <CardDescription>
              Preview dos primeiros {Math.min(10, validationResult.validRows.length)} registros convertidos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    {mappings.map(m => (
                      <TableHead key={m.targetField}>{getFieldLabel(m.targetField)}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {validationResult.validRows.slice(0, 10).map((row, index) => (
                    <TableRow key={index}>
                      {mappings.map(m => (
                        <TableCell key={m.targetField} className="max-w-[150px] truncate">
                          {formatCellForDisplay(row[m.targetField], m.transform)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function formatCellForDisplay(value: unknown, transform?: string): string {
  if (value === null || value === undefined) return '-';
  
  switch (transform) {
    case 'currency':
      return formatCurrencyBR(Number(value) || 0);
    case 'date':
      return value ? formatDateBR(String(value)) : '-';
    case 'cpfcnpj':
      const result = normalizeCpfCnpj(value);
      return result.formatted || String(value);
    default:
      const str = String(value);
      return str.length > 30 ? str.slice(0, 27) + '...' : str;
  }
}
