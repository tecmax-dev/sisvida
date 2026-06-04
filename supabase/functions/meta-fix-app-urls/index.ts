import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const META_GRAPH_VERSION = "v21.0";
const ANDROID_URL =
  "https://play.google.com/store/apps/details?id=br.org.secmi.comerciariosilheus.app&pcampaignid=web_share";
const IPHONE_URL = "https://prosindweb.com.br/sindicato/app/";

// URLs antigas que devem ser substituidas pelos dois botoes corretos
const LEGACY_URL_PATTERNS = [
  "https://prosindweb.com.br/",
  "https://prosindweb.com.br",
  "https://prosindweb.com.br/sindicato",
  "https://prosindweb.com.br/sindicato/",
  "https://prosindweb.com.br/app",
  "https://prosindweb.com.br/app/",
  "https://app.sindicato.com.br/",
  "https://app.sindicato.com.br",
];

interface Button {
  type: string;
  text?: string;
  url?: string;
  example?: string[];
}

interface Component {
  type: string;
  text?: string;
  buttons?: Button[];
  example?: unknown;
}

function needsFix(components: Component[]): boolean {
  const btnComp = components.find((c) => c.type === "BUTTONS");
  if (!btnComp?.buttons) return false;
  const urlButtons = btnComp.buttons.filter((b) => b.type === "URL");
  if (urlButtons.length === 0) return false;
  // Considera que precisa corrigir se ha apenas 1 botao URL apontando para uma URL legacy de app
  if (urlButtons.length === 1) {
    const u = urlButtons[0].url ?? "";
    return LEGACY_URL_PATTERNS.some((p) => u === p);
  }
  return false;
}

function buildFixedComponents(components: Component[]): Component[] {
  return components.map((c) => {
    if (c.type !== "BUTTONS" || !c.buttons) return c;
    const nonUrl = c.buttons.filter((b) => b.type !== "URL");
    const urlButtons: Button[] = [
      { type: "URL", text: "Instalar Android", url: ANDROID_URL },
      { type: "URL", text: "Abrir no iPhone", url: IPHONE_URL },
    ];
    return { ...c, buttons: [...nonUrl, ...urlButtons] };
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const WABA_ID = Deno.env.get("META_WABA_ID");
    const TOKEN = Deno.env.get("META_WHATSAPP_TOKEN");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!WABA_ID || !TOKEN) {
      return new Response(
        JSON.stringify({ error: "META_WABA_ID e META_WHATSAPP_TOKEN obrigatorios" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const url = new URL(req.url);
    const dryRun = url.searchParams.get("dry_run") === "1";
    const onlyName = url.searchParams.get("name");

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    let query = admin
      .from("whatsapp_meta_templates")
      .select("id, name, status, components, meta_template_id, language")
      .eq("status", "APPROVED");
    if (onlyName) query = query.eq("name", onlyName);

    const { data: templates, error: tplErr } = await query;
    if (tplErr) throw tplErr;

    const results: Array<Record<string, unknown>> = [];

    for (const t of templates ?? []) {
      const components = (t.components as Component[]) ?? [];
      if (!needsFix(components)) {
        results.push({ name: t.name, skipped: true, reason: "no_legacy_url_button" });
        continue;
      }
      const fixed = buildFixedComponents(components);

      if (dryRun) {
        results.push({ name: t.name, would_update: true, new_components: fixed });
        continue;
      }

      if (!t.meta_template_id) {
        results.push({ name: t.name, error: "missing meta_template_id" });
        continue;
      }

      const editUrl = `https://graph.facebook.com/${META_GRAPH_VERSION}/${t.meta_template_id}`;
      const res = await fetch(editUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ components: fixed }),
      });
      const json = await res.json();
      if (!res.ok) {
        results.push({ name: t.name, error: "meta_edit_failed", meta: json });
        continue;
      }

      await admin
        .from("whatsapp_meta_templates")
        .update({ components: fixed, last_synced_at: new Date().toISOString() })
        .eq("id", t.id);

      results.push({ name: t.name, updated: true });
      // pequeno delay para evitar rate limit
      await new Promise((r) => setTimeout(r, 150));
    }

    return new Response(
      JSON.stringify({
        ok: true,
        dry_run: dryRun,
        total: templates?.length ?? 0,
        updated: results.filter((r) => r.updated).length,
        skipped: results.filter((r) => r.skipped).length,
        errors: results.filter((r) => r.error).length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});