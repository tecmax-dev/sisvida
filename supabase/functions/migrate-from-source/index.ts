import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function base64UrlDecode(input: string) {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "===".slice((base64.length + 3) % 4);
  return atob(padded);
}

function decodeJwtClaims(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(base64UrlDecode(parts[1]));
    return payload;
  } catch {
    return null;
  }
}

function getProjectRefFromUrl(url: string): string | null {
  try {
    const hostname = new URL(url).hostname;
    const sub = hostname.split(".")[0];
    return sub || null;
  } catch {
    return null;
  }
}

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

    // Validate source key early with diagnostics
    // NOTE: Some source projects might not have the same schema yet.
    // We only fail early for an invalid API key; missing tables should be handled per-table.
    const sourceRefFromUrl = getProjectRefFromUrl(sourceUrl);
    const sourceClaims = decodeJwtClaims(sourceServiceKey);
    const sourceRefFromKey = typeof sourceClaims?.ref === "string" ? (sourceClaims.ref as string) : null;
    const sourceRoleFromKey = typeof sourceClaims?.role === "string" ? (sourceClaims.role as string) : null;

    const { error: sourcePingError } = await sourceAdmin
      .from("subscription_plans")
      .select("id")
      .limit(1);

    if (sourcePingError) {
      const msg = (sourcePingError.message ?? "").toLowerCase();

      // Invalid key: stop immediately with clear diagnostics
      if (msg.includes("invalid api key")) {
        console.error("[migrate-from-source] Source invalid api key (ping)", {
          message: sourcePingError.message,
          sourceRefFromUrl,
          sourceRefFromKey,
          sourceRoleFromKey,
        });

        return new Response(
          JSON.stringify({
            success: false,
            error: `Chave inválida no projeto de origem: ${sourcePingError.message}`,
            diagnostics: {
              source_ref_from_url: sourceRefFromUrl,
              source_ref_from_key: sourceRefFromKey,
              source_role_from_key: sourceRoleFromKey,
              hint:
                sourceRefFromUrl && sourceRefFromKey && sourceRefFromUrl !== sourceRefFromKey
                  ? "A chave colada parece ser de OUTRO projeto (ref diferente do URL). Copie a service_role do mesmo projeto do URL."
                  : "Confirme que você colou a chave 'service_role' do projeto de origem (não anon/publishable).",
            },
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Schema mismatch or table missing: continue and let the per-table loop record what couldn't be migrated.
      console.warn("[migrate-from-source] Source ping warning; continuing", {
        message: sourcePingError.message,
        sourceRefFromUrl,
        sourceRefFromKey,
        sourceRoleFromKey,
      });
    }

    const PAGE_SIZE = 1000;

    const isMissingRelationError = (message: string) => {
      const msg = (message ?? "").toLowerCase();
      return msg.includes("relation") && msg.includes("does not exist");
    };

    // Quick schema compatibility check to avoid a noisy "skip everything" run.
    const CORE_SCHEMA_PROBES = ["clinics", "profiles", "patients", "appointments"];
    let probeOk = 0;
    const probeResults: Record<string, { ok: boolean; error?: string }> = {};

    for (const t of CORE_SCHEMA_PROBES) {
      const { error } = await sourceAdmin.from(t).select("id").limit(1);
      if (!error) {
        probeOk += 1;
        probeResults[t] = { ok: true };
      } else {
        probeResults[t] = { ok: false, error: error.message };
      }
    }

    if (probeOk === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            "O projeto de origem não parece ter as tabelas deste sistema. Verifique se você selecionou o projeto correto (ou se o schema ainda não foi criado lá).",
          diagnostics: {
            source_ref_from_url: sourceRefFromUrl,
            source_ref_from_key: sourceRefFromKey,
            source_role_from_key: sourceRoleFromKey,
            schema_probe: probeResults,
          },
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: Record<
      string,
      { success: boolean; count: number; error?: string; skipped?: boolean }
    > = {};

    const skippedMissingTables: string[] = [];
    let totalMigrated = 0;

    for (const tableName of TABLES_TO_MIGRATE) {
      try {
        let tableMigrated = 0;
        let offset = 0;

        while (true) {
          const { data: pageData, error: sourceError } = await sourceAdmin
            .from(tableName)
            .select("*")
            .range(offset, offset + PAGE_SIZE - 1);

          if (sourceError) {
            const msg = (sourceError.message ?? "").toLowerCase();

            // If the key is wrong, stop early and return clear diagnostics
            if (msg.includes("invalid api key")) {
              console.error("[migrate-from-source] Source invalid api key", {
                message: sourceError.message,
                sourceRefFromUrl,
                sourceRefFromKey,
                sourceRoleFromKey,
              });

              return new Response(
                JSON.stringify({
                  success: false,
                  error: `Chave inválida no projeto de origem: ${sourceError.message}`,
                  diagnostics: {
                    source_ref_from_url: sourceRefFromUrl,
                    source_ref_from_key: sourceRefFromKey,
                    source_role_from_key: sourceRoleFromKey,
                    hint:
                      sourceRefFromUrl && sourceRefFromKey && sourceRefFromUrl !== sourceRefFromKey
                        ? "A chave colada parece ser de OUTRO projeto (ref diferente do URL). Copie a service_role do mesmo projeto do URL."
                        : "Confirme que você colou a chave 'service_role' do projeto de origem (não anon/publishable).",
                  },
                }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }

            // Missing table in source: mark as skipped (not an error)
            if (isMissingRelationError(sourceError.message)) {
              skippedMissingTables.push(tableName);
              results[tableName] = {
                success: true,
                skipped: true,
                count: 0,
                error: "Pulado: tabela não existe no projeto de origem",
              };
              break;
            }

            results[tableName] = { success: false, count: 0, error: sourceError.message };
            break;
          }

          if (!pageData || pageData.length === 0) {
            results[tableName] = { success: true, count: tableMigrated };
            if (tableMigrated > 0) totalMigrated += tableMigrated;
            break;
          }

          const { error: upsertError } = await destAdmin.from(tableName).upsert(pageData);

          if (upsertError) {
            console.error(`[migrate-from-source] Error upserting ${tableName}:`, upsertError);
            results[tableName] = { success: false, count: tableMigrated, error: upsertError.message };
            break;
          }

          tableMigrated += pageData.length;

          if (pageData.length < PAGE_SIZE) {
            results[tableName] = { success: true, count: tableMigrated };
            totalMigrated += tableMigrated;
            break;
          }

          offset += PAGE_SIZE;
        }
      } catch (tableError) {
        console.error(`[migrate-from-source] Exception with ${tableName}:`, tableError);
        results[tableName] = {
          success: false,
          count: 0,
          error: tableError instanceof Error ? tableError.message : "Unknown error",
        };
      }
    }

    console.log(`[migrate-from-source] Complete. Total: ${totalMigrated} rows`);

    const skippedCount = skippedMissingTables.length;
    const message =
      `Migração concluída. ${totalMigrated} registros migrados.` +
      (skippedCount > 0
        ? ` ${skippedCount} tabelas não existem no projeto de origem e foram puladas.`
        : "");

    return new Response(
      JSON.stringify({
        success: true,
        message,
        tables: results,
        skipped_missing_tables: skippedMissingTables,
        skipped_missing_tables_count: skippedCount,
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
