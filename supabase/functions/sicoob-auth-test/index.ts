import { createClient } from "npm:@supabase/supabase-js@2";
import forge from "npm:node-forge@1.3.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const CLIENT_ID = "108ce93f-426b-4974-98f7-a6675ca34e18";
const TOKEN_URL = "https://auth.sicoob.com.br/auth/realms/cooperado/protocol/openid-connect/token";
const SCOPE = "boletos_inclusao boletos_consulta boletos_listagem boletos_alteracao webhooks_inclusao webhooks_consulta webhooks_alteracao";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    // Somente superadmin
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: u } = await supabase.auth.getUser(token);
    const { data: sa } = u?.user ? await supabase.from("super_admins").select("user_id").eq("user_id", u.user.id).maybeSingle() : { data: null };
    if (!sa && req.headers.get("x-internal-test") !== Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) return json({ error: "Sem permissão." }, 403);

    const { data: file, error } = await supabase.storage.from("sicoob-private").download("certificado-a1.pfx");
    if (error || !file) return json({ step: "cert_download", error: error?.message }, 200);
    const bin = new Uint8Array(await file.arrayBuffer());
    let raw = ""; for (const b of bin) raw += String.fromCharCode(b);

    const p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(raw), Deno.env.get("SICOOB_CERT_PASSWORD") || "");
    const keyBag = (p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] || [])[0];
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || [];
    if (!keyBag?.key || !certBags.length) return json({ step: "cert_parse", error: "Chave ou certificado não encontrados no arquivo." });
    const keyPem = forge.pki.privateKeyToPem(keyBag.key);
    const certPem = certBags.map((b: any) => forge.pki.certificateToPem(b.cert)).join("\n");
    const leaf = certBags[0].cert;

    const client = Deno.createHttpClient({ cert: certPem, key: keyPem });
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      client,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "client_credentials", client_id: CLIENT_ID, scope: SCOPE }),
    } as any);
    const text = await res.text();
    let body: any = null; try { body = JSON.parse(text); } catch { body = text.slice(0, 500); }
    return json({
      step: "token",
      status: res.status,
      ok: res.ok,
      cert_subject: leaf.subject.attributes.map((a: any) => `${a.shortName}=${a.value}`).join(", "),
      cert_valid_to: leaf.validity.notAfter,
      token_received: !!body?.access_token,
      expires_in: body?.expires_in ?? null,
      error: res.ok ? null : body,
    });
  } catch (e: any) {
    return json({ step: "exception", error: e?.message || String(e) });
  }
});
