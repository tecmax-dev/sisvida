import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

    // Known base URLs for ZapResponder/ZapThinker/Evolution
    const BASE_URLS = [
      "https://api.zapthinker.com",
      "https://api.zapresponder.com.br",
      "https://app.zapresponder.com.br",
      Deno.env.get("EVOLUTION_API_URL") || ""
    ].filter(url => url.length > 0);

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
        let response;
        let currentResult = {};

        // Generate all possible endpoints to try
        const endpointsToTry: string[] = [];
        for (const base of BASE_URLS) {
          const cleanBase = base.replace(/\/$/, "");
          // Try Evolution v1 format with instance in URL
          endpointsToTry.push(`${cleanBase}/message/sendText/${cfg.instance_id}`);
          // Try ZapResponder v2 formats
          endpointsToTry.push(`${cleanBase}/api/messages/send`);
          endpointsToTry.push(`${cleanBase}/api/external/messages/send`);
          // Try legacy formats
          endpointsToTry.push(`${cleanBase}/message/sendText`);
        }

        for (const url of endpointsToTry) {
          console.log(`[zapresponder] Trying endpoint: ${url}`);
          
          const isV2 = url.includes('/api/') || url.includes('/external/');
          const isEvoV1 = url.includes(`/message/sendText/${cfg.instance_id}`);
          
          let payloadData: any;
          if (isV2) {
            payloadData = { number: cleanPhone, body: message, department_id: payload.departmentId };
          } else {
            payloadData = { number: cleanPhone, text: message };
            if (!isEvoV1) payloadData.departmentId = payload.departmentId;
          }

          try {
            const headers: Record<string, string> = {
              "Content-Type": "application/json",
            };

            // Try different header names for the API key
            if (url.includes("evo.tecmax.net") || (Deno.env.get("EVOLUTION_API_URL") && url.includes(Deno.env.get("EVOLUTION_API_URL")!))) {
              headers["apikey"] = Deno.env.get("EVOLUTION_API_KEY") || apiToken;
            } else {
              headers["Authorization"] = `Bearer ${apiToken}`;
              headers["apikey"] = apiToken; // Some rebranded versions use this
            }

            response = await fetch(url, {
              method: "POST",
              headers,
              body: JSON.stringify(payloadData),
            });

            currentResult = await response.json().catch(() => ({}));
            
            if (response.ok) {
              console.log(`[zapresponder] Success via ${url}`);
              break;
            }
            console.warn(`[zapresponder] ${url} failed with ${response.status}: ${JSON.stringify(currentResult)}`);
          } catch (fetchErr) {
            console.error(`[zapresponder] Fetch error for ${url}:`, fetchErr.message);
            continue;
          }
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
