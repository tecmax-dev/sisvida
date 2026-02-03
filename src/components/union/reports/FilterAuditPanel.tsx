import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  ChevronDown, 
  ChevronUp, 
  Clock, 
  Database, 
  FileJson, 
  Filter as FilterIcon,
  CheckCircle2,
  Copy,
} from "lucide-react";
import { toast } from "sonner";

export interface FilterAuditData {
  receivedAt: string;
  payload: Record<string, any>;
  queryDescription: string;
  filtersApplied: string[];
  rowCount: number;
  executionTimeMs: number;
}

interface FilterAuditPanelProps {
  data: FilterAuditData;
}

export function FilterAuditPanel({ data }: FilterAuditPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  return (
    <Card className="border-2 border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <Database className="h-4 w-4" />
            Auditoria do Filtro (Backend)
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs font-mono bg-white dark:bg-background">
              <Clock className="h-3 w-3 mr-1" />
              {data.executionTimeMs}ms
            </Badge>
            <Badge variant="secondary" className="text-xs font-mono">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              {data.rowCount} registros
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4 pt-2">
          {/* Payload Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold flex items-center gap-1 text-muted-foreground">
                <FileJson className="h-3 w-3" />
                Payload Enviado
              </h4>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={() => copyToClipboard(JSON.stringify(data.payload, null, 2), "Payload")}
              >
                <Copy className="h-3 w-3 mr-1" />
                Copiar
              </Button>
            </div>
            <ScrollArea className="h-32 rounded border bg-slate-950 p-3">
              <pre className="text-xs text-emerald-400 font-mono whitespace-pre-wrap">
                {JSON.stringify(data.payload, null, 2)}
              </pre>
            </ScrollArea>
          </div>

          {/* Filters Applied Section */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold flex items-center gap-1 text-muted-foreground">
              <FilterIcon className="h-3 w-3" />
              Filtros Aplicados na Query
            </h4>
            <div className="flex flex-wrap gap-1">
              {data.filtersApplied.map((filter, idx) => (
                <Badge 
                  key={idx} 
                  variant="outline" 
                  className="text-xs font-mono bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800"
                >
                  {filter}
                </Badge>
              ))}
            </div>
          </div>

          {/* Query Description Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold flex items-center gap-1 text-muted-foreground">
                <Database className="h-3 w-3" />
                Query Final Executada
              </h4>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={() => copyToClipboard(data.queryDescription, "Query")}
              >
                <Copy className="h-3 w-3 mr-1" />
                Copiar
              </Button>
            </div>
            <ScrollArea className="h-24 rounded border bg-slate-950 p-3">
              <pre className="text-xs text-cyan-400 font-mono whitespace-pre-wrap break-all">
                {data.queryDescription}
              </pre>
            </ScrollArea>
          </div>

          {/* Metadata */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
            <span>
              <strong>Recebido em:</strong> {new Date(data.receivedAt).toLocaleString('pt-BR')}
            </span>
            <span>
              <strong>Tempo de execução:</strong> {data.executionTimeMs}ms
            </span>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
