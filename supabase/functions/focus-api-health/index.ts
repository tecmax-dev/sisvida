import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const started = performance.now();
  const correlationId = crypto.randomUUID();

  try {
    const body = await req.json().catch(() => ({}));
    const tenantId = typeof body.tenant_id === "string" ? body.tenant_id : "";
    if (!tenantId) throw new Error("tenant_id obrigatório");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const { data: tenant } = await supabase.from("tenants").select("id,trade_name").eq("id", tenantId).maybeSingle();
    if (!tenant) throw new Error("Tenant não encontrado");

    const { data: fiscal, error } = await supabase
      .from("pdv_fiscal_company_settings")
      .select("focus_nfe_environment, active_provider, focus_nfe_token")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (error) throw error;

    const token = fiscal?.focus_nfe_token;
    const baseUrl = Deno.env.get("FOCUS_NFE_BASE_URL")?.replace(/\/$/, "");
    if (!token || !baseUrl) {
      return new Response(JSON.stringify({ ok: false, status: "misconfigured", latency_ms: Math.round(performance.now() - started), correlation_id: correlationId, reason: !baseUrl ? "URL base não configurada no servidor" : "Credencial não configurada" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
    }

    const response = await fetch(`${baseUrl}/`, { headers: { Authorization: `Basic ${btoa(`${token}:`)}`, Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
    const result = { ok: response.ok, status: response.status, status_text: response.statusText, latency_ms: Math.round(performance.now() - started), correlation_id: correlationId, environment: fiscal?.focus_nfe_environment ?? "unknown" };
    await supabase.from("integration_credentials").update({ status: response.ok ? "connected" : "error", last_connection_test: new Date().toISOString(), last_error: response.ok ? null : `HTTP ${response.status}`, needs_reconfiguration: !response.ok }).eq("tenant_id", tenantId).eq("provider", "focus_nfe");
    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, status: "error", latency_ms: Math.round(performance.now() - started), correlation_id: correlationId, reason: error instanceof Error ? error.message : "Erro desconhecido" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
  }
});
