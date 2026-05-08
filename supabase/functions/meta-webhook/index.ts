import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SINDICATO_CLINIC_ID = "89e7585e-7bce-4e58-91fa-c37080d1170d";

   const BUILD_VERSION = 'FLOW_V2_BUILD_20260508_v4';
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

    // 1. EXTRAÇÃO BRUTAL (Whazing, Meta, ZapResponder)
    fromPhone = (
      body.wa_id || 
      body.phone || 
      body.chatId || 
      body.raw_message?.from || 
      body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from || 
      ""
    ).toString().replace(/\D/g, "");

    const rawButtonId = (
      body.message?.selectedButtonId ||
      body.message?.buttonId ||
      body.raw_message?.buttonId ||
      body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.interactive?.button_reply?.id ||
      body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.button?.payload ||
      null
    );

    const rawButtonTitle = (
      body.message?.buttonText ||
      body.raw_message?.buttonText ||
      body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.interactive?.button_reply?.title ||
      body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.button?.text ||
      null
    );

    const rawText = (
      body.message?.conversation ||
      body.message?.text ||
      body.raw_message?.content ||
      body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.text?.body ||
      body.mensagem ||
      ""
    );

    content = (rawButtonId || rawButtonTitle || rawText || "").toString().trim();    
    console.log("[BUTTON_ID_REAL]", rawButtonId || 'null');
    console.log("[BUTTON_TITLE_REAL]", rawButtonTitle || 'null');
    console.log("[PARSER_DEBUG]", { fromPhone, content, isButton: !!(rawButtonId || rawButtonTitle) });

    if (!fromPhone) {
      console.log('[ENTRYPOINT] No phone found in payload');
      return new Response("No phone", { status: 200 });
    }

    // Roteamento expandido para cobrir todos os IDs da State Machine

      const boletoKeywords = ["boleto", "whazing_sub_boleto", "sou empresa", "empresa", "oi", "menu", "olá", "ola", "vencer", "vencido"];
      const isBoletoAction = (content && content.length > 0) && (
        boletoKeywords.some(k => content.toLowerCase().includes(k)) || 
        (rawButtonId && rawButtonId.startsWith('boleto_')) ||
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
          const PHONE_ID = Deno.env.get("META_PHONE_NUMBER_ID") || "1110151302179856";
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

    if (session) {
      console.log(`[FLOW_SINGLE_POINT] Session active (${session.state}).`);
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
        const PHONE_ID = Deno.env.get("META_PHONE_NUMBER_ID") || "1110151302179856";
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

    // 4. FALLBACK PARA QUALQUER BOTÃO (Prevenir silêncio)
    if (rawButtonId || rawButtonTitle) {
      console.log('[FALLBACK_BUTTON_REPLY] Sending forensic fallback for unknown button');
      const TOKEN = Deno.env.get('META_WHATSAPP_TOKEN');
      const PHONE_ID = Deno.env.get("META_PHONE_NUMBER_ID") || "1110151302179856";
      const to = fromPhone.startsWith('55') ? fromPhone : `55${fromPhone}`;
      
      const fallbackText = `[FORENSIC_FALLBACK]\nButtonId: ${rawButtonId}\nTitle: ${rawButtonTitle}\nPhone: ${fromPhone}\nNo matching route found.`;
      
      try {
        await fetch(`https://graph.facebook.com/v21.0/${PHONE_ID}/messages`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to,
            type: 'text',
            text: { body: fallbackText },
          }),
        });
      } catch (err) {
        console.error('[FALLBACK_SEND_ERROR]', err);
      }
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
