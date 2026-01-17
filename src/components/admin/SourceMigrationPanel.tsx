import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Database,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Download,
  RefreshCw,
} from "lucide-react";

interface MigrationResult {
  success: boolean;
  message?: string;
  error?: string;
  diagnostics?: unknown;
  tables?: Record<string, { success: boolean; count: number; error?: string }>;
  migrated_by?: string;
  migrated_at?: string;
}

function safePrettyJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function SourceMigrationPanel() {
  const [migrating, setMigrating] = useState(false);
  const [result, setResult] = useState<MigrationResult | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  const handleMigration = async () => {
    setMigrating(true);
    setResult(null);
    setErrorDetails(null);

    try {
      toast.loading("Iniciando migração do projeto origem...", { id: "migration" });

      const { data, error } = await supabase.functions.invoke("migrate-from-source");

      toast.dismiss("migration");

      if (error) {
        // Supabase Functions errors usually carry a response body in error.context.body
        const anyErr = error as any;
        const body = anyErr?.context?.body;

        let parsedBody: unknown = null;
        if (body) {
          try {
            parsedBody = typeof body === "string" ? JSON.parse(body) : body;
          } catch {
            parsedBody = body;
          }
        }

        if (parsedBody) setErrorDetails(safePrettyJson(parsedBody));

        const msg =
          (parsedBody as any)?.error ||
          (parsedBody as any)?.message ||
          error.message ||
          "Erro na migração";

        toast.error(msg);
        return;
      }

      // data can be success=false with diagnostics
      const payload = (data ?? {}) as MigrationResult;
      if (payload.success) {
        setResult(payload);
        toast.success(payload.message || "Migração concluída");
      } else {
        setResult(payload);
        setErrorDetails(safePrettyJson(payload));
        toast.error(payload.error || "Erro na migração");
      }
    } catch (err) {
      toast.dismiss("migration");
      console.error("Migration exception:", err);
      setErrorDetails(safePrettyJson(err));
      toast.error("Erro ao executar migração");
    } finally {
      setMigrating(false);
    }
  };

  const tables = result?.tables ?? {};
  const successCount = Object.values(tables).filter((t) => t.success && t.count > 0).length;
  const errorCount = Object.values(tables).filter((t) => !t.success).length;
  const totalRecords = Object.values(tables).reduce((sum, t) => sum + (t.count || 0), 0);

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          Migração do Projeto Origem
        </CardTitle>
        <CardDescription>
          Migra dados do projeto origem para este projeto via UPSERT (pode executar várias vezes).
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Button onClick={handleMigration} disabled={migrating} variant="default">
            {migrating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Migrando...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Executar Migração Completa
              </>
            )}
          </Button>

          {(result || errorDetails) && (
            <Button
              onClick={() => {
                setResult(null);
                setErrorDetails(null);
              }}
              variant="outline"
              size="sm"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Limpar resultado
            </Button>
          )}
        </div>

        {errorDetails && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                <XCircle className="mr-1 h-3 w-3" />
                Diagnóstico
              </Badge>
              <span className="text-sm text-muted-foreground">(copie e me envie se precisar)</span>
            </div>
            <ScrollArea className="h-[220px] rounded-md border bg-background p-3">
              <pre className="text-xs whitespace-pre-wrap">{errorDetails}</pre>
            </ScrollArea>
          </div>
        )}

        {result?.tables && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                {successCount} tabelas migradas
              </Badge>

              {errorCount > 0 && (
                <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                  <XCircle className="mr-1 h-3 w-3" />
                  {errorCount} erros
                </Badge>
              )}

              <Badge variant="outline" className="bg-muted">
                {totalRecords.toLocaleString()} registros totais
              </Badge>
            </div>

            <ScrollArea className="h-[300px] rounded-md border bg-background p-4">
              <div className="space-y-2">
                {Object.entries(result.tables).map(([table, info]) => (
                  <div
                    key={table}
                    className="flex items-center justify-between py-1 border-b last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      {info.success ? (
                        info.count > 0 ? (
                          <CheckCircle2 className="h-4 w-4 text-success" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                        )
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                      <span className="font-mono text-sm">{table}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {info.count > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {info.count} rows
                        </Badge>
                      )}
                      {info.error && (
                        <span className="text-xs text-destructive max-w-[240px] truncate" title={info.error}>
                          {info.error}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {result.migrated_by && result.migrated_at && (
              <p className="text-xs text-muted-foreground">
                Migrado por: {result.migrated_by} em {new Date(result.migrated_at).toLocaleString("pt-BR")}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}