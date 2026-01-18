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
  idMapping?: Record<string, string>; // Global ID mapping for all entities
  page?: number;
  nextPage?: number;
  hasMore?: boolean;
}

const USER_ID_TABLES = new Set([
  "profiles",
  "user_roles",
  "super_admins",
  "professionals",
  "audit_logs",
  "attachment_access_logs",
]);

// Tables with foreign keys that need ID remapping (source ID -> destination ID)
// Format: table_name -> array of FK column names that need remapping
const FK_REMAP_TABLES: Record<string, string[]> = {
  // User-related tables (remap user_id)
  "profiles": ["user_id"],
  "user_roles": ["user_id"],
  "super_admins": ["user_id"],
  "professionals": ["clinic_id", "user_id"],
  "audit_logs": ["user_id"],
  "attachment_access_logs": ["user_id"],
  
  // Union entity related tables
  "union_entities": ["clinic_id", "plan_id", "user_id", "created_by"],
  "employers": ["clinic_id", "union_entity_id", "category_id"],
  "accounting_offices": ["clinic_id", "union_entity_id"],
  "patients": ["clinic_id"],
  
  // Relationship/junction tables
  "accounting_office_employers": ["accounting_office_id", "employer_id"],
  "patient_employers": ["patient_id", "employer_id"],
  "professional_procedures": ["professional_id", "procedure_id"],
  
  // Transactions with multiple FKs
  "appointments": ["clinic_id", "patient_id", "professional_id", "procedure_id"],
  "employer_contributions": ["employer_id", "clinic_id", "union_entity_id"],
  "financial_transactions": ["clinic_id", "category_id", "cash_register_id"],
};

// Tables that should be imported in order (dependencies first)
const TABLE_ORDER = [
  "clinics",
  "profiles",
  "user_roles",
  "super_admins",
  "insurance_plans",
  "procedures",
  "professionals",
  "patients",
  "employers",
  "accounting_offices",
  "accounting_office_employers", // After employers and accounting_offices
  "patient_dependents",
  "appointments",
  // ... other tables will be imported after these
];

function extractTableNames(payload: any): string[] {
  if (!payload) return [];

  // Common shapes:
  // - ["table1", "table2"]
  // - [{ table: "table1", count: 10 }]
  // - { tables: [...] }
  // - { data: [...] }
  // - { data: { tables: [...] } }
  const candidates = [
    // Prefer explicit table lists first
    payload?.tables,
    payload?.data?.tables,
    payload?.data,
    payload?.summary,
    // Fallback to the full payload last
    payload,
  ].filter(Boolean);

  for (const c of candidates) {
    if (Array.isArray(c)) {
      if (c.length === 0) return [];

      if (typeof c[0] === "string") {
        return c.filter((x) => typeof x === "string" && x.trim().length > 0).map((x) => x.trim());
      }

      if (typeof c[0] === "object") {
        const names = c
          .map((x) => (x?.table ?? x?.name ?? x?.tablename ?? x?.table_name))
          .filter((x) => typeof x === "string" && x.trim().length > 0)
          .map((x) => x.trim());
        if (names.length > 0) return names;
      }
    }

    // Some APIs return a dictionary of table->count (avoid metadata objects like { success, tables, total })
    if (c && typeof c === "object" && !Array.isArray(c)) {
      const keys = Object.keys(c).filter((k) => typeof k === "string" && k.trim().length > 0);
      const lowerKeys = keys.map((k) => k.toLowerCase());
      const metaKeys = new Set(["success", "total", "tables", "message", "error", "timestamp", "count"]);
      if (lowerKeys.some((k) => metaKeys.has(k))) continue;

      const numericLike = keys.filter((k) => typeof (c as any)[k] === "number");
      if (numericLike.length > 0 && numericLike.length / keys.length >= 0.8) return keys;
    }
  }

  return [];
}

