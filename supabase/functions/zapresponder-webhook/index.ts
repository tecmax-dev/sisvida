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
          const content = msg.text?.body?.trim() || "";
          const profileName = payload.entry?.[0]?.changes?.[0]?.value?.contacts?.[0]?.profile?.name || "Cliente";

          console.log(`[zapresponder] Processando mensagem de ${fromPhone}: ${content}`);

          // Bloqueia loop infinito se o bot receber sua própria mensagem ou se for um status update
          if (!content && !msg.type) continue;

          // Lógica: Se for a PRIMEIRA mensagem (saudação), envia o Protocolo e o Menu.
          // Se for uma resposta a uma opção, o whatsapp-webhook processará a lógica de bot.
          
          const isGreeting = /^(oi|olá|ola|bom dia|boa tarde|boa noite|menu|inicio|início|voltar)$/i.test(content);

          if (isGreeting || !content) {
            console.log(`[zapresponder] Saudação detectada. Enviando protocolo e acionando bot principal.`);
            
            // 1. Envia o template de protocolo
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
            }).catch(err => console.error("[zapresponder] Erro ao enviar template:", err));

            // 2. Encaminha para o bot principal (whatsapp-webhook) para mostrar o MENU inicial
            // Criamos um payload compatível com o que o bot principal espera (formato Evolution)
            const botPayload = {
              event: "messages.upsert",
              instance: "meta",
              data: {
                key: {
                  remoteJid: `${fromPhone}@s.whatsapp.net`,
                  fromMe: false,
                  id: msg.id
                },
                message: {
                  conversation: "menu" // Forçamos o comando 'menu' para garantir que o bot inicie o fluxo
                },
                pushName: profileName,
                messageTimestamp: msg.timestamp
              }
            };

            await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/whatsapp-webhook`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`
              },
              body: JSON.stringify(botPayload)
            }).catch(err => console.error("[zapresponder] Erro ao encaminhar para bot principal:", err));

          } else {
            // Se não for saudação, apenas encaminha o que o usuário digitou para o bot processar (ex: CPF ou opção do menu)
            console.log(`[zapresponder] Encaminhando resposta do usuário para o bot principal.`);
            
            const botPayload = {
              event: "messages.upsert",
              instance: "meta",
              data: {
                key: {
                  remoteJid: `${fromPhone}@s.whatsapp.net`,
                  fromMe: false,
                  id: msg.id
                },
                message: {
                  conversation: content
                },
                pushName: profileName,
                messageTimestamp: msg.timestamp
              }
            };

            await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/whatsapp-webhook`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`
              },
              body: JSON.stringify(botPayload)
            }).catch(err => console.error("[zapresponder] Erro ao encaminhar resposta:", err));
          }

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
