import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const EdgeRuntime: {
  waitUntil(promise: Promise<unknown>): void;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendCampaignRequest {
  campaignId: string;
  clinicId: string;
}

interface Patient {
  id: string;
  name: string;
  phone: string;
  email: string | null;
}

interface EvolutionConfig {
  api_url: string;
  api_key: string;
  instance_name: string;
  is_connected: boolean;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { campaignId, clinicId }: SendCampaignRequest = await req.json();

    console.log(`[send-campaign] Starting campaign ${campaignId} for clinic ${clinicId}`);

    // Verify clinic access
    const { data: hasAccess } = await supabase.rpc("has_clinic_access", {
      _user_id: user.id,
      _clinic_id: clinicId,
    });

    if (!hasAccess) {
      return new Response(
        JSON.stringify({ error: "Sem acesso à clínica" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch campaign
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", campaignId)
      .eq("clinic_id", clinicId)
      .single();

    if (campaignError || !campaign) {
      console.error("[send-campaign] Campaign not found:", campaignError);
      return new Response(
        JSON.stringify({ error: "Campanha não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (campaign.channel !== "whatsapp") {
      return new Response(
        JSON.stringify({ error: "Apenas campanhas WhatsApp são suportadas no momento" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get clinic WhatsApp provider config
    const { data: clinic } = await supabase
      .from("clinics")
      .select("whatsapp_provider, name")
      .eq("id", clinicId)
      .single();

    const provider = clinic?.whatsapp_provider || "evolution";

    // Get Evolution config
    const { data: evolutionConfig } = await supabase
      .from("evolution_configs")
      .select("*")
      .eq("clinic_id", clinicId)
      .single();

    if (!evolutionConfig) {
      await supabase
        .from("campaigns")
        .update({ status: "draft" })
        .eq("id", campaignId);

      return new Response(
        JSON.stringify({ error: "WhatsApp não configurado para esta clínica" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!evolutionConfig.is_connected) {
      await supabase
        .from("campaigns")
        .update({ status: "draft" })
        .eq("id", campaignId);

      return new Response(
        JSON.stringify({ error: "WhatsApp desconectado. Reconecte antes de enviar." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch patients from segment or all patients
    let patientsQuery = supabase
      .from("patients")
      .select("id, name, phone, email")
      .eq("clinic_id", clinicId)
      .eq("is_active", true)
      .not("phone", "is", null);

    if (campaign.segment_id) {
      // Get segment filters
      const { data: segment } = await supabase
        .from("patient_segments")
        .select("filters")
        .eq("id", campaign.segment_id)
        .single();

      if (segment?.filters) {
        const filters = segment.filters as any;
        
        // Apply filters based on segment configuration
        if (filters.gender) {
          patientsQuery = patientsQuery.eq("gender", filters.gender);
        }
        if (filters.city) {
          patientsQuery = patientsQuery.ilike("city", `%${filters.city}%`);
        }
        if (filters.ageMin || filters.ageMax) {
          const today = new Date();
          if (filters.ageMax) {
            const minBirthDate = new Date(today.getFullYear() - filters.ageMax - 1, today.getMonth(), today.getDate());
            patientsQuery = patientsQuery.gte("birth_date", minBirthDate.toISOString().split("T")[0]);
          }
          if (filters.ageMin) {
            const maxBirthDate = new Date(today.getFullYear() - filters.ageMin, today.getMonth(), today.getDate());
            patientsQuery = patientsQuery.lte("birth_date", maxBirthDate.toISOString().split("T")[0]);
          }
        }
      }
    }

    const { data: patients, error: patientsError } = await patientsQuery;

    if (patientsError) {
      console.error("[send-campaign] Error fetching patients:", patientsError);
      return new Response(
        JSON.stringify({ error: "Erro ao buscar pacientes" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Filter patients with valid phones
    const validPatients = (patients || []).filter((p: Patient) => {
      const phone = p.phone?.replace(/\D/g, "");
      return phone && phone.length >= 10;
    });

    if (validPatients.length === 0) {
      await supabase
        .from("campaigns")
        .update({ status: "completed", sent_count: 0 })
        .eq("id", campaignId);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Nenhum paciente com telefone válido encontrado",
          sent: 0,
          failed: 0
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[send-campaign] Found ${validPatients.length} patients to send`);

    // Update campaign to sending
    await supabase
      .from("campaigns")
      .update({ status: "sending" })
      .eq("id", campaignId);

    // Process sending in background
    const sendMessages = async () => {
      let sentCount = 0;
      let failedCount = 0;
      const batchSize = 10;
      const delayBetweenMessages = 1500; // 1.5 seconds between messages

      for (let i = 0; i < validPatients.length; i += batchSize) {
        // Check if campaign was paused
        const { data: currentCampaign } = await supabase
          .from("campaigns")
          .select("status")
          .eq("id", campaignId)
          .single();

        if (currentCampaign?.status === "paused" || currentCampaign?.status === "cancelled") {
          console.log(`[send-campaign] Campaign ${campaignId} was ${currentCampaign.status}, stopping.`);
          break;
        }

        const batch = validPatients.slice(i, i + batchSize);

        for (const patient of batch) {
          try {
            // Replace variables in message
            const firstName = patient.name.split(" ")[0];
            let message = campaign.message_template
              .replace(/\{nome\}/gi, patient.name)
              .replace(/\{primeiro_nome\}/gi, firstName)
              .replace(/\{telefone\}/gi, patient.phone || "");

            // Format phone
            let phone = patient.phone.replace(/\D/g, "");
            if (phone.length === 11) {
              phone = "55" + phone;
            } else if (phone.length === 10) {
              phone = "55" + phone;
            }

            let response: Response;
            
            // Check if campaign has image
            if (campaign.image_url) {
              // Send via Evolution API with media
              const evolutionUrl = `${evolutionConfig.api_url}/message/sendMedia/${evolutionConfig.instance_name}`;
              
              response = await fetch(evolutionUrl, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "apikey": evolutionConfig.api_key,
                },
                body: JSON.stringify({
                  number: phone,
                  mediatype: "image",
                  media: campaign.image_url,
                  caption: message,
                }),
              });
            } else {
              // Send via Evolution API text only
              const evolutionUrl = `${evolutionConfig.api_url}/message/sendText/${evolutionConfig.instance_name}`;
              
              response = await fetch(evolutionUrl, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "apikey": evolutionConfig.api_key,
                },
                body: JSON.stringify({
                  number: phone,
                  text: message,
                }),
              });
            }

            if (response.ok) {
              sentCount++;
              console.log(`[send-campaign] Message sent to ${phone}`);
              
              // Log message
              await supabase.from("message_logs").insert({
                clinic_id: clinicId,
                phone: phone,
                message: message.substring(0, 500),
                status: "sent",
                provider: "evolution",
                month_year: new Date().toISOString().slice(0, 7),
              });
            } else {
              failedCount++;
              const errorText = await response.text();
              console.error(`[send-campaign] Failed to send to ${phone}:`, errorText);
            }

            // Wait between messages to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, delayBetweenMessages));
          } catch (error) {
            failedCount++;
            console.error(`[send-campaign] Error sending to ${patient.phone}:`, error);
          }
        }

        // Update counters after each batch
        await supabase
          .from("campaigns")
          .update({ 
            sent_count: sentCount,
            delivered_count: sentCount,
            failed_count: failedCount
          })
          .eq("id", campaignId);
      }

      // Mark as completed
      const { data: finalStatus } = await supabase
        .from("campaigns")
        .select("status")
        .eq("id", campaignId)
        .single();

      if (finalStatus?.status === "sending") {
        await supabase
          .from("campaigns")
          .update({ 
            status: "completed",
            sent_count: sentCount,
            delivered_count: sentCount,
            failed_count: failedCount
          })
          .eq("id", campaignId);
      }

      console.log(`[send-campaign] Campaign ${campaignId} finished. Sent: ${sentCount}, Failed: ${failedCount}`);
    };

    // Start sending in background
    EdgeRuntime.waitUntil(sendMessages());

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Enviando para ${validPatients.length} pacientes`,
        total: validPatients.length
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("[send-campaign] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro interno";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
