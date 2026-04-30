import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { phone, message, clinicId, templateName, templateLanguage = 'pt_BR', templateComponents } = body;

    if (!phone || !clinicId) {
      return new Response(
        JSON.stringify({ success: false, error: "Phone and clinicId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get Zap Responder configuration
    const { data: config, error: configError } = await supabase
      .from("zapresponder_configs")
      .select("*")
      .eq("is_active", true)
      .maybeSingle();

    if (configError || !config) {
      console.error("Zap Responder config not found:", configError);
      return new Response(
        JSON.stringify({ success: false, error: "Zap Responder not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Clean phone number (Meta requires format like 5511999999999)
    let cleanPhone = phone.replace(/\D/g, "");
    if (!cleanPhone.startsWith("55") && cleanPhone.length <= 11) {
      cleanPhone = "55" + cleanPhone;
    }

    // Prepare Zap Responder Payload
    const payload: any = {
      to: cleanPhone,
    };

    if (templateName) {
      payload.type = "template";
      payload.template = {
        name: templateName,
        language: { code: templateLanguage },
        components: templateComponents || []
      };
    } else {
      payload.type = "text";
      payload.text = { body: message };
    }

    console.log(`Sending message to ${cleanPhone} via Zap Responder...`);

    const response = await fetch("https://api.zapresponder.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.api_token}`
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(`Zap Responder API error: ${JSON.stringify(result)}`);
    }

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in send-whatsapp-zapresponder:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
