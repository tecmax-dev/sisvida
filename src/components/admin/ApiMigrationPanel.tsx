import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Database,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Download,
  RefreshCw,
  Eye,
  EyeOff,
  Zap,
} from "lucide-react";

interface TableResult {
  success: boolean;
  count: number;
  error?: string;
}

interface MigrationState {
  phase: "idle" | "summary" | "users" | "tables" | "done";
  summary: { table: string; count: number }[] | null;
  userMapping: Record<string, string>;
  usersCreated: number;
  usersSkipped: number;
  tables: Record<string, TableResult>;
  currentTable: string | null;
  progress: number;
  errors: string[];
}

export function ApiMigrationPanel() {
  const [sourceApiUrl, setSourceApiUrl] = useState("");
  const [syncKey, setSyncKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [state, setState] = useState<MigrationState>({
    phase: "idle",
    summary: null,
    userMapping: {},
    usersCreated: 0,
    usersSkipped: 0,
    tables: {},
    currentTable: null,
    progress: 0,
    errors: [],
  });

  const resetState = () => {
    setState({
      phase: "idle",
      summary: null,
      userMapping: {},
      usersCreated: 0,
      usersSkipped: 0,
      tables: {},
      currentTable: null,
      progress: 0,
      errors: [],
    });
  };

  const handleMigration = async () => {
    if (!sourceApiUrl.trim() || !syncKey.trim()) {
      toast.error("Preencha a URL da API e a chave de sincronização");
      return;
    }

    setMigrating(true);
    resetState();

    try {
      // Phase 1: Get summary
      setState((s) => ({ ...s, phase: "summary", progress: 5 }));
      toast.loading("Obtendo resumo do projeto origem...", { id: "migration" });

      const { data: summaryData, error: summaryError } = await supabase.functions.invoke(
        "import-from-api",
        {
          body: { sourceApiUrl: sourceApiUrl.trim(), syncKey: syncKey.trim(), phase: "summary" },
        }
      );

      if (summaryError) throw new Error(summaryError.message);
      if (!summaryData?.success) throw new Error(summaryData?.error || "Erro ao obter resumo");

      console.log("[ApiMigration] Summary response:", summaryData.summary);

      // Handle different response formats - could be array or object with tables property
      let tables: { table: string; count: number }[] = [];
      const summary = summaryData.summary;
      
      console.log("[ApiMigration] Raw summary received:", JSON.stringify(summary, null, 2));
      
      // Metadata keys that should NOT be treated as table names
      const metadataKeys = new Set([
        "total", "timestamp", "tableCount", "authUsersCount", 
        "tables", "error", "success", "message", "count", "version"
      ]);
      
      // Helper to check if a key looks like a valid table name
      const isValidTableName = (key: string): boolean => {
        if (metadataKeys.has(key)) return false;
        // Table names should be snake_case and not contain numbers at the end like "Count"
        if (/Count$/.test(key)) return false;
        if (/^[a-z][a-z0-9_]*$/.test(key)) return true;
        return false;
      };
      
      if (Array.isArray(summary)) {
        // Filter out any entries that look like metadata
        tables = summary.filter((item) => {
          if (typeof item === "object" && item.table) {
            return isValidTableName(item.table);
          }
          return false;
        });
      } else if (summary?.tables && Array.isArray(summary.tables)) {
        tables = summary.tables.filter((item: any) => {
          if (typeof item === "object" && item.table) {
            return isValidTableName(item.table);
          }
          return false;
        });
      } else if (summary && typeof summary === "object") {
        // If it's an object with table names as keys, convert to array
        tables = Object.entries(summary)
          .filter(([key]) => isValidTableName(key))
          .map(([table, data]: [string, any]) => ({
            table,
            count: typeof data === "number" ? data : data?.count || 0,
          }))
          .filter((t) => t.count > 0); // Only include tables with data
      }
      
      console.log("[ApiMigration] Filtered tables to import:", tables.map(t => t.table));
      setState((s) => ({ ...s, summary: tables, progress: 10 }));

      // Phase 2: Import users
      setState((s) => ({ ...s, phase: "users", progress: 15 }));
      toast.loading("Importando usuários...", { id: "migration" });

      const { data: usersData, error: usersError } = await supabase.functions.invoke(
        "import-from-api",
        {
          body: { sourceApiUrl: sourceApiUrl.trim(), syncKey: syncKey.trim(), phase: "users" },
        }
      );

      if (usersError) throw new Error(usersError.message);

      const userMapping = usersData?.userMapping || {};
      setState((s) => ({
        ...s,
        userMapping,
        usersCreated: usersData?.usersCreated || 0,
        usersSkipped: usersData?.usersSkipped || 0,
        progress: 25,
      }));

      // Phase 3: Import tables
      setState((s) => ({ ...s, phase: "tables" }));

      const safeTables: { table: string; count: number }[] = Array.isArray(tables) ? tables : [];
      if (!Array.isArray(tables)) {
        console.warn("[ApiMigration] Unexpected tables shape:", tables);
        setState((s) => ({
          ...s,
          errors: [...s.errors, "Resumo do projeto origem veio em formato inesperado (sem lista de tabelas)."],
        }));
      }

      const tablesToImport = safeTables.filter((t) => Number(t?.count || 0) > 0);
      const totalTables = tablesToImport.length;

      for (let i = 0; i < tablesToImport.length; i++) {
        const table = tablesToImport[i];
        setState((s) => ({
          ...s,
          currentTable: table.table,
          progress: 25 + Math.round((i / totalTables) * 70),
        }));

        toast.loading(`Importando ${table.table} (${table.count} registros)...`, { id: "migration" });

        try {
          const { data: tableData, error: tableError } = await supabase.functions.invoke(
            "import-from-api",
            {
              body: {
                sourceApiUrl: sourceApiUrl.trim(),
                syncKey: syncKey.trim(),
                phase: "table",
                tableName: table.table,
                userMapping,
              },
            }
          );

          if (tableError) {
            setState((s) => ({
              ...s,
              tables: {
                ...s.tables,
                [table.table]: { success: false, count: 0, error: tableError.message },
              },
              errors: [...s.errors, `${table.table}: ${tableError.message}`],
            }));
          } else {
            const result = tableData?.tables?.[table.table] || { success: true, count: 0 };
            setState((s) => ({
              ...s,
              tables: { ...s.tables, [table.table]: result },
            }));
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          setState((s) => ({
            ...s,
            tables: { ...s.tables, [table.table]: { success: false, count: 0, error: msg } },
            errors: [...s.errors, `${table.table}: ${msg}`],
          }));
        }
      }

      setState((s) => ({ ...s, phase: "done", currentTable: null, progress: 100 }));
      toast.dismiss("migration");
      toast.success("Migração concluída!");
    } catch (error) {
      toast.dismiss("migration");
      const msg = error instanceof Error ? error.message : "Erro na migração";
      toast.error(msg);
      setState((s) => ({ ...s, errors: [...s.errors, msg] }));
    } finally {
      setMigrating(false);
    }
  };

  const successCount = Object.values(state.tables).filter((t) => t.success && t.count > 0).length;
  const errorCount = Object.values(state.tables).filter((t) => !t.success).length;
  const totalRecords = Object.values(state.tables).reduce((sum, t) => sum + (t.count || 0), 0);

  return (
    <Card className="border-accent/20 bg-accent/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-accent" />
          Migração via API
        </CardTitle>
        <CardDescription>
          Importa dados usando a API de sincronização criada no projeto origem.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="api-url">URL da API de Sincronização</Label>
            <Input
              id="api-url"
              type="url"
              placeholder="https://xxxxx.supabase.co/functions/v1/data-sync-api"
              value={sourceApiUrl}
              onChange={(e) => setSourceApiUrl(e.target.value)}
              disabled={migrating}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sync-key">Chave de Sincronização (x-sync-key)</Label>
            <div className="relative">
              <Input
                id="sync-key"
                type={showKey ? "text" : "password"}
                placeholder="DATA_SYNC_API_KEY"
                value={syncKey}
                onChange={(e) => setSyncKey(e.target.value)}
                disabled={migrating}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowKey(!showKey)}
                tabIndex={-1}
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>

        {state.phase !== "idle" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {state.phase === "summary" && "Obtendo resumo..."}
                {state.phase === "users" && "Importando usuários..."}
                {state.phase === "tables" && state.currentTable && `Importando ${state.currentTable}...`}
                {state.phase === "done" && "Migração concluída!"}
              </span>
              <span className="font-medium">{state.progress}%</span>
            </div>
            <Progress value={state.progress} className="h-2" />
          </div>
        )}

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
                Executar Migração via API
              </>
            )}
          </Button>

          {state.phase !== "idle" && (
            <Button onClick={resetState} variant="outline" size="sm" disabled={migrating}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Limpar
            </Button>
          )}
        </div>

        {(state.usersCreated > 0 || state.usersSkipped > 0) && (
          <div className="flex flex-wrap gap-3">
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              {state.usersCreated} usuários criados
            </Badge>
            {state.usersSkipped > 0 && (
              <Badge variant="outline" className="bg-muted">
                <AlertTriangle className="mr-1 h-3 w-3" />
                {state.usersSkipped} já existiam
              </Badge>
            )}
          </div>
        )}

        {Object.keys(state.tables).length > 0 && (
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
                {Object.entries(state.tables).map(([table, info]) => (
                  <div
                    key={table}
                    className="flex items-center justify-between py-1 border-b last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      {info.success ? (
                        <CheckCircle2 className="h-4 w-4 text-success" />
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
                        <span className="text-xs text-destructive max-w-[200px] truncate" title={info.error}>
                          {info.error}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {state.errors.length > 0 && (
          <div className="space-y-2">
            <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
              <XCircle className="mr-1 h-3 w-3" />
              Erros
            </Badge>
            <ScrollArea className="h-[150px] rounded-md border bg-background p-3">
              <pre className="text-xs text-destructive whitespace-pre-wrap">
                {state.errors.join("\n")}
              </pre>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
