import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: secret } = await admin.rpc("get_meta_vault_secret", { _secret_name: "META_WHATSAPP_TOKEN_V2" });
  const token = secret ? String(secret) : Deno.env.get("META_WHATSAPP_TOKEN_V2");
  const PHONE_ID = "1213495528515111";
  const g = async (path: string) => {
    const r = await fetch(`https://graph.facebook.com/v20.0/${path}`, { headers: { Authorization: `Bearer ${token}` } });
    return { http: r.status, body: await r.json() };
  };
  const phone = await g(`${PHONE_ID}?fields=display_phone_number,verified_name,quality_rating,status,name_status,platform_type,throughput,code_verification_status`);
  const waba = await g(`${PHONE_ID}?fields=whatsapp_business_account{id,name,account_review_status,message_template_namespace}`);
  const tpl = await g(`2063797207822998/message_templates?name=carteirinha_atualizacao_link&fields=name,status,language,category,components,quality_score`);
  const wabaInfo = await g(`2063797207822998?fields=id,name,account_review_status,business_verification_status,on_behalf_of_business_info,timezone_id`);
  return new Response(JSON.stringify({ phone, waba, wabaInfo, tpl }, null, 2), { headers: cors });
});
