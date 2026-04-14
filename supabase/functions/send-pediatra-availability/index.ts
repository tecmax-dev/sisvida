import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MESSAGE_TEMPLATES = [
  (name: string, clinic: string) =>
    `Olá ${name}! 👋\n\nTemos uma ótima notícia! A *Dra. Uiara Tiuba* (Pediatra) está com vagas disponíveis para esta *terça-feira, 14/04/2026, a partir das 14h*! 🩺\n\n📅 *Data:* 14/04/2026 (Terça-feira)\n⏰ *Horário:* A partir das 14:00\n👩‍⚕️ *Profissional:* Dra. Uiara Tiuba\n🏥 *Especialidade:* Pediatria\n\n📲 *Agende agora pelo aplicativo SECMI:*\n1️⃣ Abra o app SECMI\n2️⃣ Toque em *"Nossos Serviços"*\n3️⃣ Selecione *"Agendar Consulta"*\n4️⃣ Escolha *Dra. Uiara Tiuba*\n5️⃣ Selecione o dia *14/04* e o horário desejado\n\n📥 Baixe o app: https://prosindweb.com.br/sindicato/instalar\n\n⚠️ Vagas limitadas!\n\nAtenciosamente,\nEquipe ${clinic}`,

  (name: string, clinic: string) =>
    `Prezado(a) ${name}, tudo bem? 😊\n\nInformamos que há *vagas abertas* para consulta com a *Dra. Uiara Tiuba* (Pediatra) nesta terça-feira, a partir das 14h!\n\n📋 *Detalhes:*\n📅 Data: *14/04/2026* (Terça-feira)\n⏰ Horário: *A partir das 14:00*\n👩‍⚕️ Médica: *Dra. Uiara Tiuba*\n🏥 Especialidade: *Pediatria*\n\n📲 *Como agendar pelo app:*\n✅ Acesse o app SECMI no celular\n✅ Vá em *"Nossos Serviços"* → *"Agendar Consulta"*\n✅ Selecione a Dra. Uiara Tiuba e o dia 14/04\n\n📥 Link do app: https://prosindweb.com.br/sindicato/instalar\n\nNão perca essa oportunidade! Vagas limitadas.\n\nEquipe ${clinic}`,

  (name: string, clinic: string) =>
    `${name}, boa notícia! 🌟\n\nA *Pediatra Dra. Uiara Tiuba* tem horários disponíveis para *terça-feira, dia 14/04/2026, a partir das 14h*!\n\n🗓️ *Informações:*\n• Data: 14/04/2026 (Terça)\n• Horário: A partir das 14:00\n• Profissional: Dra. Uiara Tiuba\n• Área: Pediatria\n\n📱 *Agende pelo aplicativo SECMI:*\n1️⃣ Abra o app SECMI\n2️⃣ Acesse *"Nossos Serviços"* > *"Agendar Consulta"*\n3️⃣ Escolha a Dra. Uiara Tiuba\n4️⃣ Selecione 14/04 e confirme\n\n🔗 Instale o app: https://prosindweb.com.br/sindicato/instalar\n\nGaranta seu horário!\nEquipe ${clinic}`,

  (name: string, clinic: string) =>
    `Olá ${name}! 📋\n\nGostaríamos de avisar que a *Dra. Uiara Tiuba*, nossa pediatra, abriu novos horários para atendimento nesta *terça-feira (14/04/2026)*, a partir das *14h*.\n\n📅 *Quando:* Terça, 14 de abril de 2026, às 14h\n👩‍⚕️ *Quem:* Dra. Uiara Tiuba (Pediatra)\n\n📲 *Para agendar:*\n1️⃣ Baixe ou abra o app SECMI\n2️⃣ Na seção *"Nossos Serviços"*, toque em *"Agendar Consulta"*\n3️⃣ Selecione a Dra. Uiara Tiuba\n4️⃣ Escolha o melhor horário no dia 14/04\n\n📥 Download: https://prosindweb.com.br/sindicato/instalar\n\nAproveite a disponibilidade!\n${clinic}`,

  (name: string, clinic: string) =>
    `Caro(a) ${name}, 👋\n\nPassando para informar que a *Dra. Uiara Tiuba* (Pediatria) está com agenda aberta para *14/04/2026 (terça-feira)*, com horários a partir das *14h*!\n\n🔔 *Detalhes da consulta:*\n• Profissional: Dra. Uiara Tiuba\n• Especialidade: Pediatria\n• Data: Terça-feira, 14/04/2026\n• Início: 14:00\n\n🔄 *Agende rápido pelo app:*\n✅ Abra o *app SECMI*\n✅ Navegue até *"Nossos Serviços"*\n✅ Escolha *"Agendar Consulta"*\n✅ Selecione a Dra. Uiara e o dia 14/04\n\n📥 Instalar app: https://prosindweb.com.br/sindicato/instalar\n\nAgradecemos sua atenção!\nEquipe ${clinic}`,

  (name: string, clinic: string) =>
    `${name}, informamos que a *Dra. Uiara Tiuba* (Pediatra) tem vagas para esta *terça-feira, 14/04/2026, a partir das 14:00*! 🩺\n\n📌 *Resumo:*\n📅 14/04/2026 — Terça-feira\n⏰ A partir das 14h\n👩‍⚕️ Dra. Uiara Tiuba\n🏥 Pediatria\n\n📲 *Passo a passo para agendar:*\n1️⃣ Abra o aplicativo SECMI\n2️⃣ Vá em *"Nossos Serviços"* > *"Agendar Consulta"*\n3️⃣ Selecione Dra. Uiara Tiuba\n4️⃣ Confirme o horário desejado no dia 14/04\n\n📥 Baixe aqui: https://prosindweb.com.br/sindicato/instalar\n\nCorra, pois as vagas são limitadas! 🏃‍♀️\nObrigado,\n${clinic}`,

  (name: string, clinic: string) =>
    `Oi ${name}! 😊\n\nTemos uma novidade: a *Dra. Uiara Tiuba*, pediatra da ${clinic}, está atendendo nesta *terça-feira, 14/04/2026* e ainda há horários disponíveis a partir das *14h*!\n\n🗓 Data: *14/04/2026*\n⏰ Horário: *A partir das 14:00*\n👩‍⚕️ Médica: *Dra. Uiara Tiuba*\n💊 Especialidade: *Pediatria*\n\n📱 Agende pelo app SECMI:\n1️⃣ Abra o app\n2️⃣ Toque em *"Nossos Serviços"*\n3️⃣ Depois em *"Agendar Consulta"*\n4️⃣ Escolha a Dra. Uiara no dia 14/04\n\n📥 App: https://prosindweb.com.br/sindicato/instalar\n\nNão deixe para depois!\n${clinic}`,

  (name: string, clinic: string) =>
    `Olá ${name}, bom dia! ☀️\n\nEstamos entrando em contato para informar que a *Dra. Uiara Tiuba* tem disponibilidade na agenda de *Pediatria* para esta terça, *14/04/2026, a partir das 14h*.\n\n📋 *Dados:*\n• Médica: Dra. Uiara Tiuba\n• Especialidade: Pediatria\n• Dia: 14/04/2026 (Terça)\n• Horário: A partir das 14:00\n\n📲 *Agende pelo SECMI:*\n1️⃣ Abra o aplicativo SECMI\n2️⃣ Acesse *"Nossos Serviços"*\n3️⃣ Selecione *"Agendar Consulta"*\n4️⃣ Escolha a profissional e o horário\n\n📥 Instale: https://prosindweb.com.br/sindicato/instalar\n\nEstamos à disposição!\nEquipe ${clinic}`,
];

