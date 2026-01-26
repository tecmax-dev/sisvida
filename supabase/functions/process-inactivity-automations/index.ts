import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EvolutionConfig {
  api_url: string;
  api_key: string;
  instance_name: string;
}

async function sendWhatsAppMessage(
  config: EvolutionConfig,
  phone: string,
  message: string,
  logoUrl?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const formattedPhone = phone.replace(/\D/g, '');
    const phoneWithCountry = formattedPhone.startsWith('55') ? formattedPhone : `55${formattedPhone}`;
    
    const endpoint = logoUrl 
      ? `${config.api_url}/message/sendMedia/${config.instance_name}`
      : `${config.api_url}/message/sendText/${config.instance_name}`;
    
    const body = logoUrl
      ? {
          number: phoneWithCountry,
          mediatype: "image",
          media: logoUrl,
          caption: message,
        }
      : {
          number: phoneWithCountry,
          text: message,
        };
    
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: config.api_key,
      },
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: errorText };
    }
    
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get all clinics with active inactivity automations (including union entity logo)
    const { data: automations, error: automationsError } = await supabase
      .from("automation_flows")
      .select(`
        id, clinic_id, name, message_template, trigger_config, execution_count,
        clinic:clinics(id, name, logo_url, whatsapp_header_image_url, union_entities!union_entities_clinic_id_fkey(logo_url))
      `)
      .eq("trigger_type", "inactivity")
      .eq("is_active", true)
      .is("deleted_at", null);

    if (automationsError) throw automationsError;

    if (!automations || automations.length === 0) {
      console.log("No active inactivity automations found");
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const monthYear = new Date().toISOString().slice(0, 7);
    const now = new Date();
    const results = [];

    for (const automation of automations) {
      const triggerConfig = automation.trigger_config as any;
      const inactivityDays = triggerConfig?.inactivity_days || 30;
      const clinic = automation.clinic as any;

      console.log(`Processing inactivity automation for clinic ${clinic?.name}, days: ${inactivityDays}`);

      // Get Evolution config for this clinic
      const { data: evolutionConfig } = await supabase
        .from("evolution_configs")
        .select("api_url, api_key, instance_name, is_connected")
        .eq("clinic_id", automation.clinic_id)
        .eq("is_connected", true)
        .single();

      if (!evolutionConfig) {
        console.log(`No Evolution config for clinic ${automation.clinic_id}`);
        continue;
      }

      // Check message limits
      const { data: usageData } = await supabase.rpc("get_clinic_message_usage", {
        _clinic_id: automation.clinic_id,
        _month_year: monthYear,
      });

      if (usageData && usageData[0]?.remaining <= 0) {
        console.log(`Message limit reached for clinic ${automation.clinic_id}`);
        continue;
      }

      // Calculate the date threshold
      const thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() - inactivityDays);

      // Find inactive patients (no appointments after threshold)
      const { data: inactivePatients, error: patientsError } = await supabase
        .from("patients")
        .select("id, name, phone")
        .eq("clinic_id", automation.clinic_id)
        .not("phone", "is", null);

      if (patientsError) {
        console.error(`Error fetching patients: ${patientsError.message}`);
        continue;
      }

      for (const patient of inactivePatients || []) {
        if (!patient.phone) continue;

        // Check last appointment
        const { data: lastAppointment } = await supabase
          .from("appointments")
          .select("appointment_date")
          .eq("patient_id", patient.id)
          .eq("clinic_id", automation.clinic_id)
          .order("appointment_date", { ascending: false })
          .limit(1)
          .single();

        // Skip if patient has recent appointment
        if (lastAppointment) {
          const lastDate = new Date(lastAppointment.appointment_date);
          if (lastDate >= thresholdDate) continue;
        }

        // Check if we already sent an inactivity message recently (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data: recentMessage } = await supabase
          .from("message_logs")
          .select("id")
          .eq("patient_id", patient.id)
          .eq("clinic_id", automation.clinic_id)
          .eq("message_type", "inactivity")
          .gte("created_at", thirtyDaysAgo.toISOString())
          .limit(1)
          .single();

        if (recentMessage) {
          console.log(`Skipping patient ${patient.name} - already notified recently`);
          continue;
        }

        // Format message
        let message = automation.message_template;
        message = message.replace(/\{\{patient_name\}\}/g, patient.name || '');
        message = message.replace(/\{\{clinic_name\}\}/g, clinic?.name || '');

        // Prioridade: 1) Logo da union entity, 2) Header WhatsApp, 3) Logo da clínica
        const unionEntity = clinic?.union_entities?.[0];
        const logoUrl = unionEntity?.logo_url || clinic?.whatsapp_header_image_url || clinic?.logo_url;

        // Send message
        const sendResult = await sendWhatsAppMessage(
          evolutionConfig as EvolutionConfig,
          patient.phone,
          message,
          logoUrl
        );

        // Log message
        await supabase.from("message_logs").insert({
          clinic_id: automation.clinic_id,
          patient_id: patient.id,
          message_type: "inactivity",
          status: sendResult.success ? "sent" : "failed",
          error_message: sendResult.error || null,
          month_year: monthYear,
        });

        if (sendResult.success) {
          results.push({ patient: patient.name, automation: automation.name });
        }

        // Rate limiting
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }

      // Update automation stats
      await supabase
        .from("automation_flows")
        .update({
          execution_count: (automation.execution_count || 0) + results.length,
          last_executed_at: now.toISOString(),
        })
        .eq("id", automation.id);
    }

    console.log(`Inactivity automation processed: ${results.length} messages sent`);

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error processing inactivity automations:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
