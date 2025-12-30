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

function tryDecodeBody(input: unknown): string | null {
  if (!input) return null;
  if (typeof input === "string") return input;

  // Supabase FunctionsHttpError sometimes carries body as bytes/ArrayBuffer.
  try {
    if (input instanceof ArrayBuffer) {
      return new TextDecoder().decode(new Uint8Array(input));
    }
    if (ArrayBuffer.isView(input)) {
      return new TextDecoder().decode(new Uint8Array(input.buffer));
    }
  } catch {
    // ignore
  }

  return null;
}

function extractMessageFromUnknown(input: unknown): string | null {
  if (!input) return null;

  // Object body: { error: string } or { message: string }
  if (typeof input === "object") {
    const anyObj: any = input;
    if (typeof anyObj?.error === "string" && anyObj.error.trim()) return anyObj.error;
    if (typeof anyObj?.message === "string" && anyObj.message.trim()) return anyObj.message;
  }

  // String body
  const decoded = tryDecodeBody(input);
  if (decoded && decoded.trim()) {
    // Try JSON first
    const parsed = tryParseJson(decoded);
    if (parsed && typeof parsed === "object") {
      if (typeof (parsed as any).error === "string" && (parsed as any).error.trim()) {
        return (parsed as any).error;
      }
      if (typeof (parsed as any).message === "string" && (parsed as any).message.trim()) {
        return (parsed as any).message;
      }
    }

    // Plain text
    return decoded;
  }

  return null;
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

  // Try to extract the most meaningful message from any candidate body
  for (const c of candidates) {
    const msg = extractMessageFromUnknown(c);
    if (msg) return { message: msg, status, raw: err };
  }

  // Fall back to error.message
  if (typeof anyErr?.message === "string" && anyErr.message.trim()) {
    return { message: anyErr.message, status, raw: err };
  }

  return { message: "Erro ao processar solicitação.", status, raw: err };
}
