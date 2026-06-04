import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// 12 template variations to rotate and avoid WhatsApp anti-spam
const messageTemplates = [
  (name: string) =>
    `Olá, ${name}! 👋\n\nAgora ficou mais fácil recuperar sua senha do app SECMI! Basta acessar a tela de login, tocar em "Esqueci minha senha", informar seu e-mail e você receberá um link aqui mesmo no WhatsApp para criar uma nova senha. Rápido e seguro! 🔐\n\n_SECMI - Sindicato dos Comerciários_`,
  (name: string) =>
    `Oi, ${name}! 😊\n\nNovidade no app SECMI: agora você pode redefinir sua senha de forma prática! Na tela de login, clique em "Esqueci minha senha", digite seu e-mail cadastrado e receba o link de recuperação direto no seu WhatsApp. Simples assim! ✅\n\n_SECMI - Sindicato dos Comerciários_`,
  (name: string) =>
    `${name}, tudo bem? 🙂\n\nQueremos avisar que o app SECMI agora conta com uma nova forma de recuperar sua senha! Acesse a tela de login, toque em "Esqueci minha senha" e informe seu e-mail. O link para redefinição chegará aqui pelo WhatsApp. Mais prático, né? 📱\n\n_SECMI - Sindicato dos Comerciários_`,
  (name: string) =>
    `Olá, ${name}! 🔑\n\nEsqueceu sua senha do app SECMI? Sem problemas! Agora é possível recuperá-la diretamente pelo WhatsApp. Basta ir na tela de login, clicar em "Esqueci minha senha" e inserir seu e-mail. Você receberá um link seguro aqui para redefinir. 💪\n\n_SECMI - Sindicato dos Comerciários_`,
  (name: string) =>
    `Ei, ${name}! 📢\n\nTemos uma novidade para você! A recuperação de senha do app SECMI agora é feita pelo WhatsApp. Vá até a tela de login, selecione "Esqueci minha senha", informe o e-mail e pronto: o link chega aqui no seu celular! 📲\n\n_SECMI - Sindicato dos Comerciários_`,
  (name: string) =>
    `Boa notícia, ${name}! 🎉\n\nO app SECMI tem um novo recurso: recuperação de senha via WhatsApp! Na tela de login, é só clicar em "Esqueci minha senha", digitar seu e-mail cadastrado e o link para criar uma nova senha será enviado para cá. Mais segurança para você! 🛡️\n\n_SECMI - Sindicato dos Comerciários_`,
  (name: string) =>
    `${name}, atenção! ⚡\n\nAgora você pode recuperar o acesso ao app SECMI de um jeito muito mais fácil. Na tela de login, toque em "Esqueci minha senha", preencha seu e-mail e aguarde o link de recuperação chegar aqui no WhatsApp. É instantâneo! ⏱️\n\n_SECMI - Sindicato dos Comerciários_`,
  (name: string) =>
    `Olá, ${name}! 💡\n\nSabia que agora dá para recuperar sua senha do app SECMI pelo WhatsApp? Acesse a tela de login, clique em "Esqueci minha senha", informe seu e-mail e o link de redefinição será enviado direto para o seu número cadastrado. Fácil e rápido!\n\n_SECMI - Sindicato dos Comerciários_`,
  (name: string) =>
    `Oi, ${name}! 🤝\n\nInformamos que o SECMI agora oferece recuperação de senha pelo WhatsApp. É bem simples: na tela de login do app, toque em "Esqueci minha senha", coloque seu e-mail e receba o link aqui. Mais praticidade no seu dia a dia! 🌟\n\n_SECMI - Sindicato dos Comerciários_`,
  (name: string) =>
    `${name}, novidade importante! 📌\n\nPrecisou trocar a senha do app SECMI? Agora o link de recuperação chega pelo WhatsApp! Vá na tela de login, selecione "Esqueci minha senha", digite seu e-mail e o link será enviado para este número. Aproveite! 😉\n\n_SECMI - Sindicato dos Comerciários_`,
  (name: string) =>
    `Olá, ${name}! 🏥\n\nO app SECMI ficou ainda melhor! Agora a recuperação de senha é feita pelo WhatsApp. Na tela de login, clique em "Esqueci minha senha", informe seu e-mail e receba o link seguro aqui mesmo. Seu acesso, na palma da mão! ✨\n\n_SECMI - Sindicato dos Comerciários_`,
  (name: string) =>
    `Ei, ${name}! 👋\n\nAtualizamos o app SECMI com um recurso muito pedido: recuperação de senha via WhatsApp! Acesse a tela de login, toque em "Esqueci minha senha", insira seu e-mail e o link para redefinir chegará direto aqui. Mais comodidade para você! 🚀\n\n_SECMI - Sindicato dos Comerciários_`,
];

function normalizePhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12) {
    digits = digits.slice(2);
  }
  if (digits.length === 10) {
    digits = digits.slice(0, 2) + "9" + digits.slice(2);
  }
  if (digits.length === 11) {
    digits = "55" + digits;
  }
  return digits;
}

function isValidPhone(digits: string): boolean {
  return /^55\d{2}9\d{8}$/.test(digits);
}