const PROFESSIONAL_ID = "4012d4ac-ec6f-455e-b0bd-cd7d565c7abe";
const CLINIC_ID = "89e7585e-7bce-4e58-91fa-c37080d1170d";
const CLINIC_NAME = "SECMI";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json().catch(() => ({}));
    const notificationTitle = body.notification_title || "🩺 Vagas disponíveis - Pediatria";
    const notificationMessage = body.notification_message || "Novas vagas disponíveis para Pediatria com a Dra. Uiara Tiuba. Agende pelo aplicativo!";
    const offset = body.offset || 0;
    const batchSize = body.batch_size || 2;
    const delayMs = body.delay_ms || 120000; // 120 seconds
    const sentPhonesFromPrev: string[] = body.sent_phones || [];

    // Get patients who had appointments with Dra Uiara in Jan-Mar 2026
    const { data: appointmentPatients, error: apError } = await supabase
      .from("appointments")
      .select("patient_id")
      .eq("clinic_id", CLINIC_ID)
      .eq("professional_id", PROFESSIONAL_ID)
      .gte("appointment_date", "2026-01-01")
      .lte("appointment_date", "2026-03-31")
      .neq("status", "cancelled");

    if (apError) throw apError;

    const patientIds = [...new Set((appointmentPatients || []).map((a: any) => a.patient_id))];

    if (patientIds.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "Nenhum paciente encontrado no período." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get patient details
    const { data: allPatients, error } = await supabase
      .from("patients")
      .select("id, name, phone")
      .in("id", patientIds)
      .not("phone", "is", null)
      .order("name", { ascending: true });

    if (error) throw error;

    // Deduplicate by phone
    const sentPhones = new Set<string>(sentPhonesFromPrev);
    const uniquePatients: any[] = [];

    for (const patient of allPatients || []) {
      if (!patient.phone) continue;
      const normalized = patient.phone.replace(/\D/g, "");
      if (normalized.length < 10) continue;
      if (sentPhones.has(normalized)) continue;
      sentPhones.add(normalized);
      uniquePatients.push(patient);
    }

    const batch = uniquePatients.slice(offset, offset + batchSize);

    if (batch.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "Todas as notificações foram enviadas!", total_sent: offset, total_unique: uniquePatients.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Evolution config
    const { data: evolutionConfig } = await supabase
      .from("evolution_configs")
      .select("api_url, api_key, instance_name")
      .eq("clinic_id", CLINIC_ID)
      .eq("is_connected", true)
      .single();

    if (!evolutionConfig) {
      return new Response(
        JSON.stringify({ error: "Evolution API not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: any[] = [];

    for (let i = 0; i < batch.length; i++) {
      const patient = batch[i];
      const firstName = patient.name.split(" ")[0];
      const templateIndex = (offset + i) % MESSAGE_TEMPLATES.length;
      const message = MESSAGE_TEMPLATES[templateIndex](firstName, CLINIC_NAME);

      if (i > 0) {
        await new Promise((r) => setTimeout(r, delayMs));
      }

      try {
        let formattedPhone = patient.phone.replace(/\D/g, "");
        if (!formattedPhone.startsWith("55")) formattedPhone = "55" + formattedPhone;
        const digits = formattedPhone.replace(/^55/, "");
        if (digits.length === 10) {
          formattedPhone = `55${digits.slice(0, 2)}9${digits.slice(2)}`;
        }

        const response = await fetch(
          `${evolutionConfig.api_url}/message/sendText/${evolutionConfig.instance_name}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: evolutionConfig.api_key },
            body: JSON.stringify({ number: formattedPhone, text: message }),
          }
        );

        const success = response.ok;
        results.push({ name: patient.name, phone: formattedPhone, success, template: templateIndex });
        console.log(`[${offset + i + 1}] ${patient.name} → ${success ? "✅" : "❌"}`);
      } catch (err: any) {
        results.push({ name: patient.name, success: false, error: err.message });
      }
    }

    // Auto-chain next batch
    const nextOffset = offset + batchSize;
    const hasMore = nextOffset < uniquePatients.length;

    if (hasMore) {
      // Wait delay before chaining to respect anti-ban interval
      console.log(`Waiting ${delayMs/1000}s before chaining batch at offset ${nextOffset}...`);
      await new Promise((r) => setTimeout(r, delayMs));
      console.log(`Chaining batch at offset ${nextOffset}...`);
      const allSentPhones = Array.from(sentPhones);
      supabase.functions
        .invoke("send-pediatra-availability", {
          body: { offset: nextOffset, batch_size: batchSize, delay_ms: delayMs, sent_phones: allSentPhones },
        })
        .catch((e: any) => console.error("Chain error:", e));
    }

    return new Response(
      JSON.stringify({
        success: true,
        batch_offset: offset,
        processed: results.length,
        total_unique: uniquePatients.length,
        remaining: uniquePatients.length - nextOffset,
        has_more: hasMore,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
