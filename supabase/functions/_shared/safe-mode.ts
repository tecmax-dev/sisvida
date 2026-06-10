// Meta Safe Mode — camada extra de proteção operacional.
// NÃO substitui Compliance Engine, STRICT_MODE ou Template Governance.
// Apenas adiciona pre-checks (limites, circuit breaker, manutenção, dry run, go-live stages).

import { TRIGGER_SOURCES, type TriggerSource } from "./trigger-sources.ts";

export interface SafeModeConfig {
  safe_mode: boolean;
  maintenance_mode: boolean;
  dry_run: boolean;
  max_per_hour: number;
  max_per_day: number;
  max_per_contact_30d: number;
  circuit_breaker_open: boolean;
  circuit_reason: string | null;
  go_live_stage: number; // 0=desligado,1=20,2=100,3=500,4=ilimitado
  manual_override: boolean;
}

const GO_LIVE_CAPS: Record<number, number | null> = {
  0: 0,
  1: 20,
  2: 100,
  3: 500,
  4: null, // ilimitado
};

const DEFAULT_CONFIG: SafeModeConfig = {
  safe_mode: ((globalThis as any)?.Deno?.env?.get?.("META_SAFE_MODE") ?? "true") === "true",
  maintenance_mode: ((globalThis as any)?.Deno?.env?.get?.("META_MAINTENANCE_MODE") ?? "false") === "true",
  dry_run: false,
  max_per_hour: 50,
  max_per_day: 500,
  max_per_contact_30d: 5,
  circuit_breaker_open: false,
  circuit_reason: null,
  go_live_stage: 4,
  manual_override: false,
};

export async function loadSafeConfig(supabase: any): Promise<SafeModeConfig> {
  try {
    const { data } = await supabase
      .from("meta_safe_mode_config")
      .select("*")
      .eq("singleton", true)
      .maybeSingle();
    if (!data) return DEFAULT_CONFIG;
    return { ...DEFAULT_CONFIG, ...data };
  } catch (_) {
    return DEFAULT_CONFIG;
  }
}

export interface SafeCheckInput {
  supabase: any;
  templateName: string;
  category?: string | null;
  contactPhone: string;
  triggerSource: TriggerSource | string;
  critical?: boolean;
}

export interface SafeCheckResult {
  allowed: boolean;
  dryRun: boolean;
  reason?: string;
  reasons: string[];
  config: SafeModeConfig;
}

function isHumanOrAuthBypass(input: SafeCheckInput): boolean {
  if (input.triggerSource === TRIGGER_SOURCES.HUMAN_OPERATOR) return true;
  if (input.triggerSource === TRIGGER_SOURCES.SESSION_REPLY) return true;
  if (input.triggerSource === TRIGGER_SOURCES.META_SEND_TEXT) return true;
  if (input.triggerSource === TRIGGER_SOURCES.SEND_WHATSAPP) return true;
  if ((input.category || "").toUpperCase() === "AUTHENTICATION") return true;
  if (input.critical) return true;
  return false;
}

export async function checkSafeMode(input: SafeCheckInput): Promise<SafeCheckResult> {
  const config = await loadSafeConfig(input.supabase);
  const reasons: string[] = [];
  const bypass = isHumanOrAuthBypass(input);

  // Modo manutenção
  if (config.maintenance_mode && !bypass) {
    reasons.push("maintenance_mode_active");
    return { allowed: false, dryRun: config.dry_run, reason: reasons[0], reasons, config };
  }

  // Circuit breaker
  if (config.circuit_breaker_open && !bypass) {
    reasons.push(`circuit_breaker_open:${config.circuit_reason ?? "unknown"}`);
    return { allowed: false, dryRun: config.dry_run, reason: reasons[0], reasons, config };
  }

  // Safe mode desligado → libera sem rate limits
  if (!config.safe_mode) {
    return { allowed: true, dryRun: config.dry_run, reasons, config };
  }

  // Bypass categórico ainda respeita dry-run
  if (bypass) {
    return { allowed: true, dryRun: config.dry_run, reasons, config };
  }

  const phone = String(input.contactPhone || "").replace(/\D/g, "");

  // Rate limit por hora (global)
  try {
    const { count: hourCount } = await input.supabase
      .from("whatsapp_template_logs")
      .select("id", { head: true, count: "exact" })
      .gte("sent_at", new Date(Date.now() - 3600 * 1000).toISOString())
      .eq("status", "sent");
    if ((hourCount ?? 0) >= config.max_per_hour) {
      reasons.push(`rate_limit_hour:${hourCount}/${config.max_per_hour}`);
    }
  } catch (_) {}

  // Rate limit por dia (global)
  try {
    const { count: dayCount } = await input.supabase
      .from("whatsapp_template_logs")
      .select("id", { head: true, count: "exact" })
      .gte("sent_at", new Date(Date.now() - 86400 * 1000).toISOString())
      .eq("status", "sent");
    if ((dayCount ?? 0) >= config.max_per_day) {
      reasons.push(`rate_limit_day:${dayCount}/${config.max_per_day}`);
    }
  } catch (_) {}

  // Rate limit por contato em 30 dias
  if (phone) {
    try {
      const { count: contactCount } = await input.supabase
        .from("whatsapp_template_logs")
        .select("id", { head: true, count: "exact" })
        .gte("sent_at", new Date(Date.now() - 30 * 86400 * 1000).toISOString())
        .eq("phone", phone)
        .eq("status", "sent");
      if ((contactCount ?? 0) >= config.max_per_contact_30d) {
        reasons.push(`rate_limit_contact:${contactCount}/${config.max_per_contact_30d}`);
      }
    } catch (_) {}
  }

  // Go-Live cap de contatos únicos nas últimas 24h
  const cap = GO_LIVE_CAPS[config.go_live_stage];
  if (!config.manual_override && cap !== null) {
    try {
      const { data: rows } = await input.supabase
        .from("whatsapp_template_logs")
        .select("phone")
        .gte("sent_at", new Date(Date.now() - 86400 * 1000).toISOString())
        .eq("status", "sent")
        .limit(2000);
      const unique = new Set((rows ?? []).map((r: any) => r.phone));
      if (!unique.has(phone) && unique.size >= cap) {
        reasons.push(`go_live_stage_cap:${unique.size}/${cap}`);
      }
    } catch (_) {}
  }

  const allowed = reasons.length === 0;
  return {
    allowed,
    dryRun: config.dry_run,
    reason: allowed ? undefined : reasons[0],
    reasons,
    config,
  };
}
