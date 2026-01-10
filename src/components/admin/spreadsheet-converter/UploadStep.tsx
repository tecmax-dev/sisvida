import { useState, useCallback } from "react";
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
}

export function UploadStep({ onFileLoaded, currentFile }: UploadStepProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [preview, setPreview] = useState<{
    headers: string[];
    rows: Record<string, unknown>[];
    fileName: string;
    sheetNames: string[];
  } | null>(null);

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
      
      // Get first sheet
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      // Convert to JSON
      const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
        defval: '',
        raw: false,
      });

      if (jsonData.length === 0) {
        toast.error('Planilha vazia ou sem dados');
        return;
      }

      // Extract headers from first row keys
      const headers = Object.keys(jsonData[0] || {});

      const result = {
        headers,
        rows: jsonData,
        fileName: file.name,
        sheetNames: workbook.SheetNames,
      };

      setPreview(result);
      onFileLoaded(result);

      toast.success(`${jsonData.length} linhas carregadas de "${file.name}"`);
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
