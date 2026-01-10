import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  CheckCircle2, 
  Download, 
  Copy, 
  Upload,
  FileSpreadsheet,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { ConversionType } from "./ConversionTypeStep";
import { formatCurrencyBR, formatDateBR } from "@/lib/spreadsheet-converter/normalizers";

interface FieldMapping {
  sourceColumn: string;
  targetField: string;
  transform?: string;
}

interface ConversionLog {
  userId: string;
  timestamp: Date;
  type: ConversionType;
  source: string;
  totalRecords: number;
  validRecords: number;
  errorRecords: number;
  action: 'download' | 'import' | 'copy' | 'cancel';
}

interface ResultStepProps {
  validRows: Record<string, unknown>[];
  invalidRowsCount: number;
  mappings: FieldMapping[];
  conversionType: ConversionType;
  fileName: string;
  onReset: () => void;
}

export function ResultStep({
  validRows,
  invalidRowsCount,
  mappings,
  conversionType,
  fileName,
  onReset,
}: ResultStepProps) {
  const [isExporting, setIsExporting] = useState(false);

  const downloadAsExcel = async () => {
    setIsExporting(true);
    try {
      // Create worksheet from data
      const wsData = validRows.map(row => {
        const exportRow: Record<string, unknown> = {};
        for (const mapping of mappings) {
          exportRow[mapping.targetField] = row[mapping.targetField];
        }
        return exportRow;
      });

      const ws = XLSX.utils.json_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Convertido');

      // Generate file name
      const timestamp = new Date().toISOString().slice(0, 10);
      const typeName = conversionType.replace(/_/g, '-');
      const exportFileName = `convertido_${typeName}_${timestamp}.xlsx`;

      XLSX.writeFile(wb, exportFileName);
      toast.success('Arquivo exportado com sucesso!');
      
      logConversion('download');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Erro ao exportar arquivo');
    } finally {
      setIsExporting(false);
    }
  };

  const downloadAsCSV = async () => {
    setIsExporting(true);
    try {
      const headers = mappings.map(m => m.targetField);
      const csvRows = [headers.join(';')];

      for (const row of validRows) {
        const values = mappings.map(m => {
          const val = row[m.targetField];
          if (val === null || val === undefined) return '';
          const str = String(val);
          // Escape quotes and wrap in quotes if contains separator
          if (str.includes(';') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        });
        csvRows.push(values.join(';'));
      }

      const csvContent = csvRows.join('\n');
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      const timestamp = new Date().toISOString().slice(0, 10);
      const typeName = conversionType.replace(/_/g, '-');
      const exportFileName = `convertido_${typeName}_${timestamp}.csv`;

      const a = document.createElement('a');
      a.href = url;
      a.download = exportFileName;
      a.click();

      URL.revokeObjectURL(url);
      toast.success('CSV exportado com sucesso!');
      
      logConversion('download');
    } catch (error) {
      console.error('CSV export error:', error);
      toast.error('Erro ao exportar CSV');
    } finally {
      setIsExporting(false);
    }
  };

  const downloadAsJSON = () => {
    const jsonData = validRows.map(row => {
      const exportRow: Record<string, unknown> = {};
      for (const mapping of mappings) {
        exportRow[mapping.targetField] = row[mapping.targetField];
      }
      return exportRow;
    });

    const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const timestamp = new Date().toISOString().slice(0, 10);
    const typeName = conversionType.replace(/_/g, '-');
    const exportFileName = `convertido_${typeName}_${timestamp}.json`;

    const a = document.createElement('a');
    a.href = url;
    a.download = exportFileName;
    a.click();

    URL.revokeObjectURL(url);
    toast.success('JSON exportado com sucesso!');
    
    logConversion('download');
  };

  const copyToClipboard = async () => {
    try {
      const jsonData = validRows.map(row => {
        const exportRow: Record<string, unknown> = {};
        for (const mapping of mappings) {
          exportRow[mapping.targetField] = row[mapping.targetField];
        }
        return exportRow;
      });

      await navigator.clipboard.writeText(JSON.stringify(jsonData, null, 2));
      toast.success('Dados copiados para a área de transferência!');
      
      logConversion('copy');
    } catch (error) {
      toast.error('Erro ao copiar dados');
    }
  };

  const logConversion = (action: 'download' | 'import' | 'copy' | 'cancel') => {
    const log: ConversionLog = {
      userId: 'current-user', // Would be populated from auth context
      timestamp: new Date(),
      type: conversionType,
      source: fileName,
      totalRecords: validRows.length + invalidRowsCount,
      validRecords: validRows.length,
      errorRecords: invalidRowsCount,
      action,
    };

    // Store in localStorage for now
    const existingLogs = JSON.parse(localStorage.getItem('conversion_logs') || '[]');
    existingLogs.push(log);
    localStorage.setItem('conversion_logs', JSON.stringify(existingLogs.slice(-100)));
  };

  const successRate = Math.round((validRows.length / (validRows.length + invalidRowsCount)) * 100) || 0;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">Conversão Concluída</h3>
        <p className="text-sm text-muted-foreground">
          Seus dados foram convertidos e estão prontos para exportação
        </p>
      </div>

      {/* Success Summary */}
      <Card className="border-green-500/30 bg-green-500/5">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-full bg-green-500/20">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
            <div className="flex-1">
              <h4 className="text-xl font-semibold text-green-600">
                {validRows.length} registros convertidos
              </h4>
              <p className="text-sm text-muted-foreground">
                Arquivo: {fileName}
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold">{successRate}%</p>
              <p className="text-sm text-muted-foreground">Taxa de sucesso</p>
            </div>
          </div>
          
          <Progress value={successRate} className="mt-4 h-2" />
          
          <div className="flex gap-4 mt-4 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>{validRows.length} válidos</span>
            </div>
            {invalidRowsCount > 0 && (
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <span>{invalidRowsCount} com erros</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Conversion Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detalhes da Conversão</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Tipo de Conversão</p>
              <Badge variant="secondary" className="mt-1">
                {conversionType.replace(/_/g, ' ')}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Campos Mapeados</p>
              <p className="font-medium">{mappings.length} campos</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Arquivo Original</p>
              <p className="font-medium truncate">{fileName}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Data/Hora</p>
              <p className="font-medium">{new Date().toLocaleString('pt-BR')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Export Options */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Download className="h-4 w-4" />
            Exportar Dados Convertidos
          </CardTitle>
          <CardDescription>
            Escolha o formato de exportação para os dados convertidos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-4">
            <Button
              variant="default"
              className="h-auto py-4 flex-col gap-2"
              onClick={downloadAsExcel}
              disabled={isExporting || validRows.length === 0}
            >
              <FileSpreadsheet className="h-6 w-6" />
              <span>Excel (.xlsx)</span>
            </Button>
            
            <Button
              variant="outline"
              className="h-auto py-4 flex-col gap-2"
              onClick={downloadAsCSV}
              disabled={isExporting || validRows.length === 0}
            >
              <FileSpreadsheet className="h-6 w-6" />
              <span>CSV (.csv)</span>
            </Button>
            
            <Button
              variant="outline"
              className="h-auto py-4 flex-col gap-2"
              onClick={downloadAsJSON}
              disabled={validRows.length === 0}
            >
              <Download className="h-6 w-6" />
              <span>JSON</span>
            </Button>
            
            <Button
              variant="outline"
              className="h-auto py-4 flex-col gap-2"
              onClick={copyToClipboard}
              disabled={validRows.length === 0}
            >
              <Copy className="h-6 w-6" />
              <span>Copiar JSON</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onReset}>
          Nova Conversão
        </Button>
      </div>
    </div>
  );
}
