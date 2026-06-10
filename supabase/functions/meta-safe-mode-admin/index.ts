import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_FIELDS = new Set([
  "safe_mode",
  "maintenance_mode",
  "dry_run",
  "max_per_hour",
  "max_per_day",
  "max_per_contact_30d",
  "circuit_breaker_open",
  "circuit_reason",
  "circuit_opened_at",
  "go_live_stage",
  "go_live_started_at",
  "manual_override",
]);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Autenticação + checagem de super admin
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
  const { data: userRes } = await userClient.auth.getUser();
  const user = userRes?.user;
  if (!user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const { data: isAdminRow } = await supabaseAdmin
    .from("super_admins")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!isAdminRow) {
    return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    if (req.method === "GET") {
      const [{ data: config }, { data: health }, { data: audit }] = await Promise.all([
        supabaseAdmin.from("meta_safe_mode_config").select("*").eq("singleton", true).maybeSingle(),
        supabaseAdmin.from("meta_health_score_v").select("*").maybeSingle(),
        supabaseAdmin.from("meta_safe_mode_audit").select("*").order("created_at", { ascending: false }).limit(20),
      ]);
      return new Response(JSON.stringify({ config, health, audit: audit ?? [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "POST" || req.method === "PATCH") {
      const body = await req.json().catch(() => ({}));
      const updates: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(body || {})) {
        if (ALLOWED_FIELDS.has(k)) updates[k] = v;
      }
      if (Object.keys(updates).length === 0) {
        return new Response(JSON.stringify({ error: "no_valid_fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Reset de circuit breaker manual
      if (updates.circuit_breaker_open === false) {
        updates.circuit_reason = null;
        updates.circuit_opened_at = null;
      }

      updates.updated_by = user.id;

      const { data, error } = await supabaseAdmin
        .from("meta_safe_mode_config")
        .update(updates)
        .eq("singleton", true)
        .select()
        .maybeSingle();
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Auditoria com motivo (trigger já registra diffs, aqui anexamos motivo no último registro)
      const reason = typeof (body as any)?.reason === "string" ? (body as any).reason : null;
      if (reason) {
        await supabaseAdmin
          .from("meta_safe_mode_audit")
          .update({ reason })
          .gte("created_at", new Date(Date.now() - 5000).toISOString())
          .is("reason", null);
      }

      return new Response(JSON.stringify({ success: true, config: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
