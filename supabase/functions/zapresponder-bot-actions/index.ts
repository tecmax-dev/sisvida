 import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
 import { createClient } from "npm:@supabase/supabase-js@2";
 
 const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
 };
 
 const ZAP_RESPONDER_BASE_URL = "https://api.zapresponder.com.br/api";
 
 serve(async (req) => {
   if (req.method === "OPTIONS") {
     return new Response("ok", { headers: corsHeaders });
   }
 
   try {
     const body = await req.json();
     const {
       phone,
       clinicId,
        action, // "startBot" or "stopBot"
       variables = {},
       initialMessage = "start"
     } = body;
 
     if (!clinicId || !phone || !action) {
       return new Response(
         JSON.stringify({ success: false, error: "Phone, clinicId and action are required" }),
         { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     const supabase = createClient(
       Deno.env.get("SUPABASE_URL")!,
       Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
     );
 
     const apiToken = Deno.env.get("ZAPSTER_API_TOKEN") || Deno.env.get("ZAPRESPONDER_API_TOKEN");
     if (!apiToken) {
       console.error("[zapresponder-bot] ZAPSTER_API_TOKEN not configured");
       return new Response(
         JSON.stringify({ success: false, error: "ZAPSTER_API_TOKEN não configurado" }),
         { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
      // First try zapster_configs (used for sending messages)
      let { data: config, error: configError } = await supabase
        .from("zapster_configs")
        .select("instance_id")
        .eq("clinic_id", clinicId)
        .eq("is_active", true)
        .maybeSingle();

      // Fallback to zapresponder_configs (legacy/specific for bot)
      if (!config) {
        const { data: legacyConfig, error: legacyError } = await supabase
          .from("zapresponder_configs")
          .select("instance_id")
          .eq("clinic_id", clinicId)
          .maybeSingle();
        
        if (legacyConfig) {
          config = legacyConfig;
        }
      }

      if (!config) {
        console.error(`[zapresponder-bot] No config found for clinic ${clinicId}`);
        return new Response(
          JSON.stringify({ success: false, error: "Zap Responder não configurado para esta clínica" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
 
     let cleanPhone = phone.replace(/\D/g, "");
     if (!cleanPhone.startsWith("55") && cleanPhone.length >= 10 && cleanPhone.length <= 11) {
       cleanPhone = "55" + cleanPhone;
     }
 
      let endpoint = "";
      let payload = {};

      if (action === "startBot") {
        endpoint = "/conversa/iniciarBot";
        payload = {
          chatId: cleanPhone,
          departamento: config.instance_id,
          aplicacao: "whatsapp",
          mensagemInicial: initialMessage,
          variaveis: variables
        };
      } else if (action === "stopBot") {
        endpoint = "/conversa/encerrar";
        payload = {
          chatId: cleanPhone,
          departamento: config.instance_id,
          aplicacao: "whatsapp"
        };
      } else {
        return new Response(
          JSON.stringify({ success: false, error: "Action not supported" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[zapresponder-bot] Performing ${action} for ${cleanPhone}`);

      const response = await fetch(`${ZAP_RESPONDER_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiToken}`,
          "Accept": "application/json"
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => ({}));
      
      if (!response.ok) {
        console.error(`[zapresponder-bot] API Error: ${response.status}`, result);
        return new Response(
          JSON.stringify({ success: false, error: `API Error ${response.status}`, details: result }),
          { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, data: result }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
 
   } catch (error) {
     console.error("[zapresponder-bot] Error:", error);
     return new Response(
       JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }),
       { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
     );
   }
 });