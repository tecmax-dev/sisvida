import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

 const HANDLER_VERSION = "1.0.2-COEX-AUDIT";

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
    return new Response(JSON.stringify({ 
      status: "online", 
      version: HANDLER_VERSION,
      timestamp: new Date().toISOString()
    }), { 
      status: 200, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }

   try {
     const body = await req.json();
     console.log('[COEX_ENTRY_CONFIRMED]', HANDLER_VERSION);
     console.log('[RAW_PAYLOAD]', JSON.stringify(body, null, 2));
 
     // COEX/ZapResponder Parser Logic
     const from = (
       body.raw_message?.from || 
       body.chatId || 
       body.wa_id || 
       body.phone || 
       ""
     ).toString().replace(/\D/g, "");
 
     const text = (
       body.message?.mensagem || 
       body.raw_message?.content || 
       body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.text?.body || 
       ""
     ).toString().trim();
 
     const extractedButtonId = body.raw_message?.interactive?.button_reply?.id || body.buttonId || null;
     const extractedButtonTitle = body.raw_message?.interactive?.button_reply?.title || body.buttonText || null;
 
     console.log('[BUTTON_ID]', extractedButtonId);
     console.log('[BUTTON_TITLE]', extractedButtonTitle);

    if (!from) {
      return new Response(JSON.stringify({ ok: true, reason: "no phone" }), { status: 200 });
    }

    const META_TOKEN = Deno.env.get('META_WHATSAPP_TOKEN');
    const PHONE_ID = Deno.env.get("META_PHONE_NUMBER_ID") || "1110151302179856";
    const to = from.startsWith('55') ? from : `55${from}`;

    const sendResponse = async (payload: any) => {
      const res = await fetch(`https://graph.facebook.com/v21.0/${PHONE_ID}/messages`, {
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

    // FASE 1: PROVAR ENTRADA
    if (text.toLowerCase() === "oi") {
      await sendResponse({
        type: 'text',
        text: { body: "MENU TESTE" }
      });
      return new Response(JSON.stringify({ ok: true, phase: 1 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // FASE 2: MENU PRINCIPAL
    if (text.toLowerCase() === "menu") {
      await sendResponse({
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: "Escolha uma opção:" },
          action: {
            buttons: [
              { type: "reply", reply: { id: "main_empresa", title: "Sou Empresa" } },
              { type: "reply", reply: { id: "main_associado", title: "Sou Associado" } },
              { type: "reply", reply: { id: "main_homologacao", title: "Homologacao" } }
            ]
          }
        }
      });
      return new Response(JSON.stringify({ ok: true, phase: 2 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // FASE 3: TESTE DE CLIQUE
    if (extractedButtonId === "main_empresa") {
      await sendResponse({
        type: 'text',
        text: { body: "BOTAO EMPRESA RECEBIDO" }
      });
      return new Response(JSON.stringify({ ok: true, phase: 3 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // FASE 4: TESTE SUBMENU
    if (extractedButtonId === "boleto_2via") {
       await sendResponse({
        type: 'text',
        text: { body: "BOLETO RECEBIDO" }
      });
      return new Response(JSON.stringify({ ok: true, phase: 4 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
