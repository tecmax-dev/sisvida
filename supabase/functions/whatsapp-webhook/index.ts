import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

serve(async (_req) => {
  console.log("[whatsapp-webhook] DISABLED TO PREVENT CONCURRENCY");
  return new Response("Legacy system disabled", { status: 200 });
});