// Remap foreign key IDs based on FK_REMAP_TABLES config and global ID mapping
// If a FK points to a source ID that we *don't* have mapped, we null it out to avoid FK violations.
function remapForeignKeys(
  record: Record<string, unknown>,
  tableName: string,
  idMapping: Record<string, string>,
  logRemaps = false
): Record<string, unknown> {
  if (!idMapping || Object.keys(idMapping).length === 0) return record;

  const fkColumns = FK_REMAP_TABLES[tableName];
  if (!fkColumns || fkColumns.length === 0) {
    // Fallback: try to remap any UUID that matches our mapping
    const out: Record<string, unknown> = { ...record };
    for (const [k, v] of Object.entries(out)) {
      if (typeof v === "string" && idMapping[v]) {
        out[k] = idMapping[v];
      }
    }
    return out;
  }

  const out: Record<string, unknown> = { ...record };
  for (const fkCol of fkColumns) {
    const oldId = out[fkCol];
    if (typeof oldId !== "string" || oldId.length === 0) continue;

    if (idMapping[oldId]) {
      if (logRemaps) {
        console.log(`[import-from-api] Remapping ${tableName}.${fkCol}: ${oldId} -> ${idMapping[oldId]}`);
      }
      out[fkCol] = idMapping[oldId];
      continue;
    }

    // If we know this column is a FK, but we don't have a mapping, it's safer to null it.
    // This commonly happens with audit columns like created_by from users that weren't migrated.
    out[fkCol] = null;
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

    // Phase 1: Get available tables from source API
    if (phase === "summary") {
      console.log("[import-from-api] Fetching tables list...");
      const raw = await fetchFromSourceApi(sourceApiUrl, syncKey, "tables");
      const tableNames = extractTableNames(raw);

      console.log(`[import-from-api] Source tables discovered: ${tableNames.length}`);
      if (tableNames.length > 0) {
        console.log("[import-from-api] First tables:", tableNames.slice(0, 10));
      } else {
        console.log("[import-from-api] Raw tables payload preview:", JSON.stringify(raw)?.slice(0, 800));
      }

      return new Response(JSON.stringify({ success: true, summary: tableNames }), {
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
      const {
        tableName,
        userMapping,
        idMapping: existingIdMapping,
        page: requestedPage,
        limit: requestedLimit,
        maxPages,
      } = body;
      if (!tableName) throw new Error("tableName required for table phase");

      const startPage = Number.isFinite(Number(requestedPage)) ? Math.max(0, Number(requestedPage)) : 0;
      const limit = Number.isFinite(Number(requestedLimit)) ? Math.max(1, Number(requestedLimit)) : 500;
      const pagesToProcess = Number.isFinite(Number(maxPages)) ? Math.min(5, Math.max(1, Number(maxPages))) : 1;

      console.log(
        `[import-from-api] Importing table: ${tableName} (page ${startPage}, limit ${limit}, maxPages ${pagesToProcess})`
      );

      // Merge userMapping into idMapping for unified FK remapping
      const idMapping: Record<string, string> = {
        ...(existingIdMapping || {}),
        ...(userMapping || {}),
      };

      let page = startPage;
      let processedPages = 0;
      let totalImported = 0;
      let hasMore = true;
      const errors: string[] = [];

      // Only store *non-identity* mappings to avoid huge in-memory maps.
      const newIdMappings: Record<string, string> = {};

      const stripMissingColumn = (message: string): string | null => {
        // Examples:
        // - Could not find the 'logo_url' column of 'union_entities' in the schema cache
        // - column "foo" of relation "bar" does not exist
        const m1 = message.match(/Could not find the '([^']+)' column/i);
        if (m1?.[1]) return m1[1];
        const m2 = message.match(/column\s+"([^"]+)"\s+of\s+relation/i);
        if (m2?.[1]) return m2[1];
        return null;
      };

      // Check if error is a FK constraint violation - we skip batch retry for these
      const isFkError = (message: string): boolean => {
        return /violates foreign key constraint/i.test(message);
      };

      const upsertWithSchemaRetry = async (records: Record<string, unknown>[]) => {
        let attempt = 0;
        let current = records;

        while (attempt < 6) {
          const { error } = await supabaseAdmin
            .from(tableName)
            .upsert(current, { onConflict: "id", ignoreDuplicates: false });

          if (!error) return { ok: true as const, records: current };

          // FK errors should go to row-by-row fallback immediately
          if (isFkError(error.message || "")) {
            return { ok: false as const, error, records: current };
          }

          const missingCol = stripMissingColumn(error.message || "");
          if (missingCol) {
            console.warn(`[import-from-api] ${tableName}: removing missing column '${missingCol}' and retrying`);
            current = current.map((r) => {
              const out = { ...r } as Record<string, unknown>;
              delete out[missingCol];
              return out;
            });
            attempt++;
            continue;
          }

          return { ok: false as const, error, records: current };
        }

        return { ok: false as const, error: { message: "Too many schema-retry attempts" }, records: current };
      };

      while (processedPages < pagesToProcess && hasMore) {
        const tableData = await fetchFromSourceApi(sourceApiUrl, syncKey, "export", {
          table: tableName,
          page: String(page),
          limit: String(limit),
        });

        const rows = tableData.data || [];
        if (rows.length === 0) {
          hasMore = false;
          break;
        }

        console.log(`[import-from-api] Processing ${rows.length} rows for ${tableName} (page ${page})`);

        if (dryRun) {
          for (const row of rows) {
            if (row?.id) newIdMappings[row.id] = crypto.randomUUID();
          }
          totalImported += rows.length;
          processedPages++;
          page++;
          hasMore = rows.length === limit;
          continue;
        }

        const recordsToInsert: Record<string, unknown>[] = [];
        const sourceIds: string[] = [];

        for (const row of rows) {
          const sourceId = row?.id;
          const recordToInsert = remapForeignKeys(row, tableName, idMapping, false);
          recordsToInsert.push(recordToInsert);
          if (typeof sourceId === "string") sourceIds.push(sourceId);
        }

        // Fast path: batch upsert, with auto-removal of missing columns
        const batch = await upsertWithSchemaRetry(recordsToInsert);

        if (!batch.ok) {
          const errMsg = batch.error?.message || "Unknown upsert error";
          errors.push(`Batch error: ${errMsg}`);

          // Use the cleaned records from batch retry (columns may have been removed)
          const cleanedRecords = batch.records || recordsToInsert;

          // Fallback: try row-by-row to salvage what we can and surface precise errors.
          // Row-level resilience:
          // - Strip missing columns (schema cache mismatch)
          // - For union_entities, if created_by references a user that doesn't exist in destination auth, null it
          const upsertOneWithRowRetry = async (rec: Record<string, unknown>) => {
            let attempt = 0;
            let current = { ...rec } as Record<string, unknown>;

            while (attempt < 4) {
              const { error } = await supabaseAdmin
                .from(tableName)
                .upsert(current, { onConflict: "id", ignoreDuplicates: false });

              if (!error) return { ok: true as const, record: current };

              const msg = error.message || "";

              const missingCol = stripMissingColumn(msg);
              if (missingCol) {
                console.warn(`[import-from-api] ${tableName}: row missing column '${missingCol}', removing and retrying`);
                delete current[missingCol];
                attempt++;
                continue;
              }

              // If created_by is a FK to auth.users and the source user wasn't migrated, null it out.
              if (
                tableName === "union_entities" &&
                isFkError(msg) &&
                /created_by/i.test(msg)
              ) {
                console.warn(`[import-from-api] union_entities: row FK on created_by, nulling and retrying`);
                current.created_by = null;
                attempt++;
                continue;
              }

              return { ok: false as const, error, record: current };
            }

            return {
              ok: false as const,
              error: { message: "Too many row-retry attempts" },
              record: current,
            };
          };

          let rowOk = 0;
          let rowFail = 0;
          for (let i = 0; i < cleanedRecords.length; i++) {
            const rec = cleanedRecords[i];
            const res = await upsertOneWithRowRetry(rec);

            if (!res.ok) {
              rowFail++;
              const errMsg = `Row ${String((rec as any)?.id ?? "?")}: ${res.error?.message || "Unknown error"}`;
              console.error(
                `[import-from-api] ${tableName} row error:`,
                errMsg,
                "Data:",
                JSON.stringify(res.record ?? rec).slice(0, 500)
              );
              if (errors.length < 10) {
                errors.push(errMsg);
              }
              continue;
            }

            rowOk++;
            // Only store non-identity mappings (rare)
            const sid = sourceIds[i];
            const did = (res.record as any)?.id;
            if (typeof sid === "string" && typeof did === "string" && sid !== did) {
              newIdMappings[sid] = did;
            }
          }

          totalImported += rowOk;
          console.log(`[import-from-api] ${tableName} page ${page}: row fallback ok=${rowOk} fail=${rowFail}`);
        } else {
          // Use batch.records since they have columns stripped if needed
          const finalRecords = batch.records || recordsToInsert;
          totalImported += finalRecords.length;
          // Keep mappings small: only store non-identity mappings.
          for (let i = 0; i < finalRecords.length; i++) {
            const sid = sourceIds[i];
            const did = (finalRecords[i] as any)?.id;
            if (typeof sid === "string" && typeof did === "string" && sid !== did) {
              newIdMappings[sid] = did;
            }
          }
        }

        processedPages++;
        page++;
        hasMore = rows.length === limit;
      }

      console.log(
        `[import-from-api] Completed chunk for ${tableName}: imported=${totalImported}, errors=${errors.length}, nextPage=${page}, hasMore=${hasMore}`
      );

      result.tables![tableName] = {
        success: errors.length === 0,
        count: totalImported,
        error: errors.length > 0 ? errors.slice(0, 5).join("; ") : undefined,
      };

      result.idMapping = Object.keys(newIdMappings).length > 0 ? { ...idMapping, ...newIdMappings } : idMapping;
      result.page = startPage;
      result.nextPage = page;
      result.hasMore = hasMore;

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
