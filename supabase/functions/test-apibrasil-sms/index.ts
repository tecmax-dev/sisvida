import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { ApiBrasilSmsService } from "../_shared/apibrasil-sms.ts";

serve(async (req) => {
  let body: any = {};
  try { body = await req.json(); } catch {}
  const phone = body.phone || "5573999999999";
  const message = body.message || "Teste ProSindWeb";

  const bearer = Deno.env.get("APIBRASIL_BEARER_TOKEN") || "";
  try {
    const sms = ApiBrasilSmsService.fromEnv({ timeoutMs: 15_000 });
    const result = await sms.send({ number: phone, message });
    return new Response(JSON.stringify({
      ok: result.ok,
      bearer_len: bearer.length,
      bearer_preview: bearer.slice(0, 10),
      ...(result.ok ? { status: result.status, data: result.data } : { error: result.error }),
    }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({
      ok: false,
      error: { message: (err as Error).message },
    }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});