import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const payload = await req.json();
    console.log("Zap Responder Webhook received:", JSON.stringify(payload));

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const entries = payload.entry ?? [];
    for (const entry of entries) {
      const changes = entry.changes ?? [];
      for (const change of changes) {
        if (change.field !== "messages") continue;
        const value = change.value ?? {};
        const messages = value.messages ?? [];
        
        for (const msg of messages) {
          const fromPhone = msg.from;
          const content = msg.text?.body?.trim().toLowerCase();

          if (content === "menu" || content === "olá" || content === "oi") {
            console.log(`[zapresponder] Sending protocol template to ${fromPhone}`);
            
            // Dispara o template de protocolo como saudação oficial
            await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/meta-send-template`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`
              },
              body: JSON.stringify({
                to: fromPhone,
                template_name: "homologacao_protocolo",
                variables: [
                  "Atendimento Digital",
                  "Cliente",
                  "Sindicato",
                  new Date().toLocaleDateString('pt-BR'),
                  `META-${Date.now().toString().slice(-6)}`
                ]
              })
            }).catch(err => console.error("[zapresponder] Error sending template:", err));
          }
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(error.message, { status: 500 });
  }
});
