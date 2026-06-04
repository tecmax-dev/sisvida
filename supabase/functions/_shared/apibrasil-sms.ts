// ─────────────────────────────────────────────────────────────────────────────
// Comtele SMS Service
// Documentação: https://docs.comtele.com.br/
//   POST https://sms.comtele.com.br/api/v2/send
//   Headers: auth-key: <COMTELE_API_KEY>, Content-Type: application/json
//   Body:    { "Receivers": "5511999999999", "Content": "..." , "Sender": "..." }
//
// Mantemos os MESMOS nomes/símbolos exportados (ApiBrasilSmsService, etc.)
// para evitar churn nos chamadores. Apenas o provedor mudou.
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
  bearerToken: string;    // Comtele auth-key (mantido o nome do campo)
  deviceToken?: string;   // não usado pela Comtele; mantido por compatibilidade
  baseUrl?: string;       // default https://sms.comtele.com.br/api/v2
  sender?: string;        // remetente opcional (ex.: nome curto)
  timeoutMs?: number;     // default 20000
  fetchImpl?: typeof fetch;
}

function normalizeComteleAuthKey(rawKey: string): string {
  let key = rawKey.trim().replace(/^['"]|['"]$/g, "").trim();

  const authHeaderMatch = key.match(/auth-key\s*:\s*([^\s'",;]+)/i);
  if (authHeaderMatch?.[1]) return authHeaderMatch[1].trim();

  const uuidMatch = key.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  if (uuidMatch?.[0]) return uuidMatch[0].trim();

  if (key.includes("=")) {
    const [, value] = key.split(/=(.*)/s);
    key = (value || key).trim().replace(/^['"]|['"]$/g, "").trim();
  }

  return key;
}

export class ApiBrasilSmsService {
  private readonly authKey: string;
  private readonly baseUrl: string;
  private readonly sender: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(cfg: ApiBrasilSmsConfig) {
    if (!cfg.bearerToken) {
      throw new Error("COMTELE_API_KEY obrigatório");
    }
    this.authKey = normalizeComteleAuthKey(cfg.bearerToken);
    this.baseUrl = (cfg.baseUrl ?? "https://sms.comtele.com.br/api/v2").replace(/\/+$/, "");
    this.sender = cfg.sender ?? "";
    this.timeoutMs = cfg.timeoutMs ?? 20_000;
    this.fetchImpl = cfg.fetchImpl ?? fetch;
  }

  static fromEnv(overrides: Partial<ApiBrasilSmsConfig> = {}): ApiBrasilSmsService {
    return new ApiBrasilSmsService({
      bearerToken:
        Deno.env.get("COMTELE_API_KEY")?.trim() ||
        Deno.env.get("COMTELE_AUTH_KEY")?.trim() ||
        Deno.env.get("APIBRASIL_BEARER_TOKEN")?.trim() ||
        "",
      sender: Deno.env.get("COMTELE_SENDER") ?? "",
      ...overrides,
    });
  }

  async send(payload: SendSmsRequest): Promise<SendSmsResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const body: Record<string, unknown> = {
        Receivers: payload.number,
        Content: payload.message,
      };
      if (this.sender) body.Sender = this.sender;

      const res = await this.fetchImpl(`${this.baseUrl}/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "auth-key": this.authKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const raw = await res.text();
      let parsed: unknown = null;
      try { parsed = raw ? JSON.parse(raw) : null; } catch { parsed = raw; }

      const respBody = (parsed && typeof parsed === "object") ? parsed as Record<string, unknown> : {};
      // Comtele retorna { Success: true/false, Message: "...", Code: number }
      const success = respBody.Success === true || respBody.success === true;

      if (!res.ok || !success) {
        return {
          ok: false,
          error: {
            error: true,
            status: res.status,
            message: String(respBody.Message ?? respBody.message ?? raw ?? `HTTP ${res.status}`),
            error_code: (respBody.Code ?? respBody.code) as string | number | undefined,
          },
        };
      }

      return { ok: true, status: res.status, data: { error: false, ...respBody } };
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
  if (/auth[-\s]?key|unauthorized|credencial|chave de acesso|inv[aá]lid/i.test(message)) {
    return "Não foi possível enviar SMS: chave Comtele inválida ou sem permissão.";
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