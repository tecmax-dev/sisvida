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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // 1. Verify Authorization header exists
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("[send-whatsapp-document] Missing Authorization header");
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Create client with user's auth to verify identity
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      console.error("[send-whatsapp-document] Invalid token:", authError?.message);
      return new Response(
        JSON.stringify({ success: false, error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Parse request body
    const { phone, clinicId, pdfBase64, fileName, caption } = await req.json() as SendDocumentRequest;

    console.log(`[send-whatsapp-document] User ${user.id} sending document to ${phone} for clinic ${clinicId}`);
    console.log(`[send-whatsapp-document] File: ${fileName}, Caption: ${caption?.substring(0, 50)}...`);

    if (!phone || !clinicId || !pdfBase64 || !fileName) {
      console.error("[send-whatsapp-document] Missing required fields");
      return new Response(
        JSON.stringify({ success: false, error: "Campos obrigatórios: phone, clinicId, pdfBase64, fileName" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Validate phone format
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 10 || cleanPhone.length > 13) {
      return new Response(
        JSON.stringify({ success: false, error: "Formato de telefone inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Validate file size (max 16MB base64)
    if (pdfBase64.length > 22 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ success: false, error: "Arquivo muito grande (máx 16MB)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. Create service role client for RPC call
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 7. Verify user has access to this clinic
    const { data: hasAccess, error: accessError } = await supabase.rpc("has_clinic_access", {
      _user_id: user.id,
      _clinic_id: clinicId
    });

    if (accessError || !hasAccess) {
      console.error(`[send-whatsapp-document] User ${user.id} denied access to clinic ${clinicId}`);
      return new Response(
        JSON.stringify({ success: false, error: "Acesso negado a esta clínica" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 8. Fetch Evolution API config for this clinic
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
    let formattedPhone = cleanPhone;
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
        media: pdfBase64,
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

    console.log(`[send-whatsapp-document] Document sent successfully by user ${user.id}`);

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
