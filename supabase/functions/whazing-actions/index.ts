import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, '');
  return digits.startsWith('55') ? digits : `55${digits}`;
}

function isSyntheticMessageId(messageId?: string | null) {
  if (!messageId) return true;
  return ['sent-', 'sent-media-', 'bot-return-', 'support-chat-'].some((prefix) => messageId.startsWith(prefix));
}

function tryParseJson<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

type MessageCandidate = {
  id: string;
  fromMe: boolean;
  participant?: string;
  source: 'local' | 'evolution';
};

function dedupeMessageCandidates(candidates: MessageCandidate[]) {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = `${candidate.id}:${candidate.fromMe}:${candidate.participant || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractChatArchiveState(payload: unknown, remoteJid: string): boolean | null {
  const queue: unknown[] = [payload];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== 'object') continue;

    if (Array.isArray(current)) {
      queue.push(...current);
      continue;
    }

    const record = current as Record<string, unknown>;
    const identifiers = [record.id, record.chatId, record.remoteJid, record.jid];
    const matchesChat = identifiers.some((value) => typeof value === 'string' && value === remoteJid);

    if (matchesChat) {
      if (typeof record.archived === 'boolean') return record.archived;
      if (typeof record.archive === 'boolean') return record.archive;
    }

    queue.push(...Object.values(record));
  }

  return null;
}

function extractMessageCandidatesFromPayload(payload: unknown, remoteJid: string): MessageCandidate[] {
  const queue: unknown[] = [payload];
  const candidates: MessageCandidate[] = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== 'object') continue;

    if (Array.isArray(current)) {
      queue.push(...current);
      continue;
    }

    const record = current as Record<string, unknown>;
    const rawKey = record.key;

    if (rawKey && typeof rawKey === 'object' && !Array.isArray(rawKey)) {
      const key = rawKey as Record<string, unknown>;
      if (typeof key.id === 'string' && typeof key.remoteJid === 'string' && key.remoteJid === remoteJid) {
        candidates.push({
          id: key.id,
          fromMe: Boolean(key.fromMe),
          participant: typeof key.participant === 'string' ? key.participant : undefined,
          source: 'evolution',
        });
      }
    }

    queue.push(...Object.values(record));
  }

  return dedupeMessageCandidates(candidates);
}

async function fetchEvolutionMessageCandidates({
  evoUrl,
  evoInstance,
  headers,
  remoteJid,
}: {
  evoUrl: string;
  evoInstance: string;
  headers: Record<string, string>;
  remoteJid: string;
}) {
  const response = await fetch(`${evoUrl}/chat/findMessages/${evoInstance}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      where: {
        key: {
          remoteJid,
        },
      },
    }),
  });

  const responseText = await response.text();
  console.log(`[whazing-actions] findMessages ${remoteJid}: ${response.status} ${responseText.slice(0, 300)}`);

  if (!response.ok || !responseText.trim()) {
    return [] as MessageCandidate[];
  }

  const parsed = tryParseJson<unknown>(responseText);
  if (!parsed) return [] as MessageCandidate[];

  return extractMessageCandidatesFromPayload(parsed, remoteJid);
}

