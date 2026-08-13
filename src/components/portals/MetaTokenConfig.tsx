import React, { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, ShieldCheck, ShieldAlert } from "lucide-react";

/**
 * Campo seguro para inserção manual do token atual da Meta API.
 * O valor nunca é persistido no frontend (sem localStorage/sessionStorage/logs)
 * e nunca é retornado pelo backend.
 */
export const MetaTokenConfig = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<{ configured: boolean; updated_at: string | null }>({
    configured: false,
    updated_at: null,
  });
  const [verifying, setVerifying] = useState(false);
  const [audit, setAudit] = useState<any>(null);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("meta-token-vault", {
        body: { action: "status" },
      });
      if (!error && data) {
        setStatus({ configured: !!data.configured, updated_at: data.updated_at ?? null });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleSave = async () => {
    setAudit(null);
    const value = inputRef.current?.value ?? "";
    if (!value.trim()) {
      toast.error("Informe o token antes de salvar.");
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("meta-token-vault", {
        body: { action: "save", token: value },
      });
      if (error || !data?.success) {
        console.error("Erro ao salvar token:", error || data);
        const errorMsg = error?.message || data?.error || "Verifique suas permissões.";
        toast.error(`Não foi possível salvar o token: ${errorMsg}`);
        return;
      }
      if (inputRef.current) inputRef.current.value = "";
      setShow(false);
      toast.success("TOKEN META ATUALIZADO COM SUCESSO");
      await loadStatus();
    } catch {
      toast.error("Não foi possível salvar o token.");
    } finally {
      setSaving(false);
    }
  };

  const handleVerify = async () => {
    setVerifying(true);
    setAudit(null);
    try {
      const { data, error } = await supabase.functions.invoke("meta-token-vault", {
        body: { action: "verify" },
      });
      if (error) {
        toast.error("Não foi possível auditar o token.");
        return;
      }
      setAudit(data);
      if (data?.ok) toast.success("TOKEN FUNCIONAL");
      else toast.error("TOKEN NÃO FUNCIONAL");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {status.configured ? (
            <ShieldCheck className="h-5 w-5 text-primary" />
          ) : (
            <ShieldAlert className="h-5 w-5 text-muted-foreground" />
          )}
          Token Meta (WhatsApp Cloud API)
        </CardTitle>
        <CardDescription>
          Inserção manual do token atual da Meta. O valor é enviado diretamente ao cofre seguro do
          backend e nunca é exibido novamente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border p-3 text-sm space-y-1">
          <div>
            <span className="font-medium">TOKEN CONFIGURADO: </span>
            {loading ? "..." : status.configured ? "SIM" : "NÃO"}
          </div>
          {status.updated_at && (
            <div className="text-muted-foreground">
              ÚLTIMA ATUALIZAÇÃO: {status.updated_at ? new Date(status.updated_at).toLocaleString("pt-BR") : "N/A"}
            </div>
          )}
          <div className="text-muted-foreground">SECRET DESTINO: META_WHATSAPP_TOKEN_V2</div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="meta-token">TOKEN META ATUAL</Label>
          <div className="flex gap-2">
            <Input
              id="meta-token"
              ref={inputRef}
              type={show ? "text" : "password"}
              autoComplete="off"
              spellCheck={false}
              placeholder="••••••••••••••••"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setShow((v) => !v)}
              aria-label={show ? "Ocultar token" : "Exibir token"}
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            SALVAR TOKEN META
          </Button>
          <Button variant="outline" onClick={handleVerify} disabled={verifying || !status.configured}>
            {verifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            AUDITAR TOKEN (SOMENTE LEITURA)
          </Button>
        </div>

        {audit && (
          <div className="rounded-md border p-4 text-sm space-y-3 bg-muted/30">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="text-muted-foreground uppercase text-[10px] font-bold">Relatório Final</div>
                <div className="font-bold flex items-center gap-2">
                  GRAPH API VALIDADA: {audit.me_http === 200 ? "SIM" : "NÃO"}
                </div>
                <div>META_HTTP: {audit.me_http ?? "-"}</div>
                <div>SECRET DESTINO: META_WHATSAPP_TOKEN_V2</div>
              </div>
              <div className="space-y-1">
                <div className="text-muted-foreground uppercase text-[10px] font-bold">Identificadores Meta</div>
                <div>APP_ID ATUAL: {audit.app_id}</div>
                <div>WABA_ID ATUAL: {audit.waba_id}</div>
                <div>PHONE_NUMBER_ID ATUAL: {audit.phone_id}</div>
              </div>
            </div>

            <div className="border-t pt-3 space-y-1">
              <div className="text-muted-foreground uppercase text-[10px] font-bold">Template & Sync</div>
              <div className="font-bold">TEMPLATE ENCONTRADO: {audit.template_found ? "SIM" : "NÃO"}</div>
              <div>TEMPLATE: {audit.template_name} ({audit.language})</div>
              <div>META_STATUS_REAL: <span className="uppercase">{audit.meta_status_real ?? "N/A"}</span></div>
              <div className="flex gap-4 text-xs pt-1">
                <div>LOCAL_STATUS_BEFORE: <span className="uppercase font-mono">{audit.local_status_before ?? "NULL"}</span></div>
                <div>LOCAL_STATUS_AFTER: <span className="uppercase font-mono text-primary">{audit.local_status_after ?? "N/A"}</span></div>
              </div>
              <div className="font-bold text-xs pt-1 text-primary">
                SYNC CONFIRMED: {audit.sync_confirmed ? "SIM" : "NÃO"}
              </div>
            </div>

            <div className="border-t pt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px] uppercase font-bold text-muted-foreground">
              <div>MENSAGENS ENVIADAS: {audit.messages_sent}</div>
              <div>META SEND: {audit.meta_send}</div>
              <div>WHATSAPP ENVIADO: {audit.whatsapp_enviado}</div>
              <div>N8N ALTERADO: NÃO</div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-[10px] uppercase font-bold text-muted-foreground">
              <div>CHATWOOT ALTERADO: NÃO</div>
              <div>SEND GATE ALTERADO: NÃO</div>
              <div>DRY RUN ALTERADO: NÃO</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
