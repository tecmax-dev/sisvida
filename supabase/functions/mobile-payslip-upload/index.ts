import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * MOBILE PAYSLIP UPLOAD - Edge Function
 * 
 * Handles payslip file upload and payslip_requests creation using SERVICE_ROLE_KEY
 * to bypass RLS issues when mobile JWT is expired.
 * 
 * Accepts multipart/form-data with:
 * - file: the payslip file (image or PDF)
 * - patientId: string
 * - clinicId: string
 * - cardId: string
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Cache-Control": "no-store, no-cache, must-revalidate",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const contentType = req.headers.get("content-type") || "";
    
    if (!contentType.includes("multipart/form-data")) {
      return new Response(
        JSON.stringify({ error: "Expected multipart/form-data" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const patientId = formData.get("patientId") as string | null;
    const clinicId = formData.get("clinicId") as string | null;
    const cardId = formData.get("cardId") as string | null;

    // Validate inputs
    if (!file || !patientId || !clinicId || !cardId) {
      return new Response(
        JSON.stringify({ error: "missing required fields: file, patientId, clinicId, cardId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // UUID validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(patientId) || !uuidRegex.test(clinicId) || !uuidRegex.test(cardId)) {
      return new Response(
        JSON.stringify({ error: "invalid UUID format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      return new Response(
        JSON.stringify({ error: "invalid file type. Allowed: JPG, PNG, WebP, PDF" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ error: "file too large. Max 10MB" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify patient exists and belongs to clinic
    const { data: patient, error: patientError } = await supabase
      .from("patients")
      .select("id, clinic_id")
      .eq("id", patientId)
      .eq("clinic_id", clinicId)
      .single();

    if (patientError || !patient) {
      console.error("[mobile-payslip-upload] Patient not found:", patientError);
      return new Response(
        JSON.stringify({ error: "patient_not_found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify card exists and belongs to patient
    const { data: card, error: cardError } = await supabase
      .from("patient_cards")
      .select("id")
      .eq("id", cardId)
      .eq("patient_id", patientId)
      .single();

    if (cardError || !card) {
      console.error("[mobile-payslip-upload] Card not found:", cardError);
      return new Response(
        JSON.stringify({ error: "card_not_found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Upload file to contra-cheques bucket
    const fileExt = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const fileName = `${clinicId}/${patientId}/${Date.now()}.${fileExt}`;

    const fileBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from("contra-cheques")
      .upload(fileName, fileBuffer, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: true,
      });

    if (uploadError) {
      console.error("[mobile-payslip-upload] Storage upload error:", uploadError);
      return new Response(
        JSON.stringify({ error: "upload_failed", details: uploadError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create payslip request record
    const { data: payslipRequest, error: requestError } = await supabase
      .from("payslip_requests")
      .insert({
        clinic_id: clinicId,
        patient_id: patientId,
        card_id: cardId,
        status: "received",
        received_at: new Date().toISOString(),
        attachment_path: fileName,
        notes: "Enviado via app mobile - Atualização de Carteirinha",
      })
      .select("id, status")
      .single();

    if (requestError) {
      console.error("[mobile-payslip-upload] Insert error:", requestError);
      return new Response(
        JSON.stringify({ error: "request_creation_failed", details: requestError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[mobile-payslip-upload] Success: patient=${patientId}, request=${payslipRequest.id}`);

    return new Response(
      JSON.stringify({ success: true, requestId: payslipRequest.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[mobile-payslip-upload] Error:", err);
    return new Response(
      JSON.stringify({ error: "internal_error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
