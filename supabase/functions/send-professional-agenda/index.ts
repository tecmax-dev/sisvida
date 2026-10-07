import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { getAuthContext } from "../_shared/authGuard.ts";
import { normalizeBrPhone } from "../_shared/whatsappConsentGate.ts";

// Agenda do dia para o profissional pelo WhatsApp oficial (Meta Cloud API).
// Mensagem UTILITY aprovada só com dia + total e botão URL; nomes e horários
// ficam numa página segura (link pessoal com hash, válido até o fim do dia).
const GRAPH = "https://graph.facebook.com/v21.0";
const WABA_ID = "2063797207822998";
const PHONE_ID = "1213495528515111";
const TEMPLATE = "agenda_do_dia_profissional_v1";
const LANGUAGE = "pt_BR";
const COMPONENTS = [
  {
    type: "BODY",
    text: "Olá, {{1}}. Sua agenda do dia {{2}} está disponível, com {{3}} atendimento(s) marcado(s).\n\nToque no botão abaixo para ver os horários e os nomes dos pacientes. O link é pessoal e vale até o fim do dia.",
    example: { body_text: [["Ana", "08/10/2026", "12"]] },
  },
  {
    type: "BUTTONS",
    buttons: [{ type: "URL", text: "Ver agenda", url: "https://prosindweb.com.br/agenda-profissional/{{1}}", example: ["https://prosindweb.com.br/agenda-profissional/abc123"] }],
  },
];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const sha256 = async (v: string) =>
  Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v))))
    .map((b) => b.toString(16).padStart(2, "0")).join("");
