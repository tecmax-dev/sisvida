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
    const { action, ticketId, message, queueId, userId, contactNumber } = await req.json();

    const evoUrl = (Deno.env.get('EVOLUTION_API_URL') || '').replace(/\/$/, '');
    const evoKey = Deno.env.get('EVOLUTION_API_KEY') || '';
    const rawInstance = (Deno.env.get('EVOLUTION_INSTANCE') || '').trim();
    const evoInstance = /^[a-z0-9_-]{1,40}$/i.test(rawInstance) && rawInstance !== '2b7dbe72ab69c51e4d37e55329e10aeb'
      ? rawInstance
      : 'secmi';
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!evoUrl || !evoKey) {
      return new Response(JSON.stringify({ error: 'Evolution API não configurada' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!supabaseUrl || !supabaseKey) {
      console.error('[whazing-actions] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`[whazing-actions] Action: ${action}, Ticket: ${ticketId}, Instance: ${evoInstance}`);

    const headers = {
      'Content-Type': 'application/json',
      'apikey': evoKey,
    };

    const body = await req.json();
    const { action, ticketId, contactNumber } = body;

    switch (action) {
      case 'send_media': {
        const { media, mimetype, fileName, mediatype, caption } = body;
        if (!media || !contactNumber || !mimetype) {
          return new Response(JSON.stringify({ error: 'media, contactNumber and mimetype are required' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        let cleanPhone = contactNumber.replace(/\D/g, '');
        if (!cleanPhone.startsWith('55')) cleanPhone = '55' + cleanPhone;

        const response = await fetch(`${evoUrl}/message/sendMedia/${evoInstance}`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            number: cleanPhone,
            mediatype: mediatype || 'document',
            mimetype,
            media,
            fileName: fileName || 'attachment',
            caption: caption || '',
          }),
        });

        const responseText = await response.text();
        console.log(`[whazing-actions] SendMedia response: ${response.status} ${responseText.slice(0, 300)}`);

        if (!response.ok) {
          return new Response(JSON.stringify({ ok: false, error: `API returned ${response.status}`, details: responseText }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Save locally
        const now = Math.floor(Date.now() / 1000);
        await supabase.from('whazing_messages').insert({
          ticket_id: ticketId,
          message_id: `sent-media-${now}-${Math.random().toString(36).slice(2, 8)}`,
          body: caption || `[${mediatype || 'documento'}] ${fileName || 'anexo'}`,
          from_me: true,
          sender_name: 'Atendente',
          timestamp: now,
          media_type: mimetype,
        });

        await supabase.from('whazing_tickets')
          .update({ last_message: `📎 ${fileName || 'Anexo'}`, updated_at: new Date().toISOString() })
          .eq('ticket_id', ticketId);

        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'send_message': {
        const { message } = body;
        if (!message || !contactNumber) {
          return new Response(JSON.stringify({ error: 'message and contactNumber are required' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        let cleanPhone = contactNumber.replace(/\D/g, '');
        if (!cleanPhone.startsWith('55')) cleanPhone = '55' + cleanPhone;

        // Send via Evolution API
        const response = await fetch(`${evoUrl}/message/sendText/${evoInstance}`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            number: cleanPhone,
            text: message,
          }),
        });

        const responseText = await response.text();
        console.log(`[whazing-actions] Send response: ${response.status} ${responseText.slice(0, 300)}`);

        if (!response.ok) {
          return new Response(JSON.stringify({ ok: false, error: `API returned ${response.status}`, details: responseText }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Save the sent message locally
        const now = Math.floor(Date.now() / 1000);
        await supabase.from('whazing_messages').insert({
          ticket_id: ticketId,
          message_id: `sent-${now}-${Math.random().toString(36).slice(2, 8)}`,
          body: message,
          from_me: true,
          sender_name: 'Atendente',
          timestamp: now,
        });

        // Update last_message on ticket
        await supabase.from('whazing_tickets')
          .update({ last_message: message.slice(0, 500), updated_at: new Date().toISOString() })
          .eq('ticket_id', ticketId);

        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'close_ticket': {
        await supabase.from('whazing_tickets')
          .update({ status: 'closed', closed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('ticket_id', ticketId);

        console.log(`[whazing-actions] Ticket ${ticketId} closed`);

        return new Response(JSON.stringify({ ok: true, message: 'Ticket closed' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'transfer_queue': {
        await supabase.from('whazing_tickets')
          .update({ queue_id: queueId, updated_at: new Date().toISOString() })
          .eq('ticket_id', ticketId);

        return new Response(JSON.stringify({ ok: true, message: 'Ticket transferred' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'transfer_user': {
        await supabase.from('whazing_tickets')
          .update({ user_id_whazing: userId, updated_at: new Date().toISOString() })
          .eq('ticket_id', ticketId);

        return new Response(JSON.stringify({ ok: true, message: 'Ticket assigned' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[whazing-actions] Error:', error);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
