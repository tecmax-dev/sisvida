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

    const ticket = payload.ticket;
    const contact = payload.contact;
    const user = payload.user;

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
    const lastMessage = payload.messageBody || payload.body || payload.lastMessage || '';
    const messageId = payload.messageId || '';

    console.log(`[whazing-ticket-webhook] Ticket #${ticketId} status=${ticketStatus} contact=${contactNumber} queue=${queueId} protocol=${protocol}`);

    const now = new Date().toISOString();

    // 1. Upsert ticket record
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

    if (ticketStatus === 'pending' || ticketStatus === 'open') {
      ticketData.opened_at = now;
    }
    if (ticketStatus === 'closed') {
      ticketData.closed_at = now;
    }

    const { error: ticketError } = await supabase
      .from('whazing_tickets')
      .upsert(ticketData, { onConflict: 'ticket_id' });

    if (ticketError) {
      console.error('[whazing-ticket-webhook] Ticket upsert error:', ticketError);
    }

    // 2. Save message if present
    if (messageId && lastMessage) {
      const messageData = {
        ticket_id: ticketId,
        message_id: messageId,
        body: lastMessage.slice(0, 2000),
        from_me: payload.fromMe || false,
        media_type: payload.mediaType || null,
        media_url: payload.mediaUrl || null,
        sender_name: payload.fromMe 
          ? (user?.name || 'Atendente') 
          : (contactName || 'Contato'),
        sender_phone: payload.fromMe ? null : contactNumber,
        status: payload.status || null,
        timestamp: payload.timestamp || Math.floor(Date.now() / 1000),
      };

      const { error: msgError } = await supabase
        .from('whazing_messages')
        .upsert(messageData, { onConflict: 'message_id' });

      if (msgError) {
        console.error('[whazing-ticket-webhook] Message upsert error:', msgError);
      } else {
        console.log(`[whazing-ticket-webhook] ✅ Message ${messageId} saved for ticket #${ticketId}`);
      }
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
