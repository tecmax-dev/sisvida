import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Probe multiple APIBrasil SMS endpoint/header/body combinations to discover
// which one accepts the current Bearer (and optional DeviceToken) credentials.
serve(async (req) => {
  let body: any = {};
  try { body = await req.json(); } catch {}
  const phone: string = body.phone || "5573988633535";
  const message: string = body.message || "Teste ProSindWeb (diagnostico)";

  const bearer = Deno.env.get("APIBRASIL_BEARER_TOKEN") || "";
  const deviceToken = Deno.env.get("APIBRASIL_SMS_DEVICE_TOKEN") || "";

  const urls = [
    "https://gateway.apibrasil.io/api/v2/sms/send",
    "https://gateway.apibrasil.io/api/v2/sms/enviar",
    "https://gateway.apibrasil.io/api/v2/sms/send-sms",
    "https://gateway.apibrasil.io/api/v2/dispatch/sms/send",
  ];

  const phoneVariants = [phone, phone.startsWith("55") ? phone : `55${phone}`];

  const bodyShapes: Array<Record<string, string>> = [
    { number: phoneVariants[0], message },
    { number: phoneVariants[1], message },
    { to: phoneVariants[0], text: message },
    { phone: phoneVariants[0], message },
  ];

  const headerSets: Array<{ name: string; headers: Record<string, string> }> = [
    {
      name: "bearer-only",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${bearer}`,
      },
    },
  ];
  if (deviceToken) {
    headerSets.push({
      name: "bearer+devicetoken",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${bearer}`,
        DeviceToken: deviceToken,
      },
    });
  }

  const results: any[] = [];
  for (const url of urls) {
    for (const hset of headerSets) {
      for (const shape of bodyShapes) {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 12_000);
        try {
          const res = await fetch(url, {
            method: "POST",
            headers: hset.headers,
            body: JSON.stringify(shape),
            signal: ctrl.signal,
          });
          const text = await res.text();
          results.push({
            url,
            headers: hset.name,
            body: shape,
            status: res.status,
            response: text.slice(0, 400),
          });
        } catch (e) {
          results.push({
            url,
            headers: hset.name,
            body: shape,
            error: (e as Error).message,
          });
        } finally {
          clearTimeout(t);
        }
      }
    }
  }

  return new Response(
    JSON.stringify({
      bearer_len: bearer.length,
      bearer_preview: bearer.slice(0, 12),
      device_token_len: deviceToken.length,
      device_token_preview: deviceToken.slice(0, 12),
      results,
    }, null, 2),
    { headers: { "Content-Type": "application/json" } },
  );
});