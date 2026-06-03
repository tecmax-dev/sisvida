import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  const bearer = Deno.env.get("APIBRASIL_BEARER_TOKEN") || "";
  const device = Deno.env.get("APIBRASIL_SMS_DEVICE_TOKEN") || "";
  let body: any = {};
  try { body = await req.json(); } catch {}
  const phone = body.phone || "5573999999999";
  const message = body.message || "Teste ProSindWeb";

  const res = await fetch("https://gateway.apibrasil.io/api/v2/sms/sendSimpleSms", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${bearer}`,
      "DeviceToken": device,
    },
    body: JSON.stringify({ number: phone, message }),
  });
  const text = await res.text();
  return new Response(JSON.stringify({
    status: res.status,
    bearer_len: bearer.length,
    device_len: device.length,
    bearer_preview: bearer.slice(0, 10),
    device_preview: device.slice(0, 10),
    response: text,
  }), { headers: { "Content-Type": "application/json" } });
});