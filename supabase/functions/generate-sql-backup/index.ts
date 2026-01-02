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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Authorization header required");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify super admin
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const { data: isSuperAdmin } = await supabaseAdmin
      .from("super_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .single();

    if (!isSuperAdmin) {
      throw new Error("Super admin access required");
    }

    console.log("[generate-sql-backup] Starting backup...");

    // Tables to export (in order to respect foreign keys)
    const tables = [
      "subscription_plans",
      "system_features",
      "plan_features",
      "subscription_addons",
      "permission_definitions",
      "feature_permissions",
      "clinics",
      "subscriptions",
      "clinic_addons",
      "access_groups",
      "access_group_permissions",
      "profiles",
      "user_roles",
      "super_admins",
      "professionals",
      "professional_schedules",
      "patients",
      "patient_dependents",
      "patient_cards",
      "procedures",
      "appointments",
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
      "insurance_plans",
      "patient_insurance",
      "cash_registers",
      "cash_transfers",
      "financial_categories",
      "financial_transactions",
      "chart_of_accounts",
      "cost_centers",
      "medical_repass_rules",
      "medical_repass_periods",
      "tiss_settings",
      "tiss_guides",
      "tiss_guide_items",
      "tiss_glosses",
      "tiss_submissions",
      "tiss_status_history",
      "patient_packages",
      "package_sessions",
      "package_templates",
      "quotes",
      "quote_items",
      "stock_products",
      "stock_suppliers",
      "stock_categories",
      "stock_movements",
      "queues",
      "queue_entries",
      "queue_calls",
      "waiting_list",
      "patient_segments",
      "campaigns",
      "automation_flows",
      "message_logs",
      "birthday_message_logs",
      "card_expiry_notifications",
      "clinic_holidays",
      "national_holidays",
      "state_holidays",
      "municipal_holidays",
      "webhooks",
      "api_keys",
      "api_logs",
      "audit_logs",
      "system_notifications",
      "clinic_notification_reads",
      "upgrade_requests",
      "addon_requests",
      "chat_sectors",
      "chat_settings",
      "chat_working_hours",
      "chat_quick_responses",
      "chat_conversations",
      "chat_messages",
      "carousel_banners",
      "panel_banners",
      "hero_settings",
      "global_config",
      "payslip_requests",
      "employers",
    ];

    let sqlBackup = `-- SQL Backup generated at ${new Date().toISOString()}\n`;
    sqlBackup += `-- Database: Lovable Cloud (Supabase)\n\n`;
    sqlBackup += `-- =============================================\n`;
    sqlBackup += `-- DISABLE CONSTRAINTS FOR IMPORT\n`;
    sqlBackup += `-- =============================================\n`;
    sqlBackup += `SET session_replication_role = 'replica';\n\n`;

    const exportedTables: string[] = [];
    const errors: string[] = [];

    for (const tableName of tables) {
      try {
        // Get table data
        const { data, error } = await supabaseAdmin
          .from(tableName)
          .select("*");

        if (error) {
          console.log(`[generate-sql-backup] Skipping ${tableName}: ${error.message}`);
          errors.push(`-- Table ${tableName} skipped: ${error.message}`);
          continue;
        }

        if (!data || data.length === 0) {
          sqlBackup += `-- Table: ${tableName} (empty)\n\n`;
          exportedTables.push(tableName);
          continue;
        }

        sqlBackup += `-- =============================================\n`;
        sqlBackup += `-- Table: ${tableName} (${data.length} rows)\n`;
        sqlBackup += `-- =============================================\n`;
        sqlBackup += `DELETE FROM public.${tableName};\n`;

        // Generate INSERT statements
        for (const row of data) {
          const columns = Object.keys(row);
          const values = columns.map(col => {
            const val = row[col];
            if (val === null) return "NULL";
            if (typeof val === "boolean") return val ? "TRUE" : "FALSE";
            if (typeof val === "number") return val.toString();
            if (typeof val === "object") return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
            return `'${String(val).replace(/'/g, "''")}'`;
          });
          
          sqlBackup += `INSERT INTO public.${tableName} (${columns.join(", ")}) VALUES (${values.join(", ")});\n`;
        }
        
        sqlBackup += `\n`;
        exportedTables.push(tableName);
        console.log(`[generate-sql-backup] Exported ${tableName}: ${data.length} rows`);
      } catch (tableError) {
        console.error(`[generate-sql-backup] Error with ${tableName}:`, tableError);
        errors.push(`-- Table ${tableName} error: ${tableError}`);
      }
    }

    sqlBackup += `-- =============================================\n`;
    sqlBackup += `-- RE-ENABLE CONSTRAINTS\n`;
    sqlBackup += `-- =============================================\n`;
    sqlBackup += `SET session_replication_role = 'origin';\n\n`;

    if (errors.length > 0) {
      sqlBackup += `-- =============================================\n`;
      sqlBackup += `-- ERRORS/SKIPPED TABLES\n`;
      sqlBackup += `-- =============================================\n`;
      sqlBackup += errors.join("\n") + "\n";
    }

    sqlBackup += `\n-- Backup complete. Exported ${exportedTables.length} tables.\n`;

    console.log(`[generate-sql-backup] Backup complete: ${exportedTables.length} tables`);

    return new Response(sqlBackup, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="backup_${new Date().toISOString().split('T')[0]}.sql"`,
      },
    });
  } catch (error) {
    console.error("[generate-sql-backup] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
