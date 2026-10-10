// Envia lembrete/protocolo de homologação por e-mail à empresa, via SMTP Locaweb do sistema.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { requireStaff, authErrorResponse } from "../_shared/authGuard.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const UUID = /^[0-9a-f-]{36}$/i;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    await requireStaff(req);
  } catch (e) {
    const denied = authErrorResponse(e, cors);
    if (denied) return denied;
    throw e;
  }
  try {
    const body = await req.json().catch(() => ({}));
    const id = String(body.appointment_id ?? "");
    const type = body.type === "protocol" ? "protocol" : "reminder";
    const custom = typeof body.custom_message === "string" ? body.custom_message.slice(0, 4000) : "";
    if (!UUID.test(id)) return json({ success: false, error: "appointment_id inválido" }, 400);

    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const { data: a } = await db.from("homologacao_appointments")
      .select("id, clinic_id, employee_name, company_name, company_email, appointment_date, start_time, protocol_number, status")
      .eq("id", id).maybeSingle();
    if (!a) return json({ success: false, error: "Agendamento não encontrado" }, 404);
    if (!a.company_email) return json({ success: false, error: "Empresa sem e-mail" }, 400);
    const { data: clinic } = await db.from("clinics").select("name, phone, address").eq("id", a.clinic_id).maybeSingle();

    const host = Deno.env.get("SMTP_HOST");
    const user = Deno.env.get("SMTP_USER");
    const pass = Deno.env.get("SMTP_PASSWORD");
    const from = Deno.env.get("SMTP_FROM") || "noreply@prosindweb.com.br";
    const port = Number(Deno.env.get("SMTP_PORT") || "587");
    if (!host || !user || !pass) return json({ success: false, error: "Envio de e-mail não configurado" }, 500);

    const [y, m, d] = String(a.appointment_date).split("-");
    const date = `${d}/${m}/${y}`;
    const time = String(a.start_time ?? "").slice(0, 5);
    const title = type === "protocol" ? "Protocolo de Homologação" : "Lembrete de Homologação";
    const intro = custom
      ? esc(custom).replace(/\n/g, "<br>")
      : type === "protocol"
        ? "Informamos que o processo de homologação foi concluído. Guarde este protocolo para seus registros."
        : "Lembramos que há uma homologação agendada. Compareça com antecedência e com a documentação necessária.";
    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:24px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
<div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;padding:28px">
<h2 style="margin:0 0 16px;color:#0f766e">${title}</h2>
<p>Prezado(s),</p><p>${intro}</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
<tr><td style="padding:6px 0;color:#6b7280">Funcionário</td><td><strong>${esc(a.employee_name)}</strong></td></tr>
<tr><td style="padding:6px 0;color:#6b7280">Empresa</td><td>${esc(a.company_name)}</td></tr>
<tr><td style="padding:6px 0;color:#6b7280">Data</td><td>${date}${time ? ` às ${time}` : ""}</td></tr>
${a.protocol_number ? `<tr><td style="padding:6px 0;color:#6b7280">Protocolo</td><td><strong>${esc(a.protocol_number)}</strong></td></tr>` : ""}
</table>
<p style="font-size:13px;color:#4b5563">${esc(clinic?.name ?? "")}${clinic?.phone ? ` · ${esc(clinic.phone)}` : ""}</p>
<p style="margin-top:24px;font-size:12px;color:#9ca3af">Mensagem automática do sistema.</p>
</div></body></html>`;

    const { SMTPClient } = await import("https://deno.land/x/denomailer@1.6.0/mod.ts");
    const client = new SMTPClient({ connection: { hostname: host, port, tls: port === 465, auth: { username: user, password: pass } } });
    try {
      await client.send({ from, to: a.company_email, subject: `${title}${a.protocol_number ? ` - ${a.protocol_number}` : ""}`, html, content: "auto" });
    } finally {
      await client.close();
    }
    return json({ success: true, to: a.company_email });
  } catch (e) {
    console.error("send-homologacao-email error:", e);
    return json({ success: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
