import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SINDICATO_CLINIC_ID = "89e7585e-7bce-4e58-91fa-c37080d1170d";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const VERIFY_TOKEN = Deno.env.get("META_WEBHOOK_VERIFY_TOKEN") ?? "prosindweb_meta_2026";

  // Verificação inicial Meta (GET com hub.challenge)
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      return new Response(challenge ?? "", { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body = await req.json();
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Estrutura padrão Meta WhatsApp Cloud API
    const entries = body.entry ?? [];
    for (const entry of entries) {
      const changes = entry.changes ?? [];
      for (const change of changes) {
        if (change.field !== "messages") continue;
        const value = change.value ?? {};
        const messages = value.messages ?? [];
        const contacts = value.contacts ?? [];

        for (const msg of messages) {
          const fromPhone = msg.from as string; // já normalizado pela Meta (E.164 sem +)
          const wamid = msg.id as string;
          const timestamp = new Date(Number(msg.timestamp) * 1000).toISOString();
          const profileName = contacts[0]?.profile?.name ?? null;

          // Determinar tipo e conteúdo
          let messageType = msg.type ?? "text";
          let content = "";
          if (msg.type === "text") content = msg.text?.body ?? "";
          else if (msg.type === "button") content = msg.button?.text ?? "";
          else if (msg.type === "interactive") {
            content =
              msg.interactive?.button_reply?.title ??
              msg.interactive?.list_reply?.title ??
              "";
          } else if (msg.type === "image") content = msg.image?.caption ?? "[imagem]";
          else if (msg.type === "audio") content = "[áudio]";
          else if (msg.type === "document") content = msg.document?.filename ?? "[documento]";
          else content = `[${msg.type}]`;

          // Upsert contato (ON CONFLICT phone)
          let contactId: string | null = null;
          const { data: existingContact } = await supabase
            .from("whatsapp_contacts")
            .select("id, name")
            .eq("phone", fromPhone)
            .eq("clinic_id", SINDICATO_CLINIC_ID)
            .maybeSingle();

          if (existingContact) {
            contactId = existingContact.id;
            // Só sobrescreve nome se o atual estiver vazio (regra de memória)
            if (!existingContact.name && profileName) {
              await supabase.from("whatsapp_contacts").update({ name: profileName }).eq("id", contactId);
            }
          } else {
            const { data: newContact, error: cErr } = await supabase
              .from("whatsapp_contacts")
              .insert({
                clinic_id: SINDICATO_CLINIC_ID,
                phone: fromPhone,
                name: profileName,
              })
              .select("id")
              .single();
            if (cErr) {
              console.error("[meta-webhook] contact insert error:", cErr);
              continue;
            }
            contactId = newContact!.id;
          }

          // Buscar/criar ticket aberto
          let ticketId: string | null = null;
          const { data: openTicket } = await supabase
            .from("whatsapp_tickets")
            .select("id")
            .eq("contact_id", contactId)
            .eq("clinic_id", SINDICATO_CLINIC_ID)
            .in("status", ["open", "pending", "in_progress"])
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (openTicket) {
            ticketId = openTicket.id;
          } else {
            const { data: newTicket, error: tErr } = await supabase
              .from("whatsapp_tickets")
              .insert({
                clinic_id: SINDICATO_CLINIC_ID,
                contact_id: contactId,
                status: "open",
                priority: "normal",
                subject: content.slice(0, 80) || "Nova conversa",
              })
              .select("id")
              .single();
            if (tErr) {
              console.error("[meta-webhook] ticket insert error:", tErr);
              continue;
            }
            ticketId = newTicket!.id;
          }

          // Inserir mensagem
          await supabase.from("whatsapp_ticket_messages").insert({
            ticket_id: ticketId,
            sender_type: "contact",
            sender_name: profileName,
            message_type: messageType,
            content,
            metadata: { meta_message_id: wamid, raw: msg },
            created_at: timestamp,
          });

          // Atualizar ticket
          await supabase
            .from("whatsapp_tickets")
            .update({
              last_inbound_at: timestamp,
              last_message_at: timestamp,
              last_message: content,
              unread_count: 1,
            })
            .eq("id", ticketId);

          // Encaminhar para o fluxo principal (whatsapp-webhook) para processar lógica de bot
          try {
            const webhookPayload = {
              event: "messages.upsert",
              instance: "meta_official",
              data: {
                key: {
                  remoteJid: `${fromPhone}@s.whatsapp.net`,
                  fromMe: false,
                  id: wamid
                },
                message: {
                  conversation: content
                },
                pushName: profileName,
                messageTimestamp: Math.floor(new Date(timestamp).getTime() / 1000)
              }
            };

            console.log(`[meta-webhook] Forwarding message from ${fromPhone} to main bot...`);
            
            // Chama a função principal de bot passando o clinic_id
            fetch(`${SUPABASE_URL}/functions/v1/whatsapp-webhook?clinic_id=${SINDICATO_CLINIC_ID}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SERVICE_ROLE}`
              },
              body: JSON.stringify(webhookPayload)
            }).catch(err => console.error("[meta-webhook] Bot forward fetch error:", err));

          } catch (forwardErr) {
            console.error("[meta-webhook] Error forwarding to bot:", forwardErr);
          }
        }

        // Status updates (sent/delivered/read) - apenas log por enquanto
        if (value.statuses?.length) {
          console.log("[meta-webhook] statuses:", value.statuses.length);
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[meta-webhook] Error:", e);
    // Sempre retornar 200 pra Meta não reentregar infinitamente
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
