 import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
 import { createClient } from "npm:@supabase/supabase-js@2";
 
 const SINDICATO_CLINIC_ID = "89e7585e-7bce-4e58-91fa-c37080d1170d";
 
 const BUILD_VERSION = 'FLOW_V2_BUILD_20260508';
 const HANDLER_NAME = 'zapresponder-webhook';
 
 serve(async (_req) => {
    console.log(`[ENTRYPOINT][${HANDLER_NAME}] DISABLED TO PREVENT CONCURRENCY`, BUILD_VERSION);
    return new Response(JSON.stringify({ ok: true, status: "legacy_disabled" }), { status: 200 });
    /*
    // Original code disabled:
   try {
    // ===== Parse seguro do JSON =====
    // ZapResponder pode não enviar Content-Type, então aceitamos o corpo se for JSON válido.
    const contentType = req.headers.get("content-type") || "";
    let payload: any;
    const rawBody = await req.text();
    if (!rawBody || rawBody.trim() === "") {
      return new Response(JSON.stringify({
        error: "EMPTY_BODY",
        message: "O corpo da requisição está vazio. Envie um JSON com a estrutura { entry: [...] }.",
        example: { entry: [{ changes: [{ field: "messages", value: { messages: [{ from: "5573...", type: "text", text: { body: "Oi" } }] } }] }] }
      }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    try {
      payload = JSON.parse(rawBody);
      console.log("[zapresponder] Body recebido:", JSON.stringify(payload));
    } catch (parseErr) {
      return new Response(JSON.stringify({
        error: "INVALID_JSON",
        message: "O corpo da requisição não é um JSON válido. Verifique vírgulas, aspas e chaves.",
        content_type_received: contentType || "(vazio)",
        details: String(parseErr),
        received_preview: rawBody.slice(0, 200)
      }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    if (contentType && !contentType.includes("application/json")) {
      console.warn(`[zapresponder] Content-Type não padrão recebido: ${contentType}. Continuando porque o corpo é JSON válido.`);
    }

    // ===== Validação estrutural =====
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return new Response(JSON.stringify({
        error: "INVALID_PAYLOAD_TYPE",
        message: "O corpo deve ser um objeto JSON (não um array nem um valor primitivo)."
      }), { status: 422, headers: { "Content-Type": "application/json" } });
    }

    // Normalização agressiva para qualquer formato do ZapResponder (inclusive on-message)
    if (!Array.isArray(payload.entry)) {
      const rawMsg = payload.raw_message ?? {};
      const phoneValue = payload.phone || payload.wa_id || payload.chatId || rawMsg.from || (payload.data?.key?.remoteJid) || "";
      const fromPhone = String(phoneValue).replace(/@.*/, "").replace(/\D/g, "");
      
      const textBody = (
        payload.mensagem || 
        payload.message?.mensagem ||
        payload.message?.text ||
        payload.message?.content ||
        rawMsg.content ||
        payload.text || 
        payload.raw_message?.body ||
        payload.data?.message?.conversation ||
        ""
      ).toString().trim();

      const pushName = payload.pushName || rawMsg.pushName || payload.data?.pushName || payload.nome || "Cliente";

      if (fromPhone) {
        payload.entry = [{
          changes: [{
            field: "messages",
            value: {
              metadata: payload.metadata || { display_phone_number: rawMsg.device || "557332311784" },
              contacts: [{ profile: { name: pushName } }],
              messages: [{
                from: fromPhone,
                id: rawMsg.id || payload.id || `zap-${Date.now()}`,
                timestamp: String(rawMsg.timestamp || payload.timestamp || Math.floor(Date.now() / 1000)),
                type: "text",
                text: { body: textBody }
              }]
            }
          }]
        }];
        console.log(`[zapresponder] Rota customizada detectada. Normalizando De ${fromPhone}: "${textBody}"`);
      }
    }

    if (!Array.isArray(payload.entry)) {
      return new Response(JSON.stringify({
        error: "MISSING_FIELD_ENTRY",
        message: "Campo obrigatório 'entry' ausente ou inválido. Deve ser um array no formato Meta WhatsApp Cloud API.",
        hint: "Exemplo: { \"entry\": [{ \"changes\": [{ \"field\": \"messages\", \"value\": { \"messages\": [...] } }] }] }",
        received_keys: Object.keys(payload)
      }), { status: 422, headers: { "Content-Type": "application/json" } });
    }

    // Valida que pelo menos uma entry tem changes/messages com formato esperado
    const entryProblems: string[] = [];
    payload.entry.forEach((entry: any, i: number) => {
      if (!entry || typeof entry !== "object") {
        entryProblems.push(`entry[${i}] não é um objeto`);
        return;
      }
      if (!Array.isArray(entry.changes)) {
        entryProblems.push(`entry[${i}].changes ausente ou não é array`);
        return;
      }
      entry.changes.forEach((c: any, j: number) => {
        if (!c || typeof c !== "object") {
          entryProblems.push(`entry[${i}].changes[${j}] não é objeto`);
        } else if (c.field !== "messages") {
          // só warning — apenas ignoramos
        } else if (!c.value || typeof c.value !== "object") {
          entryProblems.push(`entry[${i}].changes[${j}].value ausente`);
        }
      });
    });
    if (entryProblems.length === payload.entry.length && payload.entry.length > 0) {
      return new Response(JSON.stringify({
        error: "INVALID_ENTRY_STRUCTURE",
        message: "Nenhuma 'entry' válida encontrada. Verifique a estrutura.",
        problems: entryProblems
      }), { status: 422, headers: { "Content-Type": "application/json" } });
    }

     const ticketIdFromMeta = payload.ticket_id;
     console.log(`[zapresponder] Webhook received. Ticket ID: ${ticketIdFromMeta}`);
 
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
             let buttonPayload = "";
             if (msg.type === "text") {
               content = msg.text?.body?.trim() || "";
            } else if (msg.type === "interactive") {
              const interactive = msg.interactive || {};
              // Prefer ID for bot logic, Title as fallback
              content = interactive.button_reply?.id || 
                        interactive.button_reply?.title || 
                        interactive.list_reply?.id || 
                        interactive.list_reply?.title ||
                        "";
              buttonPayload = (interactive.button_reply?.title || interactive.button_reply?.id || "").toString();
            } else if (msg.type === "button") {
               content = msg.button?.payload || msg.button?.text || "";
                buttonPayload = (msg.button?.text || msg.button?.payload || "").toString();
             }
 
            console.log(`[zapresponder] De ${fromPhone}: "${content}"`);

            if (!content) continue;

            // ===== Registro da mensagem recebida para auditoria =====
            let ticketId = ticketIdFromMeta;
            try {
              let { data: contact } = await supabase
                .from('whatsapp_contacts')
                .select('id')
                .eq('phone', fromPhone)
                .maybeSingle();

              if (!contact && (payload.is_test || payload.test)) {
                const { data: newContact } = await supabase
                  .from('whatsapp_contacts')
                  .insert({ phone: fromPhone, name: pushName, clinic_id: SINDICATO_CLINIC_ID })
                  .select('id')
                  .single();
                contact = newContact;
              }

              if (contact) {
                let { data: ticket } = await supabase
                  .from('whatsapp_tickets')
                  .select('id, protocol')
                  .eq('contact_id', contact.id)
                  .eq('status', 'open')
                  .maybeSingle();

                if (!ticket) {
                  const newProtocol = payload.protocol || `META-${Date.now().toString().slice(-6)}`;
                  const { data: newTicket } = await supabase
                    .from('whatsapp_tickets')
                    .insert({
                      contact_id: contact.id,
                      clinic_id: SINDICATO_CLINIC_ID,
                      status: 'open',
                      protocol: newProtocol
                    })
                    .select()
                    .single();
                  ticket = newTicket;
                }

                if (ticket) {
                  ticketId = ticket.id;
                  await supabase.from('whatsapp_ticket_messages').insert({
                    ticket_id: ticket.id,
                    sender_type: 'user',
                    message_type: 'text',
                    content: content,
                    metadata: { from: fromPhone, msg_id: msg.id, type: msg.type }
                  });
                }
              }
            } catch (regErr) {
              console.error("[zapresponder] Erro ao registrar mensagem recebida:", regErr);
            }

            // ===== Tratamento de botões do template lembrete_consulta_v2 (Confirmar / Cancelar) =====
            const normalized = (buttonPayload || content).toString().trim().toLowerCase();
            if (normalized === "confirmar" || normalized === "cancelar") {
              console.log(`[zapresponder] Botão de lembrete detectado: ${normalized}`);
              try {
                 const phoneDigits = fromPhone.replace(/\D/g, ""); // 557388633535
                 const phoneNoBR = phoneDigits.startsWith("55") ? phoneDigits.slice(2) : phoneDigits; // 7388633535
                 
                 // Lógica para lidar com o nono dígito no Brasil (7388633535 vs 73988633535)
                 const phoneWith9 = (phoneNoBR.length === 10) ? (phoneNoBR.slice(0, 2) + "9" + phoneNoBR.slice(2)) : null;
                 const phoneWithout9 = (phoneNoBR.length === 11 && phoneNoBR[2] === "9") ? (phoneNoBR.slice(0, 2) + phoneNoBR.slice(3)) : null;
                 
                 const possiblePhones = [phoneNoBR, phoneDigits, phoneWith9, phoneWithout9].filter(Boolean);
                 const phoneOrClause = possiblePhones.map(p => `phone.eq.${p}`).join(",");
                 
                 const todayIso = new Date().toISOString().slice(0, 10);
 
                 // Busca appointment futuro do paciente
                 const { data: patients } = await supabase
                   .from("patients")
                   .select("id")
                   .eq("clinic_id", SINDICATO_CLINIC_ID)
                   .or(phoneOrClause);
                const patientIds = (patients || []).map((p: any) => p.id);

                let aptToUpdate: any = null;
                if (patientIds.length > 0) {
                  const { data: apts } = await supabase
                    .from("appointments")
                    .select("id, appointment_date, start_time, status, patient_id, dependent_id")
                    .in("patient_id", patientIds)
                    .gte("appointment_date", todayIso)
                    .not("status", "in", "(cancelled,completed,no_show)")
                    .order("appointment_date", { ascending: true })
                    .order("start_time", { ascending: true })
                    .limit(1);
                  aptToUpdate = apts?.[0] || null;
                }

                if (aptToUpdate) {
                  if (normalized === "confirmar") {
                    await supabase
                      .from("appointments")
                      .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
                      .eq("id", aptToUpdate.id);
                  } else {
                    await supabase
                      .from("appointments")
                      .update({
                        status: "cancelled",
                        cancelled_at: new Date().toISOString(),
                        cancellation_reason: "Cancelado pelo paciente via WhatsApp (botão)"
                      })
                      .eq("id", aptToUpdate.id);
                  }
                  console.log(`[zapresponder] Appointment ${aptToUpdate.id} → ${normalized}`);

                  // Envia confirmação textual ao paciente
                   const replyText = normalized === "confirmar"
                     ? "✅ Sua consulta foi confirmada com sucesso! Obrigado."
                     : "❌ Sua consulta foi cancelada. Caso queira, agende novamente pelo nosso aplicativo.";
                   
                    // Chamada direta para meta-send-text passando o ticket_id
                    console.log(`[zapresponder] Enviando resposta textual para ${fromPhone}`);
                    const incomingId = metadata?.phone_number_id;
                    const workingId = (incomingId === "937233212814035" || incomingId === "1522701919380063" || !incomingId) 
                      ? "1110151302179856" 
                      : incomingId;

                    const replyRes = await fetch(`${SUPABASE_URL}/functions/v1/meta-send-text`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SERVICE_ROLE}` },
                      body: JSON.stringify({ 
                        to: fromPhone, 
                        text: replyText, 
                        ticket_id: ticketId || ticketIdFromMeta,
                        phone_number_id: workingId
                      })
                    });
                   
                   if (!replyRes.ok) {
                     const errData = await replyRes.json().catch(() => ({}));
                     console.error("[zapresponder] Erro ao enviar resposta textual:", errData);
                   } else {
                     console.log("[zapresponder] Resposta textual enviada com sucesso");
                   }
                } else {
                  console.warn(`[zapresponder] Nenhum appointment futuro encontrado para ${fromPhone}`);
                }
              } catch (err) {
                console.error("[zapresponder] Erro ao processar botão lembrete:", err);
              }
              continue; // não encaminhar para o bot principal
            }
 
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
 
            const isGreeting = /^(oi|olá|ola|bom dia|boa tarde|boa noite|menu|inicio|início|voltar|começar|comecar|hello|hi|atendente)$/i.test(content);
 
             // Envia o protocolo APENAS se for saudação E não tivermos enviado nas últimas 4h
             if (isGreeting && !alreadySent) {
               console.log(`[zapresponder] Nova conversa - enviando boas-vindas`);
                const protocolId = payload.protocol || `META-${Date.now().toString().slice(-6)}`;
               
               // Captura ID do telefone para garantir que responda pelo mesmo canal
               const incomingPhoneId = metadata?.phone_number_id;
                const workingPhoneId = (incomingPhoneId === "937233212814035" || incomingPhoneId === "1522701919380063" || !incomingPhoneId) 
                  ? "1110151302179856" 
                  : incomingPhoneId;
               
                console.log(`[zapresponder] Nova conversa - enviando Menu Principal com Botões`);
                 const welcomeText = `[${BUILD_VERSION}]\nOlá! Seja bem-vindo ao Sindicato dos Comerciários.\n\nSeu protocolo de atendimento é: ${protocolId}\n\nComo podemos ajudar você hoje?`;
                
                const TOKEN = Deno.env.get('META_WHATSAPP_TOKEN');
                const PHONE_ID = workingPhoneId;
                const to = fromPhone.startsWith('55') ? fromPhone : `55${fromPhone}`;

                 console.log('[MENU_SENDER]', { handler: HANDLER_NAME, build: BUILD_VERSION });
                 const menuPayload = {
                   messaging_product: "whatsapp",
                   recipient_type: "individual",
                   to,
                   type: "interactive",
                   interactive: {
                     type: "button",
                     header: { type: "text", text: `[${BUILD_VERSION}] Menu Sindicato` },
                    body: { text: welcomeText },
                    footer: { text: "Selecione uma opção abaixo" },
                    action: {
                      buttons: [
                        { type: "reply", reply: { id: "whazing_sub_boleto", title: "Sou Empresa (Boleto)" } },
                        { type: "reply", reply: { id: "whazing_associado", title: "Sou Associado" } },
                        { type: "reply", reply: { id: "whazing_homologacao", title: "Homologação" } }
                      ]
                    }
                  }
                };

                const response = await fetch(`https://graph.facebook.com/v21.0/${PHONE_ID}/messages`, {
                  method: 'POST',
                  headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
                  body: JSON.stringify(menuPayload),
                });
                
                if (!response.ok) {
                  const errData = await response.json();
                  console.error("[zapresponder] Erro ao enviar Menu Principal:", errData);
                  
                  // Fallback para texto simples se o interativo falhar
                  await fetch(`${SUPABASE_URL}/functions/v1/meta-send-text`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SERVICE_ROLE}` },
                    body: JSON.stringify({ to: fromPhone, phone_number_id: workingPhoneId, text: welcomeText, ticket_id: ticketId || ticketIdFromMeta })
                  });
                }

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