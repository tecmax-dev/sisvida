import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UpdateRecord {
  cpf: string;
  expires_at: string;
}

interface UpdateResult {
  cpf: string;
  success: boolean;
  patient_name?: string;
  card_number?: string;
  dependents_updated?: number;
  error?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { clinic_id, records } = await req.json() as { 
      clinic_id: string; 
      records: UpdateRecord[];
    };

    if (!clinic_id || !records || !Array.isArray(records)) {
      return new Response(
        JSON.stringify({ error: "clinic_id and records array are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing ${records.length} records for clinic ${clinic_id}`);

    const results: UpdateResult[] = [];
    let successCount = 0;
    let errorCount = 0;
    let dependentsUpdated = 0;

    for (const record of records) {
      try {
        // Normalize CPF (digits only)
        const cpfDigits = record.cpf.replace(/\D/g, "");
        
        if (cpfDigits.length !== 11) {
          results.push({
            cpf: record.cpf,
            success: false,
            error: "CPF inválido (deve ter 11 dígitos)"
          });
          errorCount++;
          continue;
        }

        // Parse date
        let expiresAt: Date;
        try {
          // Try different date formats
          if (record.expires_at.includes("/")) {
            const parts = record.expires_at.split("/");
            if (parts.length === 3) {
              // DD/MM/YYYY
              expiresAt = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
            } else {
              throw new Error("Invalid date format");
            }
          } else {
            expiresAt = new Date(record.expires_at);
          }
          
          if (isNaN(expiresAt.getTime())) {
            throw new Error("Invalid date");
          }
        } catch {
          results.push({
            cpf: record.cpf,
            success: false,
            error: `Data inválida: ${record.expires_at}`
          });
          errorCount++;
          continue;
        }

        // Find patient by CPF
        const { data: patient, error: patientError } = await supabase
          .from("patients")
          .select("id, name")
          .eq("clinic_id", clinic_id)
          .eq("cpf", cpfDigits)
          .single();

        if (patientError || !patient) {
          results.push({
            cpf: record.cpf,
            success: false,
            error: "Paciente não encontrado"
          });
          errorCount++;
          continue;
        }

        // Find active card
        const { data: card, error: cardError } = await supabase
          .from("patient_cards")
          .select("id, card_number")
          .eq("patient_id", patient.id)
          .eq("clinic_id", clinic_id)
          .eq("is_active", true)
          .single();

        if (cardError || !card) {
          results.push({
            cpf: record.cpf,
            success: false,
            patient_name: patient.name,
            error: "Carteirinha ativa não encontrada"
          });
          errorCount++;
          continue;
        }

        // Update card expiry
        const { error: updateError } = await supabase
          .from("patient_cards")
          .update({ expires_at: expiresAt.toISOString() })
          .eq("id", card.id);

        if (updateError) {
          results.push({
            cpf: record.cpf,
            success: false,
            patient_name: patient.name,
            card_number: card.card_number,
            error: `Erro ao atualizar: ${updateError.message}`
          });
          errorCount++;
          continue;
        }

        // Count dependents that will be synced (trigger handles the sync)
        const { count: depCount } = await supabase
          .from("patient_dependents")
          .select("id", { count: "exact", head: true })
          .eq("patient_id", patient.id)
          .eq("is_active", true);

        const depsUpdated = depCount || 0;
        dependentsUpdated += depsUpdated;

        results.push({
          cpf: record.cpf,
          success: true,
          patient_name: patient.name,
          card_number: card.card_number,
          dependents_updated: depsUpdated
        });
        successCount++;

      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro desconhecido";
        results.push({
          cpf: record.cpf,
          success: false,
          error: message
        });
        errorCount++;
      }
    }

    console.log(`Completed: ${successCount} success, ${errorCount} errors, ${dependentsUpdated} dependents synced`);

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          total: records.length,
          success_count: successCount,
          error_count: errorCount,
          dependents_synced: dependentsUpdated
        },
        results
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
