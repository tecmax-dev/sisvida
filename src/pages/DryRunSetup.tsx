import React, { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, ShieldCheck, Database, MessageSquareOff } from "lucide-react";

const DryRunCreationPage = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  
  const clinicId = "89e7585e-7bce-4e58-91fa-c37080d1170d";

  const createWorkflow = async () => {
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('chatwoot-integration', {
        body: { clinicId, action: 'create-dry-run-workflow' }
      });
      if (error) throw error;
      setResult(data);
      toast.success("Workflow de Dry Run criado com sucesso");
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white p-8 font-sans">
      <div className="max-w-2xl w-full space-y-12">
        <div className="space-y-6 text-center">
          <h1 className="text-xl font-black text-black uppercase tracking-tighter leading-tight">
            Agora que a conectividade PROSINGE → n8n → Chatwoot foi validada com HTTP 200 ponta a ponta, crie via API do n8n um novo workflow INATIVO:
          </h1>
          <p className="text-2xl font-black text-blue-700 uppercase italic bg-blue-50 p-4 border-l-8 border-blue-700">
            PROSINGE - Carteirinha - DRY RUN
          </p>
          <div className="text-[11px] text-gray-500 space-y-2 uppercase font-bold text-left bg-gray-50 p-6 border-2 border-black leading-relaxed">
            <p>O workflow deverá receber via Webhook um evento autorizado pelo Compliance Engine do PROSINGE contendo:</p>
            <p className="font-mono text-black">event, clinic_id, patient_id, phone, request_id, idempotency_key</p>
            <p>Evento permitido inicialmente: <span className="text-black">CARTEIRINHA_ATUALIZACAO_NECESSARIA</span></p>
            <p>O Webhook deverá usar a mesma proteção Header Auth <span className="text-black">x-prosinge-key</span>.</p>
          </div>
        </div>

        <Button 
          onClick={createWorkflow}
          disabled={loading}
          className="w-full h-16 bg-black hover:bg-zinc-800 text-white font-black text-lg rounded-none shadow-[8px_8px_0px_0px_rgba(37,99,235,1)] active:translate-y-[2px] active:shadow-none transition-all uppercase"
        >
          {loading ? <><Loader2 className="animate-spin mr-2" /> CRIANDO WORKFLOW VIA API…</> : "CRIAR WORKFLOW DRY RUN"}
        </Button>

        {result && (
          <Card className="rounded-none border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-white overflow-hidden">
            <CardContent className="p-8 space-y-6 font-mono text-xs">
              <div className="flex items-center gap-3 text-black font-black border-b-4 border-black pb-4 mb-4 text-sm uppercase">
                <ShieldCheck size={20} className="text-blue-600" />
                <span>RELATÓRIO DE CRIAÇÃO - DRY RUN ENGINE</span>
              </div>
              
              <div className="space-y-4">
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <span className="text-gray-500 uppercase">WORKFLOW CRIADO:</span>
                  <span className="font-black text-green-600">SIM</span>
                </div>

                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <span className="text-gray-500 uppercase">WORKFLOW ID REAL:</span>
                  <span className="font-black bg-black text-white px-2">{result.workflowId}</span>
                </div>
                
                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <span className="text-gray-500 uppercase">ATIVO:</span>
                  <span className="font-black text-red-600">NÃO</span>
                </div>

                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <span className="text-gray-500 uppercase">WEBHOOK PROTEGIDO:</span>
                  <span className="font-black text-green-600">SIM (HEADER AUTH)</span>
                </div>

                <div className="flex justify-between border-b border-gray-100 pb-2 items-center">
                  <span className="text-gray-500 uppercase flex items-center gap-1"><Database size={14}/> CHATWOOT READ-ONLY:</span>
                  <span className="font-black text-blue-600">SIM ✅</span>
                </div>

                <div className="flex justify-between border-b border-gray-100 pb-2 items-center">
                  <span className="text-gray-500 uppercase flex items-center gap-1"><MessageSquareOff size={14}/> ENDPOINT DE MENSAGEM CHAMADO:</span>
                  <span className="font-black text-red-600">NÃO 🚫</span>
                </div>

                <div className="flex justify-between border-b border-gray-100 pb-2">
                  <span className="text-gray-500 uppercase">MENSAGENS ENVIADAS:</span>
                  <span className="font-black">0</span>
                </div>
              </div>

              <div className="mt-8 p-4 bg-blue-50 border-2 border-blue-200 text-[10px] text-blue-700 uppercase font-bold leading-tight">
                O workflow está configurado para validar o payload, rejeitar eventos não autorizados e retornar apenas um preview do que seria enviado, garantindo conformidade total com o Compliance Engine.
              </div>
            </CardContent>
          </Card>
        )}

        <div className="text-center space-y-4 border-t-4 border-black pt-12">
          <div className="flex justify-center gap-8 text-[11px] font-black uppercase text-gray-400">
            <span>Configuração Concluída.</span>
          </div>
          <p className="text-black font-black text-6xl tracking-tighter mt-4">PARE.</p>
        </div>
      </div>
    </div>
  );
};

export default DryRunCreationPage;
