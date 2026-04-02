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

  // Remove leading 55 country code if present and long enough
  if (digits.startsWith("55") && digits.length >= 12) {
    digits = digits.slice(2);
  }

  // Fix: if 10 digits (missing the 9 after DDD), add it
  if (digits.length === 10) {
    digits = digits.slice(0, 2) + "9" + digits.slice(2);
  }

  // Ensure country code prefix
  if (digits.length === 11) {
    digits = "55" + digits;
  }

  return digits;
}

function isValidPhone(digits: string): boolean {
  // Must be 55 + 2-digit DDD + 9 + 8 digits = 13 digits total
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

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch distinct patients who had appointments Jan-Apr 2026
    const { data: patients, error: patientsError } = await supabase.rpc(
      "get_appointment_patients_for_notification",
      {}
    );

    // Fallback: direct query if RPC doesn't exist
    let records: Array<{ phone: string; name: string; clinic_id: string }> = [];

    if (patientsError || !patients) {
      console.log("RPC not available, using direct query fallback");
      const { data, error } = await supabase
        .from("appointments")
        .select("patient:patients!inner(phone, name, clinic_id)")
        .gte("appointment_date", "2026-01-01")
        .lt("appointment_date", "2026-05-01")
        .not("patient.phone", "is", null)
        .eq("patient.is_active", true);

      if (error) {
        console.error("Query error:", error);
        return new Response(
          JSON.stringify({ error: "Failed to fetch patients" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Deduplicate by phone
      const seen = new Map<string, { phone: string; name: string; clinic_id: string }>();
      for (const row of data || []) {
        const p = (row as any).patient;
        if (!p?.phone || !p.phone.trim()) continue;
        const normalized = normalizePhone(p.phone);
        if (!seen.has(normalized)) {
          seen.set(normalized, { phone: p.phone, name: p.name, clinic_id: p.clinic_id });
        }
      }
      records = Array.from(seen.values());
    } else {
      const seen = new Map<string, any>();
      for (const p of patients) {
        const normalized = normalizePhone(p.phone);
        if (!seen.has(normalized)) {
          seen.set(normalized, p);
        }
      }
      records = Array.from(seen.values());
    }

    console.log(`Total unique records to process: ${records.length}`);

    const results: Array<{ name: string; phone: string; status: string; error?: string }> = [];
    let sentCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const normalized = normalizePhone(record.phone);
      const firstName = getFirstName(record.name);

      // Skip invalid phones
      if (!isValidPhone(normalized)) {
        console.log(`Skipping invalid phone for ${record.name}: ${record.phone} → ${normalized}`);
        results.push({ name: record.name, phone: record.phone, status: "skipped", error: `Invalid phone: ${normalized}` });
        skippedCount++;
        continue;
      }

      // Pick a message template based on index (rotating through all 12)
      const templateIndex = i % messageTemplates.length;
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
          console.log(`[${i + 1}/${records.length}] ✅ Sent to ${firstName} (${normalized})`);
          results.push({ name: record.name, phone: normalized, status: "sent" });
          sentCount++;
        } else {
          const errorMsg = whatsappResult?.error || `HTTP ${whatsappResponse.status}`;
          console.error(`[${i + 1}/${records.length}] ❌ Failed for ${firstName} (${normalized}): ${errorMsg}`);
          results.push({ name: record.name, phone: normalized, status: "failed", error: errorMsg });
          failedCount++;
        }
      } catch (sendError: any) {
        console.error(`[${i + 1}/${records.length}] ❌ Exception for ${firstName} (${normalized}): ${sendError.message}`);
        results.push({ name: record.name, phone: normalized, status: "failed", error: sendError.message });
        failedCount++;
      }

      // Wait 30 seconds before next message (skip delay on last iteration)
      if (i < records.length - 1) {
        console.log(`Waiting 30s before next message...`);
        await sleep(30000);
      }
    }

    const summary = {
      total: records.length,
      sent: sentCount,
      skipped: skippedCount,
      failed: failedCount,
      results,
    };

    console.log(`\n=== SUMMARY ===`);
    console.log(`Total: ${summary.total}, Sent: ${sentCount}, Skipped: ${skippedCount}, Failed: ${failedCount}`);

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Fatal error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
