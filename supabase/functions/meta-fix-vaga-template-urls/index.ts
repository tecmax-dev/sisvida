import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const META_GRAPH_VERSION = "v21.0";
const NEW_URL = "https://prosindweb.com.br/sindicato";

// Nomes dos templates de "vaga médica / agenda disponível" cujos botões precisam
// ser corrigidos. O botão "Acessar Aplicativo" estava apontando para
// https://app.sindicato.com.br/ ou https://prosindweb.com.br/ (raiz), o que
// caía na página de criação de clínica. Tem que apontar para /sindicato.
const TEMPLATE_NAME_PREFIXES = [
  "vaga_medica_",
  "agenda_disponivel",
  "informativo_agenda_medica",
];

interface TemplateRecord {
  id: string;
  name: string;
  language: string;
  status: string;
  components: any[];
}

async function listAllTemplates(wabaId: string, token: string): Promise<TemplateRecord[]> {
  const out: TemplateRecord[] = [];
  let url: string | null =
    `https://graph.facebook.com/${META_GRAPH_VERSION}/${wabaId}/message_templates?fields=id,name,language,status,components&limit=200`;
  while (url) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const json: any = await res.json();
    if (!res.ok) throw new Error(`list failed: ${JSON.stringify(json)}`);
    if (Array.isArray(json.data)) out.push(...json.data);
    url = json?.paging?.next ?? null;
  }
  return out;
}

function rewriteComponents(components: any[]): { changed: boolean; components: any[] } {
  let changed = false;
  const next = components.map((c) => {
    if (c.type !== "BUTTONS" || !Array.isArray(c.buttons)) return c;
    const buttons = c.buttons.map((b: any) => {
      if (b.type === "URL" && typeof b.url === "string") {
        if (b.url !== NEW_URL && (b.url.startsWith("https://app.sindicato.com.br") || b.url === "https://prosindweb.com.br/" || b.url === "https://prosindweb.com.br")) {
          changed = true;
          return { ...b, url: NEW_URL };
        }
      }
      return b;
    });
    return { ...c, buttons };
  });
  return { changed, components: next };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const WABA_ID = Deno.env.get("META_WABA_ID");
    const TOKEN = Deno.env.get("META_WHATSAPP_TOKEN");
    if (!WABA_ID || !TOKEN) {
      return new Response(JSON.stringify({ error: "META_WABA_ID e META_WHATSAPP_TOKEN obrigatórios" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const all = await listAllTemplates(WABA_ID, TOKEN);
    const targets = all.filter((t) => TEMPLATE_NAME_PREFIXES.some((p) => t.name.startsWith(p)));

    const results: any[] = [];
    for (const t of targets) {
      const { changed, components } = rewriteComponents(t.components || []);
      if (!changed) {
        results.push({ name: t.name, language: t.language, skipped: "url já correta" });
        continue;
      }
      const editUrl = `https://graph.facebook.com/${META_GRAPH_VERSION}/${t.id}`;
      const res = await fetch(editUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ components }),
      });
      const json = await res.json();
      results.push({ name: t.name, language: t.language, ok: res.ok, status: res.status, meta: json });
      await new Promise((r) => setTimeout(r, 600));
    }

    return new Response(
      JSON.stringify({
        success: true,
        total_targets: targets.length,
        updated: results.filter((r) => r.ok).length,
        skipped: results.filter((r) => r.skipped).length,
        failed: results.filter((r) => r.ok === false).length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});