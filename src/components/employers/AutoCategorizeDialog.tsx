import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Search, Play, CheckCircle, XCircle, AlertCircle, Building2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface AutoCategorizeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clinicId: string;
  onComplete: () => void;
}

interface ResultItem {
  employer_id: string;
  employer_name: string;
  cnpj: string;
  cnae_code: number | null;
  cnae_description: string | null;
  matched_category: string | null;
  category_id: string | null;
  status: 'matched' | 'no_match' | 'error' | 'api_error';
  error?: string;
}

interface Summary {
  total: number;
  matched: number;
  no_match: number;
  errors: number;
  dry_run: boolean;
}

export function AutoCategorizeDialog({ open, onOpenChange, clinicId, onComplete }: AutoCategorizeDialogProps) {
  const [loading, setLoading] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const [results, setResults] = useState<ResultItem[] | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);

  const handleExecute = async () => {
    setLoading(true);
    setResults(null);
    setSummary(null);

    try {
      const { data, error } = await supabase.functions.invoke('auto-categorize-employers', {
        body: { clinic_id: clinicId, dry_run: dryRun }
      });

      if (error) throw error;

      setResults(data.results);
      setSummary(data.summary);

      if (data.summary.matched > 0) {
        if (dryRun) {
          toast.info(`Simulação concluída: ${data.summary.matched} empresas seriam categorizadas`);
        } else {
          toast.success(`${data.summary.matched} empresas categorizadas com sucesso!`);
          onComplete();
        }
      } else {
        toast.info("Nenhuma empresa foi categorizada automaticamente");
      }
    } catch (error: unknown) {
      console.error("Erro ao categorizar:", error);
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      toast.error(`Erro ao executar: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: ResultItem['status']) => {
    switch (status) {
      case 'matched':
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Categorizado</Badge>;
      case 'no_match':
        return <Badge variant="secondary"><XCircle className="h-3 w-3 mr-1" />Sem match</Badge>;
      case 'error':
      case 'api_error':
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Erro</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Categorização Automática por CNAE
          </DialogTitle>
          <DialogDescription>
            Consulta o CNPJ de cada empresa na Receita Federal (via BrasilAPI) e vincula automaticamente 
            à categoria correspondente baseado no código CNAE (Atividade Econômica Principal).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div className="space-y-1">
              <Label htmlFor="dry-run" className="font-medium">Modo simulação</Label>
              <p className="text-sm text-muted-foreground">
                {dryRun 
                  ? "Apenas mostra o que seria feito, sem salvar alterações" 
                  : "Aplica as alterações no banco de dados"
                }
              </p>
            </div>
            <Switch
              id="dry-run"
              checked={dryRun}
              onCheckedChange={setDryRun}
            />
          </div>

          {summary && (
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold">{summary.total}</div>
                <div className="text-xs text-muted-foreground">Total</div>
              </div>
              <div className="text-center p-3 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{summary.matched}</div>
                <div className="text-xs text-muted-foreground">Categorizados</div>
              </div>
              <div className="text-center p-3 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">{summary.no_match}</div>
                <div className="text-xs text-muted-foreground">Sem match</div>
              </div>
              <div className="text-center p-3 bg-red-100 dark:bg-red-900/20 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{summary.errors}</div>
                <div className="text-xs text-muted-foreground">Erros</div>
              </div>
            </div>
          )}

          {results && results.length > 0 && (
            <ScrollArea className="h-[300px] border rounded-lg">
              <div className="p-4 space-y-3">
                {results.map((result, idx) => (
                  <div key={idx} className="flex items-start justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{result.employer_name}</div>
                      <div className="text-sm text-muted-foreground">{result.cnpj}</div>
                      {result.cnae_code && (
                        <div className="text-xs text-muted-foreground mt-1">
                          CNAE: {result.cnae_code} - {result.cnae_description}
                        </div>
                      )}
                      {result.matched_category && (
                        <div className="text-sm text-green-600 font-medium mt-1">
                          → {result.matched_category}
                        </div>
                      )}
                      {result.error && (
                        <div className="text-xs text-destructive mt-1">{result.error}</div>
                      )}
                    </div>
                    <div className="ml-4 flex-shrink-0">
                      {getStatusBadge(result.status)}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          {!results && !loading && (
            <div className="text-center py-8 text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Clique em "Executar" para buscar os CNAEs das empresas sem categoria</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button onClick={handleExecute} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                {dryRun ? "Simular" : "Executar"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
