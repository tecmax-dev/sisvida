import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const APIBRASIL_BASE_URL = "https://gateway.apibrasil.io/api/v2";
const DEFAULT_TIMEOUT_MS = 30_000;

interface ApiBrasilPayload {
  search: string;
  homolog?: boolean;
}

interface ApiBrasilErrorBody {
  message?: string;
  error?: string | { message?: string; code?: string };
  code?: string;
}

export interface ApiBrasilSuccessResponse<T = unknown> {
  ok: true;
  status: number;
  data: T;
}

export interface ApiBrasilErrorResponse {
  ok: false;
  status: number;
  error: { message: string; code?: string; raw?: unknown };
}

async function callApiBrasil(
  endpoint: string,
  payload: ApiBrasilPayload,
  token: string,
  timeoutMs: number,
): Promise<ApiBrasilSuccessResponse | ApiBrasilErrorResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${APIBRASIL_BASE_URL}/${endpoint.replace(/^\/+/, "")}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const text = await res.text();
    let body: unknown = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = text; }

    if (!res.ok) {
      const errBody = (body ?? {}) as ApiBrasilErrorBody;
      const message =
        typeof errBody.error === "string"
          ? errBody.error
          : errBody.error?.message ?? errBody.message ?? `APIBrasil HTTP ${res.status}`;
      const code =
        (typeof errBody.error === "object" ? errBody.error?.code : undefined) ?? errBody.code;
      return { ok: false, status: res.status, error: { message, code, raw: body } };
    }

    return { ok: true, status: res.status, data: body };
  } catch (err) {
    const aborted = err instanceof DOMException && err.name === "AbortError";
    return {
      ok: false,
      status: aborted ? 408 : 0,
      error: {
        message: aborted ? `Timeout após ${timeoutMs}ms` : (err as Error).message,
        code: aborted ? "TIMEOUT" : "NETWORK_ERROR",
      },
    };
  } finally {
    clearTimeout(timer);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const token = Deno.env.get("APIBRASIL_BEARER_TOKEN");
    if (!token) {
      return new Response(
        JSON.stringify({ ok: false, error: { message: "APIBRASIL_BEARER_TOKEN não configurado", code: "CONFIG_MISSING" } }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { endpoint = "apis", search, homolog = false, timeoutMs } =
      (await req.json()) as { endpoint?: string; search: string; homolog?: boolean; timeoutMs?: number };

    if (!search || typeof search !== "string") {
      return new Response(
        JSON.stringify({ ok: false, error: { message: "Campo 'search' obrigatório", code: "INVALID_PAYLOAD" } }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const effectiveTimeout = Math.min(Math.max(timeoutMs ?? DEFAULT_TIMEOUT_MS, 10_000), 30_000);
    const result = await callApiBrasil(endpoint, { search, homolog }, token, effectiveTimeout);

    return new Response(JSON.stringify(result), {
      status: result.ok ? 200 : result.status >= 400 && result.status < 600 ? result.status : 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: { message: (err as Error).message, code: "UNEXPECTED" } }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});