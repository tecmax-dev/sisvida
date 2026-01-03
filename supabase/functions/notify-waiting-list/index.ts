import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WaitingListRequest {
  waiting_list_id: string;
  clinic_id: string;
  patient_id: string;
  patient_name: string;
  patient_phone: string;
  available_date: string;
  available_time: string;
  professional_id: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: WaitingListRequest = await req.json();
    console.log("Waiting list notification request:", body);

    // Get clinic and professional info
    const [clinicResult, professionalResult] = await Promise.all([
      supabase
        .from("clinics")
        .select("name, evolution_api_url, evolution_api_key, evolution_instance, phone")
        .eq("id", body.clinic_id)
        .single(),
      supabase
        .from("professionals")
        .select("name")
        .eq("id", body.professional_id)
        .single(),
    ]);

    const clinic = clinicResult.data;
    const professional = professionalResult.data;

    if (!clinic?.evolution_api_url || !clinic?.evolution_api_key || !clinic?.evolution_instance) {
      console.log("Clinic WhatsApp not configured");
      return new Response(JSON.stringify({ error: "WhatsApp not configured" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Format date
    const dateObj = new Date(body.available_date + "T00:00:00");
    const formattedDate = dateObj.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    // Format time
    const formattedTime = body.available_time.slice(0, 5);

    // Format phone
    let phone = body.patient_phone.replace(/\D/g, "");
    if (!phone.startsWith("55")) {
      phone = "55" + phone;
    }

    const message = `🔔 *Vaga Disponível!*

Olá ${body.patient_name.split(" ")[0]}! 

Uma vaga abriu na agenda de *${professional?.name || "nosso profissional"}* e você está na lista de espera!

📅 *Data:* ${formattedDate}
⏰ *Horário:* ${formattedTime}

Esta vaga está reservada para você por *2 horas*. 

Para confirmar, entre em contato conosco:
📞 ${clinic.phone || ""}

Caso não responda a tempo, a vaga será oferecida ao próximo associado(a) da lista.

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

    console.log("Waiting list notification sent successfully to", phone);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error in notify-waiting-list:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
