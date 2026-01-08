import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate via API key or Authorization header
    const apiKey = req.headers.get("X-API-Key");
    const authHeader = req.headers.get("Authorization");
    const sourceApiKey = Deno.env.get("SOURCE_API_KEY");
    
    let authenticated = false;
    
    if (apiKey && apiKey === sourceApiKey) {
      authenticated = true;
    } else if (authHeader) {
      // Verify super admin via auth header
      const supabaseUser = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user } } = await supabaseUser.auth.getUser();
      if (user) {
        const supabaseAdmin = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );
        const { data: isSuperAdmin } = await supabaseAdmin
          .from("super_admins")
          .select("user_id")
          .eq("user_id", user.id)
          .single();
        if (isSuperAdmin) authenticated = true;
      }
    }
    
    if (!authenticated) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const clinicId = url.searchParams.get("clinic_id");
    
    if (!clinicId) {
      return new Response(JSON.stringify({ error: "clinic_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    console.log(`[clinic-backup] Starting backup for clinic: ${clinicId}`);

    const backup: Record<string, unknown[]> = {};
    const errors: string[] = [];

    // Helper function to fetch all data from a table with pagination
    async function fetchAllData(table: string, additionalFilters?: string) {
      const allData: unknown[] = [];
      let offset = 0;
      const limit = 1000;
      let hasMore = true;

      while (hasMore) {
        let query = supabase.from(table).select("*").eq("clinic_id", clinicId);
        const { data, error } = await query.range(offset, offset + limit - 1);
        
        if (error) {
          console.log(`[clinic-backup] Error fetching ${table}: ${error.message}`);
          errors.push(`${table}: ${error.message}`);
          break;
        }

        if (data && data.length > 0) {
          allData.push(...data);
          offset += limit;
          hasMore = data.length === limit;
        } else {
          hasMore = false;
        }
      }

      return allData;
    }

    // Tables to backup (with clinic_id filter)
    const clinicTables = [
      "patients",
      "patient_dependents",
      "patient_cards",
      "professionals",
      "procedures",
      "appointments",
      "medical_records",
      "prescriptions",
      "insurance_plans",
      "employers",
      "employer_contributions",
      "contribution_types",
      "employer_categories",
      "user_roles",
      "access_groups",
      "automation_flows",
      "clinic_holidays",
      "financial_transactions",
      "financial_categories",
      "cash_registers",
      "anamnese_templates",
      "anamnese_responses",
    ];

    // Fetch clinic data
    console.log(`[clinic-backup] Fetching clinic data...`);
    const { data: clinicData, error: clinicError } = await supabase
      .from("clinics")
      .select("*")
      .eq("id", clinicId)
      .single();

    if (clinicError) {
      return new Response(JSON.stringify({ error: `Clinic not found: ${clinicError.message}` }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    backup.clinics = [clinicData];
    console.log(`[clinic-backup] Clinic: ${clinicData.name}`);

    // Fetch subscription with plan
    const { data: subscriptionData } = await supabase
      .from("subscriptions")
      .select("*, subscription_plans(*)")
      .eq("clinic_id", clinicId);
    backup.subscriptions = subscriptionData || [];

    // Fetch all clinic tables
    for (const table of clinicTables) {
      console.log(`[clinic-backup] Fetching ${table}...`);
      try {
        const data = await fetchAllData(table);
        backup[table] = data;
        console.log(`[clinic-backup] ${table}: ${data.length} records`);
      } catch (err) {
        console.log(`[clinic-backup] Error with ${table}: ${err}`);
        errors.push(`${table}: ${err}`);
      }
    }

    // Fetch patient insurance records
    if (backup.patients && Array.isArray(backup.patients)) {
      const patientIds = backup.patients.map((p: any) => p.id);
      if (patientIds.length > 0) {
        const { data: patientInsurance } = await supabase
          .from("patient_insurance")
          .select("*")
          .in("patient_id", patientIds.slice(0, 500)); // Limit due to query size
        backup.patient_insurance = patientInsurance || [];
      }
    }

    // Summary
    const summary = {
      clinic_name: clinicData.name,
      clinic_slug: clinicData.slug,
      backup_date: new Date().toISOString(),
      record_counts: {} as Record<string, number>,
      errors,
    };

    for (const [table, data] of Object.entries(backup)) {
      if (Array.isArray(data)) {
        summary.record_counts[table] = data.length;
      }
    }

    console.log(`[clinic-backup] Backup complete. Summary:`, summary.record_counts);

    const backupData = {
      version: "1.0",
      ...summary,
      data: backup,
    };

    const jsonString = JSON.stringify(backupData, null, 2);

    return new Response(jsonString, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="backup_${clinicData.slug}_${new Date().toISOString().split('T')[0]}.json"`,
      },
    });

  } catch (error) {
    console.error("[clinic-backup] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
