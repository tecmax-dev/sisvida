 import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
 
 serve(async (req) => {
   const TOKEN = Deno.env.get("META_WHATSAPP_TOKEN");
   const PHONE_ID = Deno.env.get("META_PHONE_NUMBER_ID");
   const WABA_ID = Deno.env.get("META_WABA_ID");
 
   try {
     const res = await fetch(`https://graph.facebook.com/v21.0/${PHONE_ID}?fields=display_phone_number,verified_name,code_verification_status`, {
       headers: { Authorization: `Bearer ${TOKEN}` }
     });
     const phoneInfo = await res.json();
 
     const wabaRes = await fetch(`https://graph.facebook.com/v21.0/${WABA_ID}`, {
       headers: { Authorization: `Bearer ${TOKEN}` }
     });
     const wabaInfo = await wabaRes.json();
 
     return new Response(JSON.stringify({ 
       phone: phoneInfo, 
       waba: wabaInfo,
       phone_id_set: !!PHONE_ID,
       token_set: !!TOKEN,
       waba_id_set: !!WABA_ID
     }), { headers: { "Content-Type": "application/json" } });
   } catch (e) {
     return new Response(JSON.stringify({ error: e.message }), { status: 500 });
   }
 });