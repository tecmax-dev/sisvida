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

  try {
    console.log('[ENTRY] meta-webhook');
    let body = await req.json();
    console.log("[meta-webhook] Body recebido:", JSON.stringify(body));

    if (body.type !== "message_received" && !Array.isArray(body.entry)) {
      return new Response(JSON.stringify({ ok: true, ignored: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    let fromPhone = "";
    let content = "";
    let profileName = "Cliente";

    if (Array.isArray(body.entry)) {
      const entry = body.entry[0]?.changes?.[0]?.value;
      const msg = entry?.messages?.[0];
      fromPhone = msg?.from || "";
      profileName = entry?.contacts?.[0]?.profile?.name || "Cliente";
      
      if (msg?.type === "text") content = msg.text?.body || "";
      else if (msg?.type === "interactive") {
        content = msg.interactive?.button_reply?.id || msg.interactive?.list_reply?.id || msg.interactive?.button_reply?.title || "";
      } else if (msg?.type === "button") {
        content = msg.button?.payload || msg.button?.text || "";
      }
    } else {
      const rawMsg = body.raw_message ?? {};
      fromPhone = String(body.phone || body.wa_id || body.chatId || rawMsg.from || "").replace(/\D/g, "");
      content = (body.mensagem || body.text || rawMsg.content || body.message?.mensagem || "").toString().trim();
      profileName = body.pushName || rawMsg.pushName || body.nome || "Cliente";
    }

    if (!fromPhone) return new Response("No phone", { status: 200 });

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
        return new Response(JSON.stringify({ ok: true, flow: "boleto" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (err) {
        console.error("[meta-webhook] Error in boleto flow:", err);
      }
    }

    console.log(`[STEP] before zapresponder legacy routing`);
    fetch(`${SUPABASE_URL}/functions/v1/zapresponder-webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_ROLE}`
      },
      body: JSON.stringify({ ...body, phone: fromPhone, content: content })
    }).catch(err => console.error("[meta-webhook] Erro ao chamar Zap Responder:", err));

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
