import { supabase } from "@/integrations/supabase/client";

export const WHATSAPP_CONSENT_TERM_VERSION = "whatsapp_operational_v1_2026";
export const WHATSAPP_CONSENT_TEXT =
  "Autorizo o Sindicato a utilizar meu número de WhatsApp para comunicações relacionadas ao meu cadastro, carteirinha, atendimentos, agendamentos e serviços solicitados, conforme a Política de Privacidade.";

function digits(v?: string | null) {
  return String(v ?? "").replace(/\D/g, "");
}

/** Retorna true se existe consentimento ativo (não revogado) para a pessoa. */
export async function loadWhatsappConsent(personId?: string | null): Promise<boolean> {
  if (!personId) return false;
  const { data, error } = await supabase
    .from("whatsapp_consents")
    .select("id")
    .eq("person_id", personId)
    .eq("consent_status", "granted")
    .is("revoked_at", null)
    .limit(1);
  if (error) {
    console.error("[whatsappConsent] erro ao carregar:", error);
    return false;
  }
  return !!data?.length;
}

/**
 * Persiste o consentimento presencial do associado.
 * granted=true -> cria registro se ainda não houver ativo para o telefone atual.
 * granted=false -> revoga registros ativos da pessoa.
 */
export async function persistWhatsappConsent(params: {
  clinicId?: string | null;
  patientId?: string | null;
  phone?: string | null;
  name?: string | null;
  granted: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const { clinicId, patientId, granted } = params;
  const phone = digits(params.phone);
  if (!patientId) return { ok: false, error: "Paciente inválido" };

  try {
    const { data: active, error: readErr } = await supabase
      .from("whatsapp_consents")
      .select("id, phone")
      .eq("person_id", patientId)
      .eq("consent_status", "granted")
      .is("revoked_at", null);

    if (readErr) throw readErr;

    if (!granted) {
      if (active?.length) {
        const { error: revokeErr } = await supabase
          .from("whatsapp_consents")
          .update({
            consent_status: "revoked",
            revoked_at: new Date().toISOString(),
            revoked_reason: "Revogado no cadastro presencial",
          })
          .in("id", active.map((r) => r.id));
        if (revokeErr) throw revokeErr;
      }
      return { ok: true };
    }

    if (!phone || phone.length < 10) {
      return { ok: false, error: "Telefone inválido para registrar consentimento" };
    }

    const already = (active || []).some((r) => digits(r.phone).endsWith(phone.slice(-11)));
    if (already) return { ok: true };

    // telefone mudou: revoga o consentimento antigo antes de gravar o novo
    if (active?.length) {
      await supabase
        .from("whatsapp_consents")
        .update({
          consent_status: "revoked",
          revoked_at: new Date().toISOString(),
          revoked_reason: "Telefone alterado no cadastro",
        })
        .in("id", active.map((r) => r.id));
    }

    const { error: insertErr } = await supabase.from("whatsapp_consents").insert({
      tenant_id: clinicId || null,
      person_id: patientId,
      phone: phone.startsWith("55") ? phone : `55${phone}`,
      name: params.name || null,
      consent_status: "granted",
      purpose: "SERVICE_OPERATIONAL",
      source: "PRESENCIAL",
      term_version: WHATSAPP_CONSENT_TERM_VERSION,
      consent_text: WHATSAPP_CONSENT_TEXT,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    });
    if (insertErr) throw insertErr;

    return { ok: true };
  } catch (e: any) {
    console.error("[whatsappConsent] erro ao salvar:", e);
    return { ok: false, error: e?.message || "Falha ao salvar consentimento" };
  }
}
