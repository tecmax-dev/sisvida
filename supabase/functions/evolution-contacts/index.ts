import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // Fetch all contacts from Evolution API
    const response = await fetch(`${evoUrl}/chat/findContacts/${evoInstance}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': evoKey },
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

    if (!Array.isArray(contacts)) {
      return new Response(JSON.stringify(contacts), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Enrich contacts without pushName by cross-referencing with patients table
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch all patients with phone numbers (select only needed fields)
    const { data: patients } = await supabase
      .from('patients')
      .select('name, phone')
      .not('phone', 'is', null)
      .neq('phone', '');

    // Build phone→name map from patients
    // Patients store phone as "73991691428", Evolution uses "5573991691428@s.whatsapp.net"
    const phoneNameMap = new Map<string, string>();
    for (const p of (patients || [])) {
      if (!p.phone || !p.name) continue;
      const digits = p.phone.replace(/\D/g, '');
      // Store with country code prefix
      const withCC = digits.startsWith('55') ? digits : `55${digits}`;
      phoneNameMap.set(withCC, p.name);
      // Also store without country code for fallback
      phoneNameMap.set(digits, p.name);
    }

    let enriched = 0;
    // Enrich contacts
    const enrichedContacts = contacts.map((c: any) => {
      if (c.pushName) return c; // Already has a name
      if (!c.remoteJid?.endsWith('@s.whatsapp.net')) return c;

      const phone = c.remoteJid.replace(/@.*$/, '');
      const name = phoneNameMap.get(phone);
      if (name) {
        enriched++;
        return { ...c, pushName: name, _enrichedFromPatients: true };
      }
      return c;
    });

    console.log(`[evolution-contacts] Enriched ${enriched} contacts from patients database`);

    return new Response(JSON.stringify(enrichedContacts), {
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
