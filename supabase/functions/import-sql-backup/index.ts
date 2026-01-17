import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ImportDetail {
  table: string;
  operation: string;
  status: "success" | "error" | "skipped";
  message?: string;
}

interface ImportResult {
  success: boolean;
  executed: number;
  errors: string[];
  skipped: number;
  details: ImportDetail[];
  userMapping: Record<string, string>;
  usersCreated: number;
  usersSkipped: number;
}

interface AuthUserPayload {
  id: string;
  email: string;
  raw_user_meta_data?: Record<string, unknown>;
}

type OperationPayload =
  | { operation: "INSERT"; table: string; record: Record<string, unknown> }
  | { operation: "DELETE_ALL"; table: string };

const USER_ID_TABLES = new Set([
  "profiles",
  "user_roles",
  "super_admins",
  "professionals",
  "audit_logs",
  "attachment_access_logs",
]);

function limitDetails(details: ImportDetail[], max = 200) {
  return details.length > max ? details.slice(0, max) : details;
}

function remapRecord(record: Record<string, unknown>, mapping: Record<string, string>) {
  if (!mapping || Object.keys(mapping).length === 0) return record;
  const out: Record<string, unknown> = { ...record };
  for (const [k, v] of Object.entries(out)) {
    if (typeof v === "string" && mapping[v]) {
      out[k] = mapping[v];
    }
  }
  return out;
}

async function findUserIdByEmail(supabaseAdmin: any, email: string): Promise<string | null> {
  const perPage = 1000;
  const maxPages = 25; // up to 25k

  for (let page = 1; page <= maxPages; page++) {
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
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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

    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    const { data: isSuperAdmin } = await supabaseAdmin
      .from("super_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .single();

    if (!isSuperAdmin) throw new Error("Super admin access required");

    const body = await req.json();

    // We intentionally do NOT support sending giant SQL strings to this function.
    if (typeof body?.sql === "string" && body.sql.length > 1_000_000) {
      throw new Error(
        "Arquivo SQL muito grande para enviar de uma vez. Recarregue a página e tente novamente (importação em lote)."
      );
    }

    const dryRun = Boolean(body?.dryRun);
    const skipAuthTables = Boolean(body?.skipAuthTables);
    const phase = (body?.phase as "users" | "data" | undefined) ?? undefined;

    const result: ImportResult = {
      success: true,
      executed: 0,
      errors: [],
      skipped: 0,
      details: [],
      userMapping: body?.userMapping && typeof body.userMapping === "object" ? body.userMapping : {},
      usersCreated: 0,
      usersSkipped: 0,
    };

    if (phase === "users") {
      const users = (body?.users as AuthUserPayload[]) || [];
      if (!Array.isArray(users)) throw new Error("Invalid users payload");

      for (const u of users) {
        if (!u?.id || !u?.email) {
          result.skipped++;
          continue;
        }

        if (dryRun) {
          result.userMapping[u.id] = crypto.randomUUID();
          result.usersCreated++;
          if (result.details.length < 200) {
            result.details.push({
              table: "auth.users",
              operation: "INSERT",
              status: "success",
              message: `Would create ${u.email}`,
            });
          }
          continue;
        }

        try {
          const existingId = await findUserIdByEmail(supabaseAdmin, u.email);
          if (existingId) {
            result.userMapping[u.id] = existingId;
            result.usersSkipped++;
            if (result.details.length < 200) {
              result.details.push({
                table: "auth.users",
                operation: "INSERT",
                status: "skipped",
                message: `User ${u.email} already exists`,
              });
            }
            continue;
          }

          const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email: u.email,
            email_confirm: true,
            password: crypto.randomUUID(),
            user_metadata: u.raw_user_meta_data || {},
          });

          if (createError) throw createError;

          if (newUser?.user?.id) {
            result.userMapping[u.id] = newUser.user.id;
            result.usersCreated++;
            if (result.details.length < 200) {
              result.details.push({
                table: "auth.users",
                operation: "INSERT",
                status: "success",
                message: `Created ${u.email}`,
              });
            }
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          result.errors.push(`[auth.users] ${u.email}: ${msg}`);
          if (result.details.length < 200) {
            result.details.push({
              table: "auth.users",
              operation: "INSERT",
              status: "error",
              message: msg,
            });
          }
        }
      }

      result.details = limitDetails(result.details);
      result.success = result.errors.length === 0;

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (phase === "data") {
      const operations = (body?.operations as OperationPayload[]) || [];
      if (!Array.isArray(operations)) throw new Error("Invalid operations payload");

      for (const op of operations) {
        if (op.operation === "DELETE_ALL") {
          if (skipAuthTables && USER_ID_TABLES.has(op.table)) {
            result.skipped++;
            continue;
          }

          if (dryRun) {
            result.executed++;
            if (result.details.length < 200) {
              result.details.push({ table: op.table, operation: "DELETE", status: "success", message: "Would clear table" });
            }
            continue;
          }

          const { error } = await supabaseAdmin
            .from(op.table)
            .delete()
            .neq("id", "00000000-0000-0000-0000-000000000000");

          if (error && !String(error.message || "").includes("no rows")) {
            result.errors.push(`[${op.table}] ${error.message}`);
            if (result.details.length < 200) {
              result.details.push({ table: op.table, operation: "DELETE", status: "error", message: error.message });
            }
          } else {
            result.executed++;
            if (result.details.length < 200) {
              result.details.push({ table: op.table, operation: "DELETE", status: "success", message: "Cleared table" });
            }
          }

          continue;
        }

        // INSERT
        if (skipAuthTables && USER_ID_TABLES.has(op.table)) {
          result.skipped++;
          continue;
        }

        const recordToInsert = USER_ID_TABLES.has(op.table)
          ? remapRecord(op.record, result.userMapping)
          : op.record;

        if (dryRun) {
          result.executed++;
          if (result.details.length < 200) {
            result.details.push({ table: op.table, operation: "INSERT", status: "success", message: "Would insert" });
          }
          continue;
        }

        const { error } = await supabaseAdmin.from(op.table).insert(recordToInsert);

        if (error) {
          if (error.code === "23505" || String(error.message || "").includes("duplicate key")) {
            result.skipped++;
            if (result.details.length < 200) {
              result.details.push({ table: op.table, operation: "INSERT", status: "skipped", message: "Record already exists" });
            }
          } else {
            result.errors.push(`[${op.table}] ${error.message}`);
            if (result.details.length < 200) {
              result.details.push({ table: op.table, operation: "INSERT", status: "error", message: error.message });
            }
          }
        } else {
          result.executed++;
          if (result.details.length < 200) {
            result.details.push({ table: op.table, operation: "INSERT", status: "success" });
          }
        }
      }

      result.details = limitDetails(result.details);
      result.success = result.errors.length === 0;

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Payload inválido. Envie phase='users' ou phase='data'.");
  } catch (error) {
    console.error("[import-sql-backup] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        executed: 0,
        skipped: 0,
        errors: [error instanceof Error ? error.message : "Unknown error"],
        details: [],
        userMapping: {},
        usersCreated: 0,
        usersSkipped: 0,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
