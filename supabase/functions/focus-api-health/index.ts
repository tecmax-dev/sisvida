import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CASA_DAS_ANTENAS_TENANT_ID = "9d98a593-4a03-428a-b7a3-f7c7c653158a";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const response = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function requireStaff(req: Request, supabase: ReturnType<typeof createClient>) {
  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) throw new Error("Não autenticado");
  const { data, error } = await supabase.auth.getUser(authorization.slice(7));
  if (error || !data.user) throw new Error("Sessão inválida");
  const role = data.user.app_metadata?.role ?? data.user.user_metadata?.role;
  if (!( ["admin", "staff", "employee"] as string[]).includes(role)) throw new Error("Acesso restrito à equipe");
  return data.user;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const started = performance.now();
  const correlationId = crypto.randomUUID();
  const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

  try {
    await requireStaff(req, supabase);
    if (req.method !== "POST") return response({ ok: false, status: "invalid_method", correlation_id: correlationId }, 405);

    const { data: tenant, error: tenantError } = await supabase.from("tenants").select("id,trade_name").eq("id", CASA_DAS_ANTENAS_TENANT_ID).maybeSingle();
    if (tenantError) throw new Error("Não foi possível consultar o tenant");
    if (!tenant) return response({ ok: false, status: "tenant_not_found", correlation_id: correlationId }, 404);

    const { data: fiscalRows, error: fiscalError } = await supabase
      .from("pdv_fiscal_company_settings")
      .select("focus_nfe_environment, environment, active_provider, focus_nfe_token, updated_at, cnpj, company_name")
      .eq("tenant_id", tenant.id)
      .eq("is_active", true)
      .eq("active_provider", "focus_nfe")
      .or("focus_nfe_environment.eq.production,environment.eq.production")
      .order("updated_at", { ascending: false })
      .limit(2);
    if (fiscalError) throw new Error("Não foi possível consultar a configuração fiscal");
    if (!fiscalRows || fiscalRows.length !== 1) return response({ ok: false, status: "misconfigured", reason: fiscalRows?.length ? "Mais de uma configuração fiscal de produção está ativa" : "Configuração fiscal de produção não encontrada", latency_ms: Math.round(performance.now() - started), correlation_id: correlationId });
    const fiscal = fiscalRows[0];
    if (!fiscal.focus_nfe_token || !fiscal.cnpj || !fiscal.company_name) return response({ ok: false, status: "misconfigured", reason: "Dados fiscais obrigatórios ausentes", latency_ms: Math.round(performance.now() - started), correlation_id: correlationId });

    const token = Deno.env.get("FOCUS_NFE_TOKEN");
    const endpoint = "https://api.focusnfe.com.br/v2/nfce/59b99b5e-0900-4c04-a95f-4bd24514a1dc";
    if (!token) return response({ ok: false, status: "misconfigured", reason: "Credencial Focus não configurada no servidor", latency_ms: Math.round(performance.now() - started), correlation_id: correlationId });

    let httpStatus: number;
    let statusText: string;
    try {
      const result = await fetch(endpoint, { method: "GET", headers: { Authorization: `Basic ${btoa(`${token}:`)}`, Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
      httpStatus = result.status;
      statusText = result.statusText;
    } catch (error) {
      const timeout = error instanceof DOMException && error.name === "TimeoutError";
      return response({ ok: false, status: timeout ? "timeout" : "network_error", reason: timeout ? "A Focus API excedeu o tempo limite" : "Não foi possível alcançar a Focus API", latency_ms: Math.round(performance.now() - started), correlation_id: correlationId });
    }

    const ok = httpStatus >= 200 && httpStatus < 300;
    const statusType = httpStatus === 401 || httpStatus === 403 ? "authorization_error" : httpStatus === 404 ? "not_found" : ok ? "success" : "http_error";
    const result = { ok, status: httpStatus, status_text: statusText, status_type: statusType, latency_ms: Math.round(performance.now() - started), correlation_id: correlationId, environment: fiscal.focus_nfe_environment ?? "unknown" };
    const update = await supabase.from("integration_credentials").update({ status: ok ? "connected" : "error", last_connection_test: new Date().toISOString(), last_error: ok ? null : `HTTP ${httpStatus}`, needs_reconfiguration: !ok }).eq("tenant_id", tenant.id).eq("provider", "focus_nfe");
    if (update.error) console.error("Falha ao atualizar status da credencial", correlationId, update.error.message);
    return response(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    const status = message.includes("autenticado") || message.includes("Sessão") ? 401 : message.includes("restrito") ? 403 : 500;
    return response({ ok: false, status: status === 401 ? "unauthorized" : status === 403 ? "forbidden" : "server_error", reason: message, latency_ms: Math.round(performance.now() - started), correlation_id: correlationId }, status);
  }
});
