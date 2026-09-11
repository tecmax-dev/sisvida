// Diagnóstico temporário: testa combinações de endpoint/auth do ChatGoo.
// Não expõe o token; apenas status e corpo da resposta do gateway.

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const base = (Deno.env.get("CHATGOO_BASE_URL") ?? "").replace(/\/+$/, "");
  const token = Deno.env.get("CHATGOO_API_TOKEN") ?? "";
  if (!base || !token) {
    return new Response(JSON.stringify({ error: "CHATGOO_NOT_CONFIGURED", base_set: !!base, token_set: !!token }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch (_) { /* ignore */ }
  const number = String(body.number ?? "5573988633535");
  const text = String(body.message ?? "teste de integração");

  const payloads: Array<[string, Record<string, unknown>]> = [
    ["number+body", { number, body: text }],
    ["number+message", { number, message: text }],
  ];
  const paths = ["/api/messages/send", "/api/messages", `/api/messages/${number}`];
  const auths: Array<[string, Record<string, string>]> = [
    ["bearer", { Authorization: `Bearer ${token}` }],
    ["raw", { Authorization: token }],
    ["token-header", { token }],
  ];

  const results: unknown[] = [];
  for (const path of paths) {
    for (const [authName, headers] of auths) {
      for (const [payloadName, payload] of payloads) {
        try {
          const res = await fetch(`${base}${path}`, {
            method: "POST",
            headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const respText = (await res.text()).slice(0, 200);
          results.push({ path, auth: authName, payload: payloadName, status: res.status, body: respText });
          if (res.ok) {
            return new Response(JSON.stringify({ success: true, winner: { path, auth: authName, payload: payloadName }, results }, null, 2), {
              headers: { ...cors, "Content-Type": "application/json" },
            });
          }
        } catch (e) {
          results.push({ path, auth: authName, payload: payloadName, error: e instanceof Error ? e.message : String(e) });
        }
      }
    }
  }

  return new Response(JSON.stringify({ success: false, results }, null, 2), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
