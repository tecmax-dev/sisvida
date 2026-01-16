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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const daysBeforeExpiry = 15; // Notify 15 days before expiry
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysBeforeExpiry);
    
    // Also check for cards expiring today (grace period)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Find cards expiring in X days that haven't been notified
    const { data: expiringCards, error: cardsError } = await supabase
      .from("patient_cards")
      .select(`
        id, card_number, expires_at, patient_id,
        patient:patients(id, name, phone, cpf),
        clinic:clinics(id, name, phone)
      `)
      .eq("is_active", true)
      .gte("expires_at", todayStart.toISOString())
      .lte("expires_at", targetDate.toISOString());

    if (cardsError) throw cardsError;
    console.log(`Found ${expiringCards?.length || 0} cards expiring soon`);

    const results = [];

    for (const card of expiringCards || []) {
      // Check if already notified for this expiry period
      const { data: existingNotification } = await supabase
        .from("card_expiry_notifications")
        .select("id")
        .eq("card_id", card.id)
        .eq("notification_type", "expiring_soon")
        .gte("sent_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .single();

      if (existingNotification) {
        console.log(`Card ${card.card_number} already notified recently`);
        continue;
      }

      const patient = card.patient as any;
      const clinic = card.clinic as any;
      
      if (!patient?.phone || !clinic?.id) continue;

      // Check if clinic has Evolution API configured
      const { data: evolutionConfig } = await supabase
        .from("evolution_configs")
        .select("*")
        .eq("clinic_id", clinic.id)
        .eq("is_connected", true)
        .single();

      if (!evolutionConfig) {
        console.log(`Clinic ${clinic.name} has no WhatsApp configured`);
        continue;
      }

      // Timezone-safe date formatting
      const dateOnly = (card.expires_at || "").slice(0, 10);
      const dateMatch = dateOnly.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      const expiryDate = dateMatch ? `${dateMatch[3]}/${dateMatch[2]}/${dateMatch[1]}` : card.expires_at;
      
      // Create payslip request record
      const { data: payslipRequest, error: payslipError } = await supabase
        .from("payslip_requests")
        .insert({
          clinic_id: clinic.id,
          patient_id: patient.id,
          card_id: card.id,
          status: "pending",
        })
        .select("id")
        .single();

      if (payslipError) {
        console.error(`Error creating payslip request for ${patient.name}:`, payslipError);
      }

      // Message requesting payslip image
      const message = `Olá ${patient.name}! 👋

Sua carteirinha digital da *${clinic.name}* (${card.card_number}) está próxima do vencimento.

📅 *Validade:* ${expiryDate}

Para renovar sua carteirinha, por favor *envie uma foto do seu contracheque* nesta conversa. Nossa equipe irá analisar e atualizar sua carteirinha.

📎 Basta tirar uma foto do contracheque e enviar aqui!

Atenciosamente,
Equipe ${clinic.name}`;

      try {
        const { error: whatsappError } = await supabase.functions.invoke("send-whatsapp", {
          body: {
            clinicId: clinic.id,
            phone: patient.phone,
            message,
          },
        });

        const success = !whatsappError;
        
        // Log notification
        await supabase.from("card_expiry_notifications").insert({
          card_id: card.id,
          notification_type: "expiring_soon",
          days_before_expiry: daysBeforeExpiry,
          success,
          error_message: whatsappError?.message || null,
        });

        results.push({ cardNumber: card.card_number, success, patient: patient.name });
        console.log(`Notification sent to ${patient.name}: ${success}`);
      } catch (err: any) {
        await supabase.from("card_expiry_notifications").insert({
          card_id: card.id,
          notification_type: "expiring_soon",
          days_before_expiry: daysBeforeExpiry,
          success: false,
          error_message: err.message,
        });
        results.push({ cardNumber: card.card_number, success: false, error: err.message });
      }
    }

    return new Response(JSON.stringify({ success: true, processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
