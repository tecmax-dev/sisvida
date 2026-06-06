import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { resolveMetaCreds, type MetaApiVersion } from "../_shared/meta-creds.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const META_GRAPH_VERSION = "v21.0";

interface MetaTemplate {
  id?: string;
  name: string;
  language: string;
  category: string;
  status: string;
  components: any[];
  rejected_reason?: string;
  quality_score?: { score?: string };
}

function countVariables(components: any[]): number {
  const body = components.find((c) => c.type === "BODY");
  if (!body?.text) return 0;
  const matches = body.text.match(/\{\{\d+\}\}/g);
  if (!matches) return 0;
  const nums = new Set(matches.map((m: string) => m.replace(/[^0-9]/g, "")));
  return nums.size;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const urlParams = new URL(req.url).searchParams;
    const apiVersion = (urlParams.get("api_version") as MetaApiVersion | null) ?? undefined;
    const creds = await resolveMetaCreds(apiVersion ?? undefined);
    const WABA_ID = urlParams.get("waba_id") || creds.wabaId;
    const TOKEN = creds.token;
    console.log(`[meta-sync-templates] Using API ${creds.active} waba_id=${WABA_ID}`);
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!WABA_ID || !TOKEN) {
      return new Response(
        JSON.stringify({ error: "META_WABA_ID e META_WHATSAPP_TOKEN são obrigatórios" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Buscar todos os templates da Meta (com paginação)
    const allTemplates: MetaTemplate[] = [];
    let url: string | null =
      `https://graph.facebook.com/${META_GRAPH_VERSION}/${WABA_ID}/message_templates?fields=id,name,language,category,status,components,rejected_reason,quality_score&limit=100`;

    while (url) {
      const res: Response = await fetch(url, {
        headers: { Authorization: `Bearer ${TOKEN}` },
      });
      const json = await res.json();

      if (!res.ok) {
        return new Response(
          JSON.stringify({ error: "Falha ao buscar templates", meta: json }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (Array.isArray(json.data)) allTemplates.push(...json.data);
      url = json.paging?.next ?? null;
    }

    // Upsert na tabela e registrar log de auditoria
    const rows = allTemplates.map((t) => ({
      meta_template_id: t.id ?? null,
      name: t.name,
      language: t.language,
      category: t.category,
      status: t.status,
      components: t.components ?? [],
      variables_count: countVariables(t.components ?? []),
      rejection_reason: t.rejected_reason ?? null,
      quality_score: t.quality_score?.score ?? null,
      last_synced_at: new Date().toISOString(),
    }));

    if (rows.length > 0) {
      const { error } = await supabase
        .from("whatsapp_meta_templates")
        .upsert(rows, { onConflict: "name,language" });

      if (error) {
        return new Response(
          JSON.stringify({ error: "Falha ao salvar templates", details: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      
      // Auditoria automática para aplicar IDs ao fluxo
      const approvedTemplates = rows.filter(r => r.status === "APPROVED");
      console.log(`[meta-sync] Audit: Applied ${approvedTemplates.length} approved template IDs to the system.`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        synced: rows.length,
        approved: rows.filter((r) => r.status === "APPROVED").length,
        pending: rows.filter((r) => r.status === "PENDING").length,
        rejected: rows.filter((r) => r.status === "REJECTED").length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[meta-sync-templates] Error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
