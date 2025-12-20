import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendDocumentRequest {
  phone: string;
  clinicId: string;
  pdfBase64: string;
  fileName: string;
  caption?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, clinicId, pdfBase64, fileName, caption } = await req.json() as SendDocumentRequest;

    console.log(`[send-whatsapp-document] Sending document to ${phone} for clinic ${clinicId}`);
    console.log(`[send-whatsapp-document] File: ${fileName}, Caption: ${caption?.substring(0, 50)}...`);

    if (!phone || !clinicId || !pdfBase64 || !fileName) {
      console.error("[send-whatsapp-document] Missing required fields");
      return new Response(
        JSON.stringify({ success: false, error: "Campos obrigatórios: phone, clinicId, pdfBase64, fileName" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch Evolution API config for this clinic
    const { data: evolutionConfig, error: configError } = await supabase
      .from("evolution_configs")
      .select("*")
      .eq("clinic_id", clinicId)
      .single();

    if (configError || !evolutionConfig) {
      console.error("[send-whatsapp-document] Evolution config not found:", configError);
      return new Response(
        JSON.stringify({ success: false, error: "WhatsApp não configurado para esta clínica" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!evolutionConfig.is_connected) {
      console.error("[send-whatsapp-document] WhatsApp not connected");
      return new Response(
        JSON.stringify({ success: false, error: "WhatsApp não está conectado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { api_url, api_key, instance_name } = evolutionConfig;

    // Format phone number (remove non-digits and ensure country code)
    let formattedPhone = phone.replace(/\D/g, "");
    if (!formattedPhone.startsWith("55")) {
      formattedPhone = "55" + formattedPhone;
    }

    console.log(`[send-whatsapp-document] Formatted phone: ${formattedPhone}`);
    console.log(`[send-whatsapp-document] Instance: ${instance_name}`);

    // Send document via Evolution API
    const evolutionUrl = `${api_url}/message/sendMedia/${instance_name}`;
    console.log(`[send-whatsapp-document] Calling Evolution API: ${evolutionUrl}`);

    const response = await fetch(evolutionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": api_key,
      },
      body: JSON.stringify({
        number: formattedPhone,
        mediatype: "document",
        mimetype: "application/pdf",
        media: `data:application/pdf;base64,${pdfBase64}`,
        fileName: fileName,
        caption: caption || "",
      }),
    });

    const responseText = await response.text();
    console.log(`[send-whatsapp-document] Evolution API response status: ${response.status}`);
    console.log(`[send-whatsapp-document] Evolution API response: ${responseText.substring(0, 500)}`);

    if (!response.ok) {
      console.error("[send-whatsapp-document] Evolution API error:", responseText);
      return new Response(
        JSON.stringify({ success: false, error: `Erro da API Evolution: ${responseText}` }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      result = { raw: responseText };
    }

    console.log("[send-whatsapp-document] Document sent successfully");

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erro interno";
    console.error("[send-whatsapp-document] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
