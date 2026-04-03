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
    const event = payload.event || '';
    const instance = payload.instance || '';
    
    console.log(`[webhook] Event: ${event}, Instance: ${instance}`);
    console.log(`[webhook] Payload keys: ${Object.keys(payload).join(', ')}`);

    // Handle Evolution API v2 format
    if (event === 'messages.upsert' || event === 'messages.update' || event === 'send.message') {
      const data = payload.data;
      if (!data?.key?.remoteJid) {
        console.log('[webhook] No remoteJid found, ignoring');
        return new Response(JSON.stringify({ ok: true, ignored: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Extract phone from remoteJid (e.g. "5573886335@s.whatsapp.net")
      const remoteJid = data.key.remoteJid;
      // Skip group messages
      if (remoteJid.endsWith('@g.us')) {
        console.log('[webhook] Group message, ignoring');
        return new Response(JSON.stringify({ ok: true, ignored: true, reason: 'group' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const contactNumber = remoteJid.replace('@s.whatsapp.net', '').replace('@lid', '');
      const fromMe = data.key.fromMe || false;
      const pushName = data.pushName || '';
      const messageId = data.key.id || '';
      const messageStatus = data.status || '';
      
      // Extract message body from various message types
      let body = '';
      let mediaType: string | null = null;
      let mediaUrl: string | null = null;

      const msg = data.message;
      if (msg) {
        if (msg.conversation) {
          body = msg.conversation;
        } else if (msg.extendedTextMessage?.text) {
          body = msg.extendedTextMessage.text;
        } else if (msg.imageMessage) {
          body = msg.imageMessage.caption || '[Imagem]';
          mediaType = 'image';
          mediaUrl = msg.imageMessage.url || null;
        } else if (msg.videoMessage) {
          body = msg.videoMessage.caption || '[Vídeo]';
          mediaType = 'video';
        } else if (msg.audioMessage) {
          body = '[Áudio]';
          mediaType = 'audio';
        } else if (msg.documentMessage) {
          body = msg.documentMessage.fileName || '[Documento]';
          mediaType = 'document';
        } else if (msg.stickerMessage) {
          body = '[Figurinha]';
          mediaType = 'sticker';
        } else if (msg.contactMessage) {
          body = msg.contactMessage.displayName || '[Contato]';
          mediaType = 'contact';
        } else if (msg.locationMessage) {
          body = '[Localização]';
          mediaType = 'location';
        }
      }

      // Use contactNumber as ticket_id for simplicity
      const ticketId = contactNumber;
      const now = new Date().toISOString();
      const timestamp = data.messageTimestamp 
        ? Number(data.messageTimestamp) 
        : Math.floor(Date.now() / 1000);

      console.log(`[webhook] Phone: ${contactNumber}, FromMe: ${fromMe}, Body: ${body.slice(0, 100)}`);

      // 1. Upsert ticket
      const ticketData: Record<string, unknown> = {
        ticket_id: ticketId,
        contact_number: contactNumber,
        contact_name: pushName || null,
        status: 'open',
        last_message: body ? body.slice(0, 500) : null,
        updated_at: now,
        raw_data: payload,
      };

      // Only set opened_at on insert (not update)
      const { data: existingTicket } = await supabase
        .from('whazing_tickets')
        .select('id, status')
        .eq('ticket_id', ticketId)
        .maybeSingle();

      if (!existingTicket) {
        ticketData.opened_at = now;
        ticketData.status = 'open';
      } else {
        // Don't reopen closed tickets automatically unless it's a new incoming message
        if (existingTicket.status === 'closed' && !fromMe) {
          ticketData.status = 'open';
          ticketData.opened_at = now;
          ticketData.closed_at = null;
        } else {
          // Keep existing status
          delete ticketData.status;
        }
      }

      // Update contact name if we have pushName and it's from the contact
      if (!fromMe && pushName) {
        ticketData.contact_name = pushName;
      }

      const { error: ticketError } = await supabase
        .from('whazing_tickets')
        .upsert(ticketData, { onConflict: 'ticket_id' });

      if (ticketError) {
        console.error('[webhook] Ticket upsert error:', ticketError);
      }

      // 2. Save message
      if (messageId && body) {
        const messageData = {
          ticket_id: ticketId,
          message_id: messageId,
          body: body.slice(0, 2000),
          from_me: fromMe,
          media_type: mediaType,
          media_url: mediaUrl,
          sender_name: fromMe ? 'Atendente' : (pushName || 'Contato'),
          sender_phone: fromMe ? null : contactNumber,
          status: messageStatus || null,
          timestamp,
        };

        const { error: msgError } = await supabase
          .from('whazing_messages')
          .upsert(messageData, { onConflict: 'message_id' });

        if (msgError) {
          console.error('[webhook] Message upsert error:', msgError);
        } else {
          console.log(`[webhook] ✅ Message ${messageId} saved for ticket ${ticketId}`);
        }
      }

      // 3. Route incoming (non-fromMe) messages to AI assistant
      if (!fromMe && body && body.length > 0 && !body.startsWith('[')) {
        console.log(`[webhook] Routing to AI assistant: phone=${contactNumber}, body="${body.slice(0, 80)}"`);
        try {
          const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
          const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

          // Get evolution config from DB
          const { data: evoConfig } = await supabase
            .from('evolution_configs')
            .select('clinic_id, api_url, api_key, instance_name')
            .limit(1)
            .maybeSingle();

          if (evoConfig) {
            const aiResp = await fetch(`${supabaseUrl}/functions/v1/whatsapp-ai-assistant`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseAnonKey}`,
              },
              body: JSON.stringify({
                clinic_id: evoConfig.clinic_id,
                phone: contactNumber,
                message: body,
                evolution_config: {
                  api_url: evoConfig.api_url,
                  api_key: evoConfig.api_key,
                  instance_name: evoConfig.instance_name,
                },
              }),
            });
            const aiResult = await aiResp.json();
            console.log(`[webhook] AI response status: ${aiResp.status}, action: ${aiResult?.action || 'unknown'}`);
          } else {
            console.log('[webhook] No evolution_configs found, skipping AI routing');
          }
        } catch (aiErr) {
          console.error('[webhook] AI routing error:', aiErr);
        }
      }

      return new Response(JSON.stringify({ ok: true, ticketId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Handle connection.update events
    if (event === 'connection.update') {
      console.log(`[webhook] Connection update:`, JSON.stringify(payload.data || {}).slice(0, 300));
      return new Response(JSON.stringify({ ok: true, event: 'connection.update' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fallback: try legacy Whazing format
    const ticket = payload.ticket;
    const contact = payload.contact;
    const ticketId = String(ticket?.id || payload.ticketId || payload.id || '');

    if (!ticketId) {
      console.log(`[webhook] Unknown event format: ${event}, ignoring`);
      return new Response(JSON.stringify({ ok: true, ignored: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Legacy format handling (keeping for backward compatibility)
    const ticketStatus = ticket?.status || payload.status || '';
    const contactNumber = contact?.phoneNumber || contact?.number || '';
    const contactName = contact?.name || contact?.pushname || '';
    const queueId = String(ticket?.queueId || payload.queueId || '');
    const userId = String(payload.user?.id || payload.userId || '');
    const lastMessage = payload.messageBody || payload.body || payload.lastMessage || '';
    const messageId = payload.messageId || '';
    const now = new Date().toISOString();

    const ticketData: Record<string, unknown> = {
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

    await supabase.from('whazing_tickets').upsert(ticketData, { onConflict: 'ticket_id' });

    if (messageId && lastMessage) {
      await supabase.from('whazing_messages').upsert({
        ticket_id: ticketId,
        message_id: messageId,
        body: lastMessage.slice(0, 2000),
        from_me: payload.fromMe || false,
        media_type: payload.mediaType || null,
        media_url: payload.mediaUrl || null,
        sender_name: payload.fromMe ? 'Atendente' : (contactName || 'Contato'),
        sender_phone: payload.fromMe ? null : contactNumber,
        status: payload.status || null,
        timestamp: payload.timestamp || Math.floor(Date.now() / 1000),
      }, { onConflict: 'message_id' });
    }

    return new Response(JSON.stringify({ ok: true, ticketId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[webhook] Error:', error);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
