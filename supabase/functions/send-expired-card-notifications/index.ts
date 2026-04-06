import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MESSAGE_TEMPLATES = [
  (name: string, clinic: string, card: string, expiry: string) =>
    `Olá ${name}! 👋\n\nSua carteirinha digital da *${clinic}* (${card}) expirou em *${expiry}*.\n\n⚠️ Para renovar, acesse o *aplicativo SECMI* e envie seu contracheque.\n\n📲 *Passo a passo:*\n1️⃣ Abra o app SECMI\n2️⃣ Toque em *"Nossos Serviços"*\n3️⃣ Selecione *"Atualizar Carteirinha"*\n4️⃣ Envie a foto do seu contracheque\n\n📥 Baixe o app: https://prosindweb.com.br/sindicato/instalar\n\nAtenciosamente,\nEquipe ${clinic}`,

  (name: string, clinic: string, card: string, expiry: string) =>
    `Prezado(a) ${name}, tudo bem? 😊\n\nInformamos que a carteirinha *${card}* da *${clinic}* teve sua validade encerrada em *${expiry}*.\n\nPara continuar utilizando os serviços, é necessário atualizar pelo aplicativo.\n\n📲 *Como atualizar:*\n1️⃣ Acesse o app SECMI no celular\n2️⃣ Vá em *"Nossos Serviços"*\n3️⃣ Clique em *"Atualizar Carteirinha"*\n4️⃣ Tire uma foto do contracheque atual e envie\n\n📥 Link do app: https://prosindweb.com.br/sindicato/instalar\n\nQualquer dúvida, estamos à disposição!\nEquipe ${clinic}`,

  (name: string, clinic: string, card: string, expiry: string) =>
    `${name}, boa tarde! 🌟\n\nIdentificamos que sua carteirinha da *${clinic}* (nº ${card}) venceu no dia *${expiry}*.\n\nA renovação é simples e feita pelo aplicativo:\n\n📱 *Siga estes passos:*\n✅ Abra o app SECMI\n✅ Acesse *"Nossos Serviços"* → *"Atualizar Carteirinha"*\n✅ Fotografe e envie seu contracheque\n\n🔗 Instale o app: https://prosindweb.com.br/sindicato/instalar\n\nConte conosco!\nEquipe ${clinic}`,

  (name: string, clinic: string, card: string, expiry: string) =>
    `Olá ${name}! 📋\n\nGostaríamos de informar que a validade da sua carteirinha digital (*${card}*) da *${clinic}* expirou em *${expiry}*.\n\nPara regularizar, utilize o aplicativo SECMI:\n\n📲 *Instruções:*\n1️⃣ Baixe ou abra o app SECMI\n2️⃣ Na seção *"Nossos Serviços"*, toque em *"Atualizar Carteirinha"*\n3️⃣ Envie a imagem do contracheque recente\n\n📥 Download: https://prosindweb.com.br/sindicato/instalar\n\nEstamos aqui para ajudar!\n${clinic}`,

  (name: string, clinic: string, card: string, expiry: string) =>
    `Caro(a) ${name}, 👋\n\nSua carteirinha *${card}* vinculada à *${clinic}* expirou em *${expiry}*.\n\n🔄 Para renová-la rapidamente, siga o passo a passo no app:\n\n1️⃣ Abra o *app SECMI*\n2️⃣ Navegue até *"Nossos Serviços"*\n3️⃣ Escolha *"Atualizar Carteirinha"*\n4️⃣ Faça o upload da foto do contracheque\n\n📥 Instalar app: https://prosindweb.com.br/sindicato/instalar\n\nAgradecemos sua atenção!\nEquipe ${clinic}`,

  (name: string, clinic: string, card: string, expiry: string) =>
    `${name}, informamos que a carteirinha digital (${card}) da *${clinic}* expirou no dia *${expiry}*. ⚠️\n\nPara continuar com acesso aos serviços, atualize pelo app SECMI:\n\n📲 *Passo a passo rápido:*\n1️⃣ Abra o aplicativo SECMI\n2️⃣ Vá em *"Nossos Serviços"* > *"Atualizar Carteirinha"*\n3️⃣ Envie a foto do seu contracheque atualizado\n\n📥 Baixe aqui: https://prosindweb.com.br/sindicato/instalar\n\nObrigado pela compreensão!\n${clinic}`,
];

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
    const offset = body.offset || 0;
    const batchSize = body.batch_size || 3;
    const delayMs = body.delay_ms || 30000;
    const sentPhonesFromPrev: string[] = body.sent_phones || [];

    // Get ALL expired March 2026 cards with valid phones
    const { data: allCards, error } = await supabase
      .from("patient_cards")
      .select(`
        id, card_number, expires_at, patient_id,
        patient:patients(id, name, phone),
        clinic:clinics(id, name)
      `)
      .eq("is_active", true)
      .gte("expires_at", "2026-03-01T00:00:00")
      .lt("expires_at", "2026-04-01T00:00:00")
      .order("expires_at", { ascending: true });

    if (error) throw error;

    // Deduplicate by phone
    const sentPhones = new Set<string>(sentPhonesFromPrev);
    const uniqueCards: any[] = [];

    for (const card of allCards || []) {
      const patient = card.patient as any;
      if (!patient?.phone) continue;
      const normalized = patient.phone.replace(/\D/g, "");
      if (normalized.length < 10) continue;
      if (sentPhones.has(normalized)) continue;
      sentPhones.add(normalized);
      uniqueCards.push(card);
    }

    // Slice for this batch
    const batch = uniqueCards.slice(offset, offset + batchSize);

    if (batch.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "Todas as notificações foram enviadas!", total_sent: offset }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: any[] = [];

    for (let i = 0; i < batch.length; i++) {
      const card = batch[i];
      const patient = card.patient as any;
      const clinic = card.clinic as any;

      // Format expiry date
      const dateOnly = (card.expires_at || "").slice(0, 10);
      const dateMatch = dateOnly.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      const expiryDate = dateMatch ? `${dateMatch[3]}/${dateMatch[2]}/${dateMatch[1]}` : card.expires_at;

      // Pick template
      const templateIndex = (offset + i) % MESSAGE_TEMPLATES.length;
      const message = MESSAGE_TEMPLATES[templateIndex](patient.name, clinic.name, card.card_number, expiryDate);

      // Wait 30s between messages (skip first in batch)
      if (i > 0) {
        await new Promise((r) => setTimeout(r, delayMs));
      }

      try {
        const { data: evolutionConfig } = await supabase
          .from("evolution_configs")
          .select("api_url, api_key, instance_name")
          .eq("clinic_id", clinic.id)
          .eq("is_connected", true)
          .single();

        if (!evolutionConfig) {
          results.push({ name: patient.name, success: false, error: "no_evolution_config" });
          continue;
        }

        let formattedPhone = patient.phone.replace(/\D/g, "");
        if (!formattedPhone.startsWith("55")) formattedPhone = "55" + formattedPhone;
        // Add 9th digit for BR mobiles
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
        console.log(`[${offset + i + 1}/47] ${patient.name} → ${success ? "✅" : "❌"}`);

        await supabase.from("card_expiry_notifications").insert({
          card_id: card.id,
          notification_type: "expired_march_2026",
          days_before_expiry: 0,
          success,
          error_message: success ? null : "API error",
        });
      } catch (err: any) {
        results.push({ name: patient.name, success: false, error: err.message });
      }
    }

    // Auto-chain next batch
    const nextOffset = offset + batchSize;
    const hasMore = nextOffset < uniqueCards.length;

    if (hasMore) {
      console.log(`Chaining batch at offset ${nextOffset}...`);
      supabase.functions
        .invoke("send-expired-card-notifications", {
          body: { offset: nextOffset, batch_size: batchSize, delay_ms: delayMs },
        })
        .catch((e: any) => console.error("Chain error:", e));
    }

    return new Response(
      JSON.stringify({
        success: true,
        batch_offset: offset,
        processed: results.length,
        remaining: uniqueCards.length - nextOffset,
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
