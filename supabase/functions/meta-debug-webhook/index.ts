 import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
 
 serve(async (req) => {
   const TOKEN = Deno.env.get("META_WHATSAPP_TOKEN")!;
   const WABA_ID = Deno.env.get("META_WABA_ID")!;
   const PHONE_ID = "937233212814035";
 
   try {
     // 1. Verificar inscrição no WABA (subscribed_apps)
     const subRes = await fetch(`https://graph.facebook.com/v21.0/${WABA_ID}/subscribed_apps`, {
       headers: { Authorization: `Bearer ${TOKEN}` }
     });
     const subscribed = await subRes.json();
 
     // 2. Verificar configuração do webhook do número
     const phoneRes = await fetch(`https://graph.facebook.com/v21.0/${PHONE_ID}?fields=webhook_configuration,display_phone_number,verified_name,is_official_business_account`, {
       headers: { Authorization: `Bearer ${TOKEN}` }
     });
     const phoneInfo = await phoneRes.json();
 
     // 3. Tentar inscrever o app no WABA
     const subscribeRes = await fetch(`https://graph.facebook.com/v21.0/${WABA_ID}/subscribed_apps`, {
       method: "POST",
       headers: { Authorization: `Bearer ${TOKEN}` }
     });
     const subscribeResult = await subscribeRes.json();
 
     return new Response(JSON.stringify({
       subscribed_apps_before: subscribed,
       phone_config: phoneInfo,
       subscribe_attempt: subscribeResult,
       expected_webhook: "https://czmnkrurkzuerrcjzbkp.supabase.co/functions/v1/meta-webhook"
     }, null, 2), { headers: { "Content-Type": "application/json" } });
   } catch (e) {
     return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
   }
 });