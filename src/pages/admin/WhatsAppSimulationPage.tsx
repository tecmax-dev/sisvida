import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export default function WhatsAppSimulationPage() {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  const updateWorkflow = async () => {
    setLoading(true);
    setStatus("Atualizando workflow...");
    try {
      const { data, error } = await supabase.functions.invoke('n8n-send-gate', {
        body: {
          action: 'update',
          workflowId: '4eAe0hUefSYlFJNM'
        }
      });
      if (error) throw error;
      setStatus("Workflow atualizado com sucesso!");
    } catch (e: any) {
      setStatus("Erro ao atualizar: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const runAudit = async () => {
    setLoading(true);
    setStatus("Executando disparo...");
    try {
      const ts = Date.now();
      const { data, error } = await supabase.functions.invoke('n8n-send-gate', {
        body: {
          action: 'execute-one-shot',
          payload: {
            cpf: '55905552568',
            event: 'CARTEIRINHA_ATUALIZACAO_NECESSARIA',
            template_name: 'carteirinha_atualizacao_necessaria',
            template_language: 'pt_BR',
            request_id: `audit-v2-req-${ts}`,
            idempotency_key: `audit-v2-idem-${ts}`,
            intent: 'carteirinha'
          }
        }
      });
      
      if (error) throw error;
      setReport(data);
      setStatus("Disparo concluído!");
    } catch (e: any) {
      setStatus("Erro no disparo: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 font-mono text-sm bg-slate-950 text-slate-200 min-h-screen">
      <h1 className="text-xl font-bold mb-6 text-teal-400">CORREÇÃO ÚNICA — ENVIAR TEMPLATE VIA template_params NO CHATWOOT</h1>
      
      <div className="flex gap-4 mb-8">
        <div className="flex-1 bg-slate-900 border border-slate-800 p-6 rounded-lg">
          <h2 className="text-teal-400 font-bold mb-2 uppercase text-xs underline">Passo 1: Sincronizar</h2>
          <p className="text-[10px] text-slate-400 mb-4">Atualiza a lógica do workflow no n8n para aceitar o novo payload.</p>
          <button 
            onClick={updateWorkflow}
            disabled={loading}
            className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded font-bold disabled:opacity-50 text-xs w-full"
          >
            ATUALIZAR WORKFLOW n8n
          </button>
        </div>

        <div className="flex-1 bg-slate-900 border border-slate-800 p-6 rounded-lg">
          <h2 className="text-red-400 font-bold mb-2 uppercase text-xs underline">Passo 2: Disparar</h2>
          <p className="text-[10px] text-slate-400 mb-4">Executa o envio REAL utilizando template_params (One-Shot).</p>
          <button 
            onClick={runAudit}
            disabled={loading}
            className="bg-teal-600 hover:bg-teal-500 text-white px-4 py-2 rounded font-bold disabled:opacity-50 text-xs w-full"
          >
            EXECUTAR DISPARO REAL
          </button>
        </div>
      </div>

      {status && (
        <div className="mb-4 p-2 bg-slate-800 rounded text-[10px] text-center text-teal-300">
          {status}
        </div>
      )}

      {report && (
        <div className="bg-black border border-teal-900/50 p-6 rounded-lg overflow-auto max-h-[500px]">
          <h3 className="text-teal-400 font-bold mb-4 text-xs underline uppercase">Resultado do Disparo</h3>
          <pre className="text-[10px] text-teal-500/90">{JSON.stringify(report, null, 2)}</pre>
          
          <div className="mt-8 pt-6 border-t border-slate-800 grid grid-cols-2 gap-4 text-[10px]">
            <div>
              <p className="font-bold text-slate-400 mb-2 underline uppercase">Audit Log</p>
              <p>REASON_CODE: <span className={report.result?.reason_code === 'SEND_ALLOWED' || report.result?.reason_code === 'SEND_ENABLED' ? 'text-green-400' : 'text-yellow-400'}>{report.result?.reason_code}</span></p>
              <p>CONTACT_ID: {report.result?.contact_id || '...'}</p>
              <p>CONVERSATION_ID: {report.result?.conversation_id || '...'}</p>
              <p>CONSENT: {report.result?.consent_status}</p>
            </div>
            <div>
              <p className="font-bold text-slate-400 mb-2 underline uppercase">Chatwoot API</p>
              <p>HTTP STATUS: {report.http}</p>
              <p>MESSAGE_ID: {report.result_payload?.id || '...'}</p>
              <p>TYPE: {report.result_payload?.content_type || report.result_payload?.message_type}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
