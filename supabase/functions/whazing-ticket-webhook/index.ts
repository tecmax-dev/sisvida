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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload = await req.json();
    console.log('[whazing-ticket-webhook] Received:', JSON.stringify(payload).slice(0, 500));

    // Whazing can send different event formats
    // Common fields: ticketId, status, contact, queueId, userId
    const ticketId = String(payload.ticketId || payload.ticket?.id || payload.id || '');
    const status = payload.status || payload.ticket?.status || '';
    const contactNumber = payload.contact?.number || payload.number || payload.ticket?.contact?.number || '';
    const contactName = payload.contact?.name || payload.contact?.pushname || payload.ticket?.contact?.name || '';
    const queueId = String(payload.queueId || payload.ticket?.queueId || '');
    const userId = String(payload.userId || payload.ticket?.userId || '');
    const lastMessage = payload.lastMessage || payload.body || '';

    if (!ticketId) {
      console.log('[whazing-ticket-webhook] No ticketId found, ignoring');
      return new Response(JSON.stringify({ ok: true, ignored: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[whazing-ticket-webhook] Ticket #${ticketId} status=${status} contact=${contactNumber} queue=${queueId}`);

    // Upsert ticket record
    const now = new Date().toISOString();
    const ticketData: any = {
      ticket_id: ticketId,
      contact_number: contactNumber,
      contact_name: contactName,
      status: status || 'pending',
      queue_id: queueId || null,
      user_id_whazing: userId || null,
      last_message: lastMessage ? lastMessage.slice(0, 500) : null,
      updated_at: now,
      raw_data: payload,
    };

    // Set opened_at only on creation
    if (status === 'pending' || status === 'open') {
      ticketData.opened_at = now;
    }

    // Set closed_at when ticket is closed
    if (status === 'closed') {
      ticketData.closed_at = now;
    }

    const { error } = await supabase
      .from('whazing_tickets')
      .upsert(ticketData, { onConflict: 'ticket_id' });

    if (error) {
      console.error('[whazing-ticket-webhook] Upsert error:', error);
      return new Response(JSON.stringify({ ok: false, error: error.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[whazing-ticket-webhook] ✅ Ticket #${ticketId} saved/updated`);

    return new Response(JSON.stringify({ ok: true, ticketId, status }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[whazing-ticket-webhook] Error:', error);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
