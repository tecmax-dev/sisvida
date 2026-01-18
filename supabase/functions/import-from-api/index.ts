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
  "patients": ["clinic_id", "no_show_blocked_professional_id"],
  
  // Relationship/junction tables
  "accounting_office_employers": ["accounting_office_id", "employer_id"],
  "patient_employers": ["patient_id", "employer_id"],
  "professional_procedures": ["professional_id", "procedure_id"],
  
  // Transactions with multiple FKs
  "appointments": ["clinic_id", "patient_id", "professional_id", "procedure_id"],
  "employer_contributions": ["employer_id", "clinic_id", "union_entity_id"],
  "financial_transactions": ["clinic_id", "category_id", "cash_register_id"],
  
  // Medical records
  "medical_records": ["clinic_id", "patient_id", "professional_id", "appointment_id"],
  "medical_record_attachments": ["medical_record_id"],
  
  // Homologation
  "homologacao_schedules": ["clinic_id", "professional_id"],
  
  // Totems/queues
  "totems": ["clinic_id", "queue_id"],
  
  // SMTP settings
  "smtp_settings": ["clinic_id", "created_by"],
  
  // Clinic addons
  "clinic_addons": ["clinic_id", "addon_id", "activated_by", "suspended_by"],
  "addon_requests": ["clinic_id", "addon_id", "requested_by", "reviewed_by"],
  "upgrade_requests": ["clinic_id", "requested_by", "reviewed_by"],
  
  // Patient related
  "patient_cards": ["patient_id", "clinic_id"],
  "patient_dependents": ["patient_id", "clinic_id"],
  "patient_first_access_tokens": ["patient_id"],
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

      // Pre-load valid IDs from destination tables to avoid per-row FK lookups
      // This dramatically speeds up tables with FK references
      const validEntityIds: Record<string, Set<string>> = {};

      const loadValidIds = async (entityTable: string) => {
        if (validEntityIds[entityTable]) return validEntityIds[entityTable];
        
        const ids = new Set<string>();
        let offset = 0;
        const batchSize = 1000;
        
        while (true) {
          const { data, error } = await supabaseAdmin
            .from(entityTable)
            .select("id")
            .range(offset, offset + batchSize - 1);
          
          if (error || !data || data.length === 0) break;
          
          for (const row of data) {
            if (row?.id) ids.add(row.id);
          }
          
          if (data.length < batchSize) break;
          offset += batchSize;
        }
        
        validEntityIds[entityTable] = ids;
        console.log(`[import-from-api] Cached ${ids.size} valid IDs for ${entityTable}`);
        return ids;
      };

      // Preload commonly needed entity IDs based on table FK requirements
      const fkEntityTables: Record<string, string> = {
        "professional_id": "professionals",
        "patient_id": "patients",
        "appointment_id": "appointments",
        "queue_id": "queues",
        "addon_id": "subscription_addons",
        "medical_record_id": "medical_records",
        "no_show_blocked_professional_id": "professionals",
        "employer_id": "employers",
        "insurance_plan_id": "insurance_plans",
        "specialty_id": "specialties",
        "procedure_id": "procedures",
        "category_id": "employer_categories",
        "access_group_id": "access_groups",
        "clinic_id": "clinics",
      };

      // Function to null out invalid entity FK references (not user FKs)
      const nullInvalidEntityFks = async (record: Record<string, unknown>) => {
        for (const [fkField, entityTable] of Object.entries(fkEntityTables)) {
          const val = record[fkField];
          if (typeof val !== "string" || val.length === 0) continue;
          
          const validIds = await loadValidIds(entityTable);
          if (!validIds.has(val)) {
            record[fkField] = null;
          }
        }
      };

      // Check if error is a subscription limit, RLS/access control, or NOT NULL violation - skip these records
      const isSkippableBusinessError = (message: string): boolean => {
        return /LIMITE_PROFISSIONAIS|LIMITE_USUARIOS|LIMITE_PACIENTES|limite.*plano|ACESSO_NEGADO|row.level.security|policy.*violated|permission denied/i.test(message);
      };

      // Check if error is a NOT NULL constraint violation - skip these records (required field missing)
      const isNotNullViolation = (message: string): boolean => {
        return /null value in column .* violates not-null constraint/i.test(message);
      };

      // Columns that are generated/computed and cannot be inserted
      const GENERATED_COLUMNS: Record<string, string[]> = {
        "employer_contributions": ["active_competence_key"],
      };

      // Remove generated columns from a record before insertion
      const stripGeneratedColumns = (record: Record<string, unknown>, table: string): Record<string, unknown> => {
        const cols = GENERATED_COLUMNS[table];
        if (!cols || cols.length === 0) return record;
        
        const out = { ...record };
        for (const col of cols) {
          if (col in out) {
            delete out[col];
          }
        }
        return out;
      };

      const stripMissingColumn = (message: string): string | null => {
        // Examples:
        // - Could not find the 'logo_url' column of 'union_entities' in the schema cache
        // - column "foo" of relation "bar" does not exist
        // - cannot insert a non-DEFAULT value into column "active_competence_key"
        const m1 = message.match(/Could not find the '([^']+)' column/i);
        if (m1?.[1]) return m1[1];
        const m2 = message.match(/column\s+"([^"]+)"\s+of\s+relation/i);
        if (m2?.[1]) return m2[1];
        const m3 = message.match(/cannot insert a non-DEFAULT value into column "([^"]+)"/i);
        if (m3?.[1]) return m3[1];
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
            let removedAny = false;
            console.warn(`[import-from-api] ${tableName}: removing missing column '${missingCol}' and retrying`);
            current = current.map((r) => {
              const out = { ...r } as Record<string, unknown>;
              if (missingCol in out) {
                delete out[missingCol];
                removedAny = true;
              }
              return out;
            });

            // If none of the records actually had this column, we would loop forever.
            // Treat as unrecoverable for this batch and let the caller fallback/skip.
            if (!removedAny) {
              return { ok: false as const, error, records: current };
            }

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
        let skippedDueToNoUser = 0;

        // For user-dependent tables (profiles, user_roles), we must skip records
        // whose user_id doesn't exist in auth (since we can't create users on the fly)
        const requiresValidUser = ["profiles", "user_roles", "super_admins"].includes(tableName);
        
        // Build a set of known valid auth users in destination
        const validAuthUsers = new Set<string>();
        if (requiresValidUser) {
          // Get user IDs from userMapping (source->dest mapping)
          for (const destUserId of Object.values(userMapping || {})) {
            if (typeof destUserId === "string") validAuthUsers.add(destUserId);
          }
          console.log(`[import-from-api] ${tableName}: ${validAuthUsers.size} valid auth users available`);
        }

        for (const row of rows) {
          const sourceId = row?.id;
          let recordToInsert = remapForeignKeys(row, tableName, idMapping, false);
          
          // Strip generated/computed columns that cannot be inserted
          recordToInsert = stripGeneratedColumns(recordToInsert, tableName);
          
          // For user-dependent tables, skip if user_id is not in our valid set
          if (requiresValidUser) {
            const userId = recordToInsert.user_id;
            if (typeof userId !== "string" || !validAuthUsers.has(userId)) {
              skippedDueToNoUser++;
              continue; // Skip this record entirely
            }
          }
          
          // Pre-validate entity FKs to avoid row-by-row fallback
          await nullInvalidEntityFks(recordToInsert);
          recordsToInsert.push(recordToInsert);
          if (typeof sourceId === "string") sourceIds.push(sourceId);
        }
        
        if (skippedDueToNoUser > 0) {
          console.log(`[import-from-api] ${tableName}: skipped ${skippedDueToNoUser} rows (user_id not in destination)`);
        }
        
        // If all records were filtered out, continue to next page
        if (recordsToInsert.length === 0) {
          processedPages++;
          page++;
          hasMore = rows.length === limit;
          continue;
        }

        // Fast path: batch upsert, with auto-removal of missing columns
        const batch = await upsertWithSchemaRetry(recordsToInsert);

        if (!batch.ok) {
          const batchErrMsg = batch.error?.message || "Unknown upsert error";

          // Use the cleaned records from batch retry (columns may have been removed)
          const cleanedRecords = batch.records || recordsToInsert;

          // Fallback: try row-by-row to salvage what we can and surface precise errors.
          // Row-level resilience:
          // - Strip missing columns (schema cache mismatch)
          // - For any table with user FK fields, null out references to non-existent auth users
          const knownAuthUsers = new Set<string>();
          const missingAuthUsers = new Set<string>();

          // User FK fields that reference auth.users across various tables
          const userFkFields = ["user_id", "created_by", "activated_by", "requested_by", "reviewed_by", "suspended_by"];

          const ensureAuthUserOrNull = async (record: Record<string, unknown>, field: string) => {
            const v = record[field];
            if (typeof v !== "string" || v.length === 0) return;
            if (knownAuthUsers.has(v)) return;
            if (missingAuthUsers.has(v)) {
              record[field] = null;
              return;
            }

            try {
              const { data, error } = await supabaseAdmin.auth.admin.getUserById(v);
              if (error || !data?.user) {
                missingAuthUsers.add(v);
                record[field] = null;
              } else {
                knownAuthUsers.add(v);
              }
            } catch {
              missingAuthUsers.add(v);
              record[field] = null;
            }
          };

          const upsertOneWithRowRetry = async (rec: Record<string, unknown>) => {
            let attempt = 0;
            let current = { ...rec } as Record<string, unknown>;

            while (attempt < 4) {
              // Proactively null out invalid auth user references to avoid FK violations.
              for (const field of userFkFields) {
                if (field in current) {
                  await ensureAuthUserOrNull(current, field);
                }
              }
              
              // Also null out invalid entity FK references
              await nullInvalidEntityFks(current);

              const { error } = await supabaseAdmin
                .from(tableName)
                .upsert(current, { onConflict: "id", ignoreDuplicates: false });

              if (!error) return { ok: true as const, record: current };

              const msg = error.message || "";

              // Handle subscription limit and RLS/access errors - skip these records entirely
              if (isSkippableBusinessError(msg)) {
                console.warn(`[import-from-api] ${tableName}: business rule violation, skipping record: ${msg.substring(0, 80)}`);
                return { ok: false as const, error: { message: "SKIPPED_BUSINESS_RULE" }, record: current, skipped: true };
              }

              // Handle NOT NULL constraint violations - skip these records (required field missing/null)
              if (isNotNullViolation(msg)) {
                console.warn(`[import-from-api] ${tableName}: NOT NULL violation, skipping record: ${msg.substring(0, 80)}`);
                return { ok: false as const, error: { message: "SKIPPED_NOT_NULL" }, record: current, skipped: true };
              }

              const missingCol = stripMissingColumn(msg);
              if (missingCol) {
                // If the column is actually present, strip it and retry.
                if (missingCol in current) {
                  console.warn(`[import-from-api] ${tableName}: row missing column '${missingCol}', removing and retrying`);
                  delete current[missingCol];
                  attempt++;
                  continue;
                }

                // If it isn't present in the payload, this is likely a persistent schema-cache mismatch.
                // Don't get stuck retrying forever; skip this record.
                if (/schema cache/i.test(msg)) {
                  console.warn(`[import-from-api] ${tableName}: schema-cache mismatch (${missingCol}) but field not in payload; skipping record`);
                  return { ok: false as const, error: { message: "SKIPPED_SCHEMA_CACHE" }, record: current, skipped: true };
                }
              }

              // If any FK field causes a violation, null it out reactively
              if (isFkError(msg)) {
                let handled = false;
                
                // First check user FK fields
                for (const field of userFkFields) {
                  if (new RegExp(field, "i").test(msg) && current[field] != null) {
                    console.warn(`[import-from-api] ${tableName}: FK violation on ${field}, nulling and retrying`);
                    current[field] = null;
                    handled = true;
                    break;
                  }
                }
                
                // Then check entity FK fields
                if (!handled) {
                  for (const fkField of Object.keys(fkEntityTables)) {
                    if (new RegExp(fkField, "i").test(msg) && current[fkField] != null) {
                      console.warn(`[import-from-api] ${tableName}: FK violation on ${fkField}, nulling and retrying`);
                      current[fkField] = null;
                      handled = true;
                      break;
                    }
                  }
                }
                
                if (handled) {
                  attempt++;
                  continue;
                }
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
          let rowSkipped = 0;
          for (let i = 0; i < cleanedRecords.length; i++) {
            const rec = cleanedRecords[i];
            const res = await upsertOneWithRowRetry(rec);

            if (!res.ok) {
              // Check if this was a "skipped due to limit" case - don't count as error
              if ((res as any).skipped) {
                rowSkipped++;
                continue;
              }
              
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

          // Only mark the chunk as failed if the row-level fallback still had failures.
          if (rowFail > 0) {
            errors.push(`Batch error: ${batchErrMsg}`);
          }

          if (rowSkipped > 0) {
            console.log(`[import-from-api] ${tableName}: ${rowSkipped} rows skipped (subscription limits)`);
          }

          totalImported += rowOk;
          console.log(`[import-from-api] ${tableName} page ${page}: row fallback ok=${rowOk} fail=${rowFail} skipped=${rowSkipped}`);
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
