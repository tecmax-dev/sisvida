import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wand2, FileSpreadsheet, ArrowRight, CheckCircle2 } from "lucide-react";
import { PreviewTable } from "./PreviewTable";
import { 
  LYTEX_LAYOUTS, 
  detectLytexLayout, 
  getLayoutMappings,
  getTargetFieldLabel,
  LytexLayout,
} from "@/lib/spreadsheet-converter/lytex-layouts";
import {
  normalizeCpfCnpj,
  parseDate,
  parseCurrency,
  normalizeText,
  identifyStatus,
  extractCompetence,
  formatCompetence,
} from "@/lib/spreadsheet-converter/normalizers";

interface LytexConverterTabProps {
  headers: string[];
  rows: Record<string, unknown>[];
  onConvert: (convertedRows: Record<string, unknown>[], layout: LytexLayout, layoutKey: string) => void;
}

export function LytexConverterTab({ headers, rows, onConvert }: LytexConverterTabProps) {
  // Detect layout
  const detection = useMemo(() => {
    if (headers.length === 0) return null;
    return detectLytexLayout(headers);
  }, [headers]);

  // Get mappings for detected layout
  const mappings = useMemo(() => {
    if (!detection) return [];
    return getLayoutMappings(detection.layout, headers);
  }, [detection, headers]);

  // Convert rows using detected layout
  const convertedRows = useMemo(() => {
    if (!detection || mappings.length === 0) return [];

    return rows.map(row => {
      const converted: Record<string, unknown> = {};

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

        converted[mapping.targetField] = targetValue;
      }

      return converted;
    });
  }, [rows, mappings, detection]);

  if (headers.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">
            Faça upload de uma planilha na etapa anterior para usar a conversão Lytex
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Detection Result */}
      {detection ? (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <Wand2 className="h-5 w-5 text-emerald-500" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-emerald-700">
                  Layout Detectado: {detection.layout.name}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {detection.layout.description}
                </p>
              </div>
              <Badge variant="secondary">
                Score: {detection.score}/{detection.layout.detectionColumns.length}
              </Badge>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="pt-4">
            <p className="text-yellow-700">
              Nenhum layout Lytex reconhecido automaticamente. 
              Selecione manualmente o tipo de relatório ou verifique as colunas da planilha.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Layout Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Layouts Disponíveis</CardTitle>
          <CardDescription>
            Selecione o tipo de relatório Lytex que deseja converter
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {Object.entries(LYTEX_LAYOUTS).map(([key, layout]) => {
              const isDetected = detection?.key === key;
              const layoutMappings = getLayoutMappings(layout, headers);
              
              return (
                <Card
                  key={key}
                  className={`cursor-pointer transition-all ${
                    isDetected 
                      ? 'ring-2 ring-emerald-500 border-emerald-500/50' 
                      : 'hover:border-primary/50'
                  }`}
                  onClick={() => {
                    if (layoutMappings.length > 0) {
                      const converted = rows.map(row => {
                        const result: Record<string, unknown> = {};
                        for (const mapping of layoutMappings) {
                          const sourceValue = row[mapping.sourceColumn];
                          let targetValue: unknown = sourceValue;

                          switch (mapping.transform) {
                            case 'cpfcnpj':
                              targetValue = normalizeCpfCnpj(sourceValue).value;
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
                          }

                          result[mapping.targetField] = targetValue;
                        }
                        return result;
                      });
                      onConvert(converted, layout, key);
                    }
                  }}
                >
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium">{layout.name}</h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          {layout.description}
                        </p>
                      </div>
                      {isDetected && (
                        <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                      )}
                    </div>
                    <div className="mt-3">
                      <Badge variant="outline" className="text-xs">
                        {layoutMappings.length} campos detectados
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Mapping Preview */}
      {detection && mappings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mapeamento Automático</CardTitle>
            <CardDescription>
              Correspondência entre colunas da planilha e campos do sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {mappings.map((mapping, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
                >
                  <Badge variant="outline">{mapping.sourceColumn}</Badge>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <Badge>{getTargetFieldLabel(mapping.targetField)}</Badge>
                  {mapping.transform && (
                    <Badge variant="secondary" className="text-xs">
                      {mapping.transform}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Converted Preview */}
      {convertedRows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preview da Conversão</CardTitle>
            <CardDescription>
              Primeiras linhas após a conversão automática
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PreviewTable
              headers={mappings.map(m => getTargetFieldLabel(m.targetField))}
              rows={convertedRows.slice(0, 10).map(row => {
                const displayRow: Record<string, unknown> = {};
                mappings.forEach(m => {
                  displayRow[getTargetFieldLabel(m.targetField)] = row[m.targetField];
                });
                return displayRow;
              })}
              maxRows={10}
            />
          </CardContent>
        </Card>
      )}

      {/* Convert Button */}
      {detection && convertedRows.length > 0 && (
        <div className="flex justify-end">
          <Button
            size="lg"
            onClick={() => onConvert(convertedRows, detection.layout, detection.key)}
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Converter {convertedRows.length} Registros
          </Button>
        </div>
      )}
    </div>
  );
}
