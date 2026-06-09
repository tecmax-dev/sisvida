// Gate único de envio WhatsApp — chamado por TODA edge function antes do POST
// para a Graph API da Meta. Centraliza opt-out, opt-in, score, frequência,
// categoria e relacionamento, e registra o resultado em whatsapp_template_logs.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCanonicalTemplate, isCanonical } from "./template-catalog.ts";
import { normalizePhone, logPolicyEvent } from "./opt-out.ts";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

let _client: SupabaseClient | null = null;
function sb(): SupabaseClient {
  if (!_client) _client = createClient(SB_URL, SB_SERVICE);
  return _client;
}

export interface SendGateInput {
  clinicId: string;
  phone: string;
  templateName: string;
  triggeredBy?: string;          // nome da edge function ou user uuid
  minScore?: number;             // default 40 (conservador, alinhado Meta)
  /**
   * Se true, permite enviar mesmo se o template não estiver no catálogo
   * (usado durante migração; emite log de aviso). Default false.
   */
  allowUncatalogued?: boolean;
}

export interface SendGateResult {
  allowed: boolean;
  reason: string;
  score: number;
  category?: string;
  purpose?: string;
}

/**
 * Verifica se um envio é permitido. NÃO grava log de "sent" — esse passo
 * fica a cargo de recordSent() após o POST à Meta. Mas grava sempre o log
 * de bloqueio quando applicable.
 */
export async function assertCanSend(input: SendGateInput): Promise<SendGateResult> {
  const phone = normalizePhone(input.phone);
  const tpl = getCanonicalTemplate(input.templateName);

  if (!phone) {
    return { allowed: false, reason: "invalid_phone", score: 0 };
  }

  if (!tpl) {
    if (!input.allowUncatalogued) {
      await recordBlock({
        clinicId: input.clinicId,
        phone,
        templateName: input.templateName,
        reason: "blocked_deprecated_template",
        triggeredBy: input.triggeredBy,
      });
      return { allowed: false, reason: "blocked_deprecated_template", score: 0 };
    }
  }

  const { data, error } = await sb().rpc("wa_can_send", {
    _clinic_id: input.clinicId,
    _phone: phone,
    _template: input.templateName,
    _category: tpl?.category ?? "UTILITY",
    _purpose: tpl?.purpose ?? input.templateName,
    _min_score: input.minScore ?? 40,
  });

  if (error) {
    console.error("[send-gate] wa_can_send error:", error);
    // fail-closed: bloqueia se gate quebrar
    return { allowed: false, reason: "gate_error", score: 0 };
  }

  const result = data as { allowed: boolean; reason: string; score: number };

  if (!result.allowed) {
    await recordBlock({
      clinicId: input.clinicId,
      phone,
      templateName: input.templateName,
      reason: result.reason,
      score: result.score,
      triggeredBy: input.triggeredBy,
      category: tpl?.category,
      purpose: tpl?.purpose,
    });
  }

  return {
    allowed: result.allowed,
    reason: result.reason,
    score: result.score,
    category: tpl?.category,
    purpose: tpl?.purpose,
  };
}

async function recordBlock(p: {
  clinicId: string;
  phone: string;
  templateName: string;
  reason: string;
  score?: number;
  triggeredBy?: string;
  category?: string;
  purpose?: string;
}) {
  try {
    await sb().from("whatsapp_template_logs").insert({
      clinic_id: p.clinicId,
      phone: p.phone,
      template_name: p.templateName,
      category: p.category ?? null,
      purpose: p.purpose ?? null,
      status: p.reason.startsWith("blocked_") ? p.reason : `blocked_${p.reason}`,
      reason: p.reason,
      triggered_by: p.triggeredBy ?? null,
      interaction_score_at_send: p.score ?? null,
    });
    await logPolicyEvent({
      clinicId: p.clinicId,
      phone: p.phone,
      event: p.reason,
      templateName: p.templateName,
      sourceFunction: p.triggeredBy,
    });
  } catch (err) {
    console.error("[send-gate] recordBlock failed:", err);
  }
}

/** Grava sucesso após POST à Meta. */
export async function recordSent(p: {
  clinicId: string;
  phone: string;
  templateName: string;
  metaMessageId?: string | null;
  triggeredBy?: string;
  score?: number;
  payload?: Record<string, unknown>;
}) {
  const phone = normalizePhone(p.phone);
  if (!phone) return;
  const tpl = getCanonicalTemplate(p.templateName);
  try {
    await sb().from("whatsapp_template_logs").insert({
      clinic_id: p.clinicId,
      phone,
      template_name: p.templateName,
      category: tpl?.category ?? null,
      purpose: tpl?.purpose ?? null,
      status: "sent",
      meta_message_id: p.metaMessageId ?? null,
      triggered_by: p.triggeredBy ?? null,
      interaction_score_at_send: p.score ?? null,
      payload: p.payload ?? {},
    });
    await sb()
      .from("contact_preferences")
      .upsert(
        {
          clinic_id: p.clinicId,
          phone,
          last_template_sent_at: new Date().toISOString(),
          last_template_name: p.templateName,
        },
        { onConflict: "clinic_id,phone" },
      );
  } catch (err) {
    console.error("[send-gate] recordSent failed:", err);
  }
}

/** Grava falha reportada pela Meta. */
export async function recordFailure(p: {
  clinicId: string;
  phone: string;
  templateName: string;
  metaErrorCode?: string;
  reason?: string;
  triggeredBy?: string;
  payload?: Record<string, unknown>;
}) {
  const phone = normalizePhone(p.phone);
  if (!phone) return;
  const tpl = getCanonicalTemplate(p.templateName);
  try {
    await sb().from("whatsapp_template_logs").insert({
      clinic_id: p.clinicId,
      phone,
      template_name: p.templateName,
      category: tpl?.category ?? null,
      purpose: tpl?.purpose ?? null,
      status: "failed",
      reason: p.reason ?? null,
      meta_error_code: p.metaErrorCode ?? null,
      triggered_by: p.triggeredBy ?? null,
      failed_at: new Date().toISOString(),
      payload: p.payload ?? {},
    });
  } catch (err) {
    console.error("[send-gate] recordFailure failed:", err);
  }
}

export { isCanonical, getCanonicalTemplate };