const randomToken = () => {
  const b = new Uint8Array(24); crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Método não permitido" }, 405);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const audit = (decision: string, metadata: Record<string, unknown>) =>
    admin.from("whatsapp_compliance_logs").insert({ intent: "PROFESSIONAL_DAILY_AGENDA", decision, metadata: { template: TEMPLATE, ...metadata } })
      .then(({ error }) => { if (error) console.error("audit", error.message); });
  const getMetaToken = async () => {
    const { data } = await admin.rpc("get_meta_vault_secret", { _secret_name: "META_WHATSAPP_TOKEN_V2" });
    return data ? String(data) : Deno.env.get("META_WHATSAPP_TOKEN_V2") ?? null;
  };
  const readTemplate = async (token: string) => {
    const r = await fetch(`${GRAPH}/${WABA_ID}/message_templates?name=${TEMPLATE}&limit=20`, { headers: { Authorization: `Bearer ${token}` } });
    const b: any = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false as const, http: r.status, error: b?.error?.message ?? null };
    return { ok: true as const, tpl: (b?.data ?? []).find((t: any) => t.name === TEMPLATE && t.language === LANGUAGE) ?? null };
  };

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "");

    if (action === "submit-template" || action === "template-status") {
      const actor = await getAuthContext(req);
      if (!actor?.isSuperAdmin) return json({ success: false, error: "FORBIDDEN" }, 403);
      const token = await getMetaToken();
      if (!token) return json({ success: false, error: "META_TOKEN_NOT_CONFIGURED" }, 503);
      const read = await readTemplate(token);
      if (!read.ok) return json({ success: false, error: "META_LOOKUP_FAILED", http: read.http, details: read.error }, 502);
      if (read.tpl || action === "template-status") return json({ success: true, created: false, status: read.tpl?.status ?? "NOT_FOUND", category: read.tpl?.category ?? null });
      const res = await fetch(`${GRAPH}/${WABA_ID}/message_templates`, {
        method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: TEMPLATE, language: LANGUAGE, category: "UTILITY", components: COMPONENTS }),
      });
      const rb: any = await res.json().catch(() => ({}));
      await audit(res.ok && rb?.id ? "TEMPLATE_SUBMITTED" : "TEMPLATE_SUBMIT_FAILED", { http: res.status, error: rb?.error?.message ?? null });
      if (!res.ok || !rb?.id) return json({ success: false, error: "META_SUBMISSION_FAILED", details: rb?.error?.message ?? null }, 502);
      return json({ success: true, created: true, status: rb?.status ?? "PENDING" });
    }

    if (action === "send") {
      const actor = await getAuthContext(req);
      if (!actor?.isStaff) return json({ success: false, error: "Sessão expirada. Entre novamente." }, 401);
      const professionalId = String(body?.professional_id ?? "");
      const clinicId = String(body?.clinic_id ?? "");
      const date = String(body?.date ?? "");
      if (!/^[0-9a-f-]{36}$/.test(professionalId) || !/^[0-9a-f-]{36}$/.test(clinicId) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return json({ success: false, error: "Dados inválidos." }, 400);
      }
      if (!actor.isSuperAdmin) {
        const { data: ok } = await admin.rpc("has_clinic_access", { _user_id: actor.userId, _clinic_id: clinicId });
        if (!ok) return json({ success: false, error: "Sem acesso a esta clínica." }, 403);
      }
      const { data: prof } = await admin.from("professionals").select("id, name, phone, whatsapp")
        .eq("id", professionalId).eq("clinic_id", clinicId).maybeSingle();
      if (!prof) return json({ success: false, error: "Profissional não encontrado." }, 404);
      const phone = normalizeBrPhone(prof.whatsapp || prof.phone);
      if (!phone.valid || !phone.e164) return json({ success: false, error: `${prof.name} não tem WhatsApp válido cadastrado.` }, 400);
      const { data: oo } = await admin.from("whatsapp_opt_outs").select("id").eq("clinic_id", clinicId).eq("phone", phone.e164).maybeSingle();
      if (oo) { await audit("OPT_OUT", { professional_id: professionalId }); return json({ success: false, error: "Este número pediu para não receber mensagens." }, 403); }

      const { count } = await admin.from("appointments").select("id", { count: "exact", head: true })
        .eq("clinic_id", clinicId).eq("professional_id", professionalId).eq("appointment_date", date)
        .not("status", "in", "(cancelled,blocked)");

      const metaToken = await getMetaToken();
      if (!metaToken) return json({ success: false, error: "Serviço indisponível no momento." }, 503);
      const read = await readTemplate(metaToken);
      if (!read.ok || String(read.tpl?.status ?? "").toUpperCase() !== "APPROVED") {
        await audit("TEMPLATE_NOT_APPROVED", { professional_id: professionalId, status: read.ok ? read.tpl?.status ?? null : null });
        return json({ success: false, error: "O envio da agenda aguarda aprovação da Meta. Tente mais tarde." }, 503);
      }

      const token = randomToken();
      const { error: insErr } = await admin.from("professional_agenda_links").insert({
        token_hash: await sha256(token), professional_id: professionalId, clinic_id: clinicId,
        agenda_date: date, expires_at: `${date}T23:59:59-03:00`, created_by: actor.userId,
      });
      if (insErr) return json({ success: false, error: "Não foi possível gerar o link." }, 500);

      const firstName = String(prof.name || "Profissional").replace(/[\r\n\t]/g, " ").trim().split(/\s+/).slice(0, 2).join(" ").slice(0, 60);
      const [y, m, d] = date.split("-");
      const res = await fetch(`${GRAPH}/${PHONE_ID}/messages`, {
        method: "POST", headers: { Authorization: `Bearer ${metaToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp", recipient_type: "individual", to: phone.e164, type: "template",
          template: { name: TEMPLATE, language: { code: LANGUAGE }, components: [
            { type: "body", parameters: [{ type: "text", text: firstName }, { type: "text", text: `${d}/${m}/${y}` }, { type: "text", text: String(count ?? 0) }] },
            { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: token }] },
          ] },
        }),
      });
      const rb: any = await res.json().catch(() => ({}));
      const messageId = rb?.messages?.[0]?.id ?? null;
      if (!res.ok || !messageId) {
        await audit("SEND_FAILED", { professional_id: professionalId, http: res.status, error: rb?.error?.message ?? null });
        return json({ success: false, error: "Não foi possível enviar pelo WhatsApp agora." }, 502);
      }
      await audit("SENT", { professional_id: professionalId, date, message_id: messageId, by: actor.userId });
      return json({ success: true, total: count ?? 0 });
    }

    if (action === "view") {
      const token = String(body?.token ?? "");
      if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return json({ success: false, error: "Link inválido." }, 400);
      const { data: link } = await admin.from("professional_agenda_links").select("id, professional_id, clinic_id, agenda_date, expires_at")
        .eq("token_hash", await sha256(token)).maybeSingle();
      if (!link) return json({ success: false, error: "Link inválido." }, 404);
      if (new Date(link.expires_at).getTime() < Date.now()) return json({ success: false, error: "Este link expirou. Peça à recepção um novo envio." }, 410);
      await admin.from("professional_agenda_links").update({ last_opened_at: new Date().toISOString() }).eq("id", link.id);
      const [{ data: prof }, { data: clinic }, { data: apts }] = await Promise.all([
        admin.from("professionals").select("name").eq("id", link.professional_id).maybeSingle(),
        admin.from("clinics").select("name").eq("id", link.clinic_id).maybeSingle(),
        admin.from("appointments").select("start_time, status, patient:patients(name), dependent:patient_dependents(name), procedure:procedures(name)")
          .eq("clinic_id", link.clinic_id).eq("professional_id", link.professional_id).eq("appointment_date", link.agenda_date)
          .not("status", "in", "(cancelled,blocked)").order("start_time"),
      ]);
      return json({
        success: true, professional: prof?.name ?? "", clinic: clinic?.name ?? "", date: link.agenda_date,
        items: (apts ?? []).map((a: any) => ({
          time: String(a.start_time).slice(0, 5), status: a.status,
          name: a.dependent?.name || a.patient?.name || "Paciente", procedure: a.procedure?.name ?? null,
        })),
      });
    }

    return json({ success: false, error: "Ação inválida." }, 400);
  } catch (e) {
    console.error(e);
    return json({ success: false, error: "Erro interno." }, 500);
  }
});
