export type SourceCredentialsValidationResult =
  | { ok: true }
  | {
      ok: false;
      message: string;
      details?: {
        sourceRefFromUrl?: string | null;
        sourceRefFromKey?: string | null;
        sourceRoleFromKey?: string | null;
      };
    };

function base64UrlDecode(input: string) {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "===".slice((base64.length + 3) % 4);
  return atob(padded);
}

function decodeJwtClaims(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(base64UrlDecode(parts[1]));
    return payload;
  } catch {
    return null;
  }
}

function getProjectRefFromUrl(url: string): string | null {
  try {
    const hostname = new URL(url).hostname;
    const sub = hostname.split(".")[0];
    return sub || null;
  } catch {
    return null;
  }
}

export function validateSourceCredentials(params: {
  sourceUrl?: string;
  sourceKey?: string;
}): SourceCredentialsValidationResult {
  const sourceUrl = (params.sourceUrl ?? "").trim();
  const sourceKey = (params.sourceKey ?? "").trim();

  if (!sourceUrl && !sourceKey) return { ok: true };

  if (sourceUrl) {
    if (sourceUrl.startsWith("postgresql://")) {
      return {
        ok: false,
        message:
          "Use a URL HTTPS do projeto (https://<ref>.supabase.co), não a string postgresql:// de conexão direta.",
      };
    }

    if (!sourceUrl.startsWith("http://") && !sourceUrl.startsWith("https://")) {
      return {
        ok: false,
        message: "A URL do projeto origem precisa começar com https:// (ex.: https://xxxxx.supabase.co).",
      };
    }

    try {
      const u = new URL(sourceUrl);
      if (!u.hostname.endsWith(".supabase.co")) {
        return {
          ok: false,
          message: "A URL deve ser do tipo https://<ref>.supabase.co (atenção ao .co no final).",
        };
      }

      // Common confusion: DB host is db.<ref>.supabase.co
      if (u.hostname.startsWith("db.")) {
        return {
          ok: false,
          message:
            "Você colou o host do banco (db.*). Aqui precisa ser a URL do projeto: https://<ref>.supabase.co.",
        };
      }
    } catch {
      return { ok: false, message: "URL do projeto origem inválida." };
    }
  }

  let sourceRefFromKey: string | null = null;
  let sourceRoleFromKey: string | null = null;

  if (sourceKey) {
    const claims = decodeJwtClaims(sourceKey);
    sourceRefFromKey = typeof claims?.ref === "string" ? (claims.ref as string) : null;
    sourceRoleFromKey = typeof claims?.role === "string" ? (claims.role as string) : null;

    if (!claims) {
      return {
        ok: false,
        message:
          "A chave do projeto origem parece inválida. Cole a SERVICE_ROLE KEY (ela é um token JWT grande).",
      };
    }

    if (sourceRoleFromKey && sourceRoleFromKey !== "service_role") {
      return {
        ok: false,
        message:
          "A chave colada não é service_role. Cole a SERVICE_ROLE KEY do projeto origem (não anon/publishable).",
        details: { sourceRoleFromKey },
      };
    }
  }

  if (sourceUrl && sourceKey) {
    const sourceRefFromUrl = getProjectRefFromUrl(sourceUrl);

    if (sourceRefFromUrl && sourceRefFromKey && sourceRefFromUrl !== sourceRefFromKey) {
      return {
        ok: false,
        message:
          `A chave pertence ao projeto '${sourceRefFromKey}', mas a URL é do projeto '${sourceRefFromUrl}'. Use a service_role do MESMO projeto do URL.`,
        details: { sourceRefFromUrl, sourceRefFromKey, sourceRoleFromKey },
      };
    }
  }

  return { ok: true };
}
