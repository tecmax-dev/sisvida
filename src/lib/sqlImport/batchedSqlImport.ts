import { supabase } from "@/integrations/supabase/client";
import { extractFunctionsError } from "@/lib/functionsError";
import type { ImportResult, SqlImportProgress } from "@/lib/sqlImport/types";
import {
  parseStatements,
  isAuthUsersStatement,
  isAnyAuthStatement,
  shouldSkipStatement,
  parseAuthUserInsert,
  parseInsertToRecord,
  parseDeleteAll,
  extractTableName,
} from "@/lib/sqlImport/sqlDumpParser";

type UsersPayloadUser = {
  id: string;
  email: string;
  raw_user_meta_data?: Record<string, unknown>;
};

type BatchOperation =
  | { operation: "INSERT"; table: string; record: Record<string, unknown> }
  | { operation: "DELETE_ALL"; table: string };

export interface RunSqlImportBatchedOptions {
  sql: string;
  dryRun: boolean;
  skipAuthTables: boolean;
  totalStatements?: number;
  onProgress?: (p: SqlImportProgress) => void;
  usersBatchSize?: number;
  opsBatchSize?: number;
}

function mergeResults(a: ImportResult, b: ImportResult): ImportResult {
  return {
    success: a.success && b.success,
    executed: a.executed + b.executed,
    skipped: a.skipped + b.skipped,
    errors: [...a.errors, ...b.errors],
    details: [...a.details, ...b.details].slice(0, 200),
    userMapping: { ...(a.userMapping || {}), ...(b.userMapping || {}) },
    usersCreated: (a.usersCreated || 0) + (b.usersCreated || 0),
    usersSkipped: (a.usersSkipped || 0) + (b.usersSkipped || 0),
  };
}

export async function runSqlImportBatched(opts: RunSqlImportBatchedOptions): Promise<ImportResult> {
  const {
    sql,
    dryRun,
    skipAuthTables,
    totalStatements,
    onProgress,
    usersBatchSize = 100,
    opsBatchSize = 200,
  } = opts;

  const base: ImportResult = {
    success: true,
    executed: 0,
    skipped: 0,
    errors: [],
    details: [],
    userMapping: {},
    usersCreated: 0,
    usersSkipped: 0,
  };

  // Pass 1: collect auth.users
  const users: UsersPayloadUser[] = [];
  let seenStatements = 0;

  for (const stmt of parseStatements(sql)) {
    seenStatements++;
    if (seenStatements % 1500 === 0) {
      onProgress?.({
        phase: "users",
        processed: Math.min(seenStatements, totalStatements ?? seenStatements),
        total: totalStatements,
        percent: totalStatements ? Math.round((seenStatements / totalStatements) * 35) : undefined,
        message: "Lendo usuários...",
      });
    }

    if (!isAuthUsersStatement(stmt)) continue;
    const u = parseAuthUserInsert(stmt);
    if (u) users.push(u);
  }

  // Phase users: send in batches
  let aggregated = { ...base };
  if (users.length > 0) {
    for (let i = 0; i < users.length; i += usersBatchSize) {
      const chunk = users.slice(i, i + usersBatchSize);
      onProgress?.({
        phase: "users",
        processed: i + chunk.length,
        total: users.length,
        percent: Math.round(((i + chunk.length) / users.length) * 40),
        message: "Criando/mapeando usuários...",
      });

      const { data, error } = await supabase.functions.invoke("import-sql-backup", {
        body: {
          phase: "users",
          dryRun,
          skipAuthTables,
          users: chunk,
        },
      });

      if (error) {
        const parsed = extractFunctionsError(error);
        throw new Error(parsed.message);
      }

      aggregated = mergeResults(aggregated, data as ImportResult);
    }
  }

  const mapping = aggregated.userMapping || {};

  // Pass 2: data operations
  let ops: BatchOperation[] = [];
  let processed = 0;

  for (const stmt of parseStatements(sql)) {
    processed++;

    if (processed % 1500 === 0) {
      const basePct = 40;
      const remaining = 60;
      const pct = totalStatements ? basePct + Math.round((processed / totalStatements) * remaining) : undefined;
      onProgress?.({ phase: "data", processed, total: totalStatements, percent: pct, message: "Processando dados..." });
    }

    if (isAuthUsersStatement(stmt)) continue;
    if (isAnyAuthStatement(stmt)) {
      aggregated.skipped++;
      continue;
    }
    if (shouldSkipStatement(stmt)) {
      aggregated.skipped++;
      continue;
    }

    if (skipAuthTables) {
      const tn = extractTableName(stmt);
      if (["profiles", "user_roles", "super_admins"].includes(tn)) {
        aggregated.skipped++;
        continue;
      }
    }

    const del = parseDeleteAll(stmt);
    if (del) {
      ops.push({ operation: "DELETE_ALL", table: del.table });
    } else {
      const ins = parseInsertToRecord(stmt);
      if (!ins) {
        aggregated.skipped++;
        continue;
      }
      ops.push({ operation: "INSERT", table: ins.table, record: ins.record });
    }

    if (ops.length >= opsBatchSize) {
      aggregated = mergeResults(aggregated, await flushOps(ops, mapping, dryRun, skipAuthTables));
      ops = [];
    }
  }

  if (ops.length > 0) {
    aggregated = mergeResults(aggregated, await flushOps(ops, mapping, dryRun, skipAuthTables));
  }

  aggregated.success = aggregated.errors.length === 0;
  onProgress?.({ phase: "data", processed: processed, total: totalStatements, percent: 100, message: "Concluído" });

  return aggregated;
}

async function flushOps(
  ops: BatchOperation[],
  userMapping: Record<string, string>,
  dryRun: boolean,
  skipAuthTables: boolean
): Promise<ImportResult> {
  const { data, error } = await supabase.functions.invoke("import-sql-backup", {
    body: {
      phase: "data",
      dryRun,
      skipAuthTables,
      userMapping,
      operations: ops,
    },
  });

  if (error) {
    const parsed = extractFunctionsError(error);
    throw new Error(parsed.message);
  }

  return data as ImportResult;
}
