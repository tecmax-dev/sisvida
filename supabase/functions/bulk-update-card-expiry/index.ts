import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

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

// Normalize CPF to digits only
function normalizeCpf(cpf: string): string {
  return cpf.replace(/\D/g, "");
}

// Format CPF with mask (XXX.XXX.XXX-XX)
function formatCpf(cpf: string): string {
  const digits = normalizeCpf(cpf);
  if (digits.length !== 11) return cpf;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

// Process a single record
async function processRecord(
  supabase: SupabaseClient,
  clinic_id: string,
  record: UpdateRecord
): Promise<UpdateResult> {
  try {
    const cpfDigits = normalizeCpf(record.cpf);
    
    if (cpfDigits.length !== 11) {
      return { cpf: record.cpf, success: false, error: "CPF inválido (deve ter 11 dígitos)" };
    }

    // Parse date
    let expiresAt: Date;
    const expiresStr = String(record.expires_at);
    if (expiresStr.includes("/")) {
      const parts = expiresStr.split("/");
      if (parts.length === 3) {
        expiresAt = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
      } else {
        return { cpf: record.cpf, success: false, error: `Data inválida: ${record.expires_at}` };
      }
    } else {
      expiresAt = new Date(expiresStr);
    }
    
    if (isNaN(expiresAt.getTime())) {
      return { cpf: record.cpf, success: false, error: `Data inválida: ${record.expires_at}` };
    }

    // Try to find patient by CPF - check both formatted and unformatted
    const formattedCpf = formatCpf(cpfDigits);
    
    // First try formatted CPF
    let { data: patient, error: patientError } = await supabase
      .from("patients")
      .select("id, name")
      .eq("clinic_id", clinic_id)
      .eq("cpf", formattedCpf)
      .maybeSingle();

    // If not found, try unformatted
    if (!patient) {
      const result = await supabase
        .from("patients")
        .select("id, name")
        .eq("clinic_id", clinic_id)
        .eq("cpf", cpfDigits)
        .maybeSingle();
      patient = result.data;
      patientError = result.error;
    }

    if (patientError || !patient) {
      return { cpf: record.cpf, success: false, error: "Paciente não encontrado" };
    }

    // Find active card
    const { data: card, error: cardError } = await supabase
      .from("patient_cards")
      .select("id, card_number")
      .eq("patient_id", patient.id)
      .eq("clinic_id", clinic_id)
      .eq("is_active", true)
      .maybeSingle();

    if (cardError || !card) {
      return { cpf: record.cpf, success: false, patient_name: patient.name, error: "Carteirinha ativa não encontrada" };
    }

    // Update card expiry
    const { error: updateError } = await supabase
      .from("patient_cards")
      .update({ expires_at: expiresAt.toISOString() })
      .eq("id", card.id);

    if (updateError) {
      return { cpf: record.cpf, success: false, patient_name: patient.name, card_number: card.card_number, error: `Erro ao atualizar: ${updateError.message}` };
    }

    // Count dependents (trigger will sync automatically)
    const { count: depCount } = await supabase
      .from("patient_dependents")
      .select("id", { count: "exact", head: true })
      .eq("patient_id", patient.id)
      .eq("is_active", true);

    return {
      cpf: record.cpf,
      success: true,
      patient_name: patient.name,
      card_number: card.card_number,
      dependents_updated: depCount || 0
    };
  } catch (err) {
    return { cpf: record.cpf, success: false, error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

// Process records in parallel batches
async function processBatch(
  supabase: SupabaseClient,
  clinic_id: string,
  records: UpdateRecord[],
  batchSize: number = 50
): Promise<UpdateResult[]> {
  const results: UpdateResult[] = [];
  
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(record => processRecord(supabase, clinic_id, record))
    );
    results.push(...batchResults);
    console.log(`Processed ${Math.min(i + batchSize, records.length)}/${records.length} records`);
  }
  
  return results;
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

    // Process in parallel batches of 50
    const results = await processBatch(supabase, clinic_id, records, 50);
    
    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;
    const dependentsUpdated = results.reduce((sum, r) => sum + (r.dependents_updated || 0), 0);

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
