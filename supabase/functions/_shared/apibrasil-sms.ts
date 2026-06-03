// ─────────────────────────────────────────────────────────────────────────────
// APIBrasil SMS Service
// Documentação de referência (cURL):
//   POST https://gateway.apibrasil.io/api/v2/sms/send
//   Headers: Authorization: Bearer <token>, Content-Type: application/json
//   Body:    { "number": "5511999999999", "message": "..." }
//
// Autenticação: APENAS Bearer token (conforme suporte APIBrasil).
// Token via env: APIBRASIL_BEARER_TOKEN.
// ─────────────────────────────────────────────────────────────────────────────

export interface SendSmsRequest {
  number: string;   // E.164 sem '+'  ex.: 5573999999999
  message: string;
}

export interface ApiBrasilSuccess {
  error: false;
  message?: string;
  response?: unknown;
  [k: string]: unknown;
}

export interface ApiBrasilError {
  error: true;
  message: string;
  error_code?: string | number;
  status: number;
}

export type SendSmsResult =
  | { ok: true; data: ApiBrasilSuccess; status: number }
  | { ok: false; error: ApiBrasilError };

export interface ApiBrasilSmsConfig {
  bearerToken: string;
  deviceToken?: string;   // Header DeviceToken — exigido pelo gateway APIBrasil
  baseUrl?: string;       // default https://gateway.apibrasil.io/api/v2
  timeoutMs?: number;     // default 20000
  fetchImpl?: typeof fetch;
}

export class ApiBrasilSmsService {
  private readonly bearerToken: string;
  private readonly deviceToken: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(cfg: ApiBrasilSmsConfig) {
    if (!cfg.bearerToken) {
      throw new Error("APIBRASIL_BEARER_TOKEN obrigatório");
    }
    this.bearerToken = cfg.bearerToken;
    this.deviceToken = cfg.deviceToken ?? "";
    this.baseUrl = (cfg.baseUrl ?? "https://gateway.apibrasil.io/api/v2").replace(/\/+$/, "");
    this.timeoutMs = cfg.timeoutMs ?? 20_000;
    this.fetchImpl = cfg.fetchImpl ?? fetch;
  }

  static fromEnv(overrides: Partial<ApiBrasilSmsConfig> = {}): ApiBrasilSmsService {
    return new ApiBrasilSmsService({
      bearerToken: Deno.env.get("APIBRASIL_BEARER_TOKEN") ?? "",
      deviceToken: Deno.env.get("APIBRASIL_SMS_DEVICE_TOKEN") ?? "",
      ...overrides,
    });
  }

  async send(payload: SendSmsRequest): Promise<SendSmsResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await this.fetchImpl(`${this.baseUrl}/sms/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${this.bearerToken}`,
          ...(this.deviceToken ? { DeviceToken: this.deviceToken } : {}),
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const raw = await res.text();
      let parsed: unknown = null;
      try { parsed = raw ? JSON.parse(raw) : null; } catch { parsed = raw; }

      const body = (parsed && typeof parsed === "object") ? parsed as Record<string, unknown> : {};
      const isErrorFlag = body.error === true;

      if (!res.ok || isErrorFlag) {
        return {
          ok: false,
          error: {
            error: true,
            status: res.status,
            message: String(body.message ?? body.error_message ?? raw ?? `HTTP ${res.status}`),
            error_code: body.error_code as string | number | undefined,
          },
        };
      }

      return { ok: true, status: res.status, data: { error: false, ...body } };
    } catch (err) {
      const aborted = (err as Error).name === "AbortError";
      return {
        ok: false,
        error: {
          error: true,
          status: aborted ? 408 : 0,
          message: aborted ? `Timeout após ${this.timeoutMs}ms` : ((err as Error).message ?? "Falha de rede"),
        },
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function buildBrazilianPhoneCandidates(rawPhone: string): string[] {
  let digits = rawPhone.replace(/@s\.whatsapp\.net$/, "").replace(/\D/g, "");
  if (digits.startsWith("55")) digits = digits.slice(2);

  const set = new Set<string>();
  if (digits.length === 10) {
    set.add(`55${digits.slice(0, 2)}9${digits.slice(2)}`);
    set.add(`55${digits}`);
  } else if (digits.length === 11) {
    set.add(`55${digits}`);
    if (digits[2] === "9") set.add(`55${digits.slice(0, 2)}${digits.slice(3)}`);
  } else {
    set.add(`55${digits}`);
  }
  return [...set].filter((c) => c.length >= 12 && c.length <= 13);
}

export function sanitizeApiBrasilError(message: string | null | undefined): string {
  if (!message) return "Não foi possível enviar SMS";
  if (/device\s*token|devicetoken|dispositivo/i.test(message)) {
    return "Não foi possível enviar SMS no momento. Tente pelo WhatsApp.";
  }
  return message;
}

// ── Exemplo de uso ───────────────────────────────────────────────────────────
// import { ApiBrasilSmsService, buildBrazilianPhoneCandidates } from "../_shared/apibrasil-sms.ts";
//
// const sms = ApiBrasilSmsService.fromEnv({ timeoutMs: 15_000 });
// for (const number of buildBrazilianPhoneCandidates("73999998888")) {
//   const r = await sms.send({ number, message: "Seu código: 1234" });
//   if (r.ok) break;
//   console.warn("Falhou para", number, r.error);
// }