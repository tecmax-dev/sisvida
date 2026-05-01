import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Zap Responder usa internamente a Zapster API
// Documentação: https://developer.zapsterapi.com/pt-BR/v1/api-reference/messages/sending
const ZAPSTER_BASE_URL = "https://api.zapsterapi.com/v1";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
     const body = await req.json();
     const {
       phone,
       message,
       clinicId,
       mediaUrl,
       mediaBase64,
       mediaCaption,
       fileName,
       buttons,
       replyTo,
       sendAt,
       test,
     } = body;

     if (!clinicId || (!phone && !test)) {
      return new Response(
        JSON.stringify({ success: false, error: "Phone and clinicId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const apiToken = Deno.env.get("ZAPSTER_API_TOKEN") || Deno.env.get("ZAPRESPONDER_API_TOKEN");
    if (!apiToken) {
      console.error("[zapster] ZAPSTER_API_TOKEN not configured");
      return new Response(
        JSON.stringify({ success: false, error: "ZAPSTER_API_TOKEN não configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Test mode: validate token by listing instances
    if (test) {
      const r = await fetch(`${ZAPSTER_BASE_URL}/wa/instances?per_page=1`, {
        headers: { Authorization: `Bearer ${apiToken}` },
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        return new Response(
          JSON.stringify({ success: false, error: `Token inválido (${r.status})`, data }),
          { status: r.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ success: true, message: "Token válido", data }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolve instance_id da clínica
    const { data: zapsterCfg, error: cfgErr } = await supabase
      .from("zapster_configs")
      .select("instance_id, is_active")
      .eq("clinic_id", clinicId)
      .maybeSingle();

    if (cfgErr || !zapsterCfg) {
      return new Response(
        JSON.stringify({ success: false, error: "Zap Responder não configurado para esta clínica" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!zapsterCfg.is_active) {
      return new Response(
        JSON.stringify({ success: false, error: "Zap Responder desativado para esta clínica" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normaliza recipient: dígitos com 55
    let cleanPhone = phone.replace(/\D/g, "");
    if (!cleanPhone.startsWith("55") && cleanPhone.length >= 10 && cleanPhone.length <= 11) {
      cleanPhone = "55" + cleanPhone;
    }

    // Monta payload Zapster: POST /wa/messages
    const payload: Record<string, unknown> = {
      recipient: cleanPhone,
      instance_id: zapsterCfg.instance_id,
    };

    if (message) payload.text = message;
    if (replyTo) payload.reply_to = replyTo;
    if (sendAt) payload.send_at = sendAt;

    if (mediaUrl || mediaBase64) {
      const media: Record<string, unknown> = {};
      if (mediaUrl) media.url = mediaUrl;
      if (mediaBase64) media.base64 = mediaBase64;
      if (mediaCaption) media.caption = mediaCaption;
      if (fileName) media.fileName = fileName;
      payload.media = media;
    }

    if (Array.isArray(buttons) && buttons.length > 0) {
      payload.buttons = buttons;
      payload.buttons_mode = "auto";
    }

    console.log(`[zapster] Sending to ${cleanPhone} via instance ${zapsterCfg.instance_id}`);

    const response = await fetch(`${ZAPSTER_BASE_URL}/wa/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiToken}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error("[zapster] API error:", response.status, result);
      return new Response(
        JSON.stringify({ success: false, error: `Zapster ${response.status}`, details: result }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[zapster] Error in send-whatsapp-zapresponder:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
