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
  const CONFIG_TOKEN = (Deno.env.get("META_WEBHOOK_VERIFY_TOKEN") || "").trim();
  const DEFAULT_TOKEN = "prosindweb_meta_2026";

  // Verificação inicial Meta (GET com hub.challenge)
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    
    console.log(`[meta-webhook] VERIFICAÇÃO: token=${token}`);

    if (mode === "subscribe" && (token === CONFIG_TOKEN || token === DEFAULT_TOKEN)) {
      console.log("[meta-webhook] Verificação bem-sucedida!");
      return new Response(challenge ?? "", { status: 200 });
    }
    console.error("[meta-webhook] Verificação falhou. Token não corresponde.");
    return new Response("Forbidden", { status: 403 });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    let body = await req.json();
    console.log("[meta-webhook] Body recebido:", JSON.stringify(body));
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Normalização agressiva para qualquer formato do ZapResponder (inclusive on-message)
    if (!Array.isArray(body.entry)) {
      const rawMsg = body.raw_message ?? {};
      const phoneValue = body.phone || body.wa_id || body.chatId || rawMsg.from || (body.data?.key?.remoteJid) || "";
      const fromPhone = String(phoneValue).replace(/@.*/, "").replace(/\D/g, "");
      
      const textBody = (
        body.mensagem || 
        body.message?.mensagem ||
        body.message?.text ||
        body.message?.content ||
        rawMsg.content ||
        body.text || 
        body.raw_message?.body ||
        body.data?.message?.conversation ||
        ""
      ).toString().trim();

      const pushName = body.pushName || rawMsg.pushName || body.data?.pushName || body.nome || "Cliente";

      if (fromPhone) {
        body = {
          ...body,
          entry: [{
            changes: [{
              field: "messages",
              value: {
                metadata: body.metadata || { display_phone_number: rawMsg.device || "557332311784" },
                contacts: [{ profile: { name: pushName } }],
                messages: [{
                  from: fromPhone,
                  id: rawMsg.id || body.id || `zap-${Date.now()}`,
                  timestamp: String(rawMsg.timestamp || body.timestamp || Math.floor(Date.now() / 1000)),
                  type: "text",
                  text: { body: textBody }
                }]
              }
            }]
          }]
        };
        console.log(`[meta-webhook] Rota customizada detectada. Normalizando De ${fromPhone}: "${textBody}"`);
      }
    }

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
          
          if (msg.type === "text") {
            content = msg.text?.body ?? "";
          } else if (msg.type === "button") {
            content = msg.button?.payload || msg.button?.text || "";
          } else if (msg.type === "interactive") {
            const interactive = msg.interactive || {};
            if (interactive.type === "button_reply") {
              content = interactive.button_reply?.id || interactive.button_reply?.title || "";
            } else if (interactive.type === "list_reply") {
              content = interactive.list_reply?.id || interactive.list_reply?.title || "";
            } else {
              content = 
                interactive.button_reply?.id || 
                interactive.button_reply?.title || 
                interactive.list_reply?.id || 
                interactive.list_reply?.title || 
                "";
            }
          } else if (msg.type === "image") content = msg.image?.caption ?? "[imagem]";
          else if (msg.type === "audio") content = "[áudio]";
          else if (msg.type === "document") content = msg.document?.filename ?? "[documento]";
          else content = `[${msg.type}]`;

          console.log(`[meta-webhook] DEBUG: Nova mensagem recebida da Meta`);
          console.log(`[meta-webhook] DE: ${fromPhone}`);
           console.log(`[meta-webhook][DEBUG_BOLETO] MSG_CONTENT: "${content}" | TYPE: ${messageType} | FROM: ${fromPhone}`);
 
           // ── REDIRECIONAMENTO PARA FLUXO DE BOLETO (SINDICATO) ──
           const isBoletoAction = content.toLowerCase().includes("boleto") || 
                                 content === "whazing_sub_boleto" || 
                                 content === "boleto_a_vencer" || 
                                 content === "boleto_vencido";
 
           if (isBoletoAction && SINDICATO_CLINIC_ID) {
             console.log(`[meta-webhook][DEBUG_BOLETO] Redirecionando para boleto-whatsapp-flow: ${fromPhone}`);
             fetch(`${SUPABASE_URL}/functions/v1/boleto-whatsapp-flow`, {
               method: 'POST',
               headers: {
                 'Content-Type': 'application/json',
                 'Authorization': `Bearer ${SERVICE_ROLE}`
               },
               body: JSON.stringify({
                 clinic_id: SINDICATO_CLINIC_ID,
                 phone: fromPhone,
                 message: content,
                 action: (content === "whazing_sub_boleto") ? "start" : undefined,
                 explicit_phone_id: "1110151302179856"
               })
             }).then(async r => {
               const resData = await r.json();
               console.log(`[meta-webhook][DEBUG_BOLETO] Resposta do fluxo:`, JSON.stringify(resData));
               
               // Se o fluxo retornou uma resposta, enviamos via Meta
               if (resData.response) {
                 console.log(`[meta-webhook][DEBUG_BOLETO] Enviando resposta do boleto para o usuário...`);
                 // Usamos a função interna meta-send-text para garantir o envio
                 await fetch(`${SUPABASE_URL}/functions/v1/meta-send-text`, {
                   method: 'POST',
                   headers: {
                     'Content-Type': 'application/json',
                     'Authorization': `Bearer ${SERVICE_ROLE}`
                   },
                   body: JSON.stringify({
                     to: fromPhone,
                     text: resData.response,
                     phone_number_id: "1110151302179856"
                   })
                 });
               }
             }).catch(err => console.error("[meta-webhook][DEBUG_BOLETO] Erro ao chamar fluxo:", err));
             
             // Se for uma ação de boleto, não precisamos necessariamente seguir para o Zap Responder, 
             // mas vamos deixar seguir para registro no dashboard se necessário.
           }
          console.log(`[meta-webhook] ID: ${wamid}`);
          
          
           let ticketId: string | null = null;
           try {
             let contactId: string | null = null;
             const { data: existingContact } = await supabase
               .from("whatsapp_contacts")
               .select("id, name")
               .eq("phone", fromPhone)
               .eq("clinic_id", SINDICATO_CLINIC_ID)
               .maybeSingle();

             if (existingContact) {
               contactId = existingContact.id;
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
               if (!cErr) contactId = newContact!.id;
             }

             if (contactId) {
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
                 if (!tErr) ticketId = newTicket!.id;
               }

               if (ticketId) {
                 await supabase.from("whatsapp_ticket_messages").insert({
                   ticket_id: ticketId,
                   sender_type: "contact",
                   sender_name: profileName,
                   message_type: messageType,
                   content,
                   metadata: { meta_message_id: wamid, raw: msg },
                   created_at: timestamp,
                 });

                 await supabase
                   .from("whatsapp_tickets")
                   .update({
                     last_inbound_at: timestamp,
                     last_message_at: timestamp,
                     last_message: content,
                     unread_count: 1,
                   })
                   .eq("id", ticketId);
               }
             }
           } catch (syncErr) {
             console.error("[meta-webhook] Erro ao sincronizar mensagem:", syncErr);
           }

           // Encaminha para o Zap Responder externo (se configurado)
           const zapToken = Deno.env.get("ZAPRESPONDER_API_TOKEN") || Deno.env.get("ZAPSTER_API_TOKEN");
           const { data: zapCfg } = await supabase
             .from("zapster_configs")
             .select("instance_id")
             .eq("clinic_id", SINDICATO_CLINIC_ID)
             .eq("is_active", true)
             .maybeSingle();

           if (zapToken && zapCfg?.instance_id) {
             console.log(`[meta-webhook] Encaminhando para Zap Responder EXTERNO... Instância: ${zapCfg.instance_id}`);
             fetch(`https://api.zapresponder.com.br/api/webhook`, {
               method: 'POST',
               headers: {
                 'Content-Type': 'application/json',
                 'Authorization': `Bearer ${zapToken}`
               },
               body: JSON.stringify({ 
                 ...body, 
                 departamento_id: zapCfg.instance_id,
                 instance_id: zapCfg.instance_id,
                 is_official_api: true 
               })
             }).catch(err => console.error("[meta-webhook] Erro ao chamar Zap Responder Externo:", err));
           }

           console.log(`[meta-webhook] Encaminhando para Zap Responder... TicketID: ${ticketId}`);
           fetch(`${SUPABASE_URL}/functions/v1/zapresponder-webhook`, {
             method: 'POST',
             headers: {
               'Content-Type': 'application/json',
               'Authorization': `Bearer ${SERVICE_ROLE}`
             },
             body: JSON.stringify({ ...body, ticket_id: ticketId })
           }).catch(err => console.error("[meta-webhook] Erro ao chamar Zap Responder:", err));
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
