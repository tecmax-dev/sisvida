import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { validateConsentForCurrentPhone, normalizeBrPhone } from "../_shared/whatsappConsentGate.ts";
import { requireStaff, authErrorResponse } from "../_shared/authGuard.ts";
import { chatwootMirrorTemplateSent } from "../_shared/chatwoot-client.ts";
import { listFreeSlots } from "../_shared/free-slots.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const BUILD = "WAITLIST-SLOT-2026-10-09-FREED";
const PHONE_ID = "1213495528515111";
const WABA_ID = "2063797207822998";
const TEMPLATE_NAME = "vaga_disponivel_v1";
const OPTIONS_TEMPLATE = "vaga_disponivel_opcoes_v1";
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
    .select("id, clinic_id, patient_id, professional_id, is_active, patient:patients(id, name, phone)")
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

  // Novo fluxo: link com TODAS as vagas livres (15 dias) para o associado escolher.
  // Só usa o modelo novo se a Meta já o aprovou (consulta somente leitura); senão mantém o modelo antigo.
  const profId = professionalId || (entry as any).professional_id || null;
  let usedTemplate = TEMPLATE_NAME;
  let res: Response | null = null;
  let freeCount = 0;
  if (profId) {
    const tplRes = await fetch(`${GRAPH}/${WABA_ID}/message_templates?name=${OPTIONS_TEMPLATE}&fields=name,status`, {
      headers: { Authorization: `Bearer ${metaToken}` },
    }).then((r) => r.json()).catch(() => ({}));
    const approved = (tplRes?.data || []).some((t: any) => t.name === OPTIONS_TEMPLATE && t.status === "APPROVED");
    const slots = await listFreeSlots(admin, String(entry.clinic_id), profId, 15, { date: appointmentDate, time: startTime });
    freeCount = slots.length;
    if (approved && freeCount > 0) {
      const raw = crypto.getRandomValues(new Uint8Array(32));
      const token = btoa(String.fromCharCode(...raw)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      const hashBuf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
      const tokenHash = [...new Uint8Array(hashBuf)].map((b) => b.toString(16).padStart(2, "0")).join("");
      await admin.from("waiting_list_pick_tokens").insert({
        token_hash: tokenHash, waiting_list_id: entry.id, clinic_id: entry.clinic_id,
        patient_id: entry.patient_id, professional_id: profId,
        expires_at: new Date(Date.now() + 24 * 3600_000).toISOString(),
      });
      usedTemplate = OPTIONS_TEMPLATE;
      res = await fetch(`${GRAPH}/${PHONE_ID}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${metaToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp", recipient_type: "individual", to: e164, type: "template",
          template: {
            name: OPTIONS_TEMPLATE, language: { code: "pt_BR" },
            components: [
              { type: "body", parameters: [
                { type: "text", text: displayName.split(" ")[0] },
                { type: "text", text: professionalName },
              ] },
              { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: token }] },
            ],
          },
        }),
      });
    }
  }

  if (!res) {
    const parameters = [
      { type: "text", text: displayName.split(" ")[0] },
      { type: "text", text: formatDatePt(appointmentDate) },
      { type: "text", text: startTime.slice(0, 5) },
      { type: "text", text: professionalName },
    ];
    res = await fetch(`${GRAPH}/${PHONE_ID}/messages`, {
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
  }
  const result = await res.json().catch(() => ({}));

  await admin.from("whatsapp_compliance_logs").insert({
    intent: "WAITING_LIST_SLOT",
    decision: res.ok ? "SENT" : "TEMPLATE_NOT_AVAILABLE",
    metadata: { build: BUILD, waiting_list_id: entry.id, template: usedTemplate, free_slots: freeCount, http: res.status, response: result },
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

  // Espelha no Chatwoot (nota privada) para o atendente ver o histórico.
  await chatwootMirrorTemplateSent(
    admin as any,
    String(entry.clinic_id),
    e164,
    displayName,
    `[Aviso de vaga enviado pelo WhatsApp oficial]\n` +
      `Paciente: ${displayName}\n` +
      `Vaga: ${formatDatePt(appointmentDate)} às ${startTime.slice(0, 5)}\n` +
      `Profissional: ${professionalName}\n` +
      `Template: ${TEMPLATE_NAME}`,
  );

  return json({ ok: true, patientName: displayName, template: TEMPLATE_NAME, result, build: BUILD });
});
