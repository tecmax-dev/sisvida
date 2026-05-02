 import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
 import { createClient } from "npm:@supabase/supabase-js@2";
 
 const SINDICATO_CLINIC_ID = "89e7585e-7bce-4e58-91fa-c37080d1170d";
 
 serve(async (req) => {
   try {
     const payload = await req.json();
     console.log("[zapresponder] Webhook received");
 
     const supabase = createClient(
       Deno.env.get("SUPABASE_URL")!,
       Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
     );
 
     const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
     const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
 
     const entries = payload.entry ?? [];
     for (const entry of entries) {
       const changes = entry.changes ?? [];
       for (const change of changes) {
         if (change.field !== "messages") continue;
         const value = change.value ?? {};
              const metadata = value.metadata ?? {};
         const messages = value.messages ?? [];
         const profileName = value?.contacts?.[0]?.profile?.name || "Cliente";
 
         for (const msg of messages) {
            const fromPhone = String(msg.from);
            
            // Extrai conteúdo de diferentes tipos de mensagens Meta
            let content = "";
            if (msg.type === "text") {
              content = msg.text?.body?.trim() || "";
            } else if (msg.type === "interactive") {
              content = msg.interactive?.button_reply?.id || 
                        msg.interactive?.button_reply?.title || 
                        msg.interactive?.list_reply?.id || 
                        "";
            } else if (msg.type === "button") {
              content = msg.button?.payload || msg.button?.text || "";
            }
 
           console.log(`[zapresponder] De ${fromPhone}: "${content}"`);
 
           if (!content) continue;
 
           // Verifica se já enviamos protocolo recentemente para evitar spam
           // Considera "nova conversa" se o último protocolo foi há mais de 4h
           const cutoff = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
 
           const { data: recentProtocol } = await supabase
             .from("whatsapp_ticket_messages")
             .select("id, created_at, metadata")
             .gte("created_at", cutoff)
             .eq("sender_type", "operator")
             .eq("message_type", "template")
             .ilike("content", "%homologacao_protocolo%")
             .order("created_at", { ascending: false })
             .limit(20);
 
           // Procura por protocolo enviado para este telefone
           const alreadySent = recentProtocol?.some((m: any) => {
             const phoneInMeta = m.metadata?.to || "";
             return String(phoneInMeta).replace(/\D/g, "").endsWith(fromPhone.replace(/\D/g, "").slice(-9));
           });
 
           const isGreeting = /^(oi|olá|ola|bom dia|boa tarde|boa noite|menu|inicio|início|voltar|começar|comecar|hello|hi)$/i.test(content);
 
            // Envia o protocolo APENAS se for saudação E não tivermos enviado nas últimas 4h
            if (isGreeting && !alreadySent) {
              console.log(`[zapresponder] Nova conversa - enviando protocolo`);
              const protocolId = `META-${Date.now().toString().slice(-6)}`;
              const employeeName = "Assistente Digital"; // Nome fixo do atendente virtual
              
              const response = await fetch(`${SUPABASE_URL}/functions/v1/meta-send-template`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${SERVICE_ROLE}`
                },
                body: JSON.stringify({
                  to: fromPhone,
                  template_name: "homologacao_protocolo",
                  variables: [
                    "Atendimento Digital",
                    employeeName, // Agora fixo como Assistente Digital
                    "Sindicato dos Comerciários",
                    new Date().toLocaleDateString('pt-BR'),
                    protocolId
                  ]
                })
              }).catch(err => console.error("[zapresponder] Erro template:", err));

              // Registra o envio no banco para auditoria e controle de duplicidade
              if (response && response.ok) {
                try {
                  // Tenta encontrar um contato para este telefone
                  const { data: contact } = await supabase
                    .from('whatsapp_contacts')
                    .select('id')
                    .eq('phone', fromPhone)
                    .maybeSingle();

                  if (contact) {
                    // Procura ou cria ticket
                    let { data: ticket } = await supabase
                      .from('whatsapp_tickets')
                      .select('id')
                      .eq('contact_id', contact.id)
                      .eq('status', 'open')
                      .maybeSingle();

                    if (!ticket) {
                      const { data: newTicket } = await supabase
                        .from('whatsapp_tickets')
                        .insert({
                          contact_id: contact.id,
                          clinic_id: SINDICATO_CLINIC_ID,
                          status: 'open',
                          protocol: protocolId
                        })
                        .select()
                        .single();
                      ticket = newTicket;
                    }

                    if (ticket) {
                      await supabase.from('whatsapp_ticket_messages').insert({
                        ticket_id: ticket.id,
                        sender_type: 'operator',
                        message_type: 'template',
                        content: `Template: homologacao_protocolo | Protocolo: ${protocolId}`,
                        metadata: { to: fromPhone, template: 'homologacao_protocolo' }
                      });
                    }
                  }
                } catch (dbErr) {
                  console.error("[zapresponder] Erro ao registrar log:", dbErr);
                }
              }
            } else if (alreadySent) {
              console.log(`[zapresponder] Protocolo já enviado nas últimas 4h - pulando`);
            }
 
           // SEMPRE encaminha para o bot principal processar a lógica de menu/atendimento
           const messageToBot = isGreeting ? "menu" : content;
           console.log(`[zapresponder] Encaminhando para bot principal como: "${messageToBot}"`);
 
           const botPayload = {
             event: "messages.upsert",
             instance: "meta",
             clinic_id: SINDICATO_CLINIC_ID,
                metadata: metadata, // Passa metadados (incluindo phone_number_id)
             data: {
               key: {
                 remoteJid: `${fromPhone}@s.whatsapp.net`,
                 fromMe: false,
                 id: msg.id
               },
               message: { conversation: messageToBot },
               pushName: profileName,
               messageTimestamp: msg.timestamp
             }
           };
 
           await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-webhook`, {
             method: 'POST',
             headers: {
               'Content-Type': 'application/json',
               'Authorization': `Bearer ${SERVICE_ROLE}`
             },
             body: JSON.stringify(botPayload)
           }).catch(err => console.error("[zapresponder] Erro bot:", err));
         }
       }
     }
 
     return new Response(JSON.stringify({ received: true }), {
       headers: { "Content-Type": "application/json" },
       status: 200,
     });
   } catch (error) {
     console.error("[zapresponder] Webhook error:", error);
     return new Response(JSON.stringify({ error: String(error) }), { status: 500 });
   }
 });