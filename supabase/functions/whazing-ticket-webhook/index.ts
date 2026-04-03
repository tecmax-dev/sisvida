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
    console.log('[whazing-ticket-webhook] Received:', JSON.stringify(payload).slice(0, 800));

    // Whazing webhook payload structure (from official docs):
    // {
    //   messageId, messageBody, timestamp, status, fromMe,
    //   mediaType, mediaUrl, isDeleted, sendType, edited, reactions, dataJson,
    //   ticket: { id, status, protocol, queueId, apiConfig, isGroup },
    //   contact: { id, name, phoneNumber, profilePicUrl, email, isGroup, pushname, lid, kanbanId, followupId },
    //   user: { id, name, email },
    //   whatsapp: { id, name }
    // }

    const ticket = payload.ticket;
    const contact = payload.contact;
    const user = payload.user;

    // Extract ticket ID - primary from ticket object, fallback to legacy formats
    const ticketId = String(ticket?.id || payload.ticketId || payload.id || '');

    if (!ticketId) {
      console.log('[whazing-ticket-webhook] No ticketId found, ignoring');
      return new Response(JSON.stringify({ ok: true, ignored: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const ticketStatus = ticket?.status || payload.status || '';
    const contactNumber = contact?.phoneNumber || contact?.number || payload.contact?.number || '';
    const contactName = contact?.name || contact?.pushname || '';
    const queueId = String(ticket?.queueId || payload.queueId || '');
    const userId = String(user?.id || payload.userId || '');
    const protocol = ticket?.protocol || '';
    const isGroup = ticket?.isGroup || false;
    const lastMessage = payload.messageBody || payload.body || payload.lastMessage || '';

    console.log(`[whazing-ticket-webhook] Ticket #${ticketId} status=${ticketStatus} contact=${contactNumber} queue=${queueId} protocol=${protocol}`);

    // Upsert ticket record
    const now = new Date().toISOString();
    const ticketData: any = {
      ticket_id: ticketId,
      contact_number: contactNumber,
      contact_name: contactName,
      status: ticketStatus || 'pending',
      queue_id: queueId || null,
      user_id_whazing: userId || null,
      last_message: lastMessage ? lastMessage.slice(0, 500) : null,
      updated_at: now,
      raw_data: payload,
    };

    // Set opened_at only on creation
    if (ticketStatus === 'pending' || ticketStatus === 'open') {
      ticketData.opened_at = now;
    }

    // Set closed_at when ticket is closed
    if (ticketStatus === 'closed') {
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

    console.log(`[whazing-ticket-webhook] ✅ Ticket #${ticketId} saved/updated (status=${ticketStatus})`);

    return new Response(JSON.stringify({ ok: true, ticketId, status: ticketStatus }), {
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
