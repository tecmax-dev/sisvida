import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const clinicId = "78ab4a91-fb13-47d4-97ad-5df4460b8ecd";
    const phone = "73999462850";

    // Get Evolution config
    const { data: config, error: configError } = await supabase
      .from("evolution_configs")
      .select("api_url, api_key, instance_name, is_connected")
      .eq("clinic_id", clinicId)
      .eq("is_connected", true)
      .single();

    if (configError || !config) {
      return new Response(JSON.stringify({ error: "No WhatsApp config found" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const message = `Prezada Gercilene, bom dia! 👋

Gostaríamos de pedir sinceras desculpas por uma cobrança indevida que foi realizada referente à negociação *NEG-2026-00007*.

Houve uma falha na conciliação entre nosso sistema financeiro e a plataforma de pagamentos, o que fez com que uma parcela já paga constasse como em aberto, gerando a cobrança equivocada.

*O erro já foi corrigido em nosso sistema.*

✅ Informamos que existe *apenas 1 (uma) parcela em aberto:*

━━━━━━━━━━━━━━━━
📅 *Vencimento:* 26/05/2026
💰 *Valor:* R$ 214,58
━━━━━━━━━━━━━━━━

Pedimos desculpas pelo transtorno e nos colocamos à disposição para qualquer esclarecimento.

Atenciosamente,
*SECMI - Sindicato dos Empregados no Comércio*`;

    const formattedPhone = phone.startsWith("55") ? phone : `55${phone}`;

    const response = await fetch(
      `${config.api_url}/message/sendText/${config.instance_name}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: config.api_key,
        },
        body: JSON.stringify({
          number: `${formattedPhone}@s.whatsapp.net`,
          text: message,
        }),
      }
    );

    const result = await response.text();
    console.log("Evolution API response:", result);

    if (!response.ok) {
      return new Response(JSON.stringify({ success: false, error: result }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log the message
    const monthYear = new Date().toISOString().slice(0, 7);
    await supabase.from("message_logs").insert({
      clinic_id: clinicId,
      message_type: "custom",
      status: "sent",
      month_year: monthYear,
    });

    return new Response(JSON.stringify({ success: true, result: JSON.parse(result) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
