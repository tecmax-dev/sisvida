// HOMOLOGACAO DRY RUN — READ ONLY. ZERO ENVIO. ZERO ESCRITA NA META.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { validateConsentForCurrentPhone } from "../_shared/whatsappConsentGate.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CANONICAL_WABA = "2063797207822998";
const CANONICAL_PHONE_NUMBER_ID = "1213495528515111";
const TEMPLATE_NAME = "homologacao_confirmada";
const TEMPLATE_LANG = "pt_BR";
const GRAPH = "https://graph.facebook.com/v21.0";

const onlyDigits = (s: string) => (s || "").replace(/\D/g, "");
function normalizePhone(raw: string | null): { valid: boolean; e164: string | null } {
  const d = onlyDigits(raw || "");
  if (!d) return { valid: false, e164: null };
  let n = d;
  if (!n.startsWith("55")) n = "55" + n;
  // 55 + DDD(2) + 8/9 digits
  if (n.length < 12 || n.length > 13) return { valid: false, e164: null };
  return { valid: true, e164: n };
}

const fmtDate = (d: string) => {
  const [y, m, day] = (d || "").split("-");
  return y ? `${day}/${m}/${y}` : "";
};
const fmtTime = (t: string) => (t || "").slice(0, 5);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json().catch(() => ({}));
    const appointmentId: string | undefined = body.appointment_id;
    const limit: number = Math.min(Number(body.limit) || 3, 10);

    // 1. READ-ONLY: template status na Meta
    const token = Deno.env.get("META_WHATSAPP_TOKEN_V2");
    let templateApproved = false;
    let templateMeta: any = null;
    if (token) {
      const r = await fetch(
        `${GRAPH}/${CANONICAL_WABA}/message_templates?name=${TEMPLATE_NAME}&limit=5`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const j = await r.json();
      templateMeta = (j?.data || []).find((t: any) => t.name === TEMPLATE_NAME && t.language === TEMPLATE_LANG) || null;
      templateApproved = templateMeta?.status === "APPROVED";
    }

    // 2. Agendamentos confirmados
    let q = supabase
      .from("homologacao_appointments")
      .select("*")
      .in("status", ["confirmed", "scheduled"])
      .order("appointment_date", { ascending: false })
      .limit(limit);
    if (appointmentId) q = supabase.from("homologacao_appointments").select("*").eq("id", appointmentId);
    const { data: appts, error } = await q;
    if (error) throw error;

    const recipients: any[] = [];

    for (const a of appts || []) {
      const local = a.notes?.match(/local:\s*(.+)/i)?.[1] || "Sede do Sindicato";
      const protocol = a.protocol_number || "SEM_PROTOCOLO";

      const targets = [
        { type: "employee", name: a.employee_name, phone: a.employee_phone, consentCache: a.employee_whatsapp_consent },
        { type: "employer", name: a.company_contact_name || a.company_name, phone: a.company_phone, consentCache: a.company_whatsapp_consent },
      ];

      for (const t of targets) {
        const p = normalizePhone(t.phone);
        // Gate: consentimento deve corresponder ao TELEFONE ATUAL
        const gate = await validateConsentForCurrentPhone(supabase, t.phone);
        const consent = gate.allow || (gate.consent_found && gate.consent_phone_matches && !gate.opt_out)
          ? "GRANTED"
          : "BLOCKED";
        const consentEvidence = gate.consent_found && gate.consent_phone_matches;
        const consentMismatch = gate.reasons.includes("CONSENT_PHONE_MISMATCH");
        const optOut = gate.opt_out;

        const idemKey = `HOMOLOGACAO_CONFIRMED:${a.id}:${t.type}`;
        const { data: idem } = await supabase
          .from("whatsapp_delivery_idempotency")
          .select("id")
          .eq("key", idemKey)
          .limit(1);
        const idempotency = idem && idem.length ? "DUPLICATE" : "NEW";

        // Token/URL segura — DRY RUN: apenas simulação, sem persistir
        const { data: existingTok } = await supabase
          .from("homologacao_access_tokens")
          .select("token,expires_at")
          .eq("appointment_id", a.id)
          .eq("recipient_type", t.type)
          .gt("expires_at", new Date().toISOString())
          .limit(1);
        const simulatedToken = existingTok?.[0]?.token || `DRYRUN-${crypto.randomUUID()}`;
        const urlSuffix = `${simulatedToken}`;
        const secureUrl = `https://sindexa.com.br/homologacao/consulta?t=${urlSuffix}`;

        const params = [
          t.name || "",
          fmtDate(a.appointment_date),
          fmtTime(a.start_time),
          local,
          protocol,
        ];
        const paramsValid = params.every((v) => v && String(v).trim().length > 0 && !/\n|\t|\s{5,}/.test(String(v)));
        const urlParamValid = /^[A-Za-z0-9._~-]+$/.test(urlSuffix);

        const blockReasons: string[] = [];
        if (!p.valid) blockReasons.push("PHONE_INVALID");
        if (consent !== "GRANTED") blockReasons.push(consentMismatch ? "CONSENT_PHONE_MISMATCH" : "CONSENT_MISSING");
        if (optOut) blockReasons.push("OPT_OUT");
        if (!templateApproved) blockReasons.push("TEMPLATE_NOT_APPROVED");
        if (idempotency === "DUPLICATE") blockReasons.push("ALREADY_DELIVERED");
        if (!paramsValid) blockReasons.push("TEMPLATE_PARAMETERS_INVALID");
        if (!urlParamValid) blockReasons.push("DYNAMIC_URL_PARAMETER_INVALID");

        const payload = {
          messaging_product: "whatsapp",
          to: p.e164,
          type: "template",
          template: {
            name: TEMPLATE_NAME,
            language: { code: TEMPLATE_LANG },
            components: [
              { type: "body", parameters: params.map((text) => ({ type: "text", text: String(text) })) },
              { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: urlSuffix }] },
            ],
          },
        };

        recipients.push({
          appointment_id: a.id,
          RECIPIENT_TYPE: t.type,
          PHONE_VALID: p.valid ? "SIM" : "NÃO",
          PHONE_MASKED: p.e164 ? p.e164.slice(0, 4) + "****" + p.e164.slice(-2) : null,
          CONSENT: consent,
          CONSENT_EVIDENCE: consentEvidence ? "SIM" : "NÃO",
          CONSENT_PHONE_MATCHES_CURRENT: gate.consent_phone_matches ? "SIM" : "NÃO",
          CONSENT_PHONE_STORED: gate.consent_phone_stored,
          OPT_OUT: optOut ? "SIM" : "NÃO",
          TEMPLATE_APPROVED: templateApproved ? "SIM" : "NÃO",
          IDEMPOTENCY: idempotency,
          SECURE_URL: urlParamValid ? "READY" : "BLOCKED",
          SECURE_URL_PREVIEW: secureUrl,
          TEMPLATE_PARAMETERS: paramsValid ? "VALID" : "INVALID",
          DECISION: blockReasons.length ? "BLOCK" : "ALLOW",
          REASON: blockReasons.length ? blockReasons.join(",") : "ALL_GATES_PASSED",
          META_SEND_PAYLOAD: payload,
        });
      }
    }

    const anyAllow = recipients.some((r) => r.DECISION === "ALLOW");

    return new Response(
      JSON.stringify({
        DRY_RUN: true,
        TEMPLATE: TEMPLATE_NAME,
        META_TEMPLATE_ID: templateMeta?.id || null,
        META_STATUS: templateMeta?.status || "UNKNOWN",
        TEMPLATE_COMPONENTS: templateMeta?.components || null,
        WABA: CANONICAL_WABA,
        PHONE_NUMBER_ID: CANONICAL_PHONE_NUMBER_ID,
        TOKEN_SOURCE: "META_WHATSAPP_TOKEN_V2",
        APPOINTMENTS_EVALUATED: appts?.length || 0,
        RECIPIENTS: recipients,
        META_POST_MESSAGES: 0,
        WHATSAPP_SENT: 0,
        STATUS: anyAllow ? "PRONTO_PARA_TESTE_REAL_CONTROLADO" : "CORRECAO_NECESSARIA",
      }, null, 2),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ DRY_RUN: true, error: String(e), WHATSAPP_SENT: 0 }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