async function fetchEvolutionChatArchiveState({
  evoUrl,
  evoInstance,
  headers,
  remoteJid,
}: {
  evoUrl: string;
  evoInstance: string;
  headers: Record<string, string>;
  remoteJid: string;
}) {
  const queryBodies = [
    { where: { id: remoteJid } },
    { where: { chatId: remoteJid } },
    { where: { remoteJid } },
    {},
  ];

  for (const body of queryBodies) {
    const response = await fetch(`${evoUrl}/chat/findChats/${evoInstance}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const responseText = await response.text();
    console.log(`[whazing-actions] findChats ${remoteJid}: ${response.status} ${responseText.slice(0, 300)}`);

    if (!response.ok || !responseText.trim()) {
      continue;
    }

    const parsed = tryParseJson<unknown>(responseText);
    if (!parsed) continue;

    const archiveState = extractChatArchiveState(parsed, remoteJid);
    if (archiveState !== null) {
      return archiveState;
    }
  }

  return null;
}

async function setEvolutionArchiveStatus({
  archive,
  contactNumber,
  ticketId,
  supabase,
  evoUrl,
  evoInstance,
  headers,
}: {
  archive: boolean;
  contactNumber?: string;
  ticketId?: string;
  supabase: ReturnType<typeof createClient>;
  evoUrl: string;
  evoInstance: string;
  headers: Record<string, string>;
}) {
  if (!contactNumber) return null;

  const cleanPhone = normalizePhone(contactNumber);
  const remoteJid = `${cleanPhone}@s.whatsapp.net`;
  const localCandidates: MessageCandidate[] = [];

  if (ticketId) {
    const { data: recentMessages, error: recentMessagesError } = await supabase
      .from('whazing_messages')
      .select('message_id, from_me, timestamp, created_at')
      .eq('ticket_id', ticketId)
      .order('timestamp', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50);

    if (recentMessagesError) {
      throw recentMessagesError;
    }

    const realLocalMessages = (recentMessages || []).filter((message) => !isSyntheticMessageId(message.message_id));
    const orderedLocalMessages = [
      ...realLocalMessages.filter((message) => message.from_me),
      ...realLocalMessages.filter((message) => !message.from_me),
    ];

    localCandidates.push(
      ...orderedLocalMessages.flatMap((message) => (
        message.message_id
          ? [{ id: message.message_id, fromMe: Boolean(message.from_me), source: 'local' as const }]
          : []
      ))
    );
  }

  const evolutionCandidates = await fetchEvolutionMessageCandidates({
    evoUrl,
    evoInstance,
    headers,
    remoteJid,
  });

  const candidates = dedupeMessageCandidates([
    ...localCandidates,
    ...evolutionCandidates.filter((candidate) => candidate.fromMe),
    ...evolutionCandidates.filter((candidate) => !candidate.fromMe),
  ]);

  if (!candidates.length) {
    throw new Error(`No real message key found for ticket ${ticketId || cleanPhone}`);
  }

  let lastFailure = 'No archive candidate succeeded';

  for (const candidate of candidates) {
    const response = await fetch(`${evoUrl}/chat/archiveChat/${evoInstance}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        lastMessage: {
          key: {
            remoteJid,
            fromMe: candidate.fromMe,
            id: candidate.id,
            ...(candidate.participant ? { participant: candidate.participant } : {}),
          },
        },
        chat: remoteJid,
        archive,
      }),
    });

    const responseText = await response.text();
    const responseJson = tryParseJson<{ archived?: boolean }>(responseText);
    let effectiveArchivedState = typeof responseJson?.archived === 'boolean' ? responseJson.archived : null;

    if (effectiveArchivedState !== archive) {
      const verifiedArchiveState = await fetchEvolutionChatArchiveState({
        evoUrl,
        evoInstance,
        headers,
        remoteJid,
      });

      if (verifiedArchiveState !== null) {
        effectiveArchivedState = verifiedArchiveState;
      }
    }

    console.log(
      `[whazing-actions] Archive sync (${archive ? 'archive' : 'unarchive'}) ${remoteJid} candidate=${candidate.id} fromMe=${candidate.fromMe} source=${candidate.source}: ${response.status} ${responseText.slice(0, 300)} | effectiveArchived=${effectiveArchivedState}`
    );

    if (response.ok && effectiveArchivedState === archive) {
      return { cleanPhone, remoteJid, responseText, messageId: candidate.id };
    }

    lastFailure = response.ok
      ? `candidate ${candidate.id} returned archived=${effectiveArchivedState}`
      : `candidate ${candidate.id} failed (${response.status}): ${responseText}`;
  }

  throw new Error(`Evolution archive sync failed for ${remoteJid}: ${lastFailure}`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, ticketId, contactNumber } = body;

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
        const responseJson = tryParseJson<{ key?: { id?: string }, messageTimestamp?: number, status?: string }>(responseText);
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
          message_id: responseJson?.key?.id || `sent-media-${now}-${Math.random().toString(36).slice(2, 8)}`,
          body: caption || `[${mediatype || 'documento'}] ${fileName || 'anexo'}`,
          from_me: true,
          sender_name: 'Atendente',
          timestamp: responseJson?.messageTimestamp || now,
          media_type: mimetype,
          status: responseJson?.status || null,
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
        const responseJson = tryParseJson<{ key?: { id?: string }, messageTimestamp?: number, status?: string }>(responseText);
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
          message_id: responseJson?.key?.id || `sent-${now}-${Math.random().toString(36).slice(2, 8)}`,
          body: message,
          from_me: true,
          sender_name: 'Atendente',
          timestamp: responseJson?.messageTimestamp || now,
          status: responseJson?.status || null,
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
        if (contactNumber) {
          await setEvolutionArchiveStatus({
            archive: true,
            contactNumber,
            ticketId,
            supabase,
            evoUrl,
            evoInstance,
            headers,
          });
        }

        await supabase.from('whazing_tickets')
          .update({ status: 'closed', closed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('ticket_id', ticketId);

        console.log(`[whazing-actions] Ticket ${ticketId} closed`);

        return new Response(JSON.stringify({ ok: true, message: 'Ticket closed' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'reopen_ticket': {
        if (contactNumber) {
          await setEvolutionArchiveStatus({
            archive: false,
            contactNumber,
            ticketId,
            supabase,
            evoUrl,
            evoInstance,
            headers,
          });
        }

        await supabase.from('whazing_tickets')
          .update({ status: 'open', closed_at: null, opened_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('ticket_id', ticketId);

        console.log(`[whazing-actions] Ticket ${ticketId} reopened`);

        return new Response(JSON.stringify({ ok: true, message: 'Ticket reopened' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'ensure_ticket_open': {
        const { contactName, allowLocalFallback, lastMessage, messageId, messageTimestamp, senderName } = body;
        if (!contactNumber) {
          return new Response(JSON.stringify({ error: 'contactNumber is required' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const cleanPhone = normalizePhone(contactNumber);
        const canonicalTicketId = ticketId || cleanPhone;
        const nowIso = new Date().toISOString();
        const trimmedLastMessage = typeof lastMessage === 'string' ? lastMessage.trim() : '';
        const normalizedMessageId = typeof messageId === 'string' && messageId.trim()
          ? (messageId.startsWith('support-chat-') ? messageId : `support-chat-${messageId}`)
          : null;
        let externalSyncError: string | null = null;

        try {
          await setEvolutionArchiveStatus({
            archive: false,
            contactNumber: cleanPhone,
            ticketId: canonicalTicketId,
            supabase,
            evoUrl,
            evoInstance,
            headers,
          });
        } catch (error) {
          externalSyncError = error instanceof Error ? error.message : 'Unknown external sync error';
          if (!allowLocalFallback) {
            throw error;
          }

          console.warn(`[whazing-actions] Local fallback enabled for ${canonicalTicketId}: ${externalSyncError}`);
        }

        const { data: existingTicket, error: existingTicketError } = await supabase
          .from('whazing_tickets')
          .select('opened_at, contact_name')
          .eq('ticket_id', canonicalTicketId)
          .maybeSingle();

        if (existingTicketError) {
          throw existingTicketError;
        }

        const ticketPayload = {
          ticket_id: canonicalTicketId,
          contact_number: cleanPhone,
          contact_name: contactName || existingTicket?.contact_name || null,
          status: 'open',
          opened_at: existingTicket?.opened_at || nowIso,
          closed_at: null,
          updated_at: nowIso,
          ...(trimmedLastMessage ? { last_message: trimmedLastMessage.slice(0, 500) } : {}),
        };

        const { data: upsertedTicket, error: upsertError } = await supabase
          .from('whazing_tickets')
          .upsert(ticketPayload, { onConflict: 'ticket_id' })
          .select()
          .single();

        if (upsertError) {
          throw upsertError;
        }

        if (trimmedLastMessage) {
          const finalMessageId = normalizedMessageId || `support-chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

          const { data: existingMessage, error: existingMessageError } = await supabase
            .from('whazing_messages')
            .select('id')
            .eq('ticket_id', canonicalTicketId)
            .eq('message_id', finalMessageId)
            .maybeSingle();

          if (existingMessageError) {
            throw existingMessageError;
          }

          if (!existingMessage) {
            const effectiveTimestamp = typeof messageTimestamp === 'number' && Number.isFinite(messageTimestamp)
              ? Math.floor(messageTimestamp)
              : Math.floor(Date.now() / 1000);

            const { error: insertMessageError } = await supabase
              .from('whazing_messages')
              .insert({
                ticket_id: canonicalTicketId,
                message_id: finalMessageId,
                body: trimmedLastMessage,
                from_me: false,
                sender_name: senderName || contactName || existingTicket?.contact_name || null,
                sender_phone: cleanPhone,
                timestamp: effectiveTimestamp,
              });

            if (insertMessageError) {
              throw insertMessageError;
            }
          }
        }

        console.log(`[whazing-actions] Ticket ${canonicalTicketId} ensured open and synced`);

        return new Response(JSON.stringify({ ok: true, message: 'Ticket ensured open', ticket: upsertedTicket, externalSyncError }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'transfer_queue': {
        const { queueId } = body;
        await supabase.from('whazing_tickets')
          .update({ queue_id: queueId, updated_at: new Date().toISOString() })
          .eq('ticket_id', ticketId);

        return new Response(JSON.stringify({ ok: true, message: 'Ticket transferred' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'transfer_user': {
        const { userId } = body;
        await supabase.from('whazing_tickets')
          .update({ user_id_whazing: userId, updated_at: new Date().toISOString() })
          .eq('ticket_id', ticketId);

        return new Response(JSON.stringify({ ok: true, message: 'Ticket assigned' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'assume_ticket': {
        // Agent takes over - disable bot
        await supabase.from('whazing_tickets')
          .update({ bot_active: false, status: 'open', updated_at: new Date().toISOString() })
          .eq('ticket_id', ticketId);

        console.log(`[whazing-actions] Ticket ${ticketId} assumed by agent - bot disabled`);

        return new Response(JSON.stringify({ ok: true, message: 'Bot disabled - agent assumed' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'return_to_bot': {
        // Return ticket to bot and send notification to contact
        await supabase.from('whazing_tickets')
          .update({ bot_active: true, updated_at: new Date().toISOString() })
          .eq('ticket_id', ticketId);

        // Send message to contact informing they are back with the bot
        if (contactNumber) {
          let cleanPhone = contactNumber.replace(/\D/g, '');
          if (!cleanPhone.startsWith('55')) cleanPhone = '55' + cleanPhone;

          const returnMsg = '🤖 Você foi redirecionado(a) de volta para o atendimento automático. Como posso ajudá-lo(a)?';

          try {
            await fetch(`${evoUrl}/message/sendText/${evoInstance}`, {
              method: 'POST',
              headers,
              body: JSON.stringify({ number: cleanPhone, text: returnMsg }),
            });
          } catch (_e) { /* ignore send error */ }

          // Save the bot message locally
          const now = Math.floor(Date.now() / 1000);
          await supabase.from('whazing_messages').insert({
            ticket_id: ticketId,
            message_id: `bot-return-${now}-${Math.random().toString(36).slice(2, 8)}`,
            body: returnMsg,
            from_me: true,
            sender_name: 'LIA (Bot)',
            timestamp: now,
          });

          await supabase.from('whazing_tickets')
            .update({ last_message: returnMsg.slice(0, 500), updated_at: new Date().toISOString() })
            .eq('ticket_id', ticketId);
        }

        console.log(`[whazing-actions] Ticket ${ticketId} returned to bot`);

        return new Response(JSON.stringify({ ok: true, message: 'Bot re-enabled' }), {
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
