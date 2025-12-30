// Helper to extract meaningful error messages from Lovable Cloud function calls

export type FunctionsErrorExtract = {
  message: string;
  status?: number;
  raw?: unknown;
};

function tryParseJson(input: unknown): any | null {
  if (typeof input !== "string") return null;
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

export function extractFunctionsError(err: unknown): FunctionsErrorExtract {
  const anyErr: any = err;

  // Common Supabase functions error shape: { message, context: { status, body } }
  const status: number | undefined =
    (typeof anyErr?.context?.status === "number" ? anyErr.context.status : undefined) ||
    (typeof anyErr?.status === "number" ? anyErr.status : undefined);

  const candidates: unknown[] = [
    anyErr?.context?.body,
    anyErr?.context?.response?.body,
    anyErr?.body,
    anyErr?.response?.body,
    anyErr?.details,
  ].filter((v) => v !== undefined && v !== null);

  // 1) If we already have an object with {error}, use it
  for (const c of candidates) {
    if (c && typeof c === "object" && typeof (c as any).error === "string") {
      return { message: (c as any).error, status, raw: err };
    }
  }

  // 2) If we have a JSON string with {error}, parse it
  for (const c of candidates) {
    const parsed = tryParseJson(c);
    if (parsed && typeof parsed.error === "string") {
      return { message: parsed.error, status, raw: err };
    }
  }

  // 3) If body is plain string, use it
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) {
      return { message: c, status, raw: err };
    }
  }

  // 4) Fall back to error.message
  if (typeof anyErr?.message === "string" && anyErr.message.trim()) {
    return { message: anyErr.message, status, raw: err };
  }

  return { message: "Erro ao processar solicitação.", status, raw: err };
}
