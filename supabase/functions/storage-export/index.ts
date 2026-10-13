import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Super-admin-only export of stored files: returns 1-hour signed URLs per bucket.
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

type Item = { path: string; size: number };

async function listAll(sb: any, bucket: string, prefix = "", out: Item[] = []): Promise<Item[]> {
  let offset = 0;
  while (true) {
    const { data, error } = await sb.storage.from(bucket).list(prefix, { limit: 1000, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw error;
    if (!data?.length) break;
    for (const e of data) {
      const p = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.id === null) await listAll(sb, bucket, p, out);
      else if (e.name !== ".emptyFolderPlaceholder") out.push({ path: p, size: Number(e.metadata?.size ?? 0) });
    }
    if (data.length < 1000) break;
    offset += 1000;
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: u } = await sb.auth.getUser(jwt);
    if (!u?.user) return json({ error: "Faça login novamente." }, 401);
    const { data: sa } = await sb.from("super_admins").select("user_id").eq("user_id", u.user.id).maybeSingle();
    if (!sa) return json({ error: "Apenas super admin." }, 403);

    const body = await req.json().catch(() => ({}));
    const { data: buckets, error: bErr } = await sb.storage.listBuckets();
    if (bErr) throw bErr;
    const names = (buckets ?? []).map((b: any) => b.id as string).sort();

    if (body.action === "buckets") return json({ buckets: names });

    if (body.action === "list") {
      const bucket = String(body.bucket ?? "");
      if (!names.includes(bucket)) return json({ error: "Pasta inválida." }, 400);
      const items = await listAll(sb, bucket);
      const files: (Item & { url: string })[] = [];
      for (let i = 0; i < items.length; i += 100) {
        const chunk = items.slice(i, i + 100);
        const { data, error } = await sb.storage.from(bucket).createSignedUrls(chunk.map((c) => c.path), 3600);
        if (error) throw error;
        data?.forEach((d: any, k: number) => d.signedUrl && files.push({ ...chunk[k], url: d.signedUrl }));
      }
      await sb.from("audit_logs").insert({
        user_id: u.user.id, action: "storage_export", entity_type: "storage_bucket",
        details: { bucket, files: files.length, bytes: files.reduce((s, f) => s + f.size, 0) },
        user_agent: req.headers.get("user-agent"),
      });
      return json({ bucket, files });
    }
    return json({ error: "Ação inválida." }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: "Falha ao listar arquivos." }, 500);
  }
});
