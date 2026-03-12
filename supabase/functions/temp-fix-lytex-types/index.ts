const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LYTEX_API_URL = Deno.env.get("LYTEX_API_URL") || "https://api-pay.lytex.com.br/v2";

async function getAccessToken(): Promise<string> {
  const clientId = Deno.env.get("LYTEX_CLIENT_ID");
  const clientSecret = Deno.env.get("LYTEX_CLIENT_SECRET");
  const response = await fetch(`${LYTEX_API_URL}/auth/obtain_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, clientSecret }),
  });
  if (!response.ok) throw new Error(`Auth failed: ${response.status}`);
  const data = await response.json();
  return data.accessToken;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const token = await getAccessToken();
    console.log("[FixTypes] Token obtido com sucesso");

    const invoices = [
      { invoiceId: "69b14c1ffacbbd74d69df28a", value: 39520, label: "41.688.959/0001-49 R$395,20" },
      { invoiceId: "69b14c17014b2a5b08b55a47", value: 164160, label: "38.043.289/0001-07 R$1.641,60" },
      { invoiceId: "69b14c1b014b2a5b08b55b57", value: 109440, label: "38.043.289/0002-80 R$1.094,40" },
      { invoiceId: "69b14c13facbbd74d69df025", value: 106400, label: "26.227.833/0001-83 R$1.064,00" },
    ];

    const description = "125 - TAXA NEGOCIAL (MERCADOS) - 02/2026";
    const results: any[] = [];

    for (const inv of invoices) {
      try {
        const payload = {
          dueDate: "2026-03-13",
          items: [{ name: description, quantity: 1, value: inv.value }],
        };

        console.log(`[FixTypes] Atualizando ${inv.label}...`);

        const res = await fetch(`${LYTEX_API_URL}/invoices/${inv.invoiceId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        const text = await res.text();
        console.log(`[FixTypes] ${inv.label}: status=${res.status} body=${text.substring(0, 300)}`);
        results.push({ label: inv.label, status: res.status, ok: res.ok, body: text.substring(0, 200) });
      } catch (err: any) {
        console.error(`[FixTypes] Erro ${inv.label}:`, err.message);
        results.push({ label: inv.label, error: err.message });
      }
    }

    const allOk = results.every(r => r.ok);
    console.log(`[FixTypes] Concluído. Sucesso: ${allOk}. Resultados:`, JSON.stringify(results));

    return new Response(JSON.stringify({ success: allOk, results, executedAt: new Date().toISOString() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[FixTypes] Erro geral:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
