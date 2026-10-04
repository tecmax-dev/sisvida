// Resgata o link seguro (token de uso único, validade curta) enviado pelo WhatsApp
// e devolve a sessão do Portal da Empresa, no mesmo formato do login por CNPJ.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function sha256Hex(v: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const token = String(body?.token ?? "");
    if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return json({ error: "Link inválido." }, 400);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const hash = await sha256Hex(token);

    // Consumo atômico: só um resgate por link, e somente dentro da validade.
    const { data: row } = await supabase
      .from("employer_portal_link_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("token_hash", hash)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .select("employer_id")
      .maybeSingle();
    if (!row) return json({ error: "Este link expirou ou já foi usado. Peça um novo pelo WhatsApp." }, 410);

    const { data: emp } = await supabase
      .from("employers")
      .select("id,name,cnpj,clinic_id,category_id,is_active")
      .eq("id", row.employer_id)
      .maybeSingle();
    if (!emp || emp.is_active === false) return json({ error: "Empresa não encontrada." }, 404);

    const { is_active: _ignored, ...employer } = emp;
    return json({ employer });
  } catch (e) {
    console.error("[employer-portal-link]", (e as Error)?.message);
    return json({ error: "Não foi possível abrir o link." }, 500);
  }
});
