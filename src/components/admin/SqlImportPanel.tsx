import { useState, useRef } from "react";
import { runSqlImportBatched } from "@/lib/sqlImport/batchedSqlImport";
import { analyzeSqlDump } from "@/lib/sqlImport/analyzeSqlDump";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Upload,
  Database,
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Play,
  Eye,
  Trash2,
  Users,
  ArrowRight,
} from "lucide-react";


interface ImportDetail {
  table: string;
  operation: string;
  status: "success" | "error" | "skipped";
  message?: string;
}

interface ImportResult {
  success: boolean;
  executed: number;
  errors: string[];
  skipped: number;
  details: ImportDetail[];
  userMapping?: Record<string, string>;
  usersCreated?: number;
  usersSkipped?: number;
}

export function SqlImportPanel() {
  const [sqlContent, setSqlContent] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [importing, setImporting] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const [skipAuthTables, setSkipAuthTables] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [preview, setPreview] = useState<{
    tables: Record<string, number>;
    totalStatements: number;
    hasAuthUsers: boolean;
    authUsersCount: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".sql")) {
      toast.error("Arquivo deve ser .sql");
      return;
    }

    try {
      const content = await file.text();
      setSqlContent(content);
      setFileName(file.name);
      setResult(null);

      toast.loading("Analisando arquivo SQL...", { id: "sql-preview" });

      const previewData = await analyzeSqlDump(content, {
        onProgress: (n) => {
          // evita spam de UI: só atualiza a cada ~3k comandos
          if (n % 3000 === 0) toast.loading(`Analisando arquivo SQL... (${n} comandos)`, { id: "sql-preview" });
        },
      });

      setPreview(previewData);

      if (previewData.authUsersCount > 0) {
        toast.success(
          `Arquivo carregado: ${previewData.totalStatements} comandos, ${previewData.authUsersCount} usuários auth detectados`,
          { id: "sql-preview" }
        );
      } else {
        toast.success(`Arquivo carregado: ${previewData.totalStatements} comandos detectados`, { id: "sql-preview" });
      }
    } catch (error) {
      toast.error("Erro ao ler arquivo");
      console.error(error);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleImport = async () => {
    if (!sqlContent) {
      toast.error("Nenhum arquivo SQL carregado");
      return;
    }

    setImporting(true);
    setResult(null);

    try {
      toast.loading(dryRun ? "Analisando SQL (dry run)..." : "Executando importação...", { id: "sql-import" });

      const data = await runSqlImportBatched({
        sql: sqlContent,
        dryRun,
        skipAuthTables,
        totalStatements: preview?.totalStatements,
        onProgress: (p) => {
          const label = p.message || (dryRun ? "Analisando SQL (dry run)..." : "Executando importação...");
          toast.loading(label, { id: "sql-import" });
        },
      });

      setResult(data);

      const usersInfo = data.usersCreated || data.usersSkipped
        ? ` | ${data.usersCreated || 0} usuários criados, ${data.usersSkipped || 0} já existiam`
        : "";

      if (data.success) {
        toast.success(
          dryRun
            ? `Análise concluída: ${data.executed} comandos seriam executados${usersInfo}`
            : `Importação concluída: ${data.executed} comandos executados${usersInfo}`,
          { id: "sql-import" }
        );
      } else {
        toast.error(`Importação com erros: ${data.errors.length} falhas`, { id: "sql-import" });
      }
    } catch (error) {
      console.error("Import error:", error);
      toast.error(error instanceof Error ? error.message : "Erro na importação", { id: "sql-import" });
    } finally {
      setImporting(false);
    }
  };

  const clearFile = () => {
    setSqlContent("");
    setFileName("");
    setPreview(null);
    setResult(null);
  };

  const tableStats = result?.details.reduce((acc, d) => {
    if (!acc[d.table]) {
      acc[d.table] = { success: 0, error: 0, skipped: 0 };
    }
    acc[d.table][d.status]++;
    return acc;
  }, {} as Record<string, { success: number; error: number; skipped: number }>);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Database className="h-5 w-5" />
          Importar Backup SQL Completo
        </CardTitle>
        <CardDescription>
          Importe dados de um arquivo SQL incluindo usuários do auth schema. Os IDs de usuários serão remapeados automaticamente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* File Upload */}
        <div className="flex flex-wrap gap-3 items-center">
          <input
            ref={fileInputRef}
            type="file"
            accept=".sql"
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="gap-2"
            disabled={importing}
          >
            <Upload className="h-4 w-4" />
            Selecionar Arquivo SQL
          </Button>

          {fileName && (
            <>
              <Badge variant="secondary" className="gap-2">
                <FileText className="h-3 w-3" />
                {fileName}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFile}
                disabled={importing}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>

        {/* Preview */}
        {preview && (
          <Card className="bg-muted/50">
            <CardContent className="py-3">
              <div className="flex items-center gap-2 mb-2">
                <Eye className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-sm">Preview</span>
                <Badge variant="outline">{preview.totalStatements} comandos</Badge>
                {preview.hasAuthUsers && (
                  <Badge variant="default" className="gap-1 bg-blue-600">
                    <Users className="h-3 w-3" />
                    {preview.authUsersCount} usuários auth
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(preview.tables).map(([table, count]) => (
                  <Badge 
                    key={table} 
                    variant={table === "auth.users" ? "default" : "secondary"} 
                    className={`text-xs ${table === "auth.users" ? "bg-blue-600" : ""}`}
                  >
                    {table}: {count}
                  </Badge>
                ))}
              </div>
              
              {preview.hasAuthUsers && (
                <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-950/30 rounded text-xs text-blue-700 dark:text-blue-300">
                  <strong>Usuários detectados:</strong> Os usuários do auth.users serão criados via Admin API 
                  e os IDs serão remapeados em profiles, user_roles, super_admins, etc.
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Options */}
        {sqlContent && (
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                id="dry-run"
                checked={dryRun}
                onCheckedChange={setDryRun}
                disabled={importing}
              />
              <Label htmlFor="dry-run" className="text-sm">
                Modo simulação (dry run)
              </Label>
            </div>
            
            <div className="flex items-center gap-2">
              <Switch
                id="skip-auth"
                checked={skipAuthTables}
                onCheckedChange={setSkipAuthTables}
                disabled={importing}
              />
              <Label htmlFor="skip-auth" className="text-sm text-muted-foreground">
                Pular tabelas de auth (profiles, user_roles, super_admins)
              </Label>
            </div>
            
            <Button
              onClick={handleImport}
              disabled={importing}
              className="gap-2"
              variant={dryRun ? "outline" : "default"}
            >
              {importing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {dryRun ? "Simular Importação" : "Executar Importação"}
            </Button>
          </div>
        )}

        {/* Results */}
        {result && (
          <Card className={result.success ? "border-green-500/50" : "border-red-500/50"}>
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                {result.success ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
                {dryRun ? "Resultado da Simulação" : "Resultado da Importação"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Summary */}
              <div className="flex flex-wrap gap-3">
                <Badge variant="default" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  {result.executed} {dryRun ? "seriam executados" : "executados"}
                </Badge>
                <Badge variant="secondary" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {result.skipped} ignorados
                </Badge>
                {result.errors.length > 0 && (
                  <Badge variant="destructive" className="gap-1">
                    <XCircle className="h-3 w-3" />
                    {result.errors.length} erros
                  </Badge>
                )}
              </div>

              {/* User Mapping */}
              {result.userMapping && Object.keys(result.userMapping).length > 0 && (
                <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-4 w-4 text-blue-600" />
                    <span className="font-medium text-sm text-blue-700 dark:text-blue-300">
                      Mapeamento de Usuários
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {result.usersCreated || 0} criados, {result.usersSkipped || 0} já existiam
                    </Badge>
                  </div>
                  <ScrollArea className="h-32">
                    <div className="space-y-1 text-xs font-mono">
                      {Object.entries(result.userMapping).map(([oldId, newId]) => (
                        <div key={oldId} className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                          <span className="truncate max-w-[140px]" title={oldId}>{oldId.slice(0, 8)}...</span>
                          <ArrowRight className="h-3 w-3" />
                          <span className="truncate max-w-[140px]" title={newId}>{newId.slice(0, 8)}...</span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* Table Stats */}
              {tableStats && Object.keys(tableStats).length > 0 && (
                <ScrollArea className="h-48">
                  <div className="space-y-1">
                    {Object.entries(tableStats).map(([table, stats]) => (
                      <div key={table} className="flex items-center gap-2 text-sm py-1">
                        <span className="font-mono text-xs w-40 truncate">{table}</span>
                        <div className="flex gap-2 text-xs">
                          {stats.success > 0 && (
                            <span className="text-green-600">✓ {stats.success}</span>
                          )}
                          {stats.skipped > 0 && (
                            <span className="text-yellow-600">⊘ {stats.skipped}</span>
                          )}
                          {stats.error > 0 && (
                            <span className="text-red-600">✗ {stats.error}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}

              {/* Errors */}
              {result.errors.length > 0 && (
                <div className="bg-red-50 dark:bg-red-950/20 p-3 rounded text-sm">
                  <p className="font-medium text-red-600 mb-2">Erros:</p>
                  <ScrollArea className="h-32">
                    <ul className="space-y-1 text-xs text-red-600">
                      {result.errors.slice(0, 20).map((err, i) => (
                        <li key={i} className="font-mono">{err}</li>
                      ))}
                      {result.errors.length > 20 && (
                        <li className="text-muted-foreground">
                          ... e mais {result.errors.length - 20} erros
                        </li>
                      )}
                    </ul>
                  </ScrollArea>
                </div>
              )}

              {/* Next Steps */}
              {dryRun && result.success && (
                <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded text-sm">
                  <p className="text-blue-600">
                    ✓ Simulação bem-sucedida! Desative o "Modo simulação" e clique em "Executar Importação" para aplicar as mudanças.
                  </p>
                </div>
              )}

              {!dryRun && result.success && result.usersCreated && result.usersCreated > 0 && (
                <div className="bg-amber-50 dark:bg-amber-950/20 p-3 rounded text-sm">
                  <p className="text-amber-700 dark:text-amber-300">
                    ⚠️ <strong>Importante:</strong> Os usuários criados receberam senhas temporárias aleatórias. 
                    Eles precisarão usar "Esqueci minha senha" para definir uma nova senha.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}
