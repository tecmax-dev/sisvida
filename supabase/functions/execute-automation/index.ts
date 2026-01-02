import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AutomationFlow {
  id: string;
  clinic_id: string;
  name: string;
  trigger_type: string;
  channel: string;
  message_template: string;
  delay_hours: number | null;
  trigger_config: any;
  is_active: boolean;
  execution_count: number | null;
}

interface EvolutionConfig {
  api_url: string;
  api_key: string;
  instance_name: string;
  is_connected: boolean;
}

interface ExecuteAutomationRequest {
  trigger_type: string;
  clinic_id: string;
  patient_id: string;
  patient_name: string;
  patient_phone: string;
  extra_data?: Record<string, any>;
}

function formatMessage(template: string, data: Record<string, any>): string {
  let message = template;
  
  // Replace all variables
  message = message.replace(/\{\{patient_name\}\}/g, data.patient_name || '');
  message = message.replace(/\{\{clinic_name\}\}/g, data.clinic_name || '');
  message = message.replace(/\{\{professional_name\}\}/g, data.professional_name || '');
  message = message.replace(/\{\{appointment_date\}\}/g, data.appointment_date || '');
  message = message.replace(/\{\{appointment_time\}\}/g, data.appointment_time || '');
  message = message.replace(/\{\{procedure_name\}\}/g, data.procedure_name || '');
  
  return message;
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
      console.error(`Evolution API error: ${errorText}`);
      return { success: false, error: errorText };
    }
    
    return { success: true };
  } catch (error: any) {
    console.error(`Error sending WhatsApp: ${error.message}`);
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

    const { trigger_type, clinic_id, patient_id, patient_name, patient_phone, extra_data } = 
      await req.json() as ExecuteAutomationRequest;

    console.log(`Executing automation: trigger=${trigger_type}, clinic=${clinic_id}, patient=${patient_name}`);

    if (!patient_phone) {
      console.log("No phone number provided, skipping automation");
      return new Response(JSON.stringify({ success: false, reason: "no_phone" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find active automations for this trigger and clinic
    const { data: automations, error: automationsError } = await supabase
      .from("automation_flows")
      .select("*")
      .eq("clinic_id", clinic_id)
      .eq("trigger_type", trigger_type)
      .eq("is_active", true)
      .is("deleted_at", null);

    if (automationsError) {
      console.error("Error fetching automations:", automationsError);
      throw automationsError;
    }

    if (!automations || automations.length === 0) {
      console.log(`No active automations found for trigger: ${trigger_type}`);
      return new Response(JSON.stringify({ success: true, processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get clinic info
    const { data: clinic, error: clinicError } = await supabase
      .from("clinics")
      .select("name, logo_url, whatsapp_header_image_url")
      .eq("id", clinic_id)
      .single();

    if (clinicError) throw clinicError;

    // Get Evolution config
    const { data: evolutionConfig, error: evolutionError } = await supabase
      .from("evolution_configs")
      .select("api_url, api_key, instance_name, is_connected")
      .eq("clinic_id", clinic_id)
      .eq("is_connected", true)
      .single();

    if (evolutionError || !evolutionConfig) {
      console.log("No Evolution config found or not connected");
      return new Response(JSON.stringify({ success: false, reason: "no_whatsapp_config" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check message limits
    const monthYear = new Date().toISOString().slice(0, 7);
    const { data: usageData } = await supabase.rpc("get_clinic_message_usage", {
      _clinic_id: clinic_id,
      _month_year: monthYear,
    });

    if (usageData && usageData[0]?.remaining <= 0) {
      console.log("Message limit reached for clinic");
      return new Response(JSON.stringify({ success: false, reason: "limit_reached" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = [];
    const logoUrl = clinic?.whatsapp_header_image_url || clinic?.logo_url;

    for (const automation of automations as AutomationFlow[]) {
      // If automation has delay, schedule it instead of executing immediately
      if (automation.delay_hours && automation.delay_hours > 0) {
        const scheduledAt = new Date();
        scheduledAt.setHours(scheduledAt.getHours() + automation.delay_hours);
        
        // Insert into scheduled_automations table
        await supabase.from("scheduled_automations").insert({
          automation_id: automation.id,
          clinic_id: clinic_id,
          patient_id: patient_id,
          scheduled_at: scheduledAt.toISOString(),
          message_data: {
            patient_name,
            patient_phone,
            clinic_name: clinic?.name,
            ...extra_data,
          },
        });
        
        console.log(`Automation ${automation.name} scheduled for ${scheduledAt.toISOString()}`);
        results.push({ automation: automation.name, scheduled: true, scheduledAt });
        continue;
      }

      // Format message with variables
      const message = formatMessage(automation.message_template, {
        patient_name,
        clinic_name: clinic?.name,
        ...extra_data,
      });

      // Send message
      const sendResult = await sendWhatsAppMessage(
        evolutionConfig as EvolutionConfig,
        patient_phone,
        message,
        logoUrl
      );

      // Log message
      await supabase.from("message_logs").insert({
        clinic_id: clinic_id,
        patient_id: patient_id,
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
          last_executed_at: new Date().toISOString(),
        })
        .eq("id", automation.id);

      results.push({ 
        automation: automation.name, 
        success: sendResult.success,
        error: sendResult.error 
      });
      
      console.log(`Automation ${automation.name} executed: ${sendResult.success}`);
    }

    return new Response(JSON.stringify({ success: true, processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error executing automation:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
