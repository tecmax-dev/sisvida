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
    console.log('[ENTRY] meta-webhook');
    let body = await req.json();
    console.log("[meta-webhook] Body recebido:", JSON.stringify(body));

    // 1. Identificar se é uma mensagem do usuário (message_received)
    // ZapResponder envia diversos tipos de eventos. Queremos apenas as mensagens.
    if (body.type !== "message_received" && !Array.isArray(body.entry)) {
      console.log(`[meta-webhook] Ignorando evento tipo: ${body.type}`);
      return new Response(JSON.stringify({ ok: true, ignored: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // 2. Normalizar payload para extrair De (phone) e O que (content)
    let fromPhone = "";
    let content = "";
    let profileName = "Cliente";
    let messageType = "text";

    if (Array.isArray(body.entry)) {
      // Formato nativo Meta
      const entry = body.entry[0]?.changes?.[0]?.value;
      const msg = entry?.messages?.[0];
      fromPhone = msg?.from || "";
      profileName = entry?.contacts?.[0]?.profile?.name || "Cliente";
      messageType = msg?.type || "text";
      
      if (msg?.type === "text") content = msg.text?.body || "";
      else if (msg?.type === "interactive") {
        content = msg.interactive?.button_reply?.id || msg.interactive?.list_reply?.id || msg.interactive?.button_reply?.title || "";
      } else if (msg?.type === "button") {
        content = msg.button?.payload || msg.button?.text || "";
      }
    } else {
      // Formato ZapResponder (message_received)
      const rawMsg = body.raw_message ?? {};
      fromPhone = String(body.phone || body.wa_id || body.chatId || rawMsg.from || "").replace(/\D/g, "");
      content = (body.mensagem || body.text || rawMsg.content || body.message?.mensagem || "").toString().trim();
      profileName = body.pushName || rawMsg.pushName || body.nome || "Cliente";
    }

    console.log(`[meta-webhook][ROUTER] FROM: ${fromPhone} | MSG: "${content}"`);

    if (!fromPhone) {
      console.error("[meta-webhook] Telefone não identificado no payload.");
      return new Response("No phone", { status: 200 });
    }

    // 3. ROTEAMENTO DE ALTA PRIORIDADE: BOLETOS
    const isBoletoAction = content.toLowerCase().includes("boleto") || 
                           content === "whazing_sub_boleto" || 
                           content === "boleto_a_vencer" || 
                           content === "boleto_vencido" ||
                           content === "Sou Empresa";

    if (isBoletoAction) {
      console.log(`[STEP] before boleto routing: ${fromPhone}`);
      try {
        const flowRes = await fetch(`${SUPABASE_URL}/functions/v1/boleto-whatsapp-flow`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SERVICE_ROLE}`
          },
          body: JSON.stringify({
            clinic_id: SINDICATO_CLINIC_ID,
            phone: fromPhone,
            message: content,
            action: (content === "whazing_sub_boleto" || content === "Sou Empresa") ? "start" : undefined,
            explicit_phone_id: "1110151302179856"
          })
        });

        const resData = await flowRes.json();
        console.log(`[meta-webhook][DEBUG_BOLETO] Resposta do fluxo:`, JSON.stringify(resData));
        
        if (resData.response) {
          const TOKEN = Deno.env.get('META_WHATSAPP_TOKEN');
          const PHONE_ID = "1110151302179856";
          const to = fromPhone.startsWith('55') ? fromPhone : `55${fromPhone}`;
          let payload: any;

          if (resData.buttons && resData.buttons.length > 0) {
            payload = {
              messaging_product: "whatsapp",
              recipient_type: "individual",
              to,
              type: "interactive",
              interactive: {
                type: "button",
                header: { type: "text", text: "Boleto Sindicato" },
                body: { text: resData.response },
                action: {
                  buttons: resData.buttons.slice(0, 3).map((b: any) => ({
                    type: "reply",
                    reply: { id: b.id, title: (b.text || b.title || "").substring(0, 20) }
                  }))
                }
              }
            };
          } else {
            payload = {
              messaging_product: 'whatsapp',
              to,
              type: 'text',
              text: { body: resData.response },
            };
          }

          await fetch(`https://graph.facebook.com/v21.0/${PHONE_ID}/messages`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
        }
        
        console.log('[STEP] before return (boleto success)');
        return new Response(JSON.stringify({ ok: true, flow: "boleto" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (err) {
        console.error("[meta-webhook][DEBUG_BOLETO] Erro ao chamar fluxo:", err);
      }
    }

    // 4. ROTEAMENTO DE PRIORIDADE: MENU PRINCIPAL (SAUDAÇÃO)
    const isGreeting = /^(oi|olá|ola|bom dia|boa tarde|boa noite|menu|inicio|início|voltar|começar|comecar|hello|hi|atendente)$/i.test(content);
    if (isGreeting) {
      console.log(`[STEP] before main menu routing: ${fromPhone}`);
      // O Menu Principal é enviado pela IA ou pelo ZapResponder, mas vamos garantir que ele envie OS BOTÕES do Sindicato.
      // Chamamos o zapresponder-webhook mas controlamos o retorno.
    }

    // 5. ENCAMINHAMENTO PADRÃO (DASHBOARD + ZAPRESPONDER)
    // Aqui o meta-webhook age apenas como pass-through para o sistema que lida com o "atendimento humano" e fallback genérico.
    // MAS, vamos logar quem está disparando o protocolo.
    console.log(`[STEP] before zapresponder legacy routing`);

    fetch(`${SUPABASE_URL}/functions/v1/zapresponder-webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_ROLE}`
      },
      body: JSON.stringify({ ...body, phone: fromPhone, content: content })
    }).catch(err => console.error("[meta-webhook] Erro ao chamar Zap Responder:", err));

    console.log('[STEP] before return (default)');
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
