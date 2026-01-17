import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Tables to migrate in order (respecting foreign keys)
const TABLES_TO_MIGRATE = [
  "subscription_plans",
  "system_features",
  "plan_features",
  "subscription_addons",
  "permission_definitions",
  "feature_permissions",
  "hero_settings",
  "carousel_banners",
  "global_config",
  "national_holidays",
  "state_holidays",
  "municipal_holidays",
  "chat_sectors",
  "chat_settings",
  "chat_working_hours",
  "chat_quick_responses",
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
