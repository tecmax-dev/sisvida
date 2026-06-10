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

    if (PHONE_ID) {
      const phoneRes = await fetch(`https://graph.facebook.com/v21.0/${PHONE_ID}`, {
        headers: { Authorization: `Bearer ${TOKEN}` }
      });
      res.phone_basic = { status: phoneRes.status, body: await phoneRes.json() };

      const phoneFieldsRes = await fetch(`https://graph.facebook.com/v21.0/${PHONE_ID}?fields=display_phone_number,verified_name,quality_rating`, {
        headers: { Authorization: `Bearer ${TOKEN}` }
      });
      res.phone_fields = { status: phoneFieldsRes.status, body: await phoneFieldsRes.json() };
    }

    if (WABA_ID) {
      const wabaRes = await fetch(`https://graph.facebook.com/v21.0/${WABA_ID}?fields=id,name,status,message_template_namespace`, {
        headers: { Authorization: `Bearer ${TOKEN}` }
      });
      res.waba = { status: wabaRes.status, body: await wabaRes.json() };

      const tmplRes = await fetch(`https://graph.facebook.com/v21.0/${WABA_ID}/message_templates?limit=1`, {
        headers: { Authorization: `Bearer ${TOKEN}` }
      });
      res.message_templates_probe = { status: tmplRes.status, body: await tmplRes.json() };
    }

    if (TOKEN) {
      const dbgRes = await fetch(`https://graph.facebook.com/v21.0/debug_token?input_token=${TOKEN}&access_token=${TOKEN}`);
      res.debug_token = { status: dbgRes.status, body: await dbgRes.json() };
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
