import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * MOBILE PATIENT CARD - Edge Function
 * 
 * Busca dados da carteirinha do paciente usando SERVICE_ROLE_KEY
 * para contornar problemas de RLS quando a sessão JWT mobile expira.
 * 
 * Input: { patientId: string }
 * Output: { card, payslipRequest, clinicName, clinicLogo }
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "Access-Control-Max-Age": "86400",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { patientId } = await req.json();

    if (!patientId || typeof patientId !== "string") {
      return new Response(
        JSON.stringify({ error: "missing or invalid patientId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // UUID validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(patientId)) {
      return new Response(
        JSON.stringify({ error: "invalid patientId format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch patient data and card in parallel
    const [patientResult, cardResult] = await Promise.all([
      supabase
        .from("patients")
        .select("id, name, cpf, photo_url, registration_number, tag, clinic_id")
        .eq("id", patientId)
        .single(),
      supabase
        .from("patient_cards")
        .select("id, card_number, qr_code_token, issued_at, expires_at, is_active, notes")
        .eq("patient_id", patientId)
        .eq("is_active", true)
        .order("expires_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (patientResult.error || !patientResult.data) {
      console.error("[mobile-patient-card] Patient not found:", patientResult.error);
      return new Response(
        JSON.stringify({ error: "patient_not_found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const patient = patientResult.data;
    const card = cardResult.data;
    const clinicId = patient.clinic_id;

    // Fetch clinic data and pending payslip request in parallel
    const [clinicResult, payslipResult] = await Promise.all([
      supabase
        .from("clinics")
        .select("name, logo_url")
        .eq("id", clinicId)
        .single(),
      card
        ? supabase
            .from("payslip_requests")
            .select("id, status, requested_at, received_at, reviewed_at")
            .eq("patient_id", patientId)
            .eq("clinic_id", clinicId)
            .in("status", ["pending", "received"])
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    return new Response(
      JSON.stringify({
        patient: {
          id: patient.id,
          name: patient.name,
          cpf: patient.cpf,
          photo_url: patient.photo_url,
          registration_number: patient.registration_number,
          tag: patient.tag,
          clinic_id: patient.clinic_id,
        },
        card: card || null,
        clinic: clinicResult.data || null,
        payslipRequest: payslipResult.data || null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[mobile-patient-card] Error:", err);
    return new Response(
      JSON.stringify({ error: "internal_error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
