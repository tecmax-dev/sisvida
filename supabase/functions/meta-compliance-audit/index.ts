// Auditoria contínua de conformidade Meta. Pode ser invocada manualmente
// ou agendada via pg_cron pelo administrador (não criamos cron automático).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { TEMPLATE_CATALOG } from "../_shared/template-catalog.ts";
import { FREEFORM_TRIGGERS } from "../_shared/trigger-sources.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

const DEPRECATED_DAYS = 30;

async function log(sb: any, action: string, severity: "low" | "medium" | "high", details: any) {
  try {
    await sb.from("whatsapp_audit_logs").insert({
      phone: "system",
      direction: "status",
      message_type: "compliance_audit",
      session_state: severity,
      content: `compliance_audit_${action}`,
      metadata: { action, severity, details },
    });
  } catch (e) {
    console.error("[audit] log failed:", e);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const findings: any = {};

    const { data: tpls } = await sb
      .from("whatsapp_meta_templates")
      .select("name,language,category,status,created_at");

    // 1. Fora do catálogo
    const outOfCatalog = (tpls ?? []).filter((t: any) => !TEMPLATE_CATALOG[t.name]);
    findings.out_of_catalog = outOfCatalog.map((t: any) => t.name);
    if (outOfCatalog.length) await log(sb, "out_of_catalog", "medium", { count: outOfCatalog.length, names: findings.out_of_catalog });

    // 2. Duplicidades
    const counts = new Map<string, number>();
    for (const t of tpls ?? []) counts.set(t.name, (counts.get(t.name) ?? 0) + 1);
    findings.duplicates = [...counts.entries()].filter(([, c]) => c > 1).map(([n, c]) => ({ name: n, count: c }));
    if (findings.duplicates.length) await log(sb, "duplicates", "medium", findings.duplicates);

    // 3. Categoria divergente
    const wrongCategory = (tpls ?? []).filter((t: any) => {
      const canon = TEMPLATE_CATALOG[t.name];
      return canon && canon.category !== t.category;
    });
    findings.wrong_category = wrongCategory.map((t: any) => ({ name: t.name, expected: TEMPLATE_CATALOG[t.name].category, actual: t.category }));
    if (wrongCategory.length) await log(sb, "wrong_category", "high", findings.wrong_category);

    // 4. Depreciados (sem uso ≥30d)
    const cutoff = Date.now() - DEPRECATED_DAYS * 86400 * 1000;
    const { data: lastUse } = await sb
      .from("whatsapp_template_logs")
      .select("template_name, sent_at")
      .eq("status", "sent")
      .gte("sent_at", new Date(cutoff).toISOString())
      .limit(5000);
    const usedRecently = new Set((lastUse ?? []).map((r: any) => r.template_name));
    findings.deprecated = (tpls ?? [])
      .filter((t: any) => TEMPLATE_CATALOG[t.name] && !usedRecently.has(t.name))
      .map((t: any) => t.name);

    // 5. Envios sem meta_message_id (proxy de chamadas fora do engine nas últimas 24h)
    // Filtra apenas TEMPLATES canônicos — mensagens livres de sessão, respostas
    // humanas e envios não-template não contam como bypass.
    const since = new Date(Date.now() - 86400 * 1000).toISOString();
    const canonicalNames = Object.keys(TEMPLATE_CATALOG);
    const { data: suspiciousSends } = await sb
      .from("whatsapp_template_logs")
      .select("template_name, triggered_by, sent_at")
      .eq("status", "sent")
      .is("meta_message_id", null)
      .in("template_name", canonicalNames)
      .not("triggered_by", "in", `(${FREEFORM_TRIGGERS.join(",")})`)
      .gte("sent_at", since)
      .limit(200);
    findings.suspicious_sends = (suspiciousSends ?? []).length;
    if (findings.suspicious_sends > 0) {
      await log(sb, "possible_direct_graph_call", "high", {
        count: findings.suspicious_sends,
        note: "Apenas templates canônicos sem meta_message_id; mensagens livres/sessão excluídas.",
        samples: suspiciousSends?.slice(0, 5),
      });
    }

    await log(sb, "completed", "low", { summary: {
      out_of_catalog: findings.out_of_catalog.length,
      duplicates: findings.duplicates.length,
      wrong_category: findings.wrong_category.length,
      deprecated: findings.deprecated.length,
      suspicious_sends: findings.suspicious_sends,
    } });

    return new Response(
      JSON.stringify({ ok: true, findings }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});