import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TableSummary {
  table: string;
  count: number;
}

interface ImportResult {
  success: boolean;
  message?: string;
  error?: string;
  tables?: Record<string, { success: boolean; count: number; error?: string }>;
  usersCreated?: number;
  usersSkipped?: number;
  userMapping?: Record<string, string>;
}

const USER_ID_TABLES = new Set([
  "profiles",
  "user_roles",
  "super_admins",
  "professionals",
  "audit_logs",
  "attachment_access_logs",
]);

// Tables that should be imported in order (dependencies first)
const TABLE_ORDER = [
  "clinics",
  "profiles",
  "user_roles",
  "super_admins",
  "professionals",
  "insurance_plans",
  "procedures",
  "patients",
  "patient_dependents",
  "appointments",
  // ... other tables will be imported after these
];

function remapUserIds(record: Record<string, unknown>, mapping: Record<string, string>): Record<string, unknown> {
  if (!mapping || Object.keys(mapping).length === 0) return record;
  const out: Record<string, unknown> = { ...record };
  for (const [k, v] of Object.entries(out)) {
    if (typeof v === "string" && mapping[v]) {
      out[k] = mapping[v];
    }
  }
  return out;
}

async function fetchFromSourceApi(
  baseUrl: string,
  syncKey: string,
  action: string,
  params: Record<string, string> = {}
): Promise<any> {
  const url = new URL(baseUrl);
  url.searchParams.set("action", action);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const response = await fetch(url.toString(), {
    headers: { "x-sync-key": syncKey },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API error ${response.status}: ${text}`);
  }

  return response.json();
}

async function findUserByEmail(supabaseAdmin: any, email: string): Promise<string | null> {
  const perPage = 1000;
  for (let page = 1; page <= 25; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users || [];
    const found = users.find((u: any) => (u.email || "").toLowerCase() === email.toLowerCase());
    if (found?.id) return found.id;
    if (users.length < perPage) break;
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Authorization header required");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    const { data: isSuperAdmin } = await supabaseAdmin
      .from("super_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .single();

    if (!isSuperAdmin) throw new Error("Super admin access required");

    const body = await req.json();
    const { sourceApiUrl, syncKey, dryRun = false, phase } = body;

    if (!sourceApiUrl || !syncKey) {
      throw new Error("sourceApiUrl and syncKey are required");
    }

    const result: ImportResult = {
      success: true,
      tables: {},
      usersCreated: 0,
      usersSkipped: 0,
      userMapping: body.userMapping || {},
    };

    // Phase 1: Get summary and import users
    if (phase === "summary") {
      console.log("[import-from-api] Fetching summary...");
      const summary = await fetchFromSourceApi(sourceApiUrl, syncKey, "summary");
      return new Response(JSON.stringify({ success: true, summary }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Phase 2: Import auth users
    if (phase === "users") {
      console.log("[import-from-api] Importing users...");
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        const usersData = await fetchFromSourceApi(sourceApiUrl, syncKey, "auth_users", {
          page: String(page),
          limit: "1000",
        });

        const users = usersData.users || [];
        if (users.length === 0) {
          hasMore = false;
          break;
        }

        for (const u of users) {
          if (!u?.id || !u?.email) continue;

          if (dryRun) {
            result.userMapping![u.id] = crypto.randomUUID();
            result.usersCreated!++;
            continue;
          }

          try {
            const existingId = await findUserByEmail(supabaseAdmin, u.email);
            if (existingId) {
              result.userMapping![u.id] = existingId;
              result.usersSkipped!++;
              continue;
            }

            const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
              email: u.email,
              email_confirm: true,
              password: crypto.randomUUID(),
              user_metadata: u.user_metadata || {},
            });

            if (createError) throw createError;

            if (newUser?.user?.id) {
              result.userMapping![u.id] = newUser.user.id;
              result.usersCreated!++;
            }
          } catch (e) {
            console.error(`[import-from-api] Error creating user ${u.email}:`, e);
          }
        }

        page++;
        if (users.length < 1000) hasMore = false;
      }

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Phase 3: Import a specific table
    if (phase === "table") {
      const { tableName, userMapping } = body;
      if (!tableName) throw new Error("tableName required for table phase");

      console.log(`[import-from-api] Importing table: ${tableName}`);
      
      let page = 0;
      let hasMore = true;
      let totalImported = 0;
      let errors: string[] = [];

      while (hasMore) {
        const tableData = await fetchFromSourceApi(sourceApiUrl, syncKey, "export", {
          table: tableName,
          page: String(page),
          limit: "500",
        });

        const rows = tableData.data || [];
        if (rows.length === 0) {
          hasMore = false;
          break;
        }

        for (const row of rows) {
          if (dryRun) {
            totalImported++;
            continue;
          }

          try {
            // Remap user IDs if this table has user references
            const recordToInsert = USER_ID_TABLES.has(tableName)
              ? remapUserIds(row, userMapping || {})
              : row;

            const { error } = await supabaseAdmin.from(tableName).upsert(recordToInsert, {
              onConflict: "id",
              ignoreDuplicates: false,
            });

            if (error) {
              if (error.code !== "23505") {
                errors.push(`Row ${row.id}: ${error.message}`);
              }
            } else {
              totalImported++;
            }
          } catch (e) {
            errors.push(`Row ${row.id}: ${e instanceof Error ? e.message : String(e)}`);
          }
        }

        page++;
        if (rows.length < 500) hasMore = false;
      }

      result.tables![tableName] = {
        success: errors.length === 0,
        count: totalImported,
        error: errors.length > 0 ? errors.slice(0, 5).join("; ") : undefined,
      };

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Invalid phase. Use 'summary', 'users', or 'table'");
  } catch (error) {
    console.error("[import-from-api] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
