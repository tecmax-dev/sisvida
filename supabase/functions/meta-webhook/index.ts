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

    // --- FORENSIC PARSER START ---
    console.log('[RAW_BUTTON_PAYLOAD_START]');
    console.log(JSON.stringify(body, null, 2));
    console.log('[RAW_BUTTON_PAYLOAD_END]');

    // Exhaustive property search for Meta, Whazing, ZapResponder, and others
    const findDeep = (obj: any, keys: string[]): any => {
      for (const key of keys) {
        if (obj && typeof obj === 'object') {
          if (key in obj) return obj[key];
          for (const k in obj) {
            const found = findDeep(obj[k], [key]);
            if (found !== undefined) return found;
          }
        }
      }
      return undefined;
    };

    // Phone extraction
    fromPhone = String(
      body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from ||
      body.phone || body.wa_id || body.chatId || 
      body.raw_message?.from || 
      body.data?.message?.from || ""
    ).replace(/\D/g, "");

    // Button/Content extraction
    const rawButtonId = 
      body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.interactive?.button_reply?.id ||
      body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.button?.payload ||
      body.message?.interactive?.button_reply?.id ||
      body.message?.interactiveResponseMessage?.id ||
      body.message?.buttonsResponseMessage?.selectedButtonId ||
      body.button?.payload ||
      body.button_id ||
      findDeep(body, ['button_reply', 'selectedButtonId', 'button_id', 'payload']);

    const rawButtonTitle = 
      body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.interactive?.button_reply?.title ||
      body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.button?.text ||
      body.message?.interactive?.button_reply?.title ||
      body.button?.text ||
      findDeep(body, ['button_reply_title', 'button_text', 'display_text']);

    const rawText = 
      body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.text?.body ||
      body.message?.conversation ||
      body.data?.message?.conversation ||
      body.mensagem || body.text || 
      "";

    content = (rawButtonId || rawButtonTitle || rawText || "").toString().trim();
    
    console.log("[BUTTON_ID_REAL]", rawButtonId || 'null');
    console.log("[BUTTON_TITLE_REAL]", rawButtonTitle || 'null');
    console.log("[PARSER_DEBUG]", { fromPhone, content, isButton: !!(rawButtonId || rawButtonTitle) });

    // GLOBAL BRUTAL TEST
    if (rawButtonId || rawButtonTitle) {
      const TOKEN = Deno.env.get('META_WHATSAPP_TOKEN');
      const PHONE_ID = "1110151302179856";
      const to = fromPhone.startsWith('55') ? fromPhone : `55${fromPhone}`;
      
      console.log('[BOTAO_GLOBAL_RECEBIDO_VERBOSE]', JSON.stringify(body, null, 2));
      const forensicResponse = await fetch(`https://graph.facebook.com/v21.0/${PHONE_ID}/messages`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: `[FORENSIC_ECHO]\nbuttonId: ${rawButtonId}\ntitle: ${rawButtonTitle}\ncontent: ${content}\nphone: ${fromPhone}\nraw: ${JSON.stringify(body).substring(0, 100)}` },
        }),
      });
      const forensicResBody = await forensicResponse.text();
      console.log('[FORENSIC_ECHO_STATUS]', forensicResponse.status, forensicResBody);
    }
    // --- FORENSIC PARSER END ---

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
          const finalResponseText = resData.response || '[ERRO] Sem resposta do flow';

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

    // FORENSIC AUDIT: Disabled auto-main-menu loop
    console.log(`[FLOW_SINGLE_POINT_FORENSIC] Ignored unhandled content: "${content}" to prevent loop. No fallback sent.`);

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
