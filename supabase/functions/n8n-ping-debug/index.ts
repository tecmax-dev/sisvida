import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  return new Response(JSON.stringify({ 
      source: 'PING_DEBUG_LOCAL_V2',
      ts: new Date().toISOString()
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
});
