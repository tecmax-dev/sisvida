import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ExamNotificationRequest {
  clinic_id: string;
  patient_id: string;
  exam_result_id: string;
  patient_name: string;
  patient_phone: string;
  exam_title: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: ExamNotificationRequest = await req.json();
    console.log("Exam notification request:", body);

    // Get clinic WhatsApp config
    const { data: clinic } = await supabase
      .from("clinics")
      .select("name, evolution_api_url, evolution_api_key, evolution_instance, phone")
      .eq("id", body.clinic_id)
      .single();

    if (!clinic?.evolution_api_url || !clinic?.evolution_api_key || !clinic?.evolution_instance) {
      console.log("Clinic WhatsApp not configured");
      return new Response(JSON.stringify({ error: "WhatsApp not configured" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Format phone
    let phone = body.patient_phone.replace(/\D/g, "");
    if (!phone.startsWith("55")) {
      phone = "55" + phone;
    }

    const message = `📋 *Resultado de Exame Disponível*

Olá ${body.patient_name.split(" ")[0]}!

O resultado do seu exame *${body.exam_title}* já está disponível.

Para visualizá-lo, entre em contato conosco:
📞 ${clinic.phone || ""}

Ou acesse sua área do paciente.

_${clinic.name}_`;

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

    // Update exam result as notification sent
    await supabase
      .from("exam_results")
      .update({
        notification_sent: true,
        notification_sent_at: new Date().toISOString(),
      })
      .eq("id", body.exam_result_id);

    console.log("Exam notification sent successfully to", phone);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error in send-exam-notification:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
