import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Sending side of the system-to-system file migration.
// Auth: header "x-sync-key" must equal the STORAGE_SYNC_KEY secret (same value set in the receiving system).
// POST {action:"buckets"} -> bucket names + public flag
// POST {action:"list", bucket, offset?, limit?} -> files with 1-hour signed download URLs (paged)
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

type Item = { path: string; size: number; contentType: string | null };

async function listAll(sb: any, bucket: string, prefix = "", out: Item[] = []): Promise<Item[]> {
  let offset = 0;
  while (true) {
    const { data, error } = await sb.storage.from(bucket).list(prefix, { limit: 1000, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw error;
    if (!data?.length) break;
    for (const e of data) {
      const p = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.id === null) await listAll(sb, bucket, p, out);
      else if (e.name !== ".emptyFolderPlaceholder")
        out.push({ path: p, size: Number(e.metadata?.size ?? 0), contentType: e.metadata?.mimetype ?? null });
    }
    if (data.length < 1000) break;
    offset += 1000;
  }
  return out;
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const expected = Deno.env.get("STORAGE_SYNC_KEY") ?? "";
  const given = req.headers.get("x-sync-key") ?? "";
  if (expected.length < 24 || !safeEqual(given, expected)) return json({ error: "unauthorized" }, 401);

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));
    const { data: buckets, error: bErr } = await sb.storage.listBuckets();
    if (bErr) throw bErr;

    if (body.action === "buckets") {
      return json({ buckets: (buckets ?? []).map((b: any) => ({ id: b.id, public: b.public })) });
    }

    if (body.action === "list") {
      const bucket = String(body.bucket ?? "");
      if (!(buckets ?? []).some((b: any) => b.id === bucket)) return json({ error: "invalid bucket" }, 400);
      const offset = Math.max(0, Number(body.offset) || 0);
      const limit = Math.min(500, Math.max(1, Number(body.limit) || 200));
      const all = await listAll(sb, bucket);
      const page = all.slice(offset, offset + limit);
      const files: (Item & { url: string })[] = [];
      for (let i = 0; i < page.length; i += 100) {
        const chunk = page.slice(i, i + 100);
        const { data, error } = await sb.storage.from(bucket).createSignedUrls(chunk.map((c) => c.path), 3600);
        if (error) throw error;
        data?.forEach((d: any, k: number) => d.signedUrl && files.push({ ...chunk[k], url: d.signedUrl }));
      }
      console.log(`[storage-sync] bucket=${bucket} offset=${offset} sent=${files.length} total=${all.length}`);
      return json({ bucket, total: all.length, offset, next: offset + limit < all.length ? offset + limit : null, files });
    }
    return json({ error: "invalid action" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: "internal error" }, 500);
  }
});