function getFirstName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  const first = parts[0] || "Associado";
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ⛔ DESATIVADA — Esta função enviava texto livre (não-template) em massa
  // para milhares de números, o que violou a política da Meta e contribuiu
  // para o banimento do número oficial do sindicato.
  // Toda comunicação transacional DEVE usar templates aprovados via
  // meta-send-template. Não reativar sem revisão.
  return new Response(
    JSON.stringify({
      disabled: true,
      reason:
        "Função desativada permanentemente. Envio em massa de texto livre viola política Meta e causou banimento. Use templates aprovados.",
    }),
    { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );

  // eslint-disable-next-line no-unreachable
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const batchOffset = body.offset || 0;
    const batchSize = body.batchSize || 3; // 3 messages per invocation (~90s with 30s delays)

    // Fetch distinct patients who had appointments Jan-Apr 2026
    const { data, error } = await supabase
      .from("patients")
      .select("phone, name, clinic_id")
      .eq("is_active", true)
      .not("phone", "is", null)
      .neq("phone", "")
      .in("id", 
        // subquery via raw - use a simpler approach: fetch appointments then filter
        []
      );

    // Better approach: fetch all appointment patient IDs first
    const { data: aptData, error: aptError } = await supabase
      .from("appointments")
      .select("patient_id")
      .gte("appointment_date", "2026-01-01")
      .lt("appointment_date", "2026-05-01");

    if (aptError) {
      return new Response(JSON.stringify({ error: aptError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const uniquePatientIds = [...new Set((aptData || []).map((r: any) => r.patient_id))];
    
    // Fetch patient details in chunks (Supabase .in() limit)
    const allPatients: any[] = [];
    for (let c = 0; c < uniquePatientIds.length; c += 100) {
      const chunk = uniquePatientIds.slice(c, c + 100);
      const { data: pData } = await supabase
        .from("patients")
        .select("phone, name, clinic_id")
        .eq("is_active", true)
        .not("phone", "is", null)
        .neq("phone", "")
        .in("id", chunk);
      if (pData) allPatients.push(...pData);
    }

    // Deduplicate by normalized phone
    const seen = new Map<string, { phone: string; name: string; clinic_id: string }>();
    for (const p of allPatients) {
      if (!p.phone?.trim()) continue;
      const normalized = normalizePhone(p.phone);
      if (!seen.has(normalized)) {
        seen.set(normalized, { phone: p.phone, name: p.name, clinic_id: p.clinic_id });
      }
    }
    const allRecords = Array.from(seen.values());

    console.log(`Total unique phones: ${allRecords.length}, Processing batch offset=${batchOffset}, size=${batchSize}`);

    // Get the slice for this batch
    const batch = allRecords.slice(batchOffset, batchOffset + batchSize);
    
    if (batch.length === 0) {
      return new Response(JSON.stringify({
        done: true,
        totalProcessed: batchOffset,
        totalRecords: allRecords.length,
        message: "All messages sent!",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const results: any[] = [];
    let sentCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < batch.length; i++) {
      const record = batch[i];
      const globalIndex = batchOffset + i;
      const normalized = normalizePhone(record.phone);
      const firstName = getFirstName(record.name);

      if (!isValidPhone(normalized)) {
        console.log(`[${globalIndex + 1}/${allRecords.length}] ⚠️ Skipping ${record.name}: ${record.phone} → ${normalized}`);
        results.push({ name: record.name, phone: record.phone, normalized, status: "skipped", reason: "invalid phone" });
        skippedCount++;
        continue;
      }

      const templateIndex = globalIndex % messageTemplates.length;
      const message = messageTemplates[templateIndex](firstName);

      try {
        const whatsappResponse = await fetch(`${supabaseUrl}/functions/v1/send-whatsapp`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            phone: normalized,
            message,
            clinicId: record.clinic_id,
            type: "custom",
          }),
        });

        const whatsappResult = await whatsappResponse.json().catch(() => null);

        if (whatsappResponse.ok && whatsappResult?.success !== false) {
          console.log(`[${globalIndex + 1}/${allRecords.length}] ✅ ${firstName} (${normalized})`);
          results.push({ name: record.name, phone: normalized, status: "sent" });
          sentCount++;
        } else {
          const errorMsg = whatsappResult?.error || `HTTP ${whatsappResponse.status}`;
          console.error(`[${globalIndex + 1}/${allRecords.length}] ❌ ${firstName} (${normalized}): ${errorMsg}`);
          results.push({ name: record.name, phone: normalized, status: "failed", error: errorMsg });
          failedCount++;
        }
      } catch (sendError: any) {
        console.error(`[${globalIndex + 1}/${allRecords.length}] ❌ ${firstName}: ${sendError.message}`);
        results.push({ name: record.name, phone: normalized, status: "failed", error: sendError.message });
        failedCount++;
      }

      // 30s delay between messages (skip on last)
      if (i < batch.length - 1) {
        await sleep(30000);
      }
    }

    const nextOffset = batchOffset + batchSize;
    const hasMore = nextOffset < allRecords.length;

    // Auto-trigger next batch if there are more
    if (hasMore) {
      // Fire-and-forget next batch after a 30s delay
      setTimeout(async () => {
        try {
          await fetch(`${supabaseUrl}/functions/v1/notify-password-reset-feature`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({ offset: nextOffset, batchSize }),
          });
          console.log(`🔄 Triggered next batch at offset ${nextOffset}`);
        } catch (e: any) {
          console.error(`Failed to trigger next batch: ${e.message}`);
        }
      }, 30000);
    }

    return new Response(JSON.stringify({
      done: !hasMore,
      batchOffset,
      batchSize,
      nextOffset: hasMore ? nextOffset : null,
      totalRecords: allRecords.length,
      batchResults: { sent: sentCount, skipped: skippedCount, failed: failedCount },
      results,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: any) {
    console.error("Fatal error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
