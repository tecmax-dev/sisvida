import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getMetaCredsByVersion, type MetaApiVersion } from "../_shared/meta-creds.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const META_GRAPH_VERSION = "v21.0";

interface CopyBody {
  source?: MetaApiVersion; // default v1
  target?: MetaApiVersion; // default v2
  only?: string[];         // optional list of template names to copy
  skip?: string[];         // optional names to skip
  dry_run?: boolean;
}

// Fields that Meta returns on GET but rejects on POST.
function sanitizeComponents(components: any[]): any[] {
  if (!Array.isArray(components)) return [];
  return components.map((c) => {
    const out: any = { type: c.type };
    if (c.text !== undefined) out.text = c.text;
    if (c.format !== undefined) out.format = c.format;
    if (c.example !== undefined) out.example = c.example;
    if (Array.isArray(c.buttons)) {
      out.buttons = c.buttons.map((b: any) => {
        const btn: any = { type: b.type };
        if (b.text !== undefined) btn.text = b.text;
        if (b.url !== undefined) btn.url = b.url;
        if (b.phone_number !== undefined) btn.phone_number = b.phone_number;
        if (b.example !== undefined) btn.example = b.example;
        return btn;
      });
    }
    return out;
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body: CopyBody = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const source: MetaApiVersion = body.source ?? "v1";
    const target: MetaApiVersion = body.target ?? "v2";
    const only = new Set((body.only || []).map((s) => s.toLowerCase()));
    const skip = new Set((body.skip || []).map((s) => s.toLowerCase()));
    const dryRun = !!body.dry_run;

    if (source === target) {
      return new Response(
        JSON.stringify({ error: "source e target não podem ser iguais" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const src = getMetaCredsByVersion(source);
    const tgt = getMetaCredsByVersion(target);

    if (!src.token || !src.wabaId) {
      return new Response(
        JSON.stringify({ error: `Credenciais Meta ${source} ausentes (token / waba_id)` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!tgt.token || !tgt.wabaId) {
      return new Response(
        JSON.stringify({ error: `Credenciais Meta ${target} ausentes (token / waba_id)` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 1) Fetch all templates from source WABA
    const allTemplates: any[] = [];
    let url: string | null =
      `https://graph.facebook.com/${META_GRAPH_VERSION}/${src.wabaId}/message_templates?fields=name,language,category,status,components&limit=100`;
    while (url) {
      const res: Response = await fetch(url, { headers: { Authorization: `Bearer ${src.token}` } });
      const json = await res.json();
      if (!res.ok) {
        return new Response(
          JSON.stringify({ error: "Falha ao listar templates da origem", meta: json }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (Array.isArray(json.data)) allTemplates.push(...json.data);
      url = json.paging?.next ?? null;
    }

    // 2) Fetch existing templates on target WABA (avoid duplicates)
    const existingTargetNames = new Set<string>();
    let turl: string | null =
      `https://graph.facebook.com/${META_GRAPH_VERSION}/${tgt.wabaId}/message_templates?fields=name,language&limit=100`;
    while (turl) {
      const res: Response = await fetch(turl, { headers: { Authorization: `Bearer ${tgt.token}` } });
      const json = await res.json();
      if (!res.ok) break;
      if (Array.isArray(json.data)) {
        for (const t of json.data) existingTargetNames.add(`${t.name}__${t.language}`);
      }
      turl = json.paging?.next ?? null;
    }

    const results: Array<{ name: string; language: string; status: string; detail?: any }> = [];

    // 3) Recreate each template on target WABA
    for (const t of allTemplates) {
      const lname = (t.name || "").toLowerCase();
      if (only.size > 0 && !only.has(lname)) continue;
      if (skip.has(lname)) continue;
      if (t.status === "REJECTED" || t.status === "DISABLED") {
        results.push({ name: t.name, language: t.language, status: "skipped_status", detail: t.status });
        continue;
      }
      const key = `${t.name}__${t.language}`;
      if (existingTargetNames.has(key)) {
        results.push({ name: t.name, language: t.language, status: "already_exists" });
        continue;
      }

      const payload = {
        name: t.name,
        language: t.language,
        category: t.category,
        components: sanitizeComponents(t.components || []),
      };

      if (dryRun) {
        results.push({ name: t.name, language: t.language, status: "dry_run", detail: payload });
        continue;
      }

      const createRes = await fetch(
        `https://graph.facebook.com/${META_GRAPH_VERSION}/${tgt.wabaId}/message_templates`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tgt.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );
      const createJson = await createRes.json();
      results.push({
        name: t.name,
        language: t.language,
        status: createRes.ok ? "created" : "error",
        detail: createJson,
      });
      // Throttle to avoid Meta rate limits
      await new Promise((r) => setTimeout(r, 800));
    }

    const summary = {
      source,
      target,
      source_waba: src.wabaId,
      target_waba: tgt.wabaId,
      total_source: allTemplates.length,
      created: results.filter((r) => r.status === "created").length,
      already_exists: results.filter((r) => r.status === "already_exists").length,
      errors: results.filter((r) => r.status === "error").length,
      skipped_status: results.filter((r) => r.status === "skipped_status").length,
      dry_run: dryRun,
    };

    return new Response(
      JSON.stringify({ summary, results }, null, 2),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[meta-copy-templates] Error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});