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

interface AuthUser {
  id: string;
  email: string;
  encrypted_password?: string;
  raw_user_meta_data?: Record<string, unknown>;
  created_at?: string;
}

// Parse SQL into individual statements
function parseSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let inString = false;
  let stringChar = "";
  let inDollarQuote = false;
  let dollarTag = "";

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    const nextChar = sql[i + 1] || "";

    // Handle dollar-quoted strings (PostgreSQL)
    if (!inString && char === "$") {
      const match = sql.slice(i).match(/^\$([a-zA-Z0-9_]*)\$/);
      if (match) {
        if (!inDollarQuote) {
          inDollarQuote = true;
          dollarTag = match[0];
          current += match[0];
          i += match[0].length - 1;
          continue;
        } else if (sql.slice(i, i + dollarTag.length) === dollarTag) {
          inDollarQuote = false;
          current += dollarTag;
          i += dollarTag.length - 1;
          continue;
        }
      }
    }

    if (inDollarQuote) {
      current += char;
      continue;
    }

    // Handle regular strings
    if ((char === "'" || char === '"') && !inString) {
      inString = true;
      stringChar = char;
      current += char;
      continue;
    }

    if (char === stringChar && inString) {
      if (nextChar === stringChar) {
        current += char + nextChar;
        i++;
        continue;
      }
      inString = false;
      current += char;
      continue;
    }

    if (inString) {
      current += char;
      continue;
    }

    // Handle comments
    if (char === "-" && nextChar === "-") {
      while (i < sql.length && sql[i] !== "\n") {
        i++;
      }
      continue;
    }

    if (char === "/" && nextChar === "*") {
      i += 2;
      while (i < sql.length - 1 && !(sql[i] === "*" && sql[i + 1] === "/")) {
        i++;
      }
      i++;
      continue;
    }

    if (char === ";") {
      const stmt = current.trim();
      if (stmt) {
        statements.push(stmt);
      }
      current = "";
      continue;
    }

    current += char;
  }

  const lastStmt = current.trim();
  if (lastStmt) {
    statements.push(lastStmt);
  }

  return statements;
}

