// ─────────────────────────────────────────────────────────────────────────────
// APIBrasil Auth Service — Social GitHub Callback
//
// Referência (cURL):
//   POST https://gateway.apibrasil.io/api/v2/social/github/callback
//   Headers: Content-Type: application/json
//            Authorization: Bearer <APIBRASIL_BEARER_TOKEN>
//   Body:    { "code": "<code>", "state": "<state>", "homolog": false }
//
// Configuração via env:
//   - APIBRASIL_BEARER_TOKEN   (obrigatório)
//   - APIBRASIL_BASE_URL       (opcional; default gateway oficial)
// ─────────────────────────────────────────────────────────────────────────────

export interface GithubCallbackRequest {
  code: string;
  state: string;
  homolog?: boolean;
}

export interface ApiBrasilAuthSuccess {
  error: false;
  status: number;
  data: Record<string, unknown>;
}

export interface ApiBrasilAuthError {
  error: true;
  status: number;
  message: string;
  error_code?: string | number;
  raw?: unknown;
}

export type ApiBrasilAuthResult =
  | ApiBrasilAuthSuccess
  | ApiBrasilAuthError;

export interface ApiBrasilAuthConfig {
  bearerToken: string;
  baseUrl?: string;       // default https://gateway.apibrasil.io/api/v2
  timeoutMs?: number;     // default 20000 (válido 1000..120000)
  fetchImpl?: typeof fetch;
}

export class ApiBrasilAuthError_ extends Error {
  readonly status: number;
  readonly error_code?: string | number;
  readonly raw?: unknown;
  constructor(err: ApiBrasilAuthError) {
    super(err.message);
    this.name = "ApiBrasilAuthError";
    this.status = err.status;
    this.error_code = err.error_code;
    this.raw = err.raw;
  }
}

export class ApiBrasilAuthService {
  private readonly bearerToken: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(cfg: ApiBrasilAuthConfig) {
    if (!cfg.bearerToken) {
      throw new Error("APIBRASIL_BEARER_TOKEN obrigatório");
    }
    this.bearerToken = cfg.bearerToken;
    this.baseUrl = (cfg.baseUrl ?? "https://gateway.apibrasil.io/api/v2").replace(/\/+$/, "");
    const t = cfg.timeoutMs ?? 20_000;
    this.timeoutMs = Math.min(120_000, Math.max(1_000, t));
    this.fetchImpl = cfg.fetchImpl ?? fetch;
  }

  static fromEnv(overrides: Partial<ApiBrasilAuthConfig> = {}): ApiBrasilAuthService {
    return new ApiBrasilAuthService({
      bearerToken: Deno.env.get("APIBRASIL_BEARER_TOKEN") ?? "",
      baseUrl: Deno.env.get("APIBRASIL_BASE_URL") ?? undefined,
      ...overrides,
    });
  }

  /**
   * POST /social/github/callback — troca code+state pelo payload de autenticação.
   */
  async githubCallback(payload: GithubCallbackRequest): Promise<ApiBrasilAuthResult> {
    if (!payload.code || !payload.state) {
      return {
        error: true,
        status: 400,
        message: "Parâmetros obrigatórios: code, state",
        error_code: "MISSING_PARAMS",
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await this.fetchImpl(`${this.baseUrl}/social/github/callback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${this.bearerToken}`,
        },
        body: JSON.stringify({
          code: payload.code,
          state: payload.state,
          homolog: payload.homolog ?? false,
        }),
        signal: controller.signal,
      });

      const raw = await res.text();
      let parsed: unknown = null;
      try { parsed = raw ? JSON.parse(raw) : null; } catch { parsed = raw; }

      const body = (parsed && typeof parsed === "object") ? parsed as Record<string, unknown> : {};
      const isErrorFlag = body.error === true;

      if (!res.ok || isErrorFlag) {
        return {
          error: true,
          status: res.status,
          message: String(body.message ?? body.error_message ?? raw ?? `HTTP ${res.status}`),
          error_code: body.error_code as string | number | undefined,
          raw: parsed,
        };
      }

      return { error: false, status: res.status, data: body };
    } catch (err) {
      const aborted = (err as Error).name === "AbortError";
      return {
        error: true,
        status: aborted ? 408 : 0,
        message: aborted
          ? `Timeout após ${this.timeoutMs}ms`
          : ((err as Error).message ?? "Falha de rede"),
        error_code: aborted ? "TIMEOUT" : "NETWORK_ERROR",
      };
    } finally {
      clearTimeout(timer);
    }
  }

  /** Variante que lança exceção tipada em caso de erro. */
  async githubCallbackOrThrow(payload: GithubCallbackRequest): Promise<ApiBrasilAuthSuccess> {
    const r = await this.githubCallback(payload);
    if (r.error) throw new ApiBrasilAuthError_(r);
    return r;
  }
}

// ── Exemplo prático de uso ───────────────────────────────────────────────────
// import { ApiBrasilAuthService } from "../_shared/apibrasil-auth.ts";
//
// const auth = ApiBrasilAuthService.fromEnv({ timeoutMs: 30_000 });
// const result = await auth.githubCallback({
//   code: "SEU_CODE",
//   state: "SEU_STATE",
//   homolog: false,
// });
//
// if (result.error) {
//   console.error("APIBrasil auth falhou:", result.status, result.message, result.error_code);
// } else {
//   console.log("APIBrasil auth OK:", result.data);
// }