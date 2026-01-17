import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Tables to migrate in order (respecting foreign keys)
const TABLES_TO_MIGRATE = [
  // Core system config (no dependencies)
  "subscription_plans",
  "system_features",
  "plan_features",
  "subscription_addons",
  "permission_definitions",
  "feature_permissions",
  
  // Clinics (base for most other tables)
  "clinics",
  "subscriptions",
  "clinic_addons",
  "access_groups",
  "access_group_permissions",
  
  // Users and roles
  "profiles",
  "user_roles",
  "super_admins",
  
  // Professionals
  "professionals",
  "professional_schedules",
  
  // Patients
  "patients",
  "patient_dependents",
  "patient_cards",
  
  // Procedures
  "procedures",
  
  // Appointments
  "appointments",
  
  // Medical records
  "medical_records",
  "prescriptions",
  "anamnesis",
  "anamnese_templates",
  "anamnese_questions",
  "anamnese_question_options",
  "anamnese_responses",
  "anamnese_answers",
  "patient_attachments",
  "attachment_access_logs",
  
  // Insurance
  "insurance_plans",
  "patient_insurance",
  
  // Financial
  "cash_registers",
  "cash_transfers",
  "financial_categories",
  "financial_transactions",
  "chart_of_accounts",
  "cost_centers",
  "medical_repass_rules",
  "medical_repass_periods",
  
  // TISS
  "tiss_settings",
  "tiss_guides",
  "tiss_guide_items",
  "tiss_glosses",
  "tiss_submissions",
  "tiss_status_history",
  
  // Packages
  "patient_packages",
  "package_sessions",
  "package_templates",
  
  // Quotes
  "quotes",
  "quote_items",
  
  // Stock
  "stock_products",
  "stock_suppliers",
  "stock_categories",
  "stock_movements",
  
  // Queues
  "queues",
  "queue_entries",
  "queue_calls",
  "waiting_list",
  
  // Marketing
  "patient_segments",
  "campaigns",
  "automation_flows",
  "message_logs",
  "birthday_message_logs",
  "card_expiry_notifications",
  
  // Holidays
  "clinic_holidays",
  "national_holidays",
  "state_holidays",
  "municipal_holidays",
  
  // API & Webhooks
  "webhooks",
  "api_keys",
  "api_logs",
  "audit_logs",
  
  // Notifications
  "system_notifications",
  "clinic_notification_reads",
  "upgrade_requests",
  "addon_requests",
  
  // Chat
  "chat_sectors",
  "chat_settings",
  "chat_working_hours",
  "chat_quick_responses",
  "chat_conversations",
  "chat_messages",
  
  // CMS
  "carousel_banners",
  "panel_banners",
  "hero_settings",
  "global_config",
  
  // HR
  "payslip_requests",
  "employers",
  "contribution_types",
  "employer_contributions",
  "union_entities",
  "accounting_offices",
  "accounting_office_employers",
  "accounting_office_portal_logs",
  "contribution_audit_logs",
  "contribution_reissue_requests",
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Authorization header required");
    }

    // Destination (this project)
    const destUrl = Deno.env.get("SUPABASE_URL")!;
    const destServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const destAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Source project
    const sourceUrl = Deno.env.get("SOURCE_SUPABASE_URL");
    const sourceServiceKey = Deno.env.get("SOURCE_SERVICE_ROLE_KEY");

    if (!sourceUrl || !sourceServiceKey) {
      throw new Error("SOURCE_SUPABASE_URL and SOURCE_SERVICE_ROLE_KEY must be configured");
    }

    // Verify super admin
    const supabaseUser = createClient(destUrl, destAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const destAdmin = createClient(destUrl, destServiceKey);

    const { data: isSuperAdmin } = await destAdmin
      .from("super_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .single();

    if (!isSuperAdmin) {
      throw new Error("Super admin access required");
    }

    console.log(`[migrate-from-source] Started by ${user.email}`);

    // Create source client
    const sourceAdmin = createClient(sourceUrl, sourceServiceKey);

    const results: Record<string, { success: boolean; count: number; error?: string }> = {};
    let totalMigrated = 0;

    for (const tableName of TABLES_TO_MIGRATE) {
      try {
        console.log(`[migrate-from-source] Fetching ${tableName} from source...`);

        // Fetch from source
        const { data: sourceData, error: sourceError } = await sourceAdmin
          .from(tableName)
          .select("*");

        if (sourceError) {
          console.log(`[migrate-from-source] Skipping ${tableName}: ${sourceError.message}`);
          results[tableName] = { success: false, count: 0, error: sourceError.message };
          continue;
        }

        if (!sourceData || sourceData.length === 0) {
          console.log(`[migrate-from-source] ${tableName}: empty`);
          results[tableName] = { success: true, count: 0 };
          continue;
        }

        console.log(`[migrate-from-source] Upserting ${sourceData.length} rows to ${tableName}...`);

        // Upsert to destination
        const { error: upsertError } = await destAdmin
          .from(tableName)
          .upsert(sourceData, { 
            onConflict: "id",
            ignoreDuplicates: false 
          });

        if (upsertError) {
          console.error(`[migrate-from-source] Error upserting ${tableName}:`, upsertError);
          results[tableName] = { success: false, count: 0, error: upsertError.message };
        } else {
          console.log(`[migrate-from-source] ${tableName}: ${sourceData.length} rows migrated`);
          results[tableName] = { success: true, count: sourceData.length };
          totalMigrated += sourceData.length;
        }
      } catch (tableError) {
        console.error(`[migrate-from-source] Exception with ${tableName}:`, tableError);
        results[tableName] = { 
          success: false, 
          count: 0, 
          error: tableError instanceof Error ? tableError.message : "Unknown error" 
        };
      }
    }

    console.log(`[migrate-from-source] Complete. Total: ${totalMigrated} rows`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Migration complete. ${totalMigrated} rows migrated.`,
        tables: results,
        migrated_by: user.email,
        migrated_at: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[migrate-from-source] Error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
