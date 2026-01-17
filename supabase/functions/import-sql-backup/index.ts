import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ImportResult {
  success: boolean;
  executed: number;
  errors: string[];
  skipped: number;
  details: {
    table: string;
    operation: string;
    status: "success" | "error" | "skipped";
    message?: string;
  }[];
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
      // Check for escaped quote
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
      // Skip to end of line
      while (i < sql.length && sql[i] !== "\n") {
        i++;
      }
      continue;
    }

    if (char === "/" && nextChar === "*") {
      // Skip block comment
      i += 2;
      while (i < sql.length - 1 && !(sql[i] === "*" && sql[i + 1] === "/")) {
        i++;
      }
      i++; // Skip the closing */
      continue;
    }

    // Statement terminator
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

  // Add last statement if exists
  const lastStmt = current.trim();
  if (lastStmt) {
    statements.push(lastStmt);
  }

  return statements;
}

// Extract table name from SQL statement
function extractTableName(sql: string): string {
  const insertMatch = sql.match(/INSERT\s+INTO\s+(?:public\.)?["']?(\w+)["']?/i);
  if (insertMatch) return insertMatch[1];

  const updateMatch = sql.match(/UPDATE\s+(?:public\.)?["']?(\w+)["']?/i);
  if (updateMatch) return updateMatch[1];

  const deleteMatch = sql.match(/DELETE\s+FROM\s+(?:public\.)?["']?(\w+)["']?/i);
  if (deleteMatch) return deleteMatch[1];

  return "unknown";
}

// Extract operation type
function extractOperation(sql: string): string {
  const upper = sql.toUpperCase().trim();
  if (upper.startsWith("INSERT")) return "INSERT";
  if (upper.startsWith("UPDATE")) return "UPDATE";
  if (upper.startsWith("DELETE")) return "DELETE";
  if (upper.startsWith("SET")) return "SET";
  if (upper.startsWith("CREATE")) return "CREATE";
  if (upper.startsWith("ALTER")) return "ALTER";
  if (upper.startsWith("DROP")) return "DROP";
  return "OTHER";
}

// Check if statement should be skipped
function shouldSkip(sql: string): boolean {
  const upper = sql.toUpperCase().trim();
  
  // Skip session/system commands
  if (upper.startsWith("SET SESSION_REPLICATION_ROLE")) return true;
  if (upper.startsWith("SET ")) return true;
  
  // Skip DDL that might conflict
  if (upper.startsWith("CREATE TABLE")) return true;
  if (upper.startsWith("CREATE INDEX")) return true;
  if (upper.startsWith("CREATE TRIGGER")) return true;
  if (upper.startsWith("CREATE FUNCTION")) return true;
  if (upper.startsWith("ALTER TABLE") && upper.includes("ENABLE ROW LEVEL SECURITY")) return true;
  if (upper.startsWith("CREATE POLICY")) return true;
  
  // Skip comments that somehow got through
  if (upper.startsWith("--")) return true;
  
  return false;
}

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

    const { sql, dryRun = false } = await req.json();

    if (!sql || typeof sql !== "string") {
      throw new Error("SQL content is required");
    }

    console.log(`[import-sql-backup] Starting import (dryRun: ${dryRun})...`);
    console.log(`[import-sql-backup] SQL length: ${sql.length} characters`);

    // Parse SQL statements
    const statements = parseSqlStatements(sql);
    console.log(`[import-sql-backup] Parsed ${statements.length} statements`);

    const result: ImportResult = {
      success: true,
      executed: 0,
      errors: [],
      skipped: 0,
      details: [],
    };

    // Process each statement
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      const tableName = extractTableName(stmt);
      const operation = extractOperation(stmt);

      // Skip certain statements
      if (shouldSkip(stmt)) {
        result.skipped++;
        result.details.push({
          table: tableName,
          operation,
          status: "skipped",
          message: "Statement type not supported for import",
        });
        continue;
      }

      // Only process DML statements
      if (!["INSERT", "UPDATE", "DELETE"].includes(operation)) {
        result.skipped++;
        result.details.push({
          table: tableName,
          operation,
          status: "skipped",
          message: `Operation ${operation} skipped`,
        });
        continue;
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
        // Execute via RPC or direct query
        const { error } = await supabaseAdmin.rpc("exec_sql", { query: stmt });
        
        if (error) {
          // Try direct approach if RPC doesn't exist
          // For now, we'll use a workaround with the REST API
          throw error;
        }

        result.executed++;
        result.details.push({
          table: tableName,
          operation,
          status: "success",
        });
      } catch (stmtError) {
        const errorMsg = stmtError instanceof Error ? stmtError.message : String(stmtError);
        
        // Some errors are acceptable
        if (errorMsg.includes("duplicate key") || errorMsg.includes("already exists")) {
          result.skipped++;
          result.details.push({
            table: tableName,
            operation,
            status: "skipped",
            message: "Record already exists",
          });
        } else {
          result.errors.push(`[${tableName}] ${errorMsg}`);
          result.details.push({
            table: tableName,
            operation,
            status: "error",
            message: errorMsg,
          });
        }
      }

      // Log progress every 100 statements
      if ((i + 1) % 100 === 0) {
        console.log(`[import-sql-backup] Processed ${i + 1}/${statements.length} statements`);
      }
    }

    result.success = result.errors.length === 0;

    console.log(`[import-sql-backup] Import complete: ${result.executed} executed, ${result.skipped} skipped, ${result.errors.length} errors`);

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
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
