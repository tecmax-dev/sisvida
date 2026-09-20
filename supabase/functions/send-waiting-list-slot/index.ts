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

const BUILD = "WAITLIST-SLOT-2026-09-11-A";
const PHONE_ID = "1213495528515111";
const TEMPLATE_NAME = "vaga_disponivel_v1";
const GRAPH = "https://graph.facebook.com/v21.0";

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: cors });

function formatDatePt(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "America/Sao_Paulo",
  });
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
  const waitingListId = String(body.waitingListId ?? "");
  const appointmentDate = String(body.appointmentDate ?? "");
  const startTime = String(body.startTime ?? "");
  const professionalName = String(body.professionalName ?? "Profissional");
  const professionalId = body.professionalId ? String(body.professionalId) : null;

  if (!waitingListId || !appointmentDate || !startTime) {
    return json({ ok: false, error: "MISSING_PARAMS", build: BUILD }, 400);
  }

  const { data: entry, error: entryErr } = await admin
    .from("waiting_list")
    .select("id, clinic_id, patient_id, is_active, patient:patients(id, name, phone)")
    .eq("id", waitingListId)
    .maybeSingle();

  if (entryErr || !entry) return json({ ok: false, error: "WAITING_LIST_ENTRY_NOT_FOUND", build: BUILD }, 404);

  const patient: any = (entry as any).patient;
  const displayName = String(patient?.name || "Associado");
  const { valid, e164 } = normalizeBrPhone(patient?.phone);
  if (!valid || !e164) return json({ ok: false, blocked: true, reason: "INVALID_PHONE", build: BUILD });

  // Opt-out tem precedência absoluta
  const { data: optOut } = await admin
    .from("whatsapp_opt_outs")
    .select("id")
    .eq("clinic_id", entry.clinic_id)
    .eq("phone", e164)
    .maybeSingle();

  if (optOut) {
    await admin.from("whatsapp_compliance_logs").insert({
      intent: "WAITING_LIST_SLOT",
      decision: "BLOCKED",
      metadata: { build: BUILD, waiting_list_id: entry.id, reason: "OPT_OUT" },
    });
    return json({ ok: false, blocked: true, reason: "OPT_OUT", build: BUILD });
  }

  const gate = await validateConsentForCurrentPhone(admin, e164, { personId: patient?.id ?? null });
  if (!gate.allow) {
    await admin.from("whatsapp_compliance_logs").insert({
      intent: "WAITING_LIST_SLOT",
      decision: "BLOCKED",
      metadata: { build: BUILD, waiting_list_id: entry.id, reasons: gate.reasons },
    });
    return json({ ok: false, blocked: true, reason: "NO_CONSENT", reasons: gate.reasons, build: BUILD });
  }

  const { data: secret } = await admin.rpc("get_meta_vault_secret", { _secret_name: "META_WHATSAPP_TOKEN_V2" });
  const metaToken = secret ? String(secret) : Deno.env.get("META_WHATSAPP_TOKEN_V2");
  if (!metaToken) return json({ ok: false, error: "META_TOKEN_NOT_CONFIGURED", build: BUILD }, 400);

  const parameters = [
    { type: "text", text: displayName.split(" ")[0] },
    { type: "text", text: formatDatePt(appointmentDate) },
    { type: "text", text: startTime.slice(0, 5) },
    { type: "text", text: professionalName },
  ];

  const res = await fetch(`${GRAPH}/${PHONE_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${metaToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: e164,
      type: "template",
      template: { name: TEMPLATE_NAME, language: { code: "pt_BR" }, components: [{ type: "body", parameters }] },
    }),
  });
  const result = await res.json().catch(() => ({}));

  await admin.from("whatsapp_compliance_logs").insert({
    intent: "WAITING_LIST_SLOT",
    decision: res.ok ? "SENT" : "TEMPLATE_NOT_AVAILABLE",
    metadata: { build: BUILD, waiting_list_id: entry.id, template: TEMPLATE_NAME, http: res.status, response: result },
  });

  if (!res.ok) {
    return json({ ok: false, blocked: true, reason: "TEMPLATE_NOT_APPROVED", http: res.status, result, build: BUILD });
  }

  const nowIso = new Date().toISOString();
  await admin
    .from("waiting_list")
    .update({
      notification_status: "notified",
      notified_at: nowIso,
      slot_offered_at: nowIso,
      offered_appointment_date: appointmentDate,
      offered_appointment_time: startTime,
      offered_professional_id: professionalId,
      offered_professional_name: professionalName,
    })
    .eq("id", entry.id);

  return json({ ok: true, patientName: displayName, template: TEMPLATE_NAME, result, build: BUILD });
});
