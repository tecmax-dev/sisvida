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
  raw_user_meta_data?: Record<string, unknown>;
}

// Stream-based SQL parser - processes line by line to save memory
function* parseStatementsStreaming(sql: string): Generator<string> {
  let current = "";
  let inString = false;
  let stringChar = "";
  let inDollarQuote = false;
  let dollarTag = "";
  let lineStart = 0;

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    const nextChar = sql[i + 1] || "";

    // Handle dollar-quoted strings
    if (!inString && char === "$") {
      const remaining = sql.slice(i, Math.min(i + 50, sql.length));
      const match = remaining.match(/^\$([a-zA-Z0-9_]*)\$/);
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

    // Skip single-line comments
    if (char === "-" && nextChar === "-") {
      while (i < sql.length && sql[i] !== "\n") i++;
      continue;
    }

    // Skip multi-line comments
    if (char === "/" && nextChar === "*") {
      i += 2;
      while (i < sql.length - 1 && !(sql[i] === "*" && sql[i + 1] === "/")) i++;
      i++;
      continue;
    }

    if (char === ";") {
      const stmt = current.trim();
      if (stmt) {
        yield stmt;
      }
      current = "";
      lineStart = i + 1;
      continue;
    }

    current += char;
  }

  const lastStmt = current.trim();
  if (lastStmt) {
    yield lastStmt;
  }
}

