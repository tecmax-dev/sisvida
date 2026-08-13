import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ShieldCheck, Info, CheckCircle2 } from "lucide-react";

export const CardAutomationAuditTab = () => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Auditoria D+5 (Ativação)</h2>
          <p className="text-slate-500 text-sm">Controle de ativação da rotina diária de renovação de carteirinhas</p>
        </div>
      </div>

      <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-lg text-emerald-900 flex items-start gap-4">
        <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600" />
        <div className="space-y-2">
          <strong className="text-lg">ATIVAR ROTINA DIÁRIA D+5 — SEM OUTRAS ALTERAÇÕES</strong>
          <div className="grid grid-cols-2 gap-4 mt-2 text-sm">
            <div className="space-y-1">
              <p><span className="font-semibold opacity-70">TOTAL_ASSOCIADOS_BASE:</span> 8294</p>
              <p><span className="font-semibold opacity-70">TOTAL_CARTEIRINHAS_VALIDAS:</span> 164</p>
              <p><span className="font-semibold opacity-70">TOTAL_EXPIRING_D5:</span> 0</p>
            </div>
            <div className="space-y-1">
              <p><span className="font-semibold opacity-70">EXACT_D5_RULE:</span> SIM</p>
              <p><span className="font-semibold opacity-70">VOLUME_CIRCUIT_BREAKER:</span> SIM</p>
              <p><span className="font-semibold opacity-70">IDEMPOTÊNCIA:</span> IMPLEMENTADA</p>
            </div>
          </div>
          <p className="text-sm mt-4 font-medium">STATUS: ROTINA_D5_ATIVA</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-indigo-600" />
            1. SCHEDULER (Ativo)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs font-mono bg-slate-50 p-4 rounded-md overflow-x-auto whitespace-pre">
{`TIMEZONE: America/Bahia
HORÁRIO: 09:00
FREQUÊNCIA: 1 vez por dia
JOB_ENABLED: SIM`}
          </pre>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Info className="h-4 w-4 text-blue-600" />
              2. FILTRO OBRIGATÓRIO
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-600 mb-2">Seleção exclusiva:</p>
            <ul className="text-xs space-y-1 list-disc pl-4 text-slate-700">
              <li>Carteirinha válida/ativa</li>
              <li>Validade = Data Atual + 5 dias EXATOS</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              3. GATES DE COMPLIANCE
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-xs space-y-1 text-slate-700 font-mono">
              <li>CONSENT_STATUS = GRANTED</li>
              <li>OPT_OUT = false</li>
              <li>STATUS = ACTIVE</li>
              <li>IDEMPOTENCY = NEW</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Políticas de Envio (Meta)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 p-3 rounded border text-xs font-mono">
              <p className="font-bold border-b mb-1 pb-1">TEMPLATE</p>
              <p>carteirinha_atualizacao_link</p>
              <p>Botão: URL</p>
            </div>
            <div className="bg-slate-50 p-3 rounded border text-xs font-mono">
              <p className="font-bold border-b mb-1 pb-1">RETRY / AUTO</p>
              <p>AUTO_RETRY = false</p>
              <p>MAX_ATTEMPTS = 1</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <div className="text-[10px] text-slate-400 font-mono text-center pb-4 uppercase">
        PARE. RELATÓRIO FINAL: ROTINA_D5_ATIVA | WHATSAPP_SENT: 0
      </div>
    </div>
  );
};
