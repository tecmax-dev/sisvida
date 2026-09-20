import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { validateConsentForCurrentPhone, normalizeBrPhone } from "../_shared/whatsappConsentGate.ts";
import { requireStaff, authErrorResponse } from "../_shared/authGuard.ts";
import { chatwootMirrorTemplateSent } from "../_shared/chatwoot-client.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const BUILD = "APPT-REMINDER-URL-2026-09-11-A";
const PHONE_ID = "1213495528515111";
const WABA_ID = "2063797207822998";
// v6 = texto direto + aviso de bloqueio de 30 dias por falta sem cancelamento. Só envia template APROVADO.
const TEMPLATE_PREFERRED = "lembrete_consulta_v6";
const TEMPLATE_FALLBACK = "lembrete_consulta_v5";
const GRAPH = "https://graph.facebook.com/v21.0";

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: cors });

function randomToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function formatDatePt(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Sao_Paulo" });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    await requireStaff(req);
  } catch (authErr) {
    const denied = authErrorResponse(authErr, cors);
    if (denied) return denied;
    throw authErr;
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  const body = await req.json().catch(() => ({} as any));
  const appointmentId = String(body.appointmentId ?? "");
  const force = body.force === true; // reenvio manual explícito (staff)
  if (!appointmentId) return json({ ok: false, error: "APPOINTMENT_ID_REQUIRED", build: BUILD }, 400);

  const { data: appt, error: apptErr } = await admin
    .from("appointments")
    .select(
      "id, clinic_id, status, appointment_date, start_time, reminder_sent, confirmation_token, patient_id, dependent_id, " +
        "patient:patients(id, name, phone), dependent:patient_dependents(id, name), professional:professionals(id, name)",
    )
    .eq("id", appointmentId)
    .maybeSingle();

  if (apptErr || !appt) return json({ ok: false, error: "APPOINTMENT_NOT_FOUND", build: BUILD }, 404);

  if (["cancelled", "completed", "no_show"].includes(String(appt.status))) {
    return json({ ok: false, blocked: true, reason: "APPOINTMENT_NOT_ELIGIBLE", build: BUILD });
  }

  // Política: apenas UM lembrete por agendamento (sem follow-up automático).
  if (appt.reminder_sent && !force) {
    return json({ ok: false, blocked: true, reason: "REMINDER_ALREADY_SENT", build: BUILD });
  }

  const patient: any = appt.patient;
  const dependent: any = appt.dependent;
  const professional: any = appt.professional;
  const displayName = String(dependent?.name || patient?.name || "Associado");
  const { valid, e164 } = normalizeBrPhone(patient?.phone);
  if (!valid || !e164) {
    // Bloqueio explícito: evento sem telefone válido nunca deve ser enviado nem
    // contabilizado como tentativa — fail-closed com auditoria.
    await admin.from("whatsapp_compliance_logs").insert({
      intent: "APPOINTMENT_REMINDER",
      decision: "BLOCKED",
      metadata: { build: BUILD, appointment_id: appt.id, reason: "NO_VALID_PHONE" },
    });
    return json({ ok: false, blocked: true, reason: "INVALID_PHONE", build: BUILD });
  }

  // Opt-out da clínica tem precedência absoluta
  const { data: optOut } = await admin
    .from("whatsapp_opt_outs")
    .select("id")
    .eq("clinic_id", appt.clinic_id)
    .eq("phone", e164)
    .maybeSingle();

  if (optOut) {
    await admin.from("whatsapp_compliance_logs").insert({
      intent: "APPOINTMENT_REMINDER",
      decision: "BLOCKED",
      metadata: { build: BUILD, appointment_id: appt.id, reason: "OPT_OUT" },
    });
    return json({ ok: false, blocked: true, reason: "OPT_OUT", build: BUILD });
  }

  const gate = await validateConsentForCurrentPhone(admin, e164, { personId: patient?.id ?? null });
  if (!gate.allow) {
    await admin.from("whatsapp_compliance_logs").insert({
      intent: "APPOINTMENT_REMINDER",
      decision: "BLOCKED",
      metadata: { build: BUILD, appointment_id: appt.id, reasons: gate.reasons },
    });
    return json({ ok: false, blocked: true, reason: "NO_CONSENT", reasons: gate.reasons, build: BUILD });
  }

  // Token seguro do link oficial (confirmar / reagendar / cancelar fora do WhatsApp)
  let token = appt.confirmation_token as string | null;
  if (!token) {
    token = randomToken();
    const { error: tokenErr } = await admin
      .from("appointments")
      .update({ confirmation_token: token })
      .eq("id", appt.id);
    if (tokenErr) return json({ ok: false, error: "TOKEN_PERSIST_FAILED", details: tokenErr.message, build: BUILD }, 500);
  }

  const { data: secret } = await admin.rpc("get_meta_vault_secret", { _secret_name: "META_WHATSAPP_TOKEN_V2" });
  const metaToken = secret ? String(secret) : Deno.env.get("META_WHATSAPP_TOKEN_V2");
  if (!metaToken) return json({ ok: false, error: "META_TOKEN_NOT_CONFIGURED", build: BUILD }, 400);

  const bodyParams = [
    { type: "text", text: displayName.split(" ")[0] },
    { type: "text", text: formatDatePt(String(appt.appointment_date)) },
    { type: "text", text: String(appt.start_time).slice(0, 5) },
    { type: "text", text: String(professional?.name || "Profissional") },
  ];

  const sendOnce = async (templateName: string, withButton: boolean) => {
    const components: unknown[] = [{ type: "body", parameters: bodyParams }];
    if (withButton) {
      components.push({ type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: token }] });
    }
    const res = await fetch(`${GRAPH}/${PHONE_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${metaToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: e164,
        type: "template",
        template: { name: templateName, language: { code: "pt_BR" }, components },
      }),
    });
    let result: any = {};
    try { result = await res.json(); } catch { result = {}; }
    return { res, result };
  };

  // Usa a v5 (texto direto) quando a Meta já a aprovou; enquanto isso, continua a v4.
  // Nenhum envio acontece com template PENDING/REJECTED (fail-closed).
  const resolveApprovedTemplate = async (): Promise<string | null> => {
    for (const name of [TEMPLATE_PREFERRED, TEMPLATE_FALLBACK, "lembrete_consulta_v4"]) {
      try {
        const r = await fetch(
          `${GRAPH}/${WABA_ID}/message_templates?name=${name}&limit=5`,
          { headers: { Authorization: `Bearer ${metaToken}` } },
        );
        const b = await r.json().catch(() => ({} as any));
        const tpl = (b?.data ?? []).find((t: any) => t.name === name);
        if (tpl && String(tpl.status).toUpperCase() === "APPROVED") return name;
      } catch {
        // segue para a próxima versão
      }
    }
    return null;
  };

  const templateUsed = await resolveApprovedTemplate();
  if (!templateUsed) {
    await admin.from("whatsapp_compliance_logs").insert({
      intent: "APPOINTMENT_REMINDER",
      decision: "TEMPLATE_NOT_AVAILABLE",
      metadata: { build: BUILD, appointment_id: appt.id, preferred: TEMPLATE_PREFERRED, fallback: TEMPLATE_FALLBACK },
    });
    return json({ ok: false, blocked: true, reason: "TEMPLATE_NOT_APPROVED", build: BUILD });
  }

  const MAX_ATTEMPTS = 3;
  let res: Response | null = null;
  let result: any = {};
  let attemptsUsed = 0;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    attemptsUsed = attempt;
    const outcome = await sendOnce(templateUsed, true);
    res = outcome.res;
    result = outcome.result;

    if (res.ok) break;

    // Erros de validação/parâmetro/autorização (4xx, exceto 429) não melhoram
    // com nova tentativa — repetir só em indisponibilidade/limite temporário.
    if (res.status !== 429 && res.status < 500) break;

    if (attempt < MAX_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }

  if (!res) {
    return json({ ok: false, error: "SEND_NO_RESPONSE", build: BUILD }, 500);
  }

  // Confirmação REAL de envio: a Meta só retorna sucesso com um message id
  // presente em messages[0].id. Sem isso, mesmo com HTTP 200 não é sucesso —
  // evita o "falso sucesso" de marcar reminder_sent sem confirmação da Meta.
  const metaMessageId: string | null = result?.messages?.[0]?.id ?? null;
  const confirmedSent = res.ok && !!metaMessageId;

  if (!confirmedSent) {
    await admin.from("whatsapp_compliance_logs").insert({
      intent: "APPOINTMENT_REMINDER",
      decision: res.ok ? "SENT_UNCONFIRMED" : "TEMPLATE_NOT_AVAILABLE",
      metadata: { build: BUILD, appointment_id: appt.id, template: templateUsed, http: res.status, response: result, attempts: attemptsUsed },
    });
    return json({
      ok: false,
      blocked: true,
      reason: res.ok ? "SEND_NOT_CONFIRMED" : "TEMPLATE_NOT_APPROVED",
      template: templateUsed,
      http: res.status,
      result,
      attempts: attemptsUsed,
      build: BUILD,
    }, 200);
  }

  await admin.from("whatsapp_compliance_logs").insert({
    intent: "APPOINTMENT_REMINDER",
    decision: "SENT",
    metadata: { build: BUILD, appointment_id: appt.id, template: templateUsed, http: res.status, response: result, message_id: metaMessageId, attempts: attemptsUsed },
  });

  await admin.from("appointments").update({ reminder_sent: true }).eq("id", appt.id);

  // Espelha no Chatwoot (nota privada) para o atendente ver o histórico.
  await chatwootMirrorTemplateSent(
    admin as any,
    String(appt.clinic_id),
    e164,
    patient?.name ?? displayName,
    `[Lembrete de consulta enviado pelo WhatsApp oficial]\n` +
      `Paciente: ${displayName}\n` +
      `Data: ${formatDatePt(String(appt.appointment_date))} às ${String(appt.start_time).slice(0, 5)}\n` +
      `Profissional: ${String(professional?.name || "Profissional")}\n` +
      `Template: ${templateUsed}`,
  );

  return json({ ok: true, http: res.status, template: templateUsed, result, message_id: metaMessageId, attempts: attemptsUsed, build: BUILD });
});
