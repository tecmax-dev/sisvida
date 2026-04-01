import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CLINIC_ID = "89e7585e-7bce-4e58-91fa-c37080d1170d";
const MESSAGE_TYPE = "april_agenda_campaign_v3";
const PREVIOUS_TYPES = ["april_agenda_campaign", "april_agenda_campaign_v2", MESSAGE_TYPE];

const professionals = [
  "Daniela Sales", "Eliney Silva", "Jorge Avelar",
  "Jose Alcides", "Juliane Leite", "Marcelo Aguiar",
  "Pedro Roberto", "Uiara Tiuba",
];

const profList = professionals.map(p => `  • ${p}`).join("\n");

// 12 templates únicos com ênfase em "agendar pelo app"
const templates: string[] = [
`Olá, {NAME}! 📋

A *agenda de abril/2026* está aberta no Sindicato dos Comerciários!

Profissionais disponíveis:
${profList}

📲 O agendamento é feito *exclusivamente pelo nosso aplicativo*. Baixe ou acesse e garanta seu horário!

Cuide da sua saúde! 💙`,

`Oi {NAME}, tudo bem? 🗓️

Informamos que os *agendamentos para abril de 2026* já estão liberados!

Confira nossa equipe:
${profList}

⚠️ Lembramos que a marcação é realizada *somente pelo app*. Acesse agora e escolha o melhor horário!

Estamos te esperando! ✨`,

`{NAME}, boa notícia! 🎉

A *agenda médica de abril/2026* está disponível para você!

Nosso corpo clínico:
${profList}

📱 Para agendar, utilize *exclusivamente o aplicativo*. É rápido e prático!

Sua saúde em primeiro lugar! 🩺`,

`Bom dia, {NAME}! 🌟

Viemos avisar que a *agenda de abril 2026* já pode ser consultada.

Profissionais atendendo neste mês:
${profList}

🔔 Importante: o agendamento é feito *apenas pelo aplicativo*. Não perca tempo, marque já!

Abraço da equipe SECMI! 💚`,

`Saudações, {NAME}! ⭐

Temos novidades: *abril/2026* já tem agenda aberta no ambulatório!

Veja quem está disponível:
${profList}

📲 Lembre-se: a única forma de agendar é *pelo nosso app*. Garanta sua consulta com antecedência!

Conte conosco! 😊`,

`Hey {NAME}! 👋

Passando para avisar que os *horários de abril de 2026* estão liberados!

Equipe disponível:
${profList}

⚠️ O agendamento é realizado *exclusivamente pelo aplicativo*. Acesse e reserve seu horário!

Até breve! 🏥`,

`Prezado(a) {NAME}, 💙

Comunicamos que a *agenda para abril/2026* está aberta no Sindicato dos Comerciários.

Nossos profissionais:
${profList}

📱 Para marcar sua consulta, acesse *nosso aplicativo* — é o único canal de agendamento.

Aguardamos você! 🤗`,

`Oi {NAME}! 📅

Abril chegou e nossa *agenda 2026* já está disponível para marcação!

Confira os profissionais:
${profList}

🔔 Atenção: agende *somente pelo app*. É simples, rápido e seguro!

Cuide-se! 💛`,

`{NAME}, como vai? 😄

Queremos te avisar: a *agenda de abril/2026* está pronta para agendamentos!

Profissionais disponíveis este mês:
${profList}

📲 Importante: toda marcação é feita *pelo aplicativo*. Baixe e agende com praticidade!

Um abraço! 🌈`,

`Olá {NAME}! 🔔

Os agendamentos para *abril de 2026* estão abertos! Garanta logo o seu horário.

Equipe médica disponível:
${profList}

⚠️ Lembrete: o agendamento é *exclusivo pelo app*. Acesse agora mesmo!

Saúde sempre! 💚`,

`{NAME}, novidade! ✨

A *agenda do mês de abril/2026* foi liberada no ambulatório do sindicato!

Veja nossos profissionais:
${profList}

📱 Para agendar sua consulta, utilize *apenas o aplicativo*. Rápido e na palma da sua mão!

Esperamos por você! 😃`,

`Oi {NAME}, tudo certo? 🩺

Informamos que já é possível marcar consultas para *abril/2026*!

Nosso time de profissionais:
${profList}

🔔 A marcação é feita *exclusivamente pelo nosso app*. Não deixe para última hora!

Grande abraço! ⭐`,
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

  // Get already sent phones from all campaign waves
  const { data: sentLogs } = await supabase
    .from("message_logs")
    .select("phone")
    .eq("clinic_id", CLINIC_ID)
    .in("message_type", PREVIOUS_TYPES);

  const alreadySent = new Set((sentLogs || []).map((l: any) => l.phone));

  // Get patients from Jan-Mar 2026
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
  // Process only current batch
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

  // Background processing for this batch
  const processingPromise = (async () => {
    console.log(`[v3] Processing batch of ${recipients.length}/${allRecipients.length} recipients`);
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
        console.log(`[v3] ${sent}/${recipients.length} sent to ${phone} (${name})`);
      } catch (err) {
        failed++;
        console.error(`[v3] Failed for ${phone}:`, err);
      }

      if (i < recipients.length - 1) {
        await sleep(30000);
      }
    }

    console.log(`[v3] Batch done: ${sent} sent, ${failed} failed, ${remaining} remaining`);
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
