import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { clinic_id, expires_at, batch_size = 100 } = await req.json();

    if (!clinic_id || !expires_at) {
      return new Response(
        JSON.stringify({ error: "clinic_id and expires_at are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all patients from the clinic that don't have an active card
    const { data: patients, error: patientsError } = await supabase
      .from("patients")
      .select("id")
      .eq("clinic_id", clinic_id);

    if (patientsError) {
      throw new Error(`Error fetching patients: ${patientsError.message}`);
    }

    // Get existing cards for these patients
    const { data: existingCards, error: cardsError } = await supabase
      .from("patient_cards")
      .select("patient_id")
      .eq("clinic_id", clinic_id)
      .eq("is_active", true);

    if (cardsError) {
      throw new Error(`Error fetching existing cards: ${cardsError.message}`);
    }

    const existingPatientIds = new Set(existingCards?.map((c) => c.patient_id) || []);
    const patientsWithoutCards = patients?.filter((p) => !existingPatientIds.has(p.id)) || [];

    console.log(`Found ${patientsWithoutCards.length} patients without active cards`);

    let created = 0;
    let errors: string[] = [];

    // Process in batches
    for (let i = 0; i < patientsWithoutCards.length; i += batch_size) {
      const batch = patientsWithoutCards.slice(i, i + batch_size);
      
      const cardsToInsert = [];
      
      for (const patient of batch) {
        // Generate card number using RPC
        const { data: cardNumber, error: genError } = await supabase.rpc(
          "generate_card_number",
          { p_clinic_id: clinic_id }
        );

        if (genError) {
          errors.push(`Patient ${patient.id}: ${genError.message}`);
          continue;
        }

        cardsToInsert.push({
          clinic_id,
          patient_id: patient.id,
          card_number: cardNumber,
          issued_at: new Date().toISOString(),
          expires_at,
          is_active: true,
          token: crypto.randomUUID(),
        });
      }

      if (cardsToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from("patient_cards")
          .insert(cardsToInsert);

        if (insertError) {
          errors.push(`Batch ${i / batch_size + 1}: ${insertError.message}`);
        } else {
          created += cardsToInsert.length;
        }
      }

      console.log(`Processed batch ${Math.floor(i / batch_size) + 1}, created so far: ${created}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        total_patients: patients?.length || 0,
        patients_without_cards: patientsWithoutCards.length,
        cards_created: created,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
