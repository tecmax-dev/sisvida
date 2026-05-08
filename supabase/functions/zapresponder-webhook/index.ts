import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const BUILD_VERSION = 'FLOW_V2_BUILD_20260508';
const HANDLER_NAME = 'zapresponder-webhook';

serve(async (req) => {
  console.log("ENTRYPOINT zapresponder-webhook DISABLED", BUILD_VERSION);
  return new Response(JSON.stringify({ ok: true, status: "legacy_disabled" }), { status: 200 });
});