// Quick scan to find auth.users statements and count without full parsing
function quickScanAuthUsers(sql: string): { count: number; emails: string[] } {
  const result = { count: 0, emails: [] as string[] };
  const regex = /INSERT\s+INTO\s+auth\.users[^;]+;/gi;
  let match;
  
  while ((match = regex.exec(sql)) !== null) {
    result.count++;
    const emailMatch = match[0].match(/'([^']+@[^']+)'/);
    if (emailMatch && result.emails.length < 10) {
      result.emails.push(emailMatch[1]);
    }
  }
  
  return result;
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

function isAuthUsersStatement(sql: string): boolean {
  return /INSERT\s+INTO\s+auth\.users/i.test(sql);
}

// Lightweight auth user parser
function parseAuthUserInsert(sql: string): AuthUser | null {
  try {
    const columnsMatch = sql.match(/INSERT\s+INTO\s+auth\.users\s*\(([^)]+)\)/i);
    const valuesMatch = sql.match(/VALUES\s*\((.+)\)$/is);

    if (!columnsMatch || !valuesMatch) return null;

    const columns = columnsMatch[1].split(",").map(c => c.trim().replace(/"/g, "").toLowerCase());
    const valuesStr = valuesMatch[1];

    // Simple value extraction
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
    if (current.trim()) values.push(current.trim());

    const user: AuthUser = { id: "", email: "" };
    const idIdx = columns.indexOf("id");
    const emailIdx = columns.indexOf("email");

    if (idIdx >= 0 && values[idIdx]) {
      user.id = values[idIdx].replace(/^'|'$/g, "").replace(/::[\w\[\]]+/g, "");
    }
    if (emailIdx >= 0 && values[emailIdx]) {
      user.email = values[emailIdx].replace(/^'|'$/g, "").replace(/::[\w\[\]]+/g, "");
    }

    if (user.id && user.email) return user;
    return null;
  } catch {
    return null;
  }
}

function remapUserIds(sql: string, idMapping: Record<string, string>): string {
  let result = sql;
  for (const [oldId, newId] of Object.entries(idMapping)) {
    result = result.replace(new RegExp(`'${oldId}'`, "gi"), `'${newId}'`);
  }
  return result;
}

function shouldSkip(sql: string): boolean {
  const upper = sql.substring(0, 50).toUpperCase().trim();

  if (upper.startsWith("SET ")) return true;
  if (upper.startsWith("CREATE ")) return true;
  if (upper.startsWith("ALTER ")) return true;
  if (upper.startsWith("DROP ")) return true;
  if (upper.startsWith("--")) return true;
  if (upper.startsWith("COMMENT ")) return true;
  if (upper.startsWith("GRANT ")) return true;
  if (upper.startsWith("REVOKE ")) return true;

  // Skip other auth schema tables
  if (/INSERT\s+INTO\s+auth\.(identities|sessions|refresh_tokens|mfa|audit_log)/i.test(sql)) return true;

  return false;
}

const USER_ID_TABLES = ["profiles", "user_roles", "super_admins", "professionals", "audit_logs", "attachment_access_logs"];

// Helper to parse SQL value to JS type
function parseValue(val: string): string | number | boolean | null | object {
  if (!val || val.toUpperCase() === "NULL") return null;
  if (val.toUpperCase() === "TRUE") return true;
  if (val.toUpperCase() === "FALSE") return false;

  val = val.replace(/::[\w\[\]]+/g, "");

  if (val.startsWith("'") && val.endsWith("'")) {
    const inner = val.slice(1, -1).replace(/''/g, "'");
    // Check if it's JSON
    if ((inner.startsWith("{") || inner.startsWith("[")) && (inner.endsWith("}") || inner.endsWith("]"))) {
      try {
        return JSON.parse(inner);
      } catch {
        return inner;
      }
    }
    return inner;
  }

  const num = parseFloat(val);
  if (!isNaN(num) && val.match(/^-?\d+\.?\d*$/)) return num;

  return val;
}

// Parse INSERT and build record
function parseInsertToRecord(sql: string): { table: string; record: Record<string, unknown> } | null {
  const match = sql.match(/INSERT\s+INTO\s+(?:public\.)?["']?(\w+)["']?\s*\(([^)]+)\)\s*VALUES\s*\((.+)\)$/is);
  if (!match) return null;

  const table = match[1];
  const columns = match[2].split(",").map(c => c.trim().replace(/"/g, ""));
  const valuesStr = match[3];

  const values: (string | number | boolean | null | object)[] = [];
  let current = "";
  let inQuote = false;
  let depth = 0;

  for (let i = 0; i < valuesStr.length; i++) {
    const char = valuesStr[i];

    if (char === "'" && valuesStr[i - 1] !== "\\") {
      if (inQuote && valuesStr[i + 1] === "'") {
        current += "'";
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
        values.push(parseValue(current.trim()));
        current = "";
        continue;
      }
    }

    current += char;
  }
  if (current.trim()) values.push(parseValue(current.trim()));

  const record: Record<string, unknown> = {};
  columns.forEach((col, idx) => {
    record[col] = values[idx];
  });

  return { table, record };
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

    const { sql, dryRun = false, skipAuthTables = false } = await req.json();

    if (!sql || typeof sql !== "string") throw new Error("SQL content is required");

    console.log(`[import-sql-backup] Starting import (dryRun: ${dryRun}, skipAuthTables: ${skipAuthTables})...`);
    console.log(`[import-sql-backup] SQL length: ${sql.length} characters`);

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

    // Quick scan for auth users first
    const authScan = quickScanAuthUsers(sql);
    console.log(`[import-sql-backup] Quick scan found ${authScan.count} auth.users statements`);

    // PHASE 1: Process auth.users first (collect all)
    console.log("[import-sql-backup] Phase 1: Processing auth.users...");
    
    // Cache existing users once
    let existingUsersMap: Map<string, string> = new Map();
    if (!dryRun && authScan.count > 0) {
      try {
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
        if (existingUsers?.users) {
          existingUsers.users.forEach(u => {
            if (u.email) existingUsersMap.set(u.email.toLowerCase(), u.id);
          });
        }
        console.log(`[import-sql-backup] Cached ${existingUsersMap.size} existing users`);
      } catch (e) {
        console.error("[import-sql-backup] Error loading existing users:", e);
      }
    }

    // Process statements using streaming parser
    let processedCount = 0;
    const MAX_DETAILS = 200; // Limit details array size

    for (const stmt of parseStatementsStreaming(sql)) {
      processedCount++;
      
      if (processedCount % 500 === 0) {
        console.log(`[import-sql-backup] Processed ${processedCount} statements...`);
      }

      // Handle auth.users
      if (isAuthUsersStatement(stmt)) {
        const authUser = parseAuthUserInsert(stmt);
        if (!authUser) {
          result.skipped++;
          continue;
        }

        if (dryRun) {
          result.userMapping[authUser.id] = `new-id-for-${authUser.email}`;
          result.usersCreated++;
          if (result.details.length < MAX_DETAILS) {
            result.details.push({
              table: "auth.users",
              operation: "INSERT",
              status: "success",
              message: `Would create ${authUser.email}`,
            });
          }
          continue;
        }

        try {
          const existingId = existingUsersMap.get(authUser.email.toLowerCase());
          
          if (existingId) {
            result.userMapping[authUser.id] = existingId;
            result.usersSkipped++;
            if (result.details.length < MAX_DETAILS) {
              result.details.push({
                table: "auth.users",
                operation: "INSERT",
                status: "skipped",
                message: `User ${authUser.email} exists`,
              });
            }
          } else {
            const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
              email: authUser.email,
              email_confirm: true,
              password: crypto.randomUUID(),
              user_metadata: authUser.raw_user_meta_data || {},
            });

            if (createError) throw createError;

            if (newUser?.user) {
              result.userMapping[authUser.id] = newUser.user.id;
              existingUsersMap.set(authUser.email.toLowerCase(), newUser.user.id);
              result.usersCreated++;
              if (result.details.length < MAX_DETAILS) {
                result.details.push({
                  table: "auth.users",
                  operation: "INSERT",
                  status: "success",
                  message: `Created ${authUser.email}`,
                });
              }
            }
          }
        } catch (userError) {
          const errorMsg = userError instanceof Error ? userError.message : String(userError);
          result.errors.push(`[auth.users] ${authUser.email}: ${errorMsg}`);
        }
        continue;
      }

      // Skip other auth tables
      if (/INSERT\s+INTO\s+auth\./i.test(stmt)) {
        result.skipped++;
        continue;
      }

      if (shouldSkip(stmt)) {
        result.skipped++;
        continue;
      }

      const tableName = extractTableName(stmt);
      const upper = stmt.substring(0, 10).toUpperCase().trim();

      // Skip user-related tables if requested
      if (skipAuthTables && USER_ID_TABLES.includes(tableName)) {
        result.skipped++;
        continue;
      }

      if (!upper.startsWith("INSERT") && !upper.startsWith("DELETE")) {
        result.skipped++;
        continue;
      }

      // Remap user IDs
      let processedStmt = stmt;
      if (USER_ID_TABLES.includes(tableName) && Object.keys(result.userMapping).length > 0) {
        processedStmt = remapUserIds(stmt, result.userMapping);
      }

      if (dryRun) {
        result.executed++;
        if (result.details.length < MAX_DETAILS) {
          result.details.push({
            table: tableName,
            operation: upper.startsWith("INSERT") ? "INSERT" : "DELETE",
            status: "success",
            message: "Would execute",
          });
        }
        continue;
      }

      // Execute INSERT
      if (upper.startsWith("INSERT")) {
        const parsed = parseInsertToRecord(processedStmt);
        if (parsed) {
          const { error } = await supabaseAdmin.from(parsed.table).insert(parsed.record);
          
          if (error) {
            if (error.message.includes("duplicate key") || error.code === "23505") {
              result.skipped++;
            } else {
              if (result.errors.length < 50) {
                result.errors.push(`[${tableName}] ${error.message}`);
              }
            }
          } else {
            result.executed++;
          }
        } else {
          result.skipped++;
        }
        continue;
      }

      // Handle DELETE
      if (upper.startsWith("DELETE")) {
        const deleteMatch = stmt.match(/DELETE\s+FROM\s+(?:public\.)?["']?(\w+)["']?/i);
        if (deleteMatch && !/WHERE/i.test(stmt)) {
          const table = deleteMatch[1];
          const { error } = await supabaseAdmin.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000");
          if (!error || error.message.includes("no rows")) {
            result.executed++;
          }
        } else {
          result.skipped++;
        }
      }
    }

    result.success = result.errors.length === 0;

    console.log(`[import-sql-backup] Complete: ${result.executed} executed, ${result.skipped} skipped, ${result.errors.length} errors`);
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
