import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { extractFunctionsError } from "@/lib/functionsError";
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
  idMapping: Record<string, string>; // Global ID mapping for all entities
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
  const [debugDetails, setDebugDetails] = useState<string>("");
  const [state, setState] = useState<MigrationState>({
    phase: "idle",
    summary: null,
    userMapping: {},
    idMapping: {},
    usersCreated: 0,
    usersSkipped: 0,
    tables: {},
    currentTable: null,
    progress: 0,
    errors: [],
  });

  const resetState = () => {
    setDebugDetails("");
    setState({
      phase: "idle",
      summary: null,
      userMapping: {},
      idMapping: {},
      usersCreated: 0,
      usersSkipped: 0,
      tables: {},
      currentTable: null,
      progress: 0,
      errors: [],
    });
  };

  const formatInvokeError = (err: unknown): string => {
    const ex = extractFunctionsError(err);
    const prefix = ex.status ? `HTTP ${ex.status}: ` : "";
    return `${prefix}${ex.message}`;
  };

  const captureDebug = (payload: unknown) => {
    try {
      setDebugDetails(JSON.stringify(payload, null, 2).slice(0, 8000));
    } catch {
      setDebugDetails(String(payload));
    }
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

      if (summaryError) {
        captureDebug({ phase: "summary", error: extractFunctionsError(summaryError) });
        throw new Error(formatInvokeError(summaryError));
      }
      if (!summaryData?.success) {
        captureDebug({ phase: "summary", response: summaryData });
        throw new Error(summaryData?.error || "Erro ao obter resumo");
      }

      console.log("[ApiMigration] Summary response:", summaryData.summary);

      // Handle different response formats - could be array or object with tables property
      let tables: { table: string; count: number }[] = [];
      const summary = summaryData.summary;
      
      console.log("[ApiMigration] Raw summary received:", JSON.stringify(summary, null, 2));
      console.log("[ApiMigration] Summary type:", typeof summary, Array.isArray(summary) ? "isArray" : "");
      
      // Metadata keys that should NOT be treated as table names (exact match, case-insensitive check)
      const metadataKeys = new Set([
        "total", "timestamp", "tablecount", "authuserscount", 
        "tables", "error", "success", "message", "count", "version"
      ]);
      
      // Helper to check if a key looks like a valid table name - MORE PERMISSIVE
      const isValidTableName = (key: string): boolean => {
        if (!key || typeof key !== "string") return false;
        const lowerKey = key.toLowerCase();
        if (metadataKeys.has(lowerKey)) return false;
        // Exclude keys that end with "Count" (metadata fields)
        if (/count$/i.test(key)) return false;
        // Accept almost anything that could be a table name
        // Just exclude obviously wrong things
        return key.length > 0 && key.length < 100;
      };
      
      // Try multiple parsing strategies
      if (Array.isArray(summary)) {
        console.log("[ApiMigration] Summary is array with", summary.length, "items");
        console.log("[ApiMigration] First item sample:", JSON.stringify(summary[0]));
        
        // Strategy 1: Array of { table, count }
        if (summary.length > 0 && typeof summary[0] === "object" && summary[0].table) {
          tables = summary
            .filter((item) => item && typeof item === "object" && item.table && isValidTableName(item.table))
            .map((item) => ({
              table: String(item.table),
              count: Number(item.count) || 0,
            }));
          console.log("[ApiMigration] Parsed as array of {table, count}:", tables.length, "tables");
        }
        // Strategy 2: Array of { name, count } or similar
        else if (summary.length > 0 && typeof summary[0] === "object" && summary[0].name) {
          tables = summary
            .filter((item) => item && typeof item === "object" && item.name && isValidTableName(item.name))
            .map((item) => ({
              table: String(item.name),
              count: Number(item.count || item.rows || item.total) || 0,
            }));
          console.log("[ApiMigration] Parsed as array of {name, count}:", tables.length, "tables");
        }
        // Strategy 3: Array of strings (table names only)
        else if (summary.length > 0 && typeof summary[0] === "string") {
          tables = summary
            .filter((name) => typeof name === "string" && isValidTableName(name))
            .map((name) => ({
              table: String(name),
              count: 1, // Unknown count
            }));
          console.log("[ApiMigration] Parsed as array of strings:", tables.length, "tables");
        }
      } else if (summary?.tables && Array.isArray(summary.tables)) {
        console.log("[ApiMigration] Summary has tables array with", summary.tables.length, "items");
        console.log("[ApiMigration] First table sample:", JSON.stringify(summary.tables[0]));
        
        tables = summary.tables
          .filter((item: any) => {
            if (typeof item === "object" && (item.table || item.name)) {
              return isValidTableName(item.table || item.name);
            }
            if (typeof item === "string") {
              return isValidTableName(item);
            }
            return false;
          })
          .map((item: any) => ({
            table: String(item.table || item.name || item),
            count: Number(item.count || item.rows || item.total) || 0,
          }));
        console.log("[ApiMigration] Parsed tables array:", tables.length, "tables");
      } else if (summary && typeof summary === "object" && !Array.isArray(summary)) {
        console.log("[ApiMigration] Summary is object with keys:", Object.keys(summary));
        
        // If it's an object with table names as keys, convert to array
        tables = Object.entries(summary)
          .filter(([key, value]) => {
            // Skip if value is not a number or object with count
            if (typeof value !== "number" && typeof value !== "object") return false;
            return isValidTableName(key);
          })
          .map(([table, data]: [string, any]) => ({
            table,
            count: typeof data === "number" ? data : Number(data?.count || data?.rows || data?.total) || 0,
          }))
          .filter((t) => t.count > 0); // Only include tables with data
        console.log("[ApiMigration] Parsed as object keys:", tables.length, "tables");
      }
      
      // Order tables to reduce FK issues (dependencies first)
      const preferredOrder = [
        "clinics",
        "union_entities",
        "subscription_addons",
        "system_notifications",
        "system_features",
        "permission_definitions",
        "profiles",
        "user_roles",
        "super_admins",
        "insurance_plans",
        "procedures",
        "patients",
        "patient_cards",
        "patient_folders",
        "patient_dependents",
        "employers",
        "accounting_offices",
        "accounting_office_employers",
        "patient_employers",
        "professionals",
        "appointments",
        "employer_contributions",
      ];
      const orderIndex = new Map(preferredOrder.map((t, i) => [t, i] as const));
      tables.sort((a, b) => {
        const ai = orderIndex.get(a.table) ?? 9999;
        const bi = orderIndex.get(b.table) ?? 9999;
        if (ai !== bi) return ai - bi;
        return a.table.localeCompare(b.table);
      });

      console.log("[ApiMigration] Final tables to import:", tables.length, tables.map(t => `${t.table}(${t.count})`));
      
      if (tables.length === 0) {
        console.error("[ApiMigration] No valid tables found! Raw summary was:", JSON.stringify(summary));
        const rawSummaryPreview = JSON.stringify(summary).substring(0, 500);
        const msg = `Nenhuma tabela válida encontrada. Formato recebido: ${rawSummaryPreview}...`;
        captureDebug({ phase: "summary", summary });
        setState((s) => ({
          ...s,
          errors: [...s.errors, msg],
        }));
        throw new Error(msg);
      }
      
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

      if (usersError) {
        captureDebug({ phase: "users", error: extractFunctionsError(usersError) });
        throw new Error(formatInvokeError(usersError));
      }
      if (usersData && usersData.success === false) {
        captureDebug({ phase: "users", response: usersData });
        throw new Error(usersData?.error || "Erro ao importar usuários");
      }
      const userMapping = usersData?.userMapping || {};
      const usersCreated = usersData?.usersCreated || 0;
      const usersSkipped = usersData?.usersSkipped || 0;

      setState((s) => ({
        ...s,
        userMapping,
        usersCreated,
        usersSkipped,
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

      // If there are no tables to import, do not show a misleading "success".
      if (totalTables === 0) {
        setState((s) => ({ ...s, phase: "done", currentTable: null, progress: 100 }));
        toast.dismiss("migration");
        toast.warning(
          usersCreated > 0 || usersSkipped > 0
            ? `Nenhuma tabela para importar. Usuários: ${usersCreated} criados, ${usersSkipped} já existiam.`
            : "Nenhuma tabela para importar. Verifique o resumo retornado pela API de origem."
        );
        return;
      }

      // Keep track of accumulated ID mappings across all tables
      let accumulatedIdMapping: Record<string, string> = { ...userMapping };

      for (let i = 0; i < tablesToImport.length; i++) {
        const table = tablesToImport[i];

        setState((s) => ({
          ...s,
          currentTable: table.table,
          idMapping: accumulatedIdMapping,
          progress: 25 + Math.round((i / totalTables) * 70),
        }));

        // Page size tuning to avoid CPU limits
        const limit = table.count > 20000 ? 100 : table.count > 5000 ? 200 : 500;
        let page = 0;
        let hasMore = true;
        let imported = 0;
        const tableErrors: string[] = [];
        let safety = 0;

        toast.loading(`Importando ${table.table} (${table.count} registros)...`, { id: "migration" });

        while (hasMore) {
          safety++;
          if (safety > 5000) {
            tableErrors.push("Limite de páginas excedido (proteção contra loop infinito)");
            break;
          }

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
                  idMapping: accumulatedIdMapping,
                  page,
                  limit,
                  maxPages: 1,
                },
              }
            );

            if (tableError) {
              const msg = formatInvokeError(tableError);
              captureDebug({ phase: "table", table: table.table, page, limit, error: extractFunctionsError(tableError) });
              tableErrors.push(msg);
              break;
            }

            if (tableData && tableData.success === false) {
              const msg = tableData?.error || "Erro ao importar tabela";
              captureDebug({ phase: "table", table: table.table, page, limit, response: tableData });
              tableErrors.push(msg);
              break;
            }

            const chunk = tableData?.tables?.[table.table];
            if (chunk?.count) imported += chunk.count;
            if (chunk?.error) tableErrors.push(chunk.error);

            if (tableData?.idMapping) {
              accumulatedIdMapping = { ...accumulatedIdMapping, ...tableData.idMapping };
            }

            hasMore = Boolean(tableData?.hasMore);
            page = Number.isFinite(Number(tableData?.nextPage)) ? Number(tableData.nextPage) : page + 1;

            // Update UI progressively
            setState((s) => ({
              ...s,
              idMapping: accumulatedIdMapping,
              tables: {
                ...s.tables,
                [table.table]: {
                  success: tableErrors.length === 0 && (chunk?.success ?? true),
                  count: imported,
                  error: tableErrors.length > 0 ? tableErrors[0] : undefined,
                },
              },
            }));
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            tableErrors.push(msg);
            break;
          }
        }

        // Finalize table result
        setState((s) => ({
          ...s,
          idMapping: accumulatedIdMapping,
          tables: {
            ...s.tables,
            [table.table]: {
              success: tableErrors.length === 0,
              count: imported,
              error: tableErrors.length > 0 ? tableErrors.slice(0, 2).join(" | ") : undefined,
            },
          },
          errors: tableErrors.length > 0 ? [...s.errors, `${table.table}: ${tableErrors[0]}`] : s.errors,
        }));
      }

      setState((s) => ({ ...s, phase: "done", currentTable: null, progress: 100 }));
      toast.dismiss("migration");
      toast.success("Migração concluída!");

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

        {debugDetails && (
          <div className="space-y-2">
            <Badge variant="outline" className="bg-muted">
              <Database className="mr-1 h-3 w-3" />
              Detalhes técnicos
            </Badge>
            <ScrollArea className="h-[180px] rounded-md border bg-background p-3">
              <pre className="text-xs whitespace-pre-wrap">{debugDetails}</pre>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
