import React, { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Zap, Search, ShieldCheck, List, History, Activity } from "lucide-react";

export const N8nDryRunTool = ({ clinicId }: { clinicId: string }) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [preCheck, setPreCheck] = useState<any>(null);
  const [workflowStatus, setWorkflowStatus] = useState<any>(null);
  const [executionLogs, setExecutionLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  
  const workflowId = "cKKOHTzcidTy2CFV";

  const fetchExecutionLogs = async () => {
    setLoadingLogs(true);
    try {
      const { data, error } = await supabase.functions.invoke('chatwoot-integration', {
        body: { 
          action: 'get-execution-logs', 
          clinicId, 
          workflowId 
        }
      });

      if (error) throw error;
      setExecutionLogs(data.executions?.data || []);
      toast.success("Logs de execução obtidos");
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao buscar logs: " + err.message);
    } finally {
      setLoadingLogs(false);
    }
  };

  const runPreCheck = async () => {
    setLoading(true);
    setPreCheck(null);
    try {
      const { data, error } = await supabase.functions.invoke('chatwoot-integration', {
        body: { clinic_id: clinicId, action: 'pre-check-eligibility' }
      });
      if (error) throw error;
      setPreCheck(data);
      if (data.ok) {
        toast.success("Pré-checagem concluída");
      }
    } catch (err: any) {
      toast.error(`Erro na pré-checagem: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const checkWorkflowStatus = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('chatwoot-integration', {
        body: { clinic_id: clinicId, action: 'get-workflow-status', workflowId }
      });
      if (error) throw error;
      setWorkflowStatus(data.workflow);
      toast.success("Status do workflow recuperado");
    } catch (err: any) {
      toast.error(`Erro ao checar status: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const activateWorkflow = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('chatwoot-integration', {
        body: { clinic_id: clinicId, action: 'activate-workflow', workflowId }
      });
      if (error) throw error;
      toast.success("Comando de ativação enviado");
      await checkWorkflowStatus();
    } catch (err: any) {
      toast.error(`Erro ao ativar: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const executeDryRun = async (noAuth = false) => {
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('chatwoot-integration', {
        body: { 
          clinic_id: clinicId, 
          action: 'execute-dry-run-single', 
          workflowId,
          useProduction: true,
          noAuth
        }
      });
      if (error) throw error;
      setResult(data);
      if (data.ok) {
        toast.success(noAuth ? "Teste sem Header concluído" : "Dry Run executado com sucesso");
      } else {
        const errorMsg = data.error_code ? `${data.error_code} (${data.webhook_status || 'N/A'})` : 'Falha no Dry Run';
        toast.error(errorMsg);
      }
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 pt-6 border-t mt-6">
      <Card className="border-2 border-primary/20 shadow-none">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg text-primary">Pré-Checagem & Dry Run</CardTitle>
            </div>
            <div className="text-[10px] font-mono bg-muted px-2 py-1 rounded">
              WF: {workflowId.substring(0, 8)}...
            </div>
          </div>
          <CardDescription>
            Validar elegibilidade dos associados conforme critérios oficiais antes do disparo real.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button 
              variant="outline"
              onClick={runPreCheck}
              disabled={loading}
              className="h-12 border-2 uppercase font-bold text-xs"
            >
              {loading && !result && !workflowStatus ? <Loader2 className="animate-spin mr-2" /> : <Search className="mr-2 h-4 w-4" />}
              1. Pré-Checagem
            </Button>

            <Button 
              variant="outline"
              onClick={checkWorkflowStatus}
              disabled={loading}
              className="h-12 border-2 uppercase font-bold text-xs"
            >
              {loading && workflowStatus ? <Loader2 className="animate-spin mr-2" /> : <Activity className="mr-2 h-4 w-4" />}
              2. Auditar n8n
            </Button>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={fetchExecutionLogs} 
              disabled={loading || loadingLogs}
              className="h-12 border-2 uppercase font-bold text-xs"
            >
              {loadingLogs ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <List className="mr-2 h-4 w-4" />}
              3. Ver Logs Execução
            </Button>
            
            <Button 
              variant="secondary"
              onClick={() => executeDryRun(true)}
              disabled={loading}
              className="h-12 border-2 uppercase font-bold text-xs"
            >
              4. Teste SEM Header
            </Button>

            <Button 
              onClick={() => executeDryRun(false)}
              disabled={loading}
              className="h-12 bg-black hover:bg-zinc-800 text-white font-bold text-xs uppercase md:col-span-2"
            >
              {loading && result ? <Loader2 className="animate-spin mr-2" /> : <Zap className="mr-2 h-4 w-4" fill="currentColor" />}
              5. Dry Run Real (COM Header)
            </Button>
          </div>

          {executionLogs.length > 0 && (
            <div className="mt-4 p-4 rounded-lg border bg-slate-50 space-y-2">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <History className="h-4 w-4" /> Últimas Execuções (n8n)
              </h3>
              <div className="space-y-1">
                {executionLogs.map((exec) => (
                  <div key={exec.id} className="text-[10px] p-2 bg-white border rounded flex justify-between items-center">
                    <div>
                      <span className="font-mono font-bold text-primary mr-2">#{exec.id}</span>
                      <span className="text-muted-foreground">{new Date(exec.startedAt).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full font-bold ${
                        exec.status === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {exec.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {workflowStatus && (
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 font-mono text-[11px] space-y-2">
              <p className="font-bold text-xs border-b border-blue-200 pb-1 mb-2 uppercase text-blue-800">Estado Real no n8n</p>
              <div className="grid grid-cols-2 gap-2">
                <span className="text-blue-700">ATIVO:</span>
                <span className={`font-bold ${workflowStatus.active ? 'text-green-600' : 'text-red-600'}`}>
                  {workflowStatus.active ? 'SIM' : 'NÃO'}
                </span>
                <span className="text-blue-700">NOME:</span>
                <span className="font-bold truncate">{workflowStatus.name}</span>
                <span className="text-blue-700">WEBHOOKS:</span>
                <span className="font-bold">
                  {workflowStatus.nodes?.filter((n: any) => n.type === 'n8n-nodes-base.webhook').length || 0}
                </span>
              </div>
              {!workflowStatus.active && (
                <Button 
                  size="sm" 
                  variant="destructive" 
                  className="w-full mt-2 h-8 text-[10px]"
                  onClick={activateWorkflow}
                >
                  TENTAR ATIVAÇÃO VIA API
                </Button>
              )}
            </div>
          )}

          {preCheck && (
            <div className="p-4 bg-muted/50 rounded-lg border font-mono text-[11px] space-y-2">
              <p className="font-bold text-xs border-b pb-1 mb-2 uppercase">Pré-Checagem de Elegibilidade</p>
              <div className="space-y-1">
                <p>{preCheck.summary}</p>
                <p>STATUS: <span className="font-bold">{preCheck.status}</span></p>
                <div className="pt-2 border-t mt-2 flex items-center justify-between">
                  <span>PRONTO PARA DRY RUN:</span>
                  <span className={`font-bold px-2 py-0.5 rounded ${preCheck.ready_for_dry_run === 'SIM' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {preCheck.ready_for_dry_run}
                  </span>
                </div>
              </div>
              
              <div className="mt-4 text-[9px] text-muted-foreground bg-white/50 p-2 rounded border border-dashed">
                <p className="font-bold mb-1 underline">CRITÉRIOS OFICIAIS APLICADOS:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>Ciclo 2026+</li>
                  <li>Vínculo Ativo</li>
                  <li>UPDATE_REQUIRED</li>
                  <li>Telefone Válido</li>
                  <li>Identidade RESOLVED</li>
                </ul>
              </div>
            </div>
          )}

          {result && (
            <div className={`p-4 rounded-lg border-2 font-mono text-[10px] space-y-3 ${result.ok ? 'bg-primary/5 border-primary/20' : 'bg-red-50 border-red-200'}`}>
              <p className={`font-bold text-xs border-b pb-1 mb-2 ${result.ok ? 'text-primary border-primary/20' : 'text-red-700 border-red-200'}`}>
                RESULTADO DRY RUN (SINGLE)
              </p>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <span className="text-muted-foreground uppercase">Associado:</span>
                <span className="font-bold">{result.patient ? `${result.patient.id}` : "NÃO ENCONTRADO"}</span>
                
                <span className="text-muted-foreground uppercase">URL Usada:</span>
                <span className="font-bold truncate">{result.url_used || "N/A"}</span>

                <span className="text-muted-foreground uppercase">Webhook Status:</span>
                <span className={`font-bold ${result.webhook_status === 200 ? 'text-green-600' : 'text-red-600'}`}>
                  {result.webhook_status || "N/A"}
                </span>
                
                {result.error_code && (
                  <>
                    <span className="text-muted-foreground uppercase text-red-700">Erro Interno:</span>
                    <span className="font-bold text-red-700">{result.error_code}</span>
                  </>
                )}

                <span className="text-muted-foreground uppercase">Dry Run Status:</span>
                <span className="font-bold">{result.ok ? "TRUE (READ-ONLY)" : "FALSE (BLOCKED)"}</span>
              </div>

              {result.n8n_response && (
                <div className="mt-2 pt-2 border-t border-dashed border-muted-foreground/30">
                  <p className="text-[9px] text-muted-foreground mb-1 uppercase font-bold">Resposta do n8n (Payload):</p>
                  <pre className="text-[9px] bg-white/70 p-2 rounded overflow-auto max-h-40 border border-muted-foreground/20 text-black">
                    {typeof result.n8n_response === 'string' ? result.n8n_response : JSON.stringify(result.n8n_response, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
