import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Zap Responder usa internamente a Zapster API
// Documentação: https://developer.zapsterapi.com/pt-BR/v1/api-reference/messages/sending
const ZAP_RESPONDER_BASE_URL = "https://api.zapresponder.com.br/api/whatsapp";

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

    // Resolve instance_id da clínica. 
    // Priorizamos o ID que começa com 'fa' (DepartmentID padrão no Zap Responder para envios)
    const { data: configs, error: cfgErr } = await supabase
      .from("zapster_configs")
      .select("instance_id, is_active")
      .eq("clinic_id", clinicId)
      .eq("is_active", true);

    // Resolve instance_id da clínica.
    // Tentamos todos os IDs disponíveis um por um até o Zap Responder aceitar (200 OK)
    if (!configs || configs.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Zap Responder não configurado para esta clínica" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let lastResult = { status: 404, data: {} };
    let success = false;

    // Normaliza recipient: dígitos com 55
    let cleanPhone = phone.replace(/\D/g, "");
    if (!cleanPhone.startsWith("55") && cleanPhone.length >= 10 && cleanPhone.length <= 11) {
      cleanPhone = "55" + cleanPhone;
    }

    for (const cfg of configs) {
      console.log(`[zapresponder] Attempting send via instance ${cfg.instance_id}`);
      
      const payload = {
        phone: cleanPhone,
        message: message,
        departmentId: cfg.instance_id,
      };

      if (mediaUrl) (payload as any).mediaUrl = mediaUrl;

      try {
        const response = await fetch(`${ZAP_RESPONDER_BASE_URL}/messages/send`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiToken}`,
            "Accept": "application/json"
          },
          body: JSON.stringify(payload),
        });

        const result = await response.json().catch(() => ({}));
        lastResult = { status: response.status, data: result };

        if (response.ok) {
          console.log(`[zapresponder] Success via instance ${cfg.instance_id}`);
          success = true;
          break;
        } else {
          console.warn(`[zapresponder] Failed via ${cfg.instance_id}: ${response.status}`, result);
        }
      } catch (err) {
        console.error(`[zapresponder] Exception via ${cfg.instance_id}:`, err);
      }
    }

    if (success) {
      return new Response(
        JSON.stringify({ success: true, data: lastResult.data }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: `Zapster ${lastResult.status}`, details: lastResult.data }),
      { status: lastResult.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {

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

    // Zap Responder Não Oficial (QRCode): POST /api/whatsapp/messages/send
    // Endpoint inferido para envios não oficiais
    const payload: Record<string, unknown> = {
      phone: cleanPhone,
      message: message,
      departmentId: zapsterCfg.instance_id,
    };

    if (mediaUrl) {
      payload.mediaUrl = mediaUrl;
    }

    console.log(`[zapresponder] Sending to ${cleanPhone} via department/instance ${zapsterCfg.instance_id}`);

    const response = await fetch(`${ZAP_RESPONDER_BASE_URL}/messages/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiToken}`,
        "Accept": "application/json"
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
