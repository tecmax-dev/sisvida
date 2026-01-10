import React, { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileSpreadsheet, X, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { PreviewTable } from "./PreviewTable";

interface UploadStepProps {
  onFileLoaded: (data: {
    headers: string[];
    rows: Record<string, unknown>[];
    fileName: string;
    sheetNames: string[];
  }) => void;
  currentFile?: string;
  initialData?: {
    headers: string[];
    rows: Record<string, unknown>[];
    fileName: string;
    sheetNames: string[];
  } | null;
}

export function UploadStep({ onFileLoaded, currentFile, initialData }: UploadStepProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [preview, setPreview] = useState<{
    headers: string[];
    rows: Record<string, unknown>[];
    fileName: string;
    sheetNames: string[];
  } | null>(initialData || null);

  // Sync preview with initialData when component mounts or initialData changes
  React.useEffect(() => {
    if (initialData && !preview) {
      setPreview(initialData);
    }
  }, [initialData]);

  const processFile = useCallback(async (file: File) => {
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
    ];

    if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls|csv)$/i)) {
      toast.error('Formato inválido. Use .xlsx, .xls ou .csv');
      return;
    }

    setIsLoading(true);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      // Ler como array de arrays (sem tratamento automático de header)
      const rawData = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
        header: 1,
        defval: '',
        raw: false,
      }) as unknown[][];

      if (rawData.length === 0) {
        toast.error('Planilha vazia ou sem dados');
        return;
      }

      // Função para detectar se uma linha parece ser o cabeçalho real
      const isValidHeader = (row: unknown[]): boolean => {
        if (!row || row.length === 0) return false;
        const filledCells = row.filter(cell => 
          cell !== null && 
          cell !== undefined && 
          String(cell).trim() !== ''
        );
        return filledCells.length >= 3;
      };

      // Encontrar a linha de cabeçalho real (primeira linha válida sem __EMPTY)
      let headerRowIndex = 0;
      for (let i = 0; i < Math.min(rawData.length, 10); i++) {
        if (isValidHeader(rawData[i])) {
          const hasRealContent = rawData[i].some(cell => {
            const str = String(cell || '').trim();
            return str !== '' && !str.startsWith('__EMPTY');
          });
          if (hasRealContent) {
            headerRowIndex = i;
            break;
          }
        }
      }

      // Extrair headers da linha correta
      const headers = (rawData[headerRowIndex] as unknown[]).map((cell, idx) => {
        const value = String(cell || '').trim();
        return value || `Coluna_${idx + 1}`;
      });

      // Extrair dados (linhas após o header)
      const dataRows = rawData.slice(headerRowIndex + 1)
        .filter(row => row && row.some(cell => String(cell || '').trim() !== ''))
        .map(row => {
          const obj: Record<string, unknown> = {};
          headers.forEach((header, idx) => {
            obj[header] = row[idx] ?? '';
          });
          return obj;
        });

      if (dataRows.length === 0) {
        toast.error('Nenhum dado encontrado após os cabeçalhos');
        return;
      }

      const result = {
        headers,
        rows: dataRows,
        fileName: file.name,
        sheetNames: workbook.SheetNames,
      };

      setPreview(result);
      onFileLoaded(result);

      toast.success(
        `${dataRows.length} linhas carregadas de "${file.name}" ` +
        `(cabeçalho na linha ${headerRowIndex + 1})`
      );
    } catch (error) {
      console.error('Error processing file:', error);
      toast.error('Erro ao processar arquivo. Verifique o formato.');
    } finally {
      setIsLoading(false);
    }
  }, [onFileLoaded]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  }, [processFile]);

  const clearFile = () => {
    setPreview(null);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload de Planilha
          </CardTitle>
          <CardDescription>
            Arraste um arquivo ou clique para selecionar. Formatos aceitos: .xlsx, .xls, .csv
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!preview ? (
            <div
              className={`
                relative border-2 border-dashed rounded-lg p-12 text-center
                transition-colors cursor-pointer
                ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
              `}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById('file-input')?.click()}
            >
              <Input
                id="file-input"
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleFileInput}
                disabled={isLoading}
              />
              
              <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              
              {isLoading ? (
                <p className="text-muted-foreground">Processando arquivo...</p>
              ) : (
                <>
                  <p className="text-lg font-medium mb-1">
                    {isDragging ? 'Solte o arquivo aqui' : 'Arraste o arquivo aqui'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    ou clique para selecionar
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-medium">{preview.fileName}</p>
                    <p className="text-sm text-muted-foreground">
                      {preview.rows.length} linhas • {preview.headers.length} colunas
                      {preview.sheetNames.length > 1 && ` • ${preview.sheetNames.length} abas`}
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={clearFile}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {preview && (
        <Card>
          <CardHeader>
            <CardTitle>Pré-visualização</CardTitle>
            <CardDescription>
              Primeiras linhas do arquivo carregado
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PreviewTable
              headers={preview.headers}
              rows={preview.rows}
              maxRows={10}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
