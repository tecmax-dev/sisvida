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
    const { phone, clinicId, patientName, cardNumber, expiryDate } = await req.json();
    
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get clinic Evolution config
    const { data: evolutionConfig } = await supabase
      .from("evolution_configs")
      .select("*")
      .eq("clinic_id", clinicId)
      .eq("is_connected", true)
      .single();

    if (!evolutionConfig) {
      return new Response(
        JSON.stringify({ error: "Evolution API não configurada para esta clínica" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get clinic name
    const { data: clinic } = await supabase
      .from("clinics")
      .select("name")
      .eq("id", clinicId)
      .single();

    const clinicName = clinic?.name || "Clínica";

    // Message requesting payslip image
    const message = `Olá ${patientName}! 👋

Sua carteirinha digital da *${clinicName}* (${cardNumber}) está próxima do vencimento.

📅 *Validade:* ${expiryDate}

Para renovar sua carteirinha, por favor *envie uma foto do seu contracheque* nesta conversa. Nossa equipe irá analisar e atualizar sua carteirinha.

📎 Basta tirar uma foto do contracheque e enviar aqui!

Atenciosamente,
Equipe ${clinicName}`;

    // Format phone
    let formattedPhone = phone.replace(/\D/g, "");
    if (!formattedPhone.startsWith("55")) {
      formattedPhone = "55" + formattedPhone;
    }

    console.log("Sending card expiry notification to:", formattedPhone);
    console.log("Using Evolution instance:", evolutionConfig.instance_name);

    const evolutionUrl = `${evolutionConfig.api_url}/message/sendText/${evolutionConfig.instance_name}`;
    
    const response = await fetch(evolutionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": evolutionConfig.api_key,
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
        message: "Notificação de carteira vencida enviada",
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
