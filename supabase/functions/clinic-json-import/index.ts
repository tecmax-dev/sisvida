import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Tables and their import order (dependency order)
const IMPORT_ORDER = [
  // Phase 1: Base config and catalogs
  "specialties",
  "employer_categories",
  "insurance_plans",
  "procedures",
  "contribution_types",
  "anamnese_templates",
  "access_groups",
  // Phase 2: Main entities
  "accounting_offices",
  "employers",
  "professionals",
  "patients",
  // Phase 3: Dependent entities
  "patient_dependents",
  "patient_cards",
  "professional_schedules",
  "accounting_office_employers",
  // Phase 4: Transactions and records
  "appointments",
  "medical_records",
  "employer_contributions",
  "anamnesis",
  // Phase 5: More dependent data
  "anamnese_questions",
  "anamnese_question_options",
  "anamnese_responses",
  "anamnese_answers",
  "financial_categories",
  "cash_registers",
  "financial_transactions",
  "cash_transfers",
  "clinic_holidays",
  "document_settings",
  "access_group_permissions",
];

// Required fields per table
const REQUIRED_FIELDS: Record<string, string[]> = {
  patients: ["name", "phone"],
  employers: ["name"], // cnpj is recommended but not required for partial imports
  accounting_offices: ["name", "email"],
};

// Foreign key mappings: { table: { field: referencedTable } }
const FK_MAPPINGS: Record<string, Record<string, string>> = {
  patients: { employer_id: "employers", insurance_plan_id: "insurance_plans" },
  patient_dependents: { patient_id: "patients" },
  patient_cards: { patient_id: "patients" },
  professionals: { specialty_id: "specialties" },
  professional_schedules: { professional_id: "professionals" },
  accounting_office_employers: { accounting_office_id: "accounting_offices", employer_id: "employers" },
  appointments: { patient_id: "patients", professional_id: "professionals", procedure_id: "procedures", dependent_id: "patient_dependents" },
  medical_records: { patient_id: "patients", professional_id: "professionals", appointment_id: "appointments", dependent_id: "patient_dependents" },
  employer_contributions: { employer_id: "employers", contribution_type_id: "contribution_types" },
  anamnesis: { patient_id: "patients" },
  anamnese_questions: { template_id: "anamnese_templates" },
  anamnese_question_options: { question_id: "anamnese_questions" },
  anamnese_responses: { template_id: "anamnese_templates", patient_id: "patients", professional_id: "professionals" },
  anamnese_answers: { response_id: "anamnese_responses", question_id: "anamnese_questions" },
  financial_transactions: { category_id: "financial_categories", patient_id: "patients", appointment_id: "appointments" },
  cash_transfers: { from_register_id: "cash_registers", to_register_id: "cash_registers" },
  access_group_permissions: { access_group_id: "access_groups" },
};

// Fields to ignore during import (auto-generated)
const IGNORED_FIELDS = [
  "id", "created_at", "updated_at", "clinic_id", "user_id", "created_by",
  "qr_code_token", "access_code", "access_code_expires_at", "portal_last_access_at"
];