// Extract table name from SQL statement
function extractTableName(sql: string): string {
  const insertMatch = sql.match(/INSERT\s+INTO\s+(?:public\.|auth\.)?["']?(\w+)["']?/i);
  if (insertMatch) return insertMatch[1];

  const updateMatch = sql.match(/UPDATE\s+(?:public\.|auth\.)?["']?(\w+)["']?/i);
  if (updateMatch) return updateMatch[1];

  const deleteMatch = sql.match(/DELETE\s+FROM\s+(?:public\.|auth\.)?["']?(\w+)["']?/i);
  if (deleteMatch) return deleteMatch[1];

  return "unknown";
}

// Check if statement is for auth.users
function isAuthUsersStatement(sql: string): boolean {
  return /INSERT\s+INTO\s+auth\.users/i.test(sql);
}

// Parse auth.users INSERT statement to extract user data
function parseAuthUserInsert(sql: string): AuthUser | null {
  try {
    // Match INSERT INTO auth.users (columns) VALUES (values)
    const columnsMatch = sql.match(/INSERT\s+INTO\s+auth\.users\s*\(([^)]+)\)/i);
    const valuesMatch = sql.match(/VALUES\s*\((.+)\)$/is);

    if (!columnsMatch || !valuesMatch) return null;

    const columns = columnsMatch[1].split(",").map(c => c.trim().replace(/"/g, ""));
    const valuesStr = valuesMatch[1];

    // Parse values (handling quoted strings and NULLs)
    const values: string[] = [];
    let current = "";
    let inQuote = false;
    let depth = 0;

    for (let i = 0; i < valuesStr.length; i++) {
      const char = valuesStr[i];

      if (char === "'" && valuesStr[i - 1] !== "\\") {
        if (inQuote && valuesStr[i + 1] === "'") {
          current += "''";
          i++;
          continue;
        }
        inQuote = !inQuote;
        current += char;
        continue;
      }

      if (!inQuote) {
        if (char === "(") depth++;
        if (char === ")") depth--;
        if (char === "," && depth === 0) {
          values.push(current.trim());
          current = "";
          continue;
        }
      }

      current += char;
    }
    if (current.trim()) {
      values.push(current.trim());
    }

    // Build user object
    const user: AuthUser = { id: "", email: "" };

    columns.forEach((col, idx) => {
      let val = values[idx];
      if (!val || val.toUpperCase() === "NULL") return;

      // Remove quotes and type casts
      val = val.replace(/^'|'$/g, "").replace(/'''/g, "'").replace(/''/g, "'");
      val = val.replace(/::[\w\[\]]+/g, ""); // Remove type casts

      switch (col.toLowerCase()) {
        case "id":
          user.id = val.replace(/^'|'$/g, "");
          break;
        case "email":
          user.email = val.replace(/^'|'$/g, "");
          break;
        case "encrypted_password":
          user.encrypted_password = val.replace(/^'|'$/g, "");
          break;
        case "raw_user_meta_data":
          try {
            user.raw_user_meta_data = JSON.parse(val.replace(/^'|'$/g, ""));
          } catch {
            // Ignore parse errors
          }
          break;
      }
    });

    if (user.id && user.email) {
      return user;
    }
    return null;
  } catch (e) {
    console.error("[import-sql-backup] Error parsing auth user:", e);
    return null;
  }
}

// Replace old user IDs with new ones in SQL statement
function remapUserIds(sql: string, idMapping: Record<string, string>): string {
  let result = sql;
  for (const [oldId, newId] of Object.entries(idMapping)) {
    // Replace UUID in various formats
    const patterns = [
      new RegExp(`'${oldId}'`, "gi"),
      new RegExp(`"${oldId}"`, "gi"),
    ];
    for (const pattern of patterns) {
      result = result.replace(pattern, `'${newId}'`);
    }
  }
  return result;
}

// Check if statement should be skipped
function shouldSkip(sql: string): boolean {
  const upper = sql.toUpperCase().trim();

  if (upper.startsWith("SET SESSION_REPLICATION_ROLE")) return true;
  if (upper.startsWith("SET ")) return true;
  if (upper.startsWith("CREATE TABLE")) return true;
  if (upper.startsWith("CREATE INDEX")) return true;
  if (upper.startsWith("CREATE TRIGGER")) return true;
  if (upper.startsWith("CREATE FUNCTION")) return true;
  if (upper.startsWith("CREATE POLICY")) return true;
  if (upper.startsWith("ALTER TABLE") && upper.includes("ENABLE ROW LEVEL SECURITY")) return true;
  if (upper.startsWith("--")) return true;

  // Skip auth schema tables (except users which we handle specially)
  if (/INSERT\s+INTO\s+auth\.(identities|sessions|refresh_tokens|mfa|audit_log)/i.test(sql)) return true;

  return false;
}

// Tables that reference user_id
const USER_ID_TABLES = [
  "profiles",
  "user_roles",
  "super_admins",
  "professionals",
  "audit_logs",
  "attachment_access_logs",
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

    const { sql, dryRun = false, skipAuthTables = false } = await req.json();

    if (!sql || typeof sql !== "string") {
      throw new Error("SQL content is required");
    }

    console.log(`[import-sql-backup] Starting import (dryRun: ${dryRun}, skipAuthTables: ${skipAuthTables})...`);
    console.log(`[import-sql-backup] SQL length: ${sql.length} characters`);

    const statements = parseSqlStatements(sql);
    console.log(`[import-sql-backup] Parsed ${statements.length} statements`);

    const result: ImportResult = {
      success: true,
      executed: 0,
      errors: [],
      skipped: 0,
      details: [],
      userMapping: {},
      usersCreated: 0,
      usersSkipped: 0,
    };

    // PHASE 1: Extract and create auth users
    console.log("[import-sql-backup] Phase 1: Processing auth.users...");
    const authUserStatements = statements.filter(isAuthUsersStatement);
    console.log(`[import-sql-backup] Found ${authUserStatements.length} auth.users statements`);

    for (const stmt of authUserStatements) {
      const authUser = parseAuthUserInsert(stmt);
      if (!authUser) {
        result.details.push({
          table: "auth.users",
          operation: "INSERT",
          status: "skipped",
          message: "Could not parse user data",
        });
        result.skipped++;
        continue;
      }

      console.log(`[import-sql-backup] Processing user: ${authUser.email} (old ID: ${authUser.id})`);

      if (dryRun) {
        result.details.push({
          table: "auth.users",
          operation: "INSERT",
          status: "success",
          message: `Would create user ${authUser.email}`,
        });
        result.userMapping[authUser.id] = `new-id-for-${authUser.email}`;
        result.usersCreated++;
        continue;
      }

      try {
        // Check if user already exists
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = existingUsers?.users?.find(u => u.email === authUser.email);

        if (existingUser) {
          console.log(`[import-sql-backup] User ${authUser.email} already exists with ID ${existingUser.id}`);
          result.userMapping[authUser.id] = existingUser.id;
          result.usersSkipped++;
          result.details.push({
            table: "auth.users",
            operation: "INSERT",
            status: "skipped",
            message: `User ${authUser.email} already exists, mapped to ${existingUser.id}`,
          });
        } else {
          // Create new user
          const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email: authUser.email,
            email_confirm: true,
            password: crypto.randomUUID(), // Temporary password - user should reset
            user_metadata: authUser.raw_user_meta_data || {},
          });

          if (createError) {
            throw createError;
          }

          if (newUser?.user) {
            console.log(`[import-sql-backup] Created user ${authUser.email} with new ID ${newUser.user.id}`);
            result.userMapping[authUser.id] = newUser.user.id;
            result.usersCreated++;
            result.details.push({
              table: "auth.users",
              operation: "INSERT",
              status: "success",
              message: `Created ${authUser.email}: ${authUser.id} → ${newUser.user.id}`,
            });
          }
        }
      } catch (userError) {
        const errorMsg = userError instanceof Error ? userError.message : String(userError);
        console.error(`[import-sql-backup] Error creating user ${authUser.email}:`, errorMsg);
        result.errors.push(`[auth.users] ${authUser.email}: ${errorMsg}`);
        result.details.push({
          table: "auth.users",
          operation: "INSERT",
          status: "error",
          message: errorMsg,
        });
      }
    }

    console.log(`[import-sql-backup] User mapping: ${JSON.stringify(result.userMapping)}`);

    // PHASE 2: Process public schema statements with ID remapping
    console.log("[import-sql-backup] Phase 2: Processing public schema...");

    for (let i = 0; i < statements.length; i++) {
      let stmt = statements[i];
      const tableName = extractTableName(stmt);

      // Skip auth.users (already processed) and other auth tables
      if (isAuthUsersStatement(stmt)) continue;
      if (/INSERT\s+INTO\s+auth\./i.test(stmt)) {
        result.skipped++;
        result.details.push({
          table: tableName,
          operation: "INSERT",
          status: "skipped",
          message: "Auth schema table skipped",
        });
        continue;
      }

      if (shouldSkip(stmt)) {
        result.skipped++;
        continue;
      }

      // Skip user-related tables if requested
      if (skipAuthTables && USER_ID_TABLES.includes(tableName)) {
        result.skipped++;
        result.details.push({
          table: tableName,
          operation: "INSERT",
          status: "skipped",
          message: "User-related table skipped by option",
        });
        continue;
      }

      const operation = stmt.toUpperCase().trim().split(" ")[0];
      if (!["INSERT", "UPDATE", "DELETE"].includes(operation)) {
        result.skipped++;
        continue;
      }

      // Remap user IDs if this table references users
      if (USER_ID_TABLES.includes(tableName) && Object.keys(result.userMapping).length > 0) {
        stmt = remapUserIds(stmt, result.userMapping);
      }

      if (dryRun) {
        result.details.push({
          table: tableName,
          operation,
          status: "success",
          message: "Would execute (dry run)",
        });
        result.executed++;
        continue;
      }

      try {
        // Execute via raw SQL - we need to use a different approach
        // Since we can't use RPC for raw SQL, we'll parse and use the client

        // For now, we'll handle the most common case: INSERT
        if (operation === "INSERT") {
          // Parse the INSERT statement to extract data
          const tableMatch = stmt.match(/INSERT\s+INTO\s+(?:public\.)?["']?(\w+)["']?\s*\(([^)]+)\)\s*VALUES\s*\((.+)\)$/is);

          if (tableMatch) {
            const table = tableMatch[1];
            const columns = tableMatch[2].split(",").map(c => c.trim().replace(/"/g, ""));
            const valuesStr = tableMatch[3];

            // Parse values
            const values: (string | number | boolean | null | object)[] = [];
            let current = "";
            let inQuote = false;
            let depth = 0;

            for (let j = 0; j < valuesStr.length; j++) {
              const char = valuesStr[j];

              if (char === "'" && valuesStr[j - 1] !== "\\") {
                if (inQuote && valuesStr[j + 1] === "'") {
                  current += "'";
                  j++;
                  continue;
                }
                inQuote = !inQuote;
                current += char;
                continue;
              }

              if (!inQuote) {
                if (char === "(") depth++;
                if (char === ")") depth--;
                if (char === "," && depth === 0) {
                  values.push(parseValue(current.trim()));
                  current = "";
                  continue;
                }
              }

              current += char;
            }
            if (current.trim()) {
              values.push(parseValue(current.trim()));
            }

            // Build object
            const record: Record<string, unknown> = {};
            columns.forEach((col, idx) => {
              record[col] = values[idx];
            });

            const { error } = await supabaseAdmin.from(table).insert(record);

            if (error) {
              if (error.message.includes("duplicate key") || error.code === "23505") {
                result.skipped++;
                result.details.push({
                  table: tableName,
                  operation,
                  status: "skipped",
                  message: "Record already exists",
                });
              } else {
                throw error;
              }
            } else {
              result.executed++;
              result.details.push({
                table: tableName,
                operation,
                status: "success",
              });
            }
          } else {
            result.skipped++;
            result.details.push({
              table: tableName,
              operation,
              status: "skipped",
              message: "Could not parse INSERT statement",
            });
          }
        } else if (operation === "DELETE") {
          // Handle DELETE FROM table (without WHERE = delete all)
          const deleteMatch = stmt.match(/DELETE\s+FROM\s+(?:public\.)?["']?(\w+)["']?/i);
          if (deleteMatch) {
            const table = deleteMatch[1];
            // Check if there's a WHERE clause
            if (!/WHERE/i.test(stmt)) {
              // Delete all from table
              const { error } = await supabaseAdmin.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
              if (error && !error.message.includes("no rows")) {
                throw error;
              }
              result.executed++;
              result.details.push({
                table: tableName,
                operation,
                status: "success",
                message: "Cleared table",
              });
            } else {
              result.skipped++;
              result.details.push({
                table: tableName,
                operation,
                status: "skipped",
                message: "DELETE with WHERE not supported",
              });
            }
          }
        } else {
          result.skipped++;
          result.details.push({
            table: tableName,
            operation,
            status: "skipped",
            message: `${operation} not yet supported`,
          });
        }
      } catch (stmtError) {
        const errorMsg = stmtError instanceof Error ? stmtError.message : String(stmtError);
        result.errors.push(`[${tableName}] ${errorMsg}`);
        result.details.push({
          table: tableName,
          operation,
          status: "error",
          message: errorMsg,
        });
      }

      if ((i + 1) % 100 === 0) {
        console.log(`[import-sql-backup] Processed ${i + 1}/${statements.length} statements`);
      }
    }

    result.success = result.errors.length === 0;

    console.log(`[import-sql-backup] Import complete: ${result.executed} executed, ${result.skipped} skipped, ${result.errors.length} errors`);
    console.log(`[import-sql-backup] Users: ${result.usersCreated} created, ${result.usersSkipped} skipped`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[import-sql-backup] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        executed: 0,
        errors: [error instanceof Error ? error.message : "Unknown error"],
        skipped: 0,
        details: [],
        userMapping: {},
        usersCreated: 0,
        usersSkipped: 0,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Helper to parse SQL value to JS type
function parseValue(val: string): string | number | boolean | null | object {
  if (val.toUpperCase() === "NULL") return null;
  if (val.toUpperCase() === "TRUE") return true;
  if (val.toUpperCase() === "FALSE") return false;

  // Remove type casts
  val = val.replace(/::[\w\[\]]+/g, "");

  // String value
  if (val.startsWith("'") && val.endsWith("'")) {
    return val.slice(1, -1).replace(/''/g, "'");
  }

  // JSONB
  if (val.startsWith("'{") || val.startsWith("'[")) {
    try {
      return JSON.parse(val.slice(1, -1).replace(/''/g, "'"));
    } catch {
      return val.slice(1, -1);
    }
  }

  // Number
  const num = parseFloat(val);
  if (!isNaN(num)) return num;

  return val;
}
