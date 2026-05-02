 import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
 
 serve(async (req) => {
   const TOKEN = Deno.env.get("META_WHATSAPP_TOKEN");
   const PHONE_ID = Deno.env.get("META_PHONE_NUMBER_ID");
   const WABA_ID = Deno.env.get("META_WABA_ID");
 
   try {
     const phonesRes = await fetch(`https://graph.facebook.com/v21.0/${WABA_ID}/phone_numbers`, {
       headers: { Authorization: `Bearer ${TOKEN}` }
     });
     const phonesInfo = await phonesRes.json();
 
     const wabaRes = await fetch(`https://graph.facebook.com/v21.0/${WABA_ID}?fields=id,name,message_template_namespace`, {
       headers: { Authorization: `Bearer ${TOKEN}` }
     });
     const wabaInfo = await wabaRes.json();
 
     return new Response(JSON.stringify({ 
       phones: phonesInfo, 
       waba: wabaInfo,
       current_phone_id: PHONE_ID
     }), { headers: { "Content-Type": "application/json" } });
   } catch (e) {
     return new Response(JSON.stringify({ error: e.message }), { status: 500 });
   }
 });