interface ImportResult {
  success: boolean;
  mode: "dry_run" | "import";
  validation: {
    valid: boolean;
    errors: string[];
    warnings: string[];
  };
  summary: Record<string, { total: number; imported: number; skipped: number; errors: number }>;
  mapping_stats: {
    by_old_id: number;
    by_legacy_id: number;
  };
  details: {
    table: string;
    action: string;
    count: number;
  }[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Usuário não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify super admin
    const { data: superAdmin } = await supabaseAdmin
      .from("super_admins")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!superAdmin) {
      return new Response(JSON.stringify({ error: "Acesso negado - apenas super admins" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request body
    const body = await req.json();
    const { clinic_id, mode, payload } = body;

    if (!clinic_id) {
      return new Response(JSON.stringify({ error: "clinic_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!mode || !["dry_run", "import"].includes(mode)) {
      return new Response(JSON.stringify({ error: "mode deve ser 'dry_run' ou 'import'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!payload) {
      return new Response(JSON.stringify({ error: "payload é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[JSON Import] Starting ${mode} for clinic ${clinic_id}`);

    // Validate clinic exists
    const { data: clinic, error: clinicError } = await supabaseAdmin
      .from("clinics")
      .select("id, name, slug")
      .eq("id", clinic_id)
      .single();

    if (clinicError || !clinic) {
      return new Response(JSON.stringify({ error: "Clínica não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ==================== VALIDATION ====================
    const result: ImportResult = {
      success: false,
      mode,
      validation: { valid: true, errors: [], warnings: [] },
      summary: {},
      mapping_stats: { by_old_id: 0, by_legacy_id: 0 },
      details: [],
    };

    // Validate root structure
    if (!payload.version || payload.version !== "1.0") {
      result.validation.errors.push(`Versão inválida: esperado "1.0", recebido "${payload.version}"`);
      result.validation.valid = false;
    }

    if (!payload.data || typeof payload.data !== "object") {
      result.validation.errors.push("Campo 'data' é obrigatório e deve ser um objeto");
      result.validation.valid = false;
    }

    if (!payload.clinic_name) {
      result.validation.warnings.push("Campo 'clinic_name' não encontrado no backup");
    }

    if (!payload.backup_date) {
      result.validation.warnings.push("Campo 'backup_date' não encontrado no backup");
    }

    // If basic validation failed, return early
    if (!result.validation.valid) {
      return new Response(JSON.stringify(result), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = payload.data;

    // ID Mapping: oldId -> newId and legacyId -> newId
    const idMaps: Record<string, Map<string, string>> = {};
    const legacyMaps: Record<string, Map<string, string>> = {};

    // Initialize maps for all tables
    IMPORT_ORDER.forEach(table => {
      idMaps[table] = new Map();
      legacyMaps[table] = new Map();
    });

    // Pre-validate required fields and count records
    for (const table of IMPORT_ORDER) {
      const records = data[table];
      if (!records || !Array.isArray(records) || records.length === 0) {
        continue;
      }

      result.summary[table] = { total: records.length, imported: 0, skipped: 0, errors: 0 };

      // Check required fields
      const requiredFields = REQUIRED_FIELDS[table];
      if (requiredFields) {
        for (let i = 0; i < records.length; i++) {
          const record = records[i];
          for (const field of requiredFields) {
            if (!record[field] || (typeof record[field] === "string" && record[field].trim() === "")) {
              result.validation.warnings.push(`${table}[${i}]: campo obrigatório '${field}' vazio ou ausente`);
            }
          }
        }
      }

      // Validate foreign keys (check if referenced IDs exist in the backup)
      const fkMappings = FK_MAPPINGS[table];
      if (fkMappings) {
        for (let i = 0; i < records.length; i++) {
          const record = records[i];
          for (const [field, refTable] of Object.entries(fkMappings)) {
            const refId = record[field];
            if (refId && refId !== null) {
              const refRecords = data[refTable];
              if (refRecords && Array.isArray(refRecords)) {
                const found = refRecords.some((r: any) => r.id === refId || r.legacy_id === refId);
                if (!found) {
                  result.validation.warnings.push(
                    `${table}[${i}]: FK '${field}' referencia '${refId}' não encontrado em '${refTable}'`
                  );
                }
              }
            }
          }
        }
      }
    }

    // Log summary
    const totalRecords = Object.values(result.summary).reduce((acc, s) => acc + s.total, 0);
    console.log(`[JSON Import] Found ${totalRecords} records across ${Object.keys(result.summary).length} tables`);

    // If only dry run, return validation results
    if (mode === "dry_run") {
      result.success = result.validation.valid && result.validation.errors.length === 0;
      result.details.push({ table: "validation", action: "dry_run", count: totalRecords });
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ==================== IMPORT ====================
    console.log(`[JSON Import] Starting actual import...`);

    // Helper to clean record for insertion
    const cleanRecord = (record: any, table: string) => {
      const cleaned: Record<string, any> = {};
      for (const [key, value] of Object.entries(record)) {
        if (IGNORED_FIELDS.includes(key)) continue;
        cleaned[key] = value;
      }
      // Always set clinic_id
      cleaned.clinic_id = clinic_id;
      return cleaned;
    };

    // Helper to remap foreign keys
    const remapFKs = (record: any, table: string) => {
      const fkMappings = FK_MAPPINGS[table];
      if (!fkMappings) return record;

      const remapped = { ...record };
      for (const [field, refTable] of Object.entries(fkMappings)) {
        const oldId = record[field];
        if (!oldId) continue;

        // Try to find new ID from mapping
        const newId = idMaps[refTable]?.get(oldId) || legacyMaps[refTable]?.get(oldId);
        if (newId) {
          remapped[field] = newId;
          result.mapping_stats.by_old_id++;
        } else {
          // FK not found in mapping - set to null to avoid errors
          remapped[field] = null;
          result.validation.warnings.push(`${table}: FK '${field}' = '${oldId}' não mapeado, definido como null`);
        }
      }
      return remapped;
    };

    // Import each table in order
    for (const table of IMPORT_ORDER) {
      const records = data[table];
      if (!records || !Array.isArray(records) || records.length === 0) {
        continue;
      }

      console.log(`[JSON Import] Processing ${table}: ${records.length} records`);

      // Check if table exists in database
      try {
        const BATCH_SIZE = 100;
        let imported = 0;
        let skipped = 0;
        let errors = 0;

        for (let i = 0; i < records.length; i += BATCH_SIZE) {
          const batch = records.slice(i, i + BATCH_SIZE);
          const cleanedBatch: any[] = [];

          for (const record of batch) {
            const oldId = record.id;
            const legacyId = record.legacy_id;

            // Clean and remap
            let cleaned = cleanRecord(record, table);
            cleaned = remapFKs(cleaned, table);

            // Remove legacy_id if the table doesn't have it (will cause error)
            // We'll handle it after insert for mapping
            const legacyIdForMapping = cleaned.legacy_id;
            
            // Store original id for mapping
            cleanedBatch.push({ data: cleaned, oldId, legacyId: legacyIdForMapping || legacyId });
          }

          // Insert batch
          const insertData = cleanedBatch.map(b => b.data);
          
          const { data: insertedData, error: insertError } = await supabaseAdmin
            .from(table)
            .insert(insertData)
            .select("id");

          if (insertError) {
            console.error(`[JSON Import] Error inserting into ${table}:`, insertError);
            result.validation.warnings.push(`${table}: Erro ao inserir lote - ${insertError.message}`);
            errors += batch.length;
          } else if (insertedData) {
            // Map old IDs to new IDs
            for (let j = 0; j < insertedData.length && j < cleanedBatch.length; j++) {
              const newId = insertedData[j].id;
              const { oldId, legacyId } = cleanedBatch[j];

              if (oldId) {
                idMaps[table].set(oldId, newId);
              }
              if (legacyId) {
                legacyMaps[table].set(legacyId, newId);
                result.mapping_stats.by_legacy_id++;
              }
            }
            imported += insertedData.length;
          }
        }

        result.summary[table] = {
          ...result.summary[table],
          imported,
          skipped,
          errors,
        };

        result.details.push({
          table,
          action: "import",
          count: imported,
        });

        console.log(`[JSON Import] ${table}: imported=${imported}, skipped=${skipped}, errors=${errors}`);
      } catch (tableError) {
        console.error(`[JSON Import] Exception processing ${table}:`, tableError);
        result.validation.warnings.push(`${table}: Exceção - ${tableError instanceof Error ? tableError.message : String(tableError)}`);
        result.summary[table] = {
          ...result.summary[table],
          errors: records.length,
        };
      }
    }

    // Final summary
    const totalImported = Object.values(result.summary).reduce((acc, s) => acc + s.imported, 0);
    const totalErrors = Object.values(result.summary).reduce((acc, s) => acc + s.errors, 0);

    result.success = totalErrors === 0;
    console.log(`[JSON Import] Complete: ${totalImported} imported, ${totalErrors} errors`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[JSON Import] Fatal error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Erro desconhecido",
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
