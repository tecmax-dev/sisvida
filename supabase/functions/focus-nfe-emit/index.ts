import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CASA_DAS_ANTENAS_TENANT_ID = "9d98a593-4a03-428a-b7a3-f7c7c653158a";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function requireStaff(req: Request, supabase: ReturnType<typeof createClient>) {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) throw new Error("Não autenticado");
  const { data, error } = await supabase.auth.getUser(auth.slice(7));
  if (error || !data.user) throw new Error("Sessão inválida");
  const role = data.user.app_metadata?.role ?? data.user.user_metadata?.role;
  if (!["admin", "staff", "employee"].includes(role)) throw new Error("Acesso restrito à equipe");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const correlationId = crypto.randomUUID();
  const started = performance.now();
  const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  try {
    await requireStaff(req, supabase);
    if (req.method !== "POST") return json({ ok: false, status: "invalid_method", correlation_id: correlationId }, 405);
    const payload = await req.json();
    if (!payload?.reference || typeof payload.reference !== "string" || !Array.isArray(payload.items) || payload.items.length === 0 || !payload.customer) {
      return json({ ok: false, status: "invalid_payload", reason: "reference, customer e ao menos um item são obrigatórios", correlation_id: correlationId }, 400);
    }
    const { data: fiscalRows, error } = await supabase.from("pdv_fiscal_company_settings")
      .select("focus_nfe_token, focus_nfe_environment, environment, active_provider, cnpj, company_name")
      .eq("tenant_id", CASA_DAS_ANTENAS_TENANT_ID).eq("is_active", true).eq("active_provider", "focus_nfe")
      .or("focus_nfe_environment.eq.production,environment.eq.production").order("updated_at", { ascending: false }).limit(2);
    if (error || !fiscalRows || fiscalRows.length !== 1) return json({ ok: false, status: "misconfigured", reason: "Configuração fiscal de produção inválida ou duplicada", correlation_id: correlationId }, 422);
    const fiscal = fiscalRows[0];
    const baseUrl = Deno.env.get("FOCUS_NFE_BASE_URL")?.replace(/\/$/, "");
    const path = Deno.env.get("FOCUS_NFE_EMIT_PATH");
    if (!baseUrl || !path || !fiscal.focus_nfe_token || !fiscal.cnpj || !fiscal.company_name) return json({ ok: false, status: "misconfigured", reason: "Configuração Focus incompleta no servidor", correlation_id: correlationId }, 422);
    let result: Response;
    try {
      result = await fetch(`${baseUrl}/${path.replace(/^\//, "")}`, { method: "POST", headers: { Authorization: `Basic ${btoa(`${fiscal.focus_nfe_token}:`)}`, "Content-Type": "application/json", Accept: "application/json", "Idempotency-Key": payload.reference }, body: JSON.stringify(payload), signal: AbortSignal.timeout(15000) });
    } catch (e) {
      const timeout = e instanceof DOMException && e.name === "TimeoutError";
      return json({ ok: false, status: timeout ? "timeout" : "network_error", reason: timeout ? "A Focus API excedeu 15 segundos" : "Não foi possível alcançar a Focus API", correlation_id: correlationId, latency_ms: Math.round(performance.now() - started) }, 502);
    }
    const body = await result.text();
    let parsed: unknown; try { parsed = JSON.parse(body); } catch { parsed = undefined; }
    return json({ ok: result.ok, status: result.ok ? "accepted" : "http_error", http_status: result.status, response: parsed ?? undefined, correlation_id: correlationId, latency_ms: Math.round(performance.now() - started) }, result.ok ? 200 : 502);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro desconhecido";
    const status = message.includes("autenticado") || message.includes("Sessão") ? 401 : message.includes("restrito") ? 403 : 500;
    return json({ ok: false, status: status === 401 ? "unauthorized" : status === 403 ? "forbidden" : "server_error", reason: message, correlation_id: correlationId }, status);
  }
});
