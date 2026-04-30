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
     const { phone, message, clinicId, templateName, templateLanguage = 'pt_BR', templateComponents, test } = body;

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

    // Get Zap Responder configuration
    const { data: config, error: configError } = await supabase
      .from("zapresponder_configs")
      .select("*")
      .eq("is_active", true)
      .maybeSingle();

     // Prefer secret from environment over database (more secure)
     const apiToken = Deno.env.get("ZAPRESPONDER_API_TOKEN") || config?.api_token;

     if (!apiToken || apiToken === "managed-via-secrets") {
       console.error("Zap Responder API token not found in secrets");
       return new Response(
         JSON.stringify({ success: false, error: "API token not configured in Secrets" }),
         { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }

     if (test) {
       // Validate token by fetching account info
       const response = await fetch("https://api.zapresponder.com/v1/account", {
         headers: { "Authorization": `Bearer ${apiToken}` }
       });
       
       if (!response.ok) {
         throw new Error("Invalid API token");
       }

       return new Response(
         JSON.stringify({ success: true, message: "Token valid" }),
         { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
         "Authorization": `Bearer ${apiToken}`
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
