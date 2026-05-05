import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

serve(async (req) => {
  const TOKEN = Deno.env.get("META_WHATSAPP_TOKEN");
  const SYSTEM_TOKEN = Deno.env.get("META_SYSTEM_USER_TOKEN");
  const PHONE_ID = Deno.env.get("META_PHONE_NUMBER_ID");
  const WABA_ID = Deno.env.get("META_WABA_ID");

  try {
    const res: any = {
      current_phone_id: PHONE_ID,
      current_waba_id: WABA_ID,
    };

    if (WABA_ID) {
      const phonesRes = await fetch(`https://graph.facebook.com/v21.0/${WABA_ID}/phone_numbers`, {
        headers: { Authorization: `Bearer ${TOKEN}` }
      });
      res.phones = await phonesRes.json();

      const wabaRes = await fetch(`https://graph.facebook.com/v21.0/${WABA_ID}?fields=id,name,message_template_namespace`, {
        headers: { Authorization: `Bearer ${TOKEN}` }
      });
      res.waba = await wabaRes.json();
    }

    if (SYSTEM_TOKEN) {
      const wabaBizRes = await fetch(`https://graph.facebook.com/v21.0/me?fields=id,name`, {
        headers: { Authorization: `Bearer ${SYSTEM_TOKEN}` }
      });
      res.system_user = await wabaBizRes.json();
      
      // Try to list WABAs for system user
      const bizRes = await fetch(`https://graph.facebook.com/v21.0/me/whatsapp_business_accounts`, {
        headers: { Authorization: `Bearer ${SYSTEM_TOKEN}` }
      });
      res.system_user_wabas = await bizRes.json();
    }

    return new Response(JSON.stringify(res), { headers: { "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
});
