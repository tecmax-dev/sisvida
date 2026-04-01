import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CLINIC_ID = "89e7585e-7bce-4e58-91fa-c37080d1170d";
const MESSAGE_TYPE = "jose_alcides_0402_campaign";

const templates: string[] = [
`Olá, {NAME}! 👋

Temos *horários livres* para o *Dr. José Alcides (Clínico Geral)* nesta *quinta-feira, 02/04/2026*!

Não perca a oportunidade de cuidar da sua saúde. 💙

📲 *Agendamento somente pelo app SECMI.*

Garanta já o seu horário!`,

`Oi {NAME}, tudo bem? 🩺

Informamos que há *vagas disponíveis* com o *Dr. José Alcides — Clínico Geral* para esta *quinta-feira (02/04)*!

Aproveite e marque sua consulta! ✨

⚠️ Lembre-se: *agendamento somente pelo app SECMI*.

Estamos te esperando!`,

`{NAME}, boa notícia! 🎉

O *Dr. José Alcides (Clínico Geral)* tem *horários livres* nesta *quinta-feira, 02/04/2026*.

Cuide da sua saúde com a gente! 💚

📱 *O agendamento é feito exclusivamente pelo app SECMI.* Acesse e reserve seu horário!`,

`Bom dia, {NAME}! 🌟

Passando para avisar: *Dr. José Alcides — Clínico Geral* com *agenda disponível* para *quinta-feira, 02/04/2026*!

Não deixe para depois! 🏥

📲 *Agende somente pelo app SECMI.* É rápido e prático!`,

`Saudações, {NAME}! ⭐

Temos uma ótima oportunidade: o *Dr. José Alcides (Clínico Geral)* ainda possui *horários livres* para *esta quinta, 02/04*.

Garanta sua consulta agora mesmo! 😊

⚠️ *Agendamento exclusivamente pelo app SECMI.*`,

`Hey {NAME}! 📋

Viemos te avisar que há *vagas abertas* com o *Dr. José Alcides*, nosso *Clínico Geral*, nesta *quinta-feira (02/04/2026)*!

Aproveite para agendar! 💛

📱 *Lembrete: agendamento somente pelo app SECMI.*

Até breve!`,

`Prezado(a) {NAME}, 💙

Comunicamos que o *Dr. José Alcides — Clínico Geral* tem *disponibilidade* para atendimento nesta *quinta-feira, 02/04/2026*.

📲 Para marcar, acesse o *app SECMI* — é o único canal de agendamento.

Aguardamos você! 🤗`,

`Oi {NAME}! 🔔

O *Clínico Geral Dr. José Alcides* está com *horários disponíveis* para *quinta-feira, 02/04*!

Não perca essa chance de consultar! 🩺

⚠️ *O agendamento é feito somente pelo app SECMI.* Acesse agora!`,

`{NAME}, como vai? 😄

Queremos te avisar: *Dr. José Alcides (Clínico Geral)* com *agenda aberta* para *02/04/2026 (quinta-feira)*!

Marque sua consulta com praticidade! 🌈

📲 *Agendamento exclusivo pelo app SECMI.* Baixe e agende!`,

`Olá {NAME}! 📅

Restam *vagas disponíveis* para o *Dr. José Alcides — Clínico Geral* nesta *quinta-feira, dia 02/04*.

Cuide da sua saúde! 💚

📱 *Importante: agendamento somente pelo app SECMI!*

Grande abraço da equipe SECMI! ⭐`,

`{NAME}, novidade! ✨

Ainda dá tempo de marcar consulta com o *Dr. José Alcides (Clínico Geral)* — *quinta-feira, 02/04/2026*!

Aproveite os horários livres! 🏥

📲 *Agende pelo app SECMI.* Rápido e na palma da sua mão!`,

`Oi {NAME}, tudo certo? 🩺

O *Dr. José Alcides*, *Clínico Geral*, tem *vagas para esta quinta (02/04)*!

Não deixe para última hora! ⏰

🔔 *Agendamento somente pelo app SECMI.* Garanta seu horário agora!`,
];

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty */ }
  const batchSize = Number(body.batchSize) || 20;
  const dryRun = body.dryRun === true;

  // Get already sent phones
  const { data: sentLogs } = await supabase
    .from("message_logs")
    .select("phone")
    .eq("clinic_id", CLINIC_ID)
    .eq("message_type", MESSAGE_TYPE);

  const alreadySent = new Set((sentLogs || []).map((l: any) => l.phone));

  // Get patients from Jan-Mar 2026 appointments
  const { data: patients, error: patErr } = await supabase
    .from("appointments")
    .select("patient_id, patients!inner(id, name, phone)")
    .eq("clinic_id", CLINIC_ID)
    .gte("appointment_date", "2026-01-01")
    .lt("appointment_date", "2026-04-01")
    .neq("status", "cancelled");

  if (patErr) {
    return new Response(JSON.stringify({ error: patErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Deduplicate by phone
  const phoneMap = new Map<string, { name: string; phone: string }>();
  for (const apt of (patients || [])) {
    const pat = (apt as any).patients;
    if (!pat?.phone) continue;
    const digits = pat.phone.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 13) continue;
    const fullPhone = digits.startsWith("55") ? digits : `55${digits}`;
    if (fullPhone.length < 12 || fullPhone.length > 13) continue;
    if (alreadySent.has(fullPhone)) continue;
    if (!phoneMap.has(fullPhone)) {
      const firstName = pat.name.split(" ")[0];
      const capitalized = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
      phoneMap.set(fullPhone, { name: capitalized, phone: fullPhone });
    }
  }

  const allRecipients = Array.from(phoneMap.values());
  const recipients = allRecipients.slice(0, batchSize);
  const remaining = allRecipients.length - recipients.length;

  if (dryRun) {
    return new Response(JSON.stringify({
      success: true, dryRun: true,
      totalPending: allRecipients.length,
      batchSize,
      sampleMessages: recipients.slice(0, 3).map((r, i) => ({
        phone: r.phone, name: r.name,
        message: templates[i % templates.length].replace(/\{NAME\}/g, r.name),
      })),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const processingPromise = (async () => {
    console.log(`[jose-alcides-0402] Processing batch of ${recipients.length}/${allRecipients.length}`);
    let sent = 0, failed = 0;

    for (let i = 0; i < recipients.length; i++) {
      const { name, phone } = recipients[i];
      const message = templates[i % templates.length].replace(/\{NAME\}/g, name);

      try {
        const { error: sendErr } = await supabase.functions.invoke("send-whatsapp", {
          body: { phone, message, clinicId: CLINIC_ID, type: "custom" },
        });
        if (sendErr) throw sendErr;

        await supabase.from("message_logs").insert({
          clinic_id: CLINIC_ID,
          message_type: MESSAGE_TYPE,
          phone,
          sent_at: new Date().toISOString(),
          month_year: "2026-04",
        });
        sent++;
        console.log(`[jose-alcides-0402] ${sent}/${recipients.length} sent to ${phone} (${name})`);
      } catch (err) {
        failed++;
        console.error(`[jose-alcides-0402] Failed for ${phone}:`, err);
      }

      if (i < recipients.length - 1) {
        await sleep(30000);
      }
    }

    console.log(`[jose-alcides-0402] Batch done: ${sent} sent, ${failed} failed, ${remaining} remaining`);
  })();

  (globalThis as any).EdgeRuntime?.waitUntil?.(processingPromise);

  return new Response(JSON.stringify({
    success: true,
    message: `Enviando lote de ${recipients.length} mensagens (${remaining} restantes após este lote)`,
    batchSize: recipients.length,
    totalPending: allRecipients.length,
    remaining,
    estimatedMinutes: Math.ceil((recipients.length * 30) / 60),
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
