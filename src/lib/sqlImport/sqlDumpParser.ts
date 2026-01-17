export interface ParsedAuthUser {
  id: string;
  email: string;
  raw_user_meta_data?: Record<string, unknown>;
}

export type ParsedOperation =
  | {
      operation: "INSERT";
      table: string;
      record: Record<string, unknown>;
    }
  | {
      operation: "DELETE_ALL";
      table: string;
    };

export function* parseStatements(sql: string): Generator<string> {
  let current = "";
  let inString = false;
  let stringChar = "";
  let inDollarQuote = false;
  let dollarTag = "";

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    const nextChar = sql[i + 1] || "";

    // dollar-quoted strings
    if (!inString && char === "$") {
      const remaining = sql.slice(i, Math.min(i + 64, sql.length));
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

    // regular strings
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

    // single-line comments
    if (char === "-" && nextChar === "-") {
      while (i < sql.length && sql[i] !== "\n") i++;
      continue;
    }

    // multi-line comments
    if (char === "/" && nextChar === "*") {
      i += 2;
      while (i < sql.length - 1 && !(sql[i] === "*" && sql[i + 1] === "/")) i++;
      i++;
      continue;
    }

    if (char === ";") {
      const stmt = current.trim();
      if (stmt) yield stmt;
      current = "";
      continue;
    }

    current += char;
  }

  const lastStmt = current.trim();
  if (lastStmt) yield lastStmt;
}

export function extractTableName(sql: string): string {
  const insertMatch = sql.match(/INSERT\s+INTO\s+(?:public\.|auth\.)?["']?(\w+)["']?/i);
  if (insertMatch) return insertMatch[1];

  const updateMatch = sql.match(/UPDATE\s+(?:public\.|auth\.)?["']?(\w+)["']?/i);
  if (updateMatch) return updateMatch[1];

  const deleteMatch = sql.match(/DELETE\s+FROM\s+(?:public\.|auth\.)?["']?(\w+)["']?/i);
  if (deleteMatch) return deleteMatch[1];

  return "unknown";
}

export function isAuthUsersStatement(sql: string): boolean {
  return /INSERT\s+INTO\s+auth\.users/i.test(sql);
}

export function isAnyAuthStatement(sql: string): boolean {
  return /\bauth\./i.test(sql);
}

export function shouldSkipStatement(sql: string): boolean {
  const upper = sql.substring(0, 80).toUpperCase().trim();

  if (upper.startsWith("SET ")) return true;
  if (upper.startsWith("CREATE ")) return true;
  if (upper.startsWith("ALTER ")) return true;
  if (upper.startsWith("DROP ")) return true;
  if (upper.startsWith("COMMENT ")) return true;
  if (upper.startsWith("GRANT ")) return true;
  if (upper.startsWith("REVOKE ")) return true;
  if (upper.startsWith("--")) return true;

  // auth tables we never import (besides users handled separately)
  if (/INSERT\s+INTO\s+auth\.(identities|sessions|refresh_tokens|mfa|audit_log)/i.test(sql)) return true;

  return false;
}

export function parseAuthUserInsert(sql: string): ParsedAuthUser | null {
  try {
    const columnsMatch = sql.match(/INSERT\s+INTO\s+auth\.users\s*\(([^)]+)\)/i);
    const valuesMatch = sql.match(/VALUES\s*\((.+)\)$/is);
    if (!columnsMatch || !valuesMatch) return null;

    const columns = columnsMatch[1]
      .split(",")
      .map((c) => c.trim().replace(/"/g, "").toLowerCase());
    const valuesStr = valuesMatch[1];

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

    const idxId = columns.indexOf("id");
    const idxEmail = columns.indexOf("email");
    const idxMeta = columns.indexOf("raw_user_meta_data");

    const idRaw = idxId >= 0 ? values[idxId] : undefined;
    const emailRaw = idxEmail >= 0 ? values[idxEmail] : undefined;

    const id = idRaw ? stripSqlString(idRaw) : "";
    const email = emailRaw ? stripSqlString(emailRaw) : "";

    const user: ParsedAuthUser = { id, email };

    if (idxMeta >= 0 && values[idxMeta] && values[idxMeta].toUpperCase() !== "NULL") {
      const metaStr = stripSqlString(values[idxMeta]);
      try {
        user.raw_user_meta_data = JSON.parse(metaStr);
      } catch {
        // ignore
      }
    }

    if (!user.id || !user.email) return null;
    return user;
  } catch {
    return null;
  }
}

function stripSqlString(val: string): string {
  return val
    .replace(/::[\w\[\]]+/g, "")
    .replace(/^'|'$/g, "")
    .replace(/''/g, "'");
}

function parseValue(val: string): string | number | boolean | null | object {
  if (!val) return null;
  if (val.toUpperCase() === "NULL") return null;
  if (val.toUpperCase() === "TRUE") return true;
  if (val.toUpperCase() === "FALSE") return false;

  val = val.replace(/::[\w\[\]]+/g, "");

  if (val.startsWith("'") && val.endsWith("'")) {
    const inner = val.slice(1, -1).replace(/''/g, "'");
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
  if (!Number.isNaN(num) && /^-?\d+(\.\d+)?$/.test(val)) return num;

  return val;
}

export function parseInsertToRecord(sql: string): { table: string; record: Record<string, unknown> } | null {
  const match = sql.match(
    /INSERT\s+INTO\s+(?:public\.)?["']?(\w+)["']?\s*\(([^)]+)\)\s*VALUES\s*\((.+)\)$/is
  );
  if (!match) return null;

  const table = match[1];
  const columns = match[2].split(",").map((c) => c.trim().replace(/"/g, ""));
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

export function parseDeleteAll(sql: string): { table: string } | null {
  if (!/^\s*DELETE\s+FROM\b/i.test(sql)) return null;
  if (/\bWHERE\b/i.test(sql)) return null;
  const m = sql.match(/DELETE\s+FROM\s+(?:public\.)?["']?(\w+)["']?/i);
  if (!m) return null;
  return { table: m[1] };
}
