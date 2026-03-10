import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * MOBILE APPOINTMENT ACTION - Edge Function
 * 
 * Processa ações de agendamento (confirmar, cancelar) feitas pelo paciente no PWA.
 * Dispara mensagem WhatsApp para o associado após cada ação.
 * Usa SERVICE_ROLE_KEY para bypassar RLS.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const DEFAULT_SYSTEM_LOGO = "https://app.eclini.com.br/eclini-whatsapp-header.jpg";

interface ActionRequest {
  appointmentId: string;
  patientId: string;
  action: "confirm" | "cancel" | "reschedule_notify";
}

function cleanPhoneNumber(phone: string): string {
  return phone.replace(/\D/g, "");
}

async function sendWhatsApp(
  supabase: any,
  clinicId: string,
  phone: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanPhone = cleanPhoneNumber(phone);
    if (!cleanPhone || cleanPhone.length < 10) {
      return { success: false, error: "Telefone inválido" };
    }

    // Get clinic WhatsApp config
    const { data: clinic } = await supabase
      .from("clinics")
      .select("whatsapp_provider, logo_url, whatsapp_header_image_url, name")
      .eq("id", clinicId)
      .single();

    if (!clinic) return { success: false, error: "Clínica não encontrada" };

    // Get union entity logo
    const { data: unionEntity } = await supabase
      .from("union_entities")
      .select("logo_url")
      .eq("clinic_id", clinicId)
      .eq("status", "ativa")
      .maybeSingle();

    const logoUrl = clinic.whatsapp_header_image_url || unionEntity?.logo_url || clinic.logo_url || DEFAULT_SYSTEM_LOGO;
    const provider = clinic.whatsapp_provider || "evolution";

    if (provider === "twilio") {
      const { data: twilioConfig } = await supabase
        .from("twilio_configs")
        .select("account_sid, auth_token, phone_number, is_connected")
        .eq("clinic_id", clinicId)
        .maybeSingle();

      if (!twilioConfig?.is_connected) return { success: false, error: "Twilio não conectado" };

      let formattedPhone = cleanPhone;
      if (!formattedPhone.startsWith("55")) formattedPhone = "55" + formattedPhone;

      const params = new URLSearchParams();
      params.append("To", `whatsapp:+${formattedPhone}`);
      params.append("From", twilioConfig.phone_number);
      params.append("Body", message);

      const twilioAuth = btoa(`${twilioConfig.account_sid}:${twilioConfig.auth_token}`);
      const resp = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${twilioConfig.account_sid}/Messages.json`,
        { method: "POST", headers: { Authorization: `Basic ${twilioAuth}`, "Content-Type": "application/x-www-form-urlencoded" }, body: params }
      );
      return resp.ok ? { success: true } : { success: false, error: "Twilio error" };
    }

    // Evolution API
    const { data: evoConfig } = await supabase
      .from("evolution_instances")
      .select("api_url, api_key, instance_name, is_connected")
      .eq("clinic_id", clinicId)
      .maybeSingle();

    if (!evoConfig?.is_connected) return { success: false, error: "WhatsApp não conectado" };

    let formattedPhone = cleanPhone;
    if (!formattedPhone.startsWith("55")) formattedPhone = "55" + formattedPhone;

    const apiUrl = evoConfig.api_url.replace(/\/+$/, "");

    // Send image + text
    const imageResp = await fetch(`${apiUrl}/message/sendMedia/${evoConfig.instance_name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: evoConfig.api_key },
      body: JSON.stringify({
        number: formattedPhone,
        mediatype: "image",
        mimetype: "image/jpeg",
        caption: message,
        media: logoUrl,
      }),
    });

    if (!imageResp.ok) {
      // Fallback to text only
      const textResp = await fetch(`${apiUrl}/message/sendText/${evoConfig.instance_name}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: evoConfig.api_key },
        body: JSON.stringify({ number: formattedPhone, text: message }),
      });
      return textResp.ok ? { success: true } : { success: false, error: "Evolution error" };
    }

    return { success: true };
  } catch (err: any) {
    console.error("[mobile-appointment-action] WhatsApp error:", err);
    return { success: false, error: err.message };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { appointmentId, patientId, action } = (await req.json()) as ActionRequest;

    if (!appointmentId || !patientId || !action) {
      return new Response(
        JSON.stringify({ success: false, error: "missing_params" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch appointment with patient and dependent data
    const { data: appointment, error: aptError } = await supabase
      .from("appointments")
      .select(`
        id, appointment_date, start_time, end_time, status, clinic_id, dependent_id,
        patient:patients!appointments_patient_id_fkey(id, name, phone),
        professional:professionals!appointments_professional_id_fkey(name, specialty),
        dependent:patient_dependents!appointments_dependent_id_fkey(id, name)
      `)
      .eq("id", appointmentId)
      .single();

    if (aptError || !appointment) {
      return new Response(
        JSON.stringify({ success: false, error: "appointment_not_found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the patient owns this appointment
    if (appointment.patient?.id !== patientId) {
      return new Response(
        JSON.stringify({ success: false, error: "unauthorized" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const clinicId = appointment.clinic_id;
    // Use dependent name when appointment is for a dependent
    const patientName = (appointment.dependent_id && appointment.dependent?.name)
      ? appointment.dependent.name
      : (appointment.patient?.name || "Associado");
    const patientPhone = appointment.patient?.phone;
    const profName = appointment.professional?.name || "profissional";
    const profSpecialty = appointment.professional?.specialty || "";
    const dateFormatted = new Date(appointment.appointment_date + "T12:00:00").toLocaleDateString("pt-BR");
    const timeFormatted = appointment.start_time?.slice(0, 5);

    // Get clinic name
    const { data: clinicData } = await supabase
      .from("clinics")
      .select("name")
      .eq("id", clinicId)
      .single();
    const clinicName = clinicData?.name || "Clínica";

    let updateData: Record<string, any> = {};
    let whatsappMessage = "";

    switch (action) {
      case "confirm":
        updateData = {
          status: "confirmed",
          confirmed_at: new Date().toISOString(),
        };
        whatsappMessage = `✅ *Consulta Confirmada!*

Olá, *${patientName}*!

Sua consulta foi confirmada com sucesso:

📅 *Data:* ${dateFormatted}
🕐 *Horário:* ${timeFormatted}
👨‍⚕️ *Profissional:* ${profName}${profSpecialty ? ` (${profSpecialty})` : ""}

Lembre-se de chegar com 10 minutos de antecedência.

_${clinicName}_`;
        break;

      case "cancel":
        updateData = {
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
          cancellation_reason: "Cancelado pelo paciente via app",
        };
        whatsappMessage = `❌ *Consulta Cancelada*

Olá, *${patientName}*.

Sua consulta foi cancelada:

📅 *Data:* ${dateFormatted}
🕐 *Horário:* ${timeFormatted}
👨‍⚕️ *Profissional:* ${profName}${profSpecialty ? ` (${profSpecialty})` : ""}

Caso precise, agende novamente pelo aplicativo.

_${clinicName}_`;
        break;

      case "reschedule_notify":
        // This action only sends notification, the actual reschedule
        // is handled by the booking page
        whatsappMessage = `🔄 *Consulta Reagendada*

Olá, *${patientName}*!

Sua consulta anterior foi reagendada:

📅 *Data original:* ${dateFormatted}
🕐 *Horário original:* ${timeFormatted}
👨‍⚕️ *Profissional:* ${profName}${profSpecialty ? ` (${profSpecialty})` : ""}

Você receberá os detalhes do novo agendamento em breve.

_${clinicName}_`;
        break;

      default:
        return new Response(
          JSON.stringify({ success: false, error: "invalid_action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    // Update appointment status (except for reschedule_notify)
    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await supabase
        .from("appointments")
        .update(updateData)
        .eq("id", appointmentId);

      if (updateError) {
        console.error("[mobile-appointment-action] Update error:", updateError);
        return new Response(
          JSON.stringify({ success: false, error: "update_failed" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Send WhatsApp notification
    let whatsappResult = { success: false, error: "Sem telefone cadastrado" };
    if (patientPhone) {
      whatsappResult = await sendWhatsApp(supabase, clinicId, patientPhone, whatsappMessage);
      console.log(`[mobile-appointment-action] WhatsApp result:`, whatsappResult);
    } else {
      console.warn("[mobile-appointment-action] Patient has no phone, skipping WhatsApp");
    }

    return new Response(
      JSON.stringify({
        success: true,
        action,
        appointmentId,
        whatsappSent: whatsappResult.success,
        whatsappError: whatsappResult.error || null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[mobile-appointment-action] Error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "internal_error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
