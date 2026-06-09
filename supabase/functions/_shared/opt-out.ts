// Shared helper: Meta WhatsApp opt-out enforcement.
// Use BEFORE any outbound message to the sindicato number to avoid
// "Block Rate" violations that lead to Meta number bans.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

let _client: SupabaseClient | null = null;
function sb(): SupabaseClient {
  if (!_client) _client = createClient(SB_URL, SB_SERVICE);
  return _client;
}

/** Exact (case-insensitive, trimmed) keywords that trigger opt-out. */
export const OPT_OUT_KEYWORDS = ["PARAR", "SAIR", "CANCELAR", "STOP", "DESCADASTRAR", "UNSUBSCRIBE"];

/** Exact keywords that re-enable messages (used inside human assist window). */
export const OPT_IN_KEYWORDS = ["VOLTAR", "REATIVAR", "OPTIN", "OPT-IN"];

export function normalizePhone(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return null;
  return digits.startsWith("55") ? digits : `55${digits}`;
}

export function isOptOutKeyword(text: unknown): boolean {
  if (!text) return false;
  const t = String(text).trim().toUpperCase();
  return OPT_OUT_KEYWORDS.includes(t);
}

export function isOptInKeyword(text: unknown): boolean {
  if (!text) return false;
  const t = String(text).trim().toUpperCase();
  return OPT_IN_KEYWORDS.includes(t);
}

/** Returns true if (clinic_id, phone) currently has an active opt-out. */
export async function isOptedOut(clinicId: string, phone: string): Promise<boolean> {
  const p = normalizePhone(phone);
  if (!p || !clinicId) return false;
  const { data, error } = await sb()
    .from("whatsapp_opt_outs")
    .select("id, reactivated_at")
    .eq("clinic_id", clinicId)
    .eq("phone", p)
    .is("reactivated_at", null)
    .maybeSingle();
  if (error) {
    console.error("[opt-out] lookup error:", error);
    return false; // fail-open so transactional flows don't break silently
  }
  return !!data?.id;
}

export async function registerOptOut(params: {
  clinicId: string;
  phone: string;
  reason?: string;
  source?: string;
}): Promise<void> {
  const p = normalizePhone(params.phone);
  if (!p || !params.clinicId) return;
  const { error } = await sb()
    .from("whatsapp_opt_outs")
    .upsert(
      {
        clinic_id: params.clinicId,
        phone: p,
        reason: params.reason ?? null,
        source: params.source ?? "user_reply",
        opted_out_at: new Date().toISOString(),
        reactivated_at: null,
        reactivated_by: null,
      },
      { onConflict: "clinic_id,phone" },
    );
  if (error) console.error("[opt-out] register error:", error);
  await logPolicyEvent({
    clinicId: params.clinicId,
    phone: p,
    event: "opt_out_registered",
    sourceFunction: params.source,
    payload: { reason: params.reason ?? null },
  });
}

export async function registerOptIn(params: {
  clinicId: string;
  phone: string;
  source?: string;
  by?: string | null;
}): Promise<void> {
  const p = normalizePhone(params.phone);
  if (!p || !params.clinicId) return;
  const { error } = await sb()
    .from("whatsapp_opt_outs")
    .update({
      reactivated_at: new Date().toISOString(),
      reactivated_by: params.by ?? null,
    })
    .eq("clinic_id", params.clinicId)
    .eq("phone", p)
    .is("reactivated_at", null);
  if (error) console.error("[opt-out] opt-in error:", error);
  await logPolicyEvent({
    clinicId: params.clinicId,
    phone: p,
    event: "opt_in_registered",
    sourceFunction: params.source,
  });
}

export async function logPolicyEvent(params: {
  clinicId?: string | null;
  phone?: string | null;
  event: string;
  metaErrorCode?: string | null;
  templateName?: string | null;
  sourceFunction?: string | null;
  payload?: Record<string, unknown>;
}): Promise<void> {
  try {
    const { error } = await sb()
      .from("whatsapp_policy_events")
      .insert({
        clinic_id: params.clinicId ?? null,
        phone: params.phone ? normalizePhone(params.phone) : null,
        event: params.event,
        meta_error_code: params.metaErrorCode ?? null,
        template_name: params.templateName ?? null,
        source_function: params.sourceFunction ?? null,
        payload: params.payload ?? {},
      });
    if (error) console.error("[policy-event] insert error:", error);
  } catch (err) {
    console.error("[policy-event] unhandled:", err);
  }
}

/**
 * Convenience guard for outbound senders. Returns true when send must be
 * skipped (already opted out). Logs the skip automatically.
 */
export async function blockedByOptOut(params: {
  clinicId: string;
  phone: string;
  templateName?: string;
  sourceFunction?: string;
}): Promise<boolean> {
  const opted = await isOptedOut(params.clinicId, params.phone);
  if (opted) {
    await logPolicyEvent({
      clinicId: params.clinicId,
      phone: params.phone,
      event: "blocked_by_opt_out",
      templateName: params.templateName,
      sourceFunction: params.sourceFunction,
    });
  }
  return opted;
}
