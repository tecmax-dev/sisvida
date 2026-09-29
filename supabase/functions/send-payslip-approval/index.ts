import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Encaminha para card-renewal-notify (WhatsApp oficial Meta, template aprovado,
// consentimento, opt-out e auditoria). Retorna o resultado REAL do envio.
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({} as any));
    const patientId = body.patient_id ?? body.patientId;
    const newExpiresAt = body.new_expires_at ?? body.newExpiresAt;
    const clinicId = body.clinic_id ?? body.clinicId;

    const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/card-renewal-notify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: req.headers.get("Authorization") ?? "",
        apikey: req.headers.get("apikey") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      },
      body: JSON.stringify({ patientId, newExpiresAt, clinicId }),
    });
    const result = await res.json().catch(() => ({}));
    console.log("send-payslip-approval → card-renewal-notify", res.status, JSON.stringify(result));

    return new Response(JSON.stringify({ success: !!result?.ok, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
