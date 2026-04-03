import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const evoUrl = (Deno.env.get('EVOLUTION_API_URL') || '').replace(/\/$/, '');
    const evoKey = Deno.env.get('EVOLUTION_API_KEY') || '';
    const rawInstance = (Deno.env.get('EVOLUTION_INSTANCE') || '').trim();
    const evoInstance = /^[a-z0-9_-]{1,40}$/i.test(rawInstance) && rawInstance !== '2b7dbe72ab69c51e4d37e55329e10aeb'
      ? rawInstance
      : 'secmi';

    if (!evoUrl || !evoKey) {
      return new Response(JSON.stringify({ error: 'Evolution API não configurada' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const headers = {
      'Content-Type': 'application/json',
      'apikey': evoKey,
    };

    // Fetch all contacts
    const response = await fetch(`${evoUrl}/chat/findContacts/${evoInstance}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ where: {} }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[evolution-contacts] API error: ${response.status} ${errText.slice(0, 500)}`);
      return new Response(JSON.stringify({ error: `Evolution API returned ${response.status}`, details: errText.slice(0, 300) }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const contacts = await response.json();
    console.log(`[evolution-contacts] Fetched ${Array.isArray(contacts) ? contacts.length : '?'} contacts`);

    return new Response(JSON.stringify(contacts), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[evolution-contacts] Error:', error);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
