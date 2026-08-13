import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, CheckCircle2, AlertTriangle, Terminal, Info, Lock } from "lucide-react";

export const HomologacaoAuditTab = () => {
  return (
    <div className="space-y-6">
      <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-lg text-emerald-900 flex items-start gap-4">
        <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600" />
        <div className="space-y-2 text-sm">
          <p className="font-bold">STATUS: SUBMISSÃO MANUAL ÚNICA — TEMPLATE HOMOLOGAÇÃO</p>
          <p>AUTORIZO EXCLUSIVAMENTE a submissão do template abaixo à Meta.</p>
        </div>
      </div>

      <Card className="border-blue-200 shadow-sm">
        <CardHeader className="bg-slate-50 border-b">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-xl flex items-center gap-2">
                <ShieldCheck className="h-6 w-6 text-blue-600" />
                Especificação do Template: homologacao_confirmada
              </CardTitle>
              <CardDescription className="font-mono text-[10px] uppercase">
                GRAPH_POST_COUNT: máximo 1 | AUTO_RETRY: false
              </CardDescription>
            </div>
            <Badge variant="outline" className="font-mono bg-blue-50">UTILITY / pt_BR</Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          <div className="space-y-4">
            <div className="p-4 bg-slate-900 rounded-lg text-slate-100 font-mono text-sm leading-relaxed">
              <p className="text-slate-400 mb-2">// CONTEÚDO DO TEMPLATE</p>
              <p>Olá, {"{{1}}"}. A homologação foi agendada com sucesso.</p>
              <br />
              <p>Data: {"{{2}}"}</p>
              <p>Horário: {"{{3}}"}</p>
              <p>Local: {"{{4}}"}</p>
              <p>Protocolo: {"{{5}}"}</p>
              <br />
              <p>Para consultar os dados do agendamento, toque no botão abaixo.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 border rounded-lg bg-muted/30">
                <div className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Botão</div>
                <div className="text-sm font-medium">Ver agendamento</div>
              </div>
              <div className="p-3 border rounded-lg bg-muted/30">
                <div className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Tipo de Botão</div>
                <div className="text-sm font-medium">URL (Dinâmica Segura)</div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-bold text-sm flex items-center gap-2 uppercase tracking-wider text-slate-700">
              <Lock className="h-4 w-4" />
              Protocolo de Segurança e Compliance
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex items-start gap-3 p-3 border rounded-lg">
                <Info className="h-4 w-4 text-blue-500 mt-0.5" />
                <div className="text-xs">
                  <p className="font-bold mb-1">ANTES DO POST</p>
                  <p className="text-muted-foreground">Validar TOKEN_META_VALID e WABA_ACCESS. Consultar existência prévia (name + language).</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 border rounded-lg">
                <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5" />
                <div className="text-xs">
                  <p className="font-bold mb-1">SE JÁ EXISTIR</p>
                  <p className="text-muted-foreground">NÃO criar outro. NÃO alterar. NÃO duplicar. Retornar ID/Status e PARE.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 border rounded-lg">
                <Terminal className="h-4 w-4 text-slate-500 mt-0.5" />
                <div className="text-xs">
                  <p className="font-bold mb-1">EXECUÇÃO DO POST</p>
                  <p className="text-muted-foreground">Exatamente UM POST. Sem auto-retry. Sem background-retry. Registrar erro e PARE.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 border rounded-lg">
                <ShieldCheck className="h-4 w-4 text-emerald-500 mt-0.5" />
                <div className="text-xs">
                  <p className="font-bold mb-1">PROVA OBRIGATÓRIA</p>
                  <p className="text-muted-foreground">Confirmar via meta_template_id + status. Executar READ_AFTER_WRITE na Graph API.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg space-y-2">
            <p className="text-xs text-amber-900 font-bold uppercase flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Restrições Absolutas
            </p>
            <ul className="text-[10px] text-amber-800 grid grid-cols-2 gap-x-4 gap-y-1 list-disc list-inside">
              <li>NÃO enviar WhatsApp</li>
              <li>NÃO testar após submissão</li>
              <li>NÃO alterar WABA/PhoneID</li>
              <li>NÃO alterar Webhook/Chatwoot</li>
              <li>NÃO alterar código de fluxo</li>
              <li>NÃO modificar após POST</li>
            </ul>
          </div>

          <div className="flex flex-col gap-2 pt-4 border-t font-mono text-[9px] text-muted-foreground uppercase">
            <div className="flex justify-between">
              <span>WHATSAPP_SENT: 0</span>
              <span>AUTO_RETRY: DESATIVADO</span>
              <span>META_CONFIG_CHANGED: NÃO</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>TEMPLATE: homologacao_confirmada</span>
              <span>STATUS: READY_FOR_MANUAL_SUBMISSION</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
