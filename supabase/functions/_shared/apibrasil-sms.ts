// ─────────────────────────────────────────────────────────────────────────────
// Comtele SMS Service — Gateway V4
// Documentação: https://developers.comtele.com.br/send-sms-message-23747430e0
//   POST https://api.comtele.com.br/messages/sms/send
//   Headers: x-api-key: <COMTELE_API_KEY>, Content-Type: application/json
//   Body:    { "receivers":["55..."], "contactGroups":[], "message":"...",
//              "route":"17", "tag":"...", "custom":"...", "scheduleDate":null }
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
  baseUrl?: string;       // default https://api.comtele.com.br
  sender?: string;        // remetente opcional (ex.: nome curto)
  timeoutMs?: number;     // default 20000
  fetchImpl?: typeof fetch;
  route?: string;         // Comtele route id (ex.: "17" Premium, "16" Marketing)
  tag?: string;
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
  private readonly route: string;
  private readonly tag: string;

  constructor(cfg: ApiBrasilSmsConfig) {
    if (!cfg.bearerToken) {
      throw new Error("COMTELE_API_KEY obrigatório");
    }
    this.authKey = normalizeComteleAuthKey(cfg.bearerToken);
    this.baseUrl = (cfg.baseUrl ?? "https://api.comtele.com.br").replace(/\/+$/, "");
    this.sender = cfg.sender ?? "";
    this.timeoutMs = cfg.timeoutMs ?? 20_000;
    this.fetchImpl = cfg.fetchImpl ?? fetch;
    this.route = cfg.route ?? "17";
    this.tag = cfg.tag ?? "prosindweb";
  }

  static fromEnv(overrides: Partial<ApiBrasilSmsConfig> = {}): ApiBrasilSmsService {
    return new ApiBrasilSmsService({
      bearerToken:
        Deno.env.get("COMTELE_API_KEY")?.trim() ||
        Deno.env.get("COMTELE_AUTH_KEY")?.trim() ||
        Deno.env.get("APIBRASIL_BEARER_TOKEN")?.trim() ||
        "",
      sender: Deno.env.get("COMTELE_SENDER") ?? "",
      route: Deno.env.get("COMTELE_ROUTE") ?? "17",
      tag: Deno.env.get("COMTELE_TAG") ?? "prosindweb",
      ...overrides,
    });
  }

  async send(payload: SendSmsRequest): Promise<SendSmsResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const body: Record<string, unknown> = {
        receivers: [payload.number],
        contactGroups: [],
        message: payload.message,
        route: this.route,
        tag: this.tag,
        custom: this.sender || "prosindweb",
        scheduleDate: null,
      };

      const res = await this.fetchImpl(`${this.baseUrl}/messages/sms/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "x-api-key": this.authKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const raw = await res.text();
      let parsed: unknown = null;
      try { parsed = raw ? JSON.parse(raw) : null; } catch { parsed = raw; }

      const respBody = (parsed && typeof parsed === "object") ? parsed as Record<string, unknown> : {};
      // Gateway V4 retorna { hasError: false, message: null, totalRecords, errors, object }
      const hasError =
        respBody.hasError === true ||
        respBody.HasError === true ||
        respBody.Success === false ||
        respBody.success === false;
      const success = !hasError;

      if (!res.ok || !success) {
        return {
          ok: false,
          error: {
            error: true,
            status: res.status,
            message: String(
              respBody.message ?? respBody.Message ?? (Array.isArray(respBody.errors) ? (respBody.errors as unknown[]).join("; ") : "") ?? raw ?? `HTTP ${res.status}`,
            ),
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