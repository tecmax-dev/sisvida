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

    const now = new Date().toISOString();

    // Fetch scheduled automations that are due
    const { data: scheduledAutomations, error: fetchError } = await supabase
      .from("scheduled_automations")
      .select(`
        id,
        clinic_id,
        patient_id,
        message_data,
        automation:automation_flows(
          id, name, message_template, channel
        )
      `)
      .eq("status", "pending")
      .lte("scheduled_at", now)
      .limit(50);

    if (fetchError) throw fetchError;

    if (!scheduledAutomations || scheduledAutomations.length === 0) {
      console.log("No scheduled automations to process");
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Processing ${scheduledAutomations.length} scheduled automations`);

    const results = [];
    const monthYear = new Date().toISOString().slice(0, 7);

    for (const scheduled of scheduledAutomations) {
      const automation = scheduled.automation as any;
      const messageData = scheduled.message_data as any;

      if (!automation || !messageData?.patient_phone) {
        await supabase
          .from("scheduled_automations")
          .update({ status: "failed", processed_at: now, error_message: "Missing data" })
          .eq("id", scheduled.id);
        continue;
      }

      // Get clinic info
      const { data: clinic } = await supabase
        .from("clinics")
        .select("name, logo_url, whatsapp_header_image_url")
        .eq("id", scheduled.clinic_id)
        .single();

      // Get Evolution config
      const { data: evolutionConfig } = await supabase
        .from("evolution_configs")
        .select("api_url, api_key, instance_name, is_connected")
        .eq("clinic_id", scheduled.clinic_id)
        .eq("is_connected", true)
        .single();

      if (!evolutionConfig) {
        await supabase
          .from("scheduled_automations")
          .update({ status: "failed", processed_at: now, error_message: "No WhatsApp config" })
          .eq("id", scheduled.id);
        continue;
      }

      // Check message limits
      const { data: usageData } = await supabase.rpc("get_clinic_message_usage", {
        _clinic_id: scheduled.clinic_id,
        _month_year: monthYear,
      });

      if (usageData && usageData[0]?.remaining <= 0) {
        await supabase
          .from("scheduled_automations")
          .update({ status: "failed", processed_at: now, error_message: "Limit reached" })
          .eq("id", scheduled.id);
        continue;
      }

      // Format message
      let message = automation.message_template;
      message = message.replace(/\{\{patient_name\}\}/g, messageData.patient_name || '');
      message = message.replace(/\{\{clinic_name\}\}/g, messageData.clinic_name || clinic?.name || '');
      message = message.replace(/\{\{professional_name\}\}/g, messageData.professional_name || '');
      message = message.replace(/\{\{appointment_date\}\}/g, messageData.appointment_date || '');
      message = message.replace(/\{\{appointment_time\}\}/g, messageData.appointment_time || '');
      message = message.replace(/\{\{procedure_name\}\}/g, messageData.procedure_name || '');

      const logoUrl = clinic?.whatsapp_header_image_url || clinic?.logo_url;

      // Send message
      const sendResult = await sendWhatsAppMessage(
        evolutionConfig as EvolutionConfig,
        messageData.patient_phone,
        message,
        logoUrl
      );

      // Update scheduled automation status
      await supabase
        .from("scheduled_automations")
        .update({
          status: sendResult.success ? "sent" : "failed",
          processed_at: now,
          error_message: sendResult.error || null,
        })
        .eq("id", scheduled.id);

      // Log message
      await supabase.from("message_logs").insert({
        clinic_id: scheduled.clinic_id,
        patient_id: scheduled.patient_id,
        message_type: "automation",
        status: sendResult.success ? "sent" : "failed",
        error_message: sendResult.error || null,
        month_year: monthYear,
      });

      // Update automation execution count
      await supabase
        .from("automation_flows")
        .update({
          execution_count: (automation.execution_count || 0) + 1,
          last_executed_at: now,
        })
        .eq("id", automation.id);

      results.push({ id: scheduled.id, success: sendResult.success });
      console.log(`Scheduled automation ${automation.name} processed: ${sendResult.success}`);
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error processing scheduled automations:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
