// Página "Escolher horário" da lista de espera: o link do WhatsApp mostra todas as
// vagas livres (15 dias) e agenda a escolhida. Link com hash, validade curta, uso único no agendamento.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { listFreeSlots } from "../_shared/free-slots.ts";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function sha256Hex(v: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const token = String(body?.token ?? "");
    const action = body?.action === "book" ? "book" : "load";
    if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return json({ error: "Link inválido." }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const hash = await sha256Hex(token);
    const { data: tk } = await admin.from("waiting_list_pick_tokens").select("*").eq("token_hash", hash).maybeSingle();
    if (!tk) return json({ error: "Link inválido." }, 404);
    if (tk.used_at) return json({ error: "Você já escolheu um horário por este link.", used: true }, 410);
    if (new Date(tk.expires_at).getTime() < Date.now()) return json({ error: "Este link expirou. Fale com a clínica para receber um novo." }, 410);

    const [{ data: patient }, { data: prof }, { data: clinic }] = await Promise.all([
      admin.from("patients").select("name").eq("id", tk.patient_id).maybeSingle(),
      admin.from("professionals").select("name").eq("id", tk.professional_id).maybeSingle(),
      admin.from("clinics").select("name").eq("id", tk.clinic_id).maybeSingle(),
    ]);
    const slots = await listFreeSlots(admin, tk.clinic_id, tk.professional_id, 15);

    if (action === "load") {
      return json({
        firstName: String(patient?.name || "").split(" ")[0],
        professionalName: prof?.name || "Profissional",
        clinicName: clinic?.name || "",
        expiresAt: tk.expires_at,
        slots,
      });
    }

    const date = String(body?.date ?? "");
    const time = String(body?.time ?? "").slice(0, 5);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return json({ error: "Horário inválido." }, 400);
    const slot = slots.find((s) => s.date === date && s.time === time);
    if (!slot) return json({ error: "Este horário acabou de ser ocupado. Escolha outro.", taken: true, slots }, 409);

    // Reserva o link primeiro (uso único atômico).
    const { data: claimed } = await admin.from("waiting_list_pick_tokens")
      .update({ used_at: new Date().toISOString() }).eq("id", tk.id).is("used_at", null).select("id").maybeSingle();
    if (!claimed) return json({ error: "Você já escolheu um horário por este link.", used: true }, 410);

    const { data: appt, error: apptErr } = await admin.from("appointments").insert({
      clinic_id: tk.clinic_id, patient_id: tk.patient_id, professional_id: tk.professional_id,
      appointment_date: date, start_time: `${time}:00`, end_time: `${slot.end}:00`,
      status: "scheduled", notes: "Agendado pelo próprio associado via link da lista de espera (WhatsApp).",
    }).select("id").single();
    if (apptErr || !appt) {
      await admin.from("waiting_list_pick_tokens").update({ used_at: null }).eq("id", tk.id);
      console.error("[waiting-list-pick] insert", apptErr?.message);
      return json({ error: "Este horário acabou de ser ocupado. Escolha outro.", taken: true }, 409);
    }

    const nowIso = new Date().toISOString();
    await Promise.all([
      admin.from("waiting_list_pick_tokens").update({ appointment_id: appt.id }).eq("id", tk.id),
      admin.from("waiting_list").update({
        is_active: false, queue_status: "ACEITO", notification_status: "accepted", confirmed_at: nowIso,
        offered_appointment_date: date, offered_appointment_time: `${time}:00`,
      }).eq("id", tk.waiting_list_id),
    ]);
    return json({ ok: true, date, time, professionalName: prof?.name || "Profissional" });
  } catch (e) {
    console.error("[waiting-list-pick]", (e as Error)?.message);
    return json({ error: "Não foi possível concluir. Tente novamente." }, 500);
  }
});
