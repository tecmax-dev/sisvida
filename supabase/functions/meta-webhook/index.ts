import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Verification for Meta Webhook setup
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe") {
      return new Response(challenge ?? "", { status: 200 });
    }
    return new Response("OK", { status: 200 });
  }

  try {
    const body = await req.json();
    console.log('[WEBHOOK_ENTRY] Meta Webhook');
    console.log('[RAW_PAYLOAD]', JSON.stringify(body, null, 2));

    // Minimalist Parser
    const entry = body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    
    // Registrar status de entrega da Meta (sent/delivered/read/failed) para evitar falso positivo.
    if (value?.statuses) {
      console.log('[STATUS_UPDATE] Meta status update');
      try {
        const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
        const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

        for (const status of value.statuses || []) {
          const recipient = String(status.recipient_id || '').replace(/\D/g, '');
          const { error: insertStatusError } = await supabase.from('whatsapp_audit_logs').insert({
            phone: recipient || 'unknown',
            direction: 'status',
            content: status.status || null,
            message_type: 'meta_status',
            metadata: {
              provider: 'meta_official',
              status_event: true,
              message_id: status.id || null,
              status: status.status || null,
              recipient_id: status.recipient_id || null,
              timestamp: status.timestamp || null,
              errors: status.errors || null,
              raw_payload: body,
            },
          });

          if (insertStatusError) {
            console.error('[STATUS_LOG_INSERT_ERROR]', insertStatusError);
          }
        }
      } catch (statusLogErr) {
        console.error('[STATUS_LOG_ERROR]', statusLogErr);
      }
      return new Response("ok", { status: 200 });
    }

    const messageObj = value?.messages?.[0] || body.message || {};
    const from = (body.wa_id || body.phone || messageObj.from || "").toString().replace(/\D/g, "");
    
    const extractedButtonId = messageObj.interactive?.button_reply?.id || 
                             messageObj.interactive?.list_reply?.id || 
                             messageObj.button?.payload || 
                             messageObj.buttonId || 
                             null;
                             
    const extractedButtonTitle = messageObj.interactive?.button_reply?.title || 
                                messageObj.interactive?.list_reply?.title || 
                                messageObj.button?.text || 
                                messageObj.buttonText || 
                                null;
    const text = (messageObj.text?.body || messageObj.conversation || "").toString().trim();

    console.log('[BUTTON_ID]', extractedButtonId);
    console.log('[BUTTON_TITLE]', extractedButtonTitle);

    if (!from) {
      return new Response(JSON.stringify({ ok: true, reason: "no phone" }), { status: 200 });
    }

    const META_TOKEN = Deno.env.get('META_WHATSAPP_TOKEN');
    const PHONE_ID = value?.metadata?.phone_number_id || Deno.env.get("META_PHONE_NUMBER_ID");
    const to = from.startsWith('55') ? from : `55${from}`;

    const sendResponse = async (payload: any) => {
      const url = `https://graph.facebook.com/v21.0/${PHONE_ID}/messages`;
      console.log('[SENDING_TO]', url);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${META_TOKEN}`, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          ...payload
        }),
      });
      const result = await res.text();
      console.log('[MESSAGE_SENT]', result);
      return result;
    };

    // Log the incoming message
    try {
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await supabase.from('whatsapp_incoming_logs').insert({
        phone: to,
        message_text: text || `[Button: ${extractedButtonTitle || extractedButtonId}]`,
        raw_payload: body,
        processed: true,
        processed_action: extractedButtonId ? `button_${extractedButtonId}` : 'text_message'
      });
    } catch (logErr) {
      console.error('[LOG_ERROR]', logErr);
    }

    // Helper functions for phone matching
    const normalizeDigits = (v: string) => v.replace(/\D/g, '');
    const getPhoneVariants = (raw: string) => {
      let d = normalizeDigits(raw);
      if (d.startsWith('55') && d.length > 11) d = d.slice(2);
      const v = [d];
      if (d.length === 10) v.push(d.slice(0, 2) + '9' + d.slice(2));
      if (d.length === 11 && d[2] === '9') v.push(d.slice(0, 2) + d.slice(3));
      return v.flatMap(x => [x, '55' + x]);
    };

    // --- APPOINTMENT CONFIRMATION/CANCELLATION ---
    if (extractedButtonId === "Confirmar" || extractedButtonId === "Cancelar") {
      console.log('[APPOINTMENT_ACTION]', extractedButtonId, 'from:', from);
      const isConfirm = extractedButtonId === "Confirmar";
      
      try {
        const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
        const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        
        const variants = getPhoneVariants(from);
        console.log('[PHONE_VARIANTS]', variants);

        // Lookup upcoming appointments
        const today = new Date().toISOString().slice(0, 10);
        const { data: appointments, error: aptError } = await supabase
          .from('appointments')
          .select(`
            id, 
            status, 
            appointment_date,
            patient:patients!inner(name, phone)
          `)
          .in('status', ['scheduled', 'confirmed'])
          .gte('appointment_date', today)
          .order('appointment_date', { ascending: true })
          .order('start_time', { ascending: true })
          .limit(10);

        if (aptError) throw aptError;

        const matchedApt = appointments?.find(a => {
          const pPhone = (a.patient as any)?.phone;
          return pPhone && variants.includes(normalizeDigits(pPhone));
        });

        if (matchedApt) {
          const newStatus = isConfirm ? 'confirmed' : 'cancelled';
          console.log('[MATCHED_APT]', matchedApt.id, '->', newStatus);
          
          const { error: updateError } = await supabase
            .from('appointments')
            .update({ status: newStatus })
            .eq('id', matchedApt.id);
          
          if (updateError) throw updateError;

          const msg = isConfirm 
            ? "Obrigado! Sua consulta foi *confirmada* com sucesso. ✅"
            : "Entendido. Sua consulta foi *cancelada*. Se precisar reagendar, entre em contato. ❌";
          
          await sendResponse({
            type: "text",
            text: { body: msg }
          });
          
          return new Response(JSON.stringify({ ok: true, action: `appointment_${newStatus}` }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        } else {
          console.log('[APT_NOT_FOUND] for variants:', variants);
          await sendResponse({
            type: "text",
            text: { body: "Não encontramos um agendamento pendente para este número. Por favor, fale com um atendente." }
          });
        }
      } catch (err) {
        console.error('[APT_ACTION_ERROR]', err);
      }
    }

    const isGreeting = /\b(oi|ola|olá|bom dia|boa tarde|boa noite|inicio|início|começar|comecar|menu|oi lov|ola lov|olá lov)\b/i.test(text);
    const isBoleto = /\b(boleto|segunda via|pagamento|gerar boleto|2 via|2ª via)\b/i.test(text);
    const isCCT = /\b(cct|convenção|convencao|coletiva|piso|salário|salario|piso salarial)\b/i.test(text);
    const isHomologacao = /\b(homologação|homologacao|agendar|agendamento|rescisão|rescisao)\b/i.test(text);
    const isCarteirinha = /\b(carteirinha|carteira|associado|sócio|socio|atualizar carteira)\b/i.test(text);
    const isThanks = /\b(obrigado|obrigada|grato|grata|valeu|thanks|agradeço|agradecido|agradecida)\b/i.test(text);
    const isNo = /\b(nao|não|no|nada mais|encerrar|finalizar)\b/i.test(text);

    // --- 0. THANKS / END OF SERVICE ---
    if (isThanks && !extractedButtonId) {
      await sendResponse({
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: "De nada! 😊 Ficamos felizes em ajudar.\n\nDeseja algo mais?" },
          action: {
            buttons: [
              { type: "reply", reply: { id: "menu_principal", title: "Sim, Ver Menu" } },
              { type: "reply", reply: { id: "encerrar_atendimento", title: "Não, Obrigado" } }
            ]
          }
        }
      });
      return new Response(JSON.stringify({ ok: true, action: "thanks_ask_more" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (extractedButtonId === "encerrar_atendimento" || (isNo && !extractedButtonId)) {
      await sendResponse({
        type: "text",
        text: { body: "Perfeito! Atendimento encerrado. Se precisar de algo no futuro, é só mandar um 'Oi'. Tenha um ótimo dia! 👋" }
      });
      return new Response(JSON.stringify({ ok: true, action: "terminate" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // --- ROUTING LOGIC ---

    // 1. MAIN MENU
    if (isGreeting || extractedButtonId === "menu_principal") {
      await sendResponse({
        type: "interactive",
        interactive: {
          type: "button",
          header: { type: "text", text: "Sindicato dos Comerciários" },
          body: { text: "Olá! Bem-vindo ao nosso canal oficial. Como podemos ajudar hoje? Escolha uma opção abaixo:" },
          footer: { text: "Atendimento Automático" },
          action: {
            buttons: [
              { type: "reply", reply: { id: "whazing_associado", title: "Sou Associado" } },
              { type: "reply", reply: { id: "whazing_empresa", title: "Sou Empresa" } },
              { type: "reply", reply: { id: "whazing_contabilidade", title: "Contabilidade" } }
            ]
          }
        }
      });
      return new Response(JSON.stringify({ ok: true, action: "main_menu" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2. SUBMENU ASSOCIADO / CARTEIRINHA
    if (extractedButtonId === "whazing_associado" || extractedButtonId === "voltar_associado" || (isCarteirinha && !isGreeting)) {
      await sendResponse({
        type: "interactive",
        interactive: {
          type: "list",
          body: { text: "Você selecionou *Sou Associado*.\n\nEscolha o que deseja:" },
          action: {
            button: "Ver Opções",
            sections: [
              {
                title: "Serviços Associado",
                rows: [
                  { id: "whazing_sub_carteirinha", title: "Atualizar Carteira", description: "Renovação e 2ª via" },
                  { id: "whazing_sub_app", title: "Aplicativo", description: "Baixar app na Play Store" },
                  { id: "whazing_sub_cct", title: "CCT / Pisos", description: "Convenções e salários" },
                  { id: "whazing_sub_outros", title: "Outros Assuntos", description: "Falar com atendente" }
                ]
              },
              {
                title: "Navegação",
                rows: [
                  { id: "menu_principal", title: "Menu Principal", description: "Voltar ao início" }
                ]
              }
            ]
          }
        }
      });
      return new Response(JSON.stringify({ ok: true, action: "submenu_associado" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 3. SUBMENU EMPRESA
    if (extractedButtonId === "whazing_empresa" || extractedButtonId === "voltar_empresa") {
      await sendResponse({
        type: "interactive",
        interactive: {
          type: "list",
          body: { text: "Você selecionou *Sou Empresa*.\n\nComo podemos ajudar?" },
          action: {
            button: "Ver Opções",
            sections: [
              {
                title: "Serviços Empresa",
                rows: [
                  { id: "whazing_sub_boleto", title: "2ª Via Boleto", description: "Emissão de cobranças" },
                  { id: "whazing_sub_cct", title: "CCT / Pisos", description: "Convenções e salários" },
                  { id: "whazing_sub_outros", title: "Outros Assuntos", description: "Suporte especializado" }
                ]
              },
              {
                title: "Navegação",
                rows: [
                  { id: "menu_principal", title: "Menu Principal", description: "Voltar ao início" }
                ]
              }
            ]
          }
        }
      });
      return new Response(JSON.stringify({ ok: true, action: "submenu_empresa" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 4. SUBMENU CONTABILIDADE
    if (extractedButtonId === "whazing_contabilidade") {
      await sendResponse({
        type: "interactive",
        interactive: {
          type: "list",
          body: { text: "Você selecionou *Contabilidade*.\n\nComo podemos ajudar?" },
          action: {
            button: "Ver Opções",
            sections: [
              {
                title: "Serviços Contabilidade",
                rows: [
                  { id: "whazing_sub_homologacao", title: "Homologação", description: "Agendamentos" },
                  { id: "whazing_sub_cct", title: "CCT / Pisos", description: "Convenções e salários" },
                  { id: "whazing_sub_outros", title: "Outros Assuntos", description: "Suporte especializado" }
                ]
              },
              {
                title: "Navegação",
                rows: [
                  { id: "menu_principal", title: "Menu Principal", description: "Voltar ao início" }
                ]
              }
            ]
          }
        }
      });
      return new Response(JSON.stringify({ ok: true, action: "submenu_contabilidade" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 5. CARTEIRINHA / BOLETO / HOMOLOGAÇÃO / CCT (Follow-up or Action)
    const followUpAction = (msg: string) => ({
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: msg + "\n\nPosso ajudar com mais alguma coisa?" },
        action: {
          buttons: [
            { type: "reply", reply: { id: "falar_atendente", title: "Falar c/ Atendente" } },
            { type: "reply", reply: { id: "menu_principal", title: "Menu Principal" } }
          ]
        }
      }
    });

    if (extractedButtonId === "whazing_sub_carteirinha") {
      await sendResponse(followUpAction("Para atualizar sua carteirinha, você pode fazer diretamente pelo nosso aplicativo ou enviar os documentos por aqui."));
      return new Response(JSON.stringify({ ok: true, action: "carteirinha" }));
    }

    if (extractedButtonId === "whazing_sub_app") {
      const playUrl = "https://play.google.com/store/apps/details?id=br.org.secmi.comerciariosilheus.app";
      // 1) Mensagem com CTA URL abrindo direto a Play Store
      await sendResponse({
        type: "interactive",
        interactive: {
          type: "cta_url",
          header: { type: "text", text: "Aplicativo do Sindicato" },
          body: {
            text:
              "📱 Tenha o sindicato na palma da mão!\n\n" +
              "Com o app você acessa:\n" +
              "• Carteirinha digital\n" +
              "• 2ª via de boletos\n" +
              "• Autorizações e benefícios\n" +
              "• Avisos e notificações em tempo real\n\n" +
              "Toque no botão abaixo para instalar gratuitamente na Play Store."
          },
          footer: { text: "Disponível para Android" },
          action: {
            name: "cta_url",
            parameters: { display_text: "Baixar na Play Store", url: playUrl }
          }
        }
      });
      // 2) Follow-up com opções de navegação
      await sendResponse(followUpAction("Após instalar, faça login com seu CPF cadastrado no sindicato."));
      return new Response(JSON.stringify({ ok: true, action: "app_playstore" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (extractedButtonId === "whazing_sub_boleto" || (isBoleto && !isGreeting)) {
      // Delegar para o fluxo de boleto especializado
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        
        const boletoFlowRes = await fetch(`${supabaseUrl}/functions/v1/boleto-whatsapp-flow`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`
          },
          body: JSON.stringify({
            clinic_id: "89e7585e-7bce-4e58-91fa-c37080d1170d", // ID do Sindicato
            phone: from,
            action: 'start'
          })
        });
        
        const boletoData = await boletoFlowRes.json();
        if (boletoData.success) {
          await sendResponse({
            type: "interactive",
            interactive: {
              type: "button",
              body: { text: boletoData.response },
              action: {
                buttons: (boletoData.buttons || []).map((b: any) => ({
                  type: "reply",
                  reply: { id: b.id, title: b.title }
                }))
              }
            }
          });
          return new Response(JSON.stringify({ ok: true, action: "boleto_start" }));
        }
      } catch (err) {
        console.error('[BOLETO_FLOW_ERROR]', err);
      }
      
      await sendResponse(followUpAction("Para emitir a 2ª via do boleto, informe o CNPJ da empresa."));
      return new Response(JSON.stringify({ ok: true, action: "boleto_fallback" }));
    }

    if (extractedButtonId === "whazing_sub_cct" || (isCCT && !isGreeting)) {
      await sendResponse(followUpAction("As Convenções Coletivas e Tabelas de Pisos Salariais estão disponíveis em nosso site ou podem ser solicitadas aqui."));
      return new Response(JSON.stringify({ ok: true, action: "cct" }));
    }

    if (extractedButtonId === "whazing_sub_homologacao" || (isHomologacao && !isGreeting)) {
      await sendResponse(followUpAction("O agendamento de homologação deve ser feito pelo portal da empresa."));
      return new Response(JSON.stringify({ ok: true, action: "homologacao" }));
    }

    if (extractedButtonId === "whazing_sub_outros" || extractedButtonId === "falar_atendente") {
      await sendResponse({
        type: "text",
        text: { body: "Entendido. Vou te encaminhar para um de nossos atendentes. Por favor, aguarde um momento. ⏳" }
      });
      // Here you would typically trigger a handoff to human (Whazing/ZapResponder)
      return new Response(JSON.stringify({ ok: true, action: "handoff" }));
    }

    // 6. PROCESSAR RESPOSTAS DO FLUXO DE BOLETO (CNPJ, etc.)
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    
    const { data: boletoSession } = await supabase
      .from('whatsapp_boleto_sessions')
      .select('*')
      .eq('phone', from)
      .maybeSingle();

    const boletoForwardIds = new Set(['recomecar', 'reuse_cnpj_sim', 'reuse_cnpj_nao']);
    const shouldForwardBoleto = !!boletoSession && (
      boletoSession.state !== 'SUCCESS' ||
      extractedButtonId?.startsWith('boleto_') ||
      (extractedButtonId && boletoForwardIds.has(extractedButtonId))
    );
    if (shouldForwardBoleto) {
      const boletoFlowRes = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/boleto-whatsapp-flow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`
        },
        body: JSON.stringify({
          clinic_id: "89e7585e-7bce-4e58-91fa-c37080d1170d",
          phone: from,
          message: text || extractedButtonId,
          action: extractedButtonId ? 'button' : 'text'
        })
      });

      const boletoData = await boletoFlowRes.json();
      if (boletoData.success) {
        const payload: any = {
          type: boletoData.buttons?.length > 0 ? "interactive" : "text",
        };

        if (payload.type === "interactive") {
          payload.interactive = {
            type: "button",
            body: { text: boletoData.response },
            action: {
              buttons: boletoData.buttons.map((b: any) => ({
                type: "reply",
                reply: { id: b.id, title: b.title }
              }))
            }
          };
        } else {
          payload.text = { body: boletoData.response };
        }

        await sendResponse(payload);
        return new Response(JSON.stringify({ ok: true, action: "boleto_step" }));
      }
    }

    return new Response(JSON.stringify({ ok: true, status: "unhandled" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[ERROR]", e);
    return new Response(JSON.stringify({ ok: false, error: e.message }), { 
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
