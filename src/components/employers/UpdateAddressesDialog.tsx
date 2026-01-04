import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, MapPin, Play, CheckCircle, XCircle, AlertCircle, AlertTriangle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface UpdateAddressesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clinicId: string;
  onComplete: () => void;
}

interface ResultItem {
  employer_id: string;
  employer_name: string;
  cnpj: string;
  cep: string | null;
  address: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  status: 'updated' | 'no_cep' | 'invalid_cep' | 'error';
  error?: string;
}

interface Summary {
  total: number;
  updated: number;
  no_cep: number;
  invalid_cep: number;
  errors: number;
  dry_run: boolean;
}

export function UpdateAddressesDialog({ open, onOpenChange, clinicId, onComplete }: UpdateAddressesDialogProps) {
  const [loading, setLoading] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const [results, setResults] = useState<ResultItem[] | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);

  const handleExecute = async () => {
    setLoading(true);
    setResults(null);
    setSummary(null);

    try {
      const { data, error } = await supabase.functions.invoke('update-employer-addresses', {
        body: { clinic_id: clinicId, dry_run: dryRun }
      });

      if (error) throw error;

      setResults(data.results);
      setSummary(data.summary);

      if (data.summary.updated > 0) {
        if (dryRun) {
          toast.info(`Simulação concluída: ${data.summary.updated} endereços seriam atualizados`);
        } else {
          toast.success(`${data.summary.updated} endereços atualizados com sucesso!`);
          onComplete();
        }
      } else {
        toast.info("Nenhum endereço foi atualizado");
      }
    } catch (error: unknown) {
      console.error("Erro ao atualizar endereços:", error);
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      toast.error(`Erro ao executar: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: ResultItem['status']) => {
    switch (status) {
      case 'updated':
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Atualizado</Badge>;
      case 'no_cep':
        return <Badge variant="secondary"><XCircle className="h-3 w-3 mr-1" />Sem CEP</Badge>;
      case 'invalid_cep':
        return <Badge variant="outline" className="text-yellow-600 border-yellow-600"><AlertTriangle className="h-3 w-3 mr-1" />CEP inválido</Badge>;
      case 'error':
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Erro</Badge>;
    }
  };

  // Ordenar resultados: atualizados primeiro, depois CEP inválido, erros, e sem CEP por último
  const sortedResults = results?.slice().sort((a, b) => {
    const order = { updated: 0, invalid_cep: 1, error: 2, no_cep: 3 };
    return order[a.status] - order[b.status];
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Atualizar Endereços via CEP
          </DialogTitle>
          <DialogDescription>
            Busca os dados de endereço das empresas através do CEP cadastrado usando a API ViaCEP.
            Apenas empresas com CEP válido e dados de endereço incompletos serão atualizadas.
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
            <div className="grid grid-cols-5 gap-3">
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold">{summary.total}</div>
                <div className="text-xs text-muted-foreground">Total</div>
              </div>
              <div className="text-center p-3 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{summary.updated}</div>
                <div className="text-xs text-muted-foreground">Atualizados</div>
              </div>
              <div className="text-center p-3 bg-gray-100 dark:bg-gray-900/20 rounded-lg">
                <div className="text-2xl font-bold text-gray-500">{summary.no_cep}</div>
                <div className="text-xs text-muted-foreground">Sem CEP</div>
              </div>
              <div className="text-center p-3 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">{summary.invalid_cep}</div>
                <div className="text-xs text-muted-foreground">CEP inválido</div>
              </div>
              <div className="text-center p-3 bg-red-100 dark:bg-red-900/20 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{summary.errors}</div>
                <div className="text-xs text-muted-foreground">Erros</div>
              </div>
            </div>
          )}

          {sortedResults && sortedResults.length > 0 && (
            <ScrollArea className="h-[300px] border rounded-lg">
              <div className="p-4 space-y-3">
                {sortedResults.map((result, idx) => (
                  <div key={idx} className="flex items-start justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{result.employer_name}</div>
                      <div className="text-sm text-muted-foreground">{result.cnpj}</div>
                      {result.cep && (
                        <div className="text-xs text-muted-foreground mt-1">
                          CEP: {result.cep}
                        </div>
                      )}
                      {result.status === 'updated' && result.address && (
                        <div className="text-sm text-green-600 mt-1 space-y-0.5">
                          <div>→ {result.address}</div>
                          {result.neighborhood && <div className="text-xs">Bairro: {result.neighborhood}</div>}
                          <div className="text-xs">{result.city}/{result.state}</div>
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
              <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Clique em "Executar" para buscar endereços das empresas via CEP</p>
              <p className="text-xs mt-2">
                Certifique-se de que as empresas tenham o CEP cadastrado
              </p>
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