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
          const content = msg.text?.body?.trim();
          const profileName = payload.entry?.[0]?.changes?.[0]?.value?.contacts?.[0]?.profile?.name || "Cliente";

          console.log(`[zapresponder] Processando mensagem de ${fromPhone}: ${content}`);
          
          // Qualquer mensagem inicial ou saudação dispara o protocolo oficial
          console.log(`[zapresponder] Enviando template de protocolo para ${fromPhone}`);
          
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
                profileName,
                "Sindicato dos Comerciários",
                new Date().toLocaleDateString('pt-BR'),
                `META-${Date.now().toString().slice(-6)}`
              ]
            })
          }).then(async res => {
            const resJson = await res.json();
            console.log(`[zapresponder] Resultado do envio:`, resJson);
          }).catch(err => console.error("[zapresponder] Erro ao enviar template:", err));
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
