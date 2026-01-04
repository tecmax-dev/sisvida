import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, RefreshCw, Play, CheckCircle, XCircle, AlertCircle, AlertTriangle, Building2, Phone, Mail, MapPin } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface SyncCnpjDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clinicId: string;
  onComplete: () => void;
}

interface NewData {
  name?: string;
  trade_name?: string | null;
  cep?: string;
  address?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  phone?: string;
  email?: string | null;
  cnae_code?: string;
  cnae_description?: string;
}

interface ResultItem {
  employer_id: string;
  employer_name: string;
  cnpj: string;
  new_data: NewData | null;
  status: 'updated' | 'no_changes' | 'invalid_cnpj' | 'inactive' | 'error';
  error?: string;
  situacao?: string;
}

interface Summary {
  total: number;
  updated: number;
  no_changes: number;
  invalid_cnpj: number;
  inactive: number;
  errors: number;
  dry_run: boolean;
}

export function SyncCnpjDialog({ open, onOpenChange, clinicId, onComplete }: SyncCnpjDialogProps) {
  const [loading, setLoading] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const [results, setResults] = useState<ResultItem[] | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);

  const handleExecute = async () => {
    setLoading(true);
    setResults(null);
    setSummary(null);

    try {
      const { data, error } = await supabase.functions.invoke('sync-employer-cnpj', {
        body: { clinic_id: clinicId, dry_run: dryRun }
      });

      if (error) throw error;

      setResults(data.results);
      setSummary(data.summary);

      if (data.summary.updated > 0) {
        if (dryRun) {
          toast.info(`Simulação concluída: ${data.summary.updated} empresas seriam atualizadas`);
        } else {
          toast.success(`${data.summary.updated} empresas atualizadas com sucesso!`);
          onComplete();
        }
      } else {
        toast.info("Nenhuma empresa precisou de atualização");
      }
    } catch (error: unknown) {
      console.error("Erro ao sincronizar CNPJ:", error);
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
      case 'no_changes':
        return <Badge variant="secondary"><CheckCircle className="h-3 w-3 mr-1" />Sem alterações</Badge>;
      case 'invalid_cnpj':
        return <Badge variant="outline" className="text-yellow-600 border-yellow-600"><AlertTriangle className="h-3 w-3 mr-1" />CNPJ inválido</Badge>;
      case 'inactive':
        return <Badge variant="outline" className="text-orange-600 border-orange-600"><XCircle className="h-3 w-3 mr-1" />Inativa</Badge>;
      case 'error':
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Erro</Badge>;
    }
  };

  // Ordenar resultados: atualizados primeiro
  const sortedResults = results?.slice().sort((a, b) => {
    const order = { updated: 0, no_changes: 1, inactive: 2, invalid_cnpj: 3, error: 4 };
    return order[a.status] - order[b.status];
  });

  const handleClose = () => {
    setResults(null);
    setSummary(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Sincronizar Dados via CNPJ
          </DialogTitle>
          <DialogDescription>
            Busca dados atualizados das empresas na Receita Federal via CNPJ (endereço, telefone, email, CNAE).
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
            <div className="grid grid-cols-6 gap-2">
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-xl font-bold">{summary.total}</div>
                <div className="text-xs text-muted-foreground">Total</div>
              </div>
              <div className="text-center p-3 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <div className="text-xl font-bold text-green-600">{summary.updated}</div>
                <div className="text-xs text-muted-foreground">Atualizados</div>
              </div>
              <div className="text-center p-3 bg-gray-100 dark:bg-gray-900/20 rounded-lg">
                <div className="text-xl font-bold text-gray-500">{summary.no_changes}</div>
                <div className="text-xs text-muted-foreground">Sem mudanças</div>
              </div>
              <div className="text-center p-3 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
                <div className="text-xl font-bold text-orange-600">{summary.inactive}</div>
                <div className="text-xs text-muted-foreground">Inativas</div>
              </div>
              <div className="text-center p-3 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg">
                <div className="text-xl font-bold text-yellow-600">{summary.invalid_cnpj}</div>
                <div className="text-xs text-muted-foreground">CNPJ inválido</div>
              </div>
              <div className="text-center p-3 bg-red-100 dark:bg-red-900/20 rounded-lg">
                <div className="text-xl font-bold text-red-600">{summary.errors}</div>
                <div className="text-xs text-muted-foreground">Erros</div>
              </div>
            </div>
          )}

          {sortedResults && sortedResults.length > 0 && (
            <ScrollArea className="h-[350px] border rounded-lg">
              <div className="p-4 space-y-3">
                {sortedResults.map((result, idx) => (
                  <div key={idx} className="p-3 bg-muted/50 rounded-lg space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{result.employer_name}</div>
                        <div className="text-sm text-muted-foreground font-mono">{result.cnpj}</div>
                      </div>
                      <div className="ml-4 flex-shrink-0">
                        {getStatusBadge(result.status)}
                      </div>
                    </div>

                    {result.status === 'updated' && result.new_data && (
                      <div className="grid grid-cols-2 gap-2 mt-2 text-sm border-t pt-2">
                        {result.new_data.address && (
                          <div className="flex items-start gap-2 col-span-2">
                            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                            <div>
                              <div className="text-green-600">{result.new_data.address}</div>
                              <div className="text-xs text-muted-foreground">
                                {result.new_data.neighborhood && `${result.new_data.neighborhood}, `}
                                {result.new_data.city}/{result.new_data.state} - CEP: {result.new_data.cep}
                              </div>
                            </div>
                          </div>
                        )}
                        {result.new_data.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <span className="text-green-600">{result.new_data.phone}</span>
                          </div>
                        )}
                        {result.new_data.email && (
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <span className="text-green-600 truncate">{result.new_data.email}</span>
                          </div>
                        )}
                        {result.new_data.cnae_code && (
                          <div className="col-span-2 text-xs text-muted-foreground">
                            CNAE: {result.new_data.cnae_code} - {result.new_data.cnae_description}
                          </div>
                        )}
                      </div>
                    )}

                    {result.error && (
                      <div className="text-xs text-destructive mt-1">{result.error}</div>
                    )}
                    {result.situacao && result.status === 'inactive' && (
                      <div className="text-xs text-orange-600 mt-1">Situação: {result.situacao}</div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          {loading && (
            <div className="text-center py-8">
              <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-primary" />
              <p className="font-medium">Processando empresas em lote...</p>
              <p className="text-sm text-muted-foreground mt-2">
                Buscando dados na Receita Federal via BrasilAPI
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Isso pode levar alguns minutos dependendo da quantidade de empresas
              </p>
            </div>
          )}

          {!results && !loading && (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Clique em "Executar" para sincronizar dados de <strong>todas as empresas</strong> via CNPJ</p>
              <p className="text-xs mt-2">
                Serão buscados: endereço, CEP, bairro, telefone, email e CNAE
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
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
                <RefreshCw className="mr-2 h-4 w-4" />
                {dryRun ? "Simular" : "Executar"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
