export type ApiMigrationCheckpoint = {
  v: 1;
  sourceApiUrl: string;
  summary: { table: string; count: number }[];
  userMapping: Record<string, string>;
  usersCreated: number;
  usersSkipped: number;
  tables: Record<string, { success: boolean; count: number; error?: string }>;
  currentIndex: number;
  page: number;
  limit: number;
  accumulatedIdMapping: Record<string, string>;
  timestamp: number;
  // Track which tables had errors for retry-only mode
  failedTables?: string[];
};

const STORAGE_KEY = "api_migration_checkpoint_v1";

function safeJsonParse(input: string | null): unknown {
  if (!input) return null;
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

export function loadApiMigrationCheckpoint(): ApiMigrationCheckpoint | null {
  if (typeof window === "undefined") return null;

  const raw = safeJsonParse(window.localStorage.getItem(STORAGE_KEY));
  if (!raw || typeof raw !== "object") return null;

  const anyRaw = raw as any;
  if (anyRaw.v !== 1) return null;
  if (typeof anyRaw.sourceApiUrl !== "string" || anyRaw.sourceApiUrl.length === 0) return null;
  if (!Array.isArray(anyRaw.summary)) return null;

  return {
    v: 1,
    sourceApiUrl: anyRaw.sourceApiUrl,
    summary: (anyRaw.summary as any[])
      .filter((x) => x && typeof x === "object" && typeof x.table === "string")
      .map((x) => ({ table: String(x.table), count: Number((x as any).count) || 0 })),
    userMapping: (anyRaw.userMapping && typeof anyRaw.userMapping === "object" ? anyRaw.userMapping : {}) as Record<
      string,
      string
    >,
    usersCreated: Number(anyRaw.usersCreated) || 0,
    usersSkipped: Number(anyRaw.usersSkipped) || 0,
    tables: (anyRaw.tables && typeof anyRaw.tables === "object" ? anyRaw.tables : {}) as Record<
      string,
      { success: boolean; count: number; error?: string }
    >,
    currentIndex: Math.max(0, Number(anyRaw.currentIndex) || 0),
    page: Math.max(0, Number(anyRaw.page) || 0),
    limit: Math.max(1, Number(anyRaw.limit) || 200),
    accumulatedIdMapping: (anyRaw.accumulatedIdMapping && typeof anyRaw.accumulatedIdMapping === "object"
      ? anyRaw.accumulatedIdMapping
      : {}) as Record<string, string>,
    timestamp: Number(anyRaw.timestamp) || Date.now(),
    failedTables: Array.isArray(anyRaw.failedTables) ? anyRaw.failedTables : undefined,
  };
}

export function saveApiMigrationCheckpoint(cp: ApiMigrationCheckpoint) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cp));
  } catch {
    // ignore (quota / privacy mode)
  }
}

export function clearApiMigrationCheckpoint() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
