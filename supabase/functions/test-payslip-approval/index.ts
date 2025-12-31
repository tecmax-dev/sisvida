import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone } = await req.json();
    
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get global Evolution config
    const { data: globalConfig } = await supabase
      .from("global_config")
      .select("*")
      .single();

    if (!globalConfig?.evolution_api_url || !globalConfig?.evolution_api_key || !globalConfig?.evolution_instance) {
      return new Response(
        JSON.stringify({ error: "Evolution API não configurada globalmente" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const message = `Olá! 🎉\n\nSeu contracheque foi aprovado e sua carteirinha foi renovada com sucesso!\n\n📅 Nova validade: *31/12/2025*\n\nObrigado por manter seus dados atualizados. Estamos à disposição para qualquer dúvida!`;

    // Format phone
    let formattedPhone = phone.replace(/\D/g, "");
    if (!formattedPhone.startsWith("55")) {
      formattedPhone = "55" + formattedPhone;
    }

    console.log("Sending test message to:", formattedPhone);
    console.log("Using Evolution instance:", globalConfig.evolution_instance);

    const evolutionUrl = `${globalConfig.evolution_api_url}/message/sendText/${globalConfig.evolution_instance}`;
    
    const response = await fetch(evolutionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": globalConfig.evolution_api_key,
      },
      body: JSON.stringify({
        number: formattedPhone,
        text: message,
      }),
    });

    const responseText = await response.text();
    console.log("Evolution API response:", responseText);

    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      result = { raw: responseText };
    }

    return new Response(
      JSON.stringify({ 
        success: response.ok, 
        phone: formattedPhone,
        result 
      }),
      { 
        status: response.ok ? 200 : 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error: unknown) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
