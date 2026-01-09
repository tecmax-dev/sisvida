import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Upload,
  FileJson,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  PlayCircle,
  Search,
  Download,
  Copy,
  Database,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface JsonImportPanelProps {
  clinicId: string;
  clinicName: string;
}

interface ValidationResult {
  success: boolean;
  mode: "dry_run" | "import";
  validation: {
    valid: boolean;
    errors: string[];
    warnings: string[];
  };
  summary: Record<string, { total: number; imported: number; skipped: number; errors: number }>;
  mapping_stats: {
    by_old_id: number;
    by_legacy_id: number;
  };
  details: { table: string; action: string; count: number }[];
}

interface BackupPayload {
  version: string;
  clinic_name: string;
  clinic_slug: string;
  backup_date: string;
  record_counts: Record<string, number>;
  errors: string[];
  data: Record<string, any[]>;
}

export function JsonImportPanel({ clinicId, clinicName }: JsonImportPanelProps) {
  const [payload, setPayload] = useState<BackupPayload | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [fileSize, setFileSize] = useState<number>(0);
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [importResult, setImportResult] = useState<ValidationResult | null>(null);
  const [progress, setProgress] = useState(0);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".json")) {
      toast.error("Por favor, selecione um arquivo .json");
      return;
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as BackupPayload;
      
      // Basic client-side validation
      if (!parsed.version) {
        toast.error("Arquivo inválido: campo 'version' não encontrado");
        return;
      }
      
      if (!parsed.data || typeof parsed.data !== "object") {
        toast.error("Arquivo inválido: campo 'data' não encontrado ou inválido");
        return;
      }

      setPayload(parsed);
      setFileName(file.name);
      setFileSize(file.size);
      setValidationResult(null);
      setImportResult(null);
      
      const tableCount = Object.keys(parsed.data).filter(k => 
        Array.isArray(parsed.data[k]) && parsed.data[k].length > 0
      ).length;
      
      const totalRecords = Object.values(parsed.data)
        .filter(Array.isArray)
        .reduce((acc, arr) => acc + arr.length, 0);
      
      toast.success(`Arquivo carregado: ${tableCount} tabelas, ${totalRecords} registros`);
    } catch (error) {
      console.error("Error parsing JSON:", error);
      toast.error("Erro ao ler arquivo JSON. Verifique o formato.");
    }
    
    event.target.value = "";
  }, []);

  const runDryRun = async () => {
    if (!payload) {
      toast.error("Carregue um arquivo primeiro");
      return;
    }

    setIsValidating(true);
    setProgress(0);
    
    try {
      const { data, error } = await supabase.functions.invoke("clinic-json-import", {
        body: {
          clinic_id: clinicId,
          mode: "dry_run",
          payload,
        },
      });

      if (error) {
        console.error("Dry run error:", error);
        toast.error(`Erro na validação: ${error.message}`);
        return;
      }

      setValidationResult(data);
      setProgress(100);
      
      if (data.validation?.valid && data.validation?.errors?.length === 0) {
        toast.success("Validação concluída sem erros");
      } else if (data.validation?.errors?.length > 0) {
        toast.error(`Validação encontrou ${data.validation.errors.length} erro(s)`);
      } else {
        toast.warning(`Validação concluída com ${data.validation?.warnings?.length || 0} aviso(s)`);
      }
    } catch (err) {
      console.error("Dry run exception:", err);
      toast.error("Erro ao validar arquivo");
    } finally {
      setIsValidating(false);
    }
  };

  const runImport = async () => {
    if (!payload) {
      toast.error("Carregue um arquivo primeiro");
      return;
    }

    if (!validationResult) {
      toast.error("Execute a validação primeiro");
      return;
    }

    if (validationResult.validation?.errors?.length > 0) {
      toast.error("Corrija os erros antes de importar");
      return;
    }

    setIsImporting(true);
    setProgress(0);
    
    try {
      // Create import log
      const { data: logData } = await supabase
        .from("import_logs")
        .insert({
          clinic_id: clinicId,
          import_type: "json_backup_v1",
          file_name: fileName,
          status: "in_progress",
        })
        .select("id")
        .single();

      const logId = logData?.id;

      const { data, error } = await supabase.functions.invoke("clinic-json-import", {
        body: {
          clinic_id: clinicId,
          mode: "import",
          payload,
        },
      });

      if (error) {
        console.error("Import error:", error);
        toast.error(`Erro na importação: ${error.message}`);
        
        if (logId) {
          await supabase
            .from("import_logs")
            .update({ status: "failed", error_details: { message: error.message } })
            .eq("id", logId);
        }
        return;
      }

      setImportResult(data);
      setProgress(100);

      // Calculate totals with proper typing
      const summaryValues = Object.values(data.summary || {}) as Array<{ total?: number; imported?: number; errors?: number }>;
      const totalImported = summaryValues.reduce((acc, s) => acc + (s.imported || 0), 0);
      const totalErrors = summaryValues.reduce((acc, s) => acc + (s.errors || 0), 0);
      const totalRows = summaryValues.reduce((acc, s) => acc + (s.total || 0), 0);

      // Update import log
      if (logId) {
        await supabase
          .from("import_logs")
          .update({
            status: data.success ? "completed" : "failed",
            success_count: totalImported,
            error_count: totalErrors,
            total_rows: totalRows,
            completed_at: new Date().toISOString(),
          })
          .eq("id", logId);
      }
      
      if (data.success) {
        toast.success(`Importação concluída: ${totalImported} registros importados`);
      } else {
        toast.warning(`Importação parcial: ${totalImported} importados, ${totalErrors} erros`);
      }
    } catch (err) {
      console.error("Import exception:", err);
      toast.error("Erro ao importar arquivo");
    } finally {
      setIsImporting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado para a área de transferência");
  };

  const getTableLabel = (table: string): string => {
    const labels: Record<string, string> = {
      patients: "Pacientes",
      employers: "Empresas",
      professionals: "Profissionais",
      appointments: "Agendamentos",
      medical_records: "Prontuários",
      patient_dependents: "Dependentes",
      patient_cards: "Carteirinhas",
      accounting_offices: "Escritórios",
      employer_contributions: "Contribuições",
      procedures: "Procedimentos",
      insurance_plans: "Convênios",
      contribution_types: "Tipos Contrib.",
      specialties: "Especialidades",
      anamnese_templates: "Templates Anamnese",
      access_groups: "Grupos Acesso",
    };
    return labels[table] || table;
  };

  const activeResult = importResult || validationResult;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FileJson className="h-5 w-5" />
          Importar JSON (Backup v1.0)
        </CardTitle>
        <CardDescription>
          Importe dados de um arquivo JSON gerado pelo backup do sistema
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload Section */}
        <div className="flex flex-wrap gap-3 items-center">
          <label>
            <input
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="hidden"
              disabled={isValidating || isImporting}
            />
            <Button
              variant="outline"
              className="gap-2"
              disabled={isValidating || isImporting}
              asChild
            >
              <span>
                <Upload className="h-4 w-4" />
                Carregar JSON
              </span>
            </Button>
          </label>

          {payload && (
            <>
              <Button
                variant="secondary"
                className="gap-2"
                onClick={runDryRun}
                disabled={isValidating || isImporting}
              >
                {isValidating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                Validar (Dry-run)
              </Button>

              <Button
                variant="default"
                className="gap-2"
                onClick={runImport}
                disabled={isImporting || isValidating || !validationResult || (validationResult.validation?.errors?.length || 0) > 0}
              >
                {isImporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <PlayCircle className="h-4 w-4" />
                )}
                Importar
              </Button>
            </>
          )}
        </div>

        {/* File Info */}
        {payload && (
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="gap-1">
                <FileJson className="h-3 w-3" />
                {fileName}
              </Badge>
              <Badge variant="secondary">
                {fileSize < 1024 
                  ? `${fileSize} B`
                  : fileSize < 1048576
                  ? `${(fileSize / 1024).toFixed(1)} KB`
                  : `${(fileSize / 1048576).toFixed(2)} MB`
                }
              </Badge>
              <Badge variant="secondary">v{payload.version}</Badge>
              {payload.clinic_name && (
                <Badge variant="outline">{payload.clinic_name}</Badge>
              )}
              {payload.backup_date && (
                <Badge variant="outline">
                  {new Date(payload.backup_date).toLocaleDateString("pt-BR")}
                </Badge>
              )}
            </div>

            {/* Record Counts */}
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {Object.entries(payload.record_counts || {})
                .filter(([_, count]) => count > 0)
                .map(([table, count]) => (
                  <div key={table} className="text-center p-2 bg-background rounded border">
                    <div className="text-lg font-semibold">{count}</div>
                    <div className="text-xs text-muted-foreground">{getTableLabel(table)}</div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Progress */}
        {(isValidating || isImporting) && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>{isValidating ? "Validando..." : "Importando..."}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} />
          </div>
        )}

        {/* Results */}
        {activeResult && (
          <div className="space-y-4">
            <Separator />
            
            {/* Status Header */}
            <div className="flex items-center gap-2">
              {activeResult.success ? (
                <CheckCircle2 className="h-5 w-5 text-success" />
              ) : activeResult.validation?.errors?.length > 0 ? (
                <AlertCircle className="h-5 w-5 text-destructive" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-warning" />
              )}
              <span className="font-medium">
                {activeResult.mode === "dry_run" ? "Resultado da Validação" : "Resultado da Importação"}
              </span>
              <Badge variant={activeResult.success ? "default" : "destructive"}>
                {activeResult.success ? "Sucesso" : "Com Erros"}
              </Badge>
            </div>

            {/* Errors */}
            {activeResult.validation?.errors?.length > 0 && (
              <Collapsible defaultOpen>
                <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {activeResult.validation.errors.length} Erro(s)
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <ScrollArea className="h-32 mt-2 border rounded p-2 bg-destructive/5">
                    {activeResult.validation.errors.map((err, i) => (
                      <div key={i} className="text-sm text-destructive py-1">
                        • {err}
                      </div>
                    ))}
                  </ScrollArea>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 gap-1"
                    onClick={() => copyToClipboard(activeResult.validation.errors.join("\n"))}
                  >
                    <Copy className="h-3 w-3" />
                    Copiar erros
                  </Button>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Warnings */}
            {activeResult.validation?.warnings?.length > 0 && (
              <Collapsible>
                <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-warning">
                  <AlertTriangle className="h-4 w-4" />
                  {activeResult.validation.warnings.length} Aviso(s)
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <ScrollArea className="h-32 mt-2 border rounded p-2 bg-warning/5">
                    {activeResult.validation.warnings.map((warn, i) => (
                      <div key={i} className="text-sm text-warning py-1">
                        • {warn}
                      </div>
                    ))}
                  </ScrollArea>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 gap-1"
                    onClick={() => copyToClipboard(activeResult.validation.warnings.join("\n"))}
                  >
                    <Copy className="h-3 w-3" />
                    Copiar avisos
                  </Button>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Summary Table */}
            {Object.keys(activeResult.summary || {}).length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tabela</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Importados</TableHead>
                      <TableHead className="text-right">Ignorados</TableHead>
                      <TableHead className="text-right">Erros</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(activeResult.summary).map(([table, stats]) => (
                      <TableRow key={table}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Database className="h-4 w-4 text-muted-foreground" />
                            {getTableLabel(table)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{stats.total}</TableCell>
                        <TableCell className="text-right text-success">{stats.imported}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{stats.skipped}</TableCell>
                        <TableCell className="text-right text-destructive">{stats.errors}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Mapping Stats */}
            {activeResult.mode === "import" && (
              <div className="flex gap-4 text-sm text-muted-foreground">
                <span>Mapeamentos por ID original: <strong>{activeResult.mapping_stats.by_old_id}</strong></span>
                <span>Mapeamentos por legacy_id: <strong>{activeResult.mapping_stats.by_legacy_id}</strong></span>
              </div>
            )}
          </div>
        )}

        {/* Instructions */}
        <div className="bg-muted/50 rounded-lg p-4">
          <h4 className="font-medium text-sm mb-2">Como funciona:</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Carregue um arquivo <strong>.json</strong> gerado pelo backup do sistema</li>
            <li>• Execute a <strong>Validação (Dry-run)</strong> para verificar erros antes de importar</li>
            <li>• Se não houver erros críticos, clique em <strong>Importar</strong></li>
            <li>• O sistema mapeia automaticamente IDs antigos para novos IDs</li>
            <li>• Campos como <code>id</code>, <code>created_at</code>, <code>clinic_id</code> são gerados automaticamente</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
