import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SINDICATO_CLINIC_ID = "89e7585e-7bce-4e58-91fa-c37080d1170d";

  const BUILD_VERSION = 'FLOW_V2_BUILD_20260508_v3';
 console.log('[FLOW VERSION]', BUILD_VERSION);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const CONFIG_TOKEN = (Deno.env.get("META_WEBHOOK_VERIFY_TOKEN") || "").trim();
  const DEFAULT_TOKEN = "prosindweb_meta_2026";

  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    
    if (mode === "subscribe" && (token === CONFIG_TOKEN || token === DEFAULT_TOKEN)) {
      return new Response(challenge ?? "", { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

   const HANDLER_NAME = 'meta-webhook';
  try {
     console.log(`[ENTRYPOINT][${HANDLER_NAME}]`, BUILD_VERSION);
     
     let body: any;
     try {
       body = await req.json();
       console.log('[RAW_CLICK_PAYLOAD]', JSON.stringify(body, null, 2));
     } catch (e) {
       console.error('[BODY_ERROR]', e);
       return new Response("Invalid JSON", { status: 400 });
     }

    if (body.type !== "message_received" && !Array.isArray(body.entry)) {
      return new Response(JSON.stringify({ ok: true, ignored: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    let fromPhone = "";
    let content = "";
    let profileName = "Cliente";

    if (Array.isArray(body.entry) && body.entry.length > 0) {
      const entry = body.entry[0]?.changes?.[0]?.value;
      const msg = entry?.messages?.[0];
      fromPhone = msg?.from || "";
      profileName = entry?.contacts?.[0]?.profile?.name || "Cliente";
      
      if (msg?.type === "text") {
        content = msg.text?.body || "";
      } else if (msg?.type === "interactive") {
        content = msg.interactive?.button_reply?.id || msg.interactive?.list_reply?.id || msg.interactive?.button_reply?.title || "";
      } else if (msg?.type === "button") {
        content = msg.button?.payload || msg.button?.text || "";
      }
    } else {
      const rawMsg = body.raw_message ?? {};
      fromPhone = String(body.phone || body.wa_id || body.chatId || rawMsg.from || "").replace(/\D/g, "");
      content = (body.mensagem || body.text || rawMsg.content || body.message?.mensagem || "").toString().trim();
      profileName = body.pushName || rawMsg.pushName || body.nome || "Cliente";
      
      // Tenta extrair ID de botão de formatos alternativos (Whazing/ZapResponder)
      const interactiveId = rawMsg.interactive?.button_reply?.id || 
                            rawMsg.interactive?.list_reply?.id || 
                            rawMsg.button?.payload ||
                            body.message?.button?.payload ||
                            body.button_id;
      
      const buttonTitle = rawMsg.interactive?.button_reply?.title || 
                          rawMsg.interactive?.list_reply?.title || "";

      if (interactiveId) {
        content = interactiveId;
        console.log("[BUTTON_ID_REAL]", interactiveId);
      } else if (buttonTitle) {
        content = buttonTitle;
        console.log("[BUTTON_TITLE_FALLBACK]", buttonTitle);
      }
      
      console.log("[PARSER_DEBUG]", { 
        type: rawMsg.type, 
        id: interactiveId, 
        title: buttonTitle, 
        finalContent: content 
      });

      // [TESTE_REAL] requested by user
      if (content === 'boleto_a_vencer') {
        console.log('[BUTTON_ROUTE_OK]');
        const TOKEN = Deno.env.get('META_WHATSAPP_TOKEN');
        const PHONE_ID = "1110151302179856";
        const to = fromPhone.startsWith('55') ? fromPhone : `55${fromPhone}`;
        
        await fetch(`https://graph.facebook.com/v21.0/${PHONE_ID}/messages`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to,
            type: 'text',
            text: { body: `[TESTE_REAL] BOTAO RECEBIDO\nbuttonId: ${content}` },
          }),
        });
      }
    }

    if (!fromPhone) {
      console.log('[ENTRYPOINT] No phone found in payload');
      return new Response("No phone", { status: 200 });
    }

    // Roteamento expandido para cobrir todos os IDs da State Machine

      const boletoKeywords = [
        "boleto", "whazing_sub_boleto", "boleto_a_vencer", "boleto_vencido", 
        "sou empresa", "boleto_sim", "boleto_nao", "boleto_type_1", "boleto_type_2",
        "vencer", "vencido", "empresa"
      ];
      
      const isBoletoAction = (content && content.length > 0) && (
                             boletoKeywords.some(k => content.toLowerCase().includes(k)) || 
                             (content.length >= 11 && content.length <= 14 && /^\d+$/.test(content))
                             );
 
     if (isBoletoAction) {
       console.log(`[ROUTER] Routing to boleto-whatsapp-flow for ${fromPhone}`);
       console.log(`[BEFORE_SEND] Content: ${content}`);
       console.log('[MENU_SENDER]', { handler: HANDLER_NAME, build: BUILD_VERSION });
      
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
        
        console.log('[DEBUG_NOVA_STATE_MACHINE][RESPONSE]', JSON.stringify(resData));

      console.log("[ROUTE_MATCH_SUCCESS]", { state: resData.newState });
      if (resData.response || resData.success || resData.newState) {
          const TOKEN = Deno.env.get('META_WHATSAPP_TOKEN');
          const PHONE_ID = "1110151302179856";
          const to = fromPhone.startsWith('55') ? fromPhone : `55${fromPhone}`;
          
          // Signature for debugging
          const finalResponseText = `[${BUILD_VERSION}]\n${resData.response || '[ERRO] Sem resposta do flow'}`;

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
                body: { text: finalResponseText },
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
            text: { body: finalResponseText },
            };
          }

          await fetch(`https://graph.facebook.com/v21.0/${PHONE_ID}/messages`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          console.log('[DEBUG_NOVA_STATE_MACHINE][AFTER_SEND]', 'Message sent successfully to Meta');
        }
        return new Response(JSON.stringify({ ok: true, flow: "boleto" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (err) {
        console.error("[meta-webhook] Error in boleto flow:", err);
      }
    }

    // CRITICAL ARCHITECTURE CHANGE: Disabling legacy routing to avoid concurrency.
    // console.log(`[STEP] before zapresponder legacy routing`);
    // fetch(`${SUPABASE_URL}/functions/v1/zapresponder-webhook`, {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'Authorization': `Bearer ${SERVICE_ROLE}`
    //   },
    //   body: JSON.stringify({ ...body, phone: fromPhone, content: content })
    // }).catch(err => console.error("[meta-webhook] Erro ao chamar Zap Responder:", err));

    console.log(`[FLOW_SINGLE_POINT] Checking session for: "${fromPhone}"`);
    
    // CRITICAL: Check session for ANY input to prevent main menu loop
    const { data: session } = await supabase
      .from('whatsapp_boleto_sessions')
      .select('state')
      .eq('clinic_id', SINDICATO_CLINIC_ID)
      .eq('phone', fromPhone)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    console.log('[SESSION_LOOKUP_ROUTER]', { fromPhone, sessionFound: !!session, currentState: session?.state });

    if (session && !['menu', 'start', 'oi'].includes(content.toLowerCase())) {
      console.log(`[FLOW_SINGLE_POINT] Active session found (${session.state}). Routing to boleto flow for content: "${content}"`);
      // Manually trigger the flow to see if it can handle the input (even if not a keyword)
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
          explicit_phone_id: "1110151302179856"
        })
      });

      const resData = await flowRes.json();
      if (resData.response || resData.success) {
        const TOKEN = Deno.env.get('META_WHATSAPP_TOKEN');
        const PHONE_ID = "1110151302179856";
        const to = fromPhone.startsWith('55') ? fromPhone : `55${fromPhone}`;
        const finalResponseText = `[${BUILD_VERSION}]\n${resData.response}`;
        
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
              body: { text: finalResponseText },
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
            text: { body: finalResponseText },
          };
        }

        await fetch(`https://graph.facebook.com/v21.0/${PHONE_ID}/messages`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        return new Response(JSON.stringify({ ok: true, flow: "boleto_reentry" }));
      }
    }

    // CRITICAL: Check if this was a button click that should have been a boleto action but failed lookup
    const isExplicitButtonClick = body.raw_message?.interactive?.button_reply?.id || body.message?.button?.payload;
    
    if (isExplicitButtonClick) {
      console.log('[DEBUG_SESSION_FAIL] Button click received but no session found and not a boleto keyword');
      // If it's a button click and we reached here, something is wrong with session or routing
      const TOKEN = Deno.env.get('META_WHATSAPP_TOKEN');
      const PHONE_ID = "1110151302179856";
      const to = fromPhone.startsWith('55') ? fromPhone : `55${fromPhone}`;
      
      await fetch(`https://graph.facebook.com/v21.0/${PHONE_ID}/messages`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: `[DEBUG_SESSION_FAIL]\nuserId: ${fromPhone}\nbuttonId: ${content}\nNo session found.` },
        }),
      });
    }

    // Only send main menu if NO session exists and NO keyword matched
    if (!content || content.toLowerCase() === 'oi' || content.toLowerCase() === 'menu' || content.toLowerCase() === 'start') {
      console.log(`[FLOW_SINGLE_POINT] Sending main menu for: "${content}"`);
      const TOKEN = Deno.env.get('META_WHATSAPP_TOKEN');
      const PHONE_ID = "1110151302179856";
      const to = fromPhone.startsWith('55') ? fromPhone : `55${fromPhone}`;
      
      const welcomeText = `[${BUILD_VERSION}]\nOlá! Seja bem-vindo ao Sindicato dos Comerciários.\n\nComo podemos ajudar você hoje?`;
      
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

      await fetch(`https://graph.facebook.com/v21.0/${PHONE_ID}/messages`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(menuPayload),
      });
      console.log('[FLOW_SINGLE_POINT] Main menu sent from meta-webhook');
    } else {
      console.log(`[FLOW_SINGLE_POINT] Ignoring unrecognized message: "${content}" to avoid loops`);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[meta-webhook] Error:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
