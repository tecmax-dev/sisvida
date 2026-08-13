import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { KeyRound, Loader2, ShieldCheck, ShieldAlert } from "lucide-react";

export const MetaManagementTokenCard = () => {
  const [token, setToken] = useState("");
  const [phoneId, setPhoneId] = useState("1213495528515111"); // ID canônico (Sindexa - +55 73 3223-9980)
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [status, setStatus] = useState<any>(null);
  const [validation, setValidation] = useState<any>(null);
  const [diagnosticReport, setDiagnosticReport] = useState<string[]>([]);

  const loadStatus = async () => {
    const { data } = await supabase.functions.invoke("meta-token-manager", { body: { action: "status" } });
    setStatus(data);
  };

  useEffect(() => { loadStatus(); }, []);

  const handleSave = async () => {
    if (token.trim().length < 30) {
      toast.error("Informe um token Meta válido.");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("meta-token-manager", {
      body: { action: "save", token: token.trim() },
    });
    setSaving(false);
    setToken("");
    if (error || !data?.success) {
      console.error("Erro ao salvar token meta-token-manager:", error || data);
      const errorMsg = error?.message || data?.error || "Verifique suas permissões.";
      toast.error(`Não foi possível salvar o token: ${errorMsg}`);
      return;
    }
    toast.success("Token de gestão Meta salvo com segurança.");
    loadStatus();
  };

  const handleValidate = async () => {
    setValidating(true);
    const { data } = await supabase.functions.invoke("meta-token-manager", { body: { action: "validate", phone_id: phoneId.trim() } });
    setValidating(false);
    setValidation(data);
    
    const report: string[] = [];
    if (data?.success) {
      if (data.token_valid) report.push("✅ Token reconhecido pelo Graph API (GET /me).");
      else report.push("❌ Token INVÁLIDO ou EXPIRADO (Falha no GET /me).");

      if (data.app_association === "1054108440915347") report.push("✅ App ID 1054108440915347 validado.");
      else report.push(`⚠️ App ID: ${data.app_association} (Esperado: 1054108440915347).`);

      if (data.waba_access) report.push(`✅ Acesso ao WABA CANÔNICO ${data.waba_id} confirmado.`);
      else report.push(`❌ Sem acesso ao WABA ${data.waba_id}.`);

      if (data.message_templates_read) report.push("✅ Leitura de templates (READ-ONLY) permitida.");
      else report.push("❌ Falha na leitura de templates.");

      if (phoneId) {
        if (data.phone_valid) report.push(`✅ Phone Number ID ${phoneId} validado.`);
        else report.push(`❌ Phone Number ID ${phoneId} INVÁLIDO ou INACESSÍVEL.`);
      }
      
      toast.success("Diagnóstico concluído.");
    } else {
      report.push(`❌ Erro crítico: ${data?.error || "Desconhecido"}`);
      toast.error(data?.error || "Falha na validação.");
    }
    setDiagnosticReport(report);
  };

  const Flag = ({ ok, label }: { ok: boolean; label: string }) => (
    <div className="flex items-center justify-between text-sm border-b py-1.5 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <Badge variant={ok ? "default" : "destructive"}>{ok ? "OK" : "FALHOU"}</Badge>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="h-4 w-4" />
          Token Meta (WhatsApp Cloud API)
        </CardTitle>
        <CardDescription>
          Token com permissão <code>whatsapp_business_management</code>. Armazenado apenas em cofre criptografado no
          backend — nunca retorna ao navegador nem aparece em logs.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 text-sm">
          {status?.configured ? (
            <><ShieldCheck className="h-4 w-4 text-emerald-600" /> Token configurado
              {status?.updated_at && <span className="text-muted-foreground">em {new Date(status.updated_at).toLocaleString()}</span>}
            </>
          ) : (
            <><ShieldAlert className="h-4 w-4 text-amber-600" /> Nenhum token de gestão configurado</>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="meta-mgmt-token">Token de gestão</Label>
            <Input
              id="meta-mgmt-token"
              type="password"
              autoComplete="off"
              placeholder="••••••••••••••••••••••••"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="meta-phone-id">Phone Number ID para validação</Label>
            <Input
              id="meta-phone-id"
              placeholder="430366223490729"
              value={phoneId}
              onChange={(e) => setPhoneId(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar token de gestão Meta
          </Button>
          <Button variant="outline" onClick={handleValidate} disabled={validating || !status?.configured}>
            {validating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Validar token (somente leitura)
          </Button>
        </div>

        {validation && (
          <div className="rounded-md border p-4 bg-slate-50 space-y-3">
            <h4 className="text-sm font-bold flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Relatório de Diagnóstico Automático
            </h4>
            <div className="space-y-1">
              {diagnosticReport.map((msg, i) => (
                <p key={i} className="text-xs font-medium">{msg}</p>
              ))}
            </div>
            
            <div className="mt-3 pt-3 border-t grid grid-cols-1 gap-2">
              <Flag ok={!!validation.token_valid} label="Graph API Auth (GET /me)" />
              <Flag ok={!!validation.waba_access} label={`Canonical WABA Access (${validation.waba_id})`} />
              <Flag ok={!!validation.message_templates_read} label="Message Templates Read (GET)" />
              {phoneId && <Flag ok={!!validation.phone_valid} label={`Phone ID Access (${phoneId})`} />}
            </div>

            {(validation.me_error || validation.waba_error || validation.phone_error) && (
              <div className="mt-2 p-2 bg-destructive/10 rounded text-[10px] text-destructive font-mono overflow-auto max-h-32">
                {validation.me_error && <div>[ME_ERR]: {validation.me_error}</div>}
                {validation.waba_error && <div>[WABA_ERR]: {validation.waba_error}</div>}
                {validation.phone_error && <div>[PHONE_ERR]: {validation.phone_error}</div>}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
