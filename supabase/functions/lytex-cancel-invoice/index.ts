// Cancela (deleta) uma fatura no Lytex. Uso interno/administrativo.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LYTEX_BASE = "https://api-pay.lytex.com.br";

async function getToken(clientId: string, clientSecret: string) {
  const res = await fetch(`${LYTEX_BASE}/v2/auth/obtain_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grantType: "clientCredentials", clientId, clientSecret }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`auth failed: ${res.status} ${JSON.stringify(json)}`);
  return json.accessToken as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Somente chamadas internas com service_role
  const auth = req.headers.get("Authorization") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!serviceKey || auth !== `Bearer ${serviceKey}`) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { invoiceId, credentials = "primary" } = await req.json();
    if (!invoiceId) throw new Error("invoiceId obrigatório");

    const pairs =
      credentials === "all"
        ? [
            ["LYTEX_CLIENT_ID", "LYTEX_CLIENT_SECRET"],
            ["LYTEX_CLIENT_ID_SECONDARY", "LYTEX_CLIENT_SECRET_SECONDARY"],
          ]
        : credentials === "secondary"
        ? [["LYTEX_CLIENT_ID_SECONDARY", "LYTEX_CLIENT_SECRET_SECONDARY"]]
        : [["LYTEX_CLIENT_ID", "LYTEX_CLIENT_SECRET"]];

    const attempts: unknown[] = [];
    for (const [idKey, secretKey] of pairs) {
      const clientId = Deno.env.get(idKey);
      const clientSecret = Deno.env.get(secretKey);
      if (!clientId || !clientSecret) {
        attempts.push({ credentials: idKey, error: "credenciais ausentes" });
        continue;
      }
      try {
        const token = await getToken(clientId, clientSecret);
        const res = await fetch(`${LYTEX_BASE}/v2/invoices/${invoiceId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        const text = await res.text();
        attempts.push({ credentials: idKey, status: res.status, body: text.slice(0, 500) });
        if (res.ok) {
          return new Response(JSON.stringify({ success: true, invoiceId, attempts }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } catch (e) {
        attempts.push({ credentials: idKey, error: String(e) });
      }
    }

    return new Response(JSON.stringify({ success: false, invoiceId, attempts }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
