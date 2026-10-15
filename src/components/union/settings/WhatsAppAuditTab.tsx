import React, { useEffect, useState } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, XCircle, AlertCircle, Loader2, Send, ShieldCheck, Zap, MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { MetaTokenConfig } from "@/components/portals/MetaTokenConfig";

export const WhatsAppAuditTab = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [complianceLogs, setComplianceLogs] = useState<any[]>([]);
  const [mirrorLogs, setMirrorLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshData = async () => {
    setLoading(true);
    const { data: incomingLogs } = await supabase
      .from('whatsapp_incoming_logs' as any)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    
    const { data: compLogs } = await supabase
      .from('whatsapp_compliance_logs' as any)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    // Registro real da tentativa de espelhar cada lembrete/notificação no
    // Chatwoot (intent termina em _CHATWOOT_MIRROR). Antes disso, quando o
    // espelho falhava ou era pulado por configuração incompleta, nada ficava
    // visível aqui — o gestor via os lembretes como "enviados" sem nenhum
    // rastro no Chatwoot para conferir.
    const { data: mirrorData } = await supabase
      .from('whatsapp_compliance_logs' as any)
      .select('*')
      .like('intent', '%_CHATWOOT_MIRROR')
      .order('created_at', { ascending: false })
      .limit(15);

    setLogs(incomingLogs || []);
    setComplianceLogs(compLogs || []);
    setMirrorLogs(mirrorData || []);
    setLoading(false);
  };

  useEffect(() => { refreshData(); }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Auditoria WhatsApp (Síncrono)</h2>
          <p className="text-slate-500 text-sm">Monitoramento em tempo real da Arquitetura v2.0.x</p>
        </div>
        <Button onClick={refreshData} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
          Atualizar Auditoria
        </Button>
      </div>

      <MetaTokenConfig />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <MessageSquareText className="h-4 w-4 text-emerald-600" />
            Espelho no Chatwoot (lembretes e notificações enviados)
          </CardTitle>
          <p className="text-xs text-slate-500">
            Cada lembrete/notificação enviado pelo WhatsApp oficial tenta registrar uma nota privada
            no Chatwoot. Aqui aparece o resultado real dessa tentativa: espelhado, pulado (configuração
            incompleta) ou falhou.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {mirrorLogs.map((log) => {
            const decision = String(log.decision || '');
            const ok = decision === 'MIRRORED';
            const skipped = decision === 'SKIPPED';
            return (
              <div key={log.id} className="text-xs border-b pb-2 last:border-0">
                <div className="flex justify-between text-slate-400 mb-1">
                  <span className="font-bold text-slate-600">{String(log.intent || '').replace('_CHATWOOT_MIRROR', '')}</span>
                  <span>{new Date(log.created_at).toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  {ok ? (
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                  ) : skipped ? (
                    <AlertCircle className="h-3 w-3 text-amber-500" />
                  ) : (
                    <XCircle className="h-3 w-3 text-red-500" />
                  )}
                  <span className={ok ? 'text-green-700' : skipped ? 'text-amber-700' : 'text-red-700'}>
                    {decision} — {log.metadata?.reason || 'N/A'} ({log.metadata?.phone || 'sem telefone'})
                  </span>
                </div>
              </div>
            );
          })}
          {mirrorLogs.length === 0 && (
            <p className="text-slate-400 text-sm italic">
              Nenhuma tentativa de espelho registrada ainda. Envie um lembrete de teste e atualize esta tela.
            </p>
          )}
          {mirrorLogs.some((l) => l.decision === 'SKIPPED') && (
            <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-800 text-xs">
              Alguns envios foram <strong>pulados</strong> (SKIPPED): verifique em Integrações → Chatwoot/ZAPRESPONDE
              se o Token, a URL e a <strong>Inbox</strong> estão configurados e selecionados para esta clínica.
              Sem a inbox selecionada, o espelho nunca é criado.
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Send className="h-4 w-4 text-teal-600" />
              Entradas Recentes (Incoming)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {logs.map((log) => (
              <div key={log.id} className="text-xs border-b pb-2 last:border-0">
                <div className="flex justify-between text-slate-400 mb-1">
                  <span>{log.phone}</span>
                  <span>{new Date(log.created_at).toLocaleTimeString()}</span>
                </div>
                <div className="font-medium text-slate-700 truncate">{log.message_text || 'Sem texto'}</div>
              </div>
            ))}
            {logs.length === 0 && <p className="text-slate-400 text-sm italic">Sem logs de entrada.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-indigo-600" />
              Decisões de Compliance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {complianceLogs.map((log) => (
              <div key={log.id} className="text-xs border-b pb-2 last:border-0">
                <div className="flex justify-between text-slate-400 mb-1">
                  <span className="font-bold text-indigo-600">{log.intent}</span>
                  <span>{new Date(log.created_at).toLocaleTimeString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  {log.decision === 'ALLOW' ? <CheckCircle2 className="h-3 w-3 text-green-500" /> : <XCircle className="h-3 w-3 text-red-500" />}
                  <span className={log.decision === 'ALLOW' ? 'text-green-700' : 'text-red-700'}>
                    {log.decision} - ID: {log.chatwoot_message_id || 'N/A'}
                  </span>
                </div>
              </div>
            ))}
            {complianceLogs.length === 0 && <p className="text-slate-400 text-sm italic">Sem decisões registradas.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
