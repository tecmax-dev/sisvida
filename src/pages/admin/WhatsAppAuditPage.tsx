import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { 
  RefreshCw, 
  Search,
  ArrowDownLeft,
  ArrowUpRight,
  ClipboardList,
  CheckCircle2,
  AlertCircle,
  LayoutDashboard,
  Database
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AuditLog {
  id: string;
  phone: string;
  direction: 'incoming' | 'outgoing';
  content: string;
  message_type: string;
  button_id: string;
  session_state: string;
  metadata: any;
  created_at: string;
}

export default function WhatsAppAuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("whatsapp_audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (searchTerm) {
        query = query.or(`phone.ilike.%${searchTerm}%,content.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Map data to ensure type safety for 'direction'
      const formattedLogs = (data || []).map((item: any) => ({
        ...item,
        direction: item.direction as 'incoming' | 'outgoing'
      }));
      
      setLogs(formattedLogs);
    } catch (error) {
      console.error("Erro ao buscar auditoria:", error);
      toast.error("Falha ao carregar logs de auditoria");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-primary" />
            Auditoria WhatsApp (Meta API)
          </h1>
          <p className="text-muted-foreground">Rastreamento completo de mensagens e estados da state machine</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchLogs} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filtrar por número ou conteúdo da mensagem..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchLogs()}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Database className="h-5 w-5 text-primary" />
              Fluxo de Mensagens
            </CardTitle>
            <CardDescription>Auditoria em tempo real (Número de Produção: 73 3223 9980)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-hidden">
              <div className="grid grid-cols-12 bg-muted/50 p-3 text-xs font-medium border-b uppercase tracking-wider text-muted-foreground">
                <div className="col-span-2">Horário</div>
                <div className="col-span-2">Número</div>
                <div className="col-span-1">Fluxo</div>
                <div className="col-span-3">Mensagem / Botão</div>
                <div className="col-span-2">Estado (Session)</div>
                <div className="col-span-2">Status Meta</div>
              </div>
              <ScrollArea className="h-[600px]">
                {logs.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    {loading ? "Carregando..." : "Nenhum log encontrado."}
                  </div>
                ) : (
                  <div className="divide-y">
                    {logs.map((log) => (
                      <div key={log.id} className="grid grid-cols-12 p-3 text-sm items-start hover:bg-muted/30 transition-colors">
                        <div className="col-span-2 text-xs text-muted-foreground">
                          {format(new Date(log.created_at), "dd/MM HH:mm:ss", { locale: ptBR })}
                        </div>
                        <div className="col-span-2 font-mono text-xs">
                          {log.phone}
                        </div>
                        <div className="col-span-1">
                          {log.direction === 'incoming' ? (
                            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200 gap-1">
                              <ArrowDownLeft className="h-3 w-3" /> IN
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200 gap-1">
                              <ArrowUpRight className="h-3 w-3" /> OUT
                            </Badge>
                          )}
                        </div>
                        <div className="col-span-3 pr-2">
                          <div className="font-medium text-xs break-words">
                            {log.content || (log.button_id ? `ID: ${log.button_id}` : "-")}
                          </div>
                          {log.button_id && log.content && (
                             <div className="text-[10px] text-muted-foreground mt-1">
                               Botão ID: <span className="font-mono">{log.button_id}</span>
                             </div>
                          )}
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            Tipo: {log.message_type}
                          </div>
                        </div>
                        <div className="col-span-2">
                          <Badge variant="outline" className="font-mono text-[10px] bg-amber-50 text-amber-700 border-amber-100">
                            <LayoutDashboard className="h-3 w-3 mr-1" />
                            {log.session_state}
                          </Badge>
                        </div>
                        <div className="col-span-2">
                          {log.direction === 'outgoing' ? (
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-1">
                                {log.metadata?.status === 200 ? (
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                ) : (
                                  <AlertCircle className="h-3.5 w-3.5 text-rose-500" />
                                )}
                                <span className={log.metadata?.status === 200 ? "text-emerald-600 font-bold" : "text-rose-600 font-bold"}>
                                  {log.metadata?.status || "???"}
                                </span>
                              </div>
                              {log.metadata?.response && (
                                <div className="text-[9px] text-muted-foreground truncate max-w-[120px]" title={typeof log.metadata.response === 'string' ? log.metadata.response : JSON.stringify(log.metadata.response)}>
                                  {typeof log.metadata.response === 'string' ? log.metadata.response : JSON.stringify(log.metadata.response)}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs italic">Recebido</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}