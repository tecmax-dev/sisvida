import { extractTableName, isAuthUsersStatement, parseStatements } from "@/lib/sqlImport/sqlDumpParser";

const yieldToMain = () => new Promise<void>((r) => setTimeout(r, 0));

export async function analyzeSqlDump(
  sql: string,
  opts?: {
    yieldEveryStatements?: number;
    onProgress?: (processedStatements: number) => void;
  }
): Promise<{
  tables: Record<string, number>;
  totalStatements: number;
  hasAuthUsers: boolean;
  authUsersCount: number;
}> {
  const yieldEveryStatements = opts?.yieldEveryStatements ?? 300;

  const tables: Record<string, number> = {};
  let totalStatements = 0;
  let authUsersCount = 0;

  for (const stmt of parseStatements(sql)) {
    totalStatements++;

    if (totalStatements % yieldEveryStatements === 0) {
      opts?.onProgress?.(totalStatements);
      await yieldToMain();
    }

    if (isAuthUsersStatement(stmt)) {
      authUsersCount++;
      tables["auth.users"] = (tables["auth.users"] || 0) + 1;
      continue;
    }

    const table = extractTableName(stmt);
    tables[table] = (tables[table] || 0) + 1;
  }

  opts?.onProgress?.(totalStatements);

  return {
    tables,
    totalStatements,
    hasAuthUsers: authUsersCount > 0,
    authUsersCount,
  };
}
