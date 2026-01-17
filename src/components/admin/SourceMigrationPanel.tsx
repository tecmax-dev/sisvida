import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
  message: string;
  tables: Record<string, { success: boolean; count: number; error?: string }>;
  migrated_by: string;
  migrated_at: string;
}

export function SourceMigrationPanel() {
  const [migrating, setMigrating] = useState(false);
  const [result, setResult] = useState<MigrationResult | null>(null);

  const handleMigration = async () => {
    setMigrating(true);
    setResult(null);

    try {
      toast.loading("Iniciando migração do projeto origem...", { id: "migration" });

      const { data, error } = await supabase.functions.invoke("migrate-from-source");

      toast.dismiss("migration");

      if (error) {
        console.error("Migration error:", error);
        toast.error(`Erro na migração: ${error.message}`);
        return;
      }

      if (data?.success) {
        setResult(data);
        toast.success(data.message);
      } else {
        toast.error(data?.error || "Erro desconhecido na migração");
      }
    } catch (err) {
      toast.dismiss("migration");
      console.error("Migration exception:", err);
      toast.error("Erro ao executar migração");
    } finally {
      setMigrating(false);
    }
  };

  const successCount = result
    ? Object.values(result.tables).filter((t) => t.success && t.count > 0).length
    : 0;
  const errorCount = result
    ? Object.values(result.tables).filter((t) => !t.success).length
    : 0;
  const totalRecords = result
    ? Object.values(result.tables).reduce((sum, t) => sum + (t.count || 0), 0)
    : 0;

  return (
    <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5 text-amber-600" />
          Migração do Projeto Origem
        </CardTitle>
        <CardDescription>
          Migrar todos os dados do projeto Lovable Cloud de origem (8431f322...) para este projeto.
          Esta operação usa UPSERT e pode ser executada múltiplas vezes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Button
            onClick={handleMigration}
            disabled={migrating}
            variant="default"
            className="bg-amber-600 hover:bg-amber-700"
          >
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

          {result && (
            <Button
              onClick={() => setResult(null)}
              variant="outline"
              size="sm"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Limpar resultado
            </Button>
          )}
        </div>

        {result && (
          <div className="space-y-4">
            <div className="flex gap-4">
              <Badge variant="outline" className="bg-green-100 text-green-800">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                {successCount} tabelas migradas
              </Badge>
              {errorCount > 0 && (
                <Badge variant="outline" className="bg-red-100 text-red-800">
                  <XCircle className="mr-1 h-3 w-3" />
                  {errorCount} erros
                </Badge>
              )}
              <Badge variant="outline" className="bg-blue-100 text-blue-800">
                {totalRecords.toLocaleString()} registros totais
              </Badge>
            </div>

            <ScrollArea className="h-[300px] rounded-md border p-4">
              <div className="space-y-2">
                {Object.entries(result.tables).map(([table, info]) => (
                  <div
                    key={table}
                    className="flex items-center justify-between py-1 border-b last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      {info.success ? (
                        info.count > 0 ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-gray-400" />
                        )
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600" />
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
                        <span className="text-xs text-red-600 max-w-[200px] truncate">
                          {info.error}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <p className="text-xs text-muted-foreground">
              Migrado por: {result.migrated_by} em{" "}
              {new Date(result.migrated_at).toLocaleString("pt-BR")}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
