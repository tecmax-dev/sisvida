import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

  // Updated domains based on latest platform changes
  const ZAP_RESPONDER_BASE_URL = "https://app.zapresponder.com.br";
  const ZAP_THINKER_BASE_URL = "https://api.zapthinker.com.br";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
     const body = await req.json();
      const {
        phone,
        message,
        clinicId,
        mediaUrl,
        test,
        templateName,
        templateLanguage,
        templateComponents
      } = body;

     if (!clinicId || (!phone && !test)) {
      return new Response(
        JSON.stringify({ success: false, error: "Phone and clinicId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const apiToken = Deno.env.get("ZAPSTER_API_TOKEN") || Deno.env.get("ZAPRESPONDER_API_TOKEN");
    if (!apiToken) {
      console.error("[zapster] ZAPSTER_API_TOKEN not configured");
      return new Response(
        JSON.stringify({ success: false, error: "ZAPSTER_API_TOKEN não configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: configs } = await supabase
      .from("zapster_configs")
      .select("instance_id, is_active")
      .eq("clinic_id", clinicId)
      .eq("is_active", true);

    if (!configs || configs.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Zap Responder não configurado para esta clínica" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let lastResult = { status: 404, data: {} };
    let success = false;

    let cleanPhone = phone.replace(/\D/g, "");
    if (!cleanPhone.startsWith("55") && cleanPhone.length >= 10 && cleanPhone.length <= 11) {
      cleanPhone = "55" + cleanPhone;
    }

    for (const cfg of configs) {
      console.log(`[zapresponder] Attempting send via instance ${cfg.instance_id} to ${cleanPhone}`);
      
      const payload: any = {
         phone: cleanPhone,
         message: message,
         departmentId: body.departmentId || cfg.instance_id,
       };

      if (templateName) {
        payload.template = {
          name: templateName,
          language: templateLanguage || 'pt_BR',
          components: templateComponents || []
        };
      }

      if (mediaUrl) (payload as any).mediaUrl = mediaUrl;

        try {
          const endpoints = [
            // Official Meta API Endpoints (Zap Responder uses app. prefix for many webhooks/APIs)
            { url: "https://app.zapresponder.com.br/api/external/messages/send", payload: { number: cleanPhone, body: message, department_id: payload.departmentId } },
            { url: "https://api.zapresponder.com.br/api/messages/send", payload: { number: cleanPhone, body: message, department_id: payload.departmentId } },
            { url: "https://api.zapresponder.com.br/message/sendText", payload: { number: cleanPhone, text: message, departmentId: payload.departmentId } },
            // Legacy or Alternative Endpoints
            { url: "https://api.zapthinker.com.br/message/sendText", payload: { number: cleanPhone, text: message, departmentId: payload.departmentId } },
            { url: "https://api.zapresponder.com.br/whatsapp/messages/send", payload: { phone: cleanPhone, message: message, departamento_id: payload.departmentId } }
          ];

          let response;
          let currentResult = {};

          for (const endpoint of endpoints) {
            console.log(`[zapresponder] Trying transfer endpoint: ${endpoint.url}`);
            response = await fetch(endpoint.url, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiToken}`,
              },
              body: JSON.stringify(endpoint.payload),
            });

            currentResult = await response.json().catch(() => ({}));
            if (response.ok) {
              console.log(`[zapresponder] Success via ${endpoint.url}`);
              break;
            }
            console.warn(`[zapresponder] ${endpoint.url} failed with ${response.status}`);
          }

          lastResult = { status: response?.status || 500, data: currentResult };
          if (response?.ok) {
            success = true;
            break;
          }
      } catch (err) {
        console.error(`[zapresponder] Exception via ${cfg.instance_id}:`, err);
      }
    }

    if (success) {
      return new Response(
        JSON.stringify({ success: true, data: lastResult.data }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: `Zapster ${lastResult.status}`, details: lastResult.data }),
      { status: lastResult.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[zapster] Error in send-whatsapp-zapresponder:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
