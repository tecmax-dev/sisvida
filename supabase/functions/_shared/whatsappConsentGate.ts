// GATE DE CONSENTIMENTO WHATSAPP — VINCULAÇÃO AO TELEFONE ATUAL
// Regra: só é permitido enviar se existir consentimento ATIVO gravado
// para EXATAMENTE o telefone atual do destinatário (normalizado E.164/BR).
// Consentimento gravado para outro número NÃO é válido (CONSENT_PHONE_MISMATCH).
// Nunca faz backfill, nunca cria consentimento, nunca envia mensagem.

export type ConsentDecision = {
  allow: boolean;
  reasons: string[];
  phone_e164: string | null;
  phone_valid: boolean;
  consent_found: boolean;
  consent_phone_matches: boolean;
  consent_id: string | null;
  consent_source: string | null;
  consent_term_version: string | null;
  consent_phone_stored: string | null;
  opt_out: boolean;
};

export function normalizeBrPhone(raw: unknown): { valid: boolean; e164: string | null } {
  const d = String(raw ?? "").replace(/\D/g, "");
  if (!d) return { valid: false, e164: null };
  const n = d.startsWith("55") ? d : `55${d}`;
  // 55 + DDD(2) + 8 ou 9 dígitos
  if (n.length < 12 || n.length > 13) return { valid: false, e164: null };
  // celular brasileiro válido para WhatsApp deve ter 9 dígitos (13 no total)
  return { valid: n.length === 13, e164: n };
}

function phoneVariants(e164: string): string[] {
  const local = e164.slice(2);
  const set = new Set<string>([e164, `+${e164}`, local]);
  if (local.length === 11) set.add(local.slice(0, 2) + local.slice(3)); // sem o 9
  return [...set];
}

/**
 * Valida se o consentimento gravado corresponde ao telefone ATUAL.
 * Deve ser chamado imediatamente antes de qualquer POST de mensagem.
 */
export async function validateConsentForCurrentPhone(
  supabase: any,
  currentPhone: unknown,
  opts: { personId?: string | null; tenantId?: string | null } = {},
): Promise<ConsentDecision> {
  const reasons: string[] = [];
  const { valid, e164 } = normalizeBrPhone(currentPhone);

  const decision: ConsentDecision = {
    allow: false,
    reasons,
    phone_e164: e164,
    phone_valid: valid,
    consent_found: false,
    consent_phone_matches: false,
    consent_id: null,
    consent_source: null,
    consent_term_version: null,
    consent_phone_stored: null,
    opt_out: false,
  };

  if (!valid || !e164) {
    reasons.push("PHONE_INVALID");
    return decision;
  }

  const variants = phoneVariants(e164);

  // 1) Consentimento ativo gravado para o telefone ATUAL
  let consentQuery = supabase
    .from("whatsapp_consents")
    .select("id,phone,consent_status,revoked_at,term_version,source,person_id,tenant_id,created_at")
    .in("phone", variants);
  if (opts.tenantId) consentQuery = consentQuery.eq("tenant_id", opts.tenantId);
  const { data: rows } = await consentQuery
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(1);

  const row = rows?.[0] ?? null;
  if (row) {
    decision.consent_found = true;
    decision.consent_id = row.id ?? null;
    decision.consent_source = row.source ?? null;
    decision.consent_term_version = row.term_version ?? null;
    decision.consent_phone_stored = row.phone ?? null;
    const granted = String(row.consent_status ?? "").toLowerCase() === "granted";
    const samePhone = normalizeBrPhone(row.phone).e164 === e164;
    decision.consent_phone_matches = samePhone;
    if (!granted) reasons.push("CONSENT_NOT_GRANTED");
    if (!samePhone) reasons.push("CONSENT_PHONE_MISMATCH");
  } else {
    // Existe consentimento da pessoa, mas para outro número? -> mismatch explícito
    if (opts.personId) {
      let otherQuery = supabase
        .from("whatsapp_consents")
        .select("id,phone")
        .eq("person_id", opts.personId);
      if (opts.tenantId) otherQuery = otherQuery.eq("tenant_id", opts.tenantId);
      const { data: other } = await otherQuery
        .is("revoked_at", null)
        .order("created_at", { ascending: false })
        .limit(1);
      if (other?.[0]) {
        decision.consent_phone_stored = other[0].phone ?? null;
        reasons.push("CONSENT_PHONE_MISMATCH");
      }
    }
    if (!reasons.includes("CONSENT_PHONE_MISMATCH")) reasons.push("CONSENT_MISSING");
  }

  // 2) Opt-out do telefone atual
  let optOutQuery = supabase
    .from("whatsapp_opt_outs")
    .select("id")
    .in("phone", variants);
  if (opts.tenantId) optOutQuery = optOutQuery.eq("clinic_id", opts.tenantId);
  const { data: outs } = await optOutQuery
    .is("reactivated_at", null)
    .limit(1);
  if (outs?.length) {
    decision.opt_out = true;
    reasons.push("OPT_OUT");
  }

  decision.allow = reasons.length === 0;
  return decision;
}
