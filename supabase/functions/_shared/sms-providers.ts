// SMS providers — Comtele (default) and API Brasil (alternativa).
// O resto do sistema continua usando o ApiBrasilSmsService existente (Comtele);
// apenas o módulo /sindicato pode trocar o provedor por envio.

import {
  ApiBrasilSmsService as ComteleSmsService,
  buildBrazilianPhoneCandidates,
  sanitizeApiBrasilError,
  type SendSmsRequest,
  type SendSmsResult,
} from "./apibrasil-sms.ts";

export type SmsProvider = "comtele" | "apibrasil";

export interface SmsService {
  readonly provider: SmsProvider;
  send(payload: SendSmsRequest): Promise<SendSmsResult>;
}

class ComteleAdapter implements SmsService {
  readonly provider: SmsProvider = "comtele";
  constructor(private readonly inner: ComteleSmsService) {}
  send(payload: SendSmsRequest) { return this.inner.send(payload); }
}

export interface ApiBrasilDirectConfig {
  bearerToken: string;
  deviceToken?: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

class ApiBrasilDirectService implements SmsService {
  readonly provider: SmsProvider = "apibrasil";
  private readonly bearer: string;
  private readonly deviceToken: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(cfg: ApiBrasilDirectConfig) {
    if (!cfg.bearerToken) throw new Error("APIBRASIL_BEARER_TOKEN obrigatório");
    this.bearer = cfg.bearerToken.trim();
    this.deviceToken = (cfg.deviceToken ?? "").trim();
    this.baseUrl = (cfg.baseUrl ?? "https://gateway.apibrasil.io").replace(/\/+$/, "");
    this.timeoutMs = cfg.timeoutMs ?? 20_000;
    this.fetchImpl = cfg.fetchImpl ?? fetch;
  }

  static fromEnv(overrides: Partial<ApiBrasilDirectConfig> = {}): ApiBrasilDirectService {
    return new ApiBrasilDirectService({
      bearerToken: Deno.env.get("APIBRASIL_BEARER_TOKEN")?.trim() ?? "",
      deviceToken: Deno.env.get("APIBRASIL_SMS_DEVICE_TOKEN")?.trim() ?? "",
      ...overrides,
    });
  }

  async send(payload: SendSmsRequest): Promise<SendSmsResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${this.bearer}`,
      };
      if (this.deviceToken) headers.DeviceToken = this.deviceToken;

      const res = await this.fetchImpl(`${this.baseUrl}/api/v2/sms/send`, {
        method: "POST",
        headers,
        body: JSON.stringify({ number: payload.number, message: payload.message }),
        signal: controller.signal,
      });

      const raw = await res.text();
      let parsed: unknown = null;
      try { parsed = raw ? JSON.parse(raw) : null; } catch { parsed = raw; }
      const body = (parsed && typeof parsed === "object") ? parsed as Record<string, unknown> : {};
      const hasError = body.error === true || res.status >= 400;

      if (hasError) {
        return {
          ok: false,
          error: {
            error: true,
            status: res.status,
            message: String(body.message ?? body.error ?? raw ?? `HTTP ${res.status}`),
            error_code: (body.error_code ?? body.code) as string | number | undefined,
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

export function resolveSmsProvider(requested?: string | null): SmsProvider {
  const envDefault = (Deno.env.get("SMS_PROVIDER") ?? "comtele").toLowerCase();
  const value = (requested ?? envDefault).toLowerCase();
  return value === "apibrasil" ? "apibrasil" : "comtele";
}

export function createSmsService(requested?: string | null): SmsService {
  const provider = resolveSmsProvider(requested);
  if (provider === "apibrasil") return ApiBrasilDirectService.fromEnv();
  return new ComteleAdapter(ComteleSmsService.fromEnv({ timeoutMs: 20_000 }));
}

export { buildBrazilianPhoneCandidates, sanitizeApiBrasilError };
export type { SendSmsRequest, SendSmsResult };
