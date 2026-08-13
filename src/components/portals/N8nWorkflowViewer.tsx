import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ExternalLink, Activity, Workflow, Info, CheckCircle2, XCircle, ArrowDown } from "lucide-react";

interface N8nWorkflowViewerProps {
  clinicId: string;
  workflowId: string;
}

export const N8nWorkflowViewer = ({ clinicId, workflowId }: N8nWorkflowViewerProps) => {
  const { data: workflow, isLoading, error } = useQuery({
    queryKey: ["n8n-workflow", workflowId, clinicId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('chatwoot-integration', {
        body: { 
          clinicId, 
          action: 'get-workflow',
          workflow_id: workflowId
        }
      });
      if (error) throw error;
      return data;
    }
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground">Carregando detalhes do workflow...</span>
        </CardContent>
      </Card>
    );
  }

  if (error || !workflow) {
    return (
      <Card className="border-destructive">
        <CardContent className="flex items-center gap-3 py-6 text-destructive">
          <XCircle className="h-5 w-5" />
          <span>Erro ao carregar workflow da API do n8n.</span>
        </CardContent>
      </Card>
    );
  }

  const nodes = workflow.nodes || [];
  const connections = workflow.connections || {};

  // Build a simple linked list representation for the "tree" view
  // n8n connections format: { "NodeName": { "main": [ [ { "node": "NextNode", "type": "main", "index": 0 } ] ] } }
  const getNextNodes = (nodeName: string) => {
    const nodeConnections = connections[nodeName];
    if (!nodeConnections || !nodeConnections.main) return [];
    
    const results: any[] = [];
    nodeConnections.main.forEach((outputGroup: any[]) => {
      outputGroup.forEach((conn: any) => {
        results.push({
          target: conn.node,
          type: conn.type,
          index: conn.index
        });
      });
    });
    return results;
  };

  const renderNode = (node: any) => {
    const nextNodes = getNextNodes(node.name);
    
    return (
      <div key={node.id || node.name} className="flex flex-col items-center">
        {/* Node Card */}
        <div className={`w-full max-w-md p-4 border-2 rounded-xl shadow-sm ${node.disabled ? 'opacity-60 bg-muted/20 border-muted' : 'bg-card border-primary/20 hover:border-primary/40 transition-colors'}`}>
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-md ${node.disabled ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'}`}>
                <Workflow className="h-4 w-4" />
              </div>
              <span className="font-bold text-sm tracking-tight">{node.name}</span>
            </div>
            <Badge variant="outline" className="text-[10px] uppercase h-5 font-mono">
              {node.type.split('.').pop()}
            </Badge>
          </div>

          <div className="space-y-2 text-[11px]">
            {node.disabled && (
              <div className="flex items-center gap-1 text-red-500 font-bold uppercase tracking-tighter">
                <XCircle className="h-3 w-3" /> Status: Desabilitado
              </div>
            )}
            
            {/* Credential Name */}
            {node.credentials && Object.keys(node.credentials).map(credKey => (
              <div key={credKey} className="flex items-center gap-2 text-muted-foreground">
                <Badge variant="secondary" className="text-[9px] h-4 py-0 px-1 uppercase">Credencial</Badge>
                <span className="font-mono text-foreground">{node.credentials[credKey].id || 'Configurada'}</span>
              </div>
            ))}

            {/* Main Config / Endpoints */}
            {node.parameters && (
              <div className="mt-2 bg-muted/30 p-2 rounded border border-muted-foreground/10 font-mono text-[10px] space-y-1 overflow-x-auto">
                {node.type === 'n8n-nodes-base.webhook' && (
                  <>
                    <div><span className="text-muted-foreground">METHOD:</span> {node.parameters.httpMethod || 'POST'}</div>
                    <div><span className="text-muted-foreground">PATH:</span> {node.parameters.path}</div>
                  </>
                )}
                {node.parameters.url && (
                  <div className="truncate"><span className="text-muted-foreground">URL:</span> {node.parameters.url}</div>
                )}
                {node.parameters.event && (
                  <div><span className="text-muted-foreground">EVENT:</span> {node.parameters.event}</div>
                )}
                {node.type.includes('if') && (
                  <div className="text-blue-600 font-bold tracking-tight">GATE: IF/Conditional Logic</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Connections / Flow Lines */}
        {nextNodes.length > 0 && (
          <div className="flex flex-col items-center py-4 gap-4">
            {nextNodes.map((conn, i) => (
              <React.Fragment key={`${node.name}-to-${conn.target}-${i}`}>
                <div className="flex flex-col items-center">
                  <ArrowDown className="h-6 w-6 text-muted-foreground/40" />
                  <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-[-4px]">
                    {conn.type === 'main' ? 'fluxo' : conn.type}
                  </div>
                </div>
                {/* We render the children in a flattened way for simplicity in this tree view 
                    In a real complex n8n flow we'd use a graph library, but this meets the "visual tree" request */}
                {nodes.find(n => n.name === conn.target) && renderNode(nodes.find(n => n.name === conn.target))}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Find root nodes (nodes that are not targets of any connection)
  const targetNodes = new Set();
  Object.values(connections).forEach((c: any) => {
    c.main?.forEach((group: any) => group.forEach((conn: any) => targetNodes.add(conn.node)));
  });
  const rootNodes = nodes.filter(n => !targetNodes.has(n.name));

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-2">
        <CardHeader className="bg-muted/50 pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Workflow className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl">{workflow.name}</CardTitle>
                <CardDescription className="font-mono text-xs uppercase mt-1">
                  ID: {workflow.id}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={workflow.active ? "default" : "secondary"} className={workflow.active ? "bg-green-600" : ""}>
                {workflow.active ? (
                  <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> ATIVO</span>
                ) : (
                  <span className="flex items-center gap-1"><Activity className="h-3 w-3" /> INATIVO</span>
                )}
              </Badge>
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2"
                onClick={() => window.open(`https://conecta.zapresponde.app/workflow/${workflowId}`, '_blank')}
              >
                <ExternalLink className="h-4 w-4" />
                ABRIR NO n8n
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pt-8 bg-muted/5">
          <div className="flex flex-col items-center space-y-8">
            {rootNodes.length > 0 ? (
              rootNodes.map(root => renderNode(root))
            ) : (
              nodes.length > 0 && renderNode(nodes[0])
            )}
          </div>
        </CardContent>
      </Card>
      
      <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg flex items-start gap-3">
        <div className="p-1 bg-blue-100 rounded text-blue-800">
          <Info className="h-4 w-4" />
        </div>
        <div>
          <p className="text-xs font-semibold text-blue-900 uppercase">Árvore Operacional Real</p>
          <p className="text-xs text-blue-800 mt-1">
            Visualização gerada dinamicamente a partir dos nós e conexões do n8n.
            Ordem de execução: Topo para Baixo.
          </p>
        </div>
      </div>
    </div>
  );
};

