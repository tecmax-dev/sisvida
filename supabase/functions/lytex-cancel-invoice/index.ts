// Cancela (deleta) uma fatura no Lytex. Uso interno/administrativo.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-task-key",
};

import { requireStaff, authErrorResponse } from "../_shared/authGuard.ts";

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

  const taskKey = Deno.env.get("ADMIN_TASK_KEY");
  const providedKey = req.headers.get("x-admin-task-key");
  const internalOk = !!taskKey && providedKey === taskKey;

  try {
    if (!internalOk) await requireStaff(req);
  } catch (e) {
    const r = authErrorResponse(e, corsHeaders);
    if (r) return r;
    throw e;
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
        const H = { Authorization: `Bearer ${token}` };
        const get = await fetch(`${LYTEX_BASE}/v2/invoices/${invoiceId}`, { headers: H });
        const getBody = await get.text();
        attempts.push({ credentials: idKey, step: "get", status: get.status, body: getBody.slice(0, 800) });

        const routes: Array<[string, string]> = [
          ["PUT", `${LYTEX_BASE}/v2/invoices/cancel/${invoiceId}`],
          ["PUT", `${LYTEX_BASE}/v1/invoices/cancel/${invoiceId}`],
        ];
        let res = new Response(null, { status: 500 });
        for (const [method, url] of routes) {
          res = await fetch(url, { method, headers: H });
          const text = await res.text();
          attempts.push({ credentials: idKey, step: `${method} ${url}`, status: res.status, body: text.slice(0, 400) });
          if (res.ok) break;
        }
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
