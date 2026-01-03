import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NPSRequest {
  clinic_id: string;
  patient_id: string;
  patient_name: string;
  patient_phone: string;
  appointment_id: string;
  professional_id: string;
  delay_hours?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: NPSRequest = await req.json();
    console.log("NPS Survey request:", body);

    // Get clinic WhatsApp config
    const { data: clinic } = await supabase
      .from("clinics")
      .select("name, evolution_api_url, evolution_api_key, evolution_instance")
      .eq("id", body.clinic_id)
      .single();

    if (!clinic?.evolution_api_url || !clinic?.evolution_api_key || !clinic?.evolution_instance) {
      console.log("Clinic WhatsApp not configured");
      return new Response(JSON.stringify({ error: "WhatsApp not configured" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create NPS survey record
    const { data: survey, error: surveyError } = await supabase
      .from("nps_surveys")
      .insert({
        clinic_id: body.clinic_id,
        patient_id: body.patient_id,
        appointment_id: body.appointment_id,
        professional_id: body.professional_id,
      })
      .select("id, response_token")
      .single();

    if (surveyError) {
      console.error("Error creating NPS survey:", surveyError);
      throw surveyError;
    }

    // Build survey link
    const baseUrl = Deno.env.get("SUPABASE_URL")?.replace(".supabase.co", ".lovableproject.com") || "https://eclini.com.br";
    const surveyLink = `${baseUrl}/nps/${survey.response_token}`;

    // Format phone number
    let phone = body.patient_phone.replace(/\D/g, "");
    if (!phone.startsWith("55")) {
      phone = "55" + phone;
    }

    // Get NPS settings for message template
    const { data: settings } = await supabase
      .from("nps_settings")
      .select("message_template")
      .eq("clinic_id", body.clinic_id)
      .single();

    const template = settings?.message_template || 
      "Olá {nome}! 😊\n\nComo foi seu atendimento na {clinica}?\n\nAvalie de 0 a 10 clicando no link abaixo:\n{link}\n\nSua opinião é muito importante para nós!";

    const message = template
      .replace("{nome}", body.patient_name.split(" ")[0])
      .replace("{clinica}", clinic.name)
      .replace("{link}", surveyLink);

    // Send WhatsApp message
    const evolutionUrl = `${clinic.evolution_api_url}/message/sendText/${clinic.evolution_instance}`;
    const response = await fetch(evolutionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": clinic.evolution_api_key,
      },
      body: JSON.stringify({
        number: phone,
        text: message,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Evolution API error:", errorText);
      throw new Error(`Evolution API error: ${errorText}`);
    }

    console.log("NPS survey sent successfully to", phone);

    return new Response(JSON.stringify({ success: true, survey_id: survey.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error in send-nps-survey:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
