import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CLINIC_ID = "89e7585e-7bce-4e58-91fa-c37080d1170d";
const MESSAGE_TYPE = "april_agenda_campaign_v2";

const greetings = [
  "Olá", "Oi", "Bom dia", "Boa tarde", "Hey", "Saudações",
];

const emojis = ["📋", "🗓️", "📅", "✨", "💙", "🩺", "⭐", "🔔"];

const professionals = [
  "Daniela Sales", "Eliney Silva", "Jorge Avelar",
  "Jose Alcides", "Juliane Leite", "Marcelo Aguiar",
  "Pedro Roberto", "Uiara Tiuba",
];

function buildTemplates(): string[] {
  const profList = professionals.map(p => `  • ${p}`).join("\n");

  return [
    // Template 1
`{GREETING}, {NAME}! {EMOJI}

Estamos com a *agenda de abril/2026* aberta no Sindicato dos Comerciários!

Nossos profissionais disponíveis:
${profList}

Agende agora pelo aplicativo ou ligue para nós.
Cuide da sua saúde! {EMOJI2}`,

    // Template 2
`{GREETING}, *{NAME}*! {EMOJI}

Informamos que já estão disponíveis os *agendamentos para abril de 2026* no ambulatório do sindicato.

Profissionais atendendo:
${profList}

Garanta seu horário pelo app ou entre em contato conosco! {EMOJI2}`,

    // Template 3
`{EMOJI} {GREETING}, {NAME}!

A agenda do mês de *abril/2026* já está liberada para marcação!

Confira os profissionais:
${profList}

Não perca tempo, marque sua consulta pelo aplicativo. {EMOJI2}`,

    // Template 4
`{GREETING} {NAME}! {EMOJI}

Temos novidades: a *agenda de abril 2026* está aberta para agendamentos no ambulatório.

Equipe disponível:
${profList}

Acesse o app e garanta o melhor horário para você! {EMOJI2}`,

    // Template 5
`{EMOJI} *{NAME}*, {GREETING}!

Abril chegou e nossa agenda já está disponível! Aproveite para marcar sua consulta.

Profissionais disponíveis em abril:
${profList}

Agende pelo app ou nos procure. Sua saúde em primeiro lugar! {EMOJI2}`,

    // Template 6
`{GREETING}, {NAME}! {EMOJI}

Comunicamos que a *agenda para o mês de abril/2026* está aberta no Sindicato dos Comerciários.

Nosso corpo clínico:
${profList}

Faça seu agendamento pelo aplicativo. Esperamos por você! {EMOJI2}`,
  ];
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildMessage(name: string, templateIdx: number): string {
  const templates = buildTemplates();
  const template = templates[templateIdx % templates.length];
  const firstName = name.split(" ")[0];
  const capitalized = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();

  return template
    .replace(/\{GREETING\}/g, pickRandom(greetings))
    .replace(/\{NAME\}/g, capitalized)
    .replace(/\{EMOJI\}/g, pickRandom(emojis))
    .replace(/\{EMOJI2\}/g, pickRandom(emojis));
}

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

  // Start background processing
  const processingPromise = (async () => {
    console.log("[notify-april-v2] Starting campaign...");

    // Get already sent phones (both v1 and v2)
    const { data: sentLogs } = await supabase
      .from("message_logs")
      .select("phone")
      .eq("clinic_id", CLINIC_ID)
      .in("message_type", ["april_agenda_campaign", MESSAGE_TYPE]);

    const alreadySent = new Set((sentLogs || []).map((l: any) => l.phone));
    console.log(`[notify-april-v2] Already sent to ${alreadySent.size} phones`);

    // Get patients from Jan-Mar 2026
    const { data: patients, error: patErr } = await supabase
      .from("appointments")
      .select("patient_id, patients!inner(id, name, phone)")
      .eq("clinic_id", CLINIC_ID)
      .gte("appointment_date", "2026-01-01")
      .lt("appointment_date", "2026-04-01")
      .neq("status", "cancelled");

    if (patErr) {
      console.error("[notify-april-v2] Error fetching patients:", patErr);
      return;
    }

    // Deduplicate by phone
    const phoneMap = new Map<string, { name: string; phone: string }>();
    for (const apt of (patients || [])) {
      const pat = (apt as any).patients;
      if (!pat?.phone) continue;
      const digits = pat.phone.replace(/\D/g, "");
      if (digits.length < 10) continue;
      const fullPhone = digits.startsWith("55") ? digits : `55${digits}`;
      if (alreadySent.has(fullPhone)) continue;
      if (!phoneMap.has(fullPhone)) {
        phoneMap.set(fullPhone, { name: pat.name, phone: fullPhone });
      }
    }

    const recipients = Array.from(phoneMap.values());
    console.log(`[notify-april-v2] ${recipients.length} new recipients to process`);

    let sent = 0;
    let failed = 0;

    for (let i = 0; i < recipients.length; i++) {
      const { name, phone } = recipients[i];
      const message = buildMessage(name, i);

      try {
        const { error: sendErr } = await supabase.functions.invoke("send-whatsapp", {
          body: {
            phone,
            message,
            clinicId: CLINIC_ID,
            type: "custom",
          },
        });

        if (sendErr) throw sendErr;

        // Log sent
        await supabase.from("message_logs").insert({
          clinic_id: CLINIC_ID,
          message_type: MESSAGE_TYPE,
          phone,
          sent_at: new Date().toISOString(),
          month_year: "2026-04",
        });

        sent++;
        console.log(`[notify-april-v2] ${sent}/${recipients.length} sent to ${phone}`);
      } catch (err) {
        failed++;
        console.error(`[notify-april-v2] Failed for ${phone}:`, err);
      }

      // 30s delay between messages
      if (i < recipients.length - 1) {
        console.log(`[notify-april-v2] Waiting 30s...`);
        await sleep(30000);
      }
    }

    console.log(`[notify-april-v2] Campaign complete: ${sent} sent, ${failed} failed`);
  })();

  // Use waitUntil for background processing
  (globalThis as any).EdgeRuntime?.waitUntil?.(processingPromise);

  return new Response(
    JSON.stringify({
      success: true,
      message: "Campaign v2 started in background. Check logs for progress.",
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
