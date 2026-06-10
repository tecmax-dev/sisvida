import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { TEMPLATE_CATALOG } from "../_shared/template-catalog.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

const ACTIVE_WINDOW_DAYS = 30;
const ARCHIVE_WINDOW_DAYS = 90;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: tpls } = await sb
      .from("whatsapp_meta_templates")
      .select("id,name,language,category,status,created_at");

    const now = Date.now();
    const activeCutoff = now - ACTIVE_WINDOW_DAYS * 86400 * 1000;
    const archiveCutoff = now - ARCHIVE_WINDOW_DAYS * 86400 * 1000;

    // Última utilização por nome
    const { data: lastUse } = await sb
      .from("whatsapp_template_logs")
      .select("template_name, created_at")
      .eq("status", "sent")
      .order("created_at", { ascending: false })
      .limit(5000);

    const lastUseMap = new Map<string, number>();
    for (const row of (lastUse ?? []) as any[]) {
      if (!lastUseMap.has(row.template_name)) {
        lastUseMap.set(row.template_name, new Date(row.created_at).getTime());
      }
    }

    const classified = (tpls ?? []).map((t: any) => {
      const lastUsedAt = lastUseMap.get(t.name) ?? 0;
      const inCatalog = !!TEMPLATE_CATALOG[t.name];
      let lifecycle: "ACTIVE" | "DEPRECATED" | "ARCHIVED";
      if (lastUsedAt >= activeCutoff && inCatalog) lifecycle = "ACTIVE";
      else if (lastUsedAt < archiveCutoff || lastUsedAt === 0) lifecycle = "ARCHIVED";
      else lifecycle = "DEPRECATED";
      return {
        id: t.id,
        name: t.name,
        language: t.language,
        category: t.category,
        status: t.status,
        in_catalog: inCatalog,
        last_used_at: lastUsedAt ? new Date(lastUsedAt).toISOString() : null,
        lifecycle,
      };
    });

    // Duplicidade por nome
    const counts = new Map<string, number>();
    for (const t of classified) counts.set(t.name, (counts.get(t.name) ?? 0) + 1);
    const duplicates = classified.filter((t) => (counts.get(t.name) ?? 0) > 1);

    const summary = {
      total: classified.length,
      active: classified.filter((t) => t.lifecycle === "ACTIVE").length,
      deprecated: classified.filter((t) => t.lifecycle === "DEPRECATED").length,
      archived: classified.filter((t) => t.lifecycle === "ARCHIVED").length,
      out_of_catalog: classified.filter((t) => !t.in_catalog).length,
      duplicates: duplicates.length,
      by_category: classified.reduce((acc: Record<string, number>, t) => {
        const k = String(t.category ?? "UNKNOWN");
        acc[k] = (acc[k] ?? 0) + 1;
        return acc;
      }, {}),
    };

    return new Response(
      JSON.stringify({ summary, templates: classified }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